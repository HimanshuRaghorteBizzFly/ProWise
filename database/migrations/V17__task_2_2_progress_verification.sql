-- ==============================================================================
-- ProWise Database Migration: V17__task_2_2_progress_verification.sql
-- Task 2.2: Developer Progress & Team Lead Verification
-- - projects.require_verification, last_progress_method, last_reported_at
-- - project_progress_checkins: revision_of, revision_seq, method, evidence, review_comment,
--   reviewed_at, idempotency_key, captured_at, version, status check constraint
-- - project_repository_links table & github_activity project_id
-- ==============================================================================

-- 1. Project progress verification settings & tracking
ALTER TABLE projects ADD COLUMN IF NOT EXISTS require_verification BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_progress_method VARCHAR(40) DEFAULT 'DEVELOPER_REPORTED';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_reported_at TIMESTAMPTZ;

-- 2. Enhanced check-ins columns for append-only revisions & verification
ALTER TABLE project_progress_checkins ADD COLUMN IF NOT EXISTS revision_of VARCHAR(64) REFERENCES project_progress_checkins(id) ON DELETE SET NULL;
ALTER TABLE project_progress_checkins ADD COLUMN IF NOT EXISTS revision_seq INT NOT NULL DEFAULT 1;
ALTER TABLE project_progress_checkins ADD COLUMN IF NOT EXISTS method VARCHAR(40) NOT NULL DEFAULT 'DEVELOPER_REPORTED';
ALTER TABLE project_progress_checkins ADD COLUMN IF NOT EXISTS evidence JSONB;
ALTER TABLE project_progress_checkins ADD COLUMN IF NOT EXISTS review_comment TEXT;
ALTER TABLE project_progress_checkins ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE project_progress_checkins ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);
ALTER TABLE project_progress_checkins ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE project_progress_checkins ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

-- 3. Update checkin status check constraint to support PENDING_VERIFICATION & CHANGES_REQUESTED
ALTER TABLE project_progress_checkins DROP CONSTRAINT IF EXISTS ck_checkin_status;
ALTER TABLE project_progress_checkins ADD CONSTRAINT ck_checkin_status
    CHECK (status IN ('PENDING', 'PENDING_VERIFICATION', 'ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED'));

-- 4. Idempotency unique index (org_id, idempotency_key)
CREATE UNIQUE INDEX IF NOT EXISTS uq_checkins_idempotency
    ON project_progress_checkins (org_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- 5. Review queue index for pending check-ins
CREATE INDEX IF NOT EXISTS idx_checkins_pending_status
    ON project_progress_checkins (org_id, status, created_at DESC);

-- 6. Checkin revision history index
CREATE INDEX IF NOT EXISTS idx_checkins_revision_order
    ON project_progress_checkins (project_id, revision_seq DESC, created_at DESC);

-- 7. GitHub Activity project binding
ALTER TABLE github_activity ADD COLUMN IF NOT EXISTS project_id VARCHAR(64) REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_github_activity_proj
    ON github_activity (org_id, project_id, created_at DESC);

-- 8. Project Repository Links
CREATE TABLE IF NOT EXISTS project_repository_links (
    id VARCHAR(64) PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    repo_name VARCHAR(150) NOT NULL,
    default_branch VARCHAR(60) NOT NULL DEFAULT 'main',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_project_repo UNIQUE (project_id, repo_name)
);

CREATE INDEX IF NOT EXISTS idx_project_repo_org
    ON project_repository_links (org_id, project_id);
