insert into sla_policies(priority, response_minutes, resolution_minutes)
values ('P1',5,30), ('P2',15,120), ('P3',60,480), ('P4',240,1440)
on conflict (priority) do nothing;

-- Preserve every existing deadline; only populate missing legacy snapshots.
update incidents i set
    response_target_minutes = coalesce(i.response_target_minutes, p.response_minutes),
    resolution_target_minutes = coalesce(i.resolution_target_minutes, p.resolution_minutes),
    response_deadline = coalesce(i.response_deadline, i.created_at + coalesce(i.response_target_minutes, p.response_minutes) * interval '1 minute'),
    resolution_deadline = coalesce(i.resolution_deadline, i.created_at + coalesce(i.resolution_target_minutes, p.resolution_minutes) * interval '1 minute'),
    criticality = coalesce(i.criticality, 'MEDIUM')
from sla_policies p where i.priority = p.priority and i.priority <> 'PENDING';
