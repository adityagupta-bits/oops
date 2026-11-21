package com.bits.itsm;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import tools.jackson.databind.json.JsonMapper;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="BITSOLVE_DB_TESTS", matches="true")
@SpringBootTest(properties={"spring.datasource.url=${BITSOLVE_TEST_DB_URL}","bitsolve.demo.seed-enabled=true"})
@AutoConfigureMockMvc @ActiveProfiles("dev")
class PostgresSubmissionTests {
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    private final JsonMapper json=JsonMapper.builder().build();
    @Test void savesTechnicianAndAuthenticatesIt() throws Exception {
        String email="qa"+UUID.randomUUID().toString().replace("-","")+"@hyderabad.bits-pilani.ac.in";
        String password=UUID.randomUUID().toString();
        String body=json.writeValueAsString(Map.of("name","QA Technician","email",email,"password",password,"role","TECHNICIAN","skill","NETWORK"));
        mvc.perform(post("/api/admin/users").with(user("student01@hyderabad.bits-pilani.ac.in").roles("STUDENT")).with(csrf()).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/users").with(user("admin01@hyderabad.bits-pilani.ac.in").roles("ADMIN")).with(csrf()).contentType("application/json").content(body)).andExpect(status().isOk());
        assertEquals(1,jdbc.queryForObject("select count(*) from app_users u join technician_skills s on s.technician_id=u.id where u.email=? and u.role='TECHNICIAN' and s.skill='NETWORK'",Integer.class,email));
        mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json").content(json.writeValueAsString(Map.of("email",email,"password",password,"role","TECHNICIAN")))).andExpect(status().isOk()).andExpect(jsonPath("$.role").value("TECHNICIAN"));
        mvc.perform(post("/api/admin/users").with(user("admin01@hyderabad.bits-pilani.ac.in").roles("ADMIN")).with(csrf()).contentType("application/json").content(body)).andExpect(status().isConflict());
    }
    @Test void savesUncertainReportWithoutSeverityAndShowsItToReporterAndAdmin() throws Exception {
        var result=mvc.perform(post("/api/incidents").with(user("student01@hyderabad.bits-pilani.ac.in").roles("STUDENT")).with(csrf()).contentType("application/json").content(json.writeValueAsString(Map.of("title","Unusual issue","description","Something unexpected happened while using my device."))))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.priority").value("PENDING")).andExpect(jsonPath("$.needsClassificationReview").value(true)).andReturn();
        long id=json.readTree(result.getResponse().getContentAsString()).get("id").asLong();
        assertEquals(1,jdbc.queryForObject("select count(*) from incidents where id=?",Integer.class,id));
        for(String role: new String[]{"STUDENT","ADMIN"}) {
            String email=(role.equals("ADMIN")?"admin01":"student01")+"@hyderabad.bits-pilani.ac.in";
            mvc.perform(get("/api/incidents/"+id).with(user(email).roles(role))).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));
        }
    }
}
