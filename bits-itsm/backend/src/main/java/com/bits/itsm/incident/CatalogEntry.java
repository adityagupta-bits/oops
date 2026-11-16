package com.bits.itsm.incident;

import jakarta.persistence.*;

@Entity @Table(name = "catalog_entries")
public class CatalogEntry {
    @Id private String id;
    @Column(nullable = false) private String kind;
    @Column(nullable = false) private String code;
    @Column(nullable = false, length = 100) private String label;
    @Column(nullable = false) private boolean enabled = true;
    @Enumerated(EnumType.STRING) private Incident.Level criticality;
    protected CatalogEntry() { }
    public String getId() { return id; }
    public String getKind() { return kind; }
    public String getCode() { return code; }
    public String getLabel() { return label; }
    public boolean isEnabled() { return enabled; }
    public Incident.Level getCriticality() { return criticality; }
    public void update(String label, boolean enabled, Incident.Level criticality) {
        if ("SERVICE".equals(kind) && enabled && criticality == null)
            throw new IllegalArgumentException("Configure business criticality before enabling this service.");
        this.label = Incident.text(label, 1, 100);
        this.enabled = enabled;
        this.criticality = criticality;
    }
}
