package com.bits.itsm.sla;

import com.bits.itsm.incident.Incident.Priority;
import com.bits.itsm.incident.IncidentStatus;
import com.bits.itsm.support.IncidentSnapshot;
import org.junit.jupiter.api.Test;

import java.time.Duration;

import static com.bits.itsm.testsupport.TestData.Snap;
import static com.bits.itsm.testsupport.TestData.T0;
import static com.bits.itsm.testsupport.TestData.snapshot;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SlaCalculatorTest {

    private final SlaCalculator calc = new SlaCalculator(1.0);

    @Test
    void targetsMatchTheProblemStatementTable() {
        assertEquals(Duration.ofMinutes(5), calc.responseTarget(Priority.P1));
        assertEquals(Duration.ofMinutes(30), calc.resolutionTarget(Priority.P1));
        assertEquals(Duration.ofMinutes(15), calc.responseTarget(Priority.P2));
        assertEquals(Duration.ofHours(2), calc.resolutionTarget(Priority.P2));
        assertEquals(Duration.ofHours(1), calc.responseTarget(Priority.P3));
        assertEquals(Duration.ofHours(8), calc.resolutionTarget(Priority.P3));
        assertEquals(Duration.ofHours(4), calc.responseTarget(Priority.P4));
        assertEquals(Duration.ofHours(24), calc.resolutionTarget(Priority.P4));
    }

    @Test
    void deadlinesAreCreationTimePlusTarget() {
        IncidentSnapshot i = snapshot(1, Priority.P1, IncidentStatus.NEW, T0);
        assertEquals(T0.plusSeconds(5 * 60), calc.responseDeadline(i));
        assertEquals(T0.plusSeconds(30 * 60), calc.resolutionDeadline(i));
    }

    @Test
    void timeScaleShrinksDurationsForDemos() {
        assertEquals(Duration.ofMillis(3000), new SlaCalculator(0.01).responseTarget(Priority.P1));
    }

    @Test
    void pendingPriorityHasNoSlaYet() {
        IncidentSnapshot i = snapshot(1, Priority.PENDING, IncidentStatus.NEW, T0);
        assertThrows(IllegalArgumentException.class, () -> calc.responseDeadline(i));
    }

    @Test
    void missingPriorityIsRejected() {
        IncidentSnapshot i = snapshot(1, null, IncidentStatus.NEW, T0);
        assertThrows(IllegalArgumentException.class, () -> calc.resolutionDeadline(i));
    }

    @Test
    void nonPositiveTimeScaleIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> new SlaCalculator(0));
    }

    @Test
    void freshIncidentIsOnTrack() {
        IncidentSnapshot i = snapshot(1, Priority.P1, IncidentStatus.NEW, T0);
        assertEquals(SlaStatus.ON_TRACK, calc.evaluate(i, T0.plusSeconds(60)));
    }

    @Test
    void becomesAtRiskAtEightyPercentOfResponseTime() {
        IncidentSnapshot i = snapshot(1, Priority.P1, IncidentStatus.ASSIGNED, T0);
        assertEquals(SlaStatus.AT_RISK, calc.evaluate(i, T0.plusSeconds(4 * 60)));
    }

    @Test
    void exactlyAtDeadlineIsNotYetBreached() {
        IncidentSnapshot i = snapshot(1, Priority.P1, IncidentStatus.ASSIGNED, T0);
        assertEquals(SlaStatus.AT_RISK, calc.evaluate(i, T0.plusSeconds(5 * 60)));
    }

    @Test
    void oneMillisecondAfterDeadlineIsBreached() {
        IncidentSnapshot i = snapshot(1, Priority.P1, IncidentStatus.ASSIGNED, T0);
        assertEquals(SlaStatus.BREACHED, calc.evaluate(i, T0.plusSeconds(5 * 60).plusMillis(1)));
    }

    @Test
    void acknowledgedInTimeThenResolvedInTimeIsMet() {
        IncidentSnapshot i = Snap.of(1, Priority.P1, IncidentStatus.RESOLVED, T0)
                .ack(T0.plusSeconds(3 * 60)).resolved(T0.plusSeconds(20 * 60)).build();
        assertEquals(SlaStatus.MET, calc.evaluate(i, T0.plusSeconds(5 * 3600)));
    }

    @Test
    void resolvedAfterResolutionDeadlineIsBreached() {
        IncidentSnapshot i = Snap.of(1, Priority.P1, IncidentStatus.RESOLVED, T0)
                .ack(T0.plusSeconds(3 * 60)).resolved(T0.plusSeconds(45 * 60)).build();
        assertEquals(SlaStatus.BREACHED, calc.evaluate(i, T0.plusSeconds(5 * 3600)));
    }

    @Test
    void acknowledgedIncidentStillRunsTheResolutionClock() {
        IncidentSnapshot i = Snap.of(1, Priority.P1, IncidentStatus.IN_PROGRESS, T0).ack(T0.plusSeconds(120)).build();
        assertEquals(SlaStatus.AT_RISK, calc.evaluate(i, T0.plusSeconds(25 * 60)));
        assertEquals(SlaStatus.BREACHED, calc.evaluate(i, T0.plusSeconds(31 * 60)));
    }
}
