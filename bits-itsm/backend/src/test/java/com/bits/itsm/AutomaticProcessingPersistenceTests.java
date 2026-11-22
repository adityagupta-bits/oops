package com.bits.itsm;

import com.bits.itsm.incident.*;
import com.bits.itsm.incident.Incident.*;
import com.bits.itsm.assignment.*;
import com.bits.itsm.classification.*;
import com.bits.itsm.priority.PriorityService;
import com.bits.itsm.user.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;

@EnabledIfEnvironmentVariable(named="BITSOLVE_DB_TESTS", matches="true")
@org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
@SpringBootTest(properties={"spring.datasource.url=${BITSOLVE_TEST_DB_URL}", "bitsolve.assignment.automatic-enabled=false"})
@Transactional
class AutomaticProcessingPersistenceTests {
    @Autowired CatalogService catalog;
    @Autowired IncidentService service;
    @Autowired IncidentRepository incidents;
    @Autowired AssignmentService assignments;
    @Autowired AssignmentSettingsRepository assignmentSettings;
    @Autowired ClassificationSettingsRepository classificationSettings;
    @Autowired PriorityService priorities;
    @Autowired SlaPolicyRepository policies;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManager em;
    @Autowired com.bits.itsm.audit.AuditStore audit;
    @Autowired IncidentConversation conversations;
    @Autowired com.bits.itsm.sla.SlaMonitor slaMonitor;
    @Autowired org.springframework.test.web.servlet.MockMvc mvc;
    Student student;
    Technician technician;

