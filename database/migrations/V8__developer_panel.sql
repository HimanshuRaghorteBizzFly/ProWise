-- ==============================================================================
-- ProWise Database Migration: V8__developer_panel.sql
-- Complete Developer Panel Schema: Projects, Work Items, Check-ins, Sprints,
-- Bugs, Code Reviews, GitHub Activity, Calendar, Discussions, Files, Notifications
-- ==============================================================================

-- 1. Projects
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID REFERENCES organizations (id) ON DELETE CASCADE,
    key VARCHAR(20) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    mode VARCHAR(30) NOT NULL DEFAULT 'STRUCTURED',
    lifecycle VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    project_manager_id VARCHAR(64),
    accountable_owner_id VARCHAR(64),
    team_ids TEXT,
    member_ids TEXT,
    start_date TIMESTAMPTZ,
    target_date TIMESTAMPTZ,
    timezone VARCHAR(60) DEFAULT 'America/New_York',
    last_progress_percent NUMERIC(5,2) DEFAULT 0,
    health VARCHAR(20) DEFAULT 'ON_TRACK',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_project_mode CHECK (mode IN ('INDIVIDUAL', 'STRUCTURED')),
    CONSTRAINT ck_project_lifecycle CHECK (lifecycle IN ('PLANNED', 'ACTIVE', 'ON_HOLD', 'DELIVERED', 'CLOSED', 'CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_projects_org ON projects (org_id);
CREATE INDEX IF NOT EXISTS idx_projects_mode ON projects (mode);
CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects (accountable_owner_id);

-- 2. Sprints
CREATE TABLE IF NOT EXISTS sprints (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    goal TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_sprint_status CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED'))
);

CREATE INDEX IF NOT EXISTS idx_sprints_proj ON sprints (project_id);

-- 3. Work Items (Tasks)
CREATE TABLE IF NOT EXISTS work_items (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations (id) ON DELETE CASCADE,
    parent_id VARCHAR(64),
    type VARCHAR(30) NOT NULL DEFAULT 'TASK',
    key VARCHAR(30) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    primary_assignee_id VARCHAR(64),
    reviewer_id VARCHAR(64),
    state VARCHAR(30) NOT NULL DEFAULT 'TODO',
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    weight NUMERIC(8,2) NOT NULL DEFAULT 1.0,
    weight_unit VARCHAR(30) DEFAULT 'pts',
    criteria TEXT,
    current_revision INT NOT NULL DEFAULT 1,
    submitted_revision INT,
    due_date TIMESTAMPTZ,
    start_date TIMESTAMPTZ,
    estimated_hours NUMERIC(6,2),
    actual_hours NUMERIC(6,2),
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    sprint_id VARCHAR(64) REFERENCES sprints (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_work_item_state CHECK (state IN ('TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE'))
);

CREATE INDEX IF NOT EXISTS idx_work_items_proj ON work_items (project_id);
CREATE INDEX IF NOT EXISTS idx_work_items_assignee ON work_items (primary_assignee_id);
CREATE INDEX IF NOT EXISTS idx_work_items_state ON work_items (state);

-- 4. Task Comments
CREATE TABLE IF NOT EXISTS task_comments (
    id VARCHAR(64) PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    author_id VARCHAR(64) NOT NULL,
    author_name VARCHAR(150),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments (task_id);

-- 5. Task Blockers
CREATE TABLE IF NOT EXISTS task_blockers (
    id VARCHAR(64) PRIMARY KEY,
    task_id VARCHAR(64) NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'HIGH',
    owner_id VARCHAR(64),
    resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_task_blockers_task ON task_blockers (task_id);

-- 6. Project Progress Check-ins (Individual Mode)
CREATE TABLE IF NOT EXISTS project_progress_checkins (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    author_id VARCHAR(64) NOT NULL,
    author_name VARCHAR(150),
    percent NUMERIC(5,2) NOT NULL,
    accomplished TEXT NOT NULL,
    next_steps TEXT NOT NULL,
    blockers TEXT,
    projected_finish TIMESTAMPTZ,
    evidence_summary TEXT,
    downward_reason TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ACCEPTED',
    verified_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_checkin_percent CHECK (percent >= 0 AND percent <= 100),
    CONSTRAINT ck_checkin_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_checkins_proj ON project_progress_checkins (project_id, created_at DESC);

-- 7. Bugs & Issues
CREATE TABLE IF NOT EXISTS bugs (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    org_id UUID REFERENCES organizations (id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'HIGH',
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    assigned_developer_id VARCHAR(64),
    reported_by VARCHAR(64),
    reproduction_steps TEXT,
    expected_result TEXT,
    actual_result TEXT,
    fix_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT ck_bug_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT ck_bug_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED'))
);

CREATE INDEX IF NOT EXISTS idx_bugs_proj ON bugs (project_id);
CREATE INDEX IF NOT EXISTS idx_bugs_developer ON bugs (assigned_developer_id);

-- 8. Bug Comments
CREATE TABLE IF NOT EXISTS bug_comments (
    id VARCHAR(64) PRIMARY KEY,
    bug_id VARCHAR(64) NOT NULL REFERENCES bugs (id) ON DELETE CASCADE,
    author_id VARCHAR(64) NOT NULL,
    author_name VARCHAR(150),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bug_comments_bug ON bug_comments (bug_id);

-- 9. Code Reviews
CREATE TABLE IF NOT EXISTS code_reviews (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    work_item_id VARCHAR(64),
    title VARCHAR(255) NOT NULL,
    pr_number INT,
    pr_url VARCHAR(500),
    repository_name VARCHAR(150),
    branch VARCHAR(100),
    author_id VARCHAR(64) NOT NULL,
    reviewer_id VARCHAR(64) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    inspected_revision INT DEFAULT 1,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_review_status CHECK (status IN ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'MERGED'))
);

CREATE INDEX IF NOT EXISTS idx_code_reviews_proj ON code_reviews (project_id);
CREATE INDEX IF NOT EXISTS idx_code_reviews_reviewer ON code_reviews (reviewer_id);

-- 10. Code Review Comments
CREATE TABLE IF NOT EXISTS code_review_comments (
    id VARCHAR(64) PRIMARY KEY,
    review_id VARCHAR(64) NOT NULL REFERENCES code_reviews (id) ON DELETE CASCADE,
    author_id VARCHAR(64) NOT NULL,
    author_name VARCHAR(150),
    comment TEXT NOT NULL,
    line_number INT,
    file_path VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_comments_review ON code_review_comments (review_id);

-- 11. GitHub Activity Feed
CREATE TABLE IF NOT EXISTS github_activity (
    id VARCHAR(64) PRIMARY KEY,
    repository_name VARCHAR(150) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    actor VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    detail TEXT,
    sha VARCHAR(64),
    pr_number INT,
    branch VARCHAR(100),
    status VARCHAR(30),
    linked_task_key VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gh_activity_repo ON github_activity (repository_name, created_at DESC);

-- 12. Calendar Events
CREATE TABLE IF NOT EXISTS calendar_events (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    project_id VARCHAR(64),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(40) NOT NULL DEFAULT 'PERSONAL',
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_user ON calendar_events (user_id, start_time);

-- 13. Team Discussions
CREATE TABLE IF NOT EXISTS discussions (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(50) DEFAULT 'GENERAL',
    author_id VARCHAR(64) NOT NULL,
    author_name VARCHAR(150),
    pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discussions_proj ON discussions (project_id);

-- 14. Discussion Messages
CREATE TABLE IF NOT EXISTS discussion_messages (
    id VARCHAR(64) PRIMARY KEY,
    discussion_id VARCHAR(64) NOT NULL REFERENCES discussions (id) ON DELETE CASCADE,
    author_id VARCHAR(64) NOT NULL,
    author_name VARCHAR(150),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discussion_msgs ON discussion_messages (discussion_id);

-- 15. File Metadata
CREATE TABLE IF NOT EXISTS file_metadata (
    id VARCHAR(64) PRIMARY KEY,
    project_id VARCHAR(64) REFERENCES projects (id) ON DELETE CASCADE,
    work_item_id VARCHAR(64),
    uploaded_by VARCHAR(64) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(100) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_files_proj ON file_metadata (project_id);

-- 16. Developer Notifications
CREATE TABLE IF NOT EXISTS developer_notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    category VARCHAR(40) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    target_url VARCHAR(300),
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_notifs_user ON developer_notifications (user_id, read);

-- 17. Developer Preferences
CREATE TABLE IF NOT EXISTS developer_preferences (
    user_id VARCHAR(64) PRIMARY KEY,
    email_notifications BOOLEAN DEFAULT true,
    slack_notifications BOOLEAN DEFAULT false,
    theme VARCHAR(20) DEFAULT 'system',
    github_username VARCHAR(100),
    timezone VARCHAR(60) DEFAULT 'America/New_York',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ==============================================================================
-- Seed Baseline Data for ProWise Developer Panel
-- ==============================================================================

-- 1. Seed Projects
INSERT INTO projects (id, key, name, description, mode, lifecycle, priority, project_manager_id, accountable_owner_id, member_ids, last_progress_percent, health)
VALUES
    ('proj-individual-solo', 'SOLO-10', 'Billing Reconciliation & Tax Pipeline', 'Solo delivery model with developer check-in accountability and auditable progress trail.', 'INDIVIDUAL', 'ACTIVE', 'HIGH', 'usr-pm-1', 'usr-developer', 'usr-developer,usr-lead,usr-pm-1', 65.00, 'ON_TRACK'),
    ('proj-structured-cds', 'CRM-100', 'Enterprise CRM & Pipeline Modernization', 'Multi-phase structured delivery engine with earned-value baseline metrics and review gating.', 'STRUCTURED', 'ACTIVE', 'CRITICAL', 'usr-pm-2', 'usr-developer', 'usr-developer,usr-lead,usr-qa', 42.50, 'ON_TRACK'),
    ('proj-cloud-sync', 'CLOUD-50', 'Cloud Infrastructure & Edge Sync', 'Distributed cloud database replication and zero-downtime failover automation.', 'STRUCTURED', 'ACTIVE', 'MEDIUM', 'usr-pm-1', 'usr-developer', 'usr-developer,usr-lead', 80.00, 'ON_TRACK')
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Sprints
INSERT INTO sprints (id, project_id, name, goal, status, start_date, end_date)
VALUES
    ('sprint-crm-24', 'proj-structured-cds', 'Sprint 24 — Pipeline Migration', 'Finalize stage 2 migration and multi-tenant webhook verification.', 'ACTIVE', now() - interval '5 days', now() + interval '9 days'),
    ('sprint-cloud-12', 'proj-cloud-sync', 'Sprint 12 — Edge Cache Optimization', 'Deploy edge cache caching proxy and evaluate latency reduction.', 'ACTIVE', now() - interval '3 days', now() + interval '11 days')
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Tasks (Work Items)
INSERT INTO work_items (id, project_id, key, title, description, primary_assignee_id, reviewer_id, state, is_blocked, weight, weight_unit, due_date, priority, sprint_id)
VALUES
    ('task-101', 'proj-structured-cds', 'CRM-101', 'Implement OAuth2 Token Revocation Service', 'Build automated token revocation endpoints conforming to RFC 7009 specification.', 'usr-developer', 'usr-lead', 'DONE', false, 5.0, 'pts', now() - interval '2 days', 'HIGH', 'sprint-crm-24'),
    ('task-102', 'proj-structured-cds', 'CRM-102', 'Pipeline Webhook Retries & Dead Letter Queue', 'Create exponential backoff worker queue for failed webhook notifications.', 'usr-developer', 'usr-lead', 'IN_REVIEW', false, 8.0, 'pts', now() + interval '3 days', 'CRITICAL', 'sprint-crm-24'),
    ('task-103', 'proj-structured-cds', 'CRM-103', 'Multi-Tenant Schema Migration Script', 'Flyway migration ensuring tenant isolation and indexing for accounts table.', 'usr-developer', 'usr-lead', 'IN_PROGRESS', false, 5.0, 'pts', now() + interval '5 days', 'HIGH', 'sprint-crm-24'),
    ('task-104', 'proj-structured-cds', 'CRM-104', 'Database Connection Pool Stress Benchmark', 'Validate HikariCP connection pool throughput at 5,000 concurrent RPS.', 'usr-developer', 'usr-lead', 'TODO', false, 3.0, 'pts', now() + interval '7 days', 'MEDIUM', 'sprint-crm-24'),
    ('task-105', 'proj-structured-cds', 'CRM-105', 'Payment Gateway Integration Gateway Timeout Bug', 'Diagnose and mitigate 504 gateway timeout on international currency card charges.', 'usr-developer', 'usr-lead', 'BLOCKED', true, 5.0, 'pts', now() + interval '1 day', 'HIGH', 'sprint-crm-24'),
    ('task-201', 'proj-individual-solo', 'SOLO-101', 'Stripe Tax Reconciliation Engine', 'End-of-month automatic calculation of EU VAT and North American sales tax.', 'usr-developer', 'usr-pm-1', 'IN_PROGRESS', false, 10.0, 'pts', now() + interval '4 days', 'HIGH', NULL)
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Blockers
INSERT INTO task_blockers (id, task_id, reason, severity, owner_id, resolved)
VALUES
    ('blk-1', 'task-105', 'Awaiting sandbox credentials from international payment vendor support team', 'HIGH', 'usr-developer', false)
ON CONFLICT (id) DO NOTHING;

-- 5. Seed Check-ins (Individual Mode)
INSERT INTO project_progress_checkins (id, project_id, author_id, author_name, percent, accomplished, next_steps, blockers, status, created_at)
VALUES
    ('chk-1', 'proj-individual-solo', 'usr-developer', 'Alex Rivera', 65.00, 'Completed core European VAT calculation engine and verified tax rate accuracy.', 'Implement Canadian provincial sales tax (PST/GST) rules and unit tests.', 'None currently.', 'ACCEPTED', now() - interval '2 days'),
    ('chk-0', 'proj-individual-solo', 'usr-developer', 'Alex Rivera', 50.00, 'Initial schema definition and tax reporting exporter skeleton created.', 'Wire up live exchange rate calculation service.', 'Awaiting exchange rate API keys.', 'ACCEPTED', now() - interval '9 days')
ON CONFLICT (id) DO NOTHING;

-- 6. Seed Code Reviews
INSERT INTO code_reviews (id, project_id, work_item_id, title, pr_number, pr_url, repository_name, branch, author_id, reviewer_id, status, comments_count)
VALUES
    ('rev-1', 'proj-structured-cds', 'task-102', 'feat: exponential backoff webhook retry queue', 142, 'https://github.com/prowise/prowise-api/pull/142', 'prowise-api', 'feature/crm-102-webhook-retries', 'usr-developer', 'usr-lead', 'PENDING', 3),
    ('rev-2', 'proj-structured-cds', 'task-101', 'feat: OAuth2 token revocation RFC-7009 implementation', 139, 'https://github.com/prowise/prowise-api/pull/139', 'prowise-api', 'feature/crm-101-oauth-revocation', 'usr-developer', 'usr-lead', 'APPROVED', 1)
ON CONFLICT (id) DO NOTHING;

-- 7. Seed Bugs
INSERT INTO bugs (id, project_id, title, description, severity, priority, status, assigned_developer_id, reported_by, reproduction_steps, expected_result, actual_result)
VALUES
    ('bug-1', 'proj-structured-cds', 'Webhook signature header missing in v1 payload retries', 'When retrying failed webhook deliveries, the X-ProWise-Signature header is stripped by the proxy.', 'HIGH', 'HIGH', 'IN_PROGRESS', 'usr-developer', 'usr-qa', '1. Trigger test webhook\n2. Block destination port to force retry\n3. Inspect retry headers', 'X-ProWise-Signature must be preserved across retry attempts', 'Header is missing on retry attempt 2 and 3'),
    ('bug-2', 'proj-structured-cds', 'Datepicker timezone offset in deadline display', 'Task deadline displays one day earlier in Tokyo (UTC+9) timezones.', 'MEDIUM', 'MEDIUM', 'OPEN', 'usr-developer', 'usr-qa', '1. Change profile timezone to Asia/Tokyo\n2. Open task CRM-103\n3. Check deadline', 'Displays Nov 20, 2026', 'Displays Nov 19, 2026')
ON CONFLICT (id) DO NOTHING;

-- 8. Seed GitHub Activity
INSERT INTO github_activity (id, repository_name, event_type, actor, title, detail, sha, pr_number, branch, status, linked_task_key)
VALUES
    ('gh-1', 'prowise-api', 'PULL_REQUEST', 'alex-rivera-dev', 'PR #142: feat(webhooks): add dead letter queue & retry backoff', 'Opened pull request with 8 files changed (+420, -32)', NULL, 142, 'feature/crm-102-webhook-retries', 'OPEN', 'CRM-102'),
    ('gh-2', 'prowise-api', 'PUSH', 'alex-rivera-dev', 'commit: add unit test for exponential jitter backoff algorithm', 'Pushed commit 4a82b91 to feature/crm-102-webhook-retries', '4a82b91d29e71b2f', NULL, 'feature/crm-102-webhook-retries', 'SUCCESS', 'CRM-102'),
    ('gh-3', 'prowise-api', 'PUSH', 'alex-rivera-dev', 'commit: implement OAuth2 revocation endpoint handler', 'Pushed commit 9c18f3a to feature/crm-101-oauth-revocation', '9c18f3ad18e24c7a', NULL, 'feature/crm-101-oauth-revocation', 'SUCCESS', 'CRM-101')
ON CONFLICT (id) DO NOTHING;

-- 9. Seed Calendar Events
INSERT INTO calendar_events (id, user_id, project_id, title, description, event_type, start_time, end_time, all_day)
VALUES
    ('cal-1', 'usr-developer', 'proj-structured-cds', 'Sprint 24 Mid-Cycle Standup & Demo', 'Review webhook delivery retries with Lead and QA.', 'SPRINT', now() + interval '1 day', now() + interval '1 day 30 minutes', false),
    ('cal-2', 'usr-developer', 'proj-structured-cds', 'CRM-102 Webhook Code Review Gating', 'Peer review session with Team Lead.', 'REVIEW', now() + interval '2 days', now() + interval '2 days 1 hour', false),
    ('cal-3', 'usr-developer', 'proj-individual-solo', 'Individual Progress Check-in Due', 'Submit weekly progress percentage and milestone achievements.', 'DEADLINE', now() + interval '4 days', now() + interval '4 days', true)
ON CONFLICT (id) DO NOTHING;

-- 10. Seed Discussions
INSERT INTO discussions (id, project_id, title, category, author_id, author_name, pinned)
VALUES
    ('disc-1', 'proj-structured-cds', 'Architecture Decision: Redis Streams vs PostgreSQL LISTEN/NOTIFY for webhooks', 'ARCHITECTURE', 'usr-lead', 'Jordan Mercer', true),
    ('disc-2', 'proj-structured-cds', 'Sprint 24 Retro & Velocity Alignment', 'RETROSPECTIVE', 'usr-developer', 'Alex Rivera', false)
ON CONFLICT (id) DO NOTHING;

-- 11. Seed Discussion Messages
INSERT INTO discussion_messages (id, discussion_id, author_id, author_name, content)
VALUES
    ('msg-1', 'disc-1', 'usr-lead', 'Jordan Mercer', 'Team, please review the proposal to utilize PostgreSQL LISTEN/NOTIFY with table-based queue for guaranteed durability before introducing Redis.'),
    ('msg-2', 'disc-1', 'usr-developer', 'Alex Rivera', 'Agreed. With row-level locking (SKIP LOCKED), PostgreSQL handles our current 2,000 webhook/sec throughput without introducing another caching cluster to manage.')
ON CONFLICT (id) DO NOTHING;

-- 12. Seed File Metadata
INSERT INTO file_metadata (id, project_id, work_item_id, uploaded_by, file_name, file_size, file_type, storage_path)
VALUES
    ('file-1', 'proj-structured-cds', 'task-102', 'usr-developer', 'webhook-retry-state-diagram.png', 245800, 'image/png', '/files/proj-structured-cds/webhook-retry-state-diagram.png'),
    ('file-2', 'proj-structured-cds', 'task-101', 'usr-developer', 'oauth2-revocation-spec-v1.pdf', 1048576, 'application/pdf', '/files/proj-structured-cds/oauth2-revocation-spec-v1.pdf')
ON CONFLICT (id) DO NOTHING;

-- 13. Seed Developer Notifications
INSERT INTO developer_notifications (id, user_id, category, title, message, target_url, read)
VALUES
    ('notif-1', 'usr-developer', 'REVIEW_REQUEST', 'Code Review Assigned: PR #142', 'Jordan Mercer requested your changes verification on PR #142.', '/org/org-acme/developer/reviews', false),
    ('notif-2', 'usr-developer', 'ASSIGNMENT', 'New Task Assigned: CRM-105', 'Assigned to investigate Payment Gateway 504 Timeout bug.', '/org/org-acme/developer/tasks', false),
    ('notif-3', 'usr-developer', 'CHECK_IN_DUE', 'Weekly Check-in Due', 'Project SOLO-10 check-in is due within the next 4 days.', '/org/org-acme/developer/progress', false),
    ('notif-4', 'usr-developer', 'BLOCKER', 'Blocker Logged on CRM-105', 'Sandbox credentials dependency reported.', '/org/org-acme/developer/my-work', true)
ON CONFLICT (id) DO NOTHING;

-- 14. Seed Developer Preferences
INSERT INTO developer_preferences (user_id, email_notifications, slack_notifications, theme, github_username, timezone)
VALUES
    ('usr-developer', true, false, 'system', 'alex-rivera-dev', 'America/New_York')
ON CONFLICT (user_id) DO NOTHING;
