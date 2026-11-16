package com.bits.itsm.support;

import com.bits.itsm.incident.Incident;
import com.bits.itsm.incident.IncidentStatus;

import java.time.Instant;

/**
 * Plain read-only copy of the incident fields the services layer needs.
 * Taking a snapshot inside a transaction means SLA, escalation, duplicate detection and notifications
 * never touch lazy JPA relations (and can be unit-tested without a database).
 */
public record IncidentSnapshot(Long id, String title, String description,
                               Incident.Category category, Incident.ItService service,
                               Incident.Priority priority, IncidentStatus status,
                               Long reporterId, Long technicianId,
                               Instant createdAt, Instant acknowledgedAt, Instant resolvedAt,
                               Instant responseDeadline, Instant resolutionDeadline) {

    /** Display label such as INC-1004. */
    public String label() {
        return IncidentLabel.of(id);
    }
}
