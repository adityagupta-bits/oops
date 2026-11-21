package com.bits.itsm;

import java.util.Map;
import java.util.stream.Collectors;
import com.bits.itsm.user.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.json.JsonMapper;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Run only against a dedicated PostgreSQL test database, never the development database.
@EnabledIfEnvironmentVariable(named = "BITSOLVE_DB_TESTS", matches = "true")
@SpringBootTest(properties = {"spring.datasource.url=${BITSOLVE_TEST_DB_URL}", "bitsolve.demo.seed-enabled=true", "spring.jpa.show-sql=false"})
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class PostgresAuthenticationTests {
    @Autowired private UserRepository users;
    @Autowired private DemoUserSeeder seeder;
    @Autowired private PasswordEncoder passwords;
    @Autowired private MockMvc mvc;
    @Value("${DEMO_USER_PASSWORD}") private String password;

    @Test
    void registersStudentAndRejectsInvalidRegistration() throws Exception {
        String email = "registration.qa@hyderabad.bits-pilani.ac.in";
        var json = JsonMapper.builder().build();
        var body = new java.util.HashMap<String, String>(Map.of("name", "Registration QA", "email", email,
                "password", password, "confirmPassword", password, "role", "ADMIN"));
        // Use a guaranteed letter and number for the registration strength check.
        body.put("password", password + "A1");
        body.put("confirmPassword", password + "A1");
        try {
            mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isForbidden());
            mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isCreated());
            var saved = users.findByEmail(email).orElseThrow();
            assertEquals(Role.STUDENT, saved.getRole());
            assertTrue(passwords.matches(password + "A1", saved.getPasswordHash()));
            mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isConflict());
            body.put("confirmPassword", "different");
            mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isBadRequest());
            body.put("email", "qa@example.com");
            mvc.perform(post("/api/auth/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body))).andExpect(status().isBadRequest());
            mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("email", email, "password", password + "A1", "role", "ADMIN")))).andExpect(status().isUnauthorized());
            var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("email", email, "password", password + "A1", "role", "STUDENT")))).andExpect(status().isOk()).andReturn();
            var session = (MockHttpSession) result.getRequest().getSession(false);
            mvc.perform(get("/api/technician/incidents").session(session)).andExpect(status().isForbidden());
            mvc.perform(get("/api/admin/users").session(session)).andExpect(status().isForbidden());
        } finally {
            users.findByEmail(email).ifPresent(users::delete);
        }
    }

    @Test
    void persistsNinePolymorphicAccountsAndDoesNotResetThemOnReseeding() {
        assertEquals(9, users.count());
        assertEquals(4, users.findAll().stream().filter(Student.class::isInstance).count());
        assertEquals(4, users.findAll().stream().filter(Technician.class::isInstance).count());
        assertEquals(1, users.findAll().stream().filter(Administrator.class::isInstance).count());
        Map<Long, String> hashes = users.findAll().stream().collect(Collectors.toMap(User::getId, User::getPasswordHash));
        for (User user : users.findAll()) assertTrue(passwords.matches(password, user.getPasswordHash()));
        seeder.run(null);
        seeder.run(null);
        assertEquals(9, users.count());
        // Compare booleans so a failure report cannot print hashes.
        assertTrue(hashes.equals(users.findAll().stream().collect(Collectors.toMap(User::getId, User::getPasswordHash))));
    }

    @Test
    void databaseEnforcesNormalizedEmailUniqueness() {
        String email = "STUDENT01@HYDERABAD.BITS-PILANI.AC.IN";
        assertThrows(DataIntegrityViolationException.class, () -> users.saveAndFlush(
                new Student("Duplicate", email, passwords.encode(password), "DUPLICATE")));
        assertEquals(9, users.count());
    }

    @Test
    void authenticatesPersistedRolesAndLogsOut() throws Exception {
        var json = JsonMapper.builder().build();
        for (var account : Map.of("student01", "STUDENT", "technician01", "TECHNICIAN", "admin01", "ADMIN").entrySet()) {
            var result = mvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content(json.writeValueAsString(Map.of("email", account.getKey() + "@hyderabad.bits-pilani.ac.in", "password", password))))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.id").isNumber())
                    .andExpect(jsonPath("$.role").value(account.getValue()))
                    .andExpect(jsonPath("$.passwordHash").doesNotExist()).andReturn();
            var session = (MockHttpSession) result.getRequest().getSession(false);
            mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk());
            if (!account.getValue().equals("ADMIN")) {
                mvc.perform(get("/api/admin/users").session(session)).andExpect(status().isForbidden());
            }
            mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isOk());
            assertTrue(session.isInvalid());
            mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        }
    }
}
