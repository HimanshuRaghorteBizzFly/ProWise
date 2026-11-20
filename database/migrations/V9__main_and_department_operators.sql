-- Migration V9: Main Platform Operator & Department Operator Hierarchy, Operational Modules & Coordination Schema

-- 1. Extend platform_operators table with access_level and allow nullable department for Main Platform Operator
ALTER TABLE platform_operators ADD COLUMN IF NOT EXISTS access_level VARCHAR(40) NOT NULL DEFAULT 'DEPARTMENT_OPERATOR';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ck_platform_operators_access_level'
    ) THEN
        ALTER TABLE platform_operators
        ADD CONSTRAINT ck_platform_operators_access_level
        CHECK (access_level IN ('MAIN_PLATFORM_OPERATOR', 'DEPARTMENT_OPERATOR'));
    END IF;
END $$;

-- Allow department_id to be nullable for Main Platform Operator (who oversees all departments)
ALTER TABLE platform_operators ALTER COLUMN department_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_operators_access_level ON platform_operators (access_level);

-- 2. Seed Default Main Platform Operator
INSERT INTO platform_operators (
    id, name, email, role_id, access_level, department_id, status, mfa_enabled, on_call, shift_name,
    password_hash, password_setup_completed, created_at, updated_at
)
VALUES (
    'op-main-1',
    'Platform Director',
    'main.operator@prowise.io',
    'role-platform-operator',
    'MAIN_PLATFORM_OPERATOR',
    NULL,
    'ACTIVE',
    true,
    true,
    'Executive Operations Lead',
    '$2a$10$4b0rjVL9OrfiXT2yXc11c.x5Q.wK12FsTd/UzkoOtp2GKu7ujVdQK', -- 'Operator2026!'
    true,
    now(),
    now()
)
ON CONFLICT (id) DO UPDATE SET
    access_level = 'MAIN_PLATFORM_OPERATOR',
    department_id = NULL,
    status = 'ACTIVE';

