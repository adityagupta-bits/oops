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

    private NotificationService service;

    @BeforeEach
    void setUp() {
        var incident = Snap.of(1, Priority.P1, IncidentStatus.ASSIGNED, T0).tech(TECH).build();
        var repository = org.mockito.Mockito.mock(NotificationDeliveryRepository.class);
        var saved = new java.util.ArrayList<NotificationDelivery>();
        org.mockito.Mockito.when(repository.save(org.mockito.ArgumentMatchers.any())).thenAnswer(call -> {
            NotificationDelivery delivery = call.getArgument(0); saved.add(delivery); return delivery;
        });
        org.mockito.Mockito.when(repository.findById(org.mockito.ArgumentMatchers.anyString())).thenAnswer(call -> saved.stream().filter(n -> n.getId().equals(call.getArgument(0))).findFirst());
        org.mockito.Mockito.when(repository.findByRecipientIdAndChannelOrderByCreatedAtDesc(org.mockito.ArgumentMatchers.anyLong(), org.mockito.ArgumentMatchers.anyString()))
                .thenAnswer(call -> saved.stream().filter(n -> n.getRecipientId().equals(call.getArgument(0)) && n.getChannel().equals(call.getArgument(1))).toList());
        org.mockito.Mockito.when(repository.findByChannelOrderByCreatedAtDesc("EMAIL")).thenAnswer(call -> saved.stream().filter(n -> n.getChannel().equals("EMAIL")).toList());
        var lookup = new FakeLookup().with(incident);
        inApp = new InAppChannel(repository, lookup);

        service = new NotificationService(lookup, List.of(inApp));
    }

    @Test
    void everyChannelReceivesTheNotification() {
        service.onEvent(event(EventType.INCIDENT_ASSIGNED, 1));
        assertEquals(1, inApp.getFor(REPORTER).size());
        assertEquals(1, inApp.getFor(TECH).size());

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
    void markAllReadOnlyUpdatesTheCurrentRecipientsInAppNotifications() {
        service.onEvent(event(EventType.INCIDENT_ASSIGNED, 1));
        assertEquals(1, inApp.markAllRead(REPORTER));
        assertEquals(0, inApp.markAllRead(REPORTER));
        assertTrue(inApp.getFor(REPORTER).get(0).read());
        assertEquals("Title 1", inApp.getFor(REPORTER).get(0).incidentTitle());
        assertFalse(inApp.getFor(TECH).get(0).read());
    }

    @Test
    void aFailingChannelDoesNotStopTheOthers() {
        NotificationChannel broken = new NotificationChannel() {
            public String name() { return "BROKEN"; }
            public void send(Notification n) { throw new IllegalStateException("down"); }
        };
        NotificationService s = new NotificationService(
                new FakeLookup().with(Snap.of(1, Priority.P1, IncidentStatus.NEW, T0).build()), List.of(broken, inApp));
        org.junit.jupiter.api.Assertions.assertThrows(IllegalStateException.class, () -> s.onEvent(event(EventType.INCIDENT_CREATED, 1)));
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
