package com.bits.itsm.classification;

import com.bits.itsm.audit.AuditRecord;
import com.bits.itsm.audit.AuditStore;
import com.bits.itsm.incident.*;
import com.bits.itsm.incident.Incident.*;
import com.bits.itsm.intelligence.CategorySuggester;
import com.bits.itsm.priority.PriorityService;
import com.bits.itsm.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;
import java.util.regex.Pattern;

@Service
@Transactional
public class IncidentClassificationService {

    private final CatalogService catalog;
    private final ClassificationSettingsRepository settingsRepo;
    private final PriorityService priorities;
    private final SlaPolicies slaPolicies;
    private final SlaPolicyRepository slaPolicyRepo;
    private final AuditStore audit;
    private final CategorySuggester categorySuggester;

    public IncidentClassificationService(CatalogService catalog,
                                         ClassificationSettingsRepository settingsRepo,
                                         PriorityService priorities,
                                         SlaPolicies slaPolicies,
                                         SlaPolicyRepository slaPolicyRepo,
                                         AuditStore audit,
                                         CategorySuggester categorySuggester) {
        this.catalog = catalog;
        this.settingsRepo = settingsRepo;
        this.priorities = priorities;
        this.slaPolicies = slaPolicies;
        this.slaPolicyRepo = slaPolicyRepo;
        this.audit = audit;
        this.categorySuggester = categorySuggester;
    }

    public ClassificationSettings getSettings() {
        return settingsRepo.findById(1L).orElseGet(() -> {
            ClassificationSettings s = new ClassificationSettings();
            return settingsRepo.save(s);
        });
    }

    @Transactional
    public ClassificationSettings updateSettings(ClassificationSettings updated, User actor) {
        ClassificationSettings current = settingsRepo.lock();
        if (current == null) {
            current = new ClassificationSettings();
        }
        String before = "autoClassify=" + current.isAutoClassifyEnabled() + ", flagUncertain=" + current.isFlagUncertain();
        current.update(updated.isAutoClassifyEnabled(), updated.getHighUrgencyKeywords(), updated.getLowUrgencyKeywords(),
                updated.getHighImpactKeywords(), updated.getMediumImpactKeywords(),
                updated.getDefaultImpact(), updated.getDefaultUrgency(), updated.isFlagUncertain());
        ClassificationSettings saved = settingsRepo.saveAndFlush(current);
        audit.save(new AuditRecord("AUD-" + UUID.randomUUID(), Instant.now(), actor.getId(), null,
                "CLASSIFICATION_SETTINGS_UPDATED", before,
                "autoClassify=" + saved.isAutoClassifyEnabled() + ", flagUncertain=" + saved.isFlagUncertain(),
                "Updated classification and urgency determination settings."));
        return saved;
    }

    public record DetectionResult(ItService service, CatalogEntry entry, int matchCount, boolean ambiguous, List<String> matchedKeywords) { }

    public DetectionResult detectService(String text) {
        if (text == null || text.isBlank()) {
            return new DetectionResult(null, null, 0, false, List.of());
        }
        String normalized = text.toLowerCase(Locale.ROOT);
        List<CatalogEntry> activeServices = catalog.all().stream()
                .filter(c -> c.isEnabled() && c.getCriticality() != null && "SERVICE".equals(c.getKind()))
                .toList();

        CatalogEntry bestEntry = null;
        ItService bestService = null;
        int bestScore = 0;
        List<ItService> ties = new ArrayList<>();
        List<String> bestKeywords = new ArrayList<>();

        for (CatalogEntry entry : activeServices) {
            ItService service;
            try {
                service = ItService.valueOf(entry.getCode());
            } catch (IllegalArgumentException e) {
                continue;
            }

            List<String> keywords = new ArrayList<>();
            if (entry.getKeywords() != null && !entry.getKeywords().isBlank()) {
                keywords.addAll(Arrays.stream(entry.getKeywords().split("[,;]"))
                        .map(s -> s.trim().toLowerCase(Locale.ROOT))
                        .filter(s -> !s.isEmpty())
                        .distinct()
                        .toList());
            }

            List<String> matched = new ArrayList<>();
            for (String kw : keywords) {
                Pattern pattern = Pattern.compile("(?<![a-z0-9])" + Pattern.quote(kw.toLowerCase(Locale.ROOT)) + "(?![a-z0-9])");
                if (pattern.matcher(normalized).find()) {
                    matched.add(kw);
                }
            }

            int score = matched.size();
            if (score > bestScore) {
                bestScore = score;
                bestEntry = entry;
                bestService = service;
                bestKeywords = matched;
                ties.clear();
                ties.add(service);
            } else if (score > 0 && score == bestScore) {
                ties.add(service);
            }
        }

        if (bestScore == 0) {
            return new DetectionResult(null, null, 0, false, List.of());
        }
        if (ties.size() > 1) {
            return new DetectionResult(null, null, bestScore, true, bestKeywords);
        }
        return new DetectionResult(bestService, bestEntry, bestScore, false, bestKeywords);
    }

