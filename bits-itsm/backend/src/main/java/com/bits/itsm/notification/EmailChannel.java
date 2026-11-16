package com.bits.itsm.notification;

import com.bits.itsm.audit.*;
import com.bits.itsm.event.*;
import com.bits.itsm.incident.*;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Transactional outbox: the worker can only see committed incident messages. */
@Component
public class EmailChannel implements IncidentObserver {
    private static final int MAX_ATTEMPTS = 3;
    private final JdbcTemplate jdbc;
    private final IncidentRepository incidents;
    private final NotificationDeliveryRepository deliveries;
    private final JavaMailSender sender;
    private final AuditStore audit;
    private final TransactionTemplate transactions;
    private final String username, password, baseUrl;
    private final long retrySeconds;
    public EmailChannel(JdbcTemplate jdbc, IncidentRepository incidents, NotificationDeliveryRepository deliveries,
            JavaMailSender sender, AuditStore audit, PlatformTransactionManager manager,
            @Value("${spring.mail.username:}") String username, @Value("${spring.mail.password:}") String password,
            @Value("${bitsolve.mail.base-url:}") String baseUrl, @Value("${bitsolve.mail.retry-seconds:60}") long retrySeconds) {
        this.jdbc = jdbc; this.incidents = incidents; this.deliveries = deliveries;
        this.sender = sender; this.audit = audit; this.username = username; this.password = password;
        this.baseUrl = baseUrl.replaceAll("/+$", ""); this.retrySeconds = Math.max(1, retrySeconds);
        transactions = new TransactionTemplate(manager);
        if (!baseUrl.isBlank() && !baseUrl.matches("https?://[^\\s?#]+")) throw new IllegalArgumentException("APP_BASE_URL must be an HTTP(S) URL without a query or fragment.");
    }
    @Override public void onEvent(IncidentEvent event) {
        String type = switch (Objects.toString(event.action(), "")) {
            case "CREATED" -> "INCIDENT_RECEIVED";
            case "INVESTIGATION_STARTED" -> "IN_PROGRESS".equals(event.next()) && !"IN_PROGRESS".equals(event.previous()) ? "WORK_STARTED" : null;
            case "RESOLVED" -> "RESOLVED".equals(event.next()) && !"RESOLVED".equals(event.previous()) ? "INCIDENT_RESOLVED" : null;
            default -> null;
        };
        if (type == null) return;
        if (!TransactionSynchronizationManager.isActualTransactionActive()) throw new IllegalStateException("Email must be queued inside the incident transaction.");
        Incident incident = incidents.findById(event.incidentId()).orElseThrow();
        var reporter = incident.getReporter();
        String message = body(reporter.getName(), incident.getId(), incident.getTitle(), incident.getStatus().name(), type, baseUrl);
        // A stable key means one message per incident/event, including after retries or reopening.
        jdbc.update("insert into notification_deliveries(id, recipient_id, recipient_email, channel, type, incident_id, title, message, created_at, delivery_status, attempts, next_attempt_at) values (?, ?, ?, 'EMAIL', ?, ?, ?, ?, current_timestamp, 'PENDING', 0, current_timestamp) on conflict do nothing",
                "STUDENT-EMAIL-" + incident.getId() + "-" + type, reporter.getId(), reporter.getEmail(), type, incident.getId(),
                "BITSolve | Incident #" + incident.getId() + " | " + type.replace('_', ' '), message);
    }
    static String body(String student, Long id, String title, String status, String type, String baseUrl) {
        String detail = switch (type) {
            case "INCIDENT_RECEIVED" -> "We have received your incident. Our campus IT team will review it.";
            case "WORK_STARTED" -> "Your technician has started investigating the incident.";
            default -> "Your technician has resolved the incident. Please sign in to BITSolve and verify the resolution, or let us know if the issue remains.";
        };
        return "BITSolve - Smart Campus IT Support\n\nHello " + student + ",\n\nIncident ID: " + id + "\nTitle: " + title
                + "\nStatus: " + status + "\n\n" + detail
                + (baseUrl.isBlank() ? "" : "\n\nView incident: " + baseUrl + "/?incident=" + id)
                + "\n\nBITS Hyderabad Campus IT Support";
    }
    public List<NotificationDelivery> getQueued() { return deliveries.findByChannelOrderByCreatedAtDesc("EMAIL"); }

