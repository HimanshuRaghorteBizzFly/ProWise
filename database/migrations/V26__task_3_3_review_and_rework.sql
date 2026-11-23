-- Task 3.3: review and rework (FR-022, D04). A submission is bound to the exact work revision and criteria version;
-- a review decides that submission. Approval of a stale revision, by someone who is no longer the reviewer, or with a
-- missing required check changes nothing. Reopening keeps all history and removes the credit.

-- 1. Review policy and the accepted revision on the work item.
ALTER TABLE work_items
    ADD COLUMN review_required BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN accepted_revision INT NULL,
    ADD COLUMN accepted_at TIMESTAMPTZ NULL;
-- Legacy demo rows already marked Done keep their state; their current revision counts as the accepted one.
UPDATE work_items SET accepted_revision = current_revision, accepted_at = updated_at
WHERE state = 'DONE' AND org_id IS NOT NULL;

-- 2. Submissions: one per revision.
CREATE TABLE work_item_submissions (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    work_item_id VARCHAR(64) NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    revision INT NOT NULL,
    criteria_version INT NOT NULL,
    evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    note VARCHAR(2000) NULL,
    submitted_by UUID NOT NULL REFERENCES users (id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED'
        CHECK (status IN ('SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'SUPERSEDED', 'COMPLETED')),
    CONSTRAINT uq_work_item_submissions_revision UNIQUE (work_item_id, revision)
);
CREATE INDEX idx_work_item_submissions_item ON work_item_submissions (org_id, work_item_id, revision DESC);

-- 3. Review decisions (append-only).
CREATE TABLE work_item_reviews (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    work_item_id VARCHAR(64) NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    submission_id UUID NOT NULL REFERENCES work_item_submissions (id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users (id),
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('APPROVED', 'CHANGES_REQUESTED')),
    reason VARCHAR(2000) NULL,
    evidence_ref VARCHAR(500) NULL,
    work_item_revision INT NOT NULL,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_work_item_reviews_reason CHECK (decision = 'APPROVED' OR (reason IS NOT NULL AND length(trim(reason)) > 0))
);
CREATE INDEX idx_work_item_reviews_item ON work_item_reviews (org_id, work_item_id, decided_at);
CREATE TRIGGER trg_work_item_reviews_append_only
    BEFORE UPDATE OR DELETE ON work_item_reviews
    FOR EACH ROW EXECUTE FUNCTION prevent_people_history_change();

-- 4. Required checks (defined by planners, satisfied by the reviewer or a planner, never by the submitter alone).
CREATE TABLE work_item_required_checks (
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    work_item_id VARCHAR(64) NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    check_key VARCHAR(60) NOT NULL,
    label VARCHAR(200) NOT NULL,
    satisfied BOOLEAN NOT NULL DEFAULT FALSE,
    satisfied_by UUID NULL REFERENCES users (id),
    satisfied_at TIMESTAMPTZ NULL,
    PRIMARY KEY (work_item_id, check_key)
);

-- 5. Reopen events (append-only): who, why, which accepted revision lost its credit.
CREATE TABLE work_item_reopen_events (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    work_item_id VARCHAR(64) NOT NULL REFERENCES work_items (id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES users (id),
    reason VARCHAR(2000) NOT NULL,
    previous_state VARCHAR(30) NOT NULL,
    superseded_revision INT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_work_item_reopen_events_item ON work_item_reopen_events (org_id, work_item_id, occurred_at);
CREATE TRIGGER trg_work_item_reopen_events_append_only
    BEFORE UPDATE OR DELETE ON work_item_reopen_events
    FOR EACH ROW EXECUTE FUNCTION prevent_people_history_change();
