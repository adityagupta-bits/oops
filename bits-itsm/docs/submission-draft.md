# BITSolve submission material — draft for team review

Based on the current Java, React, SQL migrations and tests. This is not a final
university report. No original assignment PDF was found in the repository;
reconcile the rubric, formatting and terminology with that PDF before submission.
Mermaid sources below are editable diagrams, not claims of external deployment.

## System architecture

```mermaid
flowchart TD
    Browser[React: student, technician and administrator portals]
    Security[Spring Security: session, CSRF and role checks]
    API[REST controllers]
    Services[IncidentService, AssignmentService, PriorityService]
    Domain[Java entities, lifecycle rules and strategies]
    Store[JPA repositories and JdbcTemplate]
    DB[(PostgreSQL)]
    Bus[EventBus]
    Audit[AuditLogger and JpaAuditStore]
    InApp[NotificationService and InAppChannel]
    Queue[EmailChannel: transactional outbox]
    Worker[Scheduled email worker: JavaMailSender]
    Gmail[Gmail SMTP: external verification required]
    SLA[SlaMonitor and EscalationService]
    Browser --> Security --> API --> Services --> Domain
    Services --> Store --> DB
    Services --> Bus
    Bus --> Audit --> Store
    Bus --> InApp --> Store
    Bus --> Queue --> Store
    DB --> Worker --> Gmail
    SLA --> Bus
    SLA --> Store
```

React handles input/display; Java decides authorization, priority, assignment and
lifecycle validity. PostgreSQL is the persistent source of truth. JDBC is used
alongside JPA for atomic outbox claims, migrations and scheduled-event deduplication.
The Docker build packages React into the Spring Boot JAR, so production API calls
are same-origin. Local Vite proxies `/api` to Spring Boot.

Email preparation participates in the incident transaction. The scheduled worker
only sees committed rows and makes at most three delivery attempts. SMTP acceptance
is not proof of inbox delivery; crash recovery can still cause a duplicate after
an ambiguous send outcome. No live Gmail delivery is claimed.

## UML use-case draft

Mermaid flowchart notation approximates a use-case diagram; actors are outside the
system boundary and rounded nodes are use cases. Convert to formal UML notation
if the submission rubric requires it.

```mermaid
flowchart LR
    Student[Student]
    Technician[Technician]
    Admin[Administrator]
    subgraph BITSolve
        Login([Sign in and sign out])
        Report([Report and track own incidents])
        Reply([Reply to information requests])
        Verify([Verify resolution or report issue remains])
        Feedback([Submit feedback])
        Work([Acknowledge, investigate and resolve primary assignments])
        Notes([Add permitted investigation notes])
        Requests([Request transfer or collaboration])
        Knowledge([Search verified resolutions])
        Classify([Classify and calculate priority])
        Assign([Assign or reassign technicians])
        Review([Approve or reject team requests])
        Close([Close verified incident])
        Configure([Manage users, services, skills, strategies and SLA policies])
        Reports([Review reports, audit and escalation records])
        Notifications([Read own notifications])
    end
    Student --> Login
    Technician --> Login
    Admin --> Login
    Student --> Report & Reply & Verify & Feedback & Notifications
    Technician --> Work & Notes & Requests & Knowledge & Notifications
    Admin --> Classify & Assign & Review & Close & Configure & Reports & Notifications
```

Collaborators can add permitted notes but do not acquire the primary technician's
acknowledge/start/resolve authority. Manual assignment still enforces eligibility.
Escalation stages are recorded labels; there are no separate Team Lead/IT Manager
login roles. Categorization is a suggestion confirmed by an administrator, not an
autonomous replacement of the incident category. No RAG system is implemented.

## UML class diagram draft

