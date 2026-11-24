-- Task 1.1 (authentication hardening): per-account lockout after repeated failed sign-ins, and the device details a
-- member needs to recognise and revoke their own sessions. Additive only; existing rows keep working unchanged.

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
ALTER TABLE users ADD CONSTRAINT ck_users_failed_login_count CHECK (failed_login_count >= 0);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent VARCHAR(300);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- "My sessions" lists open sessions per user, newest first.
CREATE INDEX IF NOT EXISTS idx_sessions_user_open ON sessions (user_id, created_at DESC) WHERE revoked_at IS NULL;
