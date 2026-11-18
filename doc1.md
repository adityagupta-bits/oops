# BITSolve Project Documentation

## 1. Project overview

BITSolve is a campus IT support system for BITS Pilani Hyderabad Campus. It helps
students report IT problems, technicians investigate them, and administrators
manage users, services, assignments and reports.

The project uses:

- React and Vite for the frontend
- Java 25 and Spring Boot 4.1.2 for the backend
- Spring Security for login, sessions, roles and CSRF protection
- Spring Data JPA and JDBC for database access
- PostgreSQL for permanent data storage
- Flyway for database migrations
- Gmail SMTP for optional student email notifications

The main project folders are:

```text
bits-itsm/
├── frontend/       React application
├── backend/        Spring Boot application
├── database/       Legacy SQL file locations
├── docs/            Project notes and diagrams
├── Dockerfile       Production container build
└── README.md       Setup and operational instructions
```

Flyway files under `backend/src/main/resources/db/migration` are the active
database schema source. The older files under `database/` are empty legacy files
and are not used to start the application.

## 2. Application architecture

The application follows this flow:

```text
React pages
    ↓
Spring Boot REST controllers
    ↓
Java service classes and domain entities
    ↓
JPA repositories / JdbcTemplate
    ↓
PostgreSQL
```

There are three authenticated portals:

1. Student portal for reporting and tracking personal incidents.
2. Technician portal for assigned work, investigation, transfers and collaboration.
3. Administrator portal for classification, user management, settings, reports and audit records.

The production application uses the Java APIs. Development preview pages are
available through Vite only and do not authenticate users or save operational data.

## 3. Main functionality

### Authentication and users

- Students, technicians and administrators use separate roles.
- Only institutional addresses ending in `@hyderabad.bits-pilani.ac.in` are accepted.
- Passwords are stored using BCrypt.
- Login uses a server session and CSRF protection.
- The session ID is changed after login.
- Disabled accounts lose access on their next API request.
- Administrators can create accounts and enable or disable them.
- Optional demo seeding is enabled only with a development profile and explicit environment settings.

### Incident lifecycle

Incident state changes are controlled by Java methods. The normal lifecycle is:

```text
NEW → CLASSIFIED → ASSIGNED → ACKNOWLEDGED → IN_PROGRESS
    → RESOLVED → VERIFIED → CLOSED
```

The system also supports reopening an incident when the student says that the
problem still exists. Students can edit their own report before classification.
Technicians can add notes, request information and record a resolution. Students
can reply to requests, verify the resolution and submit feedback.

### Priority calculation

Priority is calculated in Java. Students provide impact and urgency. Business
criticality is read from the selected service record in PostgreSQL.

The four available strategies are:

1. **Multiplicative**: impact × urgency × criticality.
2. **Weighted**: a weighted score using the three levels.
3. **Priority Matrix**: a configurable 3×3 impact and urgency matrix.
4. **Rule Based**: ordered administrator-configured conditions with a fallback.

Administrators can preview and save the strategy from the settings page. A saved
strategy affects future classifications. Existing incident priorities and SLA
deadlines are kept unchanged.

### Service criticality correction

New service records now start disabled and have no criticality. An administrator
must select LOW, MEDIUM or HIGH before enabling the service.

This prevents the application from silently treating an unconfigured service as
MEDIUM. Incident creation and priority preview reject a service without a configured
criticality. Existing configured values are preserved by migration V6.

The alternate `Incident` method that used a hardcoded multiplicative calculation and
MEDIUM criticality was removed. Priority now comes through the configured strategy.

### Technician assignment

The active assignment strategies are:

- **Skill based**: prefers technicians with the required skill.
- **Load based**: selects an eligible technician using current workload.

Assignment checks technician status, availability, skills and maximum workload.
Primary assignments and collaboration work are counted separately. Transfers keep
the incident history and SLA deadlines. Collaboration adds a second technician
without replacing the primary technician.

### SLA and escalation

