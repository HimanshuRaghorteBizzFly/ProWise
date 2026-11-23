-- Account setup without administrator-known passwords (approved decisions 2, 3 and 4).
-- Additive only: no rows are deleted and no existing column is dropped.

-- 1. New accounts wait in PENDING_ACTIVATION until the owner sets a password through a setup link.
ALTER TABLE users DROP CONSTRAINT ck_users_status;
ALTER TABLE users ADD CONSTRAINT ck_users_status
    CHECK (status IN ('ACTIVE', 'DISABLED', 'PENDING_ACTIVATION'));

-- 2. One token table, two purposes: SETUP (72 hours, superseded on resend) and RESET (30 minutes).
--    Existing rows are password resets.
ALTER TABLE password_reset_tokens ADD COLUMN purpose VARCHAR(10) NOT NULL DEFAULT 'RESET';
ALTER TABLE password_reset_tokens ADD CONSTRAINT ck_password_reset_tokens_purpose
    CHECK (purpose IN ('RESET', 'SETUP'));
CREATE INDEX idx_password_reset_tokens_open_by_user
    ON password_reset_tokens (user_id, purpose) WHERE used_at IS NULL;

-- 3. Delivery status per account, so administrators can see a failed setup email and resend it.
ALTER TABLE email_delivery_logs ADD COLUMN user_id UUID NULL REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE email_delivery_logs ADD COLUMN email_type VARCHAR(40) NULL;
CREATE INDEX idx_email_delivery_logs_user_type
    ON email_delivery_logs (user_id, email_type, created_at DESC);
