package com.bits.itsm.knowledge;

import java.lang.reflect.Proxy;
import java.util.*;

import com.bits.itsm.incident.*;
import com.bits.itsm.user.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;

class ResolutionRecommendationServiceTest {
    private static final Student REPORTER = new Student("Private Reporter", "private.student@hyderabad.bits-pilani.ac.in", "$2-test-only", "STUDENT-98765");
    private static final Technician TECHNICIAN = new Technician("Resolver", "tech@hyderabad.bits-pilani.ac.in", "$2-test-only", "NETWORK");
    private static final Technician OTHER_TECHNICIAN = new Technician("Other", "other@hyderabad.bits-pilani.ac.in", "$2-test-only", "NETWORK");
    private static final Administrator ADMIN = new Administrator("Admin", "admin@hyderabad.bits-pilani.ac.in", "$2-test-only", "IT Support");
    private final KeywordResolutionMatchingStrategy matcher = new KeywordResolutionMatchingStrategy();

    static {
        ReflectionTestUtils.setField(REPORTER, "id", 101L);
        ReflectionTestUtils.setField(TECHNICIAN, "id", 201L);
        ReflectionTestUtils.setField(OTHER_TECHNICIAN, "id", 202L);
        ReflectionTestUtils.setField(ADMIN, "id", 301L);
    }

    private Incident incident(long id, IncidentStatus status, String title, String description,
                              Incident.Category category, Incident.ItService service, String summary, String steps) {
        Incident incident = new Incident(title, description, REPORTER, category, service, Incident.Level.MEDIUM, Incident.Level.MEDIUM);
        ReflectionTestUtils.setField(incident, "id", id);
        ReflectionTestUtils.setField(incident, "status", status);
        ReflectionTestUtils.setField(incident, "resolutionSummary", summary);
        ReflectionTestUtils.setField(incident, "resolutionSteps", steps);
        return incident;
    }

    private Incident current(long id, Incident.Category category, Incident.ItService service) {
        Incident incident = incident(id, IncidentStatus.IN_PROGRESS, "Campus Wi-Fi drops during exam", "Campus Wi-Fi disconnects while a student joins the secure exam network.", category, service, null, null);
        ReflectionTestUtils.setField(incident, "assignedTechnician", TECHNICIAN);
        return incident;
    }

    private ResolutionRecommendationService service(Incident current, List<Incident> candidates) {
        IncidentRepository incidents = (IncidentRepository) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{IncidentRepository.class}, (proxy, method, args) -> switch (method.getName()) {
            case "findById" -> Optional.ofNullable(Objects.equals(args[0], current.getId()) ? current : candidates.stream().filter(i -> Objects.equals(i.getId(), args[0])).findFirst().orElse(null));
            case "findResolutionCandidates" -> candidates;
            default -> null;
        });
        Map<String, User> accounts = Map.of(REPORTER.getEmail(), REPORTER, TECHNICIAN.getEmail(), TECHNICIAN,
                OTHER_TECHNICIAN.getEmail(), OTHER_TECHNICIAN, ADMIN.getEmail(), ADMIN);
        UserRepository users = (UserRepository) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[]{UserRepository.class}, (proxy, method, args) ->
                method.getName().equals("findByEmail") ? Optional.ofNullable(accounts.get(args[0])) : Optional.empty());
        return new ResolutionRecommendationService(incidents, users, matcher);
    }

    private Incident resolved(long id, String title, String description, Incident.Category category, Incident.ItService service) {
        return incident(id, IncidentStatus.VERIFIED, title, description, category, service,
                "Reconnect the wireless adapter and renew the campus network lease.", "Forget the campus network, reconnect, then renew the IP lease.");
    }

    @Test void exactServiceAndKeywordMatchIsRankedAboveWeakerMatches() {
        Incident current = current(1, Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI);
        Incident exact = resolved(2, "Campus Wi-Fi disconnects during exam", "Campus Wi-Fi disconnects from the secure exam network.", Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI);
        Incident partial = resolved(3, "Campus Wi-Fi drops near exam hall", "Wireless connection is unstable near the exam hall.", Incident.Category.OTHER, Incident.ItService.OTHER);
        assertTrue(matcher.score(current, exact) > matcher.score(current, partial));
        var suggestions = service(current, List.of(partial, exact)).suggest(1L, TECHNICIAN.getEmail());
        assertEquals(2L, suggestions.getFirst().incidentId());
    }

    @Test void unrelatedAndUnresolvedRecordsAreExcludedAndNullClassificationIsSafe() {
        Incident current = current(1, null, null);
        Incident unrelated = resolved(2, "Printer toner replacement", "Replace the empty cartridge in the library printer.", null, null);
        Incident unresolved = incident(3, IncidentStatus.IN_PROGRESS, "Campus Wi-Fi drops during exam", "Campus Wi-Fi disconnects while joining the secure exam network.", null, null, "Unverified draft fix", "Draft steps");
        Incident missingResolution = incident(4, IncidentStatus.CLOSED, "Campus Wi-Fi drops during exam", "Campus Wi-Fi disconnects while joining the secure exam network.", null, null, null, " ");
        var suggestions = service(current, List.of(unrelated, unresolved, missingResolution)).suggest(1L, TECHNICIAN.getEmail());
        assertTrue(suggestions.isEmpty());
    }

    @Test void excludesCurrentRecordLimitsResultsAndRedactsReporterInformation() {
        Incident current = current(1, Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI);
        List<Incident> candidates = new ArrayList<>();
        candidates.add(resolved(1, "Campus Wi-Fi drops during exam", "Campus Wi-Fi disconnects in the exam network.", Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI));
        for (long id = 2; id < 9; id++) {
            candidates.add(resolved(id, "Campus Wi-Fi drops during exam", "Campus Wi-Fi disconnects in the exam network for Private Reporter.", Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI));
        }
        Incident privateRecord = candidates.get(1);
        ReflectionTestUtils.setField(privateRecord, "resolutionSummary", "Reconnect; contact Private Reporter at private.student@hyderabad.bits-pilani.ac.in, student STUDENT-98765. Token: abc123.");
        var suggestions = service(current, candidates).suggest(1L, TECHNICIAN.getEmail());
        assertEquals(IncidentStatus.IN_PROGRESS, current.getStatus());
        assertEquals(5, suggestions.size());
        assertTrue(suggestions.stream().noneMatch(item -> item.incidentId().equals(1L)));
        assertFalse(suggestions.toString().contains("Private Reporter"));
        assertFalse(suggestions.toString().contains("private.student@hyderabad.bits-pilani.ac.in"));
        assertFalse(suggestions.toString().contains("STUDENT-98765"));
        assertFalse(suggestions.toString().contains("abc123"));
    }

    @Test void onlyAssignedTechniciansAndAdministratorsCanRequestSuggestions() {
        Incident current = current(1, Incident.Category.NETWORK, Incident.ItService.CAMPUS_WIFI);
        var technicianService = service(current, List.of());
        assertTrue(technicianService.suggest(1L, TECHNICIAN.getEmail()).isEmpty());
        assertTrue(service(current, List.of()).suggest(1L, ADMIN.getEmail()).isEmpty());
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> technicianService.suggest(1L, OTHER_TECHNICIAN.getEmail()));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> technicianService.suggest(1L, REPORTER.getEmail()));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> technicianService.suggest(1L, "missing@hyderabad.bits-pilani.ac.in"));
        assertThrows(org.springframework.web.server.ResponseStatusException.class, () -> technicianService.suggest(999L, TECHNICIAN.getEmail()));
    }
}
