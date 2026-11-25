-- V37: real data stores behind the Platform Operator console pages that had no backend.
-- No demo or seed business rows: only structure, plus two department permission defaults (reference config).

-- 1. Announcement drafts written by operators reuse the announcements table (V6). An operator draft is
--    DRAFT -> PENDING_REVIEW (submitted) -> PUBLISHED by a Super Admin, or CHANGES_REQUESTED back to the author.
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS author_type VARCHAR(20);      -- OPERATOR | SUPER_ADMIN; NULL = created in the Super Admin console
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS author_id VARCHAR(100);       -- platform_operators.id or users.id
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(320);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS reviewer_note TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(320);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_announcements_author ON announcements (author_type, updated_at DESC);

-- 2. Operator email drafts for Super Admin review. Nothing is sent from this table.
CREATE TABLE operator_email_drafts (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    category VARCHAR(60),
    subject VARCHAR(255) NOT NULL,
    headline VARCHAR(255),
    body_text TEXT NOT NULL,
    body_html TEXT,
    cta_label VARCHAR(120),
    audience_description VARCHAR(500),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    author_type VARCHAR(20) NOT NULL,
    created_by VARCHAR(100) NOT NULL,
    created_by_email VARCHAR(320),
    submitted_at TIMESTAMPTZ,
    reviewed_by VARCHAR(320),
    reviewed_at TIMESTAMPTZ,
    reviewer_note TEXT,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_operator_email_drafts_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'))
);
CREATE INDEX idx_operator_email_drafts_status ON operator_email_drafts (status, updated_at DESC);

-- 3. Invoice delivery: an email delivery log can name the invoice it carried (nothing writes it while billing is dormant).
ALTER TABLE email_delivery_logs ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(64);
CREATE INDEX IF NOT EXISTS idx_email_delivery_logs_invoice ON email_delivery_logs (invoice_id, created_at DESC) WHERE invoice_id IS NOT NULL;

-- 4. API error log: one row per 5xx and per 4xx except 401/404. Never bodies, headers, tokens or query strings.
--    org_id is NULL for platform-level callers (operators, Super Admin, anonymous). Retention: 90 days (purge not automated yet).
CREATE TABLE api_error_logs (
    id UUID PRIMARY KEY,
    org_id UUID,
    request_id VARCHAR(100),
    method VARCHAR(10) NOT NULL,
    path_template VARCHAR(300) NOT NULL,
    status INTEGER NOT NULL,
    error_code VARCHAR(80),
    actor_type VARCHAR(20) NOT NULL,
    actor_id VARCHAR(100),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_error_logs_occurred ON api_error_logs (occurred_at DESC);
CREATE INDEX idx_api_error_logs_status ON api_error_logs (status, occurred_at DESC);
CREATE INDEX idx_api_error_logs_org ON api_error_logs (org_id, occurred_at DESC);

-- 5. Database backup runs (pg_dump). At most one RUNNING row at a time (enforced by the partial unique index).
CREATE TABLE backup_runs (
    id UUID PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    size_bytes BIGINT,
    file_name VARCHAR(200),
    triggered_by VARCHAR(320) NOT NULL,
    error_message VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_backup_runs_status CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED', 'NOT_CONFIGURED'))
);
CREATE INDEX idx_backup_runs_started ON backup_runs (started_at DESC);
CREATE UNIQUE INDEX uq_backup_runs_one_running ON backup_runs ((true)) WHERE status = 'RUNNING';

-- 6. Activity log reads are ordered by time across operators.
CREATE INDEX IF NOT EXISTS idx_op_activity_created ON operator_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_op_audit_occurred ON operator_audit_logs (occurred_at DESC);

-- 7. Departments that author announcement drafts may also discard them (communications.announcements:delete).
INSERT INTO operator_department_permissions (department_id, module_key, permission_action) VALUES
    ('lifecycle-messaging', 'communications.announcements', 'delete'),
    ('customer-communications', 'communications.announcements', 'delete')
ON CONFLICT DO NOTHING;
