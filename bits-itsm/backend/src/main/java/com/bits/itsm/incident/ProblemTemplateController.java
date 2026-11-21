package com.bits.itsm.incident;

import java.util.List;
import java.util.Map;
import java.time.Instant;
import java.util.UUID;
import com.bits.itsm.audit.*;
import com.bits.itsm.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
public class ProblemTemplateController {
    private final JdbcTemplate jdbc;
    private final AuditStore audit;
    private final UserRepository users;
    private final CatalogService catalog;
    public ProblemTemplateController(JdbcTemplate jdbc, AuditStore audit, UserRepository users, CatalogService catalog) {
        this.jdbc=jdbc; this.audit=audit; this.users=users; this.catalog=catalog;
    }
    public record Template(@NotBlank @Size(max=100) String title, @NotBlank @Size(max=100) String category,
            @NotNull @Size(max=2000) String description, boolean enabled, @Min(0) int displayOrder,
            @NotNull @Size(max=2000) String keywords, String serviceCode) { }
    @GetMapping("/api/student/problem-templates")
    public List<Map<String,Object>> available() {
        return jdbc.queryForList("select id,title,category,description from problem_templates where enabled order by display_order,id");
    }
    @GetMapping("/api/admin/problem-templates")
    public List<Map<String,Object>> all() {
        return jdbc.queryForList("select id,title,category,description,enabled,display_order as \"displayOrder\",keywords,service_code as \"serviceCode\" from problem_templates order by display_order,id");
    }
    @PostMapping("/api/admin/problem-templates") @Transactional
    public Map<String,Long> add(@Valid @RequestBody Template t, Authentication auth) {
        validateService(t);
        Long id=jdbc.queryForObject("insert into problem_templates(title,category,description,enabled,display_order,keywords,service_code) values(?,?,?,?,?,?,?) returning id",Long.class,t.title(),t.category(),t.description(),t.enabled(),t.displayOrder(),t.keywords(),t.serviceCode());
        record(auth,id); return Map.of("id",id);
    }
    @PutMapping("/api/admin/problem-templates/{id}") @Transactional
    public Map<String,Long> edit(@PathVariable Long id,@Valid @RequestBody Template t,Authentication auth) {
        validateService(t);
        if(jdbc.update("update problem_templates set title=?,category=?,description=?,enabled=?,display_order=?,keywords=?,service_code=? where id=?",t.title(),t.category(),t.description(),t.enabled(),t.displayOrder(),t.keywords(),t.serviceCode(),id)!=1) throw new IllegalArgumentException("Template not found.");
        record(auth,id); return Map.of("id",id);
    }
    private void validateService(Template t) { if(t.serviceCode()!=null) catalog.get("SERVICE",t.serviceCode()); }
    private void record(Authentication auth,Long id) {
        audit.save(new AuditRecord("AUD-"+UUID.randomUUID(),Instant.now(),users.findByEmail(auth.getName()).orElseThrow().getId(),null,"PROBLEM_TEMPLATE_SAVED",null,id.toString(),"Administrator saved problem template "+id));
    }
}
