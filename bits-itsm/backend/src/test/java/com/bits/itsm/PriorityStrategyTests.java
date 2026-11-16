package com.bits.itsm;

import com.bits.itsm.priority.*;
import static com.bits.itsm.incident.Incident.Level.*;
import static com.bits.itsm.incident.Incident.Priority.*;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class PriorityStrategyTests {
    @Test void multiplicativeThresholds() {
        var strategy = new MultiplicativePriorityStrategy();
        assertEquals(P1, strategy.calculate(HIGH, HIGH, MEDIUM));
        assertEquals(P2, strategy.calculate(HIGH, MEDIUM, MEDIUM));
        assertEquals(P3, strategy.calculate(MEDIUM, MEDIUM, LOW));
        assertEquals(P4, strategy.calculate(LOW, LOW, HIGH));
    }
    @Test void weightedThresholds() {
        var strategy = new WeightedPriorityStrategy(0.5, 0.5, 0);
        assertEquals(P1, strategy.calculate(HIGH, MEDIUM, LOW));
        assertEquals(P2, strategy.calculate(MEDIUM, MEDIUM, LOW));
        assertEquals(P3, strategy.calculate(MEDIUM, LOW, LOW));
        assertEquals(P4, strategy.calculate(LOW, LOW, LOW));
    }
    @Test void modelsProduceDifferentResults() {
        assertEquals(P3, new MultiplicativePriorityStrategy().calculate(HIGH, LOW, MEDIUM));
        assertEquals(P2, new WeightedPriorityStrategy(0.4, 0.4, 0.2).calculate(HIGH, LOW, MEDIUM));
    }
    @Test void invalidWeightsAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> new WeightedPriorityStrategy(-0.1, 0.9, 0.2));
        assertThrows(IllegalArgumentException.class, () -> new WeightedPriorityStrategy(1, 1, 1));
        assertThrows(IllegalArgumentException.class, () -> new WeightedPriorityStrategy(Double.NaN, 0, 1));
    }

    @Test void configurableThresholdsIncludeTheirBoundaries() {
        var thresholds = new PriorityStrategy.Thresholds(20, 10, 2);
        thresholds.validate(27);
        assertEquals(P1, thresholds.priority(20)); assertEquals(P2, thresholds.priority(19.999));
        assertEquals(P2, thresholds.priority(10)); assertEquals(P3, thresholds.priority(9.999));
        assertEquals(P3, thresholds.priority(2)); assertEquals(P4, thresholds.priority(1.999));
        assertEquals(P4, new MultiplicativePriorityStrategy(new PriorityStrategy.Thresholds(27, 18, 9)).calculate(MEDIUM, MEDIUM, MEDIUM));
        assertEquals(P1, new WeightedPriorityStrategy(1, 0, 0, new PriorityStrategy.Thresholds(100, 50, 1)).calculate(HIGH, LOW, LOW));
    }
    @Test void invalidThresholdsAreRejected() {
        for (var t : java.util.List.of(new PriorityStrategy.Thresholds(10,10,5), new PriorityStrategy.Thresholds(30,10,5), new PriorityStrategy.Thresholds(20,10,0), new PriorityStrategy.Thresholds(Double.NaN,10,5)))
            assertThrows(IllegalArgumentException.class, () -> new MultiplicativePriorityStrategy(t));
    }
    @Test void matrixUsesAllNineCellsAndCapsCriticalPromotion() {
        var cells = java.util.List.of(P4,P3,P2,P3,P2,P1,P2,P1,P1);
        var matrix = new MatrixPriorityStrategy(cells, 2);
        for (var impact : com.bits.itsm.incident.Incident.Level.values()) for (var urgency : com.bits.itsm.incident.Incident.Level.values())
            assertEquals(cells.get(impact.ordinal()*3+urgency.ordinal()), matrix.calculate(impact,urgency,MEDIUM));
        assertEquals(P2, matrix.calculate(LOW, LOW, HIGH)); assertEquals(P1, matrix.calculate(HIGH, HIGH, HIGH));
        assertEquals(P4, new MatrixPriorityStrategy(cells,0).calculate(LOW,LOW,HIGH));
        assertThrows(IllegalArgumentException.class, () -> new MatrixPriorityStrategy(java.util.List.of(P1), 0));
        assertThrows(IllegalArgumentException.class, () -> new MatrixPriorityStrategy(cells, 4));
        assertThrows(IllegalArgumentException.class, () -> new MatrixPriorityStrategy(java.util.Collections.nCopies(9,PENDING), 1));
    }
    @Test void rulesAreOrderedAndFallbackIsExplicit() {
        var critical = new RuleBasedPriorityStrategy.Rule(RuleBasedPriorityStrategy.Condition.CRITICAL_SERVICE, P2);
        var high = new RuleBasedPriorityStrategy.Rule(RuleBasedPriorityStrategy.Condition.ALL_HIGH, P1);
        assertEquals(P2, new RuleBasedPriorityStrategy(java.util.List.of(critical,high),P4).calculate(HIGH,HIGH,HIGH));
        assertEquals(P1, new RuleBasedPriorityStrategy(java.util.List.of(high,critical),P4).calculate(HIGH,HIGH,HIGH));
        assertEquals(P4, new RuleBasedPriorityStrategy(java.util.List.of(high,critical),P4).calculate(LOW,LOW,LOW));
        assertEquals(P3, new RuleBasedPriorityStrategy(java.util.List.of(),P3).calculate(HIGH,HIGH,HIGH));
        assertThrows(IllegalArgumentException.class, () -> new RuleBasedPriorityStrategy(java.util.List.of(high,high),P4));
        assertThrows(IllegalArgumentException.class, () -> new RuleBasedPriorityStrategy(java.util.List.of(),PENDING));
    }
    @Test void missingServiceCriticalityNeverFallsBackToMedium() {
        var catalog = org.mockito.Mockito.mock(com.bits.itsm.incident.CatalogService.class);
        var entry = org.mockito.Mockito.mock(com.bits.itsm.incident.CatalogEntry.class);
        org.mockito.Mockito.when(catalog.get("SERVICE", "CAMPUS_WIFI")).thenReturn(entry);
        var service = new PriorityService(null, null, catalog, null, null);
        assertThrows(IllegalStateException.class, () -> service.criticality(com.bits.itsm.incident.Incident.ItService.CAMPUS_WIFI));
    }
}
