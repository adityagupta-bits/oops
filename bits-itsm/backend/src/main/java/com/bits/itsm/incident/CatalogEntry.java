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
    @Column(length = 2000) private String keywords;
    @Enumerated(EnumType.STRING) @Column(length=40) private com.bits.itsm.user.TechnicianSkill requiredSkill;
    public com.bits.itsm.user.TechnicianSkill getRequiredSkill() { return requiredSkill; }
    public void setRequiredSkill(com.bits.itsm.user.TechnicianSkill skill) { requiredSkill=skill; }
    public static CatalogEntry category(String code,String label,String keywords,boolean enabled,com.bits.itsm.user.TechnicianSkill skill) {
        var entry=new CatalogEntry(); entry.kind="CATEGORY"; entry.code=new ServiceCode(code).value(); entry.id="CATEGORY:"+entry.code;
        entry.update(label,enabled,null,keywords); entry.requiredSkill=skill; return entry;
    }

    protected CatalogEntry() { }
    @Column(length=2000) private String description;
    public String getDescription() { return description; }
    public void setDescription(String value) { description = Incident.text(value, 1, 2000); }
    public static CatalogEntry service(String code, String label, boolean enabled, Incident.Level criticality, String keywords) {
        var entry = new CatalogEntry();
        entry.code = new ServiceCode(code).value();
        entry.kind = "SERVICE";
        entry.id = "SERVICE:" + entry.code;
        entry.update(label, enabled, criticality, keywords);
        return entry;
    }
    public String getId() { return id; }
    public String getKind() { return kind; }
    public String getCode() { return code; }
    public String getLabel() { return label; }
    public boolean isEnabled() { return enabled; }
    public Incident.Level getCriticality() { return criticality; }
    public String getKeywords() { return keywords; }

    public void update(String label, boolean enabled, Incident.Level criticality) {
        update(label, enabled, criticality, this.keywords);
    }

    public void update(String label, boolean enabled, Incident.Level criticality, String keywords) {
        if (keywords != null && keywords.length() > 2000)
            throw new IllegalArgumentException("Classification keywords must not exceed 2000 characters.");
        if ("SERVICE".equals(kind) && enabled && criticality == null)
            throw new IllegalArgumentException("Configure business criticality before enabling this service.");
        this.label = Incident.text(label, 1, 100);
        this.enabled = enabled;
        this.criticality = criticality;
        this.keywords = keywords != null ? keywords.trim() : null;
    }
}
