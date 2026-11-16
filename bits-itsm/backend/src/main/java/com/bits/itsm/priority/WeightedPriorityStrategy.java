package com.bits.itsm.priority;

import com.bits.itsm.incident.Incident.Level;
import com.bits.itsm.incident.Incident.Priority;

public class WeightedPriorityStrategy implements PriorityStrategy {
    private final Thresholds thresholds;
    private final double impactWeight;
    private final double urgencyWeight;
    private final double criticalityWeight;

    public WeightedPriorityStrategy(double impactWeight, double urgencyWeight, double criticalityWeight) {
        this(impactWeight, urgencyWeight, criticalityWeight, new Thresholds(75, 50, 25));
    }
    public WeightedPriorityStrategy(double impactWeight, double urgencyWeight, double criticalityWeight, Thresholds thresholds) {
        thresholds.validate(100); this.thresholds = thresholds;
        if (!Double.isFinite(impactWeight + urgencyWeight + criticalityWeight)
                || impactWeight < 0 || urgencyWeight < 0 || criticalityWeight < 0
                || Math.abs(impactWeight + urgencyWeight + criticalityWeight - 1) > 0.000001) {
            throw new IllegalArgumentException("Priority weights must be non-negative and add up to 1.");
        }
        this.impactWeight = impactWeight;
        this.urgencyWeight = urgencyWeight;
        this.criticalityWeight = criticalityWeight;
    }

    @Override public Priority calculate(Level impact, Level urgency, Level criticality) {
        double score = 50 * (impactWeight * impact.ordinal() + urgencyWeight * urgency.ordinal() + criticalityWeight * criticality.ordinal());
        return thresholds.priority(score);
    }
}
