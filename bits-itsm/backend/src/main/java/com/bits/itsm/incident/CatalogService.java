package com.bits.itsm.incident;

import jakarta.persistence.EntityManager;
import java.util.List;
import org.springframework.boot.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly = true)
public class CatalogService implements ApplicationRunner {
    private final EntityManager em;
    private final JdbcTemplate jdbc;
    public CatalogService(EntityManager em, JdbcTemplate jdbc) { this.em = em; this.jdbc = jdbc; }
    @Override @Transactional public void run(ApplicationArguments args) {
        for (var category : Incident.Category.values()) initialize("CATEGORY", category.name(), category.name());
        for (var service : Incident.ItService.values()) initialize("SERVICE", service.name(), service.getLabel());
    }
    private void initialize(String kind, String code, String label) {
        // New services stay disabled until an admin chooses their criticality.
        jdbc.update("insert into catalog_entries(id, kind, code, label, enabled, criticality) values (?, ?, ?, ?, ?, null) on conflict (id) do nothing", kind + ":" + code, kind, code, label, !"SERVICE".equals(kind));
    }
    public List<CatalogEntry> all() { return em.createQuery("select c from CatalogEntry c order by c.kind, c.label", CatalogEntry.class).getResultList(); }
    public CatalogEntry get(String kind, String code) {
        CatalogEntry entry = em.find(CatalogEntry.class, kind + ":" + code);
        if (entry == null) throw new IllegalArgumentException("Unknown catalog entry.");
        return entry;
    }
    public void requireEnabled(String kind, String code) {
        if (!get(kind, code).isEnabled()) throw new IllegalArgumentException("This catalog entry is disabled for new incidents.");
    }
    @Transactional public CatalogEntry update(String kind, String code, String label, boolean enabled, Incident.Level criticality) {
        return update(kind, code, label, enabled, criticality, get(kind, code).getKeywords());
    }
    @Transactional public CatalogEntry update(String kind, String code, String label, boolean enabled, Incident.Level criticality, String keywords) {
        CatalogEntry entry = get(kind, code); entry.update(label, enabled, criticality, keywords); return entry;
    }
}
