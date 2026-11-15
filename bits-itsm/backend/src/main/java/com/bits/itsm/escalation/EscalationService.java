package com.bits.itsm.escalation;

import com.bits.itsm.event.EventBus;
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
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Automatic escalation of critical incidents.
 * A P1 incident that is still unacknowledged after its response deadline moves up one level
 * (Technician -> Team Lead -> System Administrator -> IT Manager), then one more level every
 * itsm.escalation.step-minutes (also shrunk by itsm.sla.time-scale) until someone acknowledges it.
 * State is kept in memory.
 */
@Component
public class EscalationService {

    private final SlaCalculator calculator;
    private final EventBus bus;
    private final Duration step;
    private final Map<Long, EscalationRecord> records = new ConcurrentHashMap<>();
    private final Map<Long, EscalationLevel> levels = new ConcurrentHashMap<>();

    public EscalationService(SlaCalculator calculator, EventBus bus,
                             @Value("${itsm.escalation.step-minutes:5}") double stepMinutes) {
        this.calculator = calculator;
        this.bus = bus;
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

            EscalationLevel current = levels.getOrDefault(i.id(), EscalationLevel.TECHNICIAN);
            while (current.ordinal() < target.ordinal()) {
                EscalationLevel from = current;
                current = current.next();
                escalate(i, from, current, now);
            }
        }
    }

    private void escalate(IncidentSnapshot i, EscalationLevel from, EscalationLevel to, Instant now) {
        levels.put(i.id(), to);
        String reason = "P1 incident " + i.label() + " was not acknowledged within its response SLA; escalated from "
                + from.label() + " to " + to.label() + ".";
        records.put(i.id(), new EscalationRecord(i.id(), to.label(), reason, now));
        bus.publish(IncidentEvent.system(EventType.INCIDENT_ESCALATED, i.id(), from.label(), to.label(), reason, now));
    }

    public Optional<EscalationRecord> getRecord(Long incidentId) {
        return Optional.ofNullable(records.get(incidentId));
    }

    public List<EscalationRecord> getAll() {
        return List.copyOf(records.values());
    }
}
