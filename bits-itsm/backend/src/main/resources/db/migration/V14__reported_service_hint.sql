-- Preserve the student's selection separately from the authoritative classification.
ALTER TABLE incidents ADD COLUMN reported_service varchar(50);
ALTER TABLE incidents ADD CONSTRAINT incidents_reported_service_check
    CHECK (reported_service ~ '^[A-Z][A-Z0-9_]{1,49}$');
