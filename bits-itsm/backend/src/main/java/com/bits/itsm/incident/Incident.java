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
    public record Category(String code) {
        public Category { new ServiceCode(code); }
        public static final Category HARDWARE=new Category("HARDWARE"), SOFTWARE=new Category("SOFTWARE"), NETWORK=new Category("NETWORK"), DATABASE=new Category("DATABASE"), CLOUD=new Category("CLOUD"), SECURITY=new Category("SECURITY"), AUTHENTICATION=new Category("AUTHENTICATION"), APPLICATION=new Category("APPLICATION"), STORAGE=new Category("STORAGE"), OTHER=new Category("OTHER");
        @com.fasterxml.jackson.annotation.JsonCreator public static Category valueOf(String code) { return new Category(code); }
        @com.fasterxml.jackson.annotation.JsonValue public String name() { return code; }
        public static Category[] values() { return new Category[]{HARDWARE,SOFTWARE,NETWORK,DATABASE,CLOUD,SECURITY,AUTHENTICATION,APPLICATION,STORAGE,OTHER}; }
    }
    @Converter public static class CategoryConverter implements AttributeConverter<Category,String> {
        public String convertToDatabaseColumn(Category value) { return value==null?null:value.name(); }
        public Category convertToEntityAttribute(String value) { return value==null?null:Category.valueOf(value); }
    }
    public enum Level { LOW, MEDIUM, HIGH }
    public enum Priority { PENDING, P1, P2, P3, P4 }
    public record ItService(String code) {
        public ItService { new ServiceCode(code); }
        public static final ItService CAMPUS_WIFI = new ItService("CAMPUS_WIFI"), STUDENT_PORTAL = new ItService("STUDENT_PORTAL"), LIBRARY = new ItService("LIBRARY"), LAB_COMPUTERS = new ItService("LAB_COMPUTERS"), EMAIL = new ItService("EMAIL"), CAMPUS_NETWORK = new ItService("CAMPUS_NETWORK"), AUTHENTICATION = new ItService("AUTHENTICATION"), OTHER = new ItService("OTHER");
        @com.fasterxml.jackson.annotation.JsonCreator public static ItService valueOf(String code) { return new ItService(code); }
        @com.fasterxml.jackson.annotation.JsonValue public String name() { return code; }
        public static ItService[] values() { return new ItService[]{CAMPUS_WIFI,STUDENT_PORTAL,LIBRARY,LAB_COMPUTERS,EMAIL,CAMPUS_NETWORK,AUTHENTICATION,OTHER}; }
        public String getLabel() { return switch(code) { case "CAMPUS_WIFI" -> "Campus Wi-Fi"; case "STUDENT_PORTAL" -> "Student Portal"; case "LIBRARY" -> "Library Services"; case "LAB_COMPUTERS" -> "Lab Computers"; case "EMAIL" -> "Email Services"; case "CAMPUS_NETWORK" -> "Campus Network"; case "AUTHENTICATION" -> "Authentication Service"; case "OTHER" -> "Other"; default -> code; }; }
    }
    @Converter
    public static class ServiceConverter implements AttributeConverter<ItService,String> {
        public String convertToDatabaseColumn(ItService value) { return value == null ? null : value.name(); }
        public ItService convertToEntityAttribute(String value) { return value == null ? null : ItService.valueOf(value); }
    }
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, length = 100) private String title;
    @Column(nullable = false, length = 2000) private String description;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private Student reporter;
    @Convert(converter=CategoryConverter.class) private Category category;
    @Convert(converter=ServiceConverter.class) private ItService affectedService;
    @Enumerated(EnumType.STRING) private Level impact;
    @Enumerated(EnumType.STRING) private Level urgency;
    @Convert(converter=CategoryConverter.class) private Category reportedCategory;
    @Enumerated(EnumType.STRING) private TechnicianSkill classifiedSkill;
    public void captureClassifiedSkill(TechnicianSkill skill) { classifiedSkill=skill; }
    @Enumerated(EnumType.STRING) private Level reportedUrgency;
    @Convert(converter = ServiceConverter.class) @Column(length = 50) private ItService reportedService;
    public ItService getReportedService() { return reportedService; }
    public void captureServiceHint(ItService service) { reportedService = service; }
    private Integer reportedAffectedUsers;
    public Integer getReportedAffectedUsers() { return reportedAffectedUsers; }
    public void captureReportedAffectedUsers(Integer count) {
        if(count!=null && count<1) throw new IllegalArgumentException("Affected people must be a positive number.");
        reportedAffectedUsers=count;
    }
    public void captureReportedContext(Category category, Level urgency) {
        reportedCategory = java.util.Objects.requireNonNull(category, "Select an incident category.");
        reportedUrgency = urgency;
    }
    public Category getReportedCategory() { return reportedCategory; }
    public Level getReportedUrgency() { return reportedUrgency; }
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
    @OneToMany(mappedBy = "incident", cascade = CascadeType.PERSIST, orphanRemoval = true)
    private List<IncidentCollaborator> collaborators = new ArrayList<>();

    @Column(nullable = false) private boolean needsClassificationReview = false;
    @Column(nullable = false) private boolean autoClassified = false;
    @Column(length = 2000) private String classificationNotes;

    protected Incident() { }
    public void editReport(String title, String description) {
        require(IncidentStatus.NEW);
        this.title = text(title, 1, 100);
        this.description = text(description, 20, 2000);
        updatedAt = Instant.now();
    }
    public Incident(String title, String description, Student reporter) {
        this.title = text(title, 1, 100);
        this.description = text(description, 20, 2000);
        this.reporter = java.util.Objects.requireNonNull(reporter);
    }
    public Incident(String title, String description, Student reporter, Category category, ItService service, Level impact, Level urgency) {
        this.title = text(title, 1, 100);
        this.description = text(description, 20, 2000);
        this.reporter = java.util.Objects.requireNonNull(reporter);
        this.category = category;
        this.affectedService = service;
        this.impact = impact;
        this.urgency = urgency;
    }

    // State changes are centralized here; callers cannot set an arbitrary status.
    public void classify(Category category, Priority calculated) {
        if (status != IncidentStatus.NEW && status != IncidentStatus.CLASSIFIED) {
            throw new IllegalStateException("Only unassigned incidents (NEW or CLASSIFIED) can be classified.");
        }
        if (calculated == null || calculated == Priority.PENDING) throw new IllegalArgumentException("A calculated priority is required.");
        this.category = java.util.Objects.requireNonNull(category);
        priority = calculated;
        this.needsClassificationReview = false;
        move(IncidentStatus.CLASSIFIED);
    }
    public void adminClassify(Category category, ItService service, Level impact, Level urgency, Level criticality, Priority calculated) {
        if (status != IncidentStatus.NEW && status != IncidentStatus.CLASSIFIED) {
            throw new IllegalStateException("Only unassigned incidents (NEW or CLASSIFIED) can be classified or reclassified.");
        }
        if (calculated == null || calculated == Priority.PENDING) throw new IllegalArgumentException("A calculated priority is required.");
        this.category = java.util.Objects.requireNonNull(category, "Category is required");
        this.affectedService = java.util.Objects.requireNonNull(service, "Affected service is required");
        this.impact = java.util.Objects.requireNonNull(impact, "Impact is required");
        this.urgency = java.util.Objects.requireNonNull(urgency, "Urgency is required");
        this.criticality = java.util.Objects.requireNonNull(criticality, "Criticality is required");
        this.priority = calculated;
        this.needsClassificationReview = false;
        this.classificationNotes = null;
        move(IncidentStatus.CLASSIFIED);
    }
    public void applyAutoClassification(Category category, ItService service, Level impact, Level urgency, Level criticality, Priority calculated) {
        this.category = category;
        this.affectedService = service;
        this.impact = impact;
        this.urgency = urgency;
        this.criticality = criticality;
        this.priority = calculated;
        this.autoClassified = true;
        this.needsClassificationReview = false;
        this.status = IncidentStatus.CLASSIFIED;
        this.updatedAt = Instant.now();
    }
    public void flagForClassificationReview(String reason, Category suggestedCategory, ItService detectedService, Level detectedUrgency, Level detectedImpact) {
        this.needsClassificationReview = true;
        this.classificationNotes = reason;
        this.category = suggestedCategory;
        this.affectedService = detectedService;
        this.urgency = detectedUrgency;
        this.impact = detectedImpact;
        this.priority = Priority.PENDING;
        this.status = IncidentStatus.NEW;
        this.updatedAt = Instant.now();
    }
    // Snapshot targets once; policy edits and transfers never restart clocks.
    public void captureSla(SlaPolicy policy) {
        if (responseDeadline != null) return;
        if (priority != policy.getPriority()) throw new IllegalArgumentException("SLA priority mismatch.");
        responseTargetMinutes = policy.getResponseMinutes(); resolutionTargetMinutes = policy.getResolutionMinutes();
        responseDeadline = createdAt.plusSeconds(responseTargetMinutes * 60L);
        resolutionDeadline = createdAt.plusSeconds(resolutionTargetMinutes * 60L);
    }
    public void resetSla(SlaPolicy policy) {
        if (policy == null) return;
        responseTargetMinutes = policy.getResponseMinutes();
        resolutionTargetMinutes = policy.getResolutionMinutes();
        responseDeadline = createdAt.plusSeconds(responseTargetMinutes * 60L);
        resolutionDeadline = createdAt.plusSeconds(resolutionTargetMinutes * 60L);
    }
    public Instant getResponseDeadline() { return responseDeadline; }
    public Instant getResolutionDeadline() { return resolutionDeadline; }
    public SlaClock.Status responseSla(Instant now) { return responseDeadline == null || (status == IncidentStatus.CLOSED && resolvedAt == null) ? null : SlaClock.status(responseDeadline, responseTargetMinutes, acknowledgedAt, now); }
    public SlaClock.Status resolutionSla(Instant now) { return resolutionDeadline == null || (status == IncidentStatus.CLOSED && resolvedAt == null) ? null : SlaClock.status(resolutionDeadline, resolutionTargetMinutes, resolvedAt, now); }
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
    public void removeCollaborator(Long technicianId) {
        requireAssignableTeam();
        if(!collaborators.removeIf(c -> c.getTechnician().getId().equals(technicianId))) throw new IllegalArgumentException("Collaborator not found.");
        updatedAt=Instant.now();
    }
    public TechnicianSkill requiredSkill() {
        if (classifiedSkill != null) return classifiedSkill;
        if (category == null) return null;
        if (category.equals(Category.OTHER)) return null;
        if (category.equals(Category.APPLICATION)) return TechnicianSkill.APPLICATION_SUPPORT;
        try { return TechnicianSkill.valueOf(category.name()); } catch (IllegalArgumentException customCategory) { return null; }
    }
    public TechnicianSkill preferredSkill() {
        if (requiredSkill() != null) return requiredSkill();
        if (affectedService == null) return null;
        return switch (affectedService.name()) {
            case "CAMPUS_WIFI", "CAMPUS_NETWORK" -> TechnicianSkill.NETWORK;
            case "LAB_COMPUTERS" -> TechnicianSkill.HARDWARE;
            case "AUTHENTICATION" -> TechnicianSkill.AUTHENTICATION;
            case "STUDENT_PORTAL", "LIBRARY", "EMAIL" -> TechnicianSkill.APPLICATION_SUPPORT;
            default -> null;
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
    public void closeWithoutResolution(boolean withdrawal) {
        if (withdrawal) require(IncidentStatus.NEW);
        if (status == IncidentStatus.RESOLVED || status == IncidentStatus.VERIFIED || status == IncidentStatus.CLOSED)
            throw new IllegalStateException("Only an active report can be withdrawn or closed without resolution.");
        move(IncidentStatus.CLOSED); closedAt = updatedAt; needsClassificationReview = false;
    }
    public boolean isAwaitingStudent() {
        if (status != IncidentStatus.IN_PROGRESS) return false;
        Instant requested = history.stream().filter(h -> h.getAction().equals("INFORMATION_REQUESTED"))
                .map(IncidentHistory::getCreatedAt).max(Instant::compareTo).orElse(Instant.MIN);
        Instant answered = history.stream().filter(h -> h.getAction().equals("STUDENT_REPLIED") || h.getAction().equals("RESUMED_WITHOUT_REPLY"))
                .map(IncidentHistory::getCreatedAt).max(Instant::compareTo).orElse(Instant.MIN);
        return requested.isAfter(answered);
    }
    public void overridePriority(Priority next) {
        if (next==null || next==Priority.PENDING) throw new IllegalArgumentException("Choose priority P1–P4.");
        if (priority==Priority.PENDING || status==IncidentStatus.NEW || status==IncidentStatus.RESOLVED || status==IncidentStatus.VERIFIED || status==IncidentStatus.CLOSED)
            throw new IllegalStateException("Priority overrides require an active, classified incident.");
        priority=next; updatedAt=Instant.now();
    }
    public void require(IncidentStatus expected) {
        if (status != expected) throw new IllegalStateException("This action requires " + expected + "; current status is " + status + ".");
    }
    private void move(IncidentStatus next) { status = next; updatedAt = Instant.now(); }
    public void addNote(User author, String content, InvestigationNote.Visibility visibility, InvestigationNote.Kind kind) {
        addNote(author, content, visibility, kind, false);
    }
    public void addNote(User author, String content, InvestigationNote.Visibility visibility, InvestigationNote.Kind kind, boolean urgent) {
        if (urgent && (visibility != InvestigationNote.Visibility.INTERNAL || kind != InvestigationNote.Kind.MESSAGE))
            throw new IllegalArgumentException("Only internal staff messages may be marked urgent.");
        notes.add(new InvestigationNote(this, author, content, visibility, kind, urgent)); updatedAt = Instant.now();
    }
    public void record(User actor, String action, String description, InvestigationNote.Visibility visibility) {
        history.add(new IncidentHistory(this, actor, action, description, visibility));
    }
    public void giveFeedback(Student student, int rating, String comment) {
        if (resolvedAt == null) throw new IllegalStateException("Feedback requires a resolved incident.");
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
    public boolean isNeedsClassificationReview() { return needsClassificationReview; }
    public void setNeedsClassificationReview(boolean needsClassificationReview) { this.needsClassificationReview = needsClassificationReview; }
    public boolean isAutoClassified() { return autoClassified; }
    public void setAutoClassified(boolean autoClassified) { this.autoClassified = autoClassified; }
    public String getClassificationNotes() { return classificationNotes; }
    public void setClassificationNotes(String classificationNotes) { this.classificationNotes = classificationNotes; }
}
