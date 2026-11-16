package com.bits.itsm.priority;

import com.bits.itsm.incident.Incident.Level;
import com.bits.itsm.incident.Incident.Priority;

public class MultiplicativePriorityStrategy implements PriorityStrategy {
    private final Thresholds thresholds;
    public MultiplicativePriorityStrategy() { this(new Thresholds(18, 12, 4)); }
    public MultiplicativePriorityStrategy(Thresholds thresholds) { thresholds.validate(27); this.thresholds = thresholds; }
    @Override public Priority calculate(Level impact, Level urgency, Level criticality) {
        int score = (impact.ordinal() + 1) * (urgency.ordinal() + 1) * (criticality.ordinal() + 1);
        return thresholds.priority(score);
    }
}
