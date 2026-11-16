package com.bits.itsm.escalation;

import com.bits.itsm.sla.ScheduledEvents;
import com.bits.itsm.event.EventType;
import com.bits.itsm.event.IncidentEvent;
import com.bits.itsm.incident.Incident;
import com.bits.itsm.sla.SlaCalculator;
import com.bits.itsm.support.IncidentSnapshot;
import com.bits.itsm.support.IncidentStates;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/**
 * Automatic escalation of critical incidents.
 * A P1 incident that is still unacknowledged after its response deadline moves up one level
 * (Technician -> Team Lead -> System Administrator -> IT Manager), then one more level every
 * itsm.escalation.step-minutes (also shrunk by itsm.sla.time-scale) until someone acknowledges it.
 * Escalation steps are persisted and are not repeated after a restart.
 */
@Component
public class EscalationService {

    private final SlaCalculator calculator;
    private final ScheduledEvents events;
    private final Duration step;

    public EscalationService(SlaCalculator calculator, ScheduledEvents events,
                             @Value("${itsm.escalation.step-minutes:5}") double stepMinutes) {
        if (!Double.isFinite(stepMinutes) || stepMinutes <= 0) {
            throw new IllegalArgumentException("Escalation interval must be positive and finite.");
        }
        this.calculator = calculator;
        this.events = events;
        this.step = calculator.scaled(Duration.ofMillis(Math.round(stepMinutes * 60_000)));
    }

    public void check(Collection<IncidentSnapshot> incidents, Instant now) {
        for (IncidentSnapshot i : incidents) {
            if (i.priority() != Incident.Priority.P1 || IncidentStates.isAcknowledged(i) || IncidentStates.isResolved(i)) {
                continue;
            }
            Instant deadline = calculator.responseDeadline(i);
            if (!now.isAfter(deadline)) {
                continue;
            }
            long stepsPast = Duration.between(deadline, now).toMillis() / step.toMillis();
            int targetIndex = (int) Math.min(1 + stepsPast, EscalationLevel.values().length - 1);
            EscalationLevel target = EscalationLevel.values()[targetIndex];

            EscalationLevel current = EscalationLevel.TECHNICIAN;
            while (current.ordinal() < target.ordinal()) {
                EscalationLevel from = current;
                current = current.next();
                escalate(i, from, current, now);
            }
        }
    }

    private void escalate(IncidentSnapshot i, EscalationLevel from, EscalationLevel to, Instant now) {
        String reason = "P1 incident " + i.label() + " was not acknowledged within its response SLA; escalated from "
                + from.label() + " to " + to.label() + ".";
        events.publishOnce(i.id() + ":ESCALATION:" + to.ordinal(), IncidentEvent.system(EventType.INCIDENT_ESCALATED, i.id(), from.label(), to.label(), reason, now));
    }

    public Optional<EscalationRecord> getRecord(Long incidentId) {
        return getAll().stream().filter(record -> record.incidentId().equals(incidentId)).findFirst();
    }

    public List<EscalationRecord> getAll() {
        return events.escalations();
    }
}
