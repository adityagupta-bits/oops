package com.bits.itsm.user;

import java.nio.charset.StandardCharsets;
import java.util.List;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Profile("dev & !prod & !production")
@ConditionalOnProperty(name = "bitsolve.demo.seed-enabled", havingValue = "true")
public class DemoUserSeeder implements ApplicationRunner {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final String demoPassword;

    public DemoUserSeeder(UserRepository users, PasswordEncoder passwords,
            @Value("${DEMO_USER_PASSWORD:}") String demoPassword) {
        this.users = users;
        this.passwords = passwords;
        this.demoPassword = demoPassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments arguments) {
        if (demoPassword.isBlank()) {
            LoggerFactory.getLogger(getClass()).warn("Demo seeding skipped: DEMO_USER_PASSWORD is not configured.");
            return;
        }
        if (demoPassword.length() < 12 || demoPassword.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new IllegalStateException("DEMO_USER_PASSWORD must contain at least 12 characters and at most 72 UTF-8 bytes.");
        }
        List<String> specializations = List.of("HARDWARE", "SOFTWARE", "DATABASE", "NETWORK");
        for (int i = 1; i <= 4; i++) {
            String studentEmail = "student0" + i + "@hyderabad.bits-pilani.ac.in";
            if (!users.existsByEmail(studentEmail)) {
                users.save(new Student("Demo Student " + i, studentEmail, passwords.encode(demoPassword), "DEMO-STU-00" + i));
            }
            String technicianEmail = "technician0" + i + "@hyderabad.bits-pilani.ac.in";
            if (!users.existsByEmail(technicianEmail)) {
                users.save(new Technician("Demo Technician " + i, technicianEmail, passwords.encode(demoPassword), specializations.get(i - 1)));
            }
        }
        String adminEmail = "admin01@hyderabad.bits-pilani.ac.in";
        if (!users.existsByEmail(adminEmail)) {
            users.save(new Administrator("Demo Administrator", adminEmail, passwords.encode(demoPassword), "Campus IT administration"));
        }
    }
}
