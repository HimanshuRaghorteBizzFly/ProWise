-- Task 3.4: dependencies and blockers (FR-021, FR-024, M07). Finish-to-Start links inside one project; blockers are
-- a separate flag with reason, owner, severity and timestamps, never a workflow state.

-- 1. Finish-to-Start dependencies: the successor waits for the predecessor. Both ends are in the same project
--    (composite foreign keys); no self-links or duplicates. Cycles are refused by the service under a project lock.
CREATE TABLE work_item_dependencies (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL,
    predecessor_id VARCHAR(64) NOT NULL,
    successor_id VARCHAR(64) NOT NULL,
    created_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_work_item_dependencies_not_self CHECK (predecessor_id <> successor_id),
    CONSTRAINT uq_work_item_dependencies UNIQUE (predecessor_id, successor_id),
    CONSTRAINT fk_work_item_dependencies_predecessor FOREIGN KEY (project_id, predecessor_id)
        REFERENCES work_items (project_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_work_item_dependencies_successor FOREIGN KEY (project_id, successor_id)
        REFERENCES work_items (project_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_work_item_dependencies_project_org FOREIGN KEY (org_id, project_id)
        REFERENCES projects (org_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_work_item_dependencies_successor ON work_item_dependencies (org_id, successor_id);
CREATE INDEX idx_work_item_dependencies_predecessor ON work_item_dependencies (org_id, predecessor_id);

-- 2. "Needs review" flag on successors of a reopened prerequisite (flagged, never auto-reversed or re-dated).
ALTER TABLE work_items
    ADD COLUMN dependency_flag VARCHAR(500) NULL,
    ADD COLUMN dependency_flagged_at TIMESTAMPTZ NULL;

-- 3. Blockers: owner, reporter, resolution and waiver, two severities. Legacy severities other than CRITICAL become
--    NORMAL (rows without an organization are unreachable since 1.3 and stay untouched).
ALTER TABLE task_blockers
    ADD COLUMN opened_by UUID NULL REFERENCES users (id),
    ADD COLUMN resolved_by UUID NULL REFERENCES users (id),
    ADD COLUMN resolution VARCHAR(1000) NULL,
    ADD COLUMN waived_by UUID NULL REFERENCES users (id),
    ADD COLUMN waived_reason VARCHAR(1000) NULL;
UPDATE task_blockers SET severity = 'NORMAL' WHERE severity <> 'CRITICAL' AND org_id IS NOT NULL;
ALTER TABLE task_blockers ALTER COLUMN severity SET DEFAULT 'NORMAL';
ALTER TABLE task_blockers ADD CONSTRAINT ck_task_blockers_severity CHECK (severity IN ('NORMAL', 'CRITICAL')) NOT VALID;
CREATE INDEX idx_task_blockers_open ON task_blockers (org_id, task_id) WHERE NOT resolved;
