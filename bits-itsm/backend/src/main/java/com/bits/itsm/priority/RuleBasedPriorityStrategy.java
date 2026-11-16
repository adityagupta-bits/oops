package com.bits.itsm.priority;

import com.bits.itsm.incident.Incident.*;
import java.util.List;

public class RuleBasedPriorityStrategy implements PriorityStrategy {
    public enum Condition { ALL_HIGH, HIGH_IMPACT_AND_URGENCY, CRITICAL_SERVICE, HIGH_IMPACT, HIGH_URGENCY }
    public record Rule(Condition condition, Priority priority) { }
    private final List<Rule> rules;
    private final Priority fallback;
    public RuleBasedPriorityStrategy(List<Rule> rules, Priority fallback) {
        if (rules == null || rules.size() > Condition.values().length || fallback == null || fallback == Priority.PENDING
                || rules.stream().anyMatch(r -> r == null || r.condition() == null || r.priority() == null || r.priority() == Priority.PENDING)
                || rules.stream().map(Rule::condition).distinct().count() != rules.size())
            throw new IllegalArgumentException("Rules must use unique predefined conditions and P1-P4 priorities, with a P1-P4 fallback.");
        this.rules = List.copyOf(rules); this.fallback = fallback;
    }
    public Priority calculate(Level impact, Level urgency, Level criticality) {
        for (Rule rule : rules) {
            boolean matches = switch (rule.condition()) {
                case ALL_HIGH -> impact == Level.HIGH && urgency == Level.HIGH && criticality == Level.HIGH;
                case HIGH_IMPACT_AND_URGENCY -> impact == Level.HIGH && urgency == Level.HIGH;
                case CRITICAL_SERVICE -> criticality == Level.HIGH;
                case HIGH_IMPACT -> impact == Level.HIGH;
                case HIGH_URGENCY -> urgency == Level.HIGH;
            };
            if (matches) return rule.priority();
        }
        return fallback;
    }
}
