ALTER TABLE incidents DROP CONSTRAINT incidents_category_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_category_check CHECK (category ~ '^[A-Z][A-Z0-9_]{1,49}$');
ALTER TABLE incidents ADD CONSTRAINT incidents_reported_category_check CHECK (reported_category ~ '^[A-Z][A-Z0-9_]{1,49}$');
ALTER TABLE catalog_entries ADD COLUMN required_skill varchar(40);
ALTER TABLE incidents ADD COLUMN classified_skill varchar(40);
ALTER TABLE catalog_entries ADD CONSTRAINT catalog_required_skill_check CHECK (required_skill IN ('NETWORK','HARDWARE','SOFTWARE','DATABASE','AUTHENTICATION','SECURITY','APPLICATION_SUPPORT','CLOUD','STORAGE'));
ALTER TABLE incidents ADD CONSTRAINT incident_classified_skill_check CHECK (classified_skill IN ('NETWORK','HARDWARE','SOFTWARE','DATABASE','AUTHENTICATION','SECURITY','APPLICATION_SUPPORT','CLOUD','STORAGE'));