    @BeforeEach void configureIsolatedScenario() {
        assertTrue(jdbc.queryForObject("select current_database()", String.class).startsWith("bitsolve_restore_verify_"));
        student=(Student)users.findAll().stream().filter(u -> u.getRole()==Role.STUDENT && u.isEnabled()).findFirst().orElseThrow();
        for (var u:users.findAll()) if(u instanceof Technician t) t.setAvailability(Technician.Availability.UNAVAILABLE);
        technician=users.saveAndFlush(new Technician("Pipeline Network Technician", "pipeline-test@hyderabad.bits-pilani.ac.in", "$2-test-only", "NETWORK"));
        assignmentSettings.findById(1L).orElseThrow().select(AssignmentSettings.Mode.SKILL_BASED);
        classificationSettings.findById(1L).orElseThrow().update(true,"urgent","routine","all students","several students",Level.LOW,Level.MEDIUM,true);
        for(var c:catalog.all()) if(c.getKind().equals("SERVICE")) catalog.update("SERVICE",c.getCode(),c.getLabel(),false,c.getCriticality(),c.getKeywords());
        catalog.createService("CUSTOM_WIFI", "Research Wi-Fi", "Research wireless network", "researchmesh", Level.HIGH, true);
    }
    IncidentData.View submit(String title) {
        assertDoesNotThrow(() -> mvc.perform(post("/api/incidents").with(user(student.getEmail()).roles("STUDENT")).with(csrf())
            .contentType("application/json").content("{\"title\":\""+title+"\",\"description\":\"Wi-Fi unavailable for all students, urgent assistance required.\",\"category\":\"NETWORK\"}"))
            .andExpect(status().isCreated()));
        return service.get(jdbc.queryForObject("select max(id) from incidents",Long.class),student.getEmail());
    }
    @Test void withdrawalAndAdministrativeClosurePreserveRecordsAndAuthorization() throws Exception {
        var admin=users.findAll().stream().filter(u -> u.getRole()==Role.ADMIN && u.isEnabled()).findFirst().orElseThrow();
        var unknown=submit("Unrecognized report");
        assertEquals(IncidentStatus.NEW,unknown.status());
        String withdrawal="{\"kind\":\"WITHDRAWN\",\"reason\":\"Reported in error\"}";
        mvc.perform(post("/api/incidents/"+unknown.id()+"/disposition").with(user(technician.getEmail()).roles("TECHNICIAN")).with(csrf()).contentType("application/json").content(withdrawal)).andExpect(status().isForbidden());
        mvc.perform(post("/api/incidents/"+unknown.id()+"/disposition").with(user(student.getEmail()).roles("STUDENT")).with(csrf()).contentType("application/json").content(withdrawal)).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CLOSED"));
        var closed=service.get(unknown.id(),student.getEmail());
        assertNull(closed.resolvedAt()); assertNotNull(closed.closedAt());
        assertTrue(closed.history().stream().anyMatch(h -> h.action().equals("CLOSED_WITHDRAWN")));
        var valid=submit("researchmesh Wi-Fi outage");
        mvc.perform(post("/api/incidents/"+valid.id()+"/disposition").with(user(student.getEmail()).roles("STUDENT")).with(csrf()).contentType("application/json").content(withdrawal)).andExpect(status().isConflict());
        String duplicate="{\"kind\":\"DUPLICATE\",\"reason\":\"Same original report\",\"duplicateOf\":"+unknown.id()+"}";
        mvc.perform(post("/api/incidents/"+valid.id()+"/disposition").with(user(student.getEmail()).roles("STUDENT")).with(csrf()).contentType("application/json").content(duplicate)).andExpect(status().isForbidden());
        mvc.perform(post("/api/incidents/"+valid.id()+"/disposition").with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json").content(duplicate)).andExpect(status().isOk());
        em.flush(); em.clear();
        var persisted=incidents.findById(valid.id()).orElseThrow();
        assertEquals(IncidentStatus.CLOSED,persisted.getStatus());
        assertNull(persisted.getResolvedAt()); assertNotNull(persisted.getResolutionDeadline());
        assertNull(persisted.resolutionSla(java.time.Instant.now().plusSeconds(86400)));
        assertFalse(assignments.assignPending(valid.id()));
        assertTrue(persisted.getHistory().stream().anyMatch(h -> h.getDescription().contains("of incident #"+unknown.id())));
        assertTrue(audit.findByIncident(valid.id()).stream().anyMatch(a -> a.action().equals("CLOSED_DUPLICATE")));
        var invalid=submit("Another unknown problem");
        service.dispose(invalid.id(),new IncidentData.Disposition(IncidentData.ClosureKind.INVALID,"Not an IT support request",null),admin.getEmail());
        assertEquals("CLOSED",jdbc.queryForObject("select status from incidents where id=?",String.class,invalid.id()));
    }
    @Test void customServiceTraversesRealPipelineAndApis() throws Exception {
        var original=jdbc.queryForList("select id,title,status,reporter_id from incidents order by id");
        var created=submit("researchmesh Wi-Fi outage");
        assertTrue(created.autoClassified());
        assertEquals(ItService.valueOf("CUSTOM_WIFI"),created.affectedService());
        assertEquals(IncidentStatus.ASSIGNED,created.status());
        assertEquals("Research Wi-Fi",created.serviceLabel());
        assertEquals(Level.HIGH,created.impact()); assertEquals(Level.HIGH,created.urgency());
        var expected=priorities.current().calculator().calculate(Level.HIGH,Level.HIGH,Level.HIGH);
        assertEquals(expected,created.priority());
        var policy=policies.findById(expected).orElseThrow();
        assertEquals(created.createdAt().plusSeconds(policy.getResponseMinutes()*60L),created.responseDeadline());
        assertEquals(created.createdAt().plusSeconds(policy.getResolutionMinutes()*60L),created.resolutionDeadline());
        new AutomaticAssignmentWorker(incidents,assignments).assignPending();
        assertFalse(assignments.assignPending(created.id()));
        em.flush(); em.clear();
        var stored=incidents.findById(created.id()).orElseThrow();
        assertEquals(ItService.valueOf("CUSTOM_WIFI"),stored.getAffectedService());
        assertEquals(IncidentStatus.ASSIGNED,stored.getStatus());
        assertEquals(technician.getId(),stored.getAssignedTechnician().getId());
        assertEquals(1,stored.getHistory().stream().filter(h -> h.getAction().equals("AUTO_ASSIGNED")).count());
        assertTrue(audit.findByIncident(created.id()).stream().anyMatch(a -> a.action().equals("AUTO_CLASSIFIED") && a.description().contains("MULTIPLICATIVE")));
        assertTrue(audit.findByIncident(created.id()).stream().anyMatch(a -> a.action().equals("AUTO_ASSIGNED")));
        assertTrue(jdbc.queryForObject("select count(*) from notification_deliveries where incident_id=? and recipient_id=?",Integer.class,created.id(),technician.getId())>0);
        for(var actor:java.util.List.of(student,technician)) {
            mvc.perform(get("/api/incidents/"+created.id()).with(user(actor.getEmail()).roles(actor.getRole().name())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.affectedService").value("CUSTOM_WIFI"))
                .andExpect(jsonPath("$.status").value("ASSIGNED"));
        }
        mvc.perform(post("/api/incidents/"+created.id()+"/reclassify").with(user(student.getEmail()).roles("STUDENT")).with(csrf())
            .contentType("application/json").content("{\"affectedService\":\"CUSTOM_WIFI\",\"impact\":\"HIGH\",\"urgency\":\"HIGH\",\"reason\":\"Unauthorized override\"}"))
            .andExpect(status().isForbidden());
        assertEquals(original,jdbc.queryForList("select id,title,status,reporter_id from incidents where id<>? order by id",created.id()));
        System.out.println("PIPELINE VERIFIED: CUSTOM_WIFI; "+expected+"; SLA "+policy.getResponseMinutes()+"/"+policy.getResolutionMinutes()+" minutes; SKILL_BASED NETWORK technician");
    }
    @Test void unknownDisabledAmbiguousAndInsufficientEvidenceRequireReview() {
        assertTrue(submit("Unknown unidentified issue").needsClassificationReview());
        catalog.update("SERVICE","CUSTOM_WIFI","Research Wi-Fi",false,Level.HIGH,"researchmesh");
        assertTrue(submit("researchmesh Wi-Fi outage").needsClassificationReview());
        catalog.update("SERVICE","CUSTOM_WIFI","Research Wi-Fi",true,Level.HIGH,"researchmesh");
        catalog.createService("SECOND_WIFI","Second Wi-Fi","Another network","researchmesh",Level.HIGH,true);
        assertTrue(submit("researchmesh Wi-Fi outage").needsClassificationReview());
        catalog.update("SERVICE","SECOND_WIFI","Second Wi-Fi",false,Level.HIGH,"researchmesh");
        var uncertain=service.create(new IncidentData.Create("researchmesh","I cannot access this network from my laptop.",Category.NETWORK,null,null,null),student.getEmail());
        assertTrue(uncertain.needsClassificationReview()); assertNull(uncertain.resolutionDeadline());
        catalog.update("SERVICE","CAMPUS_WIFI","Campus Wi-Fi",true,Level.HIGH,"eduroam");
        assertEquals(ItService.CAMPUS_WIFI,submit("eduroam outage").affectedService());
    }
    @Test void unavailableTechnicianLeavesPriorityAndSlaAndNotifiesAdminsOnce() {
        technician.setAvailability(Technician.Availability.UNAVAILABLE);
        var created=submit("researchmesh outage");
        assertFalse(assignments.assignPending(created.id()));
        assertFalse(assignments.assignPending(created.id()));
        em.flush(); em.clear();
        var stored=incidents.findById(created.id()).orElseThrow();
        assertEquals(IncidentStatus.CLASSIFIED,stored.getStatus()); assertNull(stored.getAssignedTechnician());
        assertEquals(created.priority(),stored.getPriority()); assertNotNull(stored.getResolutionDeadline());
        assertEquals(1,stored.getHistory().stream().filter(h -> h.getAction().equals("PENDING_ASSIGNMENT")).count());
        assertTrue(jdbc.queryForObject("select count(*) from notification_deliveries n join app_users u on n.recipient_id=u.id where n.incident_id=? and u.role='ADMIN' and n.message like '%Pending assignment:%'",Integer.class,created.id())>0);
    }
    @Test void unconfiguredServiceIsExcludedAndMissingSlaFailsExplicitly() {
        jdbc.update("update catalog_entries set criticality=null where code='CUSTOM_WIFI'");
        em.clear();
        assertTrue(submit("researchmesh outage").needsClassificationReview());
        catalog.update("SERVICE","CUSTOM_WIFI","Research Wi-Fi",true,Level.HIGH,"researchmesh");
        var priority=priorities.current().calculator().calculate(Level.HIGH,Level.HIGH,Level.HIGH);
        policies.deleteById(priority); policies.flush();
        var error=assertThrows(IllegalStateException.class,() -> service.create(new IncidentData.Create("researchmesh outage","Wi-Fi failed for all students, urgent assistance needed.",Category.NETWORK,null,null,null),student.getEmail()));
        assertTrue(error.getMessage().contains("SLA policy is missing for "+priority));
    }
    @Test void savedStrategyPreviewAndFullWorkLifecycleUseRealApis() throws Exception {
        var admin=users.findAll().stream().filter(u -> u.getRole()==Role.ADMIN && u.isEnabled()).findFirst().orElseThrow();
        mvc.perform(put("/api/admin/assignment-strategy").with(user(admin.getEmail()).roles("ADMIN")).with(csrf())
            .contentType("application/json").content("{\"strategy\":\"LOAD_BASED\"}")).andExpect(status().isOk());
        technician.setAvailability(Technician.Availability.UNAVAILABLE);
        var created=submit("researchmesh outage");
        technician.setAvailability(Technician.Availability.AVAILABLE);
        mvc.perform(get("/api/admin/assignment-preview/"+created.id()).with(user(student.getEmail()).roles("STUDENT"))).andExpect(status().isForbidden());
        var preview=assignments.preview(created.id(),admin.getEmail());
        assertEquals(AssignmentSettings.Mode.LOAD_BASED,preview.strategy());
        assertTrue(preview.technicians().stream().anyMatch(t -> t.id().equals(technician.getId()) && t.eligible() && t.selected()));
        assertTrue(assignments.assignPending(created.id()));
        mvc.perform(post("/api/incidents/"+created.id()+"/start").with(user(technician.getEmail()).roles("TECHNICIAN")).with(csrf()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("IN_PROGRESS")).andExpect(jsonPath("$.acknowledgedAt").isNotEmpty());
        var started=service.get(created.id(),student.getEmail());
        assertEquals(created.responseDeadline(),started.responseDeadline());
        assertEquals(1,started.history().stream().filter(h -> h.action().equals("ACKNOWLEDGED")).count());
        service.information(created.id(),new IncidentData.Message("Please confirm the device network settings."),technician.getEmail(),false);
        service.information(created.id(),new IncidentData.Message("The wireless adapter is enabled."),student.getEmail(),true);
        service.resolve(created.id(),new IncidentData.Resolution("Restored wireless access after correcting the configuration.","Checked the access point and verified connectivity."),technician.getEmail());
        service.verify(created.id(),new IncidentData.Verification(true,null),student.getEmail());
        assertEquals(IncidentStatus.CLOSED,service.close(created.id(),admin.getEmail()).status());
        em.flush(); em.clear();
        assertEquals(IncidentStatus.CLOSED,incidents.findById(created.id()).orElseThrow().getStatus());
    }
    @Test void knownAndOtherIncidentsCompletePipelineWithoutAdministratorAndStartWork() throws Exception {
        catalog.update("SERVICE","OTHER","General Support",true,Level.MEDIUM,"general-support-fallback");
        var known=service.create(new IncidentData.Create("researchmesh Wi-Fi outage","Wi-Fi unavailable for all students, urgent support required.",Category.NETWORK,null,null,Level.LOW),student.getEmail());
        assertEquals(IncidentStatus.ASSIGNED,known.status());
        assertEquals(IncidentStatus.ASSIGNED,service.get(known.id(),student.getEmail()).status());
        assertEquals(ItService.valueOf("CUSTOM_WIFI"),known.affectedService());
        assertNotEquals(Priority.PENDING,known.priority()); assertNotNull(known.resolutionDeadline());
        assertEquals(technician.getId(),known.assignedTechnician().id());

        technician.setAvailability(Technician.Availability.UNAVAILABLE);
        var generalTech=users.saveAndFlush(new Technician("General Support Technician","general-fallback-test@hyderabad.bits-pilani.ac.in","$2-test-only","DATABASE"));
        var other=service.create(new IncidentData.Create("General support request","I need routine assistance with an individual account; this is a general issue.",Category.OTHER,null,null,null),student.getEmail());
        assertFalse(other.needsClassificationReview(),"Choosing Other alone must not force administrator review.");
        assertEquals(Category.OTHER,other.category()); assertEquals(ItService.OTHER,other.affectedService());
        assertEquals(Level.MEDIUM,other.criticality());
        assertEquals(priorities.current().calculator().calculate(Level.LOW,Level.LOW,Level.MEDIUM),other.priority());
        assertNotNull(other.responseDeadline()); assertNotNull(other.resolutionDeadline());
        assertEquals(generalTech.getId(),other.assignedTechnician().id());
        assertTrue(incidents.findById(other.id()).orElseThrow().getHistory().stream().anyMatch(h -> h.getAction().equals("AUTO_ASSIGNED") && h.getDescription().contains("random general-support")));
        mvc.perform(get("/api/incidents").with(user(generalTech.getEmail()).roles("TECHNICIAN")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(other.id())).andExpect(jsonPath("$[0].title").value(other.title()));
        mvc.perform(post("/api/incidents/"+other.id()+"/start").with(user(generalTech.getEmail()).roles("TECHNICIAN")).with(csrf()))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("IN_PROGRESS"));
    }
    @Test void serviceHintIsPreservedAndConflictsRequireReview() {
        catalog.createService("OTHER_NETWORK","Other Network","A different network","othermesh",Level.MEDIUM,true);
        var created=service.create(new IncidentData.Create("researchmesh outage","Wi-Fi failed for all students, urgent assistance needed.",Category.NETWORK,ItService.valueOf("OTHER_NETWORK"),null,Level.LOW),student.getEmail());
        assertTrue(created.needsClassificationReview());
        assertEquals(Priority.PENDING,created.priority());
        em.flush(); em.clear();
        assertEquals("OTHER_NETWORK",jdbc.queryForObject("select reported_service from incidents where id=?",String.class,created.id()));
        assertEquals(Level.LOW,incidents.findById(created.id()).orElseThrow().getReportedUrgency());
        assertNull(incidents.findById(created.id()).orElseThrow().getAssignedTechnician());
    }
    @Test void reassignmentRequiresReasonPreservesSlaAndNotifiesPreviousOwner() throws Exception {
        var admin=users.findAll().stream().filter(u -> u.getRole()==Role.ADMIN && u.isEnabled()).findFirst().orElseThrow();
        var created=submit("researchmesh outage");
        assignments.assignPending(created.id());
        var replacement=users.saveAndFlush(new Technician("Replacement Network Technician","replacement-test@hyderabad.bits-pilani.ac.in","$2-test-only","NETWORK"));
        var persistedDeadline=jdbc.queryForObject("select resolution_deadline from incidents where id=?",java.sql.Timestamp.class,created.id()).toInstant();
        mvc.perform(put("/api/admin/users/"+technician.getId()).with(user(admin.getEmail()).roles("ADMIN")).with(csrf())
            .contentType("application/json").content("{\"name\":\"Pipeline Network Technician\",\"enabled\":false}"))
            .andExpect(status().isConflict());
        mvc.perform(post("/api/incidents/"+created.id()+"/assign").with(user(admin.getEmail()).roles("ADMIN")).with(csrf())
            .contentType("application/json").content("{\"technicianId\":"+replacement.getId()+"}"))
            .andExpect(status().isBadRequest());
        assignments.assign(created.id(),replacement.getId(),false,admin.getEmail(),"Primary technician requires a planned handover.");
        em.flush(); em.clear();
        var reassigned=service.get(created.id(),admin.getEmail());
        assertEquals(replacement.getId(),reassigned.assignedTechnician().id());
        assertEquals(persistedDeadline,reassigned.resolutionDeadline());
        assertTrue(reassigned.history().stream().anyMatch(h -> h.description().contains("planned handover")));
        assertTrue(jdbc.queryForObject("select count(*) from notification_deliveries where incident_id=? and recipient_id=? and type='INCIDENT_ASSIGNED'",Integer.class,created.id(),technician.getId())>=2);
    }
    @Test void messagesPersistWithPrivateNotesExcludedAndObjectAuthorization() throws Exception {
        var created=submit("researchmesh outage"); assignments.assignPending(created.id());
        service.start(created.id(),technician.getEmail());
        service.note(created.id(),new IncidentData.Note("Private diagnostic details",InvestigationNote.Visibility.INTERNAL),technician.getEmail());
        mvc.perform(post("/api/incidents/"+created.id()+"/messages").with(user(student.getEmail()).roles("STUDENT")).with(csrf())
            .contentType("application/json").content("{\"content\":\"The connection is still failing.\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.messages[0].content").value("The connection is still failing."));
        em.flush(); em.clear();
        var received=conversations.list(created.id(),technician.getEmail());
        assertEquals(1,received.messages().size()); assertEquals(1,received.unreadCount());
        conversations.read(created.id(),received.messages().getFirst().id(),technician.getEmail());
        em.flush(); em.clear();
        assertEquals(0,conversations.list(created.id(),technician.getEmail()).unreadCount());
        conversations.send(created.id(),"Please try connecting again.",technician.getEmail());
        assertEquals(1,conversations.list(created.id(),student.getEmail()).unreadCount());
        assertFalse(service.get(created.id(),student.getEmail()).notes().stream().anyMatch(n -> n.content().contains("Private diagnostic")));
        var outsider=users.saveAndFlush(new Technician("Unrelated Technician","unrelated-test@hyderabad.bits-pilani.ac.in","$2-test-only","NETWORK"));
        mvc.perform(get("/api/incidents/"+created.id()+"/messages").with(user(outsider.getEmail()).roles("TECHNICIAN"))).andExpect(status().isForbidden());
        mvc.perform(post("/api/incidents/"+created.id()+"/messages").with(user(outsider.getEmail()).roles("TECHNICIAN")).with(csrf())
            .contentType("application/json").content("{\"content\":\"Unauthorized message\"}")).andExpect(status().isForbidden());
    }
    @Test void scheduledBreachCatchUpPersistsAndDeduplicatesWithoutLogin() {
        var created=submit("researchmesh outage"); em.flush();
        var overdue=java.time.Instant.now().minusSeconds(1);
        jdbc.update("update incidents set response_deadline=?, resolution_deadline=? where id=?",java.sql.Timestamp.from(overdue),java.sql.Timestamp.from(overdue),created.id());
        em.flush(); em.clear();
        slaMonitor.runScheduled(); em.flush();
        int events=jdbc.queryForObject("select count(*) from scheduled_events where incident_id=?",Integer.class,created.id());
        int notifications=jdbc.queryForObject("select count(*) from notification_deliveries where incident_id=?",Integer.class,created.id());
        assertTrue(events>=2);
        assertTrue(jdbc.queryForObject("select count(*) from scheduled_events where incident_id=? and type='INCIDENT_ESCALATED'",Integer.class,created.id())>0);
        em.clear(); slaMonitor.runScheduled(); em.flush();
        assertEquals(events,jdbc.queryForObject("select count(*) from scheduled_events where incident_id=?",Integer.class,created.id()));
        assertEquals(notifications,jdbc.queryForObject("select count(*) from notification_deliveries where incident_id=?",Integer.class,created.id()));
    }
    @Test void customCategoryCreationClassificationAndDisablePreserveHistory() throws Exception {
        var admin=users.findAll().stream().filter(u -> u.getRole()==Role.ADMIN && u.isEnabled()).findFirst().orElseThrow();
        String body="{\"code\":\"RESEARCH_NETWORK\",\"label\":\"Research Network\",\"keywords\":\"researchmesh\",\"enabled\":true,\"requiredSkill\":\"NETWORK\"}";
        mvc.perform(post("/api/admin/catalog/categories").with(user(student.getEmail()).roles("STUDENT")).with(csrf()).contentType("application/json").content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/admin/catalog/categories").with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json").content(body)).andExpect(status().isOk());
        assertTrue(service.options(student.getEmail()).categories().stream().anyMatch(c -> c.value().equals("RESEARCH_NETWORK")));
        var created=service.create(new IncidentData.Create("researchmesh issue","Researchmesh unavailable for all students, urgent assistance needed.",Category.valueOf("RESEARCH_NETWORK"),null,null,Level.LOW),student.getEmail());
        assertEquals(Category.valueOf("RESEARCH_NETWORK"),created.category());
        assertFalse(assignments.assignPending(created.id()));
        em.flush(); em.clear();
        var stored=incidents.findById(created.id()).orElseThrow();
        assertEquals(Category.valueOf("RESEARCH_NETWORK"),stored.getCategory());
        assertEquals(TechnicianSkill.NETWORK,stored.requiredSkill());
        assertEquals(technician.getId(),stored.getAssignedTechnician().getId());
        catalog.update("CATEGORY","RESEARCH_NETWORK","Research Network",false,null,"researchmesh");
        assertFalse(service.options(student.getEmail()).categories().stream().anyMatch(c -> c.value().equals("RESEARCH_NETWORK")));
        assertEquals(Category.valueOf("RESEARCH_NETWORK"),service.get(created.id(),student.getEmail()).category());
        assertEquals(1,service.list(student.getEmail(),true,null,null,Category.valueOf("RESEARCH_NETWORK"),null).size());
    }
    @Test void savedStrategiesAndSlaPoliciesControlNewDecisionsWithoutRewritingHistory() throws Exception {
        var admin=users.findAll().stream().filter(u -> u.getRole()==Role.ADMIN && u.isEnabled()).findFirst().orElseThrow();
        var request=new IncidentData.Create("researchmesh routine request","Routine Wi-Fi assistance for all students is needed.",Category.NETWORK,null,null,Level.HIGH);
        mvc.perform(put("/api/admin/priority-strategy").with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json")
            .content("{\"strategy\":\"MULTIPLICATIVE\",\"impactWeight\":0.4,\"urgencyWeight\":0.4,\"criticalityWeight\":0.2,\"multiplicativeThresholds\":{\"p1\":18,\"p2\":12,\"p3\":4}}"))
            .andExpect(status().isOk());
        var first=service.create(request,student.getEmail()); assertEquals(Priority.P3,first.priority()); assertEquals(Level.LOW,first.urgency());
        mvc.perform(put("/api/admin/priority-strategy").with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json")
            .content("{\"strategy\":\"WEIGHTED\",\"impactWeight\":0.4,\"urgencyWeight\":0.4,\"criticalityWeight\":0.2,\"weightedThresholds\":{\"p1\":75,\"p2\":50,\"p3\":25}}"))
            .andExpect(status().isOk());
        mvc.perform(put("/api/admin/sla-policies/P2").with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json")
            .content("{\"responseMinutes\":23,\"resolutionMinutes\":180}")).andExpect(status().isOk());
        var second=service.create(request,student.getEmail()); assertEquals(Priority.P2,second.priority());
        assertEquals(second.createdAt().plusSeconds(23*60),second.responseDeadline()); assertEquals(second.createdAt().plusSeconds(180*60),second.resolutionDeadline());
        assertEquals(Priority.P3,service.get(first.id(),student.getEmail()).priority());
        assertEquals(first.resolutionDeadline(),service.get(first.id(),student.getEmail()).resolutionDeadline());
        mvc.perform(post("/api/incidents/"+second.id()+"/priority-override").with(user(student.getEmail()).roles("STUDENT")).with(csrf()).contentType("application/json")
            .content("{\"priority\":\"P1\",\"reason\":\"Verified time-sensitive outage\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/incidents/"+second.id()+"/priority-override").with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json")
            .content("{\"priority\":\"P1\",\"reason\":\"Verified time-sensitive outage\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.priority").value("P1"));
        assertEquals(second.resolutionDeadline(),service.get(second.id(),student.getEmail()).resolutionDeadline());
        assertTrue(audit.findByIncident(second.id()).stream().anyMatch(a -> a.action().equals("PRIORITY_CONFIGURATION_SNAPSHOT") && a.description().contains("WEIGHTED")));
        assertTrue(service.get(second.id(),student.getEmail()).history().stream().anyMatch(h -> h.action().equals("PRIORITY_OVERRIDDEN") && h.description().contains("Verified time-sensitive")));
    }
    @Test void reportedScopeRemainsUnverifiedAndConflictingEvidenceRequiresReview() {
        var conflicting=service.create(new IncidentData.Create("researchmesh outage","Wi-Fi unavailable for all students, urgent assistance needed.",Category.NETWORK,null,null,Level.HIGH,1),student.getEmail());
        assertTrue(conflicting.needsClassificationReview()); assertEquals(Priority.PENDING,conflicting.priority());
        var countOnly=service.create(new IncidentData.Create("researchmesh outage","The connection fails with an unknown error.",Category.NETWORK,null,null,Level.HIGH,100),student.getEmail());
        assertTrue(countOnly.needsClassificationReview()); assertNull(countOnly.impact());
        em.flush();
        assertEquals(100,jdbc.queryForObject("select reported_affected_users from incidents where id=?",Integer.class,countOnly.id()));
    }
    @Test void templateMappingReturnsOnlyEnabledCatalogHints() throws Exception {
        var admin=users.findAll().stream().filter(u -> u.getRole()==Role.ADMIN && u.isEnabled()).findFirst().orElseThrow();
        catalog.createCategory("RESEARCH_NETWORK","Research Network","researchmesh",true,TechnicianSkill.NETWORK);
        mvc.perform(post("/api/admin/problem-templates").with(user(admin.getEmail()).roles("ADMIN")).with(csrf()).contentType("application/json")
            .content("{\"title\":\"Research mesh issue\",\"category\":\"Research\",\"categoryCode\":\"RESEARCH_NETWORK\",\"serviceCode\":\"CUSTOM_WIFI\",\"description\":\"Describe the observed network symptoms\",\"enabled\":true,\"displayOrder\":0,\"keywords\":\"researchmesh\"}"))
            .andExpect(status().isOk());
        mvc.perform(get("/api/student/problem-templates").with(user(student.getEmail()).roles("STUDENT")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.title == 'Research mesh issue')].categoryCode").value(org.hamcrest.Matchers.hasItem("RESEARCH_NETWORK")));
        catalog.update("CATEGORY","RESEARCH_NETWORK","Research Network",false,null,"researchmesh");
        em.flush();
        mvc.perform(get("/api/student/problem-templates").with(user(student.getEmail()).roles("STUDENT")))
            .andExpect(status().isOk()).andExpect(jsonPath("$[?(@.title == 'Research mesh issue')].categoryCode").value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.nullValue())));
    }
}
