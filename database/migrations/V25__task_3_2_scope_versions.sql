-- Task 3.2: approved scope and its versions (FR-025, D03). One unit per version (EFFORT, POINTS or EQUAL weight 1).
-- A draft lists the full proposed set of leaves; approval makes it the single ACTIVE baseline of the project and
-- supersedes the previous one. Approved versions and their leaves are immutable.

CREATE TABLE scope_versions (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL,
    version_no INT NULL,                          -- assigned on approval: 1, 2, 3 ... per project
    unit VARCHAR(10) NOT NULL CHECK (unit IN ('EFFORT', 'POINTS', 'EQUAL')),
    status VARCHAR(12) NOT NULL CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'DISCARDED')),
    base_version_id UUID NULL REFERENCES scope_versions (id),
    reason VARCHAR(1000) NOT NULL,
    changes JSONB NOT NULL DEFAULT '[]'::jsonb,   -- the requested operations, for the diff and the history
    author_id UUID NOT NULL REFERENCES users (id),
    approver_id UUID NULL REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ NULL,
    effective_at TIMESTAMPTZ NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_scope_versions_project_org FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_scope_versions_approved CHECK (
        (status IN ('ACTIVE', 'SUPERSEDED') AND version_no IS NOT NULL AND approver_id IS NOT NULL AND approved_at IS NOT NULL)
        OR (status IN ('DRAFT', 'DISCARDED') AND version_no IS NULL))
);
CREATE INDEX idx_scope_versions_project ON scope_versions (org_id, project_id, created_at DESC);
-- Concurrent approvals cannot activate two baselines.
CREATE UNIQUE INDEX uq_scope_versions_one_active ON scope_versions (project_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX uq_scope_versions_number ON scope_versions (project_id, version_no) WHERE version_no IS NOT NULL;

CREATE TABLE scope_leaves (
    scope_version_id UUID NOT NULL REFERENCES scope_versions (id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    work_item_id VARCHAR(64) NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    weight NUMERIC(12, 2) NOT NULL CHECK (weight > 0),
    cancelled BOOLEAN NOT NULL DEFAULT FALSE,     -- cancelled work stays in the denominator until removed
    PRIMARY KEY (scope_version_id, work_item_id)
);
CREATE INDEX idx_scope_leaves_item ON scope_leaves (org_id, work_item_id);

-- Approved versions never change: only DRAFT -> DISCARDED, DRAFT -> ACTIVE and ACTIVE -> SUPERSEDED are allowed,
-- and the approved fields stay as they were.
CREATE OR REPLACE FUNCTION guard_scope_version_change() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.status IN ('ACTIVE', 'SUPERSEDED') THEN
            RAISE EXCEPTION 'approved scope versions are immutable';
        END IF;
        RETURN OLD;
    END IF;
    IF OLD.status = 'DRAFT' AND NEW.status IN ('DRAFT', 'DISCARDED', 'ACTIVE') THEN
        RETURN NEW;
    END IF;
    IF OLD.status = 'ACTIVE' AND NEW.status = 'SUPERSEDED'
       AND NEW.version_no = OLD.version_no AND NEW.unit = OLD.unit AND NEW.reason = OLD.reason
       AND NEW.approver_id = OLD.approver_id AND NEW.approved_at = OLD.approved_at
       AND NEW.effective_at IS NOT DISTINCT FROM OLD.effective_at THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'approved scope versions are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scope_versions_guard
    BEFORE UPDATE OR DELETE ON scope_versions
    FOR EACH ROW EXECUTE FUNCTION guard_scope_version_change();

CREATE OR REPLACE FUNCTION guard_scope_leaf_change() RETURNS trigger AS $$
DECLARE
    leaf_status VARCHAR(12);
BEGIN
    SELECT status INTO leaf_status FROM scope_versions
    WHERE id = COALESCE(NEW.scope_version_id, OLD.scope_version_id);
    IF leaf_status IN ('ACTIVE', 'SUPERSEDED') THEN
        RAISE EXCEPTION 'leaves of an approved scope version are immutable';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_scope_leaves_guard
    BEFORE INSERT OR UPDATE OR DELETE ON scope_leaves
    FOR EACH ROW EXECUTE FUNCTION guard_scope_leaf_change();

-- The project row points at its active baseline (column added in task 2.1).
ALTER TABLE projects ADD CONSTRAINT fk_projects_active_baseline
    FOREIGN KEY (active_baseline_id) REFERENCES scope_versions (id) NOT VALID;
