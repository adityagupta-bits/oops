package com.bits.itsm.event;

import com.bits.itsm.audit.AuditLogger;
import com.bits.itsm.audit.AuditRecord;
import com.bits.itsm.audit.InMemoryAuditStore;
import com.bits.itsm.testsupport.TestData.Recorder;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static com.bits.itsm.testsupport.TestData.busWith;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EventBusAuditTest {

    @Test
    void everyObserverReceivesEveryEvent() {
        Recorder a = new Recorder();
        Recorder b = new Recorder();
        busWith(a, b).publish(IncidentEvent.of(EventType.INCIDENT_CREATED, 1L, 5L, "CREATED", null, "NEW", "created"));
        assertEquals(1, a.events.size());
        assertEquals(1, b.events.size());
    }

    @Test
    void aFailingObserverDoesNotBlockTheOthers() {
        Recorder good = new Recorder();
        IncidentObserver bad = e -> {
            throw new IllegalStateException("boom");
        };
        assertThrows(IllegalStateException.class, () -> busWith(bad, good).publish(IncidentEvent.of(EventType.INCIDENT_CREATED, 1L, 5L, null, null, null, "x")));
        assertEquals(1, good.events.size());
    }

    @Test
    void eventRequiresTypeAndIncidentId() {
        assertThrows(NullPointerException.class, () -> IncidentEvent.of(null, 1L, 5L, null, null, null, "x"));
        assertThrows(NullPointerException.class, () -> IncidentEvent.of(EventType.INCIDENT_CREATED, null, 5L, null, null, null, "x"));
    }

    @Test
    void systemEventsHaveNoActor() {
        IncidentEvent e = IncidentEvent.system(EventType.SLA_WARNING, 1L, null, null, "x", Instant.now());
        assertNull(e.actorId());
    }

    @Test
    void auditRecordKeepsAllFieldsOfTheEvent() {
        AuditLogger audit = new AuditLogger(new InMemoryAuditStore());
        Instant t = Instant.parse("2026-11-14T10:05:00Z");
        audit.onEvent(new IncidentEvent(EventType.INCIDENT_ACKNOWLEDGED, 1L, 7L, "ACKNOWLEDGED", "ASSIGNED", "ACKNOWLEDGED", "ack", t));
        AuditRecord r = audit.getAll().get(0);
        org.junit.jupiter.api.Assertions.assertTrue(r.id().startsWith("AUD-"));
        assertEquals("ACKNOWLEDGED", r.action());
        assertEquals(Long.valueOf(7), r.actorId());
        assertEquals("ASSIGNED", r.previous());
        assertEquals("ACKNOWLEDGED", r.next());
        assertEquals(t, r.timestamp());
    }

    @Test
    void auditActionFallsBackToTheEventLabel() {
        AuditLogger audit = new AuditLogger(new InMemoryAuditStore());
        audit.onEvent(IncidentEvent.system(EventType.SLA_BREACHED, 1L, null, null, "late", Instant.now()));
        assertEquals("SLA Breached", audit.getAll().get(0).action());
    }

    @Test
    void auditHistoryIsPerIncidentAndNewestFirst() {
        AuditLogger audit = new AuditLogger(new InMemoryAuditStore());
        Instant t = Instant.parse("2026-11-14T10:00:00Z");
        audit.onEvent(new IncidentEvent(EventType.INCIDENT_CREATED, 1L, 5L, "CREATED", null, "NEW", "c", t));
        audit.onEvent(new IncidentEvent(EventType.INCIDENT_CREATED, 2L, 5L, "CREATED", null, "NEW", "c", t.plusSeconds(60)));
        audit.onEvent(new IncidentEvent(EventType.INCIDENT_ASSIGNED, 1L, null, "ASSIGNED", "NEW", "ASSIGNED", "a", t.plusSeconds(120)));
        List<AuditRecord> history = audit.getByIncident(1L);
        assertEquals(2, history.size());
        assertEquals("ASSIGNED", history.get(0).action());
        assertEquals(3, audit.getAll().size());
    }

    @Test
    void publisherMapsHistoryActionNamesToEventTypes() {
        assertEquals(EventType.INCIDENT_CREATED, IncidentEventPublisher.typeFor("CREATED"));
        assertEquals(EventType.INCIDENT_ASSIGNED, IncidentEventPublisher.typeFor("AUTO_ASSIGNED"));
        assertEquals(EventType.INCIDENT_RESOLVED, IncidentEventPublisher.typeFor("RESOLVED"));
        assertEquals(EventType.INCIDENT_UPDATED, IncidentEventPublisher.typeFor("INFORMATION_REQUESTED"));
        assertEquals(EventType.INCIDENT_UPDATED, IncidentEventPublisher.typeFor(null));
    }

    @Test
    void publisherSendsTheEventThroughTheBus() {
        Recorder recorder = new Recorder();
        new IncidentEventPublisher(busWith(recorder)).publish(4L, 9L, "CLOSED", "closed it");
        IncidentEvent e = recorder.events.get(0);
        assertEquals(EventType.INCIDENT_CLOSED, e.type());
        assertEquals(Long.valueOf(4), e.incidentId());
        assertEquals(Long.valueOf(9), e.actorId());
        assertEquals("CLOSED", e.action());
    }
}
