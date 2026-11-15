package com.bits.itsm.event;

import java.time.Instant;
import java.util.Objects;

/**
 * Immutable record of something that happened to an incident.
 * actorId is the user who caused it (null = the system itself). action is an optional detailed name
 * (for example AUTO_ASSIGNED); previous/next are optional old and new values.
 */
public record IncidentEvent(EventType type, Long incidentId, Long actorId, String action,
                            String previous, String next, String description, Instant timestamp) {

    public IncidentEvent {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(incidentId, "incidentId");
        timestamp = (timestamp == null) ? Instant.now() : timestamp;
    }

    public static IncidentEvent of(EventType type, Long incidentId, Long actorId, String action,
                                   String previous, String next, String description) {
        return new IncidentEvent(type, incidentId, actorId, action, previous, next, description, Instant.now());
    }

    public static IncidentEvent system(EventType type, Long incidentId, String previous, String next,
                                       String description, Instant at) {
        return new IncidentEvent(type, incidentId, null, null, previous, next, description, at);
    }
}
