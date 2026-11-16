package com.bits.itsm.auth;

import com.bits.itsm.user.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Optional first-run setup. Existing administrator accounts are never overwritten. */
@Component
public class InitialAdministrator implements ApplicationRunner {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;
    private final String email;
    private final String password;
    public InitialAdministrator(UserRepository users, PasswordEncoder passwords, JdbcTemplate jdbc,
            @Value("${BOOTSTRAP_ADMIN_EMAIL:}") String email, @Value("${BOOTSTRAP_ADMIN_PASSWORD:}") String password) {
        this.users = users; this.passwords = passwords; this.jdbc = jdbc; this.email = email; this.password = password;
    }
    @Override @Transactional public void run(ApplicationArguments args) {
        if (email.isBlank() && password.isBlank()) return;
        jdbc.execute("select pg_advisory_xact_lock(424213)");
        if (users.findAll().stream().anyMatch(user -> user.getRole() == Role.ADMIN)) return;
        if (!EmailValidator.isValid(email) || password.length() < 12 || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72)
            throw new IllegalArgumentException("Initial administrator needs an institutional email and a password of 12-72 UTF-8 bytes.");
        users.save(new Administrator("Campus Administrator", email, passwords.encode(password), "Campus IT"));
    }
}
