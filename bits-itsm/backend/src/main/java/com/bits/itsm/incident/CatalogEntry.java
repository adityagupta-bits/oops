package com.bits.itsm.incident;

import jakarta.persistence.*;

@Entity @Table(name = "catalog_entries")
public class CatalogEntry {
    @Id private String id;
    @Column(nullable = false) private String kind;
    @Column(nullable = false) private String code;
    @Column(nullable = false, length = 100) private String label;
    @Column(nullable = false) private boolean enabled = true;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Incident.Level criticality = Incident.Level.MEDIUM;
    protected CatalogEntry() { }
    public String getId() { return id; }
    public String getKind() { return kind; }
    public String getCode() { return code; }
    public String getLabel() { return label; }
    public boolean isEnabled() { return enabled; }
    public Incident.Level getCriticality() { return criticality; }
    public void update(String label, boolean enabled, Incident.Level criticality) {
        this.label = Incident.text(label, 1, 100);
        this.enabled = enabled;
        this.criticality = java.util.Objects.requireNonNull(criticality);
    }
}
