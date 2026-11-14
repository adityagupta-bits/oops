package com.bits.itsm.incident;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import com.bits.itsm.user.*;
import com.bits.itsm.incident.IncidentData.*;
import com.bits.itsm.assignment.AssignmentSettingsRepository;
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
    public IncidentService(IncidentRepository incidents, UserRepository users, AssignmentSettingsRepository assignmentSettings) {
        this.incidents = incidents; this.users = users; this.assignmentSettings = assignmentSettings;
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
        User user = actor(email);
        List<Person> technicians = user.getRole() == Role.ADMIN ? users.findAll().stream()
                .filter(account -> account instanceof Technician t && t.isEnabled() && t.isAvailable()).map(IncidentService::person).toList() : List.of();
        return new Options(Arrays.stream(Incident.Category.values()).map(c -> new Option(c.name(), c.name())).toList(),
                Arrays.stream(Incident.ItService.values()).map(s -> new Option(s.name(), s.getLabel())).toList(), technicians);
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
        return found.stream().filter(i -> (status == null || i.getStatus() == status) && (category == null || i.getCategory() == category)
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
        Incident incident = new Incident(request.title(), request.description(), (Student) user, request.category(), request.affectedService(), request.impact(), request.urgency());
        incident.record(user, "CREATED", "Incident reported.", STUDENT_VISIBLE);
        incidents.saveAndFlush(incident);
        return view(incident, user);
    }
    @Transactional
    public View classify(Long id, Classification request, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.ADMIN);
        incident.classify(request.category());
        return finish(incident, user, "CLASSIFIED", "Category confirmed: " + request.category());
    }
    @Transactional
    public View acknowledge(Long id, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.TECHNICIAN);
        incident.acknowledge(); return finish(incident, user, "ACKNOWLEDGED", "Technician acknowledged the incident.");
    }
    @Transactional
    public View start(Long id, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.TECHNICIAN);
        incident.start(); return finish(incident, user, "INVESTIGATION_STARTED", "Investigation started.");
    }
    @Transactional
    public View note(Long id, Note request, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.TECHNICIAN, true);
        incident.require(IncidentStatus.IN_PROGRESS);
        incident.addNote(user, request.content(), request.visibility(), NOTE);
        incident.record(user, "NOTE_ADDED", "Investigation note added.", request.visibility());
        incidents.flush(); return view(incident, user);
    }
    @Transactional
    public View information(Long id, Message request, String email, boolean reply) {
        User user = actor(email); Incident incident = editable(id, user, reply ? Role.STUDENT : Role.TECHNICIAN);
        incident.require(IncidentStatus.IN_PROGRESS);
        if (reply && incident.getNotes().stream().noneMatch(n -> n.getKind() == INFORMATION_REQUEST)) throw new IllegalStateException("There is no information request to reply to.");
        incident.addNote(user, request.content(), STUDENT_VISIBLE, reply ? STUDENT_REPLY : INFORMATION_REQUEST);
        return finish(incident, user, reply ? "STUDENT_REPLIED" : "INFORMATION_REQUESTED", reply ? "Student replied to support." : "Technician requested additional information.");
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
    public View feedback(Long id, Feedback request, String email) {
        User user = actor(email); Incident incident = editable(id, user, Role.STUDENT);
        incident.giveFeedback((Student) user, request.rating(), request.comment());
        return finish(incident, user, "FEEDBACK_SUBMITTED", "Reporter submitted support feedback.");
    }
    private View finish(Incident incident, User actor, String action, String description) {
        incident.record(actor, action, description, STUDENT_VISIBLE);
        incidents.flush();
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
        return new View(i.getId(), i.getTitle(), i.getDescription(), person(i.getReporter()), i.getCategory(), i.getAffectedService(),
                i.getAffectedService().getLabel(), i.getImpact(), i.getUrgency(), i.getPriority(), i.getStatus(), person(i.getAssignedTechnician()),
                i.getCreatedAt(), i.getUpdatedAt(), i.getAcknowledgedAt(), i.getResolvedAt(), i.getVerifiedAt(), i.getClosedAt(),
                i.getResolutionSummary(), i.getResolutionSteps(), notes, history, f == null ? null : new FeedbackView(f.getRating(), f.getComment(), f.getCreatedAt()),
                user.getRole() == Role.TECHNICIAN && i.isPrimary(user.getId()), student ? List.of() : i.getCollaborators().stream()
                    .map(c -> new TeamMember(person(c.getTechnician()), c.getResponsibility())).toList());
    }
}
