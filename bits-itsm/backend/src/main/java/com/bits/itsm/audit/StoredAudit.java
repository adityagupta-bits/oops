package com.bits.itsm.audit;

import jakarta.persistence.*;
import java.time.Instant;

@Entity @Table(name = "audit_events", indexes = @Index(name = "audit_incident_idx", columnList = "incidentId,timestamp"))
public class StoredAudit {
    @Id private String id;
    @Column(nullable = false, updatable = false) private Instant timestamp;
    @Column(updatable = false) private Long actorId;
    @Column(updatable = false) private Long incidentId;
    @Column(nullable = false, updatable = false) private String action;
    @Column(updatable = false) private String previous;
    @Column(updatable = false) private String next;
    @Column(length = 5000, updatable = false) private String description;
    protected StoredAudit() { }
    public StoredAudit(AuditRecord record) {
        id = record.id(); timestamp = record.timestamp(); actorId = record.actorId(); incidentId = record.incidentId();
        action = record.action(); previous = record.previous(); next = record.next(); description = record.description();
    }
    public AuditRecord view() { return new AuditRecord(id, timestamp, actorId, incidentId, action, previous, next, description); }
}
