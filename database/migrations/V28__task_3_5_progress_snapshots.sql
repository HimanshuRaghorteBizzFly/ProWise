-- Task 3.5: calculated progress snapshots (FR-027, FR-029). Append-only: each material change of a Structured
-- project's accepted work or approved scope writes a new row with value, totals, method, baseline, time and cause.
-- Old snapshots are never rewritten, so earlier figures keep their original scope version.
CREATE TABLE progress_snapshots (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL,
    taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    method VARCHAR(20) NOT NULL CHECK (method IN ('INDIVIDUAL', 'STRUCTURED')),
    numerator NUMERIC(14, 2) NOT NULL,
    denominator NUMERIC(14, 2) NOT NULL,
    value_exact NUMERIC(9, 6) NULL,
    display_value INT NULL CHECK (display_value IS NULL OR display_value BETWEEN 0 AND 100),
    missing_reason VARCHAR(20) NULL CHECK (missing_reason IS NULL OR missing_reason IN ('NOT_REPORTED', 'NOT_MEASURABLE')),
    baseline_id UUID NULL REFERENCES scope_versions (id),
    accepted_leaves INT NOT NULL DEFAULT 0,
    total_leaves INT NOT NULL DEFAULT 0,
    cause VARCHAR(40) NOT NULL,
    transition_marker BOOLEAN NOT NULL DEFAULT FALSE,
    actor_id UUID NULL REFERENCES users (id),
    CONSTRAINT fk_progress_snapshots_project_org FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_progress_snapshots_value CHECK ((display_value IS NULL) = (missing_reason IS NOT NULL))
);
CREATE INDEX idx_progress_snapshots_project ON progress_snapshots (org_id, project_id, taken_at, id);

CREATE TRIGGER trg_progress_snapshots_append_only
    BEFORE UPDATE OR DELETE ON progress_snapshots
    FOR EACH ROW EXECUTE FUNCTION prevent_people_history_change();
