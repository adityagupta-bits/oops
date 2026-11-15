package com.bits.itsm.intelligence;

/** An existing incident that looks like the one being checked. */
public record DuplicateMatch(Long incidentId, String title, double similarity) {
}
