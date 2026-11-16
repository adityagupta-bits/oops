package com.bits.itsm.assignment;

import java.util.*;
import com.bits.itsm.incident.*;
import com.bits.itsm.user.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @Transactional(readOnly = true)
public class WorkloadService {
    private final IncidentRepository incidents;
    private final UserRepository users;
    public WorkloadService(IncidentRepository incidents, UserRepository users) { this.incidents = incidents; this.users = users; }
    public record Workload(Long id, String name, Set<TechnicianSkill> skills, Technician.Availability availability,
            boolean enabled, int maxWorkload, long activePrimary, long activeCollaboration, long total, long highPriority,
            long resolvedCount, long remainingCapacity, String level) { }
    public static boolean active(IncidentStatus status) { return status == IncidentStatus.ASSIGNED || status == IncidentStatus.ACKNOWLEDGED || status == IncidentStatus.IN_PROGRESS; }
    public List<Workload> all() {
        Map<Long, long[]> counts = new HashMap<>();
        accumulate(counts, incidents.primaryWorkloads(), false);
        accumulate(counts, incidents.collaborationWorkloads(), true);
        return users.findTechnicians().stream().map(t -> {
            long[] c = counts.getOrDefault(t.getId(), new long[4]); long total = c[0] + c[1];
            // Capacity is a hard limit; 80% is high, 50% is moderate, below 50% is low.
            String level = total >= t.getMaxWorkload() ? "OVERLOADED" : total * 5 >= t.getMaxWorkload() * 4L ? "HIGH" : total * 2 >= t.getMaxWorkload() ? "MODERATE" : "LOW";
            return new Workload(t.getId(), t.getName(), t.getSkills(), t.getAvailability(), t.isEnabled(), t.getMaxWorkload(), c[0], c[1], total, c[2], c[3], Math.max(0, t.getMaxWorkload() - total), level);
        }).toList();
    }
    private void accumulate(Map<Long, long[]> counts, List<Object[]> rows, boolean collaboration) {
        for (Object[] row : rows) {
            long[] c = counts.computeIfAbsent((Long) row[0], id -> new long[4]); long count = ((Number) row[3]).longValue();
            if (active((IncidentStatus) row[1])) {
                c[collaboration ? 1 : 0] += count;
                if (row[2] == Incident.Priority.P1 || row[2] == Incident.Priority.P2) c[2] += count;
            } else if (row[1] == IncidentStatus.RESOLVED || row[1] == IncidentStatus.VERIFIED || row[1] == IncidentStatus.CLOSED) c[3] += count;
        }
    }
    public List<AssignmentStrategy.Candidate> candidates(Incident incident) {
        Map<Long, Workload> loads = new HashMap<>(); all().forEach(w -> loads.put(w.id(), w));
        return users.findTechnicians().stream().filter(t -> !incident.participates(t.getId()))
                .map(t -> {
                    Workload load = loads.get(t.getId());
                    // Primary work counts twice, collaboration once, with extra weight for P1/P2.
                    return new AssignmentStrategy.Candidate(t, load.total(), load.activePrimary() * 2 + load.activeCollaboration() + load.highPriority() * 2);
                }).toList();
    }
}
