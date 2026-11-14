package com.bits.itsm.auth;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class EmailValidator {
    private static final Pattern BITS_EMAIL = Pattern.compile(
            "^[A-Za-z0-9_%+-]+(?:\\.[A-Za-z0-9_%+-]+)*@hyderabad\\.bits-pilani\\.ac\\.in$",
            Pattern.CASE_INSENSITIVE);

    private EmailValidator() { }

    public static boolean isValid(String email) {
        if (email == null || email.length() > 254) return false;
        Matcher matcher = BITS_EMAIL.matcher(email);
        return matcher.matches();
    }

    public static String normalize(String email) {
        if (!isValid(email)) throw new IllegalArgumentException("Use a valid BITS Hyderabad email without surrounding whitespace.");
        return email.toLowerCase(Locale.ROOT);
    }
}
