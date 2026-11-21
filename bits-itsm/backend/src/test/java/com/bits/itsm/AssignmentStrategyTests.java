package com.bits.itsm;

import java.util.*;
import com.bits.itsm.assignment.*;
import com.bits.itsm.assignment.AssignmentStrategy.Candidate;
import com.bits.itsm.incident.Incident;
import com.bits.itsm.user.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;

class AssignmentStrategyTests {
    Technician technician(long id, TechnicianSkill skill) {
        var t = new Technician("Test", "tech" + id + "@hyderabad.bits-pilani.ac.in", "$2-test-only", skill.name());
        ReflectionTestUtils.setField(t, "id", id); return t;
    }
    Incident incident(Incident.Category category) {
        return new Incident("Network issue", "The campus network is not responding.", new Student("Test", "student01@hyderabad.bits-pilani.ac.in", "$2-test-only", "TEST"), category, Incident.ItService.CAMPUS_WIFI, Incident.Level.HIGH, Incident.Level.MEDIUM);
    }
    @Test void skillStrategyChoosesLowestQualifiedLoadAndStableId() {
        var first = technician(1, TechnicianSkill.NETWORK); var second = technician(2, TechnicianSkill.NETWORK); var unrelated = technician(3, TechnicianSkill.SOFTWARE);
        var strategy = new SkillBasedAssignment();
        assertSame(second, strategy.assign(incident(Incident.Category.NETWORK), List.of(new Candidate(first, 4), new Candidate(second, 2), new Candidate(unrelated, 0))).orElseThrow());
        assertSame(first, strategy.assign(incident(Incident.Category.NETWORK), List.of(new Candidate(second, 2), new Candidate(first, 2))).orElseThrow());
    }
    @Test void loadStrategyStillEnforcesMandatoryExpertise() {
        var network = technician(1, TechnicianSkill.NETWORK); var software = technician(2, TechnicianSkill.SOFTWARE);
        assertSame(network, new LoadBasedAssignment().assign(incident(Incident.Category.NETWORK), List.of(new Candidate(network, 3), new Candidate(software, 0))).orElseThrow());
    }
    @Test void strategiesDifferForGeneralIncidentsWithoutHardExpertise() {
        var network = technician(1, TechnicianSkill.NETWORK); var software = technician(2, TechnicianSkill.SOFTWARE);
        var candidates = List.of(new Candidate(network, 3), new Candidate(software, 0));
        assertSame(network, new SkillBasedAssignment().assign(incident(Incident.Category.OTHER), candidates).orElseThrow());
        assertSame(software, new LoadBasedAssignment().assign(incident(Incident.Category.OTHER), candidates).orElseThrow());
    }
    @Test void excludesDisabledBusyUnavailableAndFullAccounts() {
        for (AssignmentStrategy strategy : List.of(new SkillBasedAssignment(), new LoadBasedAssignment())) {
            var disabled = technician(1, TechnicianSkill.NETWORK); disabled.setEnabled(false);
            var busy = technician(2, TechnicianSkill.NETWORK); busy.configureAssignment(busy.getSkills(), Technician.Availability.BUSY, 5);
            var unavailable = technician(3, TechnicianSkill.NETWORK); unavailable.setAvailable(false);
            var full = technician(4, TechnicianSkill.NETWORK);
            assertTrue(strategy.assign(incident(Incident.Category.NETWORK), List.of(new Candidate(disabled, 0), new Candidate(busy, 0), new Candidate(unavailable, 0), new Candidate(full, 5))).isEmpty());
        }
    }
    @Test void missingSkillAndEmptyCandidatesReturnNoAssignment() {
        assertTrue(new SkillBasedAssignment().assign(incident(Incident.Category.SECURITY), List.of(new Candidate(technician(1, TechnicianSkill.NETWORK), 0))).isEmpty());
        assertTrue(new LoadBasedAssignment().assign(incident(Incident.Category.OTHER), List.of()).isEmpty());
    }
}


