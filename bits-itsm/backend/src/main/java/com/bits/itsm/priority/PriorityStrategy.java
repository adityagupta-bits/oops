package com.bits.itsm.priority;

import com.bits.itsm.incident.Incident.Level;
import com.bits.itsm.incident.Incident.Priority;

public interface PriorityStrategy {
    Priority calculate(Level impact, Level urgency, Level criticality);
    record Thresholds(double p1, double p2, double p3) {
        public void validate(double maximum) {
            if (!Double.isFinite(p1) || !Double.isFinite(p2) || !Double.isFinite(p3) || p3 <= 0 || p1 > maximum || p1 <= p2 || p2 <= p3)
                throw new IllegalArgumentException("Thresholds must satisfy 0 < P3 < P2 < P1 <= " + maximum + "; lower scores use P4.");
        }
        public Priority priority(double score) { return score >= p1 ? Priority.P1 : score >= p2 ? Priority.P2 : score >= p3 ? Priority.P3 : Priority.P4; }
    }
}
