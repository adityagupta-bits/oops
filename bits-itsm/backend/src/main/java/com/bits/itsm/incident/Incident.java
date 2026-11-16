package com.bits.itsm.incident;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import com.bits.itsm.user.Student;
import com.bits.itsm.user.Technician;
import com.bits.itsm.user.User;
import com.bits.itsm.user.TechnicianSkill;
import jakarta.persistence.*;

@Entity
@Table(name = "incidents")
public class Incident {
    public enum Category { HARDWARE, SOFTWARE, NETWORK, DATABASE, CLOUD, SECURITY, AUTHENTICATION, APPLICATION, STORAGE, OTHER }
    public enum Level { LOW, MEDIUM, HIGH }
    public enum Priority { PENDING, P1, P2, P3, P4 }
    public enum ItService {
        CAMPUS_WIFI("Campus Wi-Fi"), STUDENT_PORTAL("Student Portal"), LIBRARY("Library Services"),
        LAB_COMPUTERS("Lab Computers"), EMAIL("Email Services"), CAMPUS_NETWORK("Campus Network"),
        AUTHENTICATION("Authentication Service"), OTHER("Other");
        private final String label;
        ItService(String label) { this.label = label; }
        public String getLabel() { return label; }
    }

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 100) private String title;
    @Column(nullable = false, length = 2000) private String description;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private Student reporter;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Category category;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private ItService affectedService;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Level impact;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Level urgency;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Priority priority = Priority.PENDING;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private IncidentStatus status = IncidentStatus.NEW;
    @ManyToOne(fetch = FetchType.LAZY) private Technician assignedTechnician;
    @Column(nullable = false) private Instant createdAt = Instant.now();
    @Column(nullable = false) private Instant updatedAt = createdAt;
    private Instant acknowledgedAt;
    private Instant resolvedAt;
    private Instant verifiedAt;
    private Instant closedAt;
    @Enumerated(EnumType.STRING) private Level criticality;
    public Level getCriticality() { return criticality; }
    public void captureCriticality(Level criticality) { this.criticality = java.util.Objects.requireNonNull(criticality); }
    private Instant responseDeadline;
    private Instant resolutionDeadline;
    private Integer responseTargetMinutes;
    private Integer resolutionTargetMinutes;
    @Column(length = 2000) private String resolutionSummary;
    @Column(length = 2000) private String resolutionSteps;
    @OneToMany(mappedBy = "incident", cascade = CascadeType.PERSIST) @OrderBy("createdAt ASC, id ASC")
    private List<InvestigationNote> notes = new ArrayList<>();
    @OneToMany(mappedBy = "incident", cascade = CascadeType.PERSIST) @OrderBy("createdAt ASC, id ASC")
    private List<IncidentHistory> history = new ArrayList<>();
    @OneToOne(mappedBy = "incident", cascade = CascadeType.PERSIST) private IncidentFeedback feedback;
    @OneToMany(mappedBy = "incident", cascade = CascadeType.PERSIST)
    private List<IncidentCollaborator> collaborators = new ArrayList<>();

    protected Incident() { }
    public void editReport(String title, String description) {
        require(IncidentStatus.NEW);
        this.title = text(title, 1, 100);
        this.description = text(description, 20, 2000);
        updatedAt = Instant.now();
    }
    public Incident(String title, String description, Student reporter, Category category, ItService service, Level impact, Level urgency) {
        this.title = text(title, 1, 100);
        this.description = text(description, 20, 2000);
        this.reporter = java.util.Objects.requireNonNull(reporter);
        this.category = java.util.Objects.requireNonNull(category);
        this.affectedService = java.util.Objects.requireNonNull(service);
        this.impact = java.util.Objects.requireNonNull(impact);
        this.urgency = java.util.Objects.requireNonNull(urgency);
    }

    // State changes are centralized here; callers cannot set an arbitrary status.
    public void classify(Category category) {
        classify(category, calculatedPriority());
    }
    public void classify(Category category, Priority calculated) {
        require(IncidentStatus.NEW);
        if (calculated == null || calculated == Priority.PENDING) throw new IllegalArgumentException("A calculated priority is required.");
        this.category = java.util.Objects.requireNonNull(category);
        priority = calculated; move(IncidentStatus.CLASSIFIED);
    }
    public Priority calculatedPriority() {
        return new com.bits.itsm.priority.MultiplicativePriorityStrategy().calculate(impact, urgency, Level.MEDIUM);
    }
    // Snapshot targets once; policy edits and transfers never restart clocks.
    public void captureSla(SlaPolicy policy) {
        if (responseDeadline != null) return;
        if (priority != policy.getPriority()) throw new IllegalArgumentException("SLA priority mismatch.");
        responseTargetMinutes = policy.getResponseMinutes(); resolutionTargetMinutes = policy.getResolutionMinutes();
        responseDeadline = createdAt.plusSeconds(responseTargetMinutes * 60L);
        resolutionDeadline = createdAt.plusSeconds(resolutionTargetMinutes * 60L);
    }
    public Instant getResponseDeadline() { return responseDeadline; }
    public Instant getResolutionDeadline() { return resolutionDeadline; }
    public SlaClock.Status responseSla(Instant now) { return responseDeadline == null ? null : SlaClock.status(responseDeadline, responseTargetMinutes, acknowledgedAt, now); }
    public SlaClock.Status resolutionSla(Instant now) { return resolutionDeadline == null ? null : SlaClock.status(resolutionDeadline, resolutionTargetMinutes, resolvedAt, now); }
    public void assign(Technician technician) {
        require(IncidentStatus.CLASSIFIED);
        if (!technician.isEnabled() || !technician.isAvailable()) throw new IllegalStateException("Technician is disabled or unavailable.");
        assignedTechnician = technician;
        move(IncidentStatus.ASSIGNED);
    }
    public void acknowledge() { require(IncidentStatus.ASSIGNED); move(IncidentStatus.ACKNOWLEDGED); acknowledgedAt = updatedAt; }
    public boolean isPrimary(Long userId) { return assignedTechnician != null && assignedTechnician.getId().equals(userId); }
    public boolean participates(Long userId) { return isPrimary(userId) || collaborators.stream().anyMatch(c -> c.getTechnician().getId().equals(userId)); }
    public void requireAssignableTeam() {
        if (status != IncidentStatus.ASSIGNED && status != IncidentStatus.ACKNOWLEDGED && status != IncidentStatus.IN_PROGRESS) throw new IllegalStateException("Team changes require an assigned incident under investigation.");
    }
    public void reassign(Technician technician) {
        requireAssignableTeam();
        if (participates(technician.getId())) throw new IllegalStateException("Technician already participates in this incident.");
        if (!technician.isEnabled() || !technician.isAvailable()) throw new IllegalStateException("Technician is disabled or unavailable.");
        assignedTechnician = technician; updatedAt = Instant.now();
        // Reassignment preserves lifecycle progress, timestamps, notes and resolution information.
    }
    public void addCollaborator(Technician technician, String responsibility) {
        requireAssignableTeam();
        if (participates(technician.getId())) throw new IllegalStateException("Technician already participates in this incident.");
        collaborators.add(new IncidentCollaborator(this, technician, responsibility)); updatedAt = Instant.now();
    }
    public TechnicianSkill requiredSkill() {
        return category == Category.OTHER ? null : category == Category.APPLICATION ? TechnicianSkill.APPLICATION_SUPPORT : TechnicianSkill.valueOf(category.name());
    }
    public TechnicianSkill preferredSkill() {
        if (requiredSkill() != null) return requiredSkill();
        return switch (affectedService) {
            case CAMPUS_WIFI, CAMPUS_NETWORK -> TechnicianSkill.NETWORK;
            case LAB_COMPUTERS -> TechnicianSkill.HARDWARE;
            case AUTHENTICATION -> TechnicianSkill.AUTHENTICATION;
            case STUDENT_PORTAL, LIBRARY, EMAIL -> TechnicianSkill.APPLICATION_SUPPORT;
            case OTHER -> null;
        };
    }
    public void start() { require(IncidentStatus.ACKNOWLEDGED); move(IncidentStatus.IN_PROGRESS); }
    public void resolve(String summary, String steps) {
        require(IncidentStatus.IN_PROGRESS);
        String validSummary = text(summary, 1, 2000);
        String validSteps = text(steps, 1, 2000);
        resolutionSummary = validSummary;
        resolutionSteps = validSteps;
        move(IncidentStatus.RESOLVED); resolvedAt = updatedAt;
    }
    public void verify() { require(IncidentStatus.RESOLVED); move(IncidentStatus.VERIFIED); verifiedAt = updatedAt; }
    public void issueStillExists() {
        require(IncidentStatus.RESOLVED);
        // A rejected resolution returns to the same technician; its contents remain in history.
        move(IncidentStatus.IN_PROGRESS);
        resolutionSummary = null; resolutionSteps = null; resolvedAt = null;
    }
    public void close() { require(IncidentStatus.VERIFIED); move(IncidentStatus.CLOSED); closedAt = updatedAt; }
    public void require(IncidentStatus expected) {
        if (status != expected) throw new IllegalStateException("This action requires " + expected + "; current status is " + status + ".");
    }
    private void move(IncidentStatus next) { status = next; updatedAt = Instant.now(); }
    public void addNote(User author, String content, InvestigationNote.Visibility visibility, InvestigationNote.Kind kind) {
        notes.add(new InvestigationNote(this, author, content, visibility, kind)); updatedAt = Instant.now();
    }
    public void record(User actor, String action, String description, InvestigationNote.Visibility visibility) {
        history.add(new IncidentHistory(this, actor, action, description, visibility));
    }
    public void giveFeedback(Student student, int rating, String comment) {
        if (status != IncidentStatus.VERIFIED && status != IncidentStatus.CLOSED) throw new IllegalStateException("Verify the resolution before submitting feedback.");
        if (feedback != null) throw new IllegalStateException("Feedback has already been submitted.");
        feedback = new IncidentFeedback(this, student, rating, comment); updatedAt = Instant.now();
    }
    static String text(String value, int min, int max) {
        if (value == null || value.trim().length() < min || value.trim().length() > max) throw new IllegalArgumentException("Text must contain " + min + "–" + max + " characters.");
        return value.trim();
    }
    public Long getId() { return id; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public Student getReporter() { return reporter; }
    public Category getCategory() { return category; }
    public ItService getAffectedService() { return affectedService; }
    public Level getImpact() { return impact; }
    public Level getUrgency() { return urgency; }
    public Priority getPriority() { return priority; }
    public IncidentStatus getStatus() { return status; }
    public Technician getAssignedTechnician() { return assignedTechnician; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public Instant getAcknowledgedAt() { return acknowledgedAt; }
    public Instant getResolvedAt() { return resolvedAt; }
    public Instant getVerifiedAt() { return verifiedAt; }
    public Instant getClosedAt() { return closedAt; }
    public String getResolutionSummary() { return resolutionSummary; }
    public String getResolutionSteps() { return resolutionSteps; }
    public List<InvestigationNote> getNotes() { return List.copyOf(notes); }
    public List<IncidentHistory> getHistory() { return List.copyOf(history); }
    public IncidentFeedback getFeedback() { return feedback; }
    public List<IncidentCollaborator> getCollaborators() { return List.copyOf(collaborators); }
}
