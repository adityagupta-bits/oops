package com.bits.itsm.incident;

import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.*;
import com.bits.itsm.incident.Incident.*;
import com.bits.itsm.incident.InvestigationNote.Visibility;

// Small API records keep persistence objects and account credentials out of responses.
public final class IncidentData {
    private IncidentData() { }
    public record Create(@NotBlank @Size(max = 100) String title, @NotBlank @Size(min = 20, max = 2000) String description,
            @NotNull Category category, ItService affectedService, Level impact, Level urgency, @Min(1) Integer affectedUsers) {
        public Create(String title,String description,Category category,ItService affectedService,Level impact,Level urgency) { this(title,description,category,affectedService,impact,urgency,null); }
    }
    public record Classification(@NotNull Category category) { }
    public record AdminCorrection(@NotNull ItService affectedService, Category category, @NotNull Level impact, @NotNull Level urgency,
            @NotBlank @Size(min = 5, max = 500) String reason) { }
    public record Edit(@NotBlank @Size(max = 100) String title, @NotBlank @Size(min = 20, max = 2000) String description) { }
    public record Assignment(@NotNull @Positive Long technicianId, @Size(max=2000) String reason) {
        public Assignment(Long technicianId) { this(technicianId, null); }
    }
    public record Note(@NotBlank @Size(max = 2000) String content, @NotNull Visibility visibility) { }
    public record Message(@NotBlank @Size(max = 2000) String content) { }
    public record InternalMessage(@NotBlank @Size(max = 2000) String content, boolean urgent) { }
    public record PriorityOverride(@NotNull Priority priority,@NotBlank @Size(min=5,max=2000) String reason) { }
    public enum ClosureKind { WITHDRAWN, INVALID, DUPLICATE }
    public record Disposition(@NotNull ClosureKind kind, @NotBlank @Size(min=5,max=2000) String reason, @Positive Long duplicateOf) { }
    public record Resolution(@NotBlank @Size(max = 2000) String summary, @NotBlank @Size(max = 2000) String steps) { }
    public record Verification(@NotNull Boolean confirmed, @Size(max = 2000) String reason) { }
    public record Feedback(@NotNull @Min(1) @Max(5) Integer rating, @Size(max = 1000) String comment) { }
    public record Person(Long id, String name) { }
    public record TeamMember(Person technician, String responsibility) { }
    public record NoteView(Long id, Person author, String content, Visibility visibility, InvestigationNote.Kind kind, Instant createdAt) { }
    public record HistoryView(Long id, Person actor, String action, String description, Instant createdAt) { }
    public record FeedbackView(int rating, String comment, Instant createdAt) { }
    public record View(Long id, String title, String description, Person reporter, Category category, ItService affectedService,
            String serviceLabel, Level impact, Level urgency, Priority priority, IncidentStatus status, Person assignedTechnician,
            Instant createdAt, Instant updatedAt, Instant acknowledgedAt, Instant resolvedAt, Instant verifiedAt, Instant closedAt,
            String resolutionSummary, String resolutionSteps, List<NoteView> notes, List<HistoryView> history, FeedbackView feedback, boolean primaryOwner, List<TeamMember> collaborators, com.bits.itsm.intelligence.CategorySuggester.Suggestion categorySuggestion, Level criticality, Instant responseDeadline, Instant resolutionDeadline, SlaClock.Status responseSla, SlaClock.Status resolutionSla,
            boolean needsClassificationReview, boolean autoClassified, String classificationNotes, Category reportedCategory, Level reportedUrgency, boolean awaitingStudent) { }
    public record Option(String value, String label) { }
    public record Options(List<Option> categories, List<Option> services) {
        public boolean getAtomicStartWork() { return true; }
        public boolean getServiceHints() { return true; }
        public boolean getIncidentMessaging() { return true; }
        public boolean getPriorityOverrides() { return true; }
        public boolean getIncidentDisposition() { return true; }
        public boolean getReportedScope() { return true; }
        public boolean getDynamicCategories() { return true; }
    }
}
