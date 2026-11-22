package com.bits.itsm;

import com.bits.itsm.auth.*;
import com.bits.itsm.user.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

@EnabledIfEnvironmentVariable(named="BITSOLVE_DB_TESTS",matches="true")
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@SpringBootTest(properties={"spring.datasource.url=${BITSOLVE_TEST_DB_URL}","bitsolve.assignment.automatic-enabled=false"})
@Transactional
class PasswordRecoveryPersistenceTests {
    @Autowired PasswordRecovery recovery;
    @Autowired PasswordEncoder passwords;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    Student target;
    User admin;
    @BeforeEach void setup() {
        assertTrue(jdbc.queryForObject("select current_database()",String.class).startsWith("bitsolve_restore_verify_"));
        target=users.saveAndFlush(new Student("Recovery test","recovery-test@hyderabad.bits-pilani.ac.in",passwords.encode("OriginalSecret123!"),null));
        admin=users.findAll().stream().filter(u -> u.getRole()==Role.ADMIN && u.isEnabled()).findFirst().orElseThrow();
    }
    @Test void singleUseResetPersistsHashRevokesSessionAndAuditsWithoutSecrets() throws Exception {
        var login=mvc.perform(post("/api/auth/login").with(csrf()).contentType("application/json")
            .content("{\"email\":\""+target.getEmail()+"\",\"password\":\"OriginalSecret123!\"}"))
            .andExpect(status().isOk()).andReturn();
        var session=(org.springframework.mock.web.MockHttpSession)login.getRequest().getSession(false);
        var code=recovery.initiate(target.getId(),admin.getEmail());
        assertEquals(0,jdbc.queryForObject("select count(*) from password_reset_tokens where token_hash=?",Integer.class,code.token()));
        mvc.perform(post("/api/auth/reset-password").with(csrf()).contentType("application/json")
            .content("{\"token\":\""+code.token()+"\",\"password\":\"NewSecurePassword123!\",\"confirmation\":\"NewSecurePassword123!\"}"))
            .andExpect(status().isOk());
        users.flush();
        assertTrue(passwords.matches("NewSecurePassword123!",jdbc.queryForObject("select password_hash from app_users where id=?",String.class,target.getId())));
        assertEquals(1,jdbc.queryForObject("select credential_version from app_users where id=?",Long.class,target.getId()));
        assertThrows(IllegalArgumentException.class,() -> recovery.reset(code.token(),"AnotherSecure123!","AnotherSecure123!"));
        mvc.perform(get("/api/auth/me").session(session)).andExpect(status().isUnauthorized());
        assertTrue(jdbc.queryForObject("select count(*) from audit_events where action='PASSWORD_RESET_COMPLETED' and description like ?",Integer.class,"%"+target.getId())>0);
    }
    @Test void expiryReplacementPolicyAndAuthorizationAreEnforced() throws Exception {
        mvc.perform(post("/api/admin/users/"+target.getId()+"/password-reset").with(user(target.getEmail()).roles("STUDENT")).with(csrf())).andExpect(status().isForbidden());
        var old=recovery.initiate(target.getId(),admin.getEmail());
        var fresh=recovery.initiate(target.getId(),admin.getEmail());
        assertThrows(IllegalArgumentException.class,() -> recovery.reset(old.token(),"NewSecurePassword123!","NewSecurePassword123!"));
        assertThrows(IllegalArgumentException.class,() -> recovery.reset(fresh.token(),"short1","short1"));
        jdbc.update("update password_reset_tokens set expires_at=CURRENT_TIMESTAMP - interval '1 minute' where user_id=?",target.getId());
        assertThrows(IllegalArgumentException.class,() -> recovery.reset(fresh.token(),"NewSecurePassword123!","NewSecurePassword123!"));
        assertTrue(passwords.matches("OriginalSecret123!",target.getPasswordHash()));
    }
    @Test void selfChangeRequiresCurrentPasswordAndInvalidatesResetCodes() throws Exception {
        var code=recovery.initiate(target.getId(),admin.getEmail());
        mvc.perform(post("/api/auth/change-password").with(user(target.getEmail()).roles("STUDENT")).with(csrf()).contentType("application/json")
            .content("{\"currentPassword\":\"wrong\",\"password\":\"NewSecurePassword123!\",\"confirmation\":\"NewSecurePassword123!\"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/auth/change-password").with(user(target.getEmail()).roles("STUDENT")).with(csrf()).contentType("application/json")
            .content("{\"currentPassword\":\"OriginalSecret123!\",\"password\":\"NewSecurePassword123!\",\"confirmation\":\"NewSecurePassword123!\"}"))
            .andExpect(status().isOk());
        assertThrows(IllegalArgumentException.class,() -> recovery.reset(code.token(),"AnotherSecure123!","AnotherSecure123!"));
    }
}
