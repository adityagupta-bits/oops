package com.bits.itsm.incident;

import java.util.List;
import java.util.Locale;
import com.bits.itsm.user.*;
import com.bits.itsm.incident.IncidentData.*;
import com.bits.itsm.assignment.AssignmentSettingsRepository;
import com.bits.itsm.classification.IncidentClassificationService;
import static com.bits.itsm.incident.InvestigationNote.Visibility.*;
import static com.bits.itsm.incident.InvestigationNote.Kind.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class IncidentService {
    private final IncidentRepository incidents;
    private final UserRepository users;
    private final AssignmentSettingsRepository assignmentSettings;
    private final SlaPolicies slaPolicies;
    private final CatalogService catalog;
    private final com.bits.itsm.intelligence.DuplicateDetector duplicates;
    private final com.bits.itsm.priority.PriorityService priorities;
    private final com.bits.itsm.intelligence.CategorySuggester categories;
    private final com.bits.itsm.event.IncidentEventPublisher events;
    private final IncidentClassificationService classificationService;
    private final com.bits.itsm.assignment.AssignmentService assignmentService;

    public IncidentService(IncidentRepository incidents, UserRepository users,
                           AssignmentSettingsRepository assignmentSettings, SlaPolicies slaPolicies,
                           com.bits.itsm.priority.PriorityService priorities,
                           com.bits.itsm.intelligence.CategorySuggester categories,
                           com.bits.itsm.event.IncidentEventPublisher events,
                           CatalogService catalog,
                           com.bits.itsm.intelligence.DuplicateDetector duplicates,
                           IncidentClassificationService classificationService,
                           com.bits.itsm.assignment.AssignmentService assignmentService) {
        this.incidents = incidents; this.users = users; this.assignmentSettings = assignmentSettings; this.slaPolicies = slaPolicies;
        this.priorities = priorities;
        this.categories = categories;
        this.events = events; this.catalog = catalog; this.duplicates = duplicates;
        this.classificationService = classificationService;
        this.assignmentService = assignmentService;
    }

    private User actor(String email) {
        return users.findByEmail(email).filter(User::isEnabled)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in with an enabled account."));
    }
    private void role(User user, Role role) {
        if (user.getRole() != role) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This action is not permitted for your role.");
    }
    private void access(Incident incident, User user) {
        boolean allowed = switch (user.getRole()) {
            case ADMIN -> true;
            case STUDENT -> incident.getReporter().getId().equals(user.getId());
            case TECHNICIAN -> incident.participates(user.getId());
        };
        if (!allowed) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this incident.");
    }
    private Incident editable(Long id, User user, Role role) { return editable(id, user, role, false); }
    private Incident editable(Long id, User user, Role role, boolean collaboratorAllowed) {
        role(user, role);
        Incident incident = incidents.findForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found."));
        access(incident, user);
        if (role == Role.TECHNICIAN && !collaboratorAllowed && !incident.isPrimary(user.getId())) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only the primary technician may perform this action.");
        return incident;
    }
    public Options options(String email) {
        actor(email);
        return new Options(catalog.all().stream().filter(c -> c.isEnabled() && c.getKind().equals("CATEGORY")).map(c -> new Option(c.getCode(), c.getLabel())).toList(),
                catalog.all().stream().filter(c -> c.isEnabled() && c.getCriticality() != null && c.getKind().equals("SERVICE")).map(c -> new Option(c.getCode(), c.getLabel())).toList());
    }
    public List<View> list(String email, boolean mine, String search, IncidentStatus status, Incident.Category category, Incident.Priority priority) {
        User user = actor(email);
        if (mine) role(user, Role.STUDENT);
        List<Incident> found = switch (user.getRole()) {
            case STUDENT -> incidents.findByReporterIdOrderByCreatedAtDesc(user.getId());
            case TECHNICIAN -> incidents.findByAssignedTechnicianIdOrderByCreatedAtDesc(user.getId());
            case ADMIN -> incidents.findAllByOrderByCreatedAtDesc();
        };
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        return found.stream().filter(i -> (status == null || i.getStatus() == status) && (category == null || java.util.Objects.equals(i.getCategory(), category))
                && (priority == null || i.getPriority() == priority)
                && (i.getTitle().toLowerCase(Locale.ROOT).contains(query) || i.getId().toString().contains(query)))
                .map(i -> view(i, user)).toList();
    }
    public List<View> team(String email) {
        User user = actor(email); role(user, Role.TECHNICIAN);
        return incidents.findTeamIncidents(user.getId()).stream().map(i -> view(i, user)).toList();
    }
    public View get(Long id, String email) {
        User user = actor(email);
        Incident incident = incidents.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found."));
        access(incident, user);
        return view(incident, user);
    }
    @Transactional
    public View create(Create request, String email) {
        User user = actor(email); role(user, Role.STUDENT);
        if (request.category() == null) throw new IllegalArgumentException("Select an incident category.");
        catalog.requireEnabled("CATEGORY", request.category().name());
        Incident incident = new Incident(request.title(), request.description(), (Student) user,
                Incident.Category.OTHER, null, null, null);
        incident.captureReportedContext(request.category(), request.urgency());
        if (request.affectedService() != null) {
            catalog.requireEnabled("SERVICE", request.affectedService().name());
            if (catalog.get("SERVICE", request.affectedService().name()).getCriticality() == null)
                throw new IllegalArgumentException("Selected service is not configured. Choose another service or Not sure.");
        }
        incident.captureServiceHint(request.affectedService());
        incident.captureReportedAffectedUsers(request.affectedUsers());
        incident.record(user, "CREATED", "Incident reported.", STUDENT_VISIBLE);
        incidents.saveAndFlush(incident);
        events.publish(incident.getId(), user.getId(), "CREATED", null, "NEW", "Incident reported.");

        // Automatic backend classification
        classificationService.processSubmission(incident, user);
        incident.record(user, "REPORTED_CONTEXT", "Reported category: " + request.category()
                + "; reported affected people (unverified): " + request.affectedUsers()
                + "; service hint: " + (request.affectedService() == null ? "Not supplied" : request.affectedService().name())
                + "; reported urgency: " + (request.urgency() == null ? "Not supplied" : request.urgency())
                + ". Calculated urgency: " + (incident.getUrgency() == null ? "Awaiting evidence/review" : incident.getUrgency())
                + ". Backend rules evaluate urgency independently of the student's suggestion.", STUDENT_VISIBLE);
        // Already managed: flush the appended history without merging persist-only children.
        incidents.flush();

        if (incident.isAutoClassified()) {
            events.publish(incident.getId(), null, "CLASSIFIED", "Service classified automatically from configured keywords.");
            events.publish(incident.getId(), user.getId(), "PRIORITY_CHANGED", "PENDING", incident.getPriority().name(),
                    "Automatically classified: " + incident.getPriority());
        } else if (incident.isNeedsClassificationReview()) {
            var admins = users.findAll().stream().filter(u -> u.isEnabled() && u.getRole() == Role.ADMIN)
                    .map(User::getId).collect(java.util.stream.Collectors.toSet());
            events.publishTo(incident.getId(), null, "CLASSIFICATION_REVIEW_REQUIRED", null, "Pending Classification",
                    incident.getClassificationNotes(), admins);
        }

        // Complete eligible assignment synchronously as part of submission; the scheduled worker remains a retry path.
        if (incident.isAutoClassified()) assignmentService.assignPending(incident.getId());

        duplicates.check(incident.getId());
        return view(incident, user);
    }
    @Transactional
    public View classify(Long id, Classification request, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.ADMIN);
        catalog.requireEnabled("CATEGORY",request.category().name());
        if (incident.getAffectedService() == null || incident.getImpact() == null || incident.getUrgency() == null) {
            throw new IllegalStateException("Service, impact and urgency must be determined first. Use Classification Review to provide service and severity.");
        }
        Incident.Level criticality = priorities.criticality(incident.getAffectedService());
        incident.classify(request.category(), priorities.calculate(incident, criticality));
        incident.captureClassifiedSkill(catalog.get("CATEGORY",request.category().name()).getRequiredSkill());
        incident.captureCriticality(criticality);
        slaPolicies.capture(incident);
        events.publish(id, user.getId(), "PRIORITY_CHANGED", "PENDING", incident.getPriority().name(), "Calculated using " + priorities.current().getStrategy() + "; criticality: " + criticality);
        incident.record(user, "PRIORITY_ASSIGNED", "Priority: " + incident.getPriority() + "; criticality: " + criticality, STUDENT_VISIBLE);
        return finish(incident, user, "CLASSIFIED", "Category confirmed: " + request.category());
    }
    @Transactional
    public View adminReclassify(Long id, AdminCorrection request, String email) {
        User user = actor(email); role(user, Role.ADMIN);
        Incident incident = incidents.findForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found."));
        String previousPriority = incident.getPriority() != null ? incident.getPriority().name() : "PENDING";
        classificationService.reclassify(incident, request.affectedService(), request.category(), request.impact(), request.urgency(), request.reason(), user);
        // The locked incident is already managed; merging loses persist-only history associations.
        incidents.flush();
        events.publish(id, user.getId(), "PRIORITY_CHANGED", previousPriority, incident.getPriority().name(),
                "Administrator updated classification: " + request.reason());
        return view(incident, user);
    }
    @Transactional
    public View edit(Long id, Edit request, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.STUDENT);
        incident.editReport(request.title(), request.description());
        return finish(incident, user, "REPORT_EDITED", "Reporter updated the report before classification.");
    }
    @Transactional
    public View acknowledge(Long id, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.TECHNICIAN);
        incident.acknowledge(); return finish(incident, user, "ACKNOWLEDGED", "Technician acknowledged the incident.");
    }
    @Transactional
    public View start(Long id, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.TECHNICIAN);
        if (incident.getStatus() == IncidentStatus.ASSIGNED) {
            incident.acknowledge();
            incident.record(user, "ACKNOWLEDGED", "Technician acknowledged the incident by starting work.", STUDENT_VISIBLE);
            events.publish(id, user.getId(), "ACKNOWLEDGED", "Technician started work.");
        }
        incident.start(); return finish(incident, user, "INVESTIGATION_STARTED", "Investigation started.");
    }
    @Transactional
    public View note(Long id, Note request, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.TECHNICIAN, true);
        incident.require(IncidentStatus.IN_PROGRESS);
        incident.addNote(user, request.content(), request.visibility(), NOTE);
        incident.record(user, "NOTE_ADDED", "Investigation note added.", request.visibility());
        incidents.flush();
        events.publish(id, user.getId(), request.visibility() == INTERNAL ? "INTERNAL_NOTE_ADDED" : "NOTE_ADDED", "Investigation note added.");
        return view(incident, user);
    }
    @Transactional
    public View information(Long id, Message request, String email, boolean reply) {
        User user = actor(email); Incident incident = editable(id, user, reply ? Role.STUDENT : Role.TECHNICIAN);
        incident.require(IncidentStatus.IN_PROGRESS);
        if (reply && !incident.isAwaitingStudent()) throw new IllegalStateException("There is no outstanding information request to reply to.");
        if (!reply && incident.isAwaitingStudent()) throw new IllegalStateException("An information request is already awaiting the student. Resume with a reason before requesting again.");
        incident.addNote(user, request.content(), STUDENT_VISIBLE, reply ? STUDENT_REPLY : INFORMATION_REQUEST);
        return finish(incident, user, reply ? "STUDENT_REPLIED" : "INFORMATION_REQUESTED", reply ? "Student replied to support." : "Technician requested additional information.");
    }
    @Transactional public View resumeWithoutReply(Long id,Message request,String email) {
        User user=actor(email); Incident incident=editable(id,user,Role.TECHNICIAN);
        incident.require(IncidentStatus.IN_PROGRESS);
        if(!incident.isAwaitingStudent()) throw new IllegalStateException("This incident is not awaiting a student reply.");
        String reason=Incident.text(request.content(),5,2000);
        return finish(incident,user,"RESUMED_WITHOUT_REPLY","Investigation resumed without student response. Reason: " + reason + ". Original SLA deadlines retained.");
    }
    @Transactional
    public View resolve(Long id, Resolution request, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.TECHNICIAN);
        incident.resolve(request.summary(), request.steps());
        return finish(incident, user, "RESOLVED", "Resolution: " + incident.getResolutionSummary() + "\nSteps: " + incident.getResolutionSteps());
    }
    @Transactional
    public View verify(Long id, Verification request, String email) {
        User user = actor(email);
        // Returning to investigation increases active workload: use the same lock order as assignments.
        if (!Boolean.TRUE.equals(request.confirmed())) assignmentSettings.lock();
        Incident incident = editable(id, user, Role.STUDENT);
        if (Boolean.TRUE.equals(request.confirmed())) {
            incident.verify(); return finish(incident, user, "VERIFIED", "Reporter confirmed the issue is resolved.");
        }
        String reason = Incident.text(request.reason(), 1, 2000);
        incident.issueStillExists();
        incident.addNote(user, reason, STUDENT_VISIBLE, STUDENT_REPLY);
        return finish(incident, user, "ISSUE_STILL_EXISTS", "Returned to investigation: " + reason);
    }
    @Transactional
    public View close(Long id, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.ADMIN);
        incident.close(); return finish(incident, user, "CLOSED", "Administrator closed the verified incident.");
    }
    @Transactional
    public View dispose(Long id, Disposition request, String email) {
        User user = actor(email);
        boolean withdrawal = request.kind() == ClosureKind.WITHDRAWN;
        Incident incident = editable(id, user, withdrawal ? Role.STUDENT : Role.ADMIN);
        String reason = Incident.text(request.reason(), 5, 2000);
        if (request.kind() == null) throw new IllegalArgumentException("Choose a closure reason.");
        if (request.kind() == ClosureKind.DUPLICATE) {
            if (request.duplicateOf() == null || request.duplicateOf().equals(id))
                throw new IllegalArgumentException("Choose a different existing incident as the original report.");
            if (!incidents.existsById(request.duplicateOf())) throw new IllegalArgumentException("The original incident does not exist.");
        } else if (request.duplicateOf() != null) throw new IllegalArgumentException("An original incident is only applicable to duplicate closure.");
        String previous = incident.getStatus().name();
        incident.closeWithoutResolution(withdrawal);
        String action = "CLOSED_" + request.kind();
        String detail = request.kind() + (request.duplicateOf() == null ? "" : " of incident #" + request.duplicateOf()) + ": " + reason;
        incident.record(user, action, detail, STUDENT_VISIBLE);
        incidents.flush();
        events.publish(id, user.getId(), action, previous, "CLOSED", detail);
        return view(incident, user);
    }
    @Transactional
    public View feedback(Long id, Feedback request, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.STUDENT);
        incident.giveFeedback((Student) user, request.rating(), request.comment());
        return finish(incident, user, "FEEDBACK_SUBMITTED", "Reporter submitted support feedback.");
    }
    @Transactional public View overridePriority(Long id,PriorityOverride request,String email) {
        User user=actor(email); Incident incident=editable(id,user,Role.ADMIN);
        String reason=Incident.text(request.reason(),5,2000);
        String before=incident.getPriority().name(); incident.overridePriority(request.priority());
        String explanation="Administrator override: " + before + " -> " + request.priority() + ". Reason: " + reason
                + ". Existing SLA deadlines preserved: response=" + incident.getResponseDeadline() + ", resolution=" + incident.getResolutionDeadline();
        incident.record(user,"PRIORITY_OVERRIDDEN",explanation,STUDENT_VISIBLE); incidents.flush();
        events.publish(id,user.getId(),"PRIORITY_CHANGED",before,request.priority().name(),explanation);
        return view(incident,user);
    }
    private View finish(Incident incident, User actor, String action, String description) {
        incident.record(actor, action, description, STUDENT_VISIBLE);
        incidents.flush();
        String previous = switch (action) {
            case "CLASSIFIED" -> "NEW";
            case "ACKNOWLEDGED" -> "ASSIGNED";
            case "INVESTIGATION_STARTED" -> "ACKNOWLEDGED";
            case "RESOLVED" -> "IN_PROGRESS";
            case "VERIFIED", "ISSUE_STILL_EXISTS" -> "RESOLVED";
            case "CLOSED" -> "VERIFIED";
            default -> incident.getStatus().name();
        };
        events.publish(incident.getId(), actor.getId(), action, previous, incident.getStatus().name(), description);
        return view(incident, actor);
    }
    private static Person person(User user) { return user == null ? null : new Person(user.getId(), user.getName()); }
    private View view(Incident i, User user) {
        boolean student = user.getRole() == Role.STUDENT;
        var notes = i.getNotes().stream().filter(n -> !student || n.getVisibility() == STUDENT_VISIBLE)
                .map(n -> new NoteView(n.getId(), person(n.getAuthor()), n.getContent(), n.getVisibility(), n.getKind(), n.getCreatedAt())).toList();
        var history = i.getHistory().stream().filter(h -> !student || h.getVisibility() == STUDENT_VISIBLE)
                .map(h -> new HistoryView(h.getId(), person(h.getActor()), h.getAction(), h.getDescription(), h.getCreatedAt())).toList();
        var f = i.getFeedback();
        String serviceLabel = i.getAffectedService() == null ? "Awaiting Classification" : i.getAffectedService().getLabel();
        if (i.getAffectedService() != null) {
            serviceLabel = catalog.all().stream().filter(c -> "SERVICE".equals(c.getKind()) && c.getCode().equals(i.getAffectedService().name()))
                    .map(CatalogEntry::getLabel).findFirst().orElse(serviceLabel);
        }
        return new View(i.getId(), i.getTitle(), i.getDescription(), person(i.getReporter()), i.getCategory(), i.getAffectedService(),
                serviceLabel, i.getImpact(), i.getUrgency(), i.getPriority(), i.getStatus(), person(i.getAssignedTechnician()),
                i.getCreatedAt(), i.getUpdatedAt(), i.getAcknowledgedAt(), i.getResolvedAt(), i.getVerifiedAt(), i.getClosedAt(),
                i.getResolutionSummary(), i.getResolutionSteps(), notes, history, f == null ? null : new FeedbackView(f.getRating(), f.getComment(), f.getCreatedAt()),
                user.getRole() == Role.TECHNICIAN && i.isPrimary(user.getId()), student ? List.of() : i.getCollaborators().stream()
                    .map(c -> new TeamMember(person(c.getTechnician()), c.getResponsibility())).toList(), categories.suggest(i.getTitle(), i.getDescription()), i.getCriticality(), i.getResponseDeadline(), i.getResolutionDeadline(), i.responseSla(java.time.Instant.now()), i.resolutionSla(java.time.Instant.now()),
                i.isNeedsClassificationReview(), i.isAutoClassified(), i.getClassificationNotes(), i.getReportedCategory(), i.getReportedUrgency(), i.isAwaitingStudent());
    }
}
