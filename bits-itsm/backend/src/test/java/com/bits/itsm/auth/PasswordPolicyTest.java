package com.bits.itsm.auth;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class PasswordPolicyTest {
    @Test void appliesLengthCompositionAndEncoderByteLimits() {
        assertFalse(PasswordPolicy.valid("Short12345"));
        assertFalse(PasswordPolicy.valid("onlyletterslong"));
        assertTrue(PasswordPolicy.valid("CampusSupport123"));
        assertFalse(PasswordPolicy.valid("Campus1" + "界".repeat(24)));
        assertTrue(PasswordPolicy.valid("A1" + "x".repeat(70)));
        assertFalse(PasswordPolicy.valid(null));
    }
}
