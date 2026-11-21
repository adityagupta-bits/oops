package com.bits.itsm.knowledge;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

import com.bits.itsm.incident.Incident;
import com.bits.itsm.incident.IncidentRepository;
import com.bits.itsm.incident.IncidentStatus;
import com.bits.itsm.user.Role;
import com.bits.itsm.user.User;
import com.bits.itsm.user.Student;
import com.bits.itsm.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@Transactional(readOnly = true)
public class ResolutionRecommendationService {
    private static final int CANDIDATE_LIMIT = 300;
    private static final int RESULT_LIMIT = 5;
    private static final double MINIMUM_SCORE = 0.18;
    private static final Pattern EMAIL = Pattern.compile("(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b");
    private static final Pattern SECRET = Pattern.compile("(?i)\\b(password|passwd|passcode|token|secret|api[_ -]?key|authorization|otp)(?:\\s+(?:is|was))?\\s*[:=]?\\s*\\S+");
    private static final Pattern PHONE = Pattern.compile("(?<![A-Za-z0-9])\\+?\\d[\\d ().-]{7,}\\d(?![A-Za-z0-9])");
    private static final Pattern STUDENT_IDENTIFIER = Pattern.compile("(?i)\\b(student|roll|registration)\\s*(id|number|no)?\\s*[:#-]?\\s*[A-Z0-9-]{4,}");

    public record Suggestion(Long incidentId, String title, String category, String service, String symptoms,
            String summary, String steps, String relevance, double score) { }
    public record KnowledgeEntry(Long incidentId, String title, String category, String service,
            String symptoms, String summary, String steps) { }

    private final IncidentRepository incidents;
    private final UserRepository users;
    private final ResolutionMatchingStrategy matching;

    public ResolutionRecommendationService(IncidentRepository incidents, UserRepository users, ResolutionMatchingStrategy matching) {
        this.incidents = incidents; this.users = users; this.matching = matching;
    }

    public List<Suggestion> suggest(Long incidentId, String email) {
        User user = actor(email);
        Incident current = incidents.findById(incidentId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Incident not found."));
        authorize(current, user);
        return candidates().stream().filter(old -> !old.getId().equals(current.getId()))
                .map(old -> new Ranked(old, matching.score(current, old)))
                .filter(ranked -> ranked.score >= MINIMUM_SCORE)
                .sorted(Comparator.comparingDouble((Ranked ranked) -> ranked.score).reversed().thenComparing(ranked -> ranked.incident.getId()))
                .map(ranked -> suggestion(ranked.incident, ranked.score)).filter(java.util.Objects::nonNull)
                .limit(RESULT_LIMIT).toList();
    }

    public List<KnowledgeEntry> search(String email, String search, String category, String service) {
        User user = actor(email);
        if (user.getRole() != Role.ADMIN && user.getRole() != Role.TECHNICIAN) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This action is not permitted for your role.");
        String query = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        String categoryFilter = category == null ? "" : category.trim();
        String serviceFilter = service == null ? "" : service.trim();
        return candidates().stream().map(this::knowledgeEntry).filter(java.util.Objects::nonNull)
                .filter(entry -> categoryFilter.isEmpty() || categoryFilter.equals(entry.category()))
                .filter(entry -> serviceFilter.isEmpty() || serviceFilter.equals(entry.service()))
                .filter(entry -> query.isEmpty() || String.join(" ", safe(entry.title()), safe(entry.symptoms()), safe(entry.summary()), safe(entry.steps()), safe(entry.category()), safe(entry.service())).toLowerCase(Locale.ROOT).contains(query))
                .limit(RESULT_LIMIT * 20).toList();
    }

    private List<Incident> candidates() {
        return incidents.findResolutionCandidates(List.of(IncidentStatus.VERIFIED, IncidentStatus.CLOSED), PageRequest.of(0, CANDIDATE_LIMIT)).stream()
                .filter(i -> i.getStatus() == IncidentStatus.VERIFIED || i.getStatus() == IncidentStatus.CLOSED)
                .filter(i -> (i.getResolutionSummary() != null && !i.getResolutionSummary().isBlank()) || (i.getResolutionSteps() != null && !i.getResolutionSteps().isBlank()))
                .toList();
    }
    private User actor(String email) {
        return users.findByEmail(email).filter(User::isEnabled).orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sign in with an enabled account."));
    }
    private static void authorize(Incident incident, User user) {
        if (user.getRole() == Role.ADMIN) return;
        if (user.getRole() != Role.TECHNICIAN || !incident.participates(user.getId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only technicians assigned to this incident or administrators may view suggestions.");
    }
    private Suggestion suggestion(Incident incident, double score) {
        KnowledgeEntry entry = knowledgeEntry(incident);
        if (entry == null) return null;
        String relevance = score >= 0.65 ? "HIGH" : score >= 0.38 ? "MEDIUM" : "LOW";
        return new Suggestion(entry.incidentId(), entry.title(), entry.category(), entry.service(), entry.symptoms(), entry.summary(), entry.steps(), relevance, Math.round(score * 100.0) / 100.0);
    }
    private KnowledgeEntry knowledgeEntry(Incident incident) {
        // Only verified/closed incidents with a stored resolution are eligible, never private notes/history.
        String title = sanitize(incident, incident.getTitle());
        String symptoms = sanitize(incident, incident.getDescription());
        String summary = sanitize(incident, incident.getResolutionSummary());
        String steps = sanitize(incident, incident.getResolutionSteps());
        if (title == null || (summary == null && steps == null)) return null;
        return new KnowledgeEntry(incident.getId(), title, incident.getCategory() == null ? null : incident.getCategory().name(),
                incident.getAffectedService() == null ? null : incident.getAffectedService().name(), shorten(symptoms, 240), summary, steps);
    }
    private static String sanitize(Incident incident, String value) {
        if (value == null || value.isBlank()) return null;
        String cleaned = EMAIL.matcher(value).replaceAll("[email redacted]");
        cleaned = SECRET.matcher(cleaned).replaceAll("$1: [redacted]");
        cleaned = PHONE.matcher(cleaned).replaceAll("[number redacted]");
        cleaned = STUDENT_IDENTIFIER.matcher(cleaned).replaceAll("[student identifier redacted]");
        if (incident.getReporter() != null) {
            cleaned = replaceLiteral(cleaned, incident.getReporter().getName());
            cleaned = replaceLiteral(cleaned, incident.getReporter().getEmail());
            if (incident.getReporter() instanceof Student student) cleaned = replaceLiteral(cleaned, student.getStudentNumber());
        }
        cleaned = cleaned.trim();
        return cleaned.isBlank() ? null : cleaned;
    }
    private static String replaceLiteral(String text, String privateValue) {
        if (privateValue == null || privateValue.isBlank()) return text;
        return text.replaceAll("(?i)" + Pattern.quote(privateValue), "[reporter detail redacted]");
    }
    private static String shorten(String value, int max) { return value == null || value.length() <= max ? value : value.substring(0, max).stripTrailing() + "…"; }
    private static String safe(String value) { return value == null ? "" : value; }
    private record Ranked(Incident incident, double score) { }
}
