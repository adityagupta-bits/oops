package com.bits.itsm.api;

import com.bits.itsm.user.*;
import com.bits.itsm.incident.*;
import com.bits.itsm.assignment.AssignmentSettingsRepository;
import com.bits.itsm.audit.*;
import com.bits.itsm.auth.EmailValidator;
import com.bits.itsm.classification.ClassificationSettings;
import com.bits.itsm.classification.IncidentClassificationService;
import com.bits.itsm.notification.EmailChannel;
import com.bits.itsm.notification.NotificationDelivery;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/admin") @Transactional(readOnly = true)
public class AdminManagementController {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final CatalogService catalog;
    private final AuditStore audit;
    private final AssignmentSettingsRepository settings;
    private final EmailChannel email;
    private final IncidentRepository incidents;
    private final IncidentClassificationService classificationService;
    private final IncidentService incidentService;

    public AdminManagementController(UserRepository users, PasswordEncoder passwords, CatalogService catalog,
                                     AuditStore audit, AssignmentSettingsRepository settings, EmailChannel email,
                                     IncidentRepository incidents,
                                     IncidentClassificationService classificationService,
                                     IncidentService incidentService) {
        this.users = users; this.passwords = passwords; this.catalog = catalog; this.audit = audit;
        this.settings = settings; this.email = email; this.incidents = incidents;
        this.classificationService = classificationService;
        this.incidentService = incidentService;
    }
    public record UserView(Long id, String name, String email, Role role, boolean enabled, String studentNumber, Technician.Availability availability) { }
    public record NewUser(@NotBlank @Size(max=100) String name, @NotBlank String email, @NotNull Role role,
            @NotBlank @Size(min=8,max=72) String password, @Size(max=30) String studentNumber, TechnicianSkill skill) { }
    public record UserEdit(@NotBlank @Size(max=100) String name, boolean enabled) { }
    public record CatalogEdit(@NotBlank @Size(max=100) String label, boolean enabled, Incident.Level criticality, String keywords) { }
    private UserView view(User user) {
        return new UserView(user.getId(), user.getName(), user.getEmail(), user.getRole(), user.isEnabled(),
                user instanceof Student student ? student.getStudentNumber() : null,
                user instanceof Technician technician ? technician.getAvailability() : null);
    }
    private void audit(Authentication auth, String action, String before, String after, String description) {
        Long actor = users.findByEmail(auth.getName()).filter(User::isEnabled).orElseThrow().getId();
        audit.save(new AuditRecord("AUD-" + UUID.randomUUID(), Instant.now(), actor, null, action, before, after, description));
    }
    @GetMapping("/users") public List<UserView> users() { return users.findAll().stream().map(this::view).toList(); }
    @PostMapping("/users") @Transactional public UserView create(@Valid @RequestBody NewUser request, Authentication auth) {
        settings.lock();
        String address = EmailValidator.normalize(request.email());
        if (users.existsByEmail(address)) throw new IllegalStateException("An account already uses this email.");
        if (request.role() == Role.STUDENT && (request.studentNumber() == null || request.studentNumber().isBlank())) throw new IllegalArgumentException("Student ID is required.");
        if (request.role() == Role.TECHNICIAN && request.skill() == null) throw new IllegalArgumentException("Select a technician skill.");
        String hash = passwords.encode(request.password());
        User user = switch (request.role()) {
            case STUDENT -> new Student(request.name().trim(), address, hash, request.studentNumber().trim());
            case TECHNICIAN -> new Technician(request.name().trim(), address, hash, Objects.requireNonNull(request.skill(), "Select a technician skill.").name());
            case ADMIN -> new Administrator(request.name().trim(), address, hash, "Campus IT administration");
        };
        users.saveAndFlush(user); audit(auth, "USER_CREATED", null, user.getRole().name(), "Created account " + user.getId()); return view(user);
    }
    @PutMapping("/users/{id}") @Transactional public UserView update(@PathVariable Long id, @Valid @RequestBody UserEdit request, Authentication auth) {
        settings.lock();
        User user = users.findById(id).orElseThrow(() -> new IllegalArgumentException("User not found."));
        if (!request.enabled() && user.getEmail().equals(auth.getName())) throw new IllegalStateException("You cannot disable your own account.");
        String before = user.getName() + ":" + user.isEnabled();
        user.rename(request.name()); user.setEnabled(request.enabled());
        audit(auth, "USER_UPDATED", before, user.getName() + ":" + user.isEnabled(), "Updated account " + id); return view(user);
    }
    @GetMapping("/catalog") public List<CatalogEntry> catalog() { return catalog.all(); }
    @PutMapping("/catalog/{kind}/{code}") @Transactional public CatalogEntry updateCatalog(@PathVariable String kind, @PathVariable String code, @Valid @RequestBody CatalogEdit request, Authentication auth) {
        CatalogEntry entry = catalog.get(kind, code);
        String before = entry.getLabel() + ":" + entry.isEnabled() + ":" + entry.getCriticality() + ":" + entry.getKeywords();
        entry = catalog.update(kind, code, request.label(), request.enabled(), request.criticality(), request.keywords());
        audit(auth, "CATALOG_UPDATED", before, entry.getLabel() + ":" + entry.isEnabled() + ":" + entry.getCriticality() + ":" + entry.getKeywords(), entry.getId()); return entry;
    }
    @GetMapping("/classification-settings")
    public ClassificationSettings classificationSettings() {
        return classificationService.getSettings();
    }
    @PutMapping("/classification-settings")
    @Transactional
    public ClassificationSettings updateClassificationSettings(@RequestBody ClassificationSettings request, Authentication auth) {
        User actor = users.findByEmail(auth.getName()).filter(User::isEnabled).orElseThrow();
        return classificationService.updateSettings(request, actor);
    }
    @GetMapping("/classification-review")
    public List<IncidentData.View> classificationReview(Authentication auth) {
        return incidents.findAllByOrderByCreatedAtDesc().stream()
                .filter(Incident::isNeedsClassificationReview)
                .map(i -> incidentService.get(i.getId(), auth.getName()))
                .toList();
    }
    @PostMapping("/incidents/{id}/classify")
    @Transactional
    public IncidentData.View classifyIncident(@PathVariable Long id, @Valid @RequestBody IncidentData.AdminCorrection request, Authentication auth) {
        return incidentService.adminReclassify(id, request, auth.getName());
    }
    @GetMapping("/reports") public Map<String, Object> reports() {
        List<Incident> records = incidents.findAll();
        Instant now = Instant.now();
        Map<String, Object> report = new LinkedHashMap<>();
        report.put("total", records.size());
        report.put("active", records.stream().filter(i -> i.getResolvedAt() == null).count());
        report.put("responseBreaches", records.stream().filter(i -> i.responseSla(now) == SlaClock.Status.BREACHED).count());
        report.put("resolutionBreaches", records.stream().filter(i -> i.resolutionSla(now) == SlaClock.Status.BREACHED).count());
        report.put("byStatus", records.stream().collect(java.util.stream.Collectors.groupingBy(i -> i.getStatus().name(), java.util.stream.Collectors.counting())));
        report.put("byPriority", records.stream().collect(java.util.stream.Collectors.groupingBy(i -> i.getPriority().name(), java.util.stream.Collectors.counting())));
        report.put("byCategory", records.stream().collect(java.util.stream.Collectors.groupingBy(i -> i.getCategory() == null ? "OTHER" : i.getCategory().name(), java.util.stream.Collectors.counting())));
        var resolution = records.stream().filter(i -> i.getResolvedAt() != null).mapToDouble(i -> java.time.Duration.between(i.getCreatedAt(), i.getResolvedAt()).toSeconds() / 3600.0).average();
        var feedback = records.stream().filter(i -> i.getFeedback() != null).mapToInt(i -> i.getFeedback().getRating()).average();
        report.put("averageResolutionHours", resolution.isPresent() ? Math.round(resolution.getAsDouble() * 100) / 100.0 : null);
        report.put("averageFeedback", feedback.isPresent() ? Math.round(feedback.getAsDouble() * 100) / 100.0 : null);
        return report;
    }
    @GetMapping("/email-outbox") public List<NotificationDelivery> outbox() { return email.getQueued(); }
}
