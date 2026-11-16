package com.bits.itsm;

import com.bits.itsm.incident.*;
import com.bits.itsm.assignment.*;
import com.bits.itsm.notification.*;
import com.bits.itsm.audit.AuditStore;
import com.bits.itsm.event.*;
import com.bits.itsm.user.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@EnabledIfEnvironmentVariable(named="BITSOLVE_DB_TESTS", matches="true")
@SpringBootTest(properties={"spring.datasource.url=${BITSOLVE_TEST_DB_URL}", "bitsolve.demo.seed-enabled=true", "spring.jpa.show-sql=false", "spring.mail.username=", "spring.mail.password="})
@ActiveProfiles("dev")
class PostgresStudentEmailTests {
    @org.junit.jupiter.api.BeforeEach void configureTestService() {
        // Explicit test fixture; production initialization never supplies criticality.
        testCatalog.update("SERVICE", "CAMPUS_WIFI", "Campus Wi-Fi", true, com.bits.itsm.incident.Incident.Level.MEDIUM);
    }
    @Autowired com.bits.itsm.incident.CatalogService testCatalog;
    @Autowired IncidentService service;
    @Autowired AssignmentService assignments;
    @Autowired IncidentRepository incidents;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired PlatformTransactionManager manager;
    @Autowired NotificationDeliveryRepository deliveries;
    @Autowired AuditStore audit;
    @Autowired IncidentEventPublisher events;
    String email(String user) { return user + "@hyderabad.bits-pilani.ac.in"; }
    long create() {
        return service.create(new IncidentData.Create("Wifi outage", "The campus wifi is unavailable on my laptop.", Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI, Incident.Level.HIGH, Incident.Level.MEDIUM), email("student01")).id();
    }
    EmailChannel worker(JavaMailSender sender, String username) {
        return new EmailChannel(jdbc, incidents, deliveries, sender, audit, manager, username, username.isBlank() ? "" : "mock-password", "https://campus.example", 60);
    }
    @BeforeEach void isolateQueue() {
        // Explicitly opt-in disposable test database only. Old rows must not enter this mock worker.
        jdbc.update("update notification_deliveries set next_attempt_at=current_timestamp + interval '1 day' where channel='EMAIL'");
    }
    @Test void queuesExactlyThreeReporterEventsAndDeduplicates() {
        long id = create();
        service.classify(id, new IncidentData.Classification(Incident.Category.NETWORK), email("admin01"));
        long tech = users.findByEmail(email("technician04")).orElseThrow().getId();
        assignments.profile(tech, new AssignmentData.Profile(Set.of(TechnicianSkill.NETWORK), Technician.Availability.AVAILABLE, 100), email("admin01"));
        assignments.assign(id, tech, false, email("admin01"));
        service.acknowledge(id, email("technician04")); service.start(id, email("technician04"));
        service.resolve(id, new IncidentData.Resolution("Private resolution detail", "Sensitive investigation steps"), email("technician04"));
        new TransactionTemplate(manager).executeWithoutResult(tx -> events.publish(id, tech, "RESOLVED", "IN_PROGRESS", "RESOLVED", "Private details"));
        var rows = jdbc.queryForList("select type, recipient_email, message from notification_deliveries where incident_id=? and channel='EMAIL'", id);
        assertEquals(3, rows.size());
        assertEquals(Set.of("INCIDENT_RECEIVED", "WORK_STARTED", "INCIDENT_RESOLVED"), rows.stream().map(row -> row.get("type")).collect(java.util.stream.Collectors.toSet()));
        for (var row : rows) {
            assertEquals(email("student01"), row.get("recipient_email"));
            assertFalse(row.get("message").toString().contains("Private")); assertFalse(row.get("message").toString().contains("Sensitive"));
        }
        JavaMailSender smtp = mock(JavaMailSender.class); worker(smtp, "sender@gmail.com").deliverPending();
        verify(smtp, times(3)).send(any(SimpleMailMessage.class));
        assertEquals(3, jdbc.queryForObject("select count(*) from notification_deliveries where incident_id=? and delivery_status='SENT'", Integer.class, id));
        worker(smtp, "sender@gmail.com").deliverPending(); verifyNoMoreInteractions(smtp);
    }
    @Test void rollbackLeavesNoQueuedMessageAndNeverCallsSmtp() {
        long[] id = new long[1];
        new TransactionTemplate(manager).executeWithoutResult(tx -> { id[0] = create(); tx.setRollbackOnly(); });
        assertEquals(0, jdbc.queryForObject("select count(*) from notification_deliveries where incident_id=?", Integer.class, id[0]));
        JavaMailSender smtp = mock(JavaMailSender.class); worker(smtp, "sender@gmail.com").deliverPending(); verifyNoInteractions(smtp);
    }
    @Test void workerCannotSeeEmailUntilTheIncidentTransactionCommits() {
        JavaMailSender smtp = mock(JavaMailSender.class);
        new TransactionTemplate(manager).executeWithoutResult(tx -> {
            create();
            try (var executor = java.util.concurrent.Executors.newSingleThreadExecutor()) {
                executor.submit(() -> worker(smtp, "sender@gmail.com").deliverPending()).get(10, java.util.concurrent.TimeUnit.SECONDS);
            } catch (Exception error) { throw new AssertionError(error); }
            verifyNoInteractions(smtp);
        });
        worker(smtp, "sender@gmail.com").deliverPending();
        verify(smtp).send(any(SimpleMailMessage.class));
    }
    @Test void interruptedFinalAttemptIsFailedWithoutAnotherSend() {
        long id = create();
        jdbc.update("update notification_deliveries set delivery_status='SENDING', attempts=3, next_attempt_at=current_timestamp where incident_id=? and channel='EMAIL'", id);
        JavaMailSender smtp = mock(JavaMailSender.class);
        worker(smtp, "sender@gmail.com").deliverPending();
        verifyNoInteractions(smtp);
        assertEquals("FAILED", jdbc.queryForObject("select delivery_status from notification_deliveries where incident_id=? and channel='EMAIL'", String.class, id));
    }
    @Test void missingConfigurationKeepsPendingAndFailureRetriesAreBounded() {
        long id = create(); JavaMailSender smtp = mock(JavaMailSender.class);
        worker(smtp, "").deliverPending(); verifyNoInteractions(smtp);
        assertEquals("PENDING", jdbc.queryForObject("select delivery_status from notification_deliveries where incident_id=? and channel='EMAIL'", String.class, id));
        doThrow(new MailSendException("do not persist this secret")).when(smtp).send(any(SimpleMailMessage.class));
        for (int i=0;i<5;i++) {
            jdbc.update("update notification_deliveries set next_attempt_at=current_timestamp where incident_id=? and channel='EMAIL'", id);
            worker(smtp, "sender@gmail.com").deliverPending();
        }
        verify(smtp, times(3)).send(any(SimpleMailMessage.class));
        assertEquals("FAILED", jdbc.queryForObject("select delivery_status from notification_deliveries where incident_id=? and channel='EMAIL'", String.class, id));
        assertEquals("NEW", incidents.findById(id).orElseThrow().getStatus().name());
        assertFalse(jdbc.queryForObject("select last_error from notification_deliveries where incident_id=? and channel='EMAIL'", String.class, id).contains("secret"));
    }
}
