package com.bits.itsm.intelligence;

import com.bits.itsm.event.EventType;
import com.bits.itsm.incident.Incident.ItService;
import com.bits.itsm.incident.IncidentStatus;
import com.bits.itsm.support.IncidentSnapshot;
import com.bits.itsm.testsupport.TestData.FakeLookup;
import com.bits.itsm.testsupport.TestData.Recorder;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.bits.itsm.testsupport.TestData.Snap;
import static com.bits.itsm.testsupport.TestData.T0;
import static com.bits.itsm.testsupport.TestData.busWith;
import static com.bits.itsm.testsupport.TestData.count;
import static com.bits.itsm.testsupport.TestData.described;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DuplicateDetectorTest {

    private final IncidentSnapshot inc101 = described(101, ItService.STUDENT_PORTAL, "Portal application unavailable", "");
    private final IncidentSnapshot inc102 = described(102, ItService.STUDENT_PORTAL, "Portal transaction failing", "");
    private final IncidentSnapshot inc103 = described(103, ItService.STUDENT_PORTAL, "Unable to open portal", "");

    @Test
    void similarReportsOnTheSameServiceAreDetectedAsRelated() {
        DuplicateDetector detector = new DuplicateDetector(null, null, 0.4);
        assertEquals(2, detector.findRelated(inc103, List.of(inc101, inc102)).size());
    }

    @Test
    void problemStatementPaymentExampleIsDetected() {
        IncidentSnapshot a = described(1, ItService.OTHER, "Payment application unavailable", "");
        IncidentSnapshot b = described(2, ItService.OTHER, "Payment transaction failing", "");
        IncidentSnapshot c = described(3, ItService.OTHER, "Unable to make payment", "");
        assertEquals(2, new DuplicateDetector(null, null, 0.4).findRelated(c, List.of(a, b)).size());
    }

    @Test
    void bestMatchComesFirst() {
        DuplicateDetector detector = new DuplicateDetector(null, null, 0.4);
        List<DuplicateMatch> matches = detector.findRelated(inc103, List.of(inc101, inc102));
        assertTrue(matches.get(0).similarity() >= matches.get(1).similarity());
    }

    @Test
    void sameWordsOnDifferentServiceAreNotDuplicates() {
        IncidentSnapshot other = described(200, ItService.LIBRARY, "Portal application unavailable", "");
        assertTrue(new DuplicateDetector(null, null, 0.4).findRelated(inc101, List.of(other)).isEmpty());
    }

    @Test
    void unrelatedDescriptionsOnSameServiceStayBelowThreshold() {
        IncidentSnapshot other = described(201, ItService.STUDENT_PORTAL, "Receipt PDF has wrong font", "");
        assertTrue(new DuplicateDetector(null, null, 0.4).findRelated(inc101, List.of(other)).isEmpty());
    }

    @Test
    void closedIncidentsAreNotReportedAsDuplicates() {
        IncidentSnapshot closed = Snap.of(102, com.bits.itsm.incident.Incident.Priority.P2, IncidentStatus.CLOSED, T0)
                .service(ItService.STUDENT_PORTAL).text("Portal transaction failing", "").build();
        assertTrue(new DuplicateDetector(null, null, 0.4).findRelated(inc101, List.of(closed)).isEmpty());
    }

    @Test
    void incidentIsNeverItsOwnDuplicate() {
        assertTrue(new DuplicateDetector(null, null, 0.4).findRelated(inc101, List.of(inc101)).isEmpty());
    }

    @Test
    void higherThresholdRejectsWeakMatches() {
        assertTrue(new DuplicateDetector(null, null, 0.9).findRelated(inc103, List.of(inc101)).isEmpty());
    }

    @Test
    void checkPublishesADuplicateEvent() {
        Recorder recorder = new Recorder();
        FakeLookup lookup = new FakeLookup().with(inc101, inc102, inc103);
        DuplicateDetector detector = new DuplicateDetector(lookup, busWith(recorder), 0.4);
        assertEquals(2, detector.check(103L).size());
        assertEquals(1, count(recorder, EventType.DUPLICATE_DETECTED));
        assertEquals(Long.valueOf(103), recorder.events.get(0).incidentId());
    }

    @Test
    void checkPublishesNothingWhenThereIsNoMatchOrNoSuchIncident() {
        Recorder recorder = new Recorder();
        FakeLookup lookup = new FakeLookup().with(inc101);
        DuplicateDetector detector = new DuplicateDetector(lookup, busWith(recorder), 0.4);
        assertTrue(detector.check(described(300, ItService.STUDENT_PORTAL, "Receipt PDF has wrong font", "")).isEmpty());
        assertTrue(detector.check(999L).isEmpty());
        assertEquals(0, recorder.events.size());
    }

    @Test
    void missingServiceNeverMatches() {
        IncidentSnapshot noService = described(400, null, "Portal application unavailable", "");
        assertTrue(new DuplicateDetector(null, null, 0.4).findRelated(noService, List.of(inc101)).isEmpty());
    }

    @Test
    void tokenizerHandlesNullAndWifiSpelling() {
        assertTrue(TextSimilarity.tokens(null).isEmpty());
        assertEquals(TextSimilarity.tokens("Wi-Fi down"), TextSimilarity.tokens("wireless unavailable"));
    }
}
