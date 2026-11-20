-- Migration V5: Platform Operator Departments, Permissions, Overrides, Sessions, and Audit Logs

CREATE TABLE IF NOT EXISTS operator_departments (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operator_department_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id VARCHAR(64) NOT NULL REFERENCES operator_departments (id) ON DELETE CASCADE,
    module_key VARCHAR(80) NOT NULL,
    permission_action VARCHAR(40) NOT NULL,
    CONSTRAINT uq_dept_perm UNIQUE (department_id, module_key, permission_action)
);

CREATE TABLE IF NOT EXISTS platform_operators (
    id VARCHAR(64) PRIMARY KEY,
    user_id UUID REFERENCES users (id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    email VARCHAR(320) NOT NULL,
    role_id VARCHAR(64) NOT NULL DEFAULT 'role-platform-operator',
    department_id VARCHAR(64) NOT NULL REFERENCES operator_departments (id),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    mfa_enabled BOOLEAN NOT NULL DEFAULT true,
    on_call BOOLEAN NOT NULL DEFAULT false,
    shift_name VARCHAR(100) NOT NULL DEFAULT 'Americas Primary (08:00 - 17:00)',
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_platform_operators_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'INVITED'))
);

CREATE INDEX IF NOT EXISTS idx_platform_operators_dept ON platform_operators (department_id);
CREATE INDEX IF NOT EXISTS idx_platform_operators_status ON platform_operators (status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_platform_operators_email ON platform_operators (lower(email));

CREATE TABLE IF NOT EXISTS operator_permission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id VARCHAR(64) NOT NULL REFERENCES platform_operators (id) ON DELETE CASCADE,
    module_key VARCHAR(80) NOT NULL,
    permission_action VARCHAR(40) NOT NULL,
    override_type VARCHAR(20) NOT NULL,
    granted_by VARCHAR(200) NOT NULL DEFAULT 'Super Admin',
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_op_override_type CHECK (override_type IN ('GRANT', 'DENY')),
    CONSTRAINT uq_op_override UNIQUE (operator_id, module_key, permission_action)
);

CREATE INDEX IF NOT EXISTS idx_op_overrides_op ON operator_permission_overrides (operator_id);

CREATE TABLE IF NOT EXISTS operator_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id VARCHAR(64) NOT NULL REFERENCES platform_operators (id) ON DELETE CASCADE,
    token_hash VARCHAR(128) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    revoked BOOLEAN NOT NULL DEFAULT false,
    revoked_at TIMESTAMPTZ,
    revoked_by VARCHAR(200),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_sessions_op ON operator_sessions (operator_id, revoked);

CREATE TABLE IF NOT EXISTS operator_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(200) NOT NULL,
    action VARCHAR(120) NOT NULL,
    module_key VARCHAR(80),
    details TEXT,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_audit_operator ON operator_audit_logs (operator_id, occurred_at DESC);

-- Seed 7 Standard Departments
INSERT INTO operator_departments (id, name, description) VALUES
    ('platform-operations', 'Platform Operations', 'Oversees overall availability, organization status, system health, and scheduled maintenance.'),
    ('site-reliability', 'Site Reliability', 'SRE team monitoring infrastructure telemetry, webhook ingestion, GitHub pipelines, and backup jobs.'),
    ('lifecycle-messaging', 'Lifecycle Messaging', 'Manages outbound email relays, SMTP cluster health, template staging, and broadcast announcements.'),
    ('customer-communications', 'Customer Communications', 'Customer success and support team managing escalated tickets and temporary tenant access.'),
    ('finance-tax', 'Finance & Tax', 'Monitors payment processing, billing retries, invoice delivery receipts, and tax calculations.'),
    ('revenue-operations', 'Revenue Operations', 'Monitors recurring revenue subscriptions, payment failure recovery ARR, and billing incidents.'),
    ('trust-compliance', 'Trust & Compliance', 'Monitors platform audit records, security compliance reviews, and privileged tenant access audits.')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

-- Seed Default Department Permissions

