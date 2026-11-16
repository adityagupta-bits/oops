package com.bits.itsm.priority;

import com.bits.itsm.incident.Incident.*;
import java.util.List;

public class MatrixPriorityStrategy implements PriorityStrategy {
    private final List<Priority> matrix;
    private final int criticalBoost;
    public MatrixPriorityStrategy(List<Priority> matrix, int criticalBoost) {
        if (matrix == null || matrix.size() != 9 || matrix.stream().anyMatch(p -> p == null || p == Priority.PENDING) || criticalBoost < 0 || criticalBoost > 3)
            throw new IllegalArgumentException("Provide nine P1-P4 matrix cells and a critical-service boost of 0-3 levels.");
        this.matrix = List.copyOf(matrix); this.criticalBoost = criticalBoost;
    }
    public Priority calculate(Level impact, Level urgency, Level criticality) {
        Priority base = matrix.get(impact.ordinal() * 3 + urgency.ordinal());
        return Priority.values()[Math.max(1, base.ordinal() - (criticality == Level.HIGH ? criticalBoost : 0))];
    }
}
