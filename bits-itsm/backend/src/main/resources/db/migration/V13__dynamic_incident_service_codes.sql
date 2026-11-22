-- Retain historical values while allowing validated administrator-created service codes.
ALTER TABLE incidents DROP CONSTRAINT incidents_affected_service_check;
ALTER TABLE incidents ADD CONSTRAINT incidents_affected_service_check
    CHECK (affected_service ~ '^[A-Z][A-Z0-9_]{1,49}$');
