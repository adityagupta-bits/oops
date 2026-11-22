package com.bits.itsm;

import com.bits.itsm.incident.*;
import com.bits.itsm.incident.Incident.*;
import com.bits.itsm.user.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfEnvironmentVariable(named="BITSOLVE_DB_TESTS", matches="true")
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@SpringBootTest(properties={"spring.datasource.url=${BITSOLVE_TEST_DB_URL}", "bitsolve.assignment.automatic-enabled=false"})
@Transactional
class InternalStaffConversationPersistenceTests {
    @Autowired IncidentRepository incidents;
    @Autowired UserRepository users;
    @Autowired EntityManager em;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;

    Incident incident;
    Administrator admin;
    Student reporter;
    Technician technician;

    @BeforeEach void prepareAssignedIncident() {
        assertTrue(jdbc.queryForObject("select current_database()",String.class).startsWith("bitsolve_restore_verify_chat_"),
                "Internal conversation verification must only run on the disposable isolated database.");
        admin=(Administrator)users.findAll().stream().filter(u -> u.getRole()==Role.ADMIN && u.isEnabled()).findFirst().orElseThrow();
        technician=(Technician)users.findAll().stream().filter(u -> u instanceof Technician && u.isEnabled()).findFirst().orElseThrow();
        technician.setAvailability(Technician.Availability.AVAILABLE);
        incident=incidents.findAll().stream().filter(i -> i.getStatus()==IncidentStatus.NEW).findFirst().orElseThrow();
        reporter=incident.getReporter();
        incident.adminClassify(Category.valueOf("NETWORK"),ItService.valueOf("CAMPUS_WIFI"),Level.MEDIUM,Level.HIGH,Level.MEDIUM,Priority.P2);
        incident.assign(technician);
        em.flush();
    }

