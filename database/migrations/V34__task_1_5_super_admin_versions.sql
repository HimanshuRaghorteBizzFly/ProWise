-- V34: Optimistic concurrency (rule 5) for every record the Super Admin console edits.
-- Each table below gets the JPA @Version column the API exposes as "version" and checks against the client's
-- "expected_version" (409 STALE_VERSION when stale). Additive only; existing rows start at version 0.
-- These are platform (non-tenant) tables, so they have no org_id (same as V32 for platform_operators).

ALTER TABLE payments                ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE announcements           ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE feature_flags           ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE license_keys            ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE platform_policies       ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE platform_branding       ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

-- platform_operators: bumped only by Super Admin edits (a version-guarded UPDATE), never by sign-in bookkeeping.
ALTER TABLE platform_operators      ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

-- Operator-module records the Super Admin also manages.
ALTER TABLE incidents               ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE support_tickets         ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE support_access_requests ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE maintenance_windows     ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

-- Reports over real data (GET /v1/admin/reports/overview) group these by creation time.
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_timestamp ON admin_audit_logs (timestamp);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations (created_at);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);
