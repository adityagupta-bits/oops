package com.bits.itsm.api;

import com.bits.itsm.audit.AuditLogger;
import com.bits.itsm.audit.AuditRecord;
import com.bits.itsm.escalation.EscalationRecord;
import com.bits.itsm.escalation.EscalationService;
import com.bits.itsm.intelligence.DuplicateDetector;
import com.bits.itsm.intelligence.DuplicateMatch;
import com.bits.itsm.notification.InAppChannel;
import com.bits.itsm.notification.InAppNotification;
import com.bits.itsm.sla.SlaMonitor;
import com.bits.itsm.sla.SlaSnapshot;
import com.bits.itsm.support.IncidentLookup;
import com.bits.itsm.user.User;
import com.bits.itsm.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Endpoints for the services layer. Notifications are per signed-in user; everything under /api/admin
 * is already restricted to administrators by SecurityConfig.
 */
@RestController
@RequestMapping("/api")
public class ServicesController {

    private final InAppChannel inApp;
    private final AuditLogger audit;
    private final SlaMonitor slaMonitor;
    private final EscalationService escalation;
    private final DuplicateDetector duplicates;
    private final IncidentLookup lookup;
    private final UserRepository users;
    private final com.bits.itsm.incident.IncidentRepository incidents;

    public ServicesController(InAppChannel inApp, AuditLogger audit, SlaMonitor slaMonitor,
                              EscalationService escalation, DuplicateDetector duplicates,
                              IncidentLookup lookup, UserRepository users, com.bits.itsm.incident.IncidentRepository incidents) {
        this.inApp = inApp;
        this.audit = audit;
        this.slaMonitor = slaMonitor;
        this.escalation = escalation;
        this.duplicates = duplicates;
        this.lookup = lookup;
        this.users = users; this.incidents = incidents;
    }

    private Long currentUserId(Authentication auth) {
        return users.findByEmail(auth.getName()).filter(User::isEnabled).map(User::getId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in with an enabled account."));
    }

    public record Knowledge(Long incidentId, String title, String category, String service, String summary, String steps) { }
    @GetMapping("/technician/knowledge") @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<Knowledge> knowledge() {
        return incidents.findAllByOrderByCreatedAtDesc().stream()
                .filter(i -> i.getStatus() == com.bits.itsm.incident.IncidentStatus.VERIFIED || i.getStatus() == com.bits.itsm.incident.IncidentStatus.CLOSED)
                .map(i -> new Knowledge(i.getId(), i.getTitle(), i.getCategory().name(), i.getAffectedService().getLabel(), i.getResolutionSummary(), i.getResolutionSteps())).toList();
    }

    @GetMapping("/notifications")
    public List<InAppNotification> myNotifications(Authentication auth) {
        return inApp.getFor(currentUserId(auth));
    }

    @GetMapping("/notifications/unread-count")
    public Map<String, Long> unread(Authentication auth) { return Map.of("count", inApp.unreadCount(currentUserId(auth))); }

    @PostMapping("/notifications/{notificationId}/read")
    public Map<String, Boolean> markRead(@PathVariable String notificationId, Authentication auth) {
        if (!inApp.markRead(notificationId, currentUserId(auth))) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found.");
        }
        return Map.of("read", true);
    }

    @GetMapping("/admin/audit")
    public List<AuditRecord> auditAll() {
        return audit.getAll();
    }

    @GetMapping("/admin/audit/{incidentId}")
    public List<AuditRecord> auditFor(@PathVariable Long incidentId) {
        return audit.getByIncident(incidentId);
    }

    @GetMapping("/admin/sla/violations")
    public List<SlaSnapshot> slaViolations() {
        return slaMonitor.violations(Instant.now());
    }

    @GetMapping("/admin/escalations")
    public List<EscalationRecord> escalations() {
        return escalation.getAll();
    }

    @GetMapping("/admin/incidents/{incidentId}/related")
    public List<DuplicateMatch> related(@PathVariable Long incidentId) {
        var incident = lookup.findById(incidentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found."));
        return duplicates.findRelated(incident, lookup.findAll());
    }
}
