package com.bits.itsm.assignment;

import com.bits.itsm.assignment.AssignmentStrategy.Candidate;
import com.bits.itsm.incident.Incident;
import com.bits.itsm.user.Student;
import com.bits.itsm.user.Technician;
import com.bits.itsm.user.TechnicianSkill;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SmartRecommendationAssignmentTest {

    private final SmartRecommendationAssignment strategy = new SmartRecommendationAssignment();

    private static Technician tech(long id, TechnicianSkill skill) {
        var t = new Technician("Test", "tech" + id + "@hyderabad.bits-pilani.ac.in", "$2-test-only", skill.name());
        ReflectionTestUtils.setField(t, "id", id);
        return t;
    }

    private static Incident incident(Incident.Category category, Incident.ItService service, Incident.Priority priority) {
        var i = new Incident("Network issue", "The campus network is not responding.",
                new Student("Test", "student01@hyderabad.bits-pilani.ac.in", "$2-test-only", "TEST"),
                category, service, Incident.Level.HIGH, Incident.Level.MEDIUM);
        ReflectionTestUtils.setField(i, "priority", priority);
        return i;
    }

    @Test
    void routineIncidentFavoursTheBestSkillFit() {
        var network = tech(1, TechnicianSkill.NETWORK);
        var software = tech(2, TechnicianSkill.SOFTWARE);
        var i = incident(Incident.Category.OTHER, Incident.ItService.CAMPUS_WIFI, Incident.Priority.P3);
        var pick = strategy.assign(i, List.of(new Candidate(network, 3), new Candidate(software, 0)));
        assertSame(network, pick.orElseThrow());
    }

    @Test
    void urgentIncidentFavoursTheLeastLoadedTechnician() {
        var network = tech(1, TechnicianSkill.NETWORK);
        var software = tech(2, TechnicianSkill.SOFTWARE);
        var i = incident(Incident.Category.OTHER, Incident.ItService.CAMPUS_WIFI, Incident.Priority.P1);
        var pick = strategy.assign(i, List.of(new Candidate(network, 3), new Candidate(software, 0)));
        assertSame(software, pick.orElseThrow());
    }

    @Test
    void requiredSkillIsMandatoryEvenWhenUrgent() {
        var network = tech(1, TechnicianSkill.NETWORK);
        var software = tech(2, TechnicianSkill.SOFTWARE);
        var i = incident(Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI, Incident.Priority.P1);
        var pick = strategy.assign(i, List.of(new Candidate(network, 4), new Candidate(software, 0)));
        assertSame(network, pick.orElseThrow());
    }

    @Test
    void amongEquallySkilledTheLessLoadedWins() {
        var busier = tech(1, TechnicianSkill.NETWORK);
        var freer = tech(2, TechnicianSkill.NETWORK);
        var i = incident(Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI, Incident.Priority.P3);
        assertSame(freer, strategy.assign(i, List.of(new Candidate(busier, 3), new Candidate(freer, 1))).orElseThrow());
    }

    @Test
    void disabledBusyUnavailableAndFullTechniciansAreSkipped() {
        var disabled = tech(1, TechnicianSkill.NETWORK);
        disabled.setEnabled(false);
        var busy = tech(2, TechnicianSkill.NETWORK);
        busy.configureAssignment(busy.getSkills(), Technician.Availability.BUSY, 5);
        var full = tech(3, TechnicianSkill.NETWORK);
        var ok = tech(4, TechnicianSkill.NETWORK);
        var i = incident(Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI, Incident.Priority.P3);
        var pick = strategy.assign(i, List.of(new Candidate(disabled, 0), new Candidate(busy, 0),
                new Candidate(full, 5), new Candidate(ok, 2)));
        assertSame(ok, pick.orElseThrow());
    }

    @Test
    void emptyResultWhenNobodyIsSuitable() {
        var i = incident(Incident.Category.SECURITY, Incident.ItService.AUTHENTICATION, Incident.Priority.P2);
        assertTrue(strategy.assign(i, List.of(new Candidate(tech(1, TechnicianSkill.NETWORK), 0))).isEmpty());
        assertTrue(strategy.assign(i, List.of()).isEmpty());
    }

    @Test
    void tiesAreBrokenByLowerId() {
        var b = tech(2, TechnicianSkill.NETWORK);
        var a = tech(1, TechnicianSkill.NETWORK);
        var i = incident(Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI, Incident.Priority.P3);
        assertSame(a, strategy.assign(i, List.of(new Candidate(b, 1), new Candidate(a, 1))).orElseThrow());
    }

    @Test
    void scoreCombinesSkillAndFreeCapacity() {
        var t = tech(1, TechnicianSkill.NETWORK);
        var routine = incident(Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI, Incident.Priority.P3);
        var urgent = incident(Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI, Incident.Priority.P1);
        assertEquals(5.0 + 5.0 * 4 / 5, strategy.score(routine, new Candidate(t, 1)), 1e-9);
        assertEquals(5.0 + 10.0 * 4 / 5, strategy.score(urgent, new Candidate(t, 1)), 1e-9);
    }
}
