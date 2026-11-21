package com.bits.itsm.classification;

import com.bits.itsm.audit.AuditStore;
import com.bits.itsm.incident.*;
import com.bits.itsm.incident.Incident.*;
import com.bits.itsm.intelligence.CategorySuggester;
import com.bits.itsm.priority.*;
import com.bits.itsm.user.Student;
import com.bits.itsm.user.Administrator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class IncidentClassificationServiceTest {

    private CatalogService catalog;
    private ClassificationSettingsRepository settingsRepo;
    private PriorityService priorityService;
    private SlaPolicies slaPolicies;
    private SlaPolicyRepository slaPolicyRepo;
    private AuditStore auditStore;
    private CategorySuggester categorySuggester;
    private IncidentClassificationService service;

    private Student student;
    private Administrator admin;

    @BeforeEach
    void setup() {
        catalog = mock(CatalogService.class);
        settingsRepo = mock(ClassificationSettingsRepository.class);
        priorityService = mock(PriorityService.class);
        slaPolicies = mock(SlaPolicies.class);
        slaPolicyRepo = mock(SlaPolicyRepository.class);
        auditStore = mock(AuditStore.class);
        categorySuggester = new CategorySuggester();

        student = new Student("Test Student", "student01@hyderabad.bits-pilani.ac.in", "$2-test-only", "TEST-01");
        admin = new Administrator("Admin User", "admin01@hyderabad.bits-pilani.ac.in", "$2-test-only", "IT Admin");

        ClassificationSettings defaultSettings = new ClassificationSettings();
        when(settingsRepo.findById(1L)).thenReturn(Optional.of(defaultSettings));
        when(settingsRepo.lock()).thenReturn(defaultSettings);

        service = new IncidentClassificationService(catalog, settingsRepo, priorityService, slaPolicies, slaPolicyRepo, auditStore, categorySuggester);
    }

    private CatalogEntry mockCatalogEntry(String code, String label, Level criticality, String keywords) {
        CatalogEntry entry = mock(CatalogEntry.class);
        when(entry.getCode()).thenReturn(code);
        when(entry.getLabel()).thenReturn(label);
        when(entry.getCriticality()).thenReturn(criticality);
        when(entry.getKeywords()).thenReturn(keywords);
        when(entry.isEnabled()).thenReturn(true);
        when(entry.getKind()).thenReturn("SERVICE");
        return entry;
    }

    @Test
    void detectsServiceAndUrgencyAndCalculatesPriority() {
        CatalogEntry wifi = mockCatalogEntry("CAMPUS_WIFI", "Campus Wi-Fi", Level.HIGH, "wifi, wi-fi, eduroam, wireless");
        when(catalog.all()).thenReturn(List.of(wifi));
        when(catalog.get("SERVICE", "CAMPUS_WIFI")).thenReturn(wifi);

        PrioritySettings prioritySettings = mock(PrioritySettings.class);
        when(prioritySettings.getStrategy()).thenReturn(PrioritySettings.Mode.MULTIPLICATIVE);
        when(prioritySettings.calculator()).thenReturn(new MultiplicativePriorityStrategy());
        when(priorityService.current()).thenReturn(prioritySettings);

        Incident incident = new Incident("Wi-Fi connection failed", "I cannot connect to the eduroam wifi in hostel 3 and my midterm exam submission is due today!", student);

        service.processSubmission(incident, student);

        assertFalse(incident.isAutoClassified());
        assertTrue(incident.isNeedsClassificationReview());
        assertEquals(ItService.CAMPUS_WIFI, incident.getAffectedService());
        assertEquals(Level.HIGH, incident.getUrgency()); // "exam", "due today"
        // A first-person report does not establish how many people are affected.
        assertNull(incident.getImpact());
        assertEquals(Priority.PENDING, incident.getPriority());
        assertEquals(IncidentStatus.NEW, incident.getStatus());
        verify(slaPolicies, never()).capture(incident);
    }

    @Test
    void highImpactMultiplicativeCalculatesP1() {
        CatalogEntry wifi = mockCatalogEntry("CAMPUS_WIFI", "Campus Wi-Fi", Level.HIGH, "wifi, wi-fi, eduroam, wireless");
        when(catalog.all()).thenReturn(List.of(wifi));
        when(catalog.get("SERVICE", "CAMPUS_WIFI")).thenReturn(wifi);

        PrioritySettings prioritySettings = mock(PrioritySettings.class);
        when(prioritySettings.getStrategy()).thenReturn(PrioritySettings.Mode.MULTIPLICATIVE);
        when(prioritySettings.calculator()).thenReturn(new MultiplicativePriorityStrategy());
        when(priorityService.current()).thenReturn(prioritySettings);

        Incident incident = new Incident("Wi-Fi outage campus-wide", "The wifi is down for all students and midterm exams are today!", student);

        service.processSubmission(incident, student);

        assertEquals(Level.HIGH, incident.getImpact()); // "all students"
        assertEquals(Level.HIGH, incident.getUrgency()); // "today", "exams"
        assertEquals(Level.HIGH, incident.getCriticality());
        // Multiplicative: Impact HIGH (3) * Urgency HIGH (3) * Criticality HIGH (3) = 27 -> P1 (>= 18)
        assertEquals(Priority.P1, incident.getPriority());
        assertEquals(IncidentStatus.CLASSIFIED, incident.getStatus());
    }

    @Test
    void uncertainServiceTriggersAdministratorReviewWithoutInventingDefaults() {
        CatalogEntry wifi = mockCatalogEntry("CAMPUS_WIFI", "Campus Wi-Fi", Level.HIGH, "wifi, wi-fi, eduroam");
        CatalogEntry portal = mockCatalogEntry("STUDENT_PORTAL", "Student Portal", Level.MEDIUM, "portal, cms, erp");
        when(catalog.all()).thenReturn(List.of(wifi, portal));

        Incident incident = new Incident("General inquiry", "I have an issue with something in my room that does not seem to work properly.", student);

        service.processSubmission(incident, student);

        assertFalse(incident.isAutoClassified());
        assertTrue(incident.isNeedsClassificationReview());
        assertNull(incident.getAffectedService());
        assertEquals(Priority.PENDING, incident.getPriority());
        assertEquals(IncidentStatus.NEW, incident.getStatus());
        assertNotNull(incident.getClassificationNotes());
        verifyNoInteractions(slaPolicies);
    }

    @Test
    void ambiguousServiceMatchesTriggerReview() {
        CatalogEntry network = mockCatalogEntry("CAMPUS_NETWORK", "Campus Network", Level.HIGH, "lan");
        CatalogEntry library = mockCatalogEntry("LIBRARY", "Library Services", Level.MEDIUM, "reading-room");
        when(catalog.all()).thenReturn(List.of(network, library));

        Incident incident = new Incident("Issue in reading-room", "There is a lan problem in the reading-room.", student);

        service.processSubmission(incident, student);

        assertTrue(incident.isNeedsClassificationReview());
        assertEquals(Priority.PENDING, incident.getPriority());
        assertEquals(IncidentStatus.NEW, incident.getStatus());
        assertTrue(incident.getClassificationNotes().contains("Ambiguous"));
    }

    @Test
    void administratorCanReclassifyWithMandatoryReason() {
        CatalogEntry portal = mockCatalogEntry("STUDENT_PORTAL", "Student Portal", Level.HIGH, "portal, cms");
        when(catalog.get("SERVICE", "STUDENT_PORTAL")).thenReturn(portal);

        PrioritySettings prioritySettings = mock(PrioritySettings.class);
        when(prioritySettings.getStrategy()).thenReturn(PrioritySettings.Mode.MULTIPLICATIVE);
        when(prioritySettings.calculator()).thenReturn(new MultiplicativePriorityStrategy());
        when(priorityService.current()).thenReturn(prioritySettings);

        SlaPolicy p2Policy = new SlaPolicy(Priority.P2, 15, 120);
        when(slaPolicyRepo.findById(any())).thenReturn(Optional.of(p2Policy));

        Incident incident = new Incident("Something failed", "Problem description without clear service keywords.", student);
        service.processSubmission(incident, student);
        assertTrue(incident.isNeedsClassificationReview());

        // Admin corrects the incident
        service.reclassify(incident, ItService.STUDENT_PORTAL, Category.APPLICATION, Level.HIGH, Level.HIGH, "Confirmed student portal grade submission issue", admin);

        assertFalse(incident.isNeedsClassificationReview());
        assertEquals(ItService.STUDENT_PORTAL, incident.getAffectedService());
        assertEquals(Category.APPLICATION, incident.getCategory());
        assertEquals(Level.HIGH, incident.getImpact());
        assertEquals(Level.HIGH, incident.getUrgency());
        assertEquals(IncidentStatus.CLASSIFIED, incident.getStatus());
        assertNotEquals(Priority.PENDING, incident.getPriority());
    }

    @Test
    void reclassifyRejectsShortOrMissingReason() {
        Incident incident = new Incident("Title", "Description for testing rejection of blank audit reason.", student);
        assertThrows(IllegalArgumentException.class, () ->
                service.reclassify(incident, ItService.CAMPUS_WIFI, Category.NETWORK, Level.LOW, Level.LOW, "   ", admin));
        assertThrows(IllegalArgumentException.class, () ->
                service.reclassify(incident, ItService.CAMPUS_WIFI, Category.NETWORK, Level.LOW, Level.LOW, "ok", admin));
    }
}
