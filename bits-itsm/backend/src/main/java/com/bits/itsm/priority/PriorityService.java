package com.bits.itsm.priority;

import com.bits.itsm.incident.*;
import com.bits.itsm.audit.*;
import com.bits.itsm.user.*;
import java.time.Instant;
import java.util.UUID;
import org.springframework.boot.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly = true)
public class PriorityService implements ApplicationRunner {
    private final PrioritySettingsRepository settings;
    private final JdbcTemplate jdbc;
    private final CatalogService catalog;
    private final AuditStore audit;
    private final UserRepository users;
    public PriorityService(PrioritySettingsRepository settings, JdbcTemplate jdbc, CatalogService catalog, AuditStore audit, UserRepository users) {
        this.settings = settings; this.jdbc = jdbc; this.catalog = catalog; this.audit = audit; this.users = users;
    }
    @Override @Transactional public void run(ApplicationArguments args) {
        jdbc.update("insert into priority_settings(id,strategy,impact_weight,urgency_weight,criticality_weight) values(1,'MULTIPLICATIVE',0.4,0.4,0.2) on conflict(id) do nothing");
    }
    public PrioritySettings current() { return settings.findById(1L).orElseThrow(() -> new IllegalStateException("Priority settings are missing.")); }
    public Incident.Level criticality(Incident.ItService service) {
        Incident.Level level = catalog.get("SERVICE", service.name()).getCriticality();
        if (level == null) throw new IllegalStateException("Configure business criticality for service " + service + " before calculating priority.");
        return level;
    }
    public Incident.Priority calculate(Incident incident, Incident.Level criticality) {
        return current().calculator().calculate(incident.getImpact(), incident.getUrgency(), criticality);
    }
    public PriorityController.PreviewResult preview(PriorityController.Preview request) {
        var level = criticality(request.affectedService());
        return new PriorityController.PreviewResult(request.configuration().complete(current().configuration()).calculator().calculate(request.impact(), request.urgency(), level), level);
    }
    @Transactional public PrioritySettings update(PriorityController.Configuration request, String email) {
        var actor = users.findByEmail(email).filter(u -> u.isEnabled() && u.getRole() == Role.ADMIN).orElseThrow(() -> new IllegalArgumentException("Administrator account required."));
        var configuration = settings.lock();
        String previous = configuration.configuration().toString();
        configuration.update(request.complete(configuration.configuration()));
        audit.save(new AuditRecord("AUD-" + UUID.randomUUID(), Instant.now(), actor.getId(), null, "PRIORITY_CONFIGURATION_CHANGED", null, null,
                "Before: " + previous + "\nAfter: " + configuration.configuration()));
        return configuration;
    }
}
