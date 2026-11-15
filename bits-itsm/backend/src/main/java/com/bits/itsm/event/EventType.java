package com.bits.itsm.event;

/** Every important thing that can happen to an incident. The label is the default audit "action". */
public enum EventType {
    INCIDENT_CREATED("Incident Created"),
    INCIDENT_CLASSIFIED("Incident Classified"),
    PRIORITY_CHANGED("Priority Changed"),
    INCIDENT_ASSIGNED("Incident Assigned"),
    INCIDENT_ACKNOWLEDGED("Incident Acknowledged"),
    INCIDENT_UPDATED("Incident Updated"),
    INCIDENT_RESOLVED("Incident Resolved"),
    INCIDENT_CLOSED("Incident Closed"),
    SLA_WARNING("SLA Warning"),
    SLA_BREACHED("SLA Breached"),
    INCIDENT_ESCALATED("Incident Escalated"),
    DUPLICATE_DETECTED("Duplicate Detected");

    private final String label;

    EventType(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
