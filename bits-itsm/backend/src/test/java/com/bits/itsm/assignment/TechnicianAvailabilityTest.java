package com.bits.itsm.assignment;

import java.util.List;
import java.util.Set;
import com.bits.itsm.assignment.AssignmentStrategy.Candidate;
import com.bits.itsm.incident.Incident;
import com.bits.itsm.user.Student;
import com.bits.itsm.user.Technician;
import com.bits.itsm.user.TechnicianSkill;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;

class TechnicianAvailabilityTest {

    Technician technician(long id, TechnicianSkill skill) {
        var t = new Technician("Tech " + id, "tech" + id + "@hyderabad.bits-pilani.ac.in", "$2-test-only", skill.name());
        ReflectionTestUtils.setField(t, "id", id);
        return t;
    }

    Incident incident(Incident.Category category) {
        return new Incident("Network Issue", "The campus Wi-Fi connection is dropping.",
                new Student("Student", "student@hyderabad.bits-pilani.ac.in", "$2-test-only", "2025A7PS0001H"),
                category, Incident.ItService.CAMPUS_WIFI, Incident.Level.MEDIUM, Incident.Level.HIGH);
    }

    @Test
    void technicianAvailabilityStateTransitions() {
        var tech = technician(1, TechnicianSkill.NETWORK);
        assertEquals(Technician.Availability.AVAILABLE, tech.getAvailability());
        assertTrue(tech.isAvailable());
        assertTrue(tech.canReceive(0));

        // Set to BUSY
        tech.setAvailability(Technician.Availability.BUSY);
        assertEquals(Technician.Availability.BUSY, tech.getAvailability());
        assertFalse(tech.isAvailable());
        assertFalse(tech.canReceive(0));

        // Set to UNAVAILABLE
        tech.setAvailability(Technician.Availability.UNAVAILABLE);
        assertEquals(Technician.Availability.UNAVAILABLE, tech.getAvailability());
        assertFalse(tech.isAvailable());
        assertFalse(tech.canReceive(0));

        // Set back to AVAILABLE
        tech.setAvailability(Technician.Availability.AVAILABLE);
        assertEquals(Technician.Availability.AVAILABLE, tech.getAvailability());
        assertTrue(tech.isAvailable());
        assertTrue(tech.canReceive(0));

        // Null should throw IllegalArgumentException
        assertThrows(IllegalArgumentException.class, () -> tech.setAvailability(null));
    }

    @Test
    void unavailableTechnicianIsExcludedFromAutomaticAssignment() {
        var techAvailable = technician(1, TechnicianSkill.NETWORK);
        var techUnavailable = technician(2, TechnicianSkill.NETWORK);
        techUnavailable.setAvailability(Technician.Availability.UNAVAILABLE);

        var strategy = new LoadBasedAssignment();
        var inc = incident(Incident.Category.NETWORK);

        var assigned = strategy.assign(inc, List.of(
                new Candidate(techUnavailable, 0),
                new Candidate(techAvailable, 2)
        ));

        assertTrue(assigned.isPresent());
        assertEquals(techAvailable.getId(), assigned.get().getId());
    }

    @Test
    void busyTechnicianIsExcludedFromAutomaticAssignment() {
        var techAvailable = technician(1, TechnicianSkill.NETWORK);
        var techBusy = technician(2, TechnicianSkill.NETWORK);
        techBusy.setAvailability(Technician.Availability.BUSY);

        var strategy = new SkillBasedAssignment();
        var inc = incident(Incident.Category.NETWORK);

        var assigned = strategy.assign(inc, List.of(
                new Candidate(techBusy, 0),
                new Candidate(techAvailable, 1)
        ));

        assertTrue(assigned.isPresent());
        assertEquals(techAvailable.getId(), assigned.get().getId());
    }

    @Test
    void allUnavailableResultsInPendingAssignment() {
        var tech1 = technician(1, TechnicianSkill.NETWORK);
        tech1.setAvailability(Technician.Availability.UNAVAILABLE);
        var tech2 = technician(2, TechnicianSkill.NETWORK);
        tech2.setAvailability(Technician.Availability.BUSY);

        var strategy = new SkillBasedAssignment();
        var inc = incident(Incident.Category.NETWORK);

        var assigned = strategy.assign(inc, List.of(
                new Candidate(tech1, 0),
                new Candidate(tech2, 0)
        ));

        assertTrue(assigned.isEmpty());
    }
}
