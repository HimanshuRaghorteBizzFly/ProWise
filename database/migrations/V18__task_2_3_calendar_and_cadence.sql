-- Flyway Migration V18: Task 2.3 Working Calendar, Cadence, Deadlines & Occurrences

-- 1. Organization Calendar
CREATE TABLE IF NOT EXISTS org_calendar (
    org_id UUID PRIMARY KEY REFERENCES organizations (id) ON DELETE CASCADE,
    workdays VARCHAR(64) NOT NULL DEFAULT 'MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY',
    holidays JSONB NOT NULL DEFAULT '[]'::jsonb,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    default_cadence VARCHAR(20) NOT NULL DEFAULT 'WEEKLY',
    default_cutoff_time VARCHAR(8) NOT NULL DEFAULT '17:00',
    default_grace_working_days INT NOT NULL DEFAULT 1,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed default org_calendar for existing organizations
INSERT INTO org_calendar (org_id, timezone, default_cadence, default_cutoff_time, default_grace_working_days)
SELECT id, COALESCE(timezone, 'America/New_York'), 'WEEKLY', '17:00', 1
FROM organizations
ON CONFLICT (org_id) DO NOTHING;

-- 2. Project Cadence & Scheduling Configuration
CREATE TABLE IF NOT EXISTS project_cadence (
    project_id VARCHAR(64) PRIMARY KEY REFERENCES projects (id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL DEFAULT 'WEEKLY', -- DAILY, WEEKLY, FORTNIGHTLY
    day_of_week VARCHAR(16) NOT NULL DEFAULT 'FRIDAY', -- Cutoff day for WEEKLY / FORTNIGHTLY
    local_cutoff_time VARCHAR(8) NOT NULL DEFAULT '17:00',
    grace_working_days INT NOT NULL DEFAULT 1,
    reminder_offsets JSONB NOT NULL DEFAULT '[3, 1]'::jsonb, -- Days before due date to alert
    policy_version BIGINT NOT NULL DEFAULT 0,
    is_paused BOOLEAN NOT NULL DEFAULT false, -- Set true when project is ON_HOLD
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_cadence_org ON project_cadence (org_id);

-- Seed default project_cadence for existing projects
INSERT INTO project_cadence (project_id, org_id, frequency, day_of_week, local_cutoff_time, grace_working_days)
SELECT id, org_id, 'WEEKLY', 'FRIDAY', '17:00', 1
FROM projects
WHERE org_id IS NOT NULL
ON CONFLICT (project_id) DO NOTHING;

-- 3. Due Occurrences (Check-in Cadence & Target Deadlines)
CREATE TABLE IF NOT EXISTS due_occurrences (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL, -- 'CHECKIN' or 'TARGET'
    due_local_date DATE NOT NULL,
    grace_until_date DATE NOT NULL,
    zone VARCHAR(64) NOT NULL,
    cutoff_instant TIMESTAMPTZ NOT NULL,
    grace_cutoff_instant TIMESTAMPTZ NOT NULL,
    policy_version BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'MET', 'MISSED', 'EXCUSED', 'SUPERSEDED', 'PAUSED'
    checkin_id VARCHAR(64) REFERENCES project_progress_checkins (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_occurrences_window UNIQUE (project_id, kind, due_local_date, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_occurrences_project_status ON due_occurrences (project_id, status);
CREATE INDEX IF NOT EXISTS idx_occurrences_org_cutoff ON due_occurrences (org_id, cutoff_instant, status);
CREATE INDEX IF NOT EXISTS idx_occurrences_grace ON due_occurrences (org_id, grace_cutoff_instant, status);

-- 4. Cadence & Deadline Change History
CREATE TABLE IF NOT EXISTS project_cadence_history (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    previous_frequency VARCHAR(20),
    new_frequency VARCHAR(20) NOT NULL,
    previous_grace INT,
    new_grace INT NOT NULL,
    previous_cutoff VARCHAR(8),
    new_cutoff VARCHAR(8) NOT NULL,
    reason TEXT NOT NULL,
    changed_by VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cadence_history_project ON project_cadence_history (project_id, created_at DESC);

-- 5. Reminder Candidates (For future notification workers, Task 5.2)
CREATE TABLE IF NOT EXISTS reminder_candidates (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    occurrence_id VARCHAR(64) REFERENCES due_occurrences (id) ON DELETE CASCADE,
    recipient_id VARCHAR(64) NOT NULL,
    channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL',
    condition VARCHAR(32) NOT NULL, -- 'UPCOMING_DUE', 'GRACE_WARNING', 'MISSED_CHECKIN', 'OVERDUE_TARGET'
    scheduled_for TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'DISPATCHED', 'CANCELLED', 'INVALIDATED'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminder_candidates_dispatch ON reminder_candidates (org_id, status, scheduled_for);
