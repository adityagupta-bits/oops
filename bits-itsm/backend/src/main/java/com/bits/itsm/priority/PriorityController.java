package com.bits.itsm.priority;

import java.util.List;
import com.bits.itsm.incident.Incident.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/api/admin/priority-strategy")
public class PriorityController {
    private final PriorityService service;
    public PriorityController(PriorityService service) { this.service = service; }
    public record Configuration(@NotNull PrioritySettings.Mode strategy, double impactWeight, double urgencyWeight, double criticalityWeight,
            PriorityStrategy.Thresholds multiplicativeThresholds, PriorityStrategy.Thresholds weightedThresholds,
            List<Priority> matrix, Integer criticalBoost, List<RuleBasedPriorityStrategy.Rule> rules, Priority fallback) {
        // Missing new fields retain saved parameters for existing clients; explicit invalid values fail validation.
        public Configuration complete(Configuration saved) {
            return new Configuration(strategy, impactWeight, urgencyWeight, criticalityWeight,
                    multiplicativeThresholds == null ? saved.multiplicativeThresholds : multiplicativeThresholds,
                    weightedThresholds == null ? saved.weightedThresholds : weightedThresholds,
                    matrix == null ? saved.matrix : matrix, criticalBoost == null ? saved.criticalBoost : criticalBoost,
                    rules == null ? saved.rules : rules, fallback == null ? saved.fallback : fallback);
        }
        public PriorityStrategy calculator() {
            if (strategy == null || multiplicativeThresholds == null || weightedThresholds == null || criticalBoost == null)
                throw new IllegalArgumentException("Priority configuration is incomplete.");
            var multiply = new MultiplicativePriorityStrategy(multiplicativeThresholds);
            var weighted = new WeightedPriorityStrategy(impactWeight, urgencyWeight, criticalityWeight, weightedThresholds);
            var table = new MatrixPriorityStrategy(matrix, criticalBoost);
            var ruleBased = new RuleBasedPriorityStrategy(rules, fallback);
            return switch (strategy) { case MULTIPLICATIVE -> multiply; case WEIGHTED -> weighted; case MATRIX -> table; case RULE_BASED -> ruleBased; };
        }
    }
    public record Preview(@NotNull @Valid Configuration configuration, @NotNull Level impact, @NotNull Level urgency, @NotNull ItService affectedService) { }
    public record PreviewResult(Priority priority, Level criticality) { }
    @GetMapping public PrioritySettings current() { return service.current(); }
    @PutMapping public PrioritySettings update(@Valid @RequestBody Configuration request, Authentication auth) { return service.update(request, auth.getName()); }
    @PostMapping("/preview") public PreviewResult preview(@Valid @RequestBody Preview request) { return service.preview(request); }
}
