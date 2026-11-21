-- Extend the existing transfer-request table for optional technician suggestions.
alter table transfer_requests alter column proposed_technician_id drop not null;
alter table transfer_requests add column if not exists assigned_technician_id bigint references app_users(id);
update transfer_requests set assigned_technician_id = proposed_technician_id
    where status = 'APPROVED' and assigned_technician_id is null and proposed_technician_id is not null;
alter table transfer_requests drop constraint if exists transfer_requests_reason_check;
alter table transfer_requests add constraint transfer_requests_reason_check
    check (reason in ('DIFFERENT_SPECIALIZATION','EXCESSIVE_WORKLOAD','TECHNICIAN_UNAVAILABLE','SENIOR_ESCALATION','OTHER',
                      'HIGH_WORKLOAD','LACK_OF_EXPERTISE','UNAVAILABLE','INCORRECT_ASSIGNMENT','BETTER_SUITED_TECHNICIAN'));
create index if not exists transfer_requests_status_requested_idx on transfer_requests (status, requested_at desc);
create index if not exists transfer_requests_assigned_technician_idx on transfer_requests (assigned_technician_id);
