-- Task 3.3: review and rework of tasks (every task needs review approval to count: product owner decision).
--   * A task's revision is submitted for review; only the task's reviewer decides it (approve or request changes).
--   * Approval needs the submitted revision to still be current (409 STALE_REVIEW) and every required check passed.
--   * Requesting changes sends the task back to In Progress with a new revision.
--   * Authorized reopening of a Done task removes its credit, keeps all history.

ALTER TABLE work_items ADD COLUMN accepted_revision INT;
ALTER TABLE work_items ADD COLUMN accepted_at TIMESTAMPTZ;

-- Required checks of a task (acceptance criteria the reviewer confirms).
CREATE TABLE work_item_checks (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL,
    work_item_id VARCHAR(64) NOT NULL,
    label VARCHAR(200) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    retired_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_wic_checks_item_org FOREIGN KEY (org_id, work_item_id) REFERENCES work_items (org_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_work_item_checks_item ON work_item_checks (org_id, work_item_id);

-- Review history: submissions, decisions and reopenings. Append-only.
CREATE TABLE task_reviews (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL,
    work_item_id VARCHAR(64) NOT NULL,
    kind VARCHAR(30) NOT NULL,
    revision INT NOT NULL,
    note VARCHAR(2000),
    passed_check_ids TEXT,
    actor_id UUID NOT NULL REFERENCES users (id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_task_reviews_item_org FOREIGN KEY (org_id, work_item_id) REFERENCES work_items (org_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_task_reviews_kind CHECK (kind IN ('SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'REOPENED'))
);
CREATE INDEX idx_task_reviews_item ON task_reviews (org_id, work_item_id, occurred_at);
CREATE TRIGGER trg_task_reviews_append_only
    BEFORE UPDATE OR DELETE ON task_reviews
    FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION prevent_people_history_change();