-- 1. Platform Operations
INSERT INTO operator_department_permissions (department_id, module_key, permission_action) VALUES
    ('platform-operations', 'operations.dashboard', 'view'),
    ('platform-operations', 'operations.dashboard', 'execute'),
    ('platform-operations', 'operations.org_status', 'view'),
    ('platform-operations', 'operations.org_status', 'edit'),
    ('platform-operations', 'operations.monitoring', 'view'),
    ('platform-operations', 'operations.monitoring', 'execute'),
    ('platform-operations', 'incidents.management', 'view'),
    ('platform-operations', 'incidents.management', 'create'),
    ('platform-operations', 'incidents.management', 'edit'),
    ('platform-operations', 'incidents.management', 'execute'),
    ('platform-operations', 'system.alerts', 'view'),
    ('platform-operations', 'system.alerts', 'edit'),
    ('platform-operations', 'system.alerts', 'execute'),
    ('platform-operations', 'system.maintenance', 'view'),
    ('platform-operations', 'system.maintenance', 'create'),
    ('platform-operations', 'system.maintenance', 'edit'),
    ('platform-operations', 'system.maintenance', 'execute'),
    ('platform-operations', 'audit.activity_logs', 'view')
ON CONFLICT DO NOTHING;

-- 2. Site Reliability
INSERT INTO operator_department_permissions (department_id, module_key, permission_action) VALUES
    ('site-reliability', 'operations.monitoring', 'view'),
    ('site-reliability', 'operations.monitoring', 'execute'),
    ('site-reliability', 'integrations.health', 'view'),
    ('site-reliability', 'integrations.health', 'execute'),
    ('site-reliability', 'integrations.github', 'view'),
    ('site-reliability', 'integrations.github', 'execute'),
    ('site-reliability', 'integrations.webhooks', 'view'),
    ('site-reliability', 'integrations.webhooks', 'execute'),
    ('site-reliability', 'integrations.failed_events', 'view'),
    ('site-reliability', 'integrations.failed_events', 'execute'),
    ('site-reliability', 'integrations.sync_jobs', 'view'),
    ('site-reliability', 'integrations.sync_jobs', 'execute'),
    ('site-reliability', 'integrations.api_errors', 'view'),
    ('site-reliability', 'integrations.api_errors', 'execute'),
    ('site-reliability', 'system.backups', 'view'),
    ('site-reliability', 'system.backups', 'execute'),
    ('site-reliability', 'incidents.management', 'view'),
    ('site-reliability', 'incidents.management', 'create'),
    ('site-reliability', 'incidents.management', 'edit'),
    ('site-reliability', 'incidents.management', 'execute'),
    ('site-reliability', 'system.alerts', 'view'),
    ('site-reliability', 'system.alerts', 'edit'),
    ('site-reliability', 'system.alerts', 'execute')
ON CONFLICT DO NOTHING;

-- 3. Lifecycle Messaging
INSERT INTO operator_department_permissions (department_id, module_key, permission_action) VALUES
    ('lifecycle-messaging', 'communications.email_delivery', 'view'),
    ('lifecycle-messaging', 'communications.email_delivery', 'execute'),
    ('lifecycle-messaging', 'communications.email_drafts', 'view'),
    ('lifecycle-messaging', 'communications.email_drafts', 'create'),
    ('lifecycle-messaging', 'communications.email_drafts', 'edit'),
    ('lifecycle-messaging', 'communications.email_drafts', 'delete'),
    ('lifecycle-messaging', 'communications.email_drafts', 'execute'),
    ('lifecycle-messaging', 'communications.announcements', 'view'),
    ('lifecycle-messaging', 'communications.announcements', 'create'),
    ('lifecycle-messaging', 'communications.announcements', 'edit'),
    ('lifecycle-messaging', 'system.alerts', 'view')
ON CONFLICT DO NOTHING;

-- 4. Customer Communications
INSERT INTO operator_department_permissions (department_id, module_key, permission_action) VALUES
    ('customer-communications', 'support.tickets', 'view'),
    ('customer-communications', 'support.tickets', 'create'),
    ('customer-communications', 'support.tickets', 'edit'),
    ('customer-communications', 'support.tickets', 'execute'),
    ('customer-communications', 'support.access_requests', 'view'),
    ('customer-communications', 'support.access_requests', 'create'),
    ('customer-communications', 'communications.announcements', 'view'),
    ('customer-communications', 'communications.announcements', 'create'),
    ('customer-communications', 'communications.announcements', 'edit'),
    ('customer-communications', 'communications.email_delivery', 'view'),
    ('customer-communications', 'audit.activity_logs', 'view')
