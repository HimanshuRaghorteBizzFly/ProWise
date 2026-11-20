-- Migration V7: Platform Operator Authentication, Refresh Tokens, Invitations, Password Resets & Login History

-- 1. Extend platform_operators table with authentication fields
ALTER TABLE platform_operators ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE platform_operators ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE platform_operators ADD COLUMN IF NOT EXISTS password_setup_completed BOOLEAN NOT NULL DEFAULT true;

-- Update seeded operators with initial password hash ('Operator2026!')
UPDATE platform_operators
SET password_hash = '$2a$10$4b0rjVL9OrfiXT2yXc11c.x5Q.wK12FsTd/UzkoOtp2GKu7ujVdQK',
    password_setup_completed = true
WHERE password_hash IS NULL;

-- 2. Extend operator_sessions with refresh token hash
ALTER TABLE operator_sessions ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(128);
CREATE INDEX IF NOT EXISTS idx_op_sessions_refresh ON operator_sessions (refresh_token_hash);

-- 3. Operator Invitations table (single-use, expiring invitation tokens)
CREATE TABLE IF NOT EXISTS operator_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id VARCHAR(64) NOT NULL REFERENCES platform_operators (id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_op_invitations_token ON operator_invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_op_invitations_email ON operator_invitations (lower(email));

-- 4. Operator Password Resets table (single-use, expiring reset tokens)
CREATE TABLE IF NOT EXISTS operator_password_resets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id VARCHAR(64) NOT NULL REFERENCES platform_operators (id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_op_pw_resets_token ON operator_password_resets (token_hash);
CREATE INDEX IF NOT EXISTS idx_op_pw_resets_email ON operator_password_resets (lower(email));

-- 5. Operator Login History
CREATE TABLE IF NOT EXISTS operator_login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id VARCHAR(64) REFERENCES platform_operators (id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    status VARCHAR(40) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    failure_reason TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_op_login_history_email ON operator_login_history (lower(email), occurred_at DESC);
