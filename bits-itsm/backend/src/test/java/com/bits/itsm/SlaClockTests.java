package com.bits.itsm;

import java.time.Instant;
import com.bits.itsm.incident.SlaClock;
import static com.bits.itsm.incident.SlaClock.Status.*;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class SlaClockTests {
    @Test void capturesTargetsFromCreationAndIgnoresLaterPolicyEdits() {
        var student = new com.bits.itsm.user.Student("Student", "student01@hyderabad.bits-pilani.ac.in", "$2-test", "TEST");
        var i = new com.bits.itsm.incident.Incident("Outage", "Campus network is unavailable.", student,
            com.bits.itsm.incident.Incident.Category.NETWORK, com.bits.itsm.incident.Incident.ItService.CAMPUS_WIFI,
            com.bits.itsm.incident.Incident.Level.HIGH, com.bits.itsm.incident.Incident.Level.HIGH);
        i.classify(com.bits.itsm.incident.Incident.Category.NETWORK);
        var policy = new com.bits.itsm.incident.SlaPolicy(com.bits.itsm.incident.Incident.Priority.P1, 5, 30);
        i.captureSla(policy);
        policy.update(15, 120); i.captureSla(policy);
        assertEquals(i.getCreatedAt().plusSeconds(300), i.getResponseDeadline());
        assertEquals(i.getCreatedAt().plusSeconds(1800), i.getResolutionDeadline());
    }
    private final Instant deadline = Instant.parse("2026-11-15T12:00:00Z");
    @Test void warnsOnlyDuringFinalTwentyPercent() {
        assertEquals(ON_TRACK, SlaClock.status(deadline, 5, null, deadline.minusSeconds(61)));
        assertEquals(AT_RISK, SlaClock.status(deadline, 5, null, deadline.minusSeconds(60)));
        assertEquals(BREACHED, SlaClock.status(deadline, 5, null, deadline.plusSeconds(1)));
    }
    @Test void completionFreezesResultIncludingLateCompletion() {
        assertEquals(MET, SlaClock.status(deadline, 5, deadline, deadline.plusSeconds(9999)));
        assertEquals(BREACHED, SlaClock.status(deadline, 5, deadline.plusSeconds(1), deadline.plusSeconds(9999)));
    }
}
