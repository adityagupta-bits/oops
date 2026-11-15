package com.bits.itsm.escalation;

/** The escalation chain for unacknowledged critical incidents, in order. */
public enum EscalationLevel {
    TECHNICIAN("Technician"),
    TEAM_LEAD("Team Lead"),
    SYSTEM_ADMINISTRATOR("System Administrator"),
    IT_MANAGER("IT Manager");

    private final String label;

    EscalationLevel(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    public boolean isTop() {
        return this == IT_MANAGER;
    }

    public EscalationLevel next() {
        return isTop() ? this : values()[ordinal() + 1];
    }
}
