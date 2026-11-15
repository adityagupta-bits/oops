# Test cases for the services layer (68 automated JUnit tests, no Spring context, no database)

| Class | Tests | Category | What it proves |
|---|---|---|---|
| SlaCalculatorTest | 13 | Normal / boundary / invalid | targets match the SLA table; exactly at the deadline is not breached, 1 ms later is; MET and BREACHED when resolved on/after time; PENDING, missing priority and non-positive time scale rejected |
| SlaMonitorTest | 8 | Normal / business rule / exception | warning once at 80%; breach once; acknowledged incident has no response breach; resolution clock after acknowledgement; closed ignored; unprioritised incident skipped without stopping others; violations list; snapshots |
| EscalationServiceTest | 8 | Business rule / boundary | no escalation at the deadline; P1 to Team Lead; full chain capped at IT Manager; no repeat event; every step audited; acknowledgement stops it; only P1 escalates; system-generated events |
| DuplicateDetectorTest | 12 | Normal / boundary / invalid | similar reports detected (incl. the problem statement's payment example); different service is not a duplicate; low similarity ignored; closed excluded; never its own duplicate; threshold; event published only on a match; null service and null text handled |
| EventBusAuditTest | 9 | Normal / exception | all observers notified; failing observer isolated; null type/id rejected; system events have no actor; audit fields kept; per-incident newest-first history; action-name to event-type mapping; publisher forwards to the bus |
| NotificationServiceTest | 10 | Normal / business rule / exception / authorization | all channels receive; recipients per event type; actor not notified of own action; all admins notified; missing technician skipped; mark-read only for the owner; failing channel isolated; message wording |
| SmartRecommendationAssignmentTest | 8 | Normal / boundary / business rule | routine incident favours skill, urgent favours low load; required skill is mandatory; disabled/busy/unavailable/full excluded; empty result; id tie-break; score formula (uses the real Incident and Technician classes) |

Not covered by automated tests (state this honestly in the report): the Spring wiring, the database adapter
(RepositoryIncidentLookup), the HTTP endpoints and the scheduler, because they need a running Postgres.
These must be checked by running the application and the demo workflows.
