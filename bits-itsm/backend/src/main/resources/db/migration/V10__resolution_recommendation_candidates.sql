-- Keeps the bounded verified/closed resolution lookup ordered without reading every incident row.
create index if not exists incident_resolution_candidates_idx on incidents (status, updated_at desc);