```mermaid
classDiagram
    class User {
        <<abstract>>
        -Long id
        -String name
        -String email
        -String passwordHash
        -boolean enabled
        +getRole() Role
    }
    User <|-- Student
    User <|-- Technician
    User <|-- Administrator
    class Incident {
        -Priority priority
        -IncidentStatus status
        -Level impact
        -Level urgency
        -Level criticality
        +classify(Category, Priority)
        +acknowledge()
        +start()
        +resolve(String, String)
        +verify()
        +issueStillExists()
        +close()
    }
    Student "1" <-- "0..*" Incident : reporter
    Technician "0..1" <-- "0..*" Incident : primary
    Incident "1" *-- "0..*" InvestigationNote
    Incident "1" *-- "0..*" IncidentHistory
    Incident "1" *-- "0..1" IncidentFeedback
    Incident "1" *-- "0..*" IncidentCollaborator
    Technician "1" <-- "0..*" IncidentCollaborator
    class AssignmentRequest {
        <<abstract>>
        +requirePending()
        +review(Status, User, String)
    }
    AssignmentRequest <|-- TransferRequest
    AssignmentRequest <|-- CollaborationRequest
    AssignmentRequest --> Incident
    AssignmentRequest --> Technician : primary and proposed
    AssignmentRequest --> User : reviewedBy
    class PriorityStrategy {
        <<interface>>
        +calculate(Level, Level, Level) Priority
    }
    PriorityStrategy <|.. MultiplicativePriorityStrategy
    PriorityStrategy <|.. WeightedPriorityStrategy
    PriorityStrategy <|.. MatrixPriorityStrategy
    PriorityStrategy <|.. RuleBasedPriorityStrategy
    PriorityService --> PrioritySettings
    PriorityService --> PriorityStrategy
    PriorityService --> CatalogService
    CatalogService --> CatalogEntry
    class AssignmentStrategy {
        <<interface>>
        +assign(Incident, List) Optional
    }
    AssignmentStrategy <|.. SkillBasedAssignment
    AssignmentStrategy <|.. LoadBasedAssignment
    AssignmentService --> AssignmentStrategy
    AssignmentService --> WorkloadService
    AssignmentService --> AssignmentSettings
    IncidentService --> Incident
    IncidentService --> PriorityService
    IncidentService --> SlaPolicies
    IncidentService --> IncidentEventPublisher
    IncidentEventPublisher --> EventBus
    class IncidentObserver {
        <<interface>>
        +onEvent(IncidentEvent)
    }
    EventBus o-- IncidentObserver
    IncidentObserver <|.. AuditLogger
    IncidentObserver <|.. NotificationService
    IncidentObserver <|.. EmailChannel
```

The diagram focuses on active workflows, omitting getters, DTOs and repositories
for readability. Composition means notes/history belong to an incident; it does
not imply that the application supports deleting incidents. Strategy and Observer
are useful runtime patterns, not demonstration-only wrappers. Assignment offers
the two active strategies: skill-based and load-based.

## ER diagram draft

```mermaid
erDiagram
    APP_USERS ||--o{ INCIDENTS : reports
    APP_USERS o|--o{ INCIDENTS : primary_technician
    APP_USERS ||--o{ TECHNICIAN_SKILLS : has
    INCIDENTS ||--o{ INCIDENT_COLLABORATORS : includes
    APP_USERS ||--o{ INCIDENT_COLLABORATORS : collaborates
    INCIDENTS ||--o{ INVESTIGATION_NOTES : contains
    APP_USERS ||--o{ INVESTIGATION_NOTES : authors
    INCIDENTS ||--o{ INCIDENT_HISTORY : records
    APP_USERS ||--o{ INCIDENT_HISTORY : acts
    INCIDENTS ||--o| INCIDENT_FEEDBACK : receives
    APP_USERS ||--o{ INCIDENT_FEEDBACK : submits
    INCIDENTS ||--o{ TRANSFER_REQUESTS : has
    INCIDENTS ||--o{ COLLABORATION_REQUESTS : has
    APP_USERS ||--o{ TRANSFER_REQUESTS : primary_and_proposed
    APP_USERS o|--o{ TRANSFER_REQUESTS : reviews
    APP_USERS ||--o{ COLLABORATION_REQUESTS : primary_and_proposed
    APP_USERS o|--o{ COLLABORATION_REQUESTS : reviews
    APP_USERS ||--o{ NOTIFICATION_DELIVERIES : receives
    INCIDENTS o|--o{ NOTIFICATION_DELIVERIES : concerns
    APP_USERS o|--o{ AUDIT_EVENTS : actor
    INCIDENTS o|--o{ AUDIT_EVENTS : concerns
    INCIDENTS ||--o{ SCHEDULED_EVENTS : deduplicates
    APP_USERS {
        bigint id PK
        varchar role
        varchar email UK
        varchar password_hash
        boolean enabled
    }
    INCIDENTS {
        bigint id PK
        bigint reporter_id FK
        bigint assigned_technician_id FK
        varchar status
        varchar priority
        varchar affected_service
        varchar category
        varchar criticality
        timestamp response_deadline
        timestamp resolution_deadline
    }
    CATALOG_ENTRIES {
        varchar id PK
        varchar kind
        varchar code
        boolean enabled
        varchar criticality
    }
    PRIORITY_SETTINGS {
        bigint id PK
        varchar strategy
        jsonb matrix
        jsonb rules
    }
    ASSIGNMENT_SETTINGS {
        bigint id PK
        varchar strategy
    }
    SLA_POLICIES {
        varchar priority PK
        integer response_minutes
        integer resolution_minutes
    }
```

