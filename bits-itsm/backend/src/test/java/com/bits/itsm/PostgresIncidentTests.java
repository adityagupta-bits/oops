package com.bits.itsm;

import java.util.Map;
import com.bits.itsm.user.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@EnabledIfEnvironmentVariable(named = "BITSOLVE_DB_TESTS", matches = "true")
@SpringBootTest(properties = {"spring.datasource.url=${BITSOLVE_TEST_DB_URL}", "bitsolve.demo.seed-enabled=true", "spring.jpa.show-sql=false"})
@AutoConfigureMockMvc @ActiveProfiles("dev")
class PostgresIncidentTests {
    @org.junit.jupiter.api.BeforeEach void configureTestService() {
        // Explicit test fixture; production initialization never supplies criticality.
        testCatalog.update("SERVICE", "CAMPUS_WIFI", "Campus Wi-Fi", true, com.bits.itsm.incident.Incident.Level.MEDIUM);
    }
    @Autowired com.bits.itsm.incident.CatalogService testCatalog;
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired com.bits.itsm.support.IncidentLookup incidentLookup;
    final JsonMapper json = JsonMapper.builder().build();
    String email(String name) { return name + "@hyderabad.bits-pilani.ac.in"; }
    JsonNode postAs(String name, String path, Object body, int status) throws Exception {
        var result = mvc.perform(post("/api/incidents" + path).with(user(email(name))).with(csrf())
                        .contentType("application/json").content(json.writeValueAsString(body)))
                .andExpect(status().is(status)).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }
    JsonNode getAs(String name, String path, int status) throws Exception {
        var result = mvc.perform(get("/api/incidents" + path).with(user(email(name))))
                .andExpect(status().is(status)).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }
    Map<String, Object> payload() { return Map.of("title", "Network problem", "description", "Campus network is unavailable in the library.", "category", "NETWORK", "affectedService", "CAMPUS_WIFI", "impact", "HIGH", "urgency", "MEDIUM", "reporterId", 99999, "status", "CLOSED", "assignedTechnician", 99999); }
    long create() throws Exception { return postAs("student01", "", payload(), 201).get("id").asLong(); }
    Map<String, Object> review(String category) { return Map.of("category", category, "affectedService", "CAMPUS_WIFI", "impact", "HIGH", "urgency", "MEDIUM", "reason", "Administrator reviewed the reported impact and urgency."); }
    void assign(long id) throws Exception {
        postAs("admin01", "/" + id + "/reclassify", review("NETWORK"), 200);
        postAs("admin01", "/" + id + "/assign", Map.of("technicianId", users.findByEmail(email("technician04")).orElseThrow().getId()), 200);
    }
    void investigate(long id) throws Exception { assign(id); postAs("technician04", "/" + id + "/acknowledge", Map.of(), 200); postAs("technician04", "/" + id + "/start", Map.of(), 200); }
    void resolve(long id) throws Exception { postAs("technician04", "/" + id + "/resolve", Map.of("summary", "Replaced cable", "steps", "Tested connectivity"), 200); }

