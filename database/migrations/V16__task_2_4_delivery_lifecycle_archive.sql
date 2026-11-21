-- Flyway Migration V16: Task 2.4 Deliver, Close, Archive & Restore

-- 1. Acceptance Requests
CREATE TABLE IF NOT EXISTS acceptance_requests (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    bound_checkin_id VARCHAR(64) REFERENCES project_progress_checkins (id) ON DELETE SET NULL,
    checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
    evidence_summary TEXT,
    evidence_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED'
    version BIGINT NOT NULL DEFAULT 0,
    created_by VARCHAR(64) NOT NULL,
    created_by_name VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acceptance_requests_project ON acceptance_requests (project_id, status);
CREATE INDEX IF NOT EXISTS idx_acceptance_requests_org ON acceptance_requests (org_id, status);

-- 2. Acceptance Decisions
CREATE TABLE IF NOT EXISTS acceptance_decisions (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    request_id VARCHAR(64) NOT NULL REFERENCES acceptance_requests (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    decision VARCHAR(32) NOT NULL, -- 'ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED'
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(150),
    reason TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_acceptance_decisions_req ON acceptance_decisions (request_id);
CREATE INDEX IF NOT EXISTS idx_acceptance_decisions_proj ON acceptance_decisions (project_id);

-- 3. Project Blockers (Project-level & Task-level tracking)
CREATE TABLE IF NOT EXISTS project_blockers (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(20) NOT NULL DEFAULT 'NORMAL', -- 'NORMAL', 'CRITICAL'
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',     -- 'OPEN', 'RESOLVED', 'WAIVED'
    created_by VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_blockers_proj ON project_blockers (project_id, status, severity);

-- 4. Blocker Waivers
CREATE TABLE IF NOT EXISTS project_blocker_waivers (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    blocker_ref VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(150),
    reason TEXT NOT NULL,
    waived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_waivers_proj ON project_blocker_waivers (project_id, blocker_ref);

-- 5. Project Closures
CREATE TABLE IF NOT EXISTS project_closures (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(150),
    handover_note TEXT NOT NULL,
    reason TEXT NOT NULL,
    closed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_closures_proj ON project_closures (project_id);

-- 6. Project Lifecycle History
CREATE TABLE IF NOT EXISTS project_lifecycle_history (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    previous_lifecycle VARCHAR(32),
    new_lifecycle VARCHAR(32) NOT NULL,
    reason TEXT,
    actor_id VARCHAR(64) NOT NULL,
    actor_name VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lifecycle_history_proj ON project_lifecycle_history (project_id, created_at DESC);
