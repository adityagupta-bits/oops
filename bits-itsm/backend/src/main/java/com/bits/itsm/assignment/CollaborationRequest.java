package com.bits.itsm.assignment;

import com.bits.itsm.incident.Incident;
import com.bits.itsm.user.*;
import jakarta.persistence.*;

@Entity @Table(name = "collaboration_requests")
public class CollaborationRequest extends AssignmentRequest {
    @Enumerated(EnumType.STRING) @Column(nullable = false) private TechnicianSkill requiredSkill;
    @Column(nullable = false, length = 2000) private String reason;
    @Column(nullable = false, length = 2000) private String responsibility;
    protected CollaborationRequest() { }
    public CollaborationRequest(Incident incident, Technician target, TechnicianSkill skill, String reason, String responsibility) {
        super(incident, target); this.requiredSkill = java.util.Objects.requireNonNull(skill); this.reason = text(reason); this.responsibility = text(responsibility);
    }
    public TechnicianSkill getRequiredSkill() { return requiredSkill; }
    public String getReason() { return reason; }
    public String getResponsibility() { return responsibility; }
}
