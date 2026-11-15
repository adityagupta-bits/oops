package com.bits.itsm.intelligence;

import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Rule-based text similarity for incident descriptions.
 * Pipeline: lowercase -> split into words -> drop stopwords -> light stemming -> merge synonyms
 * (so "unavailable", "failing" and "unable" all count as the same idea) -> Jaccard similarity of the word sets.
 */
public final class TextSimilarity {

    private static final Set<String> STOPWORDS = Set.of(
            "the", "a", "an", "to", "of", "in", "on", "at", "is", "are", "was", "were", "be", "been", "am",
            "i", "we", "my", "our", "it", "its", "and", "or", "for", "with", "not", "no", "from", "this", "that",
            "when", "after", "before", "while", "make", "making", "can", "cannot", "cant", "try", "trying",
            "get", "getting", "since", "morning", "today", "again", "please", "users", "user", "some", "all");

    private static final Map<String, String> SYNONYMS = Map.ofEntries(
            Map.entry("unavailable", "fail"), Map.entry("unable", "fail"), Map.entry("failing", "fail"),
            Map.entry("failed", "fail"), Map.entry("failure", "fail"), Map.entry("fail", "fail"),
            Map.entry("error", "fail"), Map.entry("broken", "fail"), Map.entry("down", "fail"),
            Map.entry("crash", "fail"), Map.entry("outage", "fail"), Map.entry("stopped", "fail"),
            Map.entry("wi", "wifi"), Map.entry("fi", "wifi"), Map.entry("wireless", "wifi"),
            Map.entry("pay", "payment"), Map.entry("paying", "payment"), Map.entry("payment", "payment"),
            Map.entry("signin", "login"), Map.entry("sign", "login"), Map.entry("logon", "login"),
            Map.entry("authentication", "login"), Map.entry("password", "login"),
            Map.entry("internet", "network"), Map.entry("connectivity", "network"),
            Map.entry("slow", "slow"), Map.entry("lag", "slow"), Map.entry("laggy", "slow"));

    private TextSimilarity() {
    }

    public static Set<String> tokens(String text) {
        Set<String> result = new HashSet<>();
        if (text == null) {
            return result;
        }
        String cleaned = text.toLowerCase(Locale.ROOT).replace("wi-fi", "wifi");
        for (String raw : cleaned.split("[^a-z0-9]+")) {
            if (raw.length() < 2 || STOPWORDS.contains(raw)) {
                continue;
            }
            String word = SYNONYMS.get(raw);
            if (word == null) {
                word = SYNONYMS.getOrDefault(stem(raw), stem(raw));
            }
            result.add(word);
        }
        return result;
    }

    /** Jaccard similarity of two sets: |A and B| / |A or B|. Two empty sets give 0. */
    public static double jaccard(Set<String> a, Set<String> b) {
        if (a.isEmpty() || b.isEmpty()) {
            return 0.0;
        }
        Set<String> intersection = new HashSet<>(a);
        intersection.retainAll(b);
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        return (double) intersection.size() / union.size();
    }

    public static double similarity(String textA, String textB) {
        return jaccard(tokens(textA), tokens(textB));
    }

    private static String stem(String w) {
        if (w.length() > 5 && w.endsWith("ing")) {
            return w.substring(0, w.length() - 3);
        }
        if (w.length() > 5 && w.endsWith("ed")) {
            return w.substring(0, w.length() - 2);
        }
        if (w.length() > 3 && w.endsWith("s") && !w.endsWith("ss")) {
            return w.substring(0, w.length() - 1);
        }
        return w;
    }
}
