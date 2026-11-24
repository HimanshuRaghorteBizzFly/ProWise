-- Task 3.5: progress of Structured projects from accepted work, snapshotted on every material change.
-- A snapshot keeps value, numerator, denominator, method, the scope version it was measured against, time and cause.
-- Snapshots are never rewritten (append-only).

CREATE TABLE progress_snapshots (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL,
    project_id VARCHAR(64) NOT NULL,
    scope_version_id UUID,
    scope_version_no INT,
    numerator NUMERIC(14,2) NOT NULL,
    denominator NUMERIC(14,2) NOT NULL,
    percent NUMERIC(9,4),
    display_percent NUMERIC(5,0),
    method VARCHAR(30) NOT NULL DEFAULT 'calculated',
    cause VARCHAR(60) NOT NULL,
    cause_ref VARCHAR(64),
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_progress_snapshots_project_org FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_progress_snapshots_measure CHECK ((denominator = 0) = (percent IS NULL))
);
CREATE INDEX idx_progress_snapshots_project ON progress_snapshots (org_id, project_id, captured_at);
CREATE TRIGGER trg_progress_snapshots_append_only
    BEFORE UPDATE OR DELETE ON progress_snapshots
    FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION prevent_people_history_change();
