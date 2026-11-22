package com.bits.itsm.incident;
import com.bits.itsm.user.*;
import com.bits.itsm.escalation.*;
import com.bits.itsm.event.*;
import com.bits.itsm.sla.ScheduledEvents;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/admin/incidents/{id}/escalation")
public class ManualEscalationController {
 private final IncidentRepository incidents; private final UserRepository users;
 private final EscalationService escalation; private final ScheduledEvents events;
 public ManualEscalationController(IncidentRepository incidents,UserRepository users,EscalationService escalation,ScheduledEvents events) {
  this.incidents=incidents; this.users=users; this.escalation=escalation; this.events=events;
 }
 public record Request(@NotNull EscalationLevel level,@NotBlank @Size(min=5,max=2000) String reason) {}
 private User admin(Authentication auth) {
  return users.findByEmail(auth.getName()).filter(u -> u.isEnabled() && u.getRole()==Role.ADMIN)
   .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,"Administrator access required."));
 }
 @GetMapping public Map<String,Object> state(@PathVariable Long id,Authentication auth) {
  admin(auth); if(!incidents.existsById(id)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
  return Map.of("current",escalation.getRecord(id).map(EscalationRecord::level).orElse("Technician"),
   "levels",Arrays.stream(EscalationLevel.values()).filter(l -> l!=EscalationLevel.TECHNICIAN).map(Enum::name).toList());
 }
 @PostMapping @Transactional public Map<String,Object> escalate(@PathVariable Long id,@Valid @RequestBody Request request,Authentication auth) {
  var actor=admin(auth); var incident=incidents.findForUpdate(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
  incident.requireAssignableTeam();
  var current=escalation.getRecord(id).map(r -> Arrays.stream(EscalationLevel.values()).filter(l -> l.label().equals(r.level())).findFirst().orElseThrow()).orElse(EscalationLevel.TECHNICIAN);
  if(request.level().ordinal()<=current.ordinal()) throw new ResponseStatusException(HttpStatus.CONFLICT,"Select a higher escalation level.");
  String reason=request.reason().trim(); if(reason.length()<5) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Provide an escalation reason of at least five characters.");
  incident.record(actor,"MANUAL_ESCALATION",request.level().label()+": "+reason,InvestigationNote.Visibility.INTERNAL);
  incidents.flush();
  events.publishOnce(id+":MANUAL_ESCALATION:"+UUID.randomUUID(),new IncidentEvent(EventType.INCIDENT_ESCALATED,id,actor.getId(),"MANUAL_ESCALATION",current.label(),request.level().label(),reason,Instant.now()));
  return state(id,auth);
 }
}
