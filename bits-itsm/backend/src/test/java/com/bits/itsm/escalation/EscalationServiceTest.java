package com.bits.itsm.escalation;

import com.bits.itsm.event.EventType;
import com.bits.itsm.incident.Incident.Priority;
import com.bits.itsm.incident.IncidentStatus;
import com.bits.itsm.sla.SlaCalculator;
import com.bits.itsm.support.IncidentSnapshot;
import com.bits.itsm.testsupport.TestData.Recorder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.bits.itsm.testsupport.TestData.T0;
import static com.bits.itsm.testsupport.TestData.busWith;
import static com.bits.itsm.testsupport.TestData.count;
import static com.bits.itsm.testsupport.TestData.snapshot;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EscalationServiceTest {

    private Recorder recorder;
    private EscalationService service;

    @BeforeEach
    void setUp() {
        recorder = new Recorder();
        service = new EscalationService(new SlaCalculator(1.0), busWith(recorder), 5);
    }

    private static IncidentSnapshot p1(IncidentStatus status) {
        return snapshot(1, Priority.P1, status, T0);
    }

    @Test
    void noEscalationBeforeResponseDeadline() {
        service.check(List.of(p1(IncidentStatus.ASSIGNED)), T0.plusSeconds(5 * 60));
        assertEquals(0, recorder.events.size());
    }

    @Test
    void unacknowledgedP1GoesToTeamLeadAfterDeadline() {
        service.check(List.of(p1(IncidentStatus.ASSIGNED)), T0.plusSeconds(6 * 60));
        assertEquals(1, count(recorder, EventType.INCIDENT_ESCALATED));
        assertEquals("Team Lead", service.getRecord(1L).orElseThrow().level());
    }

    @Test
    void climbsTheWholeChainAndStopsAtItManager() {
        var incident = List.of(p1(IncidentStatus.ASSIGNED));
        service.check(incident, T0.plusSeconds(6 * 60));
        service.check(incident, T0.plusSeconds(11 * 60));
        service.check(incident, T0.plusSeconds(16 * 60));
        service.check(incident, T0.plusSeconds(60 * 60));
        assertEquals(3, count(recorder, EventType.INCIDENT_ESCALATED));
        assertEquals("IT Manager", service.getRecord(1L).orElseThrow().level());
    }

    @Test
    void sameLevelIsNotEscalatedTwice() {
        var incident = List.of(p1(IncidentStatus.ASSIGNED));
        service.check(incident, T0.plusSeconds(6 * 60));
        service.check(incident, T0.plusSeconds(7 * 60));
        assertEquals(1, count(recorder, EventType.INCIDENT_ESCALATED));
    }

    @Test
    void jumpingSeveralLevelsRecordsEachStepInTheAuditTrail() {
        service.check(List.of(p1(IncidentStatus.ASSIGNED)), T0.plusSeconds(30 * 60));
        assertEquals(3, count(recorder, EventType.INCIDENT_ESCALATED));
        assertEquals("Technician", recorder.events.get(0).previous());
        assertEquals("IT Manager", recorder.events.get(2).next());
    }

    @Test
    void acknowledgementStopsEscalation() {
        service.check(List.of(p1(IncidentStatus.ASSIGNED)), T0.plusSeconds(6 * 60));
        service.check(List.of(p1(IncidentStatus.ACKNOWLEDGED)), T0.plusSeconds(20 * 60));
        assertEquals(1, count(recorder, EventType.INCIDENT_ESCALATED));
    }

    @Test
    void onlyP1IncidentsEscalate() {
        service.check(List.of(snapshot(2, Priority.P2, IncidentStatus.ASSIGNED, T0)), T0.plusSeconds(3 * 3600));
        assertEquals(0, recorder.events.size());
        assertTrue(service.getRecord(2L).isEmpty());
    }

    @Test
    void escalationEventsAreSystemEvents() {
        service.check(List.of(p1(IncidentStatus.ASSIGNED)), T0.plusSeconds(6 * 60));
        assertTrue(recorder.events.get(0).actorId() == null);
    }
}
