package com.bits.itsm.assignment;

import com.bits.itsm.incident.Incident;
import com.bits.itsm.user.Technician;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Smart technician recommendation (a third AssignmentStrategy).
 * Technicians who fail the existing eligibility rules (disabled, busy, unavailable, at capacity, missing the
 * required skill) are never considered. Among the rest:
 *   score = 5 if the technician has the incident's preferred skill
 *         + free-capacity share (0..1) * weight
 * where the weight is 5 normally but 10 for P1/P2 incidents, so urgent incidents go to the least loaded
 * technician while routine ones favour the best skill fit. Highest score wins; ties go to the lower id.
 */
@Component
public class SmartRecommendationAssignment implements AssignmentStrategy {

    static final double SKILL_WEIGHT = 5.0;
    static final double CAPACITY_WEIGHT = 5.0;
    static final double URGENT_CAPACITY_WEIGHT = 10.0;

    @Override
    public Optional<Technician> assign(Incident incident, List<Candidate> candidates) {
        return candidates.stream()
                .filter(c -> c.eligible(incident.requiredSkill()))
                .max(Comparator.comparingDouble((Candidate c) -> score(incident, c))
                        .thenComparing(c -> c.technician().getId(), Comparator.reverseOrder()))
                .map(Candidate::technician);
    }

    public double score(Incident incident, Candidate candidate) {
        Technician t = candidate.technician();
        double skill = incident.preferredSkill() != null && t.getSkills().contains(incident.preferredSkill())
                ? SKILL_WEIGHT : 0.0;
        boolean urgent = incident.getPriority() == Incident.Priority.P1 || incident.getPriority() == Incident.Priority.P2;
        double weight = urgent ? URGENT_CAPACITY_WEIGHT : CAPACITY_WEIGHT;
        double capacity = Math.max(1, t.getMaxWorkload());
        double freeShare = Math.max(0, capacity - candidate.workload()) / capacity;
        return skill + weight * freeShare;
    }
}