SLA policies define response and resolution targets for P1 through P4. Deadlines
are captured when an incident is classified. Later policy changes do not restart
existing incident clocks.

The scheduled monitor creates warning and breach events once per phase. P1 incidents
can move through escalation levels when they are not acknowledged. Scheduled events
are saved in PostgreSQL so they are not repeated after a restart.

### Notifications and email

In-app notifications are stored in PostgreSQL and can be marked as read. The email
outbox supports exactly these student events:

- `INCIDENT_RECEIVED`
- `WORK_STARTED`
- `INCIDENT_RESOLVED`

Only the original reporter receives these emails. Messages contain the incident ID,
title, status and a short message. Internal notes and private investigation details
are not included.

Email rows are created in the same transaction as the incident change. A separate
worker sends committed rows using `JavaMailSender`. It records `PENDING`, `SENDING`,
`SENT` and `FAILED` states and stops after three attempts. Missing SMTP credentials
leave rows pending. SMTP has not been tested with a real Gmail account.

Required environment variables for email are:

```text
MAIL_USERNAME
MAIL_APP_PASSWORD
APP_BASE_URL              (optional)
MAIL_CONNECTION_TIMEOUT_MS
MAIL_READ_TIMEOUT_MS
MAIL_WRITE_TIMEOUT_MS
MAIL_POLL_INTERVAL_MS
MAIL_RETRY_SECONDS
```

`MAIL_APP_PASSWORD` must be a Google App Password. It must never be committed to Git.

### Intelligent features

The project includes two rule-based intelligent features:

- Duplicate incident suggestions using service matching and text similarity.
- Category suggestions using configured keywords and ambiguity handling.

These features provide suggestions for review. They do not silently change a saved
incident without an administrator decision.

## 4. Java OOP and design patterns

The project demonstrates the following concepts:

| Concept | Example |
|---|---|
| Encapsulation | `Incident` controls its own state transitions. |
| Inheritance | `Student`, `Technician` and `Administrator` extend `User`. |
| Abstraction | `PriorityStrategy`, `AssignmentStrategy` and `IncidentObserver`. |
| Polymorphism | Different priority and assignment strategies implement the same interface. |
| Composition | Services receive repositories and helper services through constructors. |
| Collections | Rules, skills, notes, histories and workload results use collections. |
| Exception handling | Invalid transitions, missing configuration and failed SMTP sends are handled. |
| Strategy Pattern | Four priority strategies and two assignment strategies are selected at runtime. |
| Observer Pattern | `EventBus` sends incident events to audit and notification observers. |
| Factory style | `NotificationFactory` creates notification records from events. |

The Strategy and Observer patterns are used for real application behavior. The
unused smart assignment class was removed to keep the code focused on the two
assignment strategies used by the settings page.

## 5. Important backend classes

| Class | Purpose |
|---|---|
| `AuthController` | Login, logout, current account and CSRF token endpoints. |
| `SecurityConfig` | Session, CSRF, role and route protection. |
| `IncidentService` | Incident creation, classification and lifecycle actions. |
| `Incident` | Entity methods that validate lifecycle transitions. |
| `PriorityService` | Reads service criticality and calculates priority. |
| `PrioritySettings` | Stores the selected strategy and its parameters. |
| `AssignmentService` | Assignments, transfers and collaboration requests. |
| `WorkloadService` | Calculates technician workload and remaining capacity. |
| `SlaMonitor` | Checks deadlines and publishes warning/breach events. |
| `ScheduledEvents` | Stores one-time scheduled events using SQL. |
| `NotificationService` | Chooses in-app notification recipients. |
| `EmailChannel` | Queues and sends reporter email notifications. |
| `AuditLogger` | Stores event audit records. |
| `CatalogService` | Loads and updates service/category records. |

## 6. Database migrations

| Migration | Purpose |
|---|---|
| V1 | Creates or adopts the main application tables. |
| V2 | Adds indexes, uniqueness rules and integrity constraints. |
| V3 | Captures missing legacy SLA targets and deadlines. |
| V4 | Adds student email outbox fields and duplicate protection. |
| V5 | Adds the four priority strategy configuration fields. |
| V6 | Allows new service records to remain unconfigured without changing existing values. |

