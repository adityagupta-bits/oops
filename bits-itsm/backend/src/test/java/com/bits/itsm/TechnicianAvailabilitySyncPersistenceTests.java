package com.bits.itsm;

import com.bits.itsm.assignment.AssignmentService;
import com.bits.itsm.incident.Incident;
import com.bits.itsm.incident.IncidentRepository;
import com.bits.itsm.user.*;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@EnabledIfEnvironmentVariable(named = "BITSOLVE_DB_TESTS", matches = "true")
@AutoConfigureMockMvc
@SpringBootTest(properties = {"spring.datasource.url=${BITSOLVE_TEST_DB_URL}", "bitsolve.assignment.automatic-enabled=false"})
@Transactional
class TechnicianAvailabilitySyncPersistenceTests {
    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired IncidentRepository incidents;
    @Autowired AssignmentService assignments;
    @Autowired JdbcTemplate jdbc;

    private Administrator admin;
    private Student student;
    private Technician technician;

    @BeforeEach
    void prepare() {
        assertTrue(jdbc.queryForObject("select current_database()", String.class).startsWith("bitsolve_restore_verify_chat_"),
                "Availability persistence verification must use only the disposable isolated database clone.");
        admin = (Administrator) users.findAll().stream().filter(u -> u instanceof Administrator && u.isEnabled()).findFirst().orElseThrow();
        student = (Student) users.findAll().stream().filter(u -> u instanceof Student && u.isEnabled()).findFirst().orElseThrow();
        technician = (Technician) users.findAll().stream().filter(u -> u instanceof Technician && u.isEnabled()).findFirst().orElseThrow();
        // Isolate eligibility to this technician; restored datasets may contain alternatives.
        for (var account : users.findAll()) {
            if (account instanceof Technician other && !other.getId().equals(technician.getId())) {
                other.setAvailability(Technician.Availability.UNAVAILABLE);
            }
        }
        users.flush();
    }

    @Test
    void statusChangesPersistForTechnicianAndAdminAndControlAutomaticAssignment() throws Exception {
        for (Technician.Availability next : Technician.Availability.values()) {
            updateAvailability(technician, next).andExpect(status().isOk()).andExpect(jsonPath("$.availability").value(next.name()));
            assertEquals(next.name(), jdbc.queryForObject("select availability from app_users where id=?", String.class, technician.getId()));
            mvc.perform(get("/api/technician/availability").with(user(technician.getEmail()).roles("TECHNICIAN")))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.availability").value(next.name()));
            assertEquals(next.name(), adminWorkloadAvailability());
            assertEquals(next.name(), adminUserAvailability());
        }

        mvc.perform(put("/api/technician/availability").with(user(technician.getEmail()).roles("TECHNICIAN")).with(csrf())
                        .contentType("application/json").content("{\"availability\":null}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/technician/availability").with(user(student.getEmail()).roles("STUDENT")).with(csrf())
                        .contentType("application/json").content("{\"availability\":\"AVAILABLE\"}"))
                .andExpect(status().isForbidden());
        assertEquals("UNAVAILABLE", adminWorkloadAvailability());

        technician.configureAssignment(Set.of(TechnicianSkill.NETWORK), Technician.Availability.BUSY, 100);
        users.flush();
        Incident incident = new Incident("Availability assignment check", "Campus Wi-Fi is unavailable for this test incident.", student);
        incident.adminClassify(Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI, Incident.Level.MEDIUM,
                Incident.Level.HIGH, Incident.Level.MEDIUM, Incident.Priority.P2);
        incident = incidents.saveAndFlush(incident);

        updateAvailability(technician, Technician.Availability.BUSY).andExpect(status().isOk());
        assertFalse(assignments.assignPending(incident.getId()), "BUSY technicians must not receive new work.");
        updateAvailability(technician, Technician.Availability.UNAVAILABLE).andExpect(status().isOk());
        assertFalse(assignments.assignPending(incident.getId()), "UNAVAILABLE technicians must not receive new work.");
        updateAvailability(technician, Technician.Availability.AVAILABLE).andExpect(status().isOk());
        assertTrue(assignments.assignPending(incident.getId()), "An AVAILABLE qualified technician with capacity should be selected.");
        assertEquals(technician.getId(), incidents.findById(incident.getId()).orElseThrow().getAssignedTechnician().getId());

        updateAvailability(technician, Technician.Availability.UNAVAILABLE).andExpect(status().isOk());
        assertEquals(technician.getId(), incidents.findById(incident.getId()).orElseThrow().getAssignedTechnician().getId(),
                "Changing availability must not detach existing assignments.");
    }

    private org.springframework.test.web.servlet.ResultActions updateAvailability(Technician actor, Technician.Availability value) throws Exception {
        return mvc.perform(put("/api/technician/availability").with(user(actor.getEmail()).roles("TECHNICIAN")).with(csrf())
                .contentType("application/json").content("{\"availability\":\"" + value.name() + "\"}"));
    }

    private String adminWorkloadAvailability() throws Exception {
        var response = mvc.perform(get("/api/admin/technicians/workloads").with(user(admin.getEmail()).roles("ADMIN")))
                .andExpect(status().isOk()).andReturn();
        JsonNode workloads = JSON.readTree(response.getResponse().getContentAsString());
        for (JsonNode workload : workloads) if (workload.path("id").asLong() == technician.getId()) return workload.path("availability").asText();
        fail("The administrator workload view did not include the technician.");
        return null;
    }

    private String adminUserAvailability() throws Exception {
        var response = mvc.perform(get("/api/admin/users").with(user(admin.getEmail()).roles("ADMIN")))
                .andExpect(status().isOk()).andReturn();
        JsonNode accounts = JSON.readTree(response.getResponse().getContentAsString());
        for (JsonNode account : accounts) if (account.path("id").asLong() == technician.getId()) return account.path("availability").asText();
        fail("The administrator account view did not include the technician.");
        return null;
    }
}
