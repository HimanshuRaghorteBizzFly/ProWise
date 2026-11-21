-- Task 2.1: project records (FR-009, FR-011). Extends the existing projects table from the Developer module
-- (V8) instead of creating a parallel one. Legacy text columns (project_manager_id, accountable_owner_id,
-- member_ids, start_date, target_date) are kept and written in sync by the project service so the Developer
-- pages keep working; the new membership columns are the source of truth and are tenant-checked by composite
-- foreign keys.

-- 1. Lifecycle categories from docs/domain-rules.md (adds Awaiting acceptance).
ALTER TABLE projects DROP CONSTRAINT IF EXISTS ck_project_lifecycle;
ALTER TABLE projects ADD CONSTRAINT ck_projects_lifecycle CHECK (lifecycle IN
    ('PLANNED', 'ACTIVE', 'ON_HOLD', 'AWAITING_ACCEPTANCE', 'DELIVERED', 'CLOSED', 'CANCELLED'));

-- 2. No invented percentage: a new project has no reported progress until someone reports it.
ALTER TABLE projects ALTER COLUMN last_progress_percent DROP DEFAULT;

-- 3. New columns.
ALTER TABLE projects
    ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN active_baseline_id UUID NULL,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN start_on DATE NULL,
    ADD COLUMN target_on DATE NULL,
    ADD COLUMN project_manager_membership_id UUID NULL,
    ADD COLUMN accountable_membership_id UUID NULL,
    ADD COLUMN team_id UUID NULL,
    ADD COLUMN created_by UUID NULL REFERENCES users (id);

-- Date-only deadlines keep the local date in the project zone (rule 8). Legacy demo rows without an organization
-- are unreachable (1.3) and are left untouched: updating them would trip ck_projects_org_required.
UPDATE projects SET
    start_on = CASE WHEN start_date IS NULL THEN NULL
                    ELSE (start_date AT TIME ZONE COALESCE(timezone, 'UTC'))::date END,
    target_on = CASE WHEN target_date IS NULL THEN NULL
                     ELSE (target_date AT TIME ZONE COALESCE(timezone, 'UTC'))::date END
WHERE org_id IS NOT NULL;

-- Map legacy user ids to memberships of the same organization where possible.
UPDATE projects p SET accountable_membership_id = m.id
FROM memberships m WHERE m.org_id = p.org_id AND CAST(m.user_id AS text) = p.accountable_owner_id;
UPDATE projects p SET project_manager_membership_id = m.id
FROM memberships m WHERE m.org_id = p.org_id AND CAST(m.user_id AS text) = p.project_manager_id;

-- 4. Tenant-safe references: owners, PM and team must belong to the project's organization.
ALTER TABLE projects ADD CONSTRAINT uq_projects_org_id UNIQUE (org_id, id);
ALTER TABLE projects ADD CONSTRAINT fk_projects_pm_org
    FOREIGN KEY (org_id, project_manager_membership_id) REFERENCES memberships (org_id, id);
ALTER TABLE projects ADD CONSTRAINT fk_projects_accountable_org
    FOREIGN KEY (org_id, accountable_membership_id) REFERENCES memberships (org_id, id);
ALTER TABLE projects ADD CONSTRAINT fk_projects_team_org
    FOREIGN KEY (org_id, team_id) REFERENCES teams (org_id, id);

-- 5. Stable key, unique per organization (case-insensitive).
CREATE UNIQUE INDEX uq_projects_org_key ON projects (org_id, upper(key));

-- 6. Valid ranges and values for new and updated rows (legacy rows are not re-validated).
ALTER TABLE projects ADD CONSTRAINT ck_projects_date_range
    CHECK (start_on IS NULL OR target_on IS NULL OR target_on >= start_on) NOT VALID;
ALTER TABLE projects ADD CONSTRAINT ck_projects_priority
    CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT VALID;

-- Deterministic portfolio order: name, then id as tie-break.
CREATE INDEX idx_projects_org_name ON projects (org_id, lower(name), id);

-- 7. Project members.
CREATE TABLE project_members (
    project_id VARCHAR(64) NOT NULL,
    org_id UUID NOT NULL,
    membership_id UUID NOT NULL,
    added_by UUID NOT NULL REFERENCES users (id),
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, membership_id),
    CONSTRAINT fk_project_members_project_org FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_project_members_membership_org FOREIGN KEY (org_id, membership_id) REFERENCES memberships (org_id, id)
);
CREATE INDEX idx_project_members_org ON project_members (org_id, membership_id);

-- 8. Target date history (append-only): previous and new local date, reason, actor.
CREATE TABLE project_date_history (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL,
    previous_target_on DATE NULL,
    new_target_on DATE NULL,
    reason VARCHAR(500) NOT NULL,
    actor_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_project_date_history_project_org FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_project_date_history_org ON project_date_history (org_id, project_id, occurred_at DESC);

CREATE TRIGGER trg_project_date_history_append_only
    BEFORE UPDATE OR DELETE ON project_date_history
    FOR EACH ROW EXECUTE FUNCTION prevent_people_history_change();
