-- Keep all existing values: older MEDIUM defaults cannot be distinguished safely
-- from administrator choices. Only newly initialized services start unconfigured.
alter table catalog_entries alter column criticality drop not null;
alter table catalog_entries alter column criticality drop default;
