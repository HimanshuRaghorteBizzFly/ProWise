-- Task 3.1: work breakdown and assignment (Structured projects).
-- Extends the existing work_items (V8, V10) and file_metadata tables; no parallel tables for them.
--
--   * Hierarchy: project -> optional MILESTONE (a "phase") -> optional DELIVERABLE -> TASK -> SUBTASK
--     (max 5 levels including the project). Parents stay inside the same project (composite FK).
--   * Leaves (TASK / SUBTASK) carry points (weight, unit "pts"); one primary assignee, a reviewer, optional
--     collaborators. Reassignment never erases the previous assignment (append-only history).
--   * Work types: organization-level, created / edited / retired (T19).
--   * Project documents: stored in the database (file_metadata.content), 10 MB each.

-- 1. Work types (T19).
CREATE TABLE work_types (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(300),
    retired_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_work_types_org_id UNIQUE (org_id, id)
);
CREATE UNIQUE INDEX uq_work_types_org_name ON work_types (org_id, lower(name)) WHERE retired_at IS NULL;
CREATE INDEX idx_work_types_org ON work_types (org_id);

-- 2. Work items: hierarchy, membership-based people, version, stable keys.
ALTER TABLE work_items ADD COLUMN work_type_id UUID;
ALTER TABLE work_items ADD COLUMN assignee_membership_id UUID;
ALTER TABLE work_items ADD COLUMN reviewer_membership_id UUID;
ALTER TABLE work_items ADD COLUMN position INT NOT NULL DEFAULT 0;
ALTER TABLE work_items ADD COLUMN retired_at TIMESTAMPTZ;
ALTER TABLE work_items ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE work_items ADD COLUMN created_by UUID REFERENCES users (id);

ALTER TABLE work_items ADD CONSTRAINT uq_work_items_project_id UNIQUE (project_id, id);
ALTER TABLE work_items ADD CONSTRAINT uq_work_items_org_id UNIQUE (org_id, id);
-- Parents must be in the same project (NOT VALID: legacy demo rows are not re-checked).
ALTER TABLE work_items ADD CONSTRAINT fk_work_items_parent_same_project
    FOREIGN KEY (project_id, parent_id) REFERENCES work_items (project_id, id) NOT VALID;
ALTER TABLE work_items ADD CONSTRAINT fk_work_items_project_org
    FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) NOT VALID;
ALTER TABLE work_items ADD CONSTRAINT fk_work_items_assignee_org
    FOREIGN KEY (org_id, assignee_membership_id) REFERENCES memberships (org_id, id);
ALTER TABLE work_items ADD CONSTRAINT fk_work_items_reviewer_org
    FOREIGN KEY (org_id, reviewer_membership_id) REFERENCES memberships (org_id, id);
ALTER TABLE work_items ADD CONSTRAINT fk_work_items_type_org
    FOREIGN KEY (org_id, work_type_id) REFERENCES work_types (org_id, id);
-- New breakdown rows (created_by set) use the four levels; legacy demo rows keep their old types.
ALTER TABLE work_items ADD CONSTRAINT ck_work_items_level
    CHECK (created_by IS NULL OR type IN ('MILESTONE', 'DELIVERABLE', 'TASK', 'SUBTASK'));
ALTER TABLE work_items ADD CONSTRAINT ck_work_items_points
    CHECK (created_by IS NULL OR weight >= 0);
-- Stable keys: unique per project for breakdown rows.
CREATE UNIQUE INDEX uq_work_items_project_key ON work_items (project_id, key) WHERE created_by IS NOT NULL;
CREATE INDEX idx_work_items_parent ON work_items (project_id, parent_id);
CREATE INDEX idx_work_items_assignee_membership ON work_items (org_id, assignee_membership_id);

-- 3. Optional collaborators on a leaf.
CREATE TABLE work_item_collaborators (
    org_id UUID NOT NULL,
    work_item_id VARCHAR(64) NOT NULL,
    membership_id UUID NOT NULL,
    added_by UUID NOT NULL REFERENCES users (id),
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (work_item_id, membership_id),
    CONSTRAINT fk_wic_item_org FOREIGN KEY (org_id, work_item_id) REFERENCES work_items (org_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_wic_membership_org FOREIGN KEY (org_id, membership_id) REFERENCES memberships (org_id, id)
);
CREATE INDEX idx_wic_org ON work_item_collaborators (org_id, work_item_id);

-- 4. Assignment history (T20: reassign without erasing the previous assignment). Append-only.
CREATE TABLE work_item_assignments (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL,
    work_item_id VARCHAR(64) NOT NULL,
    previous_assignee_membership_id UUID,
    new_assignee_membership_id UUID,
    previous_reviewer_membership_id UUID,
    new_reviewer_membership_id UUID,
    reason VARCHAR(500),
    actor_id UUID NOT NULL REFERENCES users (id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_wia_item_org FOREIGN KEY (org_id, work_item_id) REFERENCES work_items (org_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_wia_item ON work_item_assignments (org_id, work_item_id, occurred_at);
CREATE TRIGGER trg_work_item_assignments_append_only
    BEFORE UPDATE OR DELETE ON work_item_assignments
    FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION prevent_people_history_change();

-- 5. Project documents stored in the database (decided by the product owner), 10 MB each.
ALTER TABLE file_metadata ADD COLUMN content BYTEA;
ALTER TABLE file_metadata ADD COLUMN uploaded_by_user UUID REFERENCES users (id);
ALTER TABLE file_metadata ADD CONSTRAINT ck_file_metadata_size CHECK (content IS NULL OR file_size <= 10485760);
