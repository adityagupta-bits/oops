package com.bits.itsm.assignment;

import com.bits.itsm.incident.Incident;
import com.bits.itsm.user.Technician;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.ThreadLocalRandom;

/** Uniform random selection among active, available technicians with spare capacity. */
public final class RandomAvailableAssignment implements AssignmentStrategy {
    @Override public Optional<Technician> assign(Incident incident, List<Candidate> candidates) {
        List<Technician> eligible = candidates.stream().filter(c -> c.eligible(null)).map(Candidate::technician).toList();
        return eligible.isEmpty() ? Optional.empty() : Optional.of(eligible.get(ThreadLocalRandom.current().nextInt(eligible.size())));
    }
}
