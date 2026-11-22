ALTER TABLE investigation_notes
    ADD COLUMN urgent boolean NOT NULL DEFAULT false;

ALTER TABLE incident_message_reads
    ADD COLUMN channel varchar(16) NOT NULL DEFAULT 'STUDENT';

ALTER TABLE incident_message_reads
    DROP CONSTRAINT incident_message_reads_pkey;

ALTER TABLE incident_message_reads
    ADD CONSTRAINT incident_message_reads_pkey PRIMARY KEY (incident_id, user_id, channel);

ALTER TABLE incident_message_reads
    ADD CONSTRAINT incident_message_reads_channel_check CHECK (channel IN ('STUDENT', 'INTERNAL'));
