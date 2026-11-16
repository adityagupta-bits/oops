package com.bits.itsm.intelligence;

import com.bits.itsm.incident.Incident.Category;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component @ConfigurationProperties(prefix = "bitsolve.categorization")
public class CategorySuggester {
    private Map<Category, List<String>> rules = new EnumMap<>(Category.class);
    public CategorySuggester() {
        rules.put(Category.NETWORK, List.of("wi-fi", "wifi", "router", "internet", "network"));
        rules.put(Category.AUTHENTICATION, List.of("password", "login", "authentication", "sign in"));
        rules.put(Category.HARDWARE, List.of("laptop", "keyboard", "monitor", "printer"));
        rules.put(Category.DATABASE, List.of("database", "sql", "query"));
        rules.put(Category.SOFTWARE, List.of("installation", "software", "license"));
        rules.put(Category.STORAGE, List.of("disk", "storage", "backup"));
        rules.put(Category.SECURITY, List.of("malware", "phishing", "virus"));
        rules.put(Category.CLOUD, List.of("cloud", "virtual machine"));
        rules.put(Category.APPLICATION, List.of("portal", "application"));
    }
    public Map<Category, List<String>> getRules() { return rules; }
    public void setRules(Map<Category, List<String>> rules) { this.rules = new EnumMap<>(Category.class); this.rules.putAll(rules); }
    public record Suggestion(Category category, String explanation) { }

    public Suggestion suggest(String title, String description) {
        String text = (Objects.toString(title, "") + " " + Objects.toString(description, "")).toLowerCase(Locale.ROOT);
        int best = 0;
        Category selected = Category.OTHER;
        List<Category> ties = new ArrayList<>();
        List<String> matched = List.of();
        for (var entry : rules.entrySet()) {
            List<String> matches = new ArrayList<>();
            for (String keyword : entry.getValue()) {
                if (!keyword.isBlank() && Pattern.compile("(?<![a-z0-9])" + Pattern.quote(keyword.toLowerCase(Locale.ROOT)) + "(?![a-z0-9])").matcher(text).find()) matches.add(keyword);
            }
            if (matches.size() > best) {
                best = matches.size(); selected = entry.getKey(); matched = matches;
                ties.clear(); ties.add(selected);
            } else if (best > 0 && matches.size() == best) ties.add(entry.getKey());
        }
        if (best == 0) return new Suggestion(Category.OTHER, "No category keywords matched. Choose a category manually.");
        if (ties.size() > 1) return new Suggestion(Category.OTHER, "Ambiguous keyword matches: " + ties + ". Review the description.");
        return new Suggestion(selected, "Keyword matches: " + String.join(", ", matched) + ". This is a rule-based suggestion.");
    }
}
