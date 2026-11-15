package com.bits.itsm.sla;

import java.time.Instant;

/** SLA state of one incident at one moment. */
public record SlaSnapshot(Long incidentId, SlaStatus status,
                          Instant responseDeadline, Instant resolutionDeadline, Instant evaluatedAt) {
}
