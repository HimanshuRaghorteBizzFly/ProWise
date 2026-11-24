-- V32: Platform operator sign-in gets the same lockout as user sign-in (V29): five wrong passwords in a row lock
-- the account for 15 minutes. platform_operators is a platform (non-tenant) table, so it has no org_id.
ALTER TABLE platform_operators ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE platform_operators ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

ALTER TABLE platform_operators DROP CONSTRAINT IF EXISTS ck_platform_operators_failed_login_count;
ALTER TABLE platform_operators ADD CONSTRAINT ck_platform_operators_failed_login_count CHECK (failed_login_count >= 0);
