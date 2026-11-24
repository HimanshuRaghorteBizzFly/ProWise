-- Sessions last up to 7 days (configurable). One sessions row per sign-in (and per workspace switch): a refresh
-- rotates the refresh token ON THAT ROW, so access tokens already issued for the session stay valid until their own
-- 15-minute expiry. Every replaced refresh-token hash is kept so a reused old token is recognised (reuse detection
-- revokes the whole session family). Only SHA-256 hashes are stored, never the token itself.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS refresh_count INT NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS revoked_reason VARCHAR(40);

CREATE TABLE session_refresh_history (
    token_hash VARCHAR(128) PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES sessions (id) ON DELETE CASCADE,
    rotated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_session_refresh_history_session ON session_refresh_history (session_id);
CREATE TRIGGER trg_session_refresh_history_append_only
    BEFORE UPDATE ON session_refresh_history
    FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION prevent_people_history_change();
