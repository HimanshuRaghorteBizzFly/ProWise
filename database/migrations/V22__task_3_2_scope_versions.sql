-- Task 3.2: approved scope versions (baselines) for Structured projects.
--   * A version lists its leaves (task / subtask) with points; once approved it never changes.
--   * Exactly one ACTIVE version per project (partial unique index + version-checked approval).
--   * Drafts describe changes (add, remove, cancel, split, change points) against the version they started from;
--     approving a draft whose base is no longer active is a 409 STALE_VERSION.
--   * A cancelled leaf stays in the version (counted in the denominator, earning nothing) until it is removed.
--   * Unit: points only (product owner decision).

CREATE TABLE scope_versions (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    project_id VARCHAR(64) NOT NULL,
    version_no INT NOT NULL,
    base_version_no INT NOT NULL,
    unit VARCHAR(20) NOT NULL DEFAULT 'POINTS',
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    reason VARCHAR(1000) NOT NULL,
    author_id UUID NOT NULL REFERENCES users (id),
    approver_id UUID REFERENCES users (id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    effective_at TIMESTAMPTZ,
    superseded_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_scope_versions_org_id UNIQUE (org_id, id),
    CONSTRAINT fk_scope_versions_project_org FOREIGN KEY (org_id, project_id) REFERENCES projects (org_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_scope_versions_unit CHECK (unit = 'POINTS'),
    CONSTRAINT ck_scope_versions_status CHECK (status IN ('DRAFT', 'ACTIVE', 'SUPERSEDED')),
    CONSTRAINT ck_scope_versions_approval CHECK ((status = 'DRAFT') = (approved_at IS NULL))
);
CREATE UNIQUE INDEX uq_scope_versions_one_active ON scope_versions (project_id) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX uq_scope_versions_number ON scope_versions (project_id, version_no) WHERE status <> 'DRAFT';
CREATE INDEX idx_scope_versions_project ON scope_versions (org_id, project_id, created_at);

-- Leaves of a version. For a draft they are the proposed result; for an approved version they are frozen.
CREATE TABLE scope_leaves (
    scope_version_id UUID NOT NULL,
    org_id UUID NOT NULL,
    work_item_id VARCHAR(64) NOT NULL,
    weight NUMERIC(10,2) NOT NULL,
    cancelled BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (scope_version_id, work_item_id),
    CONSTRAINT fk_scope_leaves_version FOREIGN KEY (org_id, scope_version_id) REFERENCES scope_versions (org_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_scope_leaves_item FOREIGN KEY (org_id, work_item_id) REFERENCES work_items (org_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_scope_leaves_weight CHECK (weight > 0)
);
CREATE INDEX idx_scope_leaves_org ON scope_leaves (org_id, scope_version_id);

-- What a draft changes, for the diff view and the audit trail.
CREATE TABLE scope_changes (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL,
    scope_version_id UUID NOT NULL,
    kind VARCHAR(20) NOT NULL,
    work_item_id VARCHAR(64) NOT NULL,
    source_work_item_id VARCHAR(64),
    previous_weight NUMERIC(10,2),
    new_weight NUMERIC(10,2),
    position INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_scope_changes_version FOREIGN KEY (org_id, scope_version_id) REFERENCES scope_versions (org_id, id) ON DELETE CASCADE,
    CONSTRAINT ck_scope_changes_kind CHECK (kind IN ('ADD', 'REMOVE', 'CANCEL', 'SPLIT', 'REWEIGHT'))
);
CREATE INDEX idx_scope_changes_version ON scope_changes (org_id, scope_version_id, position);

-- Work items proposed by a draft (added or split-out tasks) stay hidden from the breakdown until approval.
ALTER TABLE work_items ADD COLUMN proposed_scope_version_id UUID;
ALTER TABLE work_items ADD COLUMN cancelled_at TIMESTAMPTZ;

-- Approved versions and their leaves are immutable; only DRAFT -> ACTIVE and ACTIVE -> SUPERSEDED are allowed.
CREATE OR REPLACE FUNCTION guard_scope_versions() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF pg_trigger_depth() > 1 OR OLD.status = 'DRAFT' THEN RETURN OLD; END IF;
        RAISE EXCEPTION 'approved scope versions are immutable';
    END IF;
    IF OLD.status = 'DRAFT' THEN RETURN NEW; END IF;
    IF OLD.status = 'ACTIVE' AND NEW.status = 'SUPERSEDED'
       AND (NEW.version_no, NEW.base_version_no, NEW.unit, NEW.reason, NEW.author_id, NEW.approver_id, NEW.approved_at,
            NEW.effective_at, NEW.project_id, NEW.org_id)
           IS NOT DISTINCT FROM
           (OLD.version_no, OLD.base_version_no, OLD.unit, OLD.reason, OLD.author_id, OLD.approver_id, OLD.approved_at,
            OLD.effective_at, OLD.project_id, OLD.org_id) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'approved scope versions are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_scope_versions_immutable BEFORE UPDATE OR DELETE ON scope_versions
    FOR EACH ROW EXECUTE FUNCTION guard_scope_versions();

CREATE OR REPLACE FUNCTION guard_scope_leaves() RETURNS trigger AS $$
DECLARE
    state VARCHAR(20);
BEGIN
    IF pg_trigger_depth() > 1 THEN RETURN COALESCE(NEW, OLD); END IF;
    SELECT status INTO state FROM scope_versions WHERE id = COALESCE(NEW.scope_version_id, OLD.scope_version_id);
    IF state = 'DRAFT' THEN RETURN COALESCE(NEW, OLD); END IF;
    RAISE EXCEPTION 'leaves of an approved scope version are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trg_scope_leaves_immutable BEFORE UPDATE OR DELETE ON scope_leaves
    FOR EACH ROW EXECUTE FUNCTION guard_scope_leaves();
