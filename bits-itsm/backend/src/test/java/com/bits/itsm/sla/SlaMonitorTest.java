package com.bits.itsm.sla;

import com.bits.itsm.escalation.EscalationService;
import com.bits.itsm.event.EventBus;
import com.bits.itsm.event.EventType;
import com.bits.itsm.incident.Incident.Priority;
import com.bits.itsm.incident.IncidentStatus;
import com.bits.itsm.testsupport.TestData.FakeLookup;
import com.bits.itsm.testsupport.TestData.Recorder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static com.bits.itsm.testsupport.TestData.T0;
import static com.bits.itsm.testsupport.TestData.busWith;
import static com.bits.itsm.testsupport.TestData.count;
import static com.bits.itsm.testsupport.TestData.snapshot;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SlaMonitorTest {

    private final SlaCalculator calc = new SlaCalculator(1.0);
    private Recorder recorder;
    private FakeLookup lookup;
    private SlaMonitor monitor;

    @BeforeEach
    void setUp() {
        recorder = new Recorder();
        lookup = new FakeLookup();
        EventBus bus = busWith(recorder);
        monitor = new SlaMonitor(lookup, calc, bus, new EscalationService(calc, bus, 5));
    }

    @Test
    void warnsOnceWhenResponseDeadlineIsNear() {
        lookup.with(snapshot(1, Priority.P2, IncidentStatus.ASSIGNED, T0));
        monitor.check(T0.plusSeconds(13 * 60)); // 13 of 15 minutes = 87%
        monitor.check(T0.plusSeconds(14 * 60));
        assertEquals(1, count(recorder, EventType.SLA_WARNING));
        assertEquals(0, count(recorder, EventType.SLA_BREACHED));
    }

    @Test
    void recordsResponseBreachOnlyOnce() {
        lookup.with(snapshot(1, Priority.P2, IncidentStatus.ASSIGNED, T0));
        monitor.check(T0.plusSeconds(16 * 60));
        monitor.check(T0.plusSeconds(17 * 60));
        assertEquals(1, count(recorder, EventType.SLA_BREACHED));
    }

    @Test
    void acknowledgedIncidentHasNoResponseBreach() {
        lookup.with(snapshot(1, Priority.P2, IncidentStatus.ACKNOWLEDGED, T0));
        monitor.check(T0.plusSeconds(20 * 60));
        assertEquals(0, count(recorder, EventType.SLA_BREACHED));
    }

    @Test
    void resolutionDeadlineIsMonitoredAfterAcknowledgement() {
        lookup.with(snapshot(1, Priority.P2, IncidentStatus.IN_PROGRESS, T0));
        monitor.check(T0.plusSeconds(121 * 60));
        assertEquals(1, count(recorder, EventType.SLA_BREACHED));
        assertTrue(recorder.events.get(0).description().contains("resolution"));
    }

    @Test
    void closedIncidentsAreIgnored() {
        lookup.with(snapshot(1, Priority.P1, IncidentStatus.CLOSED, T0));
        monitor.check(T0.plusSeconds(3 * 86400));
        assertEquals(0, recorder.events.size());
    }

    @Test
    void incidentsStillPendingPriorityAreSkippedWithoutStoppingOthers() {
        lookup.with(snapshot(1, Priority.PENDING, IncidentStatus.NEW, T0),
                snapshot(2, Priority.P2, IncidentStatus.ASSIGNED, T0));
        monitor.check(T0.plusSeconds(16 * 60));
        assertEquals(1, count(recorder, EventType.SLA_BREACHED));
        assertEquals(Long.valueOf(2), recorder.events.get(0).incidentId());
    }

    @Test
    void violationsListsOnlyBreachedIncidents() {
        lookup.with(snapshot(1, Priority.P1, IncidentStatus.ASSIGNED, T0),
                snapshot(2, Priority.P4, IncidentStatus.ASSIGNED, T0));
        var violations = monitor.violations(T0.plusSeconds(10 * 60));
        assertEquals(1, violations.size());
        assertEquals(Long.valueOf(1), violations.get(0).incidentId());
    }

    @Test
    void snapshotsLeaveOutUnprioritisedIncidents() {
        lookup.with(snapshot(1, Priority.PENDING, IncidentStatus.NEW, T0),
                snapshot(2, Priority.P3, IncidentStatus.NEW, T0));
        assertEquals(1, monitor.snapshots(T0).size());
    }
}
