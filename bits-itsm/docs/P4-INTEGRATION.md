# Services integration

The services module is integrated; no manual source-copy or event-hook steps remain.

IncidentService publishes lifecycle events and invokes duplicate detection. AssignmentService publishes assignment, transfer and collaboration events. EventBus dispatches audit and notification observers in the business transaction; persistence failures cause rollback. ScheduledEvents claims SLA/escalation events in PostgreSQL before publication, avoiding repeats after restart.

Notifications and student email use notification_deliveries. Audit history uses audit_events. Classification captures the configured criticality, priority and SLA targets.

See the root README for startup, migrations and deployment.

Student email now uses the persisted Gmail outbox in EmailChannel. Only the three reporter lifecycle messages are sent after commit; in-app notification delivery is unchanged. See the root README for configuration and retry behavior. Legacy student Gmail email rows are not sent.
