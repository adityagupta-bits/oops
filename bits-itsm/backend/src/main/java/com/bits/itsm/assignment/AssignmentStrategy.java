package com.bits.itsm.assignment;

import java.util.List;
import java.util.Optional;
import com.bits.itsm.incident.Incident;
import com.bits.itsm.user.Technician;
import com.bits.itsm.user.TechnicianSkill;

public interface AssignmentStrategy {
    record Candidate(Technician technician, long workload) {
        public boolean eligible(TechnicianSkill required) {
            return technician.canReceive(workload) && (required == null || technician.getSkills().contains(required));
        }
    }
    Optional<Technician> assign(Incident incident, List<Candidate> candidates);
}