    @Test void staffConversationPersistsNotifiesTracksReadsAndStaysPrivate() throws Exception {
        mvc.perform(post("/api/incidents/"+incident.getId()+"/messages").with(user(reporter.getEmail()).roles("STUDENT")).with(csrf())
                .contentType("application/json").content("{\"content\":\"Student-visible connection details.\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.messages[0].content").value("Student-visible connection details."));

        String privateText="Please check the access point after class; this is private staff guidance.";
        mvc.perform(post("/api/incidents/"+incident.getId()+"/internal-messages").with(user(admin.getEmail()).roles("ADMIN")).with(csrf())
                .contentType("application/json").content("{\"content\":\""+privateText+"\",\"urgent\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messages[0].content").value(privateText))
                .andExpect(jsonPath("$.messages[0].urgent").value(true));

        em.flush(); em.clear();
        mvc.perform(get("/api/incidents/"+incident.getId()+"/internal-messages").with(user(technician.getEmail()).roles("TECHNICIAN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.unreadCount").value(1))
                .andExpect(jsonPath("$.messages[0].content").value(privateText));
        mvc.perform(post("/api/incidents/"+incident.getId()+"/internal-messages/read").with(user(technician.getEmail()).roles("TECHNICIAN")).with(csrf())
                .contentType("application/json").content("{\"messageId\":"+jdbc.queryForObject("select max(id) from investigation_notes where incident_id=? and kind='MESSAGE' and visibility='INTERNAL'",Long.class,incident.getId())+"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/incidents/"+incident.getId()+"/internal-messages").with(user(technician.getEmail()).roles("TECHNICIAN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.unreadCount").value(0));

        String reply="I checked the access point and restarted its radio.";
        mvc.perform(post("/api/incidents/"+incident.getId()+"/internal-messages").with(user(technician.getEmail()).roles("TECHNICIAN")).with(csrf())
                .contentType("application/json").content("{\"content\":\""+reply+"\",\"urgent\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.messages[1].content").value(reply));
        em.flush(); em.clear();

        mvc.perform(get("/api/incidents/"+incident.getId()+"/internal-messages").with(user(admin.getEmail()).roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.messages[0].readBy[0]").value(technician.getName()))
                .andExpect(jsonPath("$.messages[1].content").value(reply));
        mvc.perform(get("/api/incidents/"+incident.getId()+"/messages").with(user(technician.getEmail()).roles("TECHNICIAN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.unreadCount").value(1))
                .andExpect(jsonPath("$.messages[0].content").value("Student-visible connection details."));

        String studentDetail=mvc.perform(get("/api/incidents/"+incident.getId()).with(user(reporter.getEmail()).roles("STUDENT")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertFalse(studentDetail.contains(privateText));
        String studentNotifications=mvc.perform(get("/api/notifications").with(user(reporter.getEmail()).roles("STUDENT")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.title == 'New internal staff message')]").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        assertFalse(studentNotifications.contains(privateText));
        String searchResults=mvc.perform(get("/api/incidents").param("search",privateText).with(user(reporter.getEmail()).roles("STUDENT")))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertFalse(searchResults.contains(privateText));
        mvc.perform(get("/api/admin/audit/"+incident.getId()).with(user(reporter.getEmail()).roles("STUDENT")))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/incidents/"+incident.getId()+"/internal-messages").with(user(reporter.getEmail()).roles("STUDENT")))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/incidents/"+incident.getId()+"/internal-messages").with(user(reporter.getEmail()).roles("STUDENT")).with(csrf())
                .contentType("application/json").content("{\"content\":\"Unauthorized private message\",\"urgent\":false}"))
                .andExpect(status().isForbidden());
        String technicianNotifications=mvc.perform(get("/api/notifications").with(user(technician.getEmail()).roles("TECHNICIAN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.title == 'New internal staff message')]").exists())
                .andReturn().getResponse().getContentAsString();
        assertFalse(technicianNotifications.contains(privateText));
        String adminNotifications=mvc.perform(get("/api/notifications").with(user(admin.getEmail()).roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.title == 'New internal staff message')]").exists())
                .andReturn().getResponse().getContentAsString();
        assertFalse(adminNotifications.contains(reply));

        Technician outsider=new Technician("Unrelated Technician","internal-outsider@hyderabad.bits-pilani.ac.in","$2-test-only","NETWORK");
        users.saveAndFlush(outsider);
        mvc.perform(get("/api/incidents/"+incident.getId()+"/internal-messages").with(user(outsider.getEmail()).roles("TECHNICIAN")))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/incidents/"+incident.getId()+"/internal-messages").with(user(technician.getEmail()).roles("TECHNICIAN")).with(csrf())
                .contentType("application/json").content("{\"content\":\"Only an admin may mark urgent.\",\"urgent\":true}"))
                .andExpect(status().isForbidden());
    }

    @Test void administratorTeamAndEscalationPersistWithPermissionsAndOwnershipPreserved() throws Exception {
        Technician collaborator=users.saveAndFlush(new Technician("Eligible collaborator","team-verification@hyderabad.bits-pilani.ac.in","$2-test-only","NETWORK"));
        Long incidentId=incident.getId(), owner=technician.getId();
        var deadlines=jdbc.queryForMap("select response_deadline,resolution_deadline from incidents where id=?",incidentId);
        String teamPath="/api/admin/incidents/"+incidentId+"/collaborators";
        String body="{\"technicianId\":"+collaborator.getId()+",\"reason\":\"Investigate network connectivity\",\"remove\":false}";
        mvc.perform(post(teamPath).with(user(reporter.getEmail()).roles("STUDENT")).with(csrf()).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post(teamPath).with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json").content(body)).andExpect(status().isOk());
        assertEquals(1,jdbc.queryForObject("select count(*) from incident_collaborators where incident_id=? and technician_id=?",Integer.class,incidentId,collaborator.getId()));
        mvc.perform(post(teamPath).with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json").content(body)).andExpect(status().isConflict());
        mvc.perform(post(teamPath).with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json").content(body.replace("false","true"))).andExpect(status().isOk());
        assertEquals(0,jdbc.queryForObject("select count(*) from incident_collaborators where incident_id=? and technician_id=?",Integer.class,incidentId,collaborator.getId()));
        String escalationPath="/api/admin/incidents/"+incidentId+"/escalation";
        String escalation="{\"level\":\"TEAM_LEAD\",\"reason\":\"Requires senior incident coordination\"}";
        mvc.perform(post(escalationPath).with(user(reporter.getEmail()).roles("STUDENT")).with(csrf()).contentType("application/json").content(escalation)).andExpect(status().isForbidden());
        mvc.perform(post(escalationPath).with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json").content(escalation)).andExpect(status().isOk()).andExpect(jsonPath("$.current").value("Team Lead"));
        mvc.perform(post(escalationPath).with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json").content(escalation)).andExpect(status().isConflict());
        em.flush(); em.clear();
        mvc.perform(get(escalationPath).with(user(admin.getEmail()).roles("ADMIN"))).andExpect(status().isOk()).andExpect(jsonPath("$.current").value("Team Lead"));
        assertEquals(owner,jdbc.queryForObject("select assigned_technician_id from incidents where id=?",Long.class,incidentId));
        assertEquals(deadlines,jdbc.queryForMap("select response_deadline,resolution_deadline from incidents where id=?",incidentId));
        assertEquals(3,jdbc.queryForObject("select count(*) from incident_history where incident_id=? and action in ('COLLABORATOR_ADDED','COLLABORATOR_REMOVED','MANUAL_ESCALATION')",Integer.class,incidentId));
    }

    @Test void reassignmentAndPriorityOverridePersistWithoutChangingDeadlines() throws Exception {
        Technician target=users.saveAndFlush(new Technician("Reassignment target","reassign-verification@hyderabad.bits-pilani.ac.in","$2-test-only","NETWORK"));
        Long id=incident.getId();
        var deadlines=jdbc.queryForMap("select response_deadline,resolution_deadline from incidents where id=?",id);
        String assignment="{\"technicianId\":"+target.getId()+",\"reason\":\"Network specialist taking ownership\"}";
        mvc.perform(post("/api/incidents/"+id+"/assign").with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json").content(assignment)).andExpect(status().isOk());
        mvc.perform(post("/api/incidents/"+id+"/priority-override").with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json").content("{\"priority\":\"P1\",\"reason\":\"Confirmed campus-wide impact\"}")).andExpect(status().isOk());
        em.flush(); em.clear();
        assertEquals(target.getId(),jdbc.queryForObject("select assigned_technician_id from incidents where id=?",Long.class,id));
        assertEquals("P1",jdbc.queryForObject("select priority from incidents where id=?",String.class,id));
        assertEquals(deadlines,jdbc.queryForMap("select response_deadline,resolution_deadline from incidents where id=?",id));
        mvc.perform(post("/api/incidents/"+id+"/priority-override").with(user(reporter.getEmail()).roles("STUDENT")).with(csrf()).contentType("application/json").content("{\"priority\":\"P4\",\"reason\":\"Unauthorized override attempt\"}")).andExpect(status().isForbidden());
    }

    @Test void transferApprovalAndRejectionPersist() throws Exception {
        Technician target=users.saveAndFlush(new Technician("Transfer target","transfer-verification@hyderabad.bits-pilani.ac.in","$2-test-only","NETWORK"));
        Long id=incident.getId();
        var deadlines=jdbc.queryForMap("select response_deadline,resolution_deadline from incidents where id=?",id);
        String request="{\"technicianId\":"+target.getId()+",\"reason\":\"OTHER\",\"handoverNotes\":\"Network specialist assistance required\"}";
        for (String decision : new String[]{"reject","approve"}) {
            mvc.perform(post("/api/incidents/"+id+"/transfer-requests").with(user(technician.getEmail()).roles("TECHNICIAN")).with(csrf()).contentType("application/json").content(request)).andExpect(status().isOk());
            Long requestId=jdbc.queryForObject("select max(id) from transfer_requests where incident_id=?",Long.class,id);
            String review="{\"technicianId\":"+target.getId()+",\"notes\":\"Reviewed network ownership requirements\"}";
            mvc.perform(post("/api/admin/transfer-requests/"+requestId+"/"+decision).with(user(reporter.getEmail()).roles("STUDENT")).with(csrf()).contentType("application/json").content(review)).andExpect(status().isForbidden());
            mvc.perform(post("/api/admin/transfer-requests/"+requestId+"/"+decision).with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json").content(review)).andExpect(status().isOk());
            assertEquals(decision.equals("approve")?"APPROVED":"REJECTED",jdbc.queryForObject("select status from transfer_requests where id=?",String.class,requestId));
        }
        em.flush(); em.clear();
        assertEquals(target.getId(),jdbc.queryForObject("select assigned_technician_id from incidents where id=?",Long.class,id));
        assertEquals(deadlines,jdbc.queryForMap("select response_deadline,resolution_deadline from incidents where id=?",id));
    }
}
