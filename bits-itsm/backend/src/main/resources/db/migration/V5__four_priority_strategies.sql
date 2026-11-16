-- Preserve the existing weights, selected strategy, incidents and SLA snapshots.
alter table priority_settings drop constraint if exists priority_settings_strategy_check;
alter table priority_settings add constraint priority_settings_strategy_check check (strategy in ('MULTIPLICATIVE','WEIGHTED','MATRIX','RULE_BASED'));
alter table priority_settings add column multiplicative_thresholds jsonb not null default '{"p1":18,"p2":12,"p3":4}';
alter table priority_settings add column weighted_thresholds jsonb not null default '{"p1":75,"p2":50,"p3":25}';
alter table priority_settings add column matrix jsonb not null default '["P4","P3","P2","P3","P2","P1","P2","P1","P1"]';
alter table priority_settings add column critical_boost integer not null default 1 check (critical_boost between 0 and 3);
alter table priority_settings add column rules jsonb not null default '[{"condition":"ALL_HIGH","priority":"P1"},{"condition":"HIGH_IMPACT_AND_URGENCY","priority":"P2"},{"condition":"CRITICAL_SERVICE","priority":"P2"}]';
alter table priority_settings add column fallback varchar(255) not null default 'P3' check (fallback in ('P1','P2','P3','P4'));