Roles share `app_users` through JPA single-table inheritance. The two request tables
inherit Java fields from `AssignmentRequest`; that superclass has no table.
Primary/proposed request relationships represent two distinct foreign keys each.
Catalog and policy codes are resolved by Java and captured in incident snapshots;
the diagram does not invent database foreign keys for those code lookups. Settings
are singleton rows. Flyway V1–V6 are the executable schema source; empty legacy SQL
files are not a schema export. Some legacy foreign keys are installed `NOT VALID`.

## Technology selection explanation

| Technology | Reason in this implementation | Limitation to explain |
|---|---|---|
| Java 25 and Spring Boot 4.1.2 | Domain methods enforce lifecycle rules; dependency injection connects real Strategy/Observer implementations. | Runtime/build versions must match the project. |
| Spring Security and BCrypt | Server sessions, role checks, CSRF protection and one-way password hashing. | Default sessions are in-process; restarting signs users out. |
| PostgreSQL and JPA | Relational ownership/history, constraints, transactional mutations and repository queries. | Database integration tests need disposable PostgreSQL. |
| JdbcTemplate | Explicit atomic outbox claims and deduplication SQL without another queue framework. | Some locking/SQL is PostgreSQL-specific. |
| Flyway | Ordered, versioned schema upgrades with validation. | Existing data still needs a backup and migration rehearsal. |
| React and Vite | Existing reusable forms/portals; production bundle served by Spring Boot. | Rules must remain enforced in Java, not only in forms. |
| JavaMailSender / Gmail SMTP | Small reporter-only email integration using the existing event/outbox infrastructure. | Requires a privately configured App Password and real delivery verification. |
| JUnit, Mockito, MockMvc and Node test runner | Domain, authorization, persistence and API-client regression tests. | Unit/mocked SMTP results are not proof of hosted Gmail delivery. |

## Documented regression test cases

Run `npm test` and `npm run build` in frontend. Run `mvnw.cmd test` in backend.
Database tests require `BITSOLVE_DB_TESTS=true`, a separate `BITSOLVE_TEST_DB_URL`,
database credentials and `DEMO_USER_PASSWORD`. They truncate test data: never use
the actual application database. Migration tests create/drop random test databases
and need CREATEDB permission on the disposable server. Tests explicitly configure
their service fixtures; production startup does not seed service criticality.

| ID | Test source / action | Expected result |
|---|---|---|
| T01 | `UserModelTests`: construct each user subtype | Correct role and validated institutional identity. |
| T02 | `PostgresAuthenticationTests.authenticatesPersistedRolesAndLogsOut` | Database accounts authenticate; logout invalidates access. |
| T03 | `BitsolveBackendApplicationTests`: role/CSRF requests | Unauthorized roles and missing CSRF cannot mutate protected resources. |
| T04 | `IncidentWorkflowTests.completesOrderedLifecycleAndTimestamps` | Ordered lifecycle reaches CLOSED with timestamps. |
| T05 | `IncidentWorkflowTests.rejectsSkippedTransitions` | Invalid transitions throw without changing the state. |
| T06 | `IncidentWorkflowTests.rejectedResolutionReturnsToInvestigation` | Rejected resolution returns to IN_PROGRESS. |
| T07 | `PriorityStrategyTests.multiplicativeThresholds` | Impact × urgency × criticality maps to expected priorities. |
| T08 | `PriorityStrategyTests.weightedThresholds` and `invalidWeightsAreRejected` | Normalized weighted score works; invalid weights fail. |
| T09 | `PriorityStrategyTests.configurableThresholdsIncludeTheirBoundaries` | Inclusive boundaries select the intended priority. |
| T10 | `PriorityStrategyTests.matrixUsesAllNineCellsAndCapsCriticalPromotion` | All cells work; critical adjustment never exceeds P1. |
| T11 | `PriorityStrategyTests.rulesAreOrderedAndFallbackIsExplicit` | First matching rule wins; fallback is explicit. |
| T12 | `PostgresManagementTests.unconfiguredServiceIsNeverDefaultedAndRequiresAdministratorConfiguration` | Startup leaves null/disabled; creation and preview reject missing criticality; administrator values survive reinitialization. |
| T13 | `PostgresManagementTests.allFourStrategiesPreviewSwitchAndAuditWithoutChangingHistory` | Preview does not save; each model persists; historical priority/deadlines remain unchanged; audit records exist. |
| T14 | `PostgresAssignmentTests`: automatic strategy and concurrent assignment cases | Skill/capacity rules hold and cannot overallocate through concurrent requests. |
| T15 | `PostgresAssignmentTests`: transfer review cases | Approval changes primary ownership; stale/unauthorized reviews are rejected. |
| T16 | `PostgresAssignmentTests`: collaboration cases | Approved collaborator gains team access without becoming primary. |
| T17 | `SlaClockTests.capturesTargetsFromCreationAndIgnoresLaterPolicyEdits` | Deadlines are captured once from creation time. |
| T18 | `SlaMonitorTest` and `PostgresManagementTests.scheduledEventClaimSurvivesServiceReconstruction` | Warning/breach boundaries and durable deduplication work. |
| T19 | `PostgresManagementTests.notificationReadStateAndRecipientAuthorizationArePersisted` | Only the recipient can read/mark their notification. |
| T20 | `PostgresStudentEmailTests.queuesExactlyThreeReporterEventsAndDeduplicates` | One queued message per required event, addressed to the reporter. |
| T21 | `PostgresStudentEmailTests.rollbackLeavesNoQueuedMessageAndNeverCallsSmtp` and `workerCannotSeeEmailUntilTheIncidentTransactionCommits` | Rollbacks/uncommitted transactions do not send mail. |
| T22 | `PostgresStudentEmailTests.missingConfigurationKeepsPendingAndFailureRetriesAreBounded` | Missing configuration keeps PENDING; failures stop at the retry limit. |
| T23 | `PostgresMigrationTests`: upgrade V1 and V5 fixtures to latest | Users, incidents, explicit criticality, deadlines and settings survive; constraints still work. |
| T24 | `intelligence/CategorySuggesterTest`, `DuplicateDetectorTest` | Keyword ambiguity and similarity rules yield predictable suggestions. |
| T25 | `frontend/src/api.test.js`: five API-client cases | Protected 401 emits expiry; login/403/validation/network failures do not; credentials and CSRF remain intact. |
| T26 | Browser: remove session cookie, then open protected page | Dashboard disappears, existing login appears, no `/auth/me` loop; sign-in works again. |

