# Person 4 module: integration notes (for Person 2 and Person 1)

Everything Person 4 added lives in NEW packages (event, audit, notification, sla, escalation, intelligence,
support, api) plus one new file in `assignment/` (SmartRecommendationAssignment.java). No existing file is
changed by simply adding them. For the module to actually receive events, three small edits are needed.

## 0. BLOCKER: priority is never calculated
`Incident.priority` is initialised to PENDING and nothing ever changes it. The SLA monitor, escalation and the
SLA filter all skip PENDING incidents, so until a priority calculation exists (impact x urgency x criticality ->
P1..P4, with a setter or a `prioritise()` method on Incident that classify/create calls), no SLA warning,
breach or escalation will ever fire. This was Person 1's "Strategy pattern for priority" item.

## 1. IncidentService (Person 2): publish events
Add imports and two constructor parameters:

    import com.bits.itsm.event.IncidentEventPublisher;
    import com.bits.itsm.intelligence.DuplicateDetector;
    ...
    private final IncidentEventPublisher events;
    private final DuplicateDetector duplicates;
    public IncidentService(IncidentRepository incidents, UserRepository users,
            AssignmentSettingsRepository assignmentSettings,
            IncidentEventPublisher events, DuplicateDetector duplicates) { ... this.events = events; this.duplicates = duplicates; }

In `create(...)`, right after `incidents.saveAndFlush(incident);`:

    events.publish(incident.getId(), user.getId(), "CREATED", "Incident reported.");
    duplicates.check(incident.getId());

In `finish(...)`, right after `incidents.flush();`:

    events.publish(incident.getId(), actor.getId(), action, description);

## 2. AssignmentService (Person 2): publish assignments
Add `IncidentEventPublisher events` to the constructor. In `assign(...)`, right after `incidents.flush();`:

    events.publish(incident.getId(), user.getId(), automatic ? "AUTO_ASSIGNED" : "ASSIGNED", "Assigned to " + technician.getName() + ".");

(Optional) in `review(...)` after approving a transfer, publish "TECHNICIAN_CHANGED" the same way.

## 3. Optional: make the smart recommendation selectable
- `AssignmentSettings.Mode`: add `SMART`.
- In `AssignmentService.assign(...)` replace the SKILL_BASED/LOAD_BASED ternary with
  `switch (mode) { case SKILL_BASED -> new SkillBasedAssignment(); case LOAD_BASED -> new LoadBasedAssignment(); case SMART -> smart; }`
  and inject `SmartRecommendationAssignment smart` through the constructor.
- Add the option to the admin strategy selector in the frontend.
- Postgres note: Hibernate may have created a CHECK constraint on `assignment_settings.strategy` allowing only the
  two old values. If saving SMART fails with a constraint error, drop that constraint (or recreate the table).

## 4. Endpoints added (session login + CSRF as usual)
| Method and path | Who | Returns |
|---|---|---|
| GET /api/notifications | any signed-in user | own notifications, newest first (id, type, incidentId, title, message, timestamp, read) |
| POST /api/notifications/{id}/read | owner only | {"read": true} |
| GET /api/admin/audit | admin | event log, newest first |
| GET /api/admin/audit/{incidentId} | admin | event log of one incident |
| GET /api/admin/sla | admin | SLA status per prioritised incident (ON_TRACK, AT_RISK, BREACHED, MET) with deadlines |
| GET /api/admin/sla/violations | admin | only BREACHED |
| GET /api/admin/escalations | admin | current escalation level per incident |
| GET /api/admin/incidents/{id}/related | admin | possible duplicate / related incidents with similarity |

Person 3: `Notifications.jsx` and the admin audit/SLA screens can now call these instead of demoData.

## 5. Demo settings (optional, application.properties or environment)
    itsm.sla.time-scale=0.02            # a 30-minute SLA becomes 36 seconds
    itsm.sla.check-interval-ms=2000     # how often the monitor runs
    itsm.escalation.step-minutes=5      # time between escalation levels (also scaled)
    itsm.duplicate.threshold=0.4

## 6. Two kinds of history (say this in the report)
`IncidentHistory` (Person 2, database) records user actions per incident. The event log in this module
(`/api/admin/audit`) records the same lifecycle events plus system events (SLA, escalation, duplicates) that have no
user to attach to. The event log is in memory and resets on restart; it sits behind the `AuditStore` interface so a
database-backed version can be added without touching anything else.

## 7. Running only these tests
VS Code: Testing sidebar, run the classes in the packages event, sla, escalation, intelligence, notification, assignment.
Maven: `.\mvnw.cmd test -Dtest="SlaCalculatorTest,SlaMonitorTest,EscalationServiceTest,DuplicateDetectorTest,EventBusAuditTest,NotificationServiceTest,SmartRecommendationAssignmentTest"`
(The existing Postgres*Tests and contextLoads need a running database.)
