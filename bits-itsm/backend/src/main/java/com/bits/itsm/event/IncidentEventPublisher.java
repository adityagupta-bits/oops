package com.bits.itsm.event;

import org.springframework.stereotype.Component;

/**
 * One-line hook for the incident and assignment services: publish(incidentId, actorId, action, description)
 * using the same action names they already write to the incident history (CREATED, ASSIGNED, RESOLVED...).
 */
@Component
public class IncidentEventPublisher {

    private final EventBus bus;

    public IncidentEventPublisher(EventBus bus) {
        this.bus = bus;
    }

    public void publish(Long incidentId, Long actorId, String action, String description) {
        publish(incidentId, actorId, action, null, null, description);
    }

    public void publish(Long incidentId, Long actorId, String action, String previous, String next, String description) {
        bus.publish(IncidentEvent.of(typeFor(action), incidentId, actorId, action, previous, next, description));
    }

    public static EventType typeFor(String action) {
        if (action == null) {
            return EventType.INCIDENT_UPDATED;
        }
        return switch (action) {
            case "CREATED" -> EventType.INCIDENT_CREATED;
            case "CLASSIFIED" -> EventType.INCIDENT_CLASSIFIED;
            case "ASSIGNED", "AUTO_ASSIGNED", "TECHNICIAN_CHANGED" -> EventType.INCIDENT_ASSIGNED;
            case "ACKNOWLEDGED" -> EventType.INCIDENT_ACKNOWLEDGED;
            case "RESOLVED" -> EventType.INCIDENT_RESOLVED;
            case "CLOSED", "CLOSED_WITHDRAWN", "CLOSED_INVALID", "CLOSED_DUPLICATE" -> EventType.INCIDENT_CLOSED;
            case "PRIORITY_CHANGED" -> EventType.PRIORITY_CHANGED;
            default -> EventType.INCIDENT_UPDATED;
        };
    }

    public void publishTo(Long incidentId, Long actorId, String action, String previous, String next, String description, java.util.Set<Long> recipients) {
        bus.publish(new IncidentEvent(typeFor(action), incidentId, actorId, action, previous, next, description, java.time.Instant.now(), recipients));
    }
}
