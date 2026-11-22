package com.bits.itsm.auth;

import java.nio.charset.StandardCharsets;

public final class PasswordPolicy {
    private PasswordPolicy() { }
    public static boolean valid(String password) {
        return password != null && password.length() >= 12
                && password.getBytes(StandardCharsets.UTF_8).length <= 72
                && password.matches("(?s).*[A-Za-z].*") && password.matches("(?s).*[0-9].*");
    }
    public static void requireValid(String password) {
        if (!valid(password)) throw new IllegalArgumentException("Use at least 12 characters with a letter and a number, within 72 UTF-8 bytes.");
    }
}
