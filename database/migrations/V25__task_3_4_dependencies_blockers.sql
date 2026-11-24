-- Task 3.4: Finish-to-Start dependencies inside one project, and blockers with reason, owner, severity and timestamps.
-- Blocked is a separate flag (work_items.is_blocked); clearing it never changes the task state.

CREATE TABLE work_item_dependencies (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    predecessor_id VARCHAR(64) NOT NULL,
    successor_id VARCHAR(64) NOT NULL,
    created_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_dependencies_not_self CHECK (predecessor_id <> successor_id),
    CONSTRAINT uq_dependencies_pair UNIQUE (predecessor_id, successor_id),
    CONSTRAINT fk_dependencies_project_org FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) ON DELETE CASCADE,
    -- both ends belong to the same project (no cross-project links)
    CONSTRAINT fk_dependencies_predecessor FOREIGN KEY (project_id, predecessor_id) REFERENCES work_items (project_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_dependencies_successor FOREIGN KEY (project_id, successor_id) REFERENCES work_items (project_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_dependencies_project ON work_item_dependencies (org_id, project_id);
CREATE INDEX idx_dependencies_successor ON work_item_dependencies (org_id, successor_id);

-- A reopened accepted predecessor flags its successors for review; nothing is reversed automatically and no date moves.
ALTER TABLE work_items ADD COLUMN dependency_flagged_at TIMESTAMPTZ;
ALTER TABLE work_items ADD COLUMN dependency_flag_reason TEXT;

-- Blockers: extend the existing task_blockers table (the developer panel keeps using it).
ALTER TABLE task_blockers ADD COLUMN owner_membership_id UUID;
ALTER TABLE task_blockers ADD COLUMN opened_by UUID REFERENCES users (id);
ALTER TABLE task_blockers ADD COLUMN resolution TEXT;
ALTER TABLE task_blockers ADD COLUMN resolved_by_user UUID REFERENCES users (id);
ALTER TABLE task_blockers ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE task_blockers ADD CONSTRAINT fk_task_blockers_owner_org
    FOREIGN KEY (org_id, owner_membership_id) REFERENCES memberships (org_id, id);
-- Rows written by task 3.4 (opened_by set) use NORMAL or CRITICAL and always name an owner; resolving needs a resolution.
ALTER TABLE task_blockers ADD CONSTRAINT ck_task_blockers_3_4 CHECK (
    opened_by IS NULL OR (severity IN ('NORMAL', 'CRITICAL') AND owner_membership_id IS NOT NULL
        AND (resolved = false OR (resolution IS NOT NULL AND resolved_at IS NOT NULL))));
CREATE INDEX idx_task_blockers_open ON task_blockers (org_id, task_id) WHERE resolved = false;
