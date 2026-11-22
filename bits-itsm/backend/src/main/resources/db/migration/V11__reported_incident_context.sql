-- Preserve the student's report independently of calculated classification.
-- Historical reports remain null because their original input is unknown.
alter table incidents add column reported_category varchar(255);
alter table incidents add column reported_urgency varchar(255);
