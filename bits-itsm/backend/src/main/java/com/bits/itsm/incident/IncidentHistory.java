package com.bits.itsm.incident;

import java.time.Instant;
import com.bits.itsm.user.User;
import jakarta.persistence.*;

// No update/delete operations: history is appended in the incident transaction.
@Entity @Table(name = "incident_history")
public class IncidentHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private Incident incident;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) private User actor;
    @Column(nullable = false, updatable = false) private String action;
    @Column(nullable = false, updatable = false, length = 4500) private String description;
    @Column(nullable = false, updatable = false) private Instant createdAt = Instant.now();
    @Enumerated(EnumType.STRING) @Column(nullable = false, updatable = false) private InvestigationNote.Visibility visibility;
    protected IncidentHistory() { }
    IncidentHistory(Incident incident, User actor, String action, String description, InvestigationNote.Visibility visibility) {
        this.incident = incident; this.actor = actor; this.action = action; this.description = description; this.visibility = visibility;
    }
    public Long getId() { return id; }
    public User getActor() { return actor; }
    public String getAction() { return action; }
    public String getDescription() { return description; }
    public Instant getCreatedAt() { return createdAt; }
    public InvestigationNote.Visibility getVisibility() { return visibility; }
}
