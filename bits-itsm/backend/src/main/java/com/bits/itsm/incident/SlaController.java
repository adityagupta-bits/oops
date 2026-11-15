package com.bits.itsm.incident;

import java.time.Instant;
import java.util.List;
import com.bits.itsm.user.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api") @Transactional(readOnly = true)
public class SlaController {
    private final IncidentRepository incidents;
    private final UserRepository users;
    private final SlaPolicyRepository policies;
    public SlaController(IncidentRepository incidents, UserRepository users, SlaPolicyRepository policies) {
        this.incidents = incidents; this.users = users; this.policies = policies;
    }
    public record Targets(@Min(1) @Max(525600) int responseMinutes, @Min(1) @Max(525600) int resolutionMinutes) { }
    public record View(Long incidentId, String title, Instant responseDeadline, Instant resolutionDeadline, SlaClock.Status responseStatus, SlaClock.Status resolutionStatus) { }
    @GetMapping({"/admin/sla", "/technician/sla", "/student/sla"})
    public List<View> list(Authentication auth) {
        User user = users.findByEmail(auth.getName()).filter(User::isEnabled).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        var found = switch (user.getRole()) {
            case ADMIN -> incidents.findAllByOrderByCreatedAtDesc();
            case TECHNICIAN -> incidents.findTeamIncidents(user.getId());
            case STUDENT -> incidents.findByReporterIdOrderByCreatedAtDesc(user.getId());
        };
        Instant now = Instant.now();
        return found.stream().map(i -> new View(i.getId(), i.getTitle(), i.getResponseDeadline(), i.getResolutionDeadline(), i.responseSla(now), i.resolutionSla(now))).toList();
    }
    @GetMapping("/admin/sla-policies") public List<SlaPolicy> policies() { return policies.findAll(); }
    @PutMapping("/admin/sla-policies/{priority}") @Transactional
    public SlaPolicy update(@PathVariable Incident.Priority priority, @Valid @RequestBody Targets targets) {
        if (targets.resolutionMinutes() < targets.responseMinutes()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Resolution target must not be shorter than response target.");
        SlaPolicy policy = policies.findById(priority).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        policy.update(targets.responseMinutes(), targets.resolutionMinutes()); return policy;
    }
}
