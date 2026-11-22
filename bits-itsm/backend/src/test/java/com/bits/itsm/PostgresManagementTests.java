package com.bits.itsm;

import com.bits.itsm.event.*;
import com.bits.itsm.sla.ScheduledEvents;
import com.bits.itsm.user.*;
import java.time.Instant;
import java.util.*;
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
class PostgresManagementTests {
    @org.junit.jupiter.api.BeforeEach void configureTestService() {
        // Explicit test fixture; production initialization never supplies criticality.
        testCatalog.update("SERVICE", "CAMPUS_WIFI", "Campus Wi-Fi", true, com.bits.itsm.incident.Incident.Level.MEDIUM);
    }
    @Autowired com.bits.itsm.incident.CatalogService testCatalog;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired ScheduledEvents scheduled;
    @Autowired EventBus bus;
    final JsonMapper json = JsonMapper.builder().build();
    String email(String name) { return name + "@hyderabad.bits-pilani.ac.in"; }
    JsonNode call(String name, String method, String path, Object body, int status) throws Exception {
        String role = name.startsWith("admin") ? "ADMIN" : name.startsWith("technician") ? "TECHNICIAN" : "STUDENT";
        var request = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request(org.springframework.http.HttpMethod.valueOf(method), "/api/" + path);
        var result = mvc.perform(request.with(user(email(name)).roles(role)).with(csrf()).contentType("application/json").content(json.writeValueAsString(body)))
                .andExpect(status().is(status)).andReturn();
        return json.readTree(result.getResponse().getContentAsString());
    }
    Map<String, Object> review() { return Map.of("category", "NETWORK", "affectedService", "CAMPUS_WIFI", "impact", "HIGH", "urgency", "MEDIUM", "reason", "Administrator reviewed management fixture.", "criticality", "LOW"); }
    long create() throws Exception {
        return call("student01", "POST", "incidents", Map.of("title", "Wifi router outage", "description", "The wifi router cannot connect to the internet in the library.", "category", "NETWORK", "affectedService", "CAMPUS_WIFI", "impact", "HIGH", "urgency", "MEDIUM"), 201).get("id").asLong();
    }
    @Test void unconfiguredServiceIsNeverDefaultedAndRequiresAdministratorConfiguration() throws Exception {
        jdbc.update("delete from catalog_entries where id='SERVICE:CAMPUS_WIFI'");
        try {
            testCatalog.run(null);
            assertNull(testCatalog.get("SERVICE", "CAMPUS_WIFI").getCriticality());
            assertFalse(testCatalog.get("SERVICE", "CAMPUS_WIFI").isEnabled());
            testCatalog.run(null);
            assertNull(testCatalog.get("SERVICE", "CAMPUS_WIFI").getCriticality());
            call("admin01", "PUT", "admin/catalog/SERVICE/CAMPUS_WIFI", Map.of("label", "Campus Wi-Fi", "enabled", true), 400);
            // Even malformed legacy data with enabled=true cannot bypass business validation.
            jdbc.update("update catalog_entries set enabled=true where id='SERVICE:CAMPUS_WIFI'");
            long before = jdbc.queryForObject("select count(*) from incidents", Long.class);
            call("student01", "POST", "incidents", Map.of("title", "Wifi unavailable", "description", "Campus wifi is unavailable on all my devices.", "category", "NETWORK", "affectedService", "CAMPUS_WIFI", "impact", "HIGH", "urgency", "MEDIUM"), 201);
            var config = call("admin01", "GET", "admin/priority-strategy", Map.of(), 200);
            call("admin01", "POST", "admin/priority-strategy/preview", Map.of("configuration", config, "impact", "HIGH", "urgency", "MEDIUM", "affectedService", "CAMPUS_WIFI"), 409);
            assertEquals(before + 1, jdbc.queryForObject("select count(*) from incidents", Long.class));
            for (String level : List.of("LOW", "MEDIUM", "HIGH")) {
                call("admin01", "PUT", "admin/catalog/SERVICE/CAMPUS_WIFI", Map.of("label", "Campus Wi-Fi", "enabled", true, "criticality", level), 200);
                testCatalog.run(null);
                assertEquals(level, testCatalog.get("SERVICE", "CAMPUS_WIFI").getCriticality().name());
            }
            long id = create();
            assertEquals("HIGH", call("admin01", "POST", "incidents/" + id + "/reclassify", review(), 200).get("criticality").asText());
        } finally { testCatalog.update("SERVICE", "CAMPUS_WIFI", "Campus Wi-Fi", true, com.bits.itsm.incident.Incident.Level.MEDIUM); }
    }
    @Test void notificationReadStateAndRecipientAuthorizationArePersisted() throws Exception {
        long id = create();
        JsonNode notifications = call("admin01", "GET", "notifications", Map.of(), 200);
        String key = null;
        for (JsonNode row : notifications) if (row.get("incidentId").asLong() == id) { key = row.get("id").asText(); break; }
        assertNotNull(key);
        call("student02", "POST", "notifications/" + key + "/read", Map.of(), 404);
        call("admin01", "POST", "notifications/" + key + "/read", Map.of(), 200);
        assertNotNull(jdbc.queryForObject("select read_at from notification_deliveries where id = ?", java.sql.Timestamp.class, key));
        assertTrue(jdbc.queryForObject("select count(*) from notification_deliveries where incident_id = ? and channel = 'EMAIL' and delivery_status = 'PENDING'", Long.class, id) > 0);
        assertTrue(jdbc.queryForObject("select count(*) from audit_events where incident_id = ? and action = 'CREATED' and next = 'NEW'", Long.class, id) > 0);
    }
    @Test void switchingPriorityStrategyDoesNotRecalculateExistingIncidents() throws Exception {
        Map<String, Object> weighted = Map.of("strategy", "WEIGHTED", "impactWeight", .4, "urgencyWeight", .4, "criticalityWeight", .2);
        Map<String, Object> multiply = Map.of("strategy", "MULTIPLICATIVE", "impactWeight", .4, "urgencyWeight", .4, "criticalityWeight", .2);
        try {
            call("admin01", "PUT", "admin/catalog/SERVICE/CAMPUS_WIFI", Map.of("label", "Campus Wi-Fi", "enabled", true, "criticality", "LOW"), 200);
            call("admin01", "PUT", "admin/priority-strategy", multiply, 200);
            long first = create();
            JsonNode original = call("admin01", "POST", "incidents/" + first + "/reclassify", review(), 200);
            assertEquals("P3", original.get("priority").asText());
            call("admin01", "PUT", "admin/priority-strategy", weighted, 200);
            long second = create();
            assertEquals("P2", call("admin01", "POST", "incidents/" + second + "/reclassify", review(), 200).get("priority").asText());
            JsonNode reloaded = call("admin01", "GET", "incidents/" + first, Map.of(), 200);
            assertEquals(original.get("priority"), reloaded.get("priority"));
            assertEquals(original.get("responseDeadline"), reloaded.get("responseDeadline"));
        } finally { call("admin01", "PUT", "admin/priority-strategy", multiply, 200); call("admin01", "PUT", "admin/catalog/SERVICE/CAMPUS_WIFI", Map.of("label", "Campus Wi-Fi", "enabled", true, "criticality", "MEDIUM"), 200); }
    }
    @Test void catalogSettingsAndUserAdministrationUseDatabaseAndRejectOtherRoles() throws Exception {
        call("student01", "GET", "admin/users", Map.of(), 403);
        String local = "qa" + UUID.randomUUID().toString().replace("-", "");
        var created = call("admin01", "POST", "admin/users", Map.of("name", "QA Student", "email", email(local), "password", UUID.randomUUID().toString(), "role", "STUDENT", "studentNumber", "TEST-0923"), 200);
        assertFalse(created.toString().contains("password"));
        call("admin01", "PUT", "admin/users/" + created.get("id").asLong(), Map.of("name", "QA Student", "enabled", false), 200);
        call(local, "GET", "notifications", Map.of(), 401);
        long self = users.findByEmail(email("admin01")).orElseThrow().getId();
        call("admin01", "PUT", "admin/users/" + self, Map.of("name", "Admin", "enabled", false), 409);
        try {
            call("admin01", "PUT", "admin/catalog/SERVICE/CAMPUS_WIFI", Map.of("label", "Campus Wi-Fi", "enabled", true, "criticality", "HIGH"), 200);
            long id = create();
            assertEquals("HIGH", call("admin01", "POST", "incidents/" + id + "/reclassify", review(), 200).get("criticality").asText());
        } finally { call("admin01", "PUT", "admin/catalog/SERVICE/CAMPUS_WIFI", Map.of("label", "Campus Wi-Fi", "enabled", true, "criticality", "MEDIUM"), 200); }
    }
    @Test void scheduledEventClaimSurvivesServiceReconstruction() throws Exception {
        long id = create(); String key = id + ":TEST:" + UUID.randomUUID();
        IncidentEvent event = IncidentEvent.system(EventType.SLA_WARNING, id, "ON_TRACK", "AT_RISK", "Test response warning", Instant.now());
        scheduled.publishOnce(key, event);
        long before = jdbc.queryForObject("select count(*) from audit_events where incident_id = ?", Long.class, id);
        new ScheduledEvents(jdbc, bus).publishOnce(key, event);
        assertEquals(before, jdbc.queryForObject("select count(*) from audit_events where incident_id = ?", Long.class, id));
        assertEquals(1, jdbc.queryForObject("select count(*) from scheduled_events where id = ?", Integer.class, key));
    }
    @Test void migrationCanAdoptExistingTablesWithoutRemovingRecords() throws Exception {
        long id = create();
        String sql;
        try (var stream = getClass().getResourceAsStream("/db/migration/V1__persistent_campus_support.sql")) {
            sql = new String(Objects.requireNonNull(stream).readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        }
        jdbc.execute(sql);
        assertEquals(1, jdbc.queryForObject("select count(*) from incidents where id = ?", Integer.class, id));
        assertEquals(1, jdbc.queryForObject("select count(*) from flyway_schema_history where version = '1' and success", Integer.class));
    }
    @Test void reportsAndCategorizationReflectSavedIncidents() throws Exception {
        long id = create();
        var incident = call("admin01", "GET", "incidents/" + id, Map.of(), 200);
        assertEquals("NETWORK", incident.get("categorySuggestion").get("category").asText());
        var report = call("admin01", "GET", "admin/reports", Map.of(), 200);
        assertEquals(jdbc.queryForObject("select count(*) from incidents", Long.class).longValue(), report.get("total").asLong());
        assertTrue(call("admin01", "GET", "admin/incidents/" + id + "/related", Map.of(), 200).isArray());
    }

    @Test void allFourStrategiesPreviewSwitchAndAuditWithoutChangingHistory() throws Exception {
        var original = call("admin01", "GET", "admin/priority-strategy", Map.of(), 200);
        Map<String,Object> config = new HashMap<>(Map.of(
            "strategy", "MULTIPLICATIVE", "impactWeight", .4, "urgencyWeight", .4, "criticalityWeight", .2,
            "multiplicativeThresholds", Map.of("p1",18,"p2",12,"p3",4), "weightedThresholds", Map.of("p1",75,"p2",50,"p3",25),
            "matrix", List.of("P4","P3","P2","P3","P2","P1","P2","P1","P1"), "criticalBoost", 1,
            "rules", List.of(Map.of("condition","HIGH_IMPACT","priority","P1")), "fallback", "P4"));
        long historical = create();
        var before = call("admin01", "POST", "incidents/" + historical + "/reclassify", review(), 200);
        try {
            for (String mode : List.of("MULTIPLICATIVE","WEIGHTED","MATRIX","RULE_BASED")) {
                config.put("strategy",mode);
                var preview = Map.of("configuration",config,"impact","HIGH","urgency","LOW","affectedService","CAMPUS_WIFI");
                var savedBefore = call("admin01","GET","admin/priority-strategy",Map.of(),200);
                String expected = mode.equals("MULTIPLICATIVE") ? "P3" : mode.equals("RULE_BASED") ? "P1" : "P2";
                assertEquals(expected, call("admin01","POST","admin/priority-strategy/preview",preview,200).get("priority").asText());
                assertEquals(savedBefore, call("admin01","GET","admin/priority-strategy",Map.of(),200));
                call("student01","PUT","admin/priority-strategy",config,403);
                call("technician01","POST","admin/priority-strategy/preview",preview,403);
                call("admin01","PUT","admin/priority-strategy",config,200);
                assertEquals(mode,call("admin01","GET","admin/priority-strategy",Map.of(),200).get("strategy").asText());
                long id = call("student01","POST","incidents",Map.of("title","Runtime priority test","description","The campus network is unavailable in the library.","category","NETWORK","affectedService","CAMPUS_WIFI","impact","HIGH","urgency","LOW","criticality","HIGH"),201).get("id").asLong();
                assertEquals(expected,call("admin01","POST","incidents/"+id+"/reclassify",Map.of("category","NETWORK","affectedService","CAMPUS_WIFI","impact","HIGH","urgency","LOW","reason","Administrator reviewed strategy fixture.","criticality","HIGH"),200).get("priority").asText());
            }
            config.put("matrix", List.of("P1"));
            call("admin01","PUT","admin/priority-strategy",config,400);
            assertTrue(jdbc.queryForObject("select count(*) from audit_events where action='PRIORITY_CONFIGURATION_CHANGED'", Long.class) >= 4);
            var after = call("admin01","GET","incidents/"+historical,Map.of(),200);
            assertEquals(before.get("priority"),after.get("priority")); assertEquals(before.get("responseDeadline"),after.get("responseDeadline")); assertEquals(before.get("resolutionDeadline"),after.get("resolutionDeadline"));
        } finally { call("admin01","PUT","admin/priority-strategy",original,200); }
    }
}
