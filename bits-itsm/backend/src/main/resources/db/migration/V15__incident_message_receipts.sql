ALTER TABLE investigation_notes DROP CONSTRAINT investigation_notes_kind_check;
ALTER TABLE investigation_notes ADD CONSTRAINT investigation_notes_kind_check
    CHECK (kind IN ('NOTE', 'INFORMATION_REQUEST', 'STUDENT_REPLY', 'MESSAGE'));
CREATE TABLE incident_message_reads (
    incident_id bigint NOT NULL REFERENCES incidents(id),
    user_id bigint NOT NULL REFERENCES app_users(id),
    last_read_message_id bigint NOT NULL REFERENCES investigation_notes(id),
    PRIMARY KEY (incident_id, user_id)
);
