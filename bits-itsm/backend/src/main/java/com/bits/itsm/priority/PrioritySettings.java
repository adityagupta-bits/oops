package com.bits.itsm.priority;

import jakarta.persistence.*;
import java.util.List;
import com.bits.itsm.incident.Incident.Priority;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity @Table(name = "priority_settings")
public class PrioritySettings {
    public enum Mode { MULTIPLICATIVE, WEIGHTED, MATRIX, RULE_BASED }
    @Id private Long id;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Mode strategy;
    private double impactWeight;
    private double urgencyWeight;
    private double criticalityWeight;
    @JdbcTypeCode(SqlTypes.JSON) private PriorityStrategy.Thresholds multiplicativeThresholds;
    @JdbcTypeCode(SqlTypes.JSON) private PriorityStrategy.Thresholds weightedThresholds;
    @JdbcTypeCode(SqlTypes.JSON) private List<Priority> matrix;
    private int criticalBoost;
    @JdbcTypeCode(SqlTypes.JSON) private List<RuleBasedPriorityStrategy.Rule> rules;
    @Enumerated(EnumType.STRING) private Priority fallback;
    protected PrioritySettings() { }
    public Mode getStrategy() { return strategy; }
    public double getImpactWeight() { return impactWeight; }
    public double getUrgencyWeight() { return urgencyWeight; }
    public double getCriticalityWeight() { return criticalityWeight; }
    public PriorityStrategy.Thresholds getMultiplicativeThresholds() { return multiplicativeThresholds; }
    public PriorityStrategy.Thresholds getWeightedThresholds() { return weightedThresholds; }
    public List<Priority> getMatrix() { return matrix; }
    public int getCriticalBoost() { return criticalBoost; }
    public List<RuleBasedPriorityStrategy.Rule> getRules() { return rules; }
    public Priority getFallback() { return fallback; }
    public PriorityController.Configuration configuration() {
        return new PriorityController.Configuration(strategy, impactWeight, urgencyWeight, criticalityWeight, multiplicativeThresholds, weightedThresholds, matrix, criticalBoost, rules, fallback);
    }
    public void update(PriorityController.Configuration c) {
        c.calculator();
        strategy = c.strategy(); impactWeight = c.impactWeight(); urgencyWeight = c.urgencyWeight(); criticalityWeight = c.criticalityWeight();
        multiplicativeThresholds = c.multiplicativeThresholds(); weightedThresholds = c.weightedThresholds();
        matrix = List.copyOf(c.matrix()); criticalBoost = c.criticalBoost(); rules = List.copyOf(c.rules()); fallback = c.fallback();
    }
    public PriorityStrategy calculator() { return configuration().calculator(); }
}
