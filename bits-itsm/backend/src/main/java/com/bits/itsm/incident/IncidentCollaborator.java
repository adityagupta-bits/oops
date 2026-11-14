package com.bits.itsm.incident;

import com.bits.itsm.user.Technician;
import jakarta.persistence.*;

@Entity @Table(name = "incident_collaborators", uniqueConstraints = @UniqueConstraint(columnNames = {"incident_id", "technician_id"}))
public class IncidentCollaborator {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "incident_id") private Incident incident;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "technician_id") private Technician technician;
    @Column(nullable = false, length = 2000) private String responsibility;
    protected IncidentCollaborator() { }
    IncidentCollaborator(Incident incident, Technician technician, String responsibility) {
        this.incident = incident; this.technician = technician; this.responsibility = Incident.text(responsibility, 1, 2000);
    }
    public Technician getTechnician() { return technician; }
    public String getResponsibility() { return responsibility; }
}
