package com.bits.itsm.escalation;

import java.time.Instant;

/** Current escalation state of an incident. */
public record EscalationRecord(Long incidentId, String level, String reason, Instant escalatedAt) {
}
