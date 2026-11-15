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
        bus.publish(IncidentEvent.of(typeFor(action), incidentId, actorId, action, null, null, description));
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
            case "CLOSED" -> EventType.INCIDENT_CLOSED;
            case "PRIORITY_CHANGED" -> EventType.PRIORITY_CHANGED;
            default -> EventType.INCIDENT_UPDATED;
        };
    }
}
