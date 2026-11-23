-- Live SMTP delivery: real settings, real connection tests, honest delivery logs.
-- Platform-level tables (no org_id): SMTP is configured once for the whole platform by the Super Admin.

-- 1. SMTP settings: drop simulation-only columns, add what real delivery needs.
ALTER TABLE email_providers DROP COLUMN IF EXISTS sandbox_mode;
ALTER TABLE email_providers DROP COLUMN IF EXISTS track_opens;
ALTER TABLE email_providers DROP COLUMN IF EXISTS track_clicks;

-- AES-256-GCM ciphertext ("v1:<base64>") is longer than the old 255-character column.
ALTER TABLE email_providers ALTER COLUMN password_encrypted TYPE TEXT;
-- false = the Super Admin never saved settings: delivery uses the SMTP_* environment variables.
ALTER TABLE email_providers ADD COLUMN admin_configured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE email_providers ADD COLUMN password_updated_at TIMESTAMPTZ;
ALTER TABLE email_providers ADD COLUMN updated_by VARCHAR(320);
ALTER TABLE email_providers ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

-- A status is only ever written by a real connection test. The seeded "CONNECTED" was never tested.
ALTER TABLE email_providers ALTER COLUMN connection_status TYPE VARCHAR(40);
ALTER TABLE email_providers ALTER COLUMN connection_status SET DEFAULT 'NOT_TESTED';
-- The old simulated save stored "enc_<uuid>" placeholders, which are not credentials: clear them.
UPDATE email_providers
SET connection_status = 'NOT_TESTED', last_tested_at = NULL, last_test_message = NULL,
    password_encrypted = NULL, admin_configured = false;

-- 2. Every connection test the Super Admin runs, with its real outcome.
CREATE TABLE smtp_connection_tests (
    id UUID PRIMARY KEY,
    provider_id VARCHAR(64) NOT NULL REFERENCES email_providers (id) ON DELETE CASCADE,
    status VARCHAR(40) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    encryption VARCHAR(20) NOT NULL,
    latency_ms INTEGER,
    server_response TEXT,
    detail TEXT,
    tested_by VARCHAR(320),
    tested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_smtp_connection_tests_provider ON smtp_connection_tests (provider_id, tested_at DESC);

-- 3. Delivery logs: what the SMTP server actually answered.
ALTER TABLE email_delivery_logs ADD COLUMN sender VARCHAR(320);
ALTER TABLE email_delivery_logs ADD COLUMN message_id VARCHAR(998);
ALTER TABLE email_delivery_logs ADD COLUMN smtp_response TEXT;
-- sent_at is the moment the SMTP server accepted the message; unknown until then.
ALTER TABLE email_delivery_logs ALTER COLUMN sent_at DROP NOT NULL;
ALTER TABLE email_delivery_logs ALTER COLUMN sent_at DROP DEFAULT;
ALTER TABLE email_delivery_logs ALTER COLUMN status SET DEFAULT 'QUEUED';
ALTER TABLE email_delivery_logs ALTER COLUMN provider DROP DEFAULT;

-- "DELIVERED" only ever meant "the SMTP server accepted it". Say exactly that.
UPDATE email_delivery_logs SET status = 'SMTP_ACCEPTED' WHERE status = 'DELIVERED';
UPDATE email_delivery_logs SET sent_at = NULL WHERE status <> 'SMTP_ACCEPTED';

CREATE INDEX idx_email_delivery_logs_created ON email_delivery_logs (created_at DESC);
CREATE INDEX idx_email_delivery_logs_type ON email_delivery_logs (email_type, created_at DESC);
CREATE INDEX idx_email_delivery_logs_recipient ON email_delivery_logs (lower(recipient));
