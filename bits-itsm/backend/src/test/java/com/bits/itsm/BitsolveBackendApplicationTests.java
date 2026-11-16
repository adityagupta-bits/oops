package com.bits.itsm;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import com.bits.itsm.auth.AuthController;
import com.bits.itsm.auth.AuthService;
import com.bits.itsm.auth.SecurityConfig;
import com.bits.itsm.user.UserRepository;
import com.bits.itsm.user.Student;
import com.bits.itsm.user.Technician;
import com.bits.itsm.user.Administrator;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.mockito.Mockito.when;
import static org.junit.jupiter.api.Assertions.*;

@WebMvcTest({HealthController.class, AuthController.class})
@Import({SecurityConfig.class, AuthService.class, BitsolveBackendApplicationTests.TestEndpoints.class})
class BitsolveBackendApplicationTests {

    @Autowired
    private MockMvc mockMvc;
    @Autowired
    private PasswordEncoder passwords;
    @MockitoBean
    private UserRepository users;
    private final JsonMapper json = JsonMapper.builder().build();
    private String password;
    private Student student;

    @BeforeEach
    void accounts() {
        password = UUID.randomUUID().toString();
        String hash = passwords.encode(password);
        student = new Student("Test Student", "student01@hyderabad.bits-pilani.ac.in", hash, "TEST-01");
        var technician = new Technician("Test Technician", "technician01@hyderabad.bits-pilani.ac.in", hash, "NETWORK");
        var admin = new Administrator("Test Admin", "admin01@hyderabad.bits-pilani.ac.in", hash, "Campus IT");
        for (var account : java.util.List.of(student, technician, admin)) {
            when(users.findByEmail(account.getEmail())).thenReturn(Optional.of(account));
        }
    }

    private String credentials(String email, String secret) {
        return json.writeValueAsString(Map.of("email", email, "password", secret));
    }

    @Test
    void healthReturnsRunningMessage() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(content().json("{\"message\":\"BITSolve backend is running\"}"));
    }

    @ParameterizedTest
    @CsvSource({"student01,STUDENT", "technician01,TECHNICIAN", "admin01,ADMIN"})
    void authenticatesAllRolesAndRestoresSession(String localPart, String role) throws Exception {
        var result = mockMvc.perform(post("/api/auth/login").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(localPart.toUpperCase() + "@HYDERABAD.BITS-PILANI.AC.IN", password)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.role").value(role))
                .andExpect(jsonPath("$.passwordHash").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist()).andReturn();
        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        mockMvc.perform(get("/api/auth/me").session(session)).andExpect(status().isOk())
                .andExpect(jsonPath("$.role").value(role));
    }

    @Test
    void wrongUnknownAndDisabledAccountsReturnSameGenericError() throws Exception {
        for (String email : new String[]{student.getEmail(), "unknown@hyderabad.bits-pilani.ac.in"}) {
            mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content(credentials(email, UUID.randomUUID().toString())))
                    .andExpect(status().isUnauthorized())
                    .andExpect(content().json("{\"message\":\"Invalid email or password.\"}"));
        }
        student.setEnabled(false);
        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(credentials(student.getEmail(), password)))
                .andExpect(status().isUnauthorized())
                .andExpect(content().json("{\"message\":\"Invalid email or password.\"}"));
    }

    @Test
    void rejectsInvalidLoginDataWithoutExposingCredentials() throws Exception {
        for (String email : new String[]{"person@gmail.com", " " + student.getEmail(), student.getEmail() + " "}) {
            mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                            .content(credentials(email, password)))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.password").doesNotExist());
        }
        mockMvc.perform(post("/api/auth/login").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                .content("{}" )).andExpect(status().isBadRequest());
    }

    @Test
    void enforcesRoleBoundariesAndRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
        for (String path : new String[]{"/api/student/test", "/api/technician/test", "/api/admin/test", "/api/private/test"}) {
            mockMvc.perform(get(path)).andExpect(status().isUnauthorized());
        }
        String[] roles = {"STUDENT", "TECHNICIAN", "ADMIN"};
        String[] paths = {"/api/student/test", "/api/technician/test", "/api/admin/test"};
        for (int caller = 0; caller < roles.length; caller++) {
            for (int target = 0; target < paths.length; target++) {
                String account = new String[]{"student01", "technician01", "admin01"}[caller] + "@hyderabad.bits-pilani.ac.in";
                mockMvc.perform(get(paths[target]).with(user(account).roles(roles[caller])))
                        .andExpect(status().is(caller == target ? 200 : 403));
            }
        }
    }

    @Test
    void requiresCsrfForLoginAndLogout() throws Exception {
        for (String path : new String[]{"/api/auth/login", "/api/auth/logout"}) {
            mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON)
                    .content(credentials(student.getEmail(), password))).andExpect(status().isForbidden());
            mockMvc.perform(post(path).with(csrf().useInvalidToken()).contentType(MediaType.APPLICATION_JSON)
                    .content(credentials(student.getEmail(), password))).andExpect(status().isForbidden());
        }
    }

    @Test
    void rotatesSessionAndCsrfThenInvalidatesSessionOnLogout() throws Exception {
        var csrfResponse = mockMvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn();
        JsonNode token = json.readTree(csrfResponse.getResponse().getContentAsString());
        MockHttpSession session = (MockHttpSession) csrfResponse.getRequest().getSession(false);
        String oldSessionId = session.getId();
        mockMvc.perform(post("/api/auth/login").session(session).with(request -> {
                    request.setRequestedSessionId(oldSessionId);
                    return request;
                })
                        .header(token.get("headerName").asText(), token.get("token").asText())
                        .contentType(MediaType.APPLICATION_JSON).content(credentials(student.getEmail(), password)))
                .andExpect(status().isOk());
        assertNotEquals(oldSessionId, session.getId());
        mockMvc.perform(post("/api/auth/logout").session(session)
                .header(token.get("headerName").asText(), token.get("token").asText()))
                .andExpect(status().isForbidden());
        var renewed = mockMvc.perform(get("/api/auth/csrf").session(session)).andReturn();
        JsonNode newToken = json.readTree(renewed.getResponse().getContentAsString());
        mockMvc.perform(post("/api/auth/logout").session(session)
                .header(newToken.get("headerName").asText(), newToken.get("token").asText()))
                .andExpect(status().isOk());
        assertTrue(session.isInvalid());
        mockMvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    // These routes exist only in the test context; no placeholder business APIs are shipped.
    @RestController
    static class TestEndpoints {
        @GetMapping({"/api/student/test", "/api/technician/test", "/api/admin/test", "/api/private/test"})
        Map<String, String> protectedRoute() { return Map.of("message", "Authorized"); }
    }

}
