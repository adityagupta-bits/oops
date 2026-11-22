package com.bits.itsm;

import com.bits.itsm.incident.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="BITSOLVE_DB_TESTS", matches="true")
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@SpringBootTest(properties={"spring.datasource.url=${BITSOLVE_TEST_DB_URL}", "bitsolve.assignment.automatic-enabled=false"})
class ServiceSetupPersistenceTests {
    @Autowired org.springframework.test.web.servlet.MockMvc mvc;
    @Autowired com.bits.itsm.user.UserRepository users;
    @Autowired org.flywaydb.core.Flyway flyway;
    @Autowired CatalogService catalog;
    @Autowired JdbcTemplate jdbc;
    @Test @org.springframework.transaction.annotation.Transactional
    void administratorCreatesActivatesAndDisablesCustomService() throws Exception {
        var admin = users.findAll().stream().filter(u -> u.isEnabled() && u.getRole() == com.bits.itsm.user.Role.ADMIN).findFirst().orElseThrow();
        var student = users.findAll().stream().filter(u -> u.isEnabled() && u.getRole() == com.bits.itsm.user.Role.STUDENT).findFirst().orElseThrow();
        String body = "{\"code\":\"LIBRARY_PROXY\",\"label\":\"Library Proxy\",\"description\":\"Library remote access\",\"keywords\":\"library proxy\",\"criticality\":\"HIGH\",\"enabled\":false}";
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/admin/catalog/services").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(student.getEmail()).roles("STUDENT")).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()).contentType("application/json").content(body)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/admin/catalog/services").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(admin.getEmail()).roles("ADMIN")).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()).contentType("application/json").content(body)).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
        assertEquals("Library Proxy", jdbc.queryForObject("select label from catalog_entries where code='LIBRARY_PROXY'", String.class));
        for (boolean enabled : new boolean[]{true,false}) {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/admin/catalog/SERVICE/LIBRARY_PROXY").with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(admin.getEmail()).roles("ADMIN")).with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf()).contentType("application/json").content(body.replace("\"enabled\":false", "\"enabled\":"+enabled))).andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
            assertEquals(enabled, catalog.get("SERVICE", "LIBRARY_PROXY").isEnabled());
        }
    }
    @Test void validatesMigrationChecksumsAndSecuredCatalogApi() throws Exception {
        flyway.validate();
        var admin = users.findAll().stream().filter(u -> u.isEnabled() && u.getRole() == com.bits.itsm.user.Role.ADMIN).findFirst().orElseThrow();
        var student = users.findAll().stream().filter(u -> u.isEnabled() && u.getRole() == com.bits.itsm.user.Role.STUDENT).findFirst().orElseThrow();
        var request = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/admin/catalog/SERVICE/EMAIL")
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf())
            .contentType("application/json").content("{\"label\":\"Email Services\",\"enabled\":true}");
        mvc.perform(request.with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(admin.getEmail()).roles("ADMIN")))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
        mvc.perform(request.with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(student.getEmail()).roles("STUDENT")))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/admin/catalog")
            .with(org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user(admin.getEmail()).roles("ADMIN")))
            .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk());
    }
    @Test void configurationCommitsAndInitializationPreservesIt() {
        var before = catalog.get("SERVICE", "EMAIL");
        String label=before.getLabel(), keywords=before.getKeywords();
        boolean enabled=before.isEnabled();
        var criticality=before.getCriticality();
        try {
            assertThrows(IllegalArgumentException.class, () -> catalog.update("SERVICE", "EMAIL", label, true, null, "mail"));
            catalog.update("SERVICE", "EMAIL", label, true, Incident.Level.HIGH, "mail, mailbox");
            catalog.run(null);
            assertEquals("HIGH", jdbc.queryForObject("select criticality from catalog_entries where id='SERVICE:EMAIL'", String.class));
            assertTrue(catalog.get("SERVICE", "EMAIL").isEnabled());
            assertEquals("mail, mailbox", catalog.get("SERVICE", "EMAIL").getKeywords());
            assertEquals(1, jdbc.queryForObject("select count(*) from catalog_entries where id='SERVICE:EMAIL'", Integer.class));
        } finally { catalog.update("SERVICE", "EMAIL", label, enabled, criticality, keywords); }
    }
}