-- 3. Incidents table
CREATE TABLE IF NOT EXISTS incidents (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'SEV_3',
    status VARCHAR(30) NOT NULL DEFAULT 'INVESTIGATING',
    department_id VARCHAR(64) REFERENCES operator_departments (id) ON DELETE SET NULL,
    assigned_operator_id VARCHAR(64) REFERENCES platform_operators (id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    root_cause TEXT,
    mitigation_steps TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_incident_severity CHECK (severity IN ('SEV_1', 'SEV_2', 'SEV_3', 'SEV_4')),
    CONSTRAINT ck_incident_status CHECK (status IN ('INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'))
);

CREATE INDEX IF NOT EXISTS idx_incidents_dept ON incidents (department_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_assignee ON incidents (assigned_operator_id);

-- 4. Incident Assignments table (coordination log)
CREATE TABLE IF NOT EXISTS incident_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id VARCHAR(64) NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
    assigned_by VARCHAR(64) NOT NULL,
    assigned_to VARCHAR(64) NOT NULL REFERENCES platform_operators (id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_assignments_inc ON incident_assignments (incident_id);

-- 5. Support Tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(64) PRIMARY KEY,
    subject VARCHAR(255) NOT NULL,
    customer_name VARCHAR(150) NOT NULL,
    customer_email VARCHAR(320) NOT NULL,
    department_id VARCHAR(64) REFERENCES operator_departments (id) ON DELETE SET NULL,
    assigned_operator_id VARCHAR(64) REFERENCES platform_operators (id) ON DELETE SET NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_support_ticket_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    CONSTRAINT ck_support_ticket_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'))
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_dept ON support_tickets (department_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assignee ON support_tickets (assigned_operator_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets (status);

-- 6. Support Access Requests table
CREATE TABLE IF NOT EXISTS support_access_requests (
    id VARCHAR(64) PRIMARY KEY,
    ticket_id VARCHAR(64) REFERENCES support_tickets (id) ON DELETE SET NULL,
    requester_email VARCHAR(320) NOT NULL,
    org_id UUID REFERENCES organizations (id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL',
    approved_by VARCHAR(64),
    approved_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_support_access_status CHECK (status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED'))
);

CREATE INDEX IF NOT EXISTS idx_support_access_org ON support_access_requests (org_id);

-- 7. Integration Installations & GitHub Repository Links
CREATE TABLE IF NOT EXISTS integration_installations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'CONNECTED',
    health VARCHAR(30) NOT NULL DEFAULT 'HEALTHY',
    last_synced_at TIMESTAMPTZ,
    error_count INT NOT NULL DEFAULT 0,
    config_json TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS github_repository_links (
    id VARCHAR(64) PRIMARY KEY,
    repo_full_name VARCHAR(150) NOT NULL,
    installation_id VARCHAR(64) REFERENCES integration_installations (id) ON DELETE CASCADE,
    default_branch VARCHAR(60) NOT NULL DEFAULT 'main',
    webhook_active BOOLEAN NOT NULL DEFAULT true,
    last_event_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Webhook Receipts & Retries
CREATE TABLE IF NOT EXISTS webhook_receipts (
    id VARCHAR(64) PRIMARY KEY,
    webhook_id VARCHAR(100) NOT NULL,
    source VARCHAR(80) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PROCESSED',
    attempts INT NOT NULL DEFAULT 1,
    error_message TEXT,
    payload TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_retry_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_receipts_source ON webhook_receipts (source, status);

-- 9. Background Jobs & Queues
CREATE TABLE IF NOT EXISTS background_jobs (
    id VARCHAR(64) PRIMARY KEY,
    job_name VARCHAR(150) NOT NULL,
    queue_name VARCHAR(80) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    error_details TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_background_jobs_queue ON background_jobs (queue_name, status);

-- 10. Maintenance Windows
CREATE TABLE IF NOT EXISTS maintenance_windows (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    department_id VARCHAR(64) REFERENCES operator_departments (id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'SCHEDULED',
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    created_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_maintenance_status CHECK (status IN ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'))
);

-- 11. Email Delivery Logs
CREATE TABLE IF NOT EXISTS email_delivery_logs (
    id VARCHAR(64) PRIMARY KEY,
    recipient VARCHAR(320) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    provider VARCHAR(80) NOT NULL DEFAULT 'SendGrid',
    status VARCHAR(30) NOT NULL DEFAULT 'DELIVERED',
    attempts INT NOT NULL DEFAULT 1,
    error_code VARCHAR(50),
    error_message TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_delivery_status ON email_delivery_logs (status);

-- 12. Operational Alerts
CREATE TABLE IF NOT EXISTS operational_alerts (
    id VARCHAR(64) PRIMARY KEY,
    severity VARCHAR(20) NOT NULL DEFAULT 'WARNING',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    source_module VARCHAR(80) NOT NULL,
    department_id VARCHAR(64) REFERENCES operator_departments (id) ON DELETE SET NULL,
    acknowledged BOOLEAN NOT NULL DEFAULT false,
    acknowledged_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_alerts_status ON operational_alerts (acknowledged, severity);

-- 13. Operator Activity Logs
CREATE TABLE IF NOT EXISTS operator_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_id VARCHAR(64) NOT NULL,
    department_id VARCHAR(64),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(60) NOT NULL,
    resource_id VARCHAR(100),
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_activity_operator ON operator_activity_logs (operator_id, created_at DESC);

-- Seed Initial Operational Records for Live Verification
INSERT INTO incidents (id, title, severity, status, department_id, assigned_operator_id, description, created_at)
VALUES
('inc-101', 'Elevated 5xx Gateway Errors on API Ingress', 'SEV_2', 'INVESTIGATING', 'site-reliability', NULL, 'Ingress controller pods experiencing connection pool exhaustion.', now() - interval '35 minutes'),
('inc-102', 'Stripe Webhook Delivery Delays (Event backlog > 200)', 'SEV_3', 'IDENTIFIED', 'revenue-operations', 'op-main-1', 'Stripe events queue worker scaling delay.', now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO support_tickets (id, subject, customer_name, customer_email, department_id, assigned_operator_id, priority, status, created_at)
VALUES
('tkt-501', 'Urgent: Unable to add seats to Enterprise plan', 'Acme Health Corp', 'billing@acmehealth.com', 'finance-tax', NULL, 'URGENT', 'OPEN', now() - interval '1 hour'),
('tkt-502', 'SSO SAML Assertion Failure for domain auth', 'Global Logistics', 'admin@globallogistics.com', 'trust-compliance', NULL, 'HIGH', 'IN_PROGRESS', now() - interval '3 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO integration_installations (id, name, type, status, health, last_synced_at, error_count)
VALUES
('int-gh-1', 'ProWise GitHub App Integration', 'GITHUB', 'CONNECTED', 'HEALTHY', now() - interval '5 minutes', 0),
('int-stripe-1', 'Stripe Payment Gateway', 'STRIPE', 'CONNECTED', 'HEALTHY', now() - interval '2 minutes', 0),
('int-smtp-1', 'SendGrid Transactional Relay', 'SMTP', 'CONNECTED', 'HEALTHY', now() - interval '1 minute', 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO webhook_receipts (id, webhook_id, source, event_type, status, attempts, error_message, payload, received_at)
VALUES
('wh-901', 'wh_evt_stripe_charge_succeeded', 'stripe', 'invoice.payment_succeeded', 'PROCESSED', 1, NULL, '{"amount": 4900, "currency": "usd"}', now() - interval '10 minutes'),
('wh-902', 'wh_evt_github_push', 'github', 'push', 'FAILED', 2, 'Connection timeout to repository sync worker', '{"ref": "refs/heads/main"}', now() - interval '25 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO background_jobs (id, job_name, queue_name, status, attempts, max_attempts, scheduled_at)
VALUES
('job-1', 'Nightly Postgres WAL Archiving', 'maintenance-queue', 'QUEUED', 0, 3, now() + interval '4 hours'),
('job-2', 'Stripe Subscription Sync Job', 'billing-queue', 'QUEUED', 0, 3, now() + interval '1 hour')
ON CONFLICT (id) DO NOTHING;

INSERT INTO operational_alerts (id, severity, title, message, source_module, department_id, acknowledged)
VALUES
('alt-1', 'CRITICAL', 'Worker Node Memory Usage > 88%', 'Pod worker-7 reached 88.4% RSS memory ceiling.', 'operations.monitoring', 'site-reliability', false),
('alt-2', 'WARNING', 'High Email Bounce Rate (2.8%)', 'Hourly bounce threshold exceeded for marketing pool.', 'communications.email_delivery', 'lifecycle-messaging', false)
ON CONFLICT (id) DO NOTHING;
