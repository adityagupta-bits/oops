package com.bits.itsm.incident;

import java.time.Instant;

public final class SlaClock {
    private SlaClock() { }
    public enum Status { ON_TRACK, AT_RISK, BREACHED, MET }
    // The last 20% of the captured target is the warning window. Completion at the deadline meets SLA.
    public static Status status(Instant deadline, int targetMinutes, Instant completed, Instant now) {
        if (completed != null) return completed.isAfter(deadline) ? Status.BREACHED : Status.MET;
        if (now.isAfter(deadline)) return Status.BREACHED;
        return now.isBefore(deadline.minusSeconds(targetMinutes * 12L)) ? Status.ON_TRACK : Status.AT_RISK;
    }
}
