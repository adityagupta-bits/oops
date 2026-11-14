package com.bits.itsm;

import java.util.UUID;
import com.bits.itsm.auth.EmailValidator;
import com.bits.itsm.user.DemoUserSeeder;
import com.bits.itsm.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UserModelTests {
    @ParameterizedTest
    @ValueSource(strings = {"student01@hyderabad.bits-pilani.ac.in", "First.Last+lab@HYDERABAD.BITS-PILANI.AC.IN"})
    void acceptsAndNormalizesInstitutionalEmail(String email) {
        assertTrue(EmailValidator.isValid(email));
        assertEquals(email.toLowerCase(java.util.Locale.ROOT), EmailValidator.normalize(email));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"a@gmail.com", "a@yahoo.com", "a@bits-pilani.ac.in", "@hyderabad.bits-pilani.ac.in",
            "a@hyderabad.bits-pilani.ac.in.evil", " a@hyderabad.bits-pilani.ac.in", "a@hyderabad.bits-pilani.ac.in ",
            "a@hyderabad.bits-pilani.ac.in\n", "a b@hyderabad.bits-pilani.ac.in", "a..b@hyderabad.bits-pilani.ac.in",
            ".a@hyderabad.bits-pilani.ac.in", "a.@hyderabad.bits-pilani.ac.in"})
    void rejectsInvalidEmail(String email) { assertFalse(EmailValidator.isValid(email)); }

    @Test
    void seedingNeedsBothDevelopmentProfileAndExplicitFlag() {
        var runner = new ApplicationContextRunner().withUserConfiguration(DemoUserSeeder.class)
                .withBean(UserRepository.class, () -> mock(UserRepository.class))
                .withBean(PasswordEncoder.class, () -> new BCryptPasswordEncoder());
        runner.run(context -> assertTrue(context.getBeansOfType(DemoUserSeeder.class).isEmpty()));
        runner.withPropertyValues("spring.profiles.active=dev").run(context ->
                assertTrue(context.getBeansOfType(DemoUserSeeder.class).isEmpty()));
        runner.withPropertyValues("bitsolve.demo.seed-enabled=true").run(context ->
                assertTrue(context.getBeansOfType(DemoUserSeeder.class).isEmpty()));
        runner.withPropertyValues("spring.profiles.active=dev,prod", "bitsolve.demo.seed-enabled=true").run(context ->
                assertTrue(context.getBeansOfType(DemoUserSeeder.class).isEmpty()));
        runner.withPropertyValues("spring.profiles.active=dev", "bitsolve.demo.seed-enabled=true").run(context ->
                assertNotNull(context.getBean(DemoUserSeeder.class)));
    }

    @Test
    void missingSeedPasswordSkipsWithoutCreatingAccounts() {
        UserRepository users = mock(UserRepository.class);
        new DemoUserSeeder(users, new BCryptPasswordEncoder(), "").run(null);
        verifyNoInteractions(users);
    }

    @Test
    void rejectsPasswordsThatBcryptWouldTruncate() {
        UserRepository users = mock(UserRepository.class);
        assertThrows(IllegalStateException.class, () -> new DemoUserSeeder(users,
                new BCryptPasswordEncoder(), UUID.randomUUID().toString().repeat(3)).run(null));
        verifyNoInteractions(users);
    }
}
