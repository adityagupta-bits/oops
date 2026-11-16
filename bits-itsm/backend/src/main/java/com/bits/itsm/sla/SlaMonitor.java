package com.bits.itsm.sla;

import com.bits.itsm.escalation.EscalationService;
import com.bits.itsm.event.EventType;
import com.bits.itsm.event.IncidentEvent;
import com.bits.itsm.support.IncidentLookup;
import com.bits.itsm.support.IncidentSnapshot;
import com.bits.itsm.support.IncidentStates;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Objects;

/**
 * Background SLA watcher. Every few seconds it checks each unfinished incident and publishes
 * SLA_WARNING (80% of the time used) and SLA_BREACHED (deadline passed), once per incident and phase.
 * It then lets EscalationService handle unacknowledged P1 incidents.
 * Scheduled event claims are persisted, including across restarts.
 * Incidents whose priority is still PENDING are skipped until a priority is set.
 */
@Component
public class SlaMonitor {

    private static final Logger log = LoggerFactory.getLogger(SlaMonitor.class);

    private final IncidentLookup lookup;
    private final SlaCalculator calculator;
    private final ScheduledEvents events;
    private final EscalationService escalation;

    public SlaMonitor(IncidentLookup lookup, SlaCalculator calculator, ScheduledEvents events, EscalationService escalation) {
        this.lookup = lookup;
        this.calculator = calculator;
        this.events = events;
        this.escalation = escalation;
    }

    @Scheduled(fixedDelayString = "${itsm.sla.check-interval-ms:5000}")
    public void runScheduled() {
        try {
            check(Instant.now());
        } catch (RuntimeException ex) {
            log.error("SLA check failed", ex);
        }
    }

    /** One monitoring pass at the given time (public so tests can control the clock). */
    public void check(Instant now) {
        List<IncidentSnapshot> incidents = lookup.findAll();
        for (IncidentSnapshot incident : incidents) {
            try {
                checkIncident(incident, now);
            } catch (RuntimeException ex) {
                log.debug("Skipping SLA check for {}: {}", incident.label(), ex.getMessage());
            }
        }
        escalation.check(incidents, now);
    }

    private void checkIncident(IncidentSnapshot i, Instant now) {
        if (!IncidentStates.isAcknowledged(i)) {
            checkPhase(i, "RESPONSE", calculator.responseDeadline(i), now);
        } else if (i.acknowledgedAt() != null && i.acknowledgedAt().isAfter(calculator.responseDeadline(i))) {
            checkPhase(i, "RESPONSE", calculator.responseDeadline(i), i.acknowledgedAt());
        }
        if (!IncidentStates.isResolved(i)) {
            checkPhase(i, "RESOLUTION", calculator.resolutionDeadline(i), now);
        } else if (i.resolvedAt() != null && i.resolvedAt().isAfter(calculator.resolutionDeadline(i))) {
            checkPhase(i, "RESOLUTION", calculator.resolutionDeadline(i), i.resolvedAt());
        }
    }

    private void checkPhase(IncidentSnapshot i, String phase, Instant deadline, Instant now) {
        if (now.isAfter(deadline)) {
            events.publishOnce(i.id() + ":" + phase + ":BREACHED", IncidentEvent.system(EventType.SLA_BREACHED, i.id(),
                        SlaStatus.AT_RISK.name(), SlaStatus.BREACHED.name(),
                        "Incident " + i.label() + " has breached its " + phase.toLowerCase() + " SLA.", now));
        } else if (calculator.progress(i.createdAt(), deadline, now) >= SlaCalculator.WARNING_FRACTION) {
            events.publishOnce(i.id() + ":" + phase + ":WARNING", IncidentEvent.system(EventType.SLA_WARNING, i.id(),
                        SlaStatus.ON_TRACK.name(), SlaStatus.AT_RISK.name(),
                        "Incident " + i.label() + " is approaching its " + phase.toLowerCase() + " deadline.", now));
        }
    }

    /** SLA state of every prioritised incident right now. */
    public List<SlaSnapshot> snapshots(Instant now) {
        return lookup.findAll().stream()
                .map(i -> snapshot(i, now))
                .filter(Objects::nonNull)
                .toList();
    }

    /** Only the breached ones. */
    public List<SlaSnapshot> violations(Instant now) {
        return snapshots(now).stream().filter(s -> s.status() == SlaStatus.BREACHED).toList();
    }

    private SlaSnapshot snapshot(IncidentSnapshot i, Instant now) {
        try {
            return new SlaSnapshot(i.id(), calculator.evaluate(i, now),
                    calculator.responseDeadline(i), calculator.resolutionDeadline(i), now);
        } catch (RuntimeException ex) {
            return null;
        }
    }
}
