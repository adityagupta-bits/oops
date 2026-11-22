ALTER TABLE app_users ADD COLUMN credential_version bigint NOT NULL DEFAULT 0;
CREATE TABLE password_reset_tokens (
    token_hash varchar(64) PRIMARY KEY,
    user_id bigint NOT NULL REFERENCES app_users(id),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens(user_id);
