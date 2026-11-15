package com.bits.itsm.audit;

import java.time.Instant;

/** One line of the event log. actorId is null for actions taken by the system (SLA, escalation, duplicates). */
public record AuditRecord(String id, Instant timestamp, Long actorId, Long incidentId,
                          String action, String previous, String next, String description) {
}