Before upgrading a real database, make a backup and test the migration on a copy.
The integration tests use a disposable PostgreSQL database and must not point to
the real application database.

## 7. Session expiration behavior

The frontend has a central session-expiry event in `frontend/src/api.js`.

- A protected API request returning 401 emits the event.
- `App.jsx` clears the current user.
- The login page is shown again.
- `/auth/login` and the initial `/auth/me` check do not trigger a redirect loop.
- Validation, forbidden and conflict responses do not clear the session.

This keeps the browser state consistent with the server session.

## 8. Testing and verification

Latest verification performed on 19 November 2026:

| Check | Result |
|---|---|
| Backend tests with disposable PostgreSQL | 157 passed, 0 failed, 0 skipped |
| Backend tests without database setup | 157 passed, 34 database tests skipped |
| Frontend API tests | 5 passed, 0 failed |
| React production build | Passed; 33 modules transformed |
| Spring Boot package | Passed |
| Browser workflows | Passed for lifecycle, assignment, transfer, collaboration, settings and session expiry |
| Real Gmail delivery | Not tested |
| Railway deployment | Not performed |

The frontend tests cover protected 401 handling, login failures, validation errors,
forbidden responses, CSRF headers and network failures.

The PostgreSQL tests cover authentication, incidents, all four priority strategies,
service criticality, migrations, assignments, transfers, collaboration, SLA events,
notifications, email outbox behavior, reports and audit history.

## 9. Local startup

Create a PostgreSQL database, then set these variables in PowerShell:

```powershell
$env:DB_URL='jdbc:postgresql://localhost:5432/bitsolve'
$env:DB_USER='postgres'
$env:DB_PASSWORD='<database password>'
$env:BOOTSTRAP_ADMIN_EMAIL='<institutional admin email>'
$env:BOOTSTRAP_ADMIN_PASSWORD='<password with at least 12 characters>'
```

Start the backend:

```powershell
cd bits-itsm/backend
.\mvnw.cmd spring-boot:run
```

Start the frontend in another terminal:

```powershell
cd bits-itsm/frontend
npm.cmd ci
$env:BACKEND_URL='http://localhost:8080'
npm.cmd run dev
```

For an executable JAR, build the frontend first and then package the backend:

```powershell
cd bits-itsm/frontend
npm.cmd run build
cd ../backend
.\mvnw.cmd package -DskipTests
java -jar target/bitsolve-backend-0.0.1-SNAPSHOT.jar
```

## 10. Production notes

- Set `SPRING_PROFILES_ACTIVE=prod`.
- Set `SESSION_COOKIE_SECURE=true` when HTTPS is active.
- Keep demo seeding disabled.
- Use a private database password and Gmail App Password.
- Set `APP_BASE_URL` if email links should open the deployed application.
- Run health check `/api/health` after deployment.
- Verify persistence after a restart.

Railway, Docker and hosted HTTPS still require manual verification. Real Gmail
delivery must be tested with a configured sender account. The normal Gmail password
previously shared during development should be changed; the application should use
only a newly generated App Password.

## 11. Submission material

The file `bits-itsm/docs/submission-draft.md` contains draft Mermaid diagrams for:

- System architecture
- Use cases
- Java class relationships
- Database relationships
- Technology selection
- 26 test cases
- Three demonstration workflows

These drafts should be reviewed against the original university assignment PDF,
formatted into the final report, and supplemented with the final presentation,
GitHub link and demonstration video.

## 12. Current limitations

- Gmail delivery is implemented but externally unverified.
- Railway deployment and hosted HTTPS are not verified.
- Service and category codes still come from the Java enum taxonomy.
- Category prediction is a suggestion and needs administrator confirmation.
- Escalation levels are recorded in the system; separate Team Lead and IT Manager login roles are not present.
- The original university specification PDF was not found in the repository.

This document describes the current implementation and should be updated when
external deployment or real email verification is completed.
