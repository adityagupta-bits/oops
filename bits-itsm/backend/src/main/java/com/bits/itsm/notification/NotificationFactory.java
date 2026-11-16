package com.bits.itsm.notification;

import com.bits.itsm.event.IncidentEvent;
import com.bits.itsm.support.IncidentLabel;

import java.util.UUID;

/** Factory: builds the right Notification (title + wording) for an event and a recipient. */
public final class NotificationFactory {

    private NotificationFactory() {
    }

    public static Notification create(IncidentEvent e, Long recipientId) {
        String inc = IncidentLabel.of(e.incidentId());
        String detail = e.description() == null ? "" : e.description();
        String title;
        String message;
        switch (e.type()) {
            case INCIDENT_CREATED -> {
                title = "Incident reported";
                message = "Incident " + inc + " was created.";
            }
            case INCIDENT_CLASSIFIED -> {
                title = "Incident classified";
                message = "Incident " + inc + " was classified. " + detail;
            }
            case PRIORITY_CHANGED -> {
                title = "Priority changed";
                message = "Priority of " + inc + " changed from " + e.previous() + " to " + e.next() + ".";
            }
            case INCIDENT_ASSIGNED -> {
                title = "Incident assigned";
                message = "Incident " + inc + " was assigned to a technician.";
            }
            case INCIDENT_ACKNOWLEDGED -> {
                title = "Incident acknowledged";
                message = "A technician acknowledged incident " + inc + ".";
            }
            case INCIDENT_UPDATED -> {
                title = "Incident updated";
                message = detail.isBlank() ? "Incident " + inc + " was updated." : inc + ": " + detail;
            }
            case INCIDENT_RESOLVED -> {
                title = "Incident resolved";
                message = "Incident " + inc + " was resolved. Please review the resolution.";
            }
            case INCIDENT_CLOSED -> {
                title = "Incident closed";
                message = "Incident " + inc + " was closed.";
            }
            case SLA_WARNING -> {
                title = "SLA approaching";
                message = detail;
            }
            case SLA_BREACHED -> {
                title = "SLA breached";
                message = detail;
            }
            case INCIDENT_ESCALATED -> {
                title = "Incident escalated";
                message = detail;
            }
            case DUPLICATE_DETECTED -> {
                title = "Possible duplicate incident";
                message = detail;
            }
            default -> {
                title = e.type().label();
                message = detail;
            }
        }
        String id = UUID.randomUUID().toString();
        return new Notification(id, recipientId, e.type(), e.incidentId(), title, message, e.timestamp());
    }
}
