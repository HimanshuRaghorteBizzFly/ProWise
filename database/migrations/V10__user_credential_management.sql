-- V10: User Credential Management, First-Time Login, and Authentication Audit Logs

-- 1. Extend users table for full profile, role, department, organization, and password change flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(200);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) NOT NULL DEFAULT 'VIEWER';
ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Backfill name from email prefix if null
UPDATE users SET name = split_part(email, '@', 1) WHERE name IS NULL OR name = '';

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_org_id ON users (organization_id);

-- 2. User Roles mapping table
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_roles_user_role UNIQUE (user_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_name ON user_roles(role_name);

-- 3. User Login History
CREATE TABLE IF NOT EXISTS user_login_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    ip_address VARCHAR(100),
    user_agent TEXT,
    status VARCHAR(30) NOT NULL,
    failure_reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_login_history_user_id ON user_login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_history_created_at ON user_login_history(created_at DESC);

-- 4. Authentication and User Governance Audit Logs
CREATE TABLE IF NOT EXISTS auth_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    actor_id UUID,
    actor_email VARCHAR(320),
    target_user_id UUID,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_action ON auth_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_created_at ON auth_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_logs_target ON auth_audit_logs(target_user_id);

-- 5. Seed default Super Admin user account (Password: SuperAdmin2026!)
INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'superadmin@prowise.com',
    '$2a$10$ABz3pFpyw3NC.JhRjL7fZeF7a1Ua2.N/9U4LaMvYXkmyxmchBuxHy',
    'Super Admin',
    'SUPER_ADMIN',
    'ACTIVE',
    false
)
ON CONFLICT (lower(email)) DO UPDATE
SET role = 'SUPER_ADMIN', name = 'Super Admin';

INSERT INTO user_roles (user_id, role_name)
SELECT id, 'SUPER_ADMIN' FROM users WHERE lower(email) = 'superadmin@prowise.com'
ON CONFLICT (user_id, role_name) DO NOTHING;
