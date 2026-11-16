package com.bits.itsm;

import com.bits.itsm.incident.*;
import com.bits.itsm.user.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class IncidentWorkflowTests {
    private final Student student = new Student("Student", "student01@hyderabad.bits-pilani.ac.in", "$2-test-only", "TEST");
    private final Technician technician = new Technician("Technician", "technician01@hyderabad.bits-pilani.ac.in", "$2-test-only", "NETWORK");
    private Incident incident() { return new Incident("Network outage", "Campus network is unavailable in the library.", student, Incident.Category.NETWORK, Incident.ItService.CAMPUS_NETWORK, Incident.Level.HIGH, Incident.Level.MEDIUM); }
    private Incident investigating() { Incident i = incident(); i.classify(Incident.Category.NETWORK, Incident.Priority.P2); i.assign(technician); i.acknowledge(); i.start(); return i; }
    @Test void completesOrderedLifecycleAndTimestamps() {
        Incident i = investigating(); i.resolve("Replaced cable", "Tested connectivity"); i.verify(); i.close();
        assertEquals(IncidentStatus.CLOSED, i.getStatus());
        assertNotNull(i.getAcknowledgedAt()); assertNotNull(i.getResolvedAt()); assertNotNull(i.getVerifiedAt()); assertNotNull(i.getClosedAt());
        assertEquals(Incident.Priority.P2, i.getPriority());
        assertThrows(IllegalStateException.class, i::start);
    }
    @Test void rejectsSkippedTransitions() {
        Incident i = incident();
        assertThrows(IllegalStateException.class, i::close);
        assertThrows(IllegalStateException.class, i::verify);
        assertThrows(IllegalStateException.class, i::acknowledge);
        i.classify(Incident.Category.NETWORK, Incident.Priority.P2); i.assign(technician);
        assertThrows(IllegalStateException.class, () -> i.resolve("Fixed", "Tested"));
    }
    @Test void rejectsBlankContentAndEmptyResolution() {
        assertThrows(IllegalArgumentException.class, () -> new Incident(" ", "An incident description", student, Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI, Incident.Level.LOW, Incident.Level.LOW));
        Incident i = investigating();
        assertThrows(IllegalArgumentException.class, () -> i.resolve(" ", "Tested"));
        assertThrows(IllegalArgumentException.class, () -> i.resolve("Fixed", " "));
        assertEquals(IncidentStatus.IN_PROGRESS, i.getStatus());
    }
    @Test void rejectsUnavailableAndDisabledTechnicians() {
        Incident i = incident(); i.classify(Incident.Category.NETWORK, Incident.Priority.P2); technician.setAvailable(false);
        assertThrows(IllegalStateException.class, () -> i.assign(technician));
        technician.setAvailable(true); technician.setEnabled(false);
        assertThrows(IllegalStateException.class, () -> i.assign(technician));
    }
    @Test void rejectedResolutionReturnsToInvestigation() {
        Incident i = investigating(); i.resolve("Fixed", "Tested"); i.issueStillExists();
        assertEquals(IncidentStatus.IN_PROGRESS, i.getStatus()); assertNull(i.getResolvedAt()); assertNull(i.getResolutionSummary());
        assertThrows(IllegalStateException.class, i::verify);
        i.resolve("Fixed again", "Re-tested"); i.verify();
        assertEquals(IncidentStatus.VERIFIED, i.getStatus());
    }
    @Test void feedbackRequiresVerificationAndIsSingleSubmission() {
        Incident i = investigating();
        assertThrows(IllegalStateException.class, () -> i.giveFeedback(student, 5, ""));
        i.resolve("Fixed", "Tested"); i.verify();
        assertThrows(IllegalArgumentException.class, () -> i.giveFeedback(student, 6, ""));
        i.giveFeedback(student, 5, "Thanks");
        assertThrows(IllegalStateException.class, () -> i.giveFeedback(student, 4, "Duplicate"));
    }
}