    public Level determineUrgency(String text, ClassificationSettings settings) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String normalized = text.toLowerCase(Locale.ROOT);
        int highMatches = countMatches(normalized, settings.getHighUrgencyKeywords());
        int lowMatches = countMatches(normalized, settings.getLowUrgencyKeywords());

        if (highMatches > 0 && highMatches >= lowMatches) {
            return Level.HIGH;
        }
        if (lowMatches > 0 && lowMatches > highMatches) {
            return Level.LOW;
        }
        return null;
    }

    public Level determineImpact(String text, ClassificationSettings settings) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String normalized = text.toLowerCase(Locale.ROOT);
        int highMatches = countMatches(normalized, settings.getHighImpactKeywords());
        int mediumMatches = countMatches(normalized, settings.getMediumImpactKeywords());

        if (highMatches > 0) {
            return Level.HIGH;
        }
        if (mediumMatches > 0) {
            return Level.MEDIUM;
        }
        return null;
    }

    private int countMatches(String text, String commaKeywords) {
        if (commaKeywords == null || commaKeywords.isBlank()) return 0;
        int count = 0;
        for (String kw : commaKeywords.split("[,;]")) {
            String trimmed = kw.trim();
            if (!trimmed.isEmpty()) {
                Pattern pattern = Pattern.compile("(?<![a-z0-9])" + Pattern.quote(trimmed.toLowerCase(Locale.ROOT)) + "(?![a-z0-9])");
                if (pattern.matcher(text).find()) {
                    count++;
                }
            }
        }
        return count;
    }

    public Category determineCategory(String title, String description, ItService detectedService) {
        String evidence = (title + " " + description).toLowerCase(Locale.ROOT);
        var categoryMatches = catalog.all().stream().filter(c -> "CATEGORY".equals(c.getKind()) && c.isEnabled()
                && countMatches(evidence,c.getKeywords()) > 0).toList();
        if (categoryMatches.size() == 1) return Category.valueOf(categoryMatches.getFirst().getCode());
        if (categoryMatches.size() > 1) return Category.OTHER;
        CategorySuggester.Suggestion suggestion = categorySuggester.suggest(title, description);
        if (suggestion != null && suggestion.category() != null && !suggestion.category().equals(Category.OTHER)) {
            return suggestion.category();
        }
        if (detectedService != null) {
            return switch (detectedService.name()) {
                case "CAMPUS_WIFI", "CAMPUS_NETWORK" -> Category.NETWORK;
                case "LAB_COMPUTERS" -> Category.HARDWARE;
                case "AUTHENTICATION" -> Category.AUTHENTICATION;
                case "STUDENT_PORTAL", "LIBRARY", "EMAIL" -> Category.APPLICATION;
                default -> Category.OTHER;
            };
        }
        return Category.OTHER;
    }

    public void processSubmission(Incident incident, User reporter) {
        ClassificationSettings settings = getSettings();
        if (!settings.isAutoClassifyEnabled()) {
            incident.flagForClassificationReview("Automatic classification is disabled by administrator.", incident.getCategory(), incident.getAffectedService(), incident.getUrgency(), incident.getImpact());
            audit.save(new AuditRecord("AUD-" + UUID.randomUUID(), Instant.now(), null, incident.getId(),
                    "CLASSIFICATION_REVIEW_REQUIRED", null, "PENDING", "Auto-classify disabled. Flagged for administrator review."));
            return;
        }

        String fullText = incident.getTitle() + " " + incident.getDescription();
        DetectionResult serviceDetection = detectService(fullText);

        ItService detectedService = serviceDetection.service();

        Level urgency = determineUrgency(fullText, settings);
        Level impact = determineImpact(fullText, settings);
        Category category = determineCategory(incident.getTitle(), incident.getDescription(), detectedService);

        boolean serviceIdentified = detectedService != null && !serviceDetection.ambiguous();
        boolean generalSupportFallback = !serviceDetection.ambiguous() && detectedService == null
                && Category.OTHER.equals(incident.getReportedCategory());
        if (generalSupportFallback) {
            category = Category.OTHER;
            try {
                CatalogEntry fallback = catalog.get("SERVICE", "OTHER");
                if (fallback != null && fallback.isEnabled() && fallback.getCriticality() != null) {
                    detectedService = ItService.valueOf(fallback.getCode());
                    serviceDetection = new DetectionResult(detectedService, fallback, 0, false, List.of("configured general-support fallback"));
                    serviceIdentified = true;
                    // These explicit administrator-configured defaults apply only to general support.
                    if (impact == null) impact = settings.getDefaultImpact();
                    if (urgency == null) urgency = settings.getDefaultUrgency();
                }
            } catch (IllegalArgumentException ignored) {
                // Missing or invalid fallback configuration stays in the normal review path.
            }
        }
        CatalogEntry entry = null;
        if (serviceIdentified) {
            try {
                entry = catalog.get("SERVICE", detectedService.name());
            } catch (Exception e) {
                entry = null;
            }
        }
        boolean criticalityConfigured = entry != null && entry.getCriticality() != null;
        boolean conflictingHint = detectedService != null && incident.getReportedService() != null
                && !detectedService.equals(incident.getReportedService());
        boolean conflictingScope = Integer.valueOf(1).equals(incident.getReportedAffectedUsers()) && (impact==Level.HIGH || impact==Level.MEDIUM);

        if (!serviceIdentified || !criticalityConfigured || urgency == null || impact == null || conflictingHint || conflictingScope) {
            String reason = conflictingScope ? "Reported affected-person count conflicts with the described scope. Administrator review required." : conflictingHint ? "Reported service conflicts with the service detected from configured keywords. Administrator review required." : generalSupportFallback && !serviceIdentified
                    ? "The configured general-support fallback service must be enabled and have valid business criticality. Administrator review required." : !serviceIdentified
                    ? (serviceDetection.ambiguous()
                        ? "Ambiguous service keywords match multiple IT services. Administrator review required."
                        : "No matching IT service could be detected with certainty from problem description. Administrator review required.")
                    : !criticalityConfigured ? "Detected service (" + detectedService.getLabel() + ") has no business criticality configured. Administrator review required."
                    : "Insufficient evidence or configured fallback to determine impact or urgency. Administrator review required.";

            incident.flagForClassificationReview(reason, category, detectedService, urgency, impact);
            audit.save(new AuditRecord("AUD-" + UUID.randomUUID(), Instant.now(), null, incident.getId(),
                    "CLASSIFICATION_REVIEW_REQUIRED", null, "PENDING", "Incident flagged for review. Reason: " + reason));
            incident.record(reporter, "CLASSIFICATION_REVIEW_REQUIRED", reason, InvestigationNote.Visibility.STUDENT_VISIBLE);
            return;
        }

        Level criticality = entry.getCriticality();
        var prioritySettings = priorities.current();
        Priority calculated = prioritySettings.calculator().calculate(impact, urgency, criticality);

        incident.applyAutoClassification(category, detectedService, impact, urgency, criticality, calculated);
        Category finalCategory = category;
        catalog.all().stream().filter(c -> "CATEGORY".equals(c.getKind()) && c.getCode().equals(finalCategory.name()))
                .findFirst().ifPresent(c -> incident.captureClassifiedSkill(c.getRequiredSkill()));
        slaPolicies.capture(incident);

        String strategyName = prioritySettings.getStrategy().name();
        String desc = "Automatically classified using " + strategyName + " model. Service: " + detectedService.getLabel()
                + ", Category: " + category + ", Impact: " + impact + ", Urgency: " + urgency
                + ", Criticality: " + criticality + " -> Priority: " + calculated
                + ". SLA response: " + incident.getResponseDeadline() + ", resolution: " + incident.getResolutionDeadline();
        String evidence = "Service keyword matches: " + serviceDetection.matchedKeywords()
                + "; reported urgency=" + incident.getReportedUrgency() + "; evaluated urgency=" + urgency
                + "; urgency rules HIGH=" + settings.getHighUrgencyKeywords() + ", LOW=" + settings.getLowUrgencyKeywords()
                + "; impact rules HIGH=" + settings.getHighImpactKeywords() + ", MEDIUM=" + settings.getMediumImpactKeywords();
        recordEvidence(incident,"CLASSIFICATION_EVIDENCE",evidence);
        recordEvidence(incident,"PRIORITY_CONFIGURATION_SNAPSHOT",String.valueOf(prioritySettings.configuration()));

        audit.save(new AuditRecord("AUD-" + UUID.randomUUID(), Instant.now(), null, incident.getId(),
                "AUTO_CLASSIFIED", "PENDING", calculated.name(), desc));
        incident.record(reporter, "AUTO_CLASSIFIED", desc, InvestigationNote.Visibility.STUDENT_VISIBLE);
    }

    private void recordEvidence(Incident incident,String action,String text) {
        int parts=Math.max(1,(text.length()+4499)/4500);
        for(int part=0;part<parts;part++) audit.save(new AuditRecord("AUD-"+UUID.randomUUID(),Instant.now(),null,incident.getId(),
                action,null,incident.getPriority().name(),"Part "+(part+1)+"/"+parts+": "+text.substring(part*4500,Math.min(text.length(),(part+1)*4500))));
    }

    public Incident reclassify(Incident incident, ItService service, Category category,
                               Level impact, Level urgency, String reason, User admin) {
        Objects.requireNonNull(service, "Affected service is required");
        Objects.requireNonNull(impact, "Impact is required");
        Objects.requireNonNull(urgency, "Urgency is required");
        Objects.requireNonNull(reason, "Audit reason is mandatory for administrative corrections");
        if (reason.trim().length() < 5) {
            throw new IllegalArgumentException("Audit reason must contain at least 5 characters.");
        }

        catalog.requireEnabled("SERVICE", service.name());
        if (category != null) catalog.requireEnabled("CATEGORY", category.name());
        CatalogEntry entry = catalog.get("SERVICE", service.name());
        if (entry.getCriticality() == null) {
            throw new IllegalStateException("Service " + service.getLabel() + " has no business criticality configured.");
        }
        Level criticality = entry.getCriticality();

        Category finalCategory = category != null ? category : determineCategory(incident.getTitle(), incident.getDescription(), service);
        Priority calculated = priorities.current().calculator().calculate(impact, urgency, criticality);

        String previousPriority = incident.getPriority() != null ? incident.getPriority().name() : "PENDING";
        String previousSla = "response=" + incident.getResponseDeadline() + ", resolution=" + incident.getResolutionDeadline();
        incident.adminClassify(finalCategory, service, impact, urgency, criticality, calculated);
        incident.captureClassifiedSkill(catalog.all().stream().filter(c -> "CATEGORY".equals(c.getKind()) && c.getCode().equals(finalCategory.name()))
                .map(CatalogEntry::getRequiredSkill).filter(Objects::nonNull).findFirst().orElse(null));

        // Recalculate SLA targets
        SlaPolicy slaPolicy = slaPolicyRepo.findById(calculated).orElseThrow(
                () -> new IllegalStateException("SLA policy is missing for " + calculated + ". Configure the policy before classification."));
        incident.resetSla(slaPolicy);

        String strategyName = priorities.current().getStrategy().name();
        String auditDesc = "Administrator corrected classification. Reason: " + reason.trim()
                + "\nStrategy: " + strategyName + ", Service: " + service.getLabel()
                + ", Criticality: " + criticality + ", Impact: " + impact + ", Urgency: " + urgency
                + " -> Calculated Priority: " + calculated
                + "\nPrevious SLA: " + previousSla + "; corrected SLA: response=" + incident.getResponseDeadline()
                + ", resolution=" + incident.getResolutionDeadline();

        audit.save(new AuditRecord("AUD-" + UUID.randomUUID(), Instant.now(), admin.getId(), incident.getId(),
                "INCIDENT_CORRECTED_AND_RECLASSIFIED", previousPriority, calculated.name(), auditDesc));
        incident.record(admin, "ADMIN_RECLASSIFIED",
                "Administrator corrected classification: " + service.getLabel() + ", Priority: " + calculated + ". Reason: " + reason.trim(),
                InvestigationNote.Visibility.STUDENT_VISIBLE);

        return incident;
    }
}
