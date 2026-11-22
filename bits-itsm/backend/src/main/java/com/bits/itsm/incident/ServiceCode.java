package com.bits.itsm.incident;

/** Validated catalog identity; independent of the legacy service enum. */
public record ServiceCode(String value) {
    public ServiceCode {
        if (value == null || !value.matches("[A-Z][A-Z0-9_]{1,49}"))
            throw new IllegalArgumentException("Service code must contain 2–50 uppercase letters, digits or underscores and start with a letter.");
    }
}
