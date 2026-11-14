package com.bits.itsm.assignment;

import java.util.List;
import com.bits.itsm.assignment.AssignmentData.*;
import com.bits.itsm.incident.*;
import com.bits.itsm.user.TechnicianSkill;
import jakarta.validation.Valid;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api")
public class AssignmentController {
    private final AssignmentService service;
    private final IncidentService incidents;
    public AssignmentController(AssignmentService service, IncidentService incidents) { this.service = service; this.incidents = incidents; }
    @GetMapping("/admin/assignment-strategy") public Strategy strategy(Authentication auth) { return service.strategy(auth.getName()); }
    @PutMapping("/admin/assignment-strategy") public Strategy strategy(@Valid @RequestBody Strategy request, Authentication auth) { return service.selectStrategy(request, auth.getName()); }
    @GetMapping("/technician/workload") public WorkloadService.Workload workload(Authentication auth) { return service.workload(auth.getName(), false).getFirst(); }
    @GetMapping("/admin/technicians/workloads") public List<WorkloadService.Workload> workloads(Authentication auth) { return service.workload(auth.getName(), true); }
    @PutMapping("/admin/technicians/{id}/assignment-profile") public WorkloadService.Workload profile(@PathVariable Long id, @Valid @RequestBody Profile request, Authentication auth) { return service.profile(id, request, auth.getName()); }
    @GetMapping("/incidents/{id}/eligible-technicians") public List<WorkloadService.Workload> eligible(@PathVariable Long id, @RequestParam(defaultValue = "false") boolean collaboration, @RequestParam(required = false) TechnicianSkill skill, Authentication auth) { return service.eligibleList(id, collaboration, skill, auth.getName()); }
    @PostMapping("/incidents/{id}/auto-assign") public IncidentData.View auto(@PathVariable Long id, Authentication auth) { service.assign(id, null, true, auth.getName()); return incidents.get(id, auth.getName()); }
    @PostMapping("/incidents/{id}/assign") public IncidentData.View assign(@PathVariable Long id, @Valid @RequestBody IncidentData.Assignment request, Authentication auth) { service.assign(id, request.technicianId(), false, auth.getName()); return incidents.get(id, auth.getName()); }
    @PostMapping("/incidents/{id}/transfer-requests") public RequestView transfer(@PathVariable Long id, @Valid @RequestBody Transfer request, Authentication auth) { return service.transfer(id, request, auth.getName()); }
    @PostMapping("/incidents/{id}/collaboration-requests") public RequestView collaborate(@PathVariable Long id, @Valid @RequestBody Collaboration request, Authentication auth) { return service.collaborate(id, request, auth.getName()); }
    @GetMapping("/technician/team-incidents") public List<IncidentData.View> team(Authentication auth) { return incidents.team(auth.getName()); }
    @GetMapping("/technician/transfer-requests") public List<RequestView> myTransfers(Authentication auth) { return service.requests(false, false, auth.getName()); }
    @GetMapping("/technician/collaboration-requests") public List<RequestView> myCollaborations(Authentication auth) { return service.requests(true, false, auth.getName()); }
    @GetMapping("/admin/transfer-requests") public List<RequestView> transfers(Authentication auth) { return service.requests(false, true, auth.getName()); }
    @GetMapping("/admin/collaboration-requests") public List<RequestView> collaborations(Authentication auth) { return service.requests(true, true, auth.getName()); }
    @PostMapping("/admin/transfer-requests/{id}/approve") public RequestView approveTransfer(@PathVariable Long id, @Valid @RequestBody Review request, Authentication auth) { return service.review(id, false, AssignmentRequest.Status.APPROVED, request, auth.getName()); }
    @PostMapping("/admin/transfer-requests/{id}/reject") public RequestView rejectTransfer(@PathVariable Long id, @Valid @RequestBody Review request, Authentication auth) { return service.review(id, false, AssignmentRequest.Status.REJECTED, request, auth.getName()); }
    @PostMapping("/admin/collaboration-requests/{id}/approve") public RequestView approveCollaboration(@PathVariable Long id, @Valid @RequestBody Review request, Authentication auth) { return service.review(id, true, AssignmentRequest.Status.APPROVED, request, auth.getName()); }
    @PostMapping("/admin/collaboration-requests/{id}/reject") public RequestView rejectCollaboration(@PathVariable Long id, @Valid @RequestBody Review request, Authentication auth) { return service.review(id, true, AssignmentRequest.Status.REJECTED, request, auth.getName()); }
    @PostMapping("/technician/transfer-requests/{id}/cancel") public RequestView cancelTransfer(@PathVariable Long id, @Valid @RequestBody Review request, Authentication auth) { return service.review(id, false, AssignmentRequest.Status.CANCELLED, request, auth.getName()); }
    @PostMapping("/technician/collaboration-requests/{id}/cancel") public RequestView cancelCollaboration(@PathVariable Long id, @Valid @RequestBody Review request, Authentication auth) { return service.review(id, true, AssignmentRequest.Status.CANCELLED, request, auth.getName()); }
}
