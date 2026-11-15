# Person 4: services, intelligence and tests

What it is: event bus (Observer), event log, in-app and simulated email notifications (Factory, Adapter-style
channels), SLA monitor with warnings/breaches, P1 escalation chain, duplicate detection, smart technician
recommendation (Strategy), and 68 unit tests.

Where files go: copy the `backend` folder contents of this package into `bits-itsm/backend` (everything is new,
nothing overwrites an existing file). Then follow P4-INTEGRATION.md.

Design notes
- Snapshots: services work on `IncidentSnapshot`, a plain copy of the fields they need, produced by
  `RepositoryIncidentLookup` inside a transaction. No lazy-loading surprises, and tests need no database.
- Patterns: Observer (EventBus + IncidentObserver), Strategy (SmartRecommendationAssignment), Factory
  (NotificationFactory), Adapter (RepositoryIncidentLookup, NotificationChannel implementations), Repository
  (AuditStore).
- Known limits: event log, in-app notifications, escalation state and SLA "already warned" memory are in RAM and
  reset on restart. Duplicate detection is rule-based (Jaccard similarity plus a small synonym list), not ML.