    @Test void creationUsesSessionIdentityAndRestrictsReads() throws Exception {
        long id = create(); JsonNode incident = getAs("student01", "/" + id, 200);
        assertEquals("NEW", incident.get("status").asText()); assertEquals("PENDING", incident.get("priority").asText());
        assertEquals(users.findByEmail(email("student01")).orElseThrow().getId().longValue(), incident.get("reporter").get("id").asLong());
        assertTrue(incident.get("assignedTechnician").isNull());
        getAs("student02", "/" + id, 403); getAs("technician02", "/" + id, 403); getAs("admin01", "/" + id, 200);
        JsonNode mine = getAs("student01", "/my?search=" + id + "&status=NEW&category=NETWORK&priority=PENDING", 200);
        assertTrue(mine.isArray()); assertTrue(mine.size() > 0);
        for (JsonNode row : getAs("student02", "/my", 200)) assertNotEquals(id, row.get("id").asLong());
        assertFalse(incident.toString().contains("password"));
        mvc.perform(get("/api/incidents/" + id)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/incidents").with(user(email("student01"))).contentType("application/json").content(json.writeValueAsString(payload()))).andExpect(status().isForbidden());
    }
    @Test void validatesPayloadAndRole() throws Exception {
        postAs("student01", "", Map.of(), 400);
        var invalid = new java.util.HashMap<>(payload()); invalid.put("category", "FORGED"); postAs("student01", "", invalid, 400);
        invalid = new java.util.HashMap<>(payload()); invalid.put("affectedService", "FORGED"); postAs("student01", "", invalid, 400);
        invalid = new java.util.HashMap<>(payload()); invalid.put("description", "                    "); postAs("student01", "", invalid, 400);
        postAs("technician04", "", payload(), 403); postAs("admin01", "", payload(), 403);
        getAs("student01", "/999999999", 404);
    }
    @Test void lifecyclePersistsHistoryAndFeedbackAndRejectsUnauthorizedActions() throws Exception {
        long id = create();
        postAs("student01", "/" + id + "/verify", Map.of("confirmed", true), 409);
        postAs("admin01", "/" + id + "/close", Map.of(), 409);
        postAs("student01", "/" + id + "/classify", Map.of("category", "NETWORK"), 403);
        assign(id);
        postAs("technician02", "/" + id + "/acknowledge", Map.of(), 403);
        postAs("technician04", "/" + id + "/resolve", Map.of("summary", "Fixed", "steps", "Tested"), 409);
        postAs("technician04", "/" + id + "/acknowledge", Map.of(), 200);
        postAs("technician04", "/" + id + "/start", Map.of(), 200);
        postAs("technician04", "/" + id + "/resolve", Map.of("summary", "Fixed", "steps", " "), 400);
        resolve(id);
        postAs("student02", "/" + id + "/verify", Map.of("confirmed", true), 403);
        postAs("student01", "/" + id + "/verify", Map.of("confirmed", true), 200);
        postAs("student01", "/" + id + "/close", Map.of(), 403);
        postAs("admin01", "/" + id + "/close", Map.of(), 200);
        postAs("student01", "/" + id + "/feedback", Map.of("rating", 6), 400);
        postAs("student02", "/" + id + "/feedback", Map.of("rating", 5), 403);
        postAs("student01", "/" + id + "/feedback", Map.of("rating", 5, "comment", "Helpful"), 200);
        postAs("student01", "/" + id + "/feedback", Map.of("rating", 4), 409);
        JsonNode saved = getAs("student01", "/" + id, 200);
        assertEquals("CLOSED", saved.get("status").asText()); assertEquals(5, saved.get("feedback").get("rating").asInt());
        assertEquals(11, saved.get("history").size());
        assertTrue(saved.get("history").toString().contains("ADMIN_RECLASSIFIED"));
        assertFalse(saved.get("closedAt").isNull()); assertFalse(saved.get("verifiedAt").isNull());
        postAs("technician04", "/" + id + "/start", Map.of(), 409);
        assertEquals(saved.get("history"), getAs("admin01", "/" + id, 200).get("history"));
    }
    @Test void privateNotesSupportRepliesAndRejectedResolutionPersist() throws Exception {
        long id = create(); investigate(id);
        postAs("technician04", "/" + id + "/notes", Map.of("content", "Private diagnosis", "visibility", "INTERNAL"), 200);
        postAs("technician04", "/" + id + "/notes", Map.of("content", "Checking connection", "visibility", "STUDENT_VISIBLE"), 200);
        JsonNode student = getAs("student01", "/" + id, 200);
        assertEquals(1, student.get("notes").size()); assertFalse(student.toString().contains("Private diagnosis")); assertFalse(student.toString().contains("INTERNAL"));
        assertEquals(2, getAs("admin01", "/" + id, 200).get("notes").size());
        postAs("technician04", "/" + id + "/information", Map.of("content", "Which device?"), 200);
        postAs("student02", "/" + id + "/reply", Map.of("content", "Unrelated reply"), 403);
        postAs("student01", "/" + id + "/reply", Map.of("content", "My laptop"), 200);
        resolve(id);
        postAs("student01", "/" + id + "/verify", Map.of("confirmed", false, "reason", " "), 400);
        postAs("student01", "/" + id + "/verify", Map.of("confirmed", false, "reason", "Connection still drops"), 200);
        JsonNode reopened = getAs("technician04", "/" + id, 200);
        assertEquals("IN_PROGRESS", reopened.get("status").asText()); assertTrue(reopened.get("resolvedAt").isNull());
        assertTrue(reopened.toString().contains("Connection still drops")); assertTrue(reopened.toString().contains("Replaced cable"));
        resolve(id); postAs("student01", "/" + id + "/verify", Map.of("confirmed", true), 200);
    }
    @Test void assignmentRejectsStudentsDisabledAndUnavailableTechnicians() throws Exception {
        long id = create(); postAs("admin01", "/" + id + "/reclassify", review("HARDWARE"), 200);
        JsonNode historyBefore = getAs("admin01", "/" + id, 200).get("history");
        postAs("admin01", "/" + id + "/assign", Map.of("technicianId", users.findByEmail(email("student02")).orElseThrow().getId()), 400);
        Technician technician = (Technician) users.findByEmail(email("technician04")).orElseThrow();
        try {
            technician.setAvailable(false); users.saveAndFlush(technician);
            postAs("admin01", "/" + id + "/assign", Map.of("technicianId", technician.getId()), 409);
            technician.setAvailable(true); technician.setEnabled(false); users.saveAndFlush(technician);
            postAs("admin01", "/" + id + "/assign", Map.of("technicianId", technician.getId()), 409);
        } finally { technician.setAvailable(true); technician.setEnabled(true); users.saveAndFlush(technician); }
        assertEquals("CLASSIFIED", getAs("admin01", "/" + id, 200).get("status").asText());
        assertEquals(historyBefore, getAs("admin01", "/" + id, 200).get("history"));
    }
    @Test void adminSlaUsesCapturedDeadlinesAndRejectsOtherRoles() throws Exception {
        long id = create();
        JsonNode incident = postAs("admin01", "/" + id + "/reclassify", review("NETWORK"), 200);
        var response = mvc.perform(get("/api/admin/sla").with(user(email("admin01")).roles("ADMIN")))
                .andExpect(status().isOk()).andReturn();
        JsonNode row = java.util.stream.StreamSupport.stream(json.readTree(response.getResponse().getContentAsString()).spliterator(), false)
                .filter(item -> item.get("incidentId").asLong() == id).findFirst().orElseThrow();
        var created = java.time.Instant.parse(incident.get("createdAt").asText());
        assertEquals(created.plusSeconds(15 * 60), java.time.Instant.parse(row.get("responseDeadline").asText()));
        assertEquals(created.plusSeconds(2 * 60 * 60), java.time.Instant.parse(row.get("resolutionDeadline").asText()));
        assertEquals("ON_TRACK", row.get("responseStatus").asText());
        assertEquals("ON_TRACK", row.get("resolutionStatus").asText());
        var snapshot = incidentLookup.findById(id).orElseThrow();
        assertEquals(created.plusSeconds(15 * 60), snapshot.responseDeadline());
        assertEquals(created.plusSeconds(2 * 60 * 60), snapshot.resolutionDeadline());
        mvc.perform(get("/api/admin/sla").with(user(email("student01")).roles("STUDENT"))).andExpect(status().isForbidden());
        mvc.perform(get("/api/admin/sla").with(user(email("technician01")).roles("TECHNICIAN"))).andExpect(status().isForbidden());
    }
    @Test void reporterCanEditOnlyTheirOwnUnclassifiedReport() throws Exception {
        long id = create();
        Map<String, String> change = Map.of("title", "Updated network problem", "description", "The library network is unavailable on both my devices.");
        postAs("student02", "/" + id + "/edit", change, 403);
        assertEquals("Updated network problem", postAs("student01", "/" + id + "/edit", change, 200).get("title").asText());
        postAs("admin01", "/" + id + "/reclassify", review("NETWORK"), 200);
        postAs("student01", "/" + id + "/edit", change, 409);
    }
}
