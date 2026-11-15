package com.bits.itsm.notification;

import com.bits.itsm.event.EventType;
import com.bits.itsm.event.IncidentEvent;
import com.bits.itsm.incident.Incident.Priority;
import com.bits.itsm.incident.IncidentStatus;
import com.bits.itsm.testsupport.TestData.FakeLookup;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static com.bits.itsm.testsupport.TestData.ADMIN;
import static com.bits.itsm.testsupport.TestData.REPORTER;
import static com.bits.itsm.testsupport.TestData.Snap;
import static com.bits.itsm.testsupport.TestData.T0;
import static com.bits.itsm.testsupport.TestData.TECH;
import static com.bits.itsm.testsupport.TestData.event;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class NotificationServiceTest {

    private InAppChannel inApp;
    private EmailChannel email;
    private NotificationService service;

    @BeforeEach
    void setUp() {
        var incident = Snap.of(1, Priority.P1, IncidentStatus.ASSIGNED, T0).tech(TECH).build();
        inApp = new InAppChannel();
        email = new EmailChannel();
        service = new NotificationService(new FakeLookup().with(incident), List.of(inApp, email));
    }

    @Test
    void everyChannelReceivesTheNotification() {
        service.onEvent(event(EventType.INCIDENT_ASSIGNED, 1));
        assertEquals(1, inApp.getFor(REPORTER).size());
        assertEquals(1, inApp.getFor(TECH).size());
        assertEquals(2, email.getSent().size());
    }

    @Test
    void slaBreachGoesToTechnicianAndAdminNotReporter() {
        assertEquals(Set.of(TECH, ADMIN), service.recipientsFor(event(EventType.SLA_BREACHED, 1)));
    }

    @Test
    void newIncidentNotifiesReporterAndAdmin() {
        assertEquals(Set.of(REPORTER, ADMIN), service.recipientsFor(event(EventType.INCIDENT_CREATED, 1)));
    }

    @Test
    void theUserWhoCausedTheEventIsNotNotified() {
        IncidentEvent byReporter = IncidentEvent.of(EventType.INCIDENT_CREATED, 1L, REPORTER, "CREATED", null, null, "x");
        assertEquals(Set.of(ADMIN), service.recipientsFor(byReporter));
    }

    @Test
    void everyAdminIsNotifiedOfDuplicates() {
        var lookup = new FakeLookup().with(Snap.of(1, Priority.P1, IncidentStatus.NEW, T0).build()).admins(301L, 302L);
        NotificationService s = new NotificationService(lookup, List.of(inApp));
        assertEquals(Set.of(301L, 302L), s.recipientsFor(event(EventType.DUPLICATE_DETECTED, 1)));
    }

    @Test
    void unassignedIncidentSkipsTheMissingTechnician() {
        var unassigned = Snap.of(2, Priority.P3, IncidentStatus.NEW, T0).build();
        NotificationService s = new NotificationService(new FakeLookup().with(unassigned), List.of(inApp));
        assertEquals(Set.of(ADMIN), s.recipientsFor(event(EventType.SLA_WARNING, 2)));
    }

    @Test
    void unknownIncidentStillNotifiesAdminForDuplicates() {
        assertEquals(Set.of(ADMIN), service.recipientsFor(event(EventType.DUPLICATE_DETECTED, 404)));
    }

    @Test
    void markReadFlipsTheReadFlagAndRejectsUnknownOrForeignIds() {
        service.onEvent(event(EventType.INCIDENT_RESOLVED, 1));
        InAppNotification n = inApp.getFor(REPORTER).get(0);
        assertFalse(n.read());
        assertFalse(inApp.markRead(n.id(), TECH));
        assertTrue(inApp.markRead(n.id(), REPORTER));
        assertTrue(inApp.getFor(REPORTER).get(0).read());
        assertFalse(inApp.markRead("NT-999999", REPORTER));
    }

    @Test
    void aFailingChannelDoesNotStopTheOthers() {
        NotificationChannel broken = new NotificationChannel() {
            public String name() { return "BROKEN"; }
            public void send(Notification n) { throw new IllegalStateException("down"); }
        };
        NotificationService s = new NotificationService(
                new FakeLookup().with(Snap.of(1, Priority.P1, IncidentStatus.NEW, T0).build()), List.of(broken, inApp));
        s.onEvent(event(EventType.INCIDENT_CREATED, 1));
        assertEquals(1, inApp.getFor(REPORTER).size());
    }

    @Test
    void factoryBuildsReadableMessages() {
        Notification n = NotificationFactory.create(event(EventType.INCIDENT_CLOSED, 7), REPORTER);
        assertEquals("Incident closed", n.title());
        assertTrue(n.message().contains("INC-7"));
        assertEquals(REPORTER, n.recipientId());
    }
}
