create index if not exists incident_reporter_created_idx on incidents (reporter_id, created_at desc);
create index if not exists incident_owner_status_idx on incidents (assigned_technician_id, status);
create index if not exists incident_service_status_idx on incidents (affected_service, status);
create index if not exists collaborator_technician_idx on incident_collaborators (technician_id);
create unique index if not exists pending_transfer_idx on transfer_requests (incident_id) where status = 'PENDING';
create unique index if not exists pending_collaboration_idx on collaboration_requests (incident_id, proposed_technician_id) where status = 'PENDING';
create unique index if not exists catalog_kind_code_idx on catalog_entries (kind, code);

-- NOT VALID preserves legacy records while enforcing references for all new writes.
alter table notification_deliveries add constraint notification_recipient_fk foreign key (recipient_id) references app_users (id) not valid;
alter table notification_deliveries add constraint notification_incident_fk foreign key (incident_id) references incidents (id) not valid;
alter table audit_events add constraint audit_actor_fk foreign key (actor_id) references app_users (id) not valid;
alter table audit_events add constraint audit_incident_fk foreign key (incident_id) references incidents (id) not valid;
alter table scheduled_events add constraint scheduled_incident_fk foreign key (incident_id) references incidents (id) not valid;
alter table incident_feedback add constraint feedback_rating_range check (rating between 1 and 5) not valid;
alter table priority_settings add constraint valid_priority_weights check (
    impact_weight >= 0 and urgency_weight >= 0 and criticality_weight >= 0
    and abs(impact_weight + urgency_weight + criticality_weight - 1) < 0.000001);
