package com.bits.itsm.support;

import com.bits.itsm.incident.Incident;
import com.bits.itsm.incident.IncidentRepository;
import com.bits.itsm.user.Role;
import com.bits.itsm.user.User;
import com.bits.itsm.user.UserRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/** Adapter: turns IncidentRepository / UserRepository data into IncidentSnapshot objects. */
@Component
@Transactional(readOnly = true)
public class RepositoryIncidentLookup implements IncidentLookup {

    private final IncidentRepository incidents;
    private final UserRepository users;

    public RepositoryIncidentLookup(IncidentRepository incidents, UserRepository users) {
        this.incidents = incidents;
        this.users = users;
    }

    @Override
    public Optional<IncidentSnapshot> findById(Long id) {
        return incidents.findById(id).map(RepositoryIncidentLookup::snapshot);
    }

    @Override
    public List<IncidentSnapshot> findAll() {
        return incidents.findAllByOrderByCreatedAtDesc().stream()
                .map(RepositoryIncidentLookup::snapshot)
                .toList();
    }

    @Override
    public Map<Long, String> findTitlesByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) return Map.of();
        return incidents.findAllById(ids).stream()
                .collect(Collectors.toUnmodifiableMap(Incident::getId, Incident::getTitle, (first, ignored) -> first));
    }

    @Override
    public List<Long> adminIds() {
        return users.findAll().stream()
                .filter(u -> u.getRole() == Role.ADMIN && u.isEnabled())
                .map(User::getId)
                .toList();
    }

    static IncidentSnapshot snapshot(Incident i) {
        return new IncidentSnapshot(i.getId(), i.getTitle(), i.getDescription(), i.getCategory(),
                i.getAffectedService(), i.getPriority(), i.getStatus(),
                i.getReporter().getId(),
                i.getAssignedTechnician() == null ? null : i.getAssignedTechnician().getId(),
                i.getCreatedAt(), i.getAcknowledgedAt(), i.getResolvedAt(),
                i.getResponseDeadline(), i.getResolutionDeadline());
    }
}
