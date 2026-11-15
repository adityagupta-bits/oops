package com.bits.itsm.support;

/** Human-readable incident id used in messages (matches the frontend's INC-1004 style). */
public final class IncidentLabel {

    private IncidentLabel() {
    }

    public static String of(Long id) {
        return "INC-" + id;
    }
}
