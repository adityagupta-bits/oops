package com.bits.itsm.incident;

import jakarta.persistence.*;

@Entity @Table(name = "sla_policies")
public class SlaPolicy {
    @Id @Enumerated(EnumType.STRING) private Incident.Priority priority;
    private int responseMinutes;
    private int resolutionMinutes;
    protected SlaPolicy() { }
    public SlaPolicy(Incident.Priority priority, int responseMinutes, int resolutionMinutes) {
        this.priority = priority; update(responseMinutes, resolutionMinutes);
    }
    public void update(int response, int resolution) {
        if (response < 1 || resolution < response || resolution > 525600) throw new IllegalArgumentException("Invalid SLA targets.");
        responseMinutes = response; resolutionMinutes = resolution;
    }
    public Incident.Priority getPriority() { return priority; }
    public int getResponseMinutes() { return responseMinutes; }
    public int getResolutionMinutes() { return resolutionMinutes; }
}
