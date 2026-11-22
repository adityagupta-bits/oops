package com.bits.itsm.assignment;

import com.bits.itsm.incident.*;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/** Retries classified incidents when technician capacity becomes available. */
@Component
@ConditionalOnProperty(name="bitsolve.assignment.automatic-enabled", havingValue="true", matchIfMissing=true)
public class AutomaticAssignmentWorker {
    static final java.util.Comparator<Incident> QUEUE_ORDER = java.util.Comparator
        .comparing(Incident::getPriority)
        .thenComparing(Incident::getResolutionDeadline, java.util.Comparator.nullsLast(java.util.Comparator.naturalOrder()))
        .thenComparing(Incident::getCreatedAt)
        .thenComparing(Incident::getId);
    private final IncidentRepository incidents;
    private final AssignmentService assignments;
    public AutomaticAssignmentWorker(IncidentRepository incidents, AssignmentService assignments) {
        this.incidents=incidents; this.assignments=assignments;
    }
    @Scheduled(initialDelayString="${bitsolve.assignment.initial-delay-ms:30000}", fixedDelayString="${bitsolve.assignment.poll-ms:5000}")
    public void assignPending() {
        var pending = incidents.findByStatusAndAssignedTechnicianIsNullOrderByPriorityAscCreatedAtAsc(IncidentStatus.CLASSIFIED)
            .stream().filter(i -> i.getPriority() != null && i.getPriority() != Incident.Priority.PENDING && !i.isNeedsClassificationReview())
            .sorted(QUEUE_ORDER).toList();
        for (var incident : pending) {
            try { assignments.assignPending(incident.getId()); }
            catch (RuntimeException error) {
                org.slf4j.LoggerFactory.getLogger(getClass()).warn("Automatic assignment deferred for incident {}: {}", incident.getId(), error.getClass().getSimpleName());
            }
        }
    }
}
