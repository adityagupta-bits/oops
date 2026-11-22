package com.bits.itsm.knowledge;

import java.text.Normalizer;
import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import com.bits.itsm.incident.Incident;
import org.springframework.stereotype.Component;

/** Deterministic token overlap with explicit service and category boosts; scores are not probabilities. */
@Component
public final class KeywordResolutionMatchingStrategy implements ResolutionMatchingStrategy {
    private static final double TITLE_WEIGHT = 0.65;
    private static final double DESCRIPTION_WEIGHT = 0.35;
    private static final double SERVICE_WEIGHT = 0.20;
    private static final double CATEGORY_WEIGHT = 0.15;
    private static final Set<String> STOP_WORDS = Set.of("the", "and", "for", "with", "from", "this", "that", "when", "where", "what", "into", "have", "has", "had", "was", "were", "are", "is", "been", "being", "not", "but", "can", "could", "would", "should", "will", "your", "you", "our", "their", "they", "them", "then", "than", "there", "here", "after", "before", "about", "while", "during", "issue", "problem", "unable", "user", "please", "error", "campus", "incident", "service", "support", "student", "device", "system");

    @Override
    public double score(Incident current, Incident historical) {
        Set<String> currentTitle = tokens(current.getTitle());
        Set<String> oldTitle = tokens(historical.getTitle());
        Set<String> currentDescription = tokens(current.getDescription());
        Set<String> oldDescription = tokens(historical.getDescription());
        double titleOverlap = jaccard(currentTitle, oldTitle);
        double descriptionOverlap = jaccard(currentDescription, oldDescription);
        double lexical = TITLE_WEIGHT * titleOverlap + DESCRIPTION_WEIGHT * descriptionOverlap;
        if (lexical == 0) return 0;
        double service = current.getAffectedService() != null && current.getAffectedService() == historical.getAffectedService() ? SERVICE_WEIGHT : 0;
        double category = current.getCategory() != null && current.getCategory().equals(historical.getCategory()) ? CATEGORY_WEIGHT : 0;
        return Math.min(1, lexical * (1 - SERVICE_WEIGHT - CATEGORY_WEIGHT) + service + category);
    }

    private static double jaccard(Set<String> left, Set<String> right) {
        if (left.isEmpty() || right.isEmpty()) return 0;
        long intersection = left.stream().filter(right::contains).count();
        if (intersection == 0) return 0;
        return (double) intersection / (left.size() + right.size() - intersection);
    }

    private static Set<String> tokens(String value) {
        if (value == null || value.isBlank()) return Set.of();
        String normalized = Normalizer.normalize(value.toLowerCase(Locale.ROOT), Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").replaceAll("[^a-z0-9]+", " ").trim();
        if (normalized.isEmpty()) return Set.of();
        return Arrays.stream(normalized.split("\\s+"))
                .filter(token -> token.length() >= 3 && !STOP_WORDS.contains(token))
                .collect(Collectors.toUnmodifiableSet());
    }
}
