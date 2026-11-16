alter table notification_deliveries add column recipient_email varchar(254);
alter table notification_deliveries add column attempts integer not null default 0;
alter table notification_deliveries add column next_attempt_at timestamp with time zone;
alter table notification_deliveries add column last_attempt_at timestamp with time zone;
alter table notification_deliveries add column sent_at timestamp with time zone;
alter table notification_deliveries add column last_error varchar(255);
create unique index student_email_event_idx on notification_deliveries (incident_id, type)
where channel = 'EMAIL' and type in ('INCIDENT_RECEIVED', 'WORK_STARTED', 'INCIDENT_RESOLVED') and delivery_status <> 'SIMULATED_UNSENT';
create index email_pending_idx on notification_deliveries (next_attempt_at) where channel = 'EMAIL' and delivery_status in ('PENDING','FAILED','SENDING');
