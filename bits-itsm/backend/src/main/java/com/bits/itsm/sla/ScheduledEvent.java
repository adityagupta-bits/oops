package com.bits.itsm.sla;

import jakarta.persistence.*;
import java.time.Instant;

/** A durable claim prevents a scheduled event repeating after a restart. */
@Entity @Table(name = "scheduled_events")
public class ScheduledEvent {
    @Id private String id;
    private Long incidentId;
    private String type;
    private String nextLevel;
    @Column(length = 5000) private String description;
    private Instant occurredAt;
    protected ScheduledEvent() { }
}
