-- Task 3.1: breakdown and assignment (FR-012, FR-019, FR-020). Extends the existing work_items table from the
-- Developer module (V8) instead of creating a parallel one. Additive except for two documented changes:
--   * "Blocked" is a separate flag (docs/domain-rules.md), not a workflow state. Legacy rows in state BLOCKED keep
--     is_blocked = true and move to IN_PROGRESS (a blocker is flagged on work that has started).
--   * weight loses its invented default of 1: a weight exists only once a scope version approves it (task 3.2).

-- 1. Workflow states: To Do -> In Progress -> In Review -> Done, plus Cancelled.
-- Legacy demo rows without an organization are unreachable (1.3) and stay untouched (updating trips the org check).
UPDATE work_items SET is_blocked = TRUE, state = 'IN_PROGRESS' WHERE state = 'BLOCKED' AND org_id IS NOT NULL;
ALTER TABLE work_items DROP CONSTRAINT ck_work_item_state;
ALTER TABLE work_items ADD CONSTRAINT ck_work_items_state
    CHECK (state IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED')) NOT VALID;

-- 2. Planning status: DRAFT rows may be incomplete; ACTIVE rows are in an approved scope (3.2); RETIRED rows are
--    soft-removed (never deleted). Existing demo rows are already in use, so they are ACTIVE.
ALTER TABLE work_items
    ADD COLUMN plan_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN criticality VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    ADD COLUMN criteria_version INT NOT NULL DEFAULT 1,
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN created_by UUID NULL REFERENCES users (id),
    ADD COLUMN retired_at TIMESTAMPTZ NULL,
    ADD COLUMN retired_reason VARCHAR(500) NULL,
    -- Date-only deadline: local date in the project zone (rule 8); legacy due_date is kept in sync (start of day).
    ADD COLUMN due_on DATE NULL;
UPDATE work_items SET plan_status = 'ACTIVE' WHERE org_id IS NOT NULL;
ALTER TABLE work_items ADD CONSTRAINT ck_work_items_plan_status CHECK (plan_status IN ('DRAFT', 'ACTIVE', 'RETIRED'));
ALTER TABLE work_items ADD CONSTRAINT ck_work_items_criticality CHECK (criticality IN ('NORMAL', 'CRITICAL'));
ALTER TABLE work_items ADD CONSTRAINT ck_work_items_type
    CHECK (type IN ('MILESTONE', 'DELIVERABLE', 'TASK', 'SUBTASK')) NOT VALID;

-- 3. Weight is set only by an approved scope version (3.2); positive when present.
ALTER TABLE work_items ALTER COLUMN weight DROP NOT NULL;
ALTER TABLE work_items ALTER COLUMN weight DROP DEFAULT;
ALTER TABLE work_items ADD CONSTRAINT ck_work_items_weight_positive CHECK (weight IS NULL OR weight > 0) NOT VALID;

-- 4. Tenant-safe hierarchy: the project belongs to the same organization, and a parent is in the same project.
ALTER TABLE work_items ADD CONSTRAINT fk_work_items_project_org
    FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) ON DELETE CASCADE NOT VALID;
ALTER TABLE work_items ADD CONSTRAINT uq_work_items_project_id UNIQUE (project_id, id);
ALTER TABLE work_items ADD CONSTRAINT fk_work_items_parent_same_project
    FOREIGN KEY (project_id, parent_id) REFERENCES work_items (project_id, id) NOT VALID;
ALTER TABLE work_items ADD CONSTRAINT ck_work_items_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id);
CREATE INDEX idx_work_items_parent ON work_items (project_id, parent_id);

-- 5. Stable keys, unique per project (project key + sequence, e.g. CRM-101). The counter lives on the project row
--    so concurrent creates serialize on it. It starts after the highest numeric suffix already used.
ALTER TABLE projects ADD COLUMN work_item_seq INT NOT NULL DEFAULT 0;
UPDATE projects p SET work_item_seq = COALESCE((
    SELECT max(CAST(substring(w.key FROM '-([0-9]+)$') AS INT)) FROM work_items w
    WHERE w.project_id = p.id AND w.key ~ '-[0-9]+$'), 0)
WHERE p.org_id IS NOT NULL;
CREATE UNIQUE INDEX uq_work_items_project_key ON work_items (project_id, upper(key));

-- 6. Optional collaborators (no credit, no review rights by themselves).
CREATE TABLE work_item_collaborators (
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    work_item_id VARCHAR(64) NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id),
    added_by UUID NOT NULL REFERENCES users (id),
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (work_item_id, user_id)
);
CREATE INDEX idx_work_item_collaborators_org ON work_item_collaborators (org_id, user_id);

-- 7. Assignment history (append-only): reassigning never erases who held the work before (T20).
CREATE TABLE work_item_assignment_history (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    work_item_id VARCHAR(64) NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    assignment_role VARCHAR(20) NOT NULL CHECK (assignment_role IN ('PRIMARY', 'REVIEWER', 'COLLABORATOR')),
    previous_user_id UUID NULL REFERENCES users (id),
    new_user_id UUID NULL REFERENCES users (id),
    actor_id UUID NOT NULL REFERENCES users (id),
    reason VARCHAR(500) NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_work_item_assignment_history ON work_item_assignment_history (org_id, work_item_id, occurred_at);

CREATE TRIGGER trg_work_item_assignment_history_append_only
    BEFORE UPDATE OR DELETE ON work_item_assignment_history
    FOR EACH ROW EXECUTE FUNCTION prevent_people_history_change();
