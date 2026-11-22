package com.bits.itsm.intelligence;

import com.bits.itsm.event.EventBus;
import com.bits.itsm.event.EventType;
import com.bits.itsm.event.IncidentEvent;
import com.bits.itsm.support.IncidentLookup;
import com.bits.itsm.support.IncidentSnapshot;
import com.bits.itsm.support.IncidentStates;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Finds open incidents that may describe the same underlying problem:
 * same affected service AND description similarity at or above the threshold (default 0.4).
 * Call check(incidentId) right after an incident is created.
 */
@Component
public class DuplicateDetector {

    private final IncidentLookup lookup;
    private final EventBus bus;
    private final double threshold;

    public DuplicateDetector(IncidentLookup lookup, EventBus bus,
                             @Value("${itsm.duplicate.threshold:0.4}") double threshold) {
        this.lookup = lookup;
        this.bus = bus;
        if (!Double.isFinite(threshold) || threshold <= 0 || threshold > 1) throw new IllegalArgumentException("Duplicate threshold must be greater than zero and at most one.");
        this.threshold = threshold;
    }

    /** Pure matching logic, best match first. */
    public List<DuplicateMatch> findRelated(IncidentSnapshot candidate, Collection<IncidentSnapshot> others) {
        if (candidate.service() == null) {
            return List.of();
        }
        String candidateText = textOf(candidate);
        return others.stream()
                .filter(o -> !o.id().equals(candidate.id()))
                .filter(IncidentStates::isOpen)
                .filter(o -> java.util.Objects.equals(candidate.service(), o.service()))
                .filter(o -> candidate.category() == o.category() || candidate.category() == com.bits.itsm.incident.Incident.Category.OTHER || o.category() == com.bits.itsm.incident.Incident.Category.OTHER)
                .filter(o -> !o.createdAt().isBefore(candidate.createdAt().minus(java.time.Duration.ofDays(30))))
                .map(o -> new DuplicateMatch(o.id(), o.title(), TextSimilarity.similarity(candidateText, textOf(o))))
                .filter(m -> m.similarity() >= threshold)
                .sorted(Comparator.comparingDouble(DuplicateMatch::similarity).reversed())
                .toList();
    }

    /** Looks for duplicates of the stored incident and publishes DUPLICATE_DETECTED if any are found. */
    public List<DuplicateMatch> check(Long incidentId) {
        return lookup.findById(incidentId).map(this::check).orElse(List.of());
    }

    public List<DuplicateMatch> check(IncidentSnapshot candidate) {
        List<DuplicateMatch> matches = findRelated(candidate, lookup.findAll());
        if (!matches.isEmpty()) {
            DuplicateMatch best = matches.get(0);
            bus.publish(IncidentEvent.system(EventType.DUPLICATE_DETECTED, candidate.id(), null, null,
                    String.format(Locale.ROOT, "%s may duplicate INC-%d (%.0f%% similar); %d related incident(s) found.",
                            candidate.label(), best.incidentId(), best.similarity() * 100, matches.size()),
                    Instant.now()));
        }
        return matches;
    }

    private static String textOf(IncidentSnapshot i) {
        return (i.title() == null ? "" : i.title()) + " " + (i.description() == null ? "" : i.description());
    }
}