    record Pending(String id, Long incidentId, String address, String title, String message, int attempts) { }
    @Scheduled(fixedDelayString = "${bitsolve.mail.poll-ms:30000}")
    public void deliverPending() {
        if (username.isBlank() || password.isBlank()) return; // Remains PENDING; no attempt was made.
        // One worker holds a PostgreSQL advisory transaction lock, even across multiple app instances.
        transactions.executeWithoutResult(tx -> {
            if (!Boolean.TRUE.equals(jdbc.queryForObject("select pg_try_advisory_xact_lock(424214)", Boolean.class))) return;
            isolated().executeWithoutResult(recovery -> jdbc.update("update notification_deliveries set delivery_status='FAILED', last_error='Delivery outcome unknown after worker interruption; retry limit reached.' where channel='EMAIL' and delivery_status='SENDING' and attempts >= ? and next_attempt_at <= current_timestamp", MAX_ATTEMPTS));
            for (int count = 0; count < 10; count++) {
                Pending mail = claim();
                if (mail == null) break;
                String status = "SENT", error = null;
                try { send(mail); }
                catch (RuntimeException failure) {
                    status = "FAILED";
                    // Never persist SMTP exception text: it can contain credentials or private headers.
                    error = "SMTP delivery failed (" + failure.getClass().getSimpleName() + ").";
                }
                final String outcome = status, reason = error;
                isolated().executeWithoutResult(result -> {
                    jdbc.update("update notification_deliveries set delivery_status=?, last_error=?, sent_at=case when ?='SENT' then current_timestamp else null end, next_attempt_at=current_timestamp + (? * interval '1 second') where id=?",
                            outcome, reason, outcome, retrySeconds * mail.attempts(), mail.id());
                    audit.save(new AuditRecord("AUD-" + UUID.randomUUID(), Instant.now(), null, mail.incidentId(), "STUDENT_EMAIL_" + outcome,
                            "SENDING", outcome, "Email attempt " + mail.attempts() + " for " + mail.id() + "."));
                });
            }
        });
    }
    private TransactionTemplate isolated() {
        var transaction = new TransactionTemplate(transactions.getTransactionManager());
        transaction.setPropagationBehavior(org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        return transaction;
    }
    private Pending claim() {
        return isolated().execute(tx -> {
            // SENDING is recovered after a process crash. SMTP cannot guarantee exactly-once delivery.
            List<Pending> found = jdbc.query("select id, incident_id, recipient_email, title, message, attempts from notification_deliveries where channel='EMAIL' and recipient_email is not null and delivery_status in ('PENDING','FAILED','SENDING') and attempts < ? and next_attempt_at <= current_timestamp order by created_at limit 1 for update skip locked",
                    (row, index) -> new Pending(row.getString(1), row.getLong(2), row.getString(3), row.getString(4), row.getString(5), row.getInt(6) + 1), MAX_ATTEMPTS);
            if (found.isEmpty()) return null;
            Pending mail = found.getFirst();
            jdbc.update("update notification_deliveries set delivery_status='SENDING', attempts=?, last_attempt_at=current_timestamp, next_attempt_at=current_timestamp + interval '5 minutes' where id=?", mail.attempts(), mail.id());
            audit.save(new AuditRecord("AUD-" + UUID.randomUUID(), Instant.now(), null, mail.incidentId(), "STUDENT_EMAIL_ATTEMPT", null, "SENDING", "Email attempt " + mail.attempts() + " for " + mail.id() + "."));
            return mail;
        });
    }
    void send(Pending mail) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(username); message.setTo(mail.address()); message.setSubject(mail.title()); message.setText(mail.message());
        sender.send(message);
    }
}
