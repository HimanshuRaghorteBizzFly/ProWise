-- Preserve columns and ownership history used by the existing Developer project entity.
-- The main project records schema is V15__task_2_1_project_records.sql.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS scope_description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS previous_lifecycle VARCHAR(30);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS accountable_developer_id VARCHAR(64);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS calendar_ref VARCHAR(64);

UPDATE projects
SET accountable_developer_id = accountable_owner_id
WHERE org_id IS NOT NULL
  AND accountable_developer_id IS NULL
  AND accountable_owner_id IS NOT NULL;

UPDATE projects
SET scope_description = description
WHERE org_id IS NOT NULL
  AND scope_description IS NULL
  AND description IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_org_archived ON projects (org_id, archived);
CREATE INDEX IF NOT EXISTS idx_projects_acc_dev ON projects (org_id, accountable_developer_id);

CREATE TABLE IF NOT EXISTS project_ownership_history (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    old_owner_id VARCHAR(64),
    new_owner_id VARCHAR(64) NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES users (id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_ownership_history_org
    ON project_ownership_history (org_id, project_id, changed_at DESC);
