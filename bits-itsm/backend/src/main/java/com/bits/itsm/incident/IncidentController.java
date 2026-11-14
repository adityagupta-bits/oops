package com.bits.itsm.incident;

import java.util.List;
import com.bits.itsm.incident.IncidentData.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {
    private final IncidentService service;
    public IncidentController(IncidentService service) { this.service = service; }
    @GetMapping("/options") public Options options(Authentication auth) { return service.options(auth.getName()); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public View create(@Valid @RequestBody Create request, Authentication auth) { return service.create(request, auth.getName()); }
    @GetMapping({"", "/my"})
    public List<View> list(Authentication auth, jakarta.servlet.http.HttpServletRequest request,
            @RequestParam(required = false) String search, @RequestParam(required = false) IncidentStatus status,
            @RequestParam(required = false) Incident.Category category, @RequestParam(required = false) Incident.Priority priority) {
        return service.list(auth.getName(), request.getRequestURI().endsWith("/my"), search, status, category, priority);
    }
    @GetMapping("/{id}") public View get(@PathVariable Long id, Authentication auth) { return service.get(id, auth.getName()); }
    @PostMapping("/{id}/classify") public View classify(@PathVariable Long id, @Valid @RequestBody Classification request, Authentication auth) { return service.classify(id, request, auth.getName()); }
    @PostMapping("/{id}/acknowledge") public View acknowledge(@PathVariable Long id, Authentication auth) { return service.acknowledge(id, auth.getName()); }
    @PostMapping("/{id}/start") public View start(@PathVariable Long id, Authentication auth) { return service.start(id, auth.getName()); }
    @PostMapping("/{id}/notes") public View note(@PathVariable Long id, @Valid @RequestBody Note request, Authentication auth) { return service.note(id, request, auth.getName()); }
    @PostMapping("/{id}/information") public View information(@PathVariable Long id, @Valid @RequestBody Message request, Authentication auth) { return service.information(id, request, auth.getName(), false); }
    @PostMapping("/{id}/reply") public View reply(@PathVariable Long id, @Valid @RequestBody Message request, Authentication auth) { return service.information(id, request, auth.getName(), true); }
    @PostMapping("/{id}/resolve") public View resolve(@PathVariable Long id, @Valid @RequestBody Resolution request, Authentication auth) { return service.resolve(id, request, auth.getName()); }
    @PostMapping("/{id}/verify") public View verify(@PathVariable Long id, @Valid @RequestBody Verification request, Authentication auth) { return service.verify(id, request, auth.getName()); }
    @PostMapping("/{id}/close") public View close(@PathVariable Long id, Authentication auth) { return service.close(id, auth.getName()); }
    @PostMapping("/{id}/feedback") public View feedback(@PathVariable Long id, @Valid @RequestBody Feedback request, Authentication auth) { return service.feedback(id, request, auth.getName()); }

}