Record dated results separately from expected outcomes. Automated Java tests use
mock SMTP; T20–T22 do not demonstrate a real email reaching a student inbox.

## Three demonstration workflows

Prepare accounts through administrator setup: one administrator, two students,
and at least two technicians with relevant skills and available capacity. Explicitly
configure/enable Campus Wi-Fi criticality. Record incident IDs for comparison.

### Workflow 1 — Complete student incident lifecycle

1. Student signs in and reports a network issue with impact/urgency. Show saved NEW incident.
2. Administrator reviews the category suggestion, classifies it and shows calculated
   priority plus captured response/resolution deadlines; assigns an eligible technician.
3. Primary technician acknowledges and starts investigation. Add an internal note,
   request student information and show that the student cannot see the internal note.
4. Student replies. Technician resolves with summary and steps.
5. Student verifies resolution and submits feedback; administrator closes the incident.
6. Reload and show the persisted history, report totals and notification read state.
7. Inspect the three student outbox entries. Show actual received mail only after a
   separately configured real SMTP test; otherwise explain PENDING/mock verification.

### Workflow 2 — Transfer and collaboration with access control

1. Create/classify a new incident and assign technician A.
2. A requests transfer to eligible B; show that ownership remains A while pending.
3. Administrator approves. B sees the incident; A loses access unless separately a
   permitted collaborator. Verify original deadlines/history remain intact.
4. B requests a collaborator with a needed skill; administrator approves A if eligible.
5. A adds a permitted note through My Team Incidents. Show that A cannot acknowledge,
   start or resolve as primary; B retains control.
6. Show workload counts for both technicians. B resolves; student verifies and admin
   closes. Confirm capacity is released and request/audit history persists.

### Workflow 3 — Runtime configuration, SLA and intelligent suggestions

1. Administrator opens IT Services: show a newly unconfigured service, explicitly
   configure it and enable it. Confirm invalid missing-criticality use is rejected.
2. Preview the same impact/urgency/service with all four priority strategies. Save
   one, reload the settings and classify a new incident using the saved configuration.
3. Show an older incident retains its priority and deadlines after settings edits.
4. On a disposable demo database, set a short response target for the new incident's
   priority before classification; leave it unacknowledged until warning/breach.
5. Show the persisted SLA event/notification and audit. For P1, show escalation stages;
   explain these are stage labels routed to current technicians/admins.
6. Submit a similar open incident for the same service. Show duplicate suggestion
   and keyword category suggestion, with administrator judgment retained.
7. Finish the lifecycle and review reports; demonstrate expired-session recovery.

## Review and submission checklist

- Compare these drafts against the original university PDF and grading rubric.
- Render and review all diagrams; verify multiplicities and terminology with the team.
- Expand into the required report format, team contributions and references.
- Export an accurate schema if a standalone SQL deliverable is required; keep Flyway authoritative.
- Review/commit the intended implementation and provide the final repository link.
- Record the three workflows and final presentation; neither is completed by this draft.
- Verify Gmail, hosted PostgreSQL, Docker and HTTPS in the target environment before
  claiming successful deployment. No Railway deployment is performed by these drafts.
