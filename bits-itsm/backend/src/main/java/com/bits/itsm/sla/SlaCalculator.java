package com.bits.itsm.sla;

import com.bits.itsm.incident.Incident;
import com.bits.itsm.support.IncidentSnapshot;
import com.bits.itsm.support.IncidentStates;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * Pure SLA logic: targets per priority, deadlines, progress and status.
 * Targets follow the problem statement (P1 5m/30m, P2 15m/2h, P3 1h/8h, P4 4h/24h).
 * itsm.sla.time-scale shrinks every duration for demos (0.01 turns 30 minutes into 18 seconds).
 * Both clocks start at the incident's creation time. An incident whose priority is still PENDING has no SLA yet.
 */
@Component
public class SlaCalculator {

    /** Fraction of the allowed time after which an incident is considered AT_RISK. */
    public static final double WARNING_FRACTION = 0.8;

    private final double timeScale;

    public SlaCalculator(@Value("${itsm.sla.time-scale:1.0}") double timeScale) {
        if (timeScale <= 0) {
            throw new IllegalArgumentException("time-scale must be positive");
        }
        this.timeScale = timeScale;
    }

    public Duration responseTarget(Incident.Priority p) {
        return scaled(Duration.ofMinutes(switch (requirePriority(p)) {
            case P1 -> 5;
            case P2 -> 15;
            case P3 -> 60;
            case P4 -> 240;
            default -> throw new IllegalArgumentException("No SLA for priority " + p);
        }));
    }

    public Duration resolutionTarget(Incident.Priority p) {
        return scaled(Duration.ofMinutes(switch (requirePriority(p)) {
            case P1 -> 30;
            case P2 -> 120;
            case P3 -> 480;
            case P4 -> 1440;
            default -> throw new IllegalArgumentException("No SLA for priority " + p);
        }));
    }

    public Duration scaled(Duration d) {
        return Duration.ofMillis(Math.max(1, Math.round(d.toMillis() * timeScale)));
    }

    public Instant responseDeadline(IncidentSnapshot i) {
        return i.createdAt().plus(responseTarget(i.priority()));
    }

    public Instant resolutionDeadline(IncidentSnapshot i) {
        return i.createdAt().plus(resolutionTarget(i.priority()));
    }

    /** Fraction of the allowed time already used (0 = just started, 1 = deadline reached). */
    public double progress(Instant start, Instant deadline, Instant now) {
        long total = Duration.between(start, deadline).toMillis();
        if (total <= 0) {
            return 1.0;
        }
        long elapsed = Duration.between(start, now).toMillis();
        return Math.max(0.0, (double) elapsed / total);
    }

    /** Overall SLA status of one incident at the given time. A deadline is missed only when passed strictly. */
    public SlaStatus evaluate(IncidentSnapshot i, Instant now) {
        Instant created = i.createdAt();
        Instant responseDl = responseDeadline(i);
        Instant resolutionDl = resolutionDeadline(i);
        boolean acknowledged = IncidentStates.isAcknowledged(i);
        boolean resolved = IncidentStates.isResolved(i);

        boolean breached = false;
        boolean atRisk = false;

        if (acknowledged) {
            if (i.acknowledgedAt() != null && i.acknowledgedAt().isAfter(responseDl)) {
                breached = true;
            }
        } else if (now.isAfter(responseDl)) {
            breached = true;
        } else if (progress(created, responseDl, now) >= WARNING_FRACTION) {
            atRisk = true;
        }

        if (resolved) {
            if (i.resolvedAt() != null && i.resolvedAt().isAfter(resolutionDl)) {
                breached = true;
            }
        } else if (now.isAfter(resolutionDl)) {
            breached = true;
        } else if (progress(created, resolutionDl, now) >= WARNING_FRACTION) {
            atRisk = true;
        }

        if (breached) {
            return SlaStatus.BREACHED;
        }
        if (acknowledged && resolved) {
            return SlaStatus.MET;
        }
        return atRisk ? SlaStatus.AT_RISK : SlaStatus.ON_TRACK;
    }

    private static Incident.Priority requirePriority(Incident.Priority p) {
        if (p == null || p == Incident.Priority.PENDING) {
            throw new IllegalArgumentException("No SLA can be determined: incident has no priority yet");
        }
        return p;
    }
}