ON CONFLICT DO NOTHING;

-- 5. Finance & Tax
INSERT INTO operator_department_permissions (department_id, module_key, permission_action) VALUES
    ('finance-tax', 'billing.subscriptions', 'view'),
    ('finance-tax', 'billing.payment_failures', 'view'),
    ('finance-tax', 'billing.payment_failures', 'execute'),
    ('finance-tax', 'billing.invoices', 'view'),
    ('finance-tax', 'billing.invoices', 'execute'),
    ('finance-tax', 'incidents.management', 'view'),
    ('finance-tax', 'operations.dashboard', 'view')
ON CONFLICT DO NOTHING;

-- 6. Revenue Operations
INSERT INTO operator_department_permissions (department_id, module_key, permission_action) VALUES
    ('revenue-operations', 'billing.subscriptions', 'view'),
    ('revenue-operations', 'billing.subscriptions', 'edit'),
    ('revenue-operations', 'billing.payment_failures', 'view'),
    ('revenue-operations', 'billing.payment_failures', 'execute'),
    ('revenue-operations', 'billing.invoices', 'view'),
    ('revenue-operations', 'billing.invoices', 'execute'),
    ('revenue-operations', 'operations.dashboard', 'view'),
    ('revenue-operations', 'incidents.management', 'view')
ON CONFLICT DO NOTHING;

-- 7. Trust & Compliance
INSERT INTO operator_department_permissions (department_id, module_key, permission_action) VALUES
    ('trust-compliance', 'audit.activity_logs', 'view'),
    ('trust-compliance', 'support.access_requests', 'view'),
    ('trust-compliance', 'support.access_requests', 'edit'),
    ('trust-compliance', 'support.access_requests', 'execute'),
    ('trust-compliance', 'operations.monitoring', 'view'),
    ('trust-compliance', 'system.alerts', 'view'),
    ('trust-compliance', 'incidents.management', 'view')
ON CONFLICT DO NOTHING;

-- Seed Default Seed Operators
INSERT INTO platform_operators (id, name, email, role_id, department_id, status, mfa_enabled, on_call, shift_name) VALUES
    ('op-1', 'Arthur Pendelton', 'superadmin@prowise.io', 'role-super-admin', 'platform-operations', 'ACTIVE', true, false, 'Global Escalation Head (24/7)'),
    ('op-2', 'Jordan Mercer', 'operator@prowise.io', 'role-platform-operator', 'site-reliability', 'ACTIVE', true, true, 'Americas Primary (08:00 - 17:00)'),
    ('op-3', 'Priya Nair', 'priya.nair@prowise.io', 'role-platform-operator', 'revenue-operations', 'ACTIVE', true, false, 'APAC Lead (09:00 - 18:00)'),
    ('op-4', 'Liam Chen', 'liam.chen@prowise.io', 'role-platform-operator', 'customer-communications', 'ACTIVE', true, false, 'Americas Support (07:00 - 16:00)'),
    ('op-5', 'Sophia Rossi', 'sophia.rossi@prowise.io', 'role-platform-operator', 'trust-compliance', 'ACTIVE', true, false, 'EMEA Governance (08:00 - 17:00)'),
    ('op-6', 'Morgan Patel', 'morgan.patel@prowise.io', 'role-platform-operator', 'site-reliability', 'ACTIVE', true, true, 'Americas Secondary (16:00 - 01:00)'),
    ('op-7', 'Hannah Brooks', 'hannah.brooks@prowise.io', 'role-platform-operator', 'finance-tax', 'INACTIVE', false, false, 'Americas Finance (09:00 - 17:00)'),
    ('op-8', 'Devon Alvarez', 'devon.alvarez@prowise.io', 'role-platform-operator', 'lifecycle-messaging', 'INVITED', false, false, 'Europe Messaging (09:00 - 18:00)')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    department_id = EXCLUDED.department_id,
    status = EXCLUDED.status,
    mfa_enabled = EXCLUDED.mfa_enabled,
    on_call = EXCLUDED.on_call,
    shift_name = EXCLUDED.shift_name;
