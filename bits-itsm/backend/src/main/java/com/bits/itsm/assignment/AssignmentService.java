package com.bits.itsm.assignment;

import java.util.*;
import com.bits.itsm.incident.*;
import com.bits.itsm.incident.IncidentData.Person;
import com.bits.itsm.user.*;
import com.bits.itsm.assignment.AssignmentData.*;
import static com.bits.itsm.assignment.AssignmentRequest.Status.*;
import static com.bits.itsm.incident.InvestigationNote.Visibility.*;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@Service @Transactional(readOnly = true)
public class AssignmentService implements ApplicationRunner {
    private final IncidentRepository incidents;
    private final UserRepository users;
    private final WorkloadService workloads;
    private final AssignmentSettingsRepository settings;
    private final TransferRequestRepository transfers;
    private final CollaborationRequestRepository collaborations;
    private final JdbcTemplate jdbc;
    private final com.bits.itsm.event.IncidentEventPublisher events;
    public AssignmentService(IncidentRepository incidents, UserRepository users, WorkloadService workloads,
            AssignmentSettingsRepository settings, TransferRequestRepository transfers, CollaborationRequestRepository collaborations, JdbcTemplate jdbc, com.bits.itsm.event.IncidentEventPublisher events) {
        this.incidents = incidents; this.users = users; this.workloads = workloads; this.settings = settings;
        this.transfers = transfers; this.collaborations = collaborations; this.jdbc = jdbc; this.events = events;
    }
    @Override @Transactional
    public void run(ApplicationArguments arguments) {
        settings.initialize();
        settings.lock();
        // Preserve existing availability and skills when adopting older database columns.
        if (legacyColumn("available")) jdbc.update("update app_users set availability = case when available = false then 'UNAVAILABLE' else 'AVAILABLE' end where role = 'TECHNICIAN' and availability is null");
        jdbc.update("update app_users set availability = 'AVAILABLE' where role = 'TECHNICIAN' and availability is null");
        if (legacyColumn("specialization")) {
            jdbc.update("insert into technician_skills(technician_id, skill) select id, case when specialization = 'APPLICATION' then 'APPLICATION_SUPPORT' else specialization end from app_users where role = 'TECHNICIAN' and specialization in ('NETWORK','HARDWARE','SOFTWARE','DATABASE','AUTHENTICATION','SECURITY','APPLICATION','APPLICATION_SUPPORT','CLOUD','STORAGE') on conflict do nothing");
            jdbc.update("update app_users set specialization = null where role = 'TECHNICIAN' and exists (select 1 from technician_skills s where s.technician_id = app_users.id)");
        }
    }
    private boolean legacyColumn(String name) {
        return jdbc.queryForObject("select count(*) from information_schema.columns where table_schema = current_schema() and table_name = 'app_users' and column_name = ?", Integer.class, name) > 0;
    }
    private User actor(String email, Role... allowed) {
        User user = users.findByEmail(email).filter(User::isEnabled).orElseThrow(() -> error(HttpStatus.UNAUTHORIZED, "Sign in with an enabled account."));
        if (Arrays.stream(allowed).noneMatch(role -> role == user.getRole())) throw error(HttpStatus.FORBIDDEN, "This action is not permitted for your role.");
        return user;
    }
    private static ResponseStatusException error(HttpStatus status, String message) { return new ResponseStatusException(status, message); }
    private Incident locked(Long id) {
        // One settings-row lock serializes all assignment/capacity changes before incident locks.
        // This deliberately simple policy is sufficient for the campus prototype.
        settings.lock();
        return incidents.findForUpdate(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Incident not found."));
    }
    private void primary(Incident incident, User user) {
        if (!incident.isPrimary(user.getId())) throw error(HttpStatus.FORBIDDEN, "Only the current primary technician may request team changes.");
    }
    private Technician eligible(Incident incident, Long id, TechnicianSkill required) {
        User selected = users.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Technician not found."));
        if (!(selected instanceof Technician)) throw new IllegalArgumentException("Select a technician account.");
        return workloads.candidates(incident).stream().filter(c -> c.technician().getId().equals(id) && c.eligible(required))
                .map(AssignmentStrategy.Candidate::technician).findFirst().orElseThrow(() -> new IllegalStateException("Technician is already on this incident, disabled, busy, unavailable, unqualified or at capacity."));
    }
    public Strategy strategy(String email) { actor(email, Role.ADMIN); return new Strategy(settings.findById(1L).orElseThrow().getStrategy()); }
    public record CandidatePreview(Long id, String name, Set<TechnicianSkill> skills, long workload,
            int capacity, boolean eligible, List<String> reasons, boolean selected) { }
    public record AssignmentPreview(AssignmentSettings.Mode strategy, TechnicianSkill requiredSkill, List<CandidatePreview> technicians) { }
    public AssignmentPreview preview(Long id, String email) {
        actor(email, Role.ADMIN);
        Incident incident = incidents.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Incident not found."));
        var mode = settings.findById(1L).orElseThrow().getStrategy();
        boolean generalSupport = Incident.Category.OTHER.equals(incident.getCategory());
        AssignmentStrategy strategy = generalSupport ? new RandomAvailableAssignment()
                : mode == AssignmentSettings.Mode.SKILL_BASED ? new SkillBasedAssignment() : new LoadBasedAssignment();
        boolean assignable = incident.getStatus() == IncidentStatus.CLASSIFIED && incident.getAssignedTechnician() == null
                && !incident.isNeedsClassificationReview() && (generalSupport || incident.requiredSkill() != null);
        Long selected = assignable ? strategy.assign(incident, workloads.candidates(incident)).map(User::getId).orElse(null) : null;
        var candidates = workloads.all().stream().map(w -> {
            List<String> reasons = new ArrayList<>();
            if (!assignable) reasons.add("Incident must be classified and unassigned; only general-support fallback may omit a specialist skill.");
            if (!w.enabled()) reasons.add("Account is inactive.");
            if (w.availability() != Technician.Availability.AVAILABLE) reasons.add("Only AVAILABLE technicians receive new assignments; BUSY and UNAVAILABLE are excluded.");
            if (w.total() >= w.maxWorkload()) reasons.add("Maximum workload capacity reached.");
            if (!generalSupport && incident.requiredSkill() != null && !w.skills().contains(incident.requiredSkill())) reasons.add("Missing required skill: " + incident.requiredSkill());
            if (incident.participates(w.id())) reasons.add("Already participates in this incident.");
            return new CandidatePreview(w.id(), w.name(), w.skills(), w.total(), w.maxWorkload(), reasons.isEmpty(), List.copyOf(reasons), Objects.equals(selected,w.id()));
        }).toList();
        return new AssignmentPreview(mode, incident.requiredSkill(), candidates);
    }
    @Transactional public Strategy selectStrategy(Strategy request, String email) {
        actor(email, Role.ADMIN); var config = settings.lock(); config.select(request.strategy()); return new Strategy(config.getStrategy());
    }
    public List<WorkloadService.Workload> workload(String email, boolean all) {
        User user = all ? actor(email, Role.ADMIN) : actor(email, Role.TECHNICIAN);
        return workloads.all().stream().filter(w -> all || w.id().equals(user.getId())).toList();
    }
    public Technician.Availability getAvailability(String email) {
        User user = actor(email, Role.TECHNICIAN);
        if (!(user instanceof Technician technician)) throw new IllegalArgumentException("Authenticated user is not a technician.");
        return technician.getAvailability();
    }
    @Transactional public WorkloadService.Workload updateAvailability(Technician.Availability availability, String email) {
        settings.lock(); // Serialize availability changes with technician selection and capacity checks.
        User user = actor(email, Role.TECHNICIAN);
        if (!(user instanceof Technician technician)) throw new IllegalArgumentException("Authenticated user is not a technician.");
        if (availability == null) throw new IllegalArgumentException("Availability status is required.");
        technician.setAvailability(availability);
        users.flush();
        return workloads.all().stream().filter(w -> w.id().equals(technician.getId())).findFirst().orElseThrow();
    }
    @Transactional public WorkloadService.Workload profile(Long id, Profile request, String email) {
        actor(email, Role.ADMIN); settings.lock();
        User user = users.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Technician not found."));
        if (!(user instanceof Technician technician)) throw new IllegalArgumentException("Select a technician account.");
        technician.configureAssignment(request.skills(), request.availability(), request.maxWorkload()); users.flush();
        return workloads.all().stream().filter(w -> w.id().equals(id)).findFirst().orElseThrow();
    }
    public List<WorkloadService.Workload> eligibleList(Long id, boolean collaboration, TechnicianSkill skill, String email) {
        User user = actor(email, Role.ADMIN, Role.TECHNICIAN);
        Incident incident = incidents.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Incident not found."));
        if (user.getRole() == Role.TECHNICIAN) primary(incident, user);
        TechnicianSkill required = collaboration ? skill : incident.requiredSkill();
        Set<Long> ids = new HashSet<>(); workloads.candidates(incident).stream().filter(c -> c.eligible(required)).forEach(c -> ids.add(c.technician().getId()));
        return workloads.all().stream().filter(w -> ids.contains(w.id())).toList();
    }
    @Transactional public void manageCollaborator(Long id, Long technicianId, String reason, boolean remove, String email) {
        User user=actor(email,Role.ADMIN); Incident incident=locked(id); incident.requireAssignableTeam();
        if(reason==null || reason.trim().length()<5 || reason.length()>2000) throw new IllegalArgumentException("Provide a reason or responsibility of 5–2000 characters.");
        if(remove) {
            var member=incident.getCollaborators().stream().filter(c -> c.getTechnician().getId().equals(technicianId)).findFirst().orElseThrow(() -> new IllegalArgumentException("Collaborator not found."));
            incident.removeCollaborator(technicianId);
        } else incident.addCollaborator(eligible(incident,technicianId,null),reason.trim());
        String action=remove?"COLLABORATOR_REMOVED":"COLLABORATOR_ADDED";
        incident.record(user,action,reason.trim(),INTERNAL); incidents.flush();
        events.publishTo(id,user.getId(),action,null,technicianId.toString(),reason.trim(),Set.of(technicianId));
    }
    /** Internal worker entry point; never exposed as an unauthenticated HTTP operation. */
    @Transactional public boolean assignPending(Long id) {
        Incident incident = locked(id);
        if (incident.getStatus() != IncidentStatus.CLASSIFIED || incident.getAssignedTechnician() != null
                || incident.getPriority() == Incident.Priority.PENDING || incident.isNeedsClassificationReview()) return false;
        boolean generalSupport = Incident.Category.OTHER.equals(incident.getCategory());
        AssignmentStrategy strategy = generalSupport ? new RandomAvailableAssignment()
                : settings.findById(1L).orElseThrow().getStrategy() == AssignmentSettings.Mode.SKILL_BASED
                    ? new SkillBasedAssignment() : new LoadBasedAssignment();
        var selected = generalSupport ? strategy.assign(incident, workloads.candidates(incident))
                : incident.requiredSkill() == null ? Optional.<Technician>empty() : strategy.assign(incident, workloads.candidates(incident));
        if (selected.isEmpty()) {
            if (incident.getHistory().stream().noneMatch(h -> "PENDING_ASSIGNMENT".equals(h.getAction()))) {
                String message = "Pending assignment: no enabled, available technician " + (generalSupport ? "with spare capacity" : "has the required skill and spare capacity") + ". Priority and SLA are retained.";
                incident.record(incident.getReporter(), "PENDING_ASSIGNMENT", message, STUDENT_VISIBLE);
                incidents.flush();
                var admins = users.findAll().stream().filter(u -> u.isEnabled() && u.getRole() == Role.ADMIN)
                        .map(User::getId).collect(java.util.stream.Collectors.toSet());
                events.publishTo(id, null, "PENDING_ASSIGNMENT", null, "Pending Assignment", message, admins);
            }
            return false;
        }
        Technician technician = selected.get();
        incident.assign(technician);
        String reason = generalSupport ? "random general-support selection among active AVAILABLE technicians with spare capacity; specialist skill was not required"
                : "configured " + settings.findById(1L).orElseThrow().getStrategy() + " strategy, required skill and available capacity";
        incident.record(incident.getReporter(), "AUTO_ASSIGNED", "System assigned to " + technician.getName() + " using " + reason + ".", STUDENT_VISIBLE);
        incidents.flush();
        events.publish(id, null, "AUTO_ASSIGNED", "Unassigned", technician.getId().toString(),
                "System assigned to " + technician.getName() + " using " + reason + ".");
        return true;
    }
    @Transactional public void assign(Long id, Long technicianId, boolean automatic, String email) {
        assign(id, technicianId, automatic, email, null);
    }
    @Transactional public void assign(Long id, Long technicianId, boolean automatic, String email, String reason) {
        User user = actor(email, Role.ADMIN); Incident incident = locked(id);
        Long previousOwner = incident.getAssignedTechnician() == null ? null : incident.getAssignedTechnician().getId();
        if (previousOwner != null && (reason == null || reason.trim().length() < 5 || reason.trim().length() > 2000))
            throw new IllegalArgumentException("Provide a reassignment reason of 5–2000 characters.");
        String justification = previousOwner == null ? "Initial assignment." : reason.trim();
        Technician technician;
            if (automatic) {
            incident.require(IncidentStatus.CLASSIFIED);
            boolean generalSupport = Incident.Category.OTHER.equals(incident.getCategory());
            if (incident.requiredSkill()==null && !generalSupport) throw new IllegalStateException("Configure the category's required skill and review classification before automatic assignment.");
            AssignmentStrategy strategy = generalSupport ? new RandomAvailableAssignment()
                    : settings.findById(1L).orElseThrow().getStrategy() == AssignmentSettings.Mode.SKILL_BASED ? new SkillBasedAssignment() : new LoadBasedAssignment();
            technician = strategy.assign(incident, workloads.candidates(incident)).orElseThrow(() -> new IllegalStateException("No eligible technician available. Incident remains classified and awaiting assignment."));
        } else technician = eligible(incident, technicianId, incident.requiredSkill());
        String previous = incident.getAssignedTechnician() == null ? "Unassigned" : incident.getAssignedTechnician().getId().toString();
        if (incident.getStatus() == IncidentStatus.CLASSIFIED) incident.assign(technician); else incident.reassign(technician);
        incident.record(user, automatic ? "AUTO_ASSIGNED" : "ASSIGNED", "Assigned to " + technician.getName() + ". Reason: " + justification, STUDENT_VISIBLE);
        incidents.flush();
        events.publishTo(id, user.getId(), automatic ? "AUTO_ASSIGNED" : "ASSIGNED", previous, technician.getId().toString(), "Assigned to " + technician.getName() + ". Reason: " + justification,
                previousOwner == null ? Set.of() : Set.of(previousOwner));
    }
    @Transactional public RequestView transfer(Long id, Transfer request, String email) {
        User user = actor(email, Role.TECHNICIAN); Incident incident = locked(id); primary(incident, user); incident.requireAssignableTeam();
        if (transfers.existsByIncidentIdAndStatus(id, PENDING)) throw new IllegalStateException("A transfer request is already pending for this incident.");
        Technician target = request.technicianId() == null ? null : eligible(incident, request.technicianId(), incident.requiredSkill());
        TransferRequest saved = transfers.save(new TransferRequest(incident, target, request.reason(), request.handoverNotes()));
        String destination = target == null ? "No destination suggested; administrator will select." : "Suggested destination: " + target.getName() + " (" + target.getId() + ").";
        String requestAudit = "Previous technician: " + user.getName() + " (" + user.getId() + "). " + destination + " Reason: " + request.reason() + ". Explanation: " + request.handoverNotes();
        incident.record(user, "TRANSFER_REQUESTED", requestAudit, INTERNAL);
        incidents.flush();
        events.publishTo(id, user.getId(), "TRANSFER_REQUESTED", user.getId().toString(), PENDING.name(), requestAudit, Set.of());
        return view(saved);
    }
    @Transactional public RequestView collaborate(Long id, Collaboration request, String email) {
        User user = actor(email, Role.TECHNICIAN); Incident incident = locked(id); primary(incident, user); incident.requireAssignableTeam();
        if (collaborations.existsByIncidentIdAndProposedTechnicianIdAndStatus(id, request.technicianId(), PENDING)) throw new IllegalStateException("A request for this collaborator is already pending.");
        Technician target = eligible(incident, request.technicianId(), request.requiredSkill());
        CollaborationRequest saved = collaborations.save(new CollaborationRequest(incident, target, request.requiredSkill(), request.reason(), request.responsibility()));
        incident.record(user, "COLLABORATOR_REQUESTED", "Collaboration requested from " + target.getName() + ".", INTERNAL);
        incidents.flush();
        events.publishTo(id, user.getId(), "COLLABORATOR_REQUESTED", null, PENDING.name(), "A collaboration request awaits administrator review.", Set.of(target.getId()));
        return view(saved);
    }
    public List<RequestView> requests(boolean collaboration, boolean admin, String email) {
        User user = admin ? actor(email, Role.ADMIN) : actor(email, Role.TECHNICIAN);
        List<? extends AssignmentRequest> records = collaboration
                ? admin ? collaborations.findAllByOrderByRequestedAtDesc() : collaborations.findByPrimaryTechnicianIdOrProposedTechnicianIdOrderByRequestedAtDesc(user.getId(), user.getId())
                : admin ? transfers.findAllByOrderByRequestedAtDesc() : transfers.findByPrimaryTechnicianIdOrProposedTechnicianIdOrderByRequestedAtDesc(user.getId(), user.getId());
        return records.stream().map(this::view).toList();
    }
    @Transactional public RequestView review(Long id, boolean collaboration, AssignmentRequest.Status decision, Review request, String email) {
        User user = decision == CANCELLED ? actor(email, Role.TECHNICIAN) : actor(email, Role.ADMIN);
        settings.lock();
        AssignmentRequest pending = collaboration ? collaborations.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Request not found."))
                : transfers.findById(id).orElseThrow(() -> error(HttpStatus.NOT_FOUND, "Request not found."));
        pending.requirePending();
        Incident incident = incidents.findForUpdate(pending.getIncident().getId()).orElseThrow();
        if (decision == CANCELLED && !pending.getPrimaryTechnician().getId().equals(user.getId())) throw error(HttpStatus.FORBIDDEN, "Only the requester may cancel this request.");
        if (decision == APPROVED) {
            incident.requireAssignableTeam();
            if (!incident.isPrimary(pending.getPrimaryTechnician().getId())) throw new IllegalStateException("Primary ownership changed; reject this stale request.");
            if (!pending.getPrimaryTechnician().isEnabled()) throw new IllegalStateException("Original primary account is disabled; use administrator reassignment.");
            TechnicianSkill required = collaboration ? ((CollaborationRequest) pending).getRequiredSkill() : incident.requiredSkill();
            Long destinationId = request.technicianId() != null ? request.technicianId() : pending.getProposedTechnician() == null ? null : pending.getProposedTechnician().getId();
            if (!collaboration && destinationId == null) throw new IllegalArgumentException("Select an eligible destination technician before approval.");
            Technician target = eligible(incident, destinationId, required);
            if (collaboration) incident.addCollaborator(target, ((CollaborationRequest) pending).getResponsibility()); else { incident.reassign(target); ((TransferRequest) pending).assignTo(target); }
            if (collaboration) incident.record(user, "COLLABORATOR_ADDED", "Collaborator added: " + target.getName() + ".", INTERNAL);
            else incident.record(user, "TECHNICIAN_CHANGED", "Primary technician changed from " + pending.getPrimaryTechnician().getName() + " to " + target.getName() + " after administrator approval.", STUDENT_VISIBLE);
        }
        pending.review(decision, user, request.notes());
        String reviewAudit = collaboration ? request.notes() : decision == APPROVED
                ? "Approved by " + user.getName() + ". Reason: " + ((TransferRequest) pending).getReason() + ". Explanation: " + ((TransferRequest) pending).getHandoverNotes() + ". Review: " + request.notes()
                : "Rejected by " + user.getName() + ". Assignment remains with " + pending.getPrimaryTechnician().getName() + " (" + pending.getPrimaryTechnician().getId() + "). Request reason: " + ((TransferRequest) pending).getReason() + ". Explanation: " + ((TransferRequest) pending).getHandoverNotes() + ". Rejection reason: " + request.notes();
        incident.record(user, (collaboration ? "COLLABORATION_" : "TRANSFER_") + decision, reviewAudit, INTERNAL);
        incidents.flush();
        if (!collaboration && decision == APPROVED) {
            TransferRequest transfer = (TransferRequest) pending;
            events.publish(incident.getId(), user.getId(), "TECHNICIAN_CHANGED", pending.getPrimaryTechnician().getId().toString(), incident.getAssignedTechnician().getId().toString(), "Transfer approved by " + user.getName() + ". Reason: " + transfer.getReason() + ". Explanation: " + transfer.getHandoverNotes() + ". Review: " + request.notes());
        }
        Set<Long> recipients = new HashSet<>(Set.of(pending.getPrimaryTechnician().getId()));
        if (collaboration && pending.getProposedTechnician() != null) recipients.add(pending.getProposedTechnician().getId());
        if (!collaboration && decision == APPROVED) recipients.add(incident.getAssignedTechnician().getId());
        events.publishTo(incident.getId(), user.getId(), (collaboration ? "COLLABORATION_" : "TRANSFER_") + decision, PENDING.name(), decision.name(), reviewAudit, recipients);
        return view(pending);
    }
    private static Person person(User user) { return user == null ? null : new Person(user.getId(), user.getName()); }
    private RequestView view(AssignmentRequest r) {
        TransferRequest t = r instanceof TransferRequest transfer ? transfer : null;
        CollaborationRequest c = r instanceof CollaborationRequest collaboration ? collaboration : null;
        return new RequestView(r.getId(), r.getIncident().getId(), r.getIncident().getTitle(), person(r.getPrimaryTechnician()), person(r.getProposedTechnician()), t != null ? person(t.getAssignedTechnician()) : null, r.getStatus(),
                t != null ? t.getReason().name() : c.getReason(), t != null ? t.getHandoverNotes() : null, c != null ? c.getRequiredSkill() : null,
                c != null ? c.getResponsibility() : null, r.getRequestedAt(), person(r.getReviewedBy()), r.getReviewedAt(), r.getReviewNotes());
    }
}
