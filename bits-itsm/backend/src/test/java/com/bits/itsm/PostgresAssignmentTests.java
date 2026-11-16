package com.bits.itsm;

import java.util.*;
import java.util.concurrent.*;
import com.bits.itsm.assignment.*;
import com.bits.itsm.user.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfEnvironmentVariable(named = "BITSOLVE_DB_TESTS", matches = "true")
@SpringBootTest(properties = {"spring.datasource.url=${BITSOLVE_TEST_DB_URL}", "bitsolve.demo.seed-enabled=true", "spring.jpa.show-sql=false"})
@AutoConfigureMockMvc @ActiveProfiles("dev")
class PostgresAssignmentTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired AssignmentService service;
    final JsonMapper json = JsonMapper.builder().build();
    String email(String name) { return name + "@hyderabad.bits-pilani.ac.in"; }
    String role(String name) { return name.startsWith("admin") ? "ADMIN" : name.startsWith("technician") ? "TECHNICIAN" : "STUDENT"; }
    long tech(String name) { return users.findByEmail(email(name)).orElseThrow().getId(); }
    JsonNode call(String name, String method, String path, Object body, int status) throws Exception {
        var request = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request(org.springframework.http.HttpMethod.valueOf(method), path);
        var result = mvc.perform(request.with(user(email(name)).roles(role(name))).with(csrf()).contentType("application/json").content(json.writeValueAsString(body)))
                .andExpect(status().is(status)).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }
    JsonNode post(String name, String path, Object body, int status) throws Exception { return call(name, "POST", path, body, status); }
    JsonNode get(String name, String path, int status) throws Exception { return call(name, "GET", path, Map.of(), status); }
    long incident(String category) throws Exception {
        long id = post("student01", "/api/incidents", Map.of("title", "Assignment test", "description", "The campus service is unavailable on my device.", "category", category, "affectedService", "CAMPUS_WIFI", "impact", "MEDIUM", "urgency", "HIGH"), 201).get("id").asLong();
        post("admin01", "/api/incidents/" + id + "/classify", Map.of("category", category), 200); return id;
    }
    void assign(long id, String technician) throws Exception { post("admin01", "/api/incidents/" + id + "/assign", Map.of("technicianId", tech(technician)), 200); }
    long transfer(long id, String owner, String target) throws Exception { return post(owner, "/api/incidents/" + id + "/transfer-requests", Map.of("technicianId", tech(target), "reason", "HIGH_WORKLOAD", "handoverNotes", "Private transfer handover"), 200).get("id").asLong(); }
    long collaborate(long id, String owner, String target) throws Exception { return post(owner, "/api/incidents/" + id + "/collaboration-requests", Map.of("technicianId", tech(target), "requiredSkill", "DATABASE", "reason", "Private collaboration reason", "responsibility", "Private database investigation"), 200).get("id").asLong(); }
    @BeforeEach void prepare() {
        // This class requires an explicitly configured, disposable PostgreSQL database.
        jdbc.execute("truncate table transfer_requests, collaboration_requests, incident_collaborators, incident_feedback, investigation_notes, incident_history, incidents restart identity cascade");
        for (Technician t : users.findTechnicians()) {
            Set<TechnicianSkill> skills = t.getEmail().startsWith("technician03") ? Set.of(TechnicianSkill.DATABASE) : Set.of(TechnicianSkill.NETWORK);
            t.configureAssignment(skills, Technician.Availability.AVAILABLE, 5); t.setEnabled(true); users.saveAndFlush(t);
        }
        service.selectStrategy(new AssignmentData.Strategy(AssignmentSettings.Mode.SKILL_BASED), email("admin01"));
    }
    @AfterEach void restore() {
        for (Technician t : users.findTechnicians()) {
            TechnicianSkill skill = switch(t.getEmail().substring(0,12)) { case "technician01" -> TechnicianSkill.HARDWARE; case "technician02" -> TechnicianSkill.SOFTWARE; case "technician03" -> TechnicianSkill.DATABASE; default -> TechnicianSkill.NETWORK; };
            t.configureAssignment(Set.of(skill), Technician.Availability.AVAILABLE, 5); t.setEnabled(true); users.saveAndFlush(t);
        }
    }
    @Test void automaticStrategiesPersistAndPermissionsHold() throws Exception {
        long id = incident("NETWORK");
        call("student01", "PUT", "/api/admin/assignment-strategy", Map.of("strategy", "LOAD_BASED"), 403);
        post("technician01", "/api/incidents/" + id + "/auto-assign", Map.of(), 403);
        var first = post("admin01", "/api/incidents/" + id + "/auto-assign", Map.of(), 200);
        assertEquals(tech("technician01"), first.get("assignedTechnician").get("id").asLong());
        call("admin01", "PUT", "/api/admin/assignment-strategy", Map.of("strategy", "LOAD_BASED"), 200);
        assertEquals("LOAD_BASED", get("admin01", "/api/admin/assignment-strategy", 200).get("strategy").asText());
        var second = post("admin01", "/api/incidents/" + incident("NETWORK") + "/auto-assign", Map.of(), 200);
        assertEquals(tech("technician02"), second.get("assignedTechnician").get("id").asLong());
        long security = incident("SECURITY"); post("admin01", "/api/incidents/" + security + "/auto-assign", Map.of(), 409);
        assertEquals("CLASSIFIED", get("student01", "/api/incidents/" + security, 200).get("status").asText());
    }
    @Test void transferApprovalChangesOwnerOnceAndPreservesProgress() throws Exception {
        long id = incident("NETWORK"); assign(id,"technician01");
        post("technician01", "/api/incidents/" + id + "/acknowledge", Map.of(), 200);
        post("technician01", "/api/incidents/" + id + "/start", Map.of(), 200);
        post("technician01", "/api/incidents/" + id + "/notes", Map.of("content","Preserved note","visibility","INTERNAL"), 200);
        var before = get("admin01", "/api/incidents/" + id, 200);
        post("technician02", "/api/incidents/" + id + "/transfer-requests", Map.of("technicianId", tech("technician04"), "reason", "OTHER", "handoverNotes", "No access"), 403);
        post("technician01", "/api/incidents/" + id + "/transfer-requests", Map.of("technicianId", tech("technician01"), "reason", "OTHER", "handoverNotes", "Self"), 409);
        long request = transfer(id,"technician01","technician02");
        post("technician01", "/api/incidents/" + id + "/transfer-requests", Map.of("technicianId", tech("technician04"), "reason", "OTHER", "handoverNotes", "Duplicate"), 409);
        post("admin01", "/api/admin/transfer-requests/" + request + "/approve", Map.of("notes","Approved"), 200);
        post("admin01", "/api/admin/transfer-requests/" + request + "/approve", Map.of("notes","Duplicate"), 409);
        get("technician01", "/api/incidents/" + id, 403);
        var after = get("technician02", "/api/incidents/" + id, 200);
        assertEquals(id, after.get("id").asLong()); assertEquals(before.get("status"),after.get("status"));
        assertEquals(before.get("createdAt"),after.get("createdAt")); assertEquals(before.get("acknowledgedAt"),after.get("acknowledgedAt")); assertEquals(before.get("notes"),after.get("notes"));
        assertTrue(after.toString().contains("TRANSFER_APPROVED"));
        assertEquals(1, jdbc.queryForObject("select count(*) from audit_events where incident_id = ? and action = 'TECHNICIAN_CHANGED'", Integer.class, id));
        assertFalse(get("student01", "/api/incidents/" + id, 200).toString().contains("Private transfer"));
    }
    @Test void rejectionCancellationAndStaleRequestDoNotChangeOwnership() throws Exception {
        long id = incident("NETWORK"); assign(id,"technician01"); long request = transfer(id,"technician01","technician02");
        post("admin01", "/api/admin/transfer-requests/" + request + "/reject", Map.of("notes"," "), 400);
        post("admin01", "/api/admin/transfer-requests/" + request + "/reject", Map.of("notes","Keep original ownership"), 200);
        assertEquals(tech("technician01"), get("student01", "/api/incidents/" + id, 200).get("assignedTechnician").get("id").asLong());
        long cancel = transfer(id,"technician01","technician02"); post("technician02", "/api/technician/transfer-requests/" + cancel + "/cancel", Map.of("notes","Not mine"), 403);
        post("technician01", "/api/technician/transfer-requests/" + cancel + "/cancel", Map.of("notes","No longer needed"), 200);
        long stale = transfer(id,"technician01","technician02"); assign(id,"technician04");
        post("admin01", "/api/admin/transfer-requests/" + stale + "/approve", Map.of("notes","Stale"), 409);
    }
    @Test void collaborationGrantsNotesButNotPrimaryPowersAndCountsWorkload() throws Exception {
        long id = incident("NETWORK"); assign(id,"technician01");
        post("technician01", "/api/incidents/" + id + "/acknowledge", Map.of(), 200); post("technician01", "/api/incidents/" + id + "/start", Map.of(), 200);
        long request = collaborate(id,"technician01","technician03");
        post("technician01", "/api/incidents/" + id + "/collaboration-requests", Map.of("technicianId",tech("technician01"),"requiredSkill","NETWORK","reason","Self","responsibility","Self"),409);
        post("technician01", "/api/incidents/" + id + "/collaboration-requests", Map.of("technicianId",tech("technician03"),"requiredSkill","DATABASE","reason","Duplicate","responsibility","Repeated"),409);
        post("admin01", "/api/admin/collaboration-requests/" + request + "/approve", Map.of("notes","Approved expertise"),200);
        post("admin01", "/api/admin/collaboration-requests/" + request + "/approve", Map.of("notes","Duplicate"),409);
        post("technician01", "/api/incidents/" + id + "/collaboration-requests", Map.of("technicianId",tech("technician03"),"requiredSkill","DATABASE","reason","Already a member","responsibility","Repeated"),409);
        var detail = get("technician03", "/api/incidents/" + id,200);
        assertEquals(tech("technician01"),detail.get("assignedTechnician").get("id").asLong()); assertFalse(detail.get("primaryOwner").asBoolean());
        post("technician03", "/api/incidents/" + id + "/notes", Map.of("content","Collaborator diagnosis","visibility","INTERNAL"),200);
        post("technician03", "/api/incidents/" + id + "/resolve", Map.of("summary","No","steps","No"),403);
        post("technician03", "/api/incidents/" + id + "/transfer-requests", Map.of("technicianId",tech("technician02"),"reason","OTHER","handoverNotes","No"),403);
        assertEquals(1,get("technician03","/api/technician/team-incidents",200).size());
        assertEquals(1,get("technician03","/api/technician/workload",200).get("activeCollaboration").asInt());
        assertEquals(1,get("technician01","/api/technician/workload",200).get("activePrimary").asInt());
        var student = get("student01","/api/incidents/"+id,200); assertEquals(0,student.get("collaborators").size()); assertFalse(student.toString().contains("Private database"));
        post("technician01", "/api/incidents/" + id + "/resolve", Map.of("summary","Fixed","steps","Tested"),200);
        assertEquals(0,get("technician03","/api/technician/workload",200).get("total").asInt());
        assertEquals(1,get("technician03","/api/technician/workload",200).get("resolvedCount").asInt());
    }
    @Test void approvalRechecksAvailabilityAndCapacity() throws Exception {
        long id=incident("NETWORK"); assign(id,"technician01"); long request=transfer(id,"technician01","technician02");
        service.profile(tech("technician02"),new AssignmentData.Profile(Set.of(TechnicianSkill.NETWORK),Technician.Availability.BUSY,5),email("admin01"));
        post("admin01","/api/admin/transfer-requests/"+request+"/approve",Map.of("notes","No longer available"),409);
        assertEquals("PENDING",get("admin01","/api/admin/transfer-requests",200).get(0).get("status").asText());
        service.profile(tech("technician02"),new AssignmentData.Profile(Set.of(TechnicianSkill.NETWORK),Technician.Availability.AVAILABLE,1),email("admin01"));
        assign(incident("NETWORK"),"technician02");
        post("admin01","/api/admin/transfer-requests/"+request+"/approve",Map.of("notes","At capacity"),409);
    }
    @Test void concurrentAssignmentsCannotConsumeTheSameLastSlot() throws Exception {
        service.profile(tech("technician02"),new AssignmentData.Profile(Set.of(TechnicianSkill.NETWORK),Technician.Availability.AVAILABLE,1),email("admin01"));
        long first=incident("NETWORK"), second=incident("NETWORK");
        CountDownLatch start=new CountDownLatch(1);
        try(var executor=Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<Boolean>> results=new ArrayList<>();
            for(long id:List.of(first,second)) results.add(executor.submit(()->{start.await();try{service.assign(id,tech("technician02"),false,email("admin01"));return true;}catch(IllegalStateException expected){return false;}}));
            start.countDown(); int successes=0;for(var result:results) if(result.get(15,TimeUnit.SECONDS))successes++;
            assertEquals(1,successes);
        }
        assertEquals(1,get("technician02","/api/technician/workload",200).get("total").asInt());
    }
    @Test void concurrentApprovalsFinalizeOnlyOnce() throws Exception {
        long id=incident("NETWORK"); assign(id,"technician01"); long request=transfer(id,"technician01","technician02");
        CountDownLatch start=new CountDownLatch(1);
        try(var executor=Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<Boolean>> results=new ArrayList<>();
            for(int n=0;n<2;n++)results.add(executor.submit(()->{start.await();try{service.review(request,false,AssignmentRequest.Status.APPROVED,new AssignmentData.Review("Concurrent approval"),email("admin01"));return true;}catch(IllegalStateException expected){return false;}}));
            start.countDown(); int successes=0;for(var result:results)if(result.get(15,TimeUnit.SECONDS))successes++;
            assertEquals(1,successes);
        }
        assertEquals(1,jdbc.queryForObject("select count(*) from incident_history where incident_id=? and action='TRANSFER_APPROVED'",Integer.class,id));
    }
    @Test void rejectedCollaborationKeepsTeamUnchanged() throws Exception {
        long id=incident("NETWORK"); assign(id,"technician01"); long request=collaborate(id,"technician01","technician03");
        post("admin01","/api/admin/collaboration-requests/"+request+"/reject",Map.of("notes","No database investigation needed"),200);
        get("technician03","/api/incidents/"+id,403);
        assertEquals(0,get("admin01","/api/incidents/"+id,200).get("collaborators").size());
        post("admin01","/api/admin/collaboration-requests/"+request+"/approve",Map.of("notes","Already rejected"),409);
    }
    @Test void upgradesLegacyTechnicianFieldsWithoutResettingProfilesOrCredentials() {
        long id=tech("technician04");
        String hash=jdbc.queryForObject("select password_hash from app_users where id=?",String.class,id);
        jdbc.execute("alter table app_users add column if not exists available boolean");
        jdbc.execute("alter table app_users add column if not exists specialization varchar(80)");
        jdbc.update("delete from technician_skills where technician_id=?",id);
        jdbc.update("update app_users set availability=null, available=false, specialization='HARDWARE' where id=?",id);
        service.run(null);
        assertEquals("UNAVAILABLE",jdbc.queryForObject("select availability from app_users where id=?",String.class,id));
        assertEquals("HARDWARE",jdbc.queryForObject("select skill from technician_skills where technician_id=?",String.class,id));
        service.profile(id,new AssignmentData.Profile(Set.of(TechnicianSkill.NETWORK,TechnicianSkill.SOFTWARE),Technician.Availability.BUSY,7),email("admin01"));
        service.selectStrategy(new AssignmentData.Strategy(AssignmentSettings.Mode.LOAD_BASED),email("admin01"));
        service.run(null);
        assertEquals(AssignmentSettings.Mode.LOAD_BASED,service.strategy(email("admin01")).strategy());
        assertEquals("BUSY",jdbc.queryForObject("select availability from app_users where id=?",String.class,id));
        assertEquals(2,jdbc.queryForObject("select count(*) from technician_skills where technician_id=?",Integer.class,id));
        assertTrue(hash.equals(jdbc.queryForObject("select password_hash from app_users where id=?",String.class,id)));
    }
}
