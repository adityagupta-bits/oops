package com.bits.itsm.assignment;

import com.bits.itsm.incident.Incident;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AssignmentQueueTest {
    Incident incident(long id, Incident.Priority priority, String deadline) {
        var i = mock(Incident.class);
        when(i.getId()).thenReturn(id);
        when(i.getPriority()).thenReturn(priority);
        when(i.getResolutionDeadline()).thenReturn(deadline == null ? null : Instant.parse(deadline));
        when(i.getCreatedAt()).thenReturn(Instant.parse("2026-01-01T00:00:00Z"));
        return i;
    }
    @Test void priorityThenDeadlineThenStableTieBreak() {
        var critical = incident(4, Incident.Priority.P1, null);
        var early = incident(2, Incident.Priority.P2, "2026-01-01T01:00:00Z");
        var late = incident(1, Incident.Priority.P2, "2026-01-01T02:00:00Z");
        var missing = incident(3, Incident.Priority.P2, null);
        assertEquals(List.of(critical, early, late, missing), List.of(missing,late,early,critical).stream().sorted(AutomaticAssignmentWorker.QUEUE_ORDER).toList());
    }
}
