package com.bits.itsm.assignment;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import com.bits.itsm.incident.Incident;
import com.bits.itsm.user.Technician;

public class SkillBasedAssignment implements AssignmentStrategy {
    @Override
    public Optional<Technician> assign(Incident incident, List<Candidate> candidates) {
        return candidates.stream().filter(c -> c.eligible(incident.requiredSkill()))
                .min(Comparator.<Candidate>comparingInt(c -> incident.preferredSkill() != null && c.technician().getSkills().contains(incident.preferredSkill()) ? 0 : 1)
                        .thenComparingLong(Candidate::weightedLoad).thenComparing(c -> c.technician().getId()))
                .map(Candidate::technician);
    }
}
