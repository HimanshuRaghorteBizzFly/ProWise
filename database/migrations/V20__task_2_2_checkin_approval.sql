-- Task 2.2: Individual progress check-ins with Team Lead approval.
-- Extends the existing project_progress_checkins table (V8, V10, V17); no parallel table.
--
-- Rules enforced here:
--   * every check-in starts PENDING; only PENDING -> APPROVED | REJECTED is allowed, once, and only the
--     decision columns may change; nothing else is ever edited or deleted (append-only corrections);
--   * method is always 'developer_reported' (verification never changes the label);
--   * at most one PENDING entry per project; revision_seq is unique per project.
-- New permission key project.progress.verify, granted only to the TEAM_LEAD template.

-- 1. Permission key for approving / rejecting check-ins (decided by the product owner, task 2.2).
INSERT INTO role_permissions (role_id, permission_key)
SELECT id, 'project.progress.verify' FROM roles WHERE is_template AND name = 'TEAM_LEAD'
ON CONFLICT DO NOTHING;

-- 2. Normalize existing tenant rows before the new constraints (legacy and V17 status names).
--    Legacy demo rows without org_id (V8) are left untouched: the NOT VALID org checks from V10 reject any
--    update of them, and every new rule below is scoped to tenant rows.
ALTER TABLE project_progress_checkins DROP CONSTRAINT IF EXISTS ck_checkin_status;
UPDATE project_progress_checkins SET status = 'PENDING' WHERE org_id IS NOT NULL AND status = 'PENDING_VERIFICATION';
UPDATE project_progress_checkins SET status = 'APPROVED' WHERE org_id IS NOT NULL AND status = 'ACCEPTED';
UPDATE project_progress_checkins SET status = 'REJECTED' WHERE org_id IS NOT NULL AND status = 'CHANGES_REQUESTED';
UPDATE project_progress_checkins SET method = 'developer_reported'
WHERE org_id IS NOT NULL AND method IS DISTINCT FROM 'developer_reported';
UPDATE projects SET last_progress_method = 'developer_reported'
WHERE org_id IS NOT NULL AND last_progress_method = 'DEVELOPER_REPORTED';
ALTER TABLE projects ALTER COLUMN last_progress_method SET DEFAULT 'developer_reported';

-- Keep only the newest PENDING entry per project; older ones are closed as rejected (legacy data only).
UPDATE project_progress_checkins c
SET status = 'REJECTED', review_comment = 'Superseded by a newer pending check-in (migration V20)', reviewed_at = now()
WHERE c.org_id IS NOT NULL AND c.status = 'PENDING'
  AND EXISTS (SELECT 1 FROM project_progress_checkins n
              WHERE n.org_id IS NOT NULL AND n.project_id = c.project_id AND n.status = 'PENDING'
                AND (n.created_at, n.id) > (c.created_at, c.id));

-- Make revision_seq a strict per-project sequence (legacy rows all defaulted to 1).
UPDATE project_progress_checkins c
SET revision_seq = r.seq
FROM (SELECT id, row_number() OVER (PARTITION BY project_id ORDER BY revision_seq, created_at, id) AS seq
      FROM project_progress_checkins WHERE org_id IS NOT NULL) r
WHERE r.id = c.id AND c.revision_seq <> r.seq;

-- 3. New column: date-only projected finish (local date, rule 8).
ALTER TABLE project_progress_checkins ADD COLUMN projected_finish_on DATE;
UPDATE project_progress_checkins SET projected_finish_on = CAST(projected_finish AT TIME ZONE 'UTC' AS DATE)
WHERE org_id IS NOT NULL AND projected_finish IS NOT NULL;

ALTER TABLE project_progress_checkins ALTER COLUMN status SET DEFAULT 'PENDING';
ALTER TABLE project_progress_checkins ALTER COLUMN method SET DEFAULT 'developer_reported';

-- 4. Constraints (NOT VALID: enforced for every new or changed row; legacy org-less demo rows are skipped).
ALTER TABLE project_progress_checkins ADD CONSTRAINT ck_checkin_status
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')) NOT VALID;
ALTER TABLE project_progress_checkins ADD CONSTRAINT ck_checkin_method
    CHECK (method = 'developer_reported') NOT VALID;
ALTER TABLE project_progress_checkins ADD CONSTRAINT ck_checkin_decision
    CHECK ((status = 'PENDING') = (reviewed_at IS NULL)) NOT VALID;

CREATE UNIQUE INDEX uq_checkins_one_pending
    ON project_progress_checkins (project_id) WHERE status = 'PENDING' AND org_id IS NOT NULL;
CREATE UNIQUE INDEX uq_checkins_revision
    ON project_progress_checkins (project_id, revision_seq) WHERE org_id IS NOT NULL;

-- 5. Append-only: no direct DELETE, no edits except the single PENDING -> APPROVED/REJECTED decision.
--    Removing a whole project or organization still cascades (fired from the FK trigger, depth > 1).
CREATE OR REPLACE FUNCTION guard_checkin_append_only() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF pg_trigger_depth() > 1 THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'project_progress_checkins is append-only';
    END IF;
    IF (NEW.id, NEW.org_id, NEW.project_id, NEW.author_id, NEW.author_name, NEW.percent, NEW.accomplished,
        NEW.next_steps, NEW.blockers, NEW.projected_finish, NEW.projected_finish_on, NEW.evidence_summary,
        NEW.evidence, NEW.downward_reason, NEW.method, NEW.revision_of, NEW.revision_seq, NEW.idempotency_key,
        NEW.captured_at, NEW.created_at)
       IS DISTINCT FROM
       (OLD.id, OLD.org_id, OLD.project_id, OLD.author_id, OLD.author_name, OLD.percent, OLD.accomplished,
        OLD.next_steps, OLD.blockers, OLD.projected_finish, OLD.projected_finish_on, OLD.evidence_summary,
        OLD.evidence, OLD.downward_reason, OLD.method, OLD.revision_of, OLD.revision_seq, OLD.idempotency_key,
        OLD.captured_at, OLD.created_at) THEN
        RAISE EXCEPTION 'check-in % content is append-only', OLD.id;
    END IF;
    IF OLD.status <> 'PENDING' OR NEW.status NOT IN ('APPROVED', 'REJECTED') THEN
        RAISE EXCEPTION 'check-in % is already decided or the decision is invalid', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_checkins_append_only
    BEFORE UPDATE OR DELETE ON project_progress_checkins
    FOR EACH ROW EXECUTE FUNCTION guard_checkin_append_only();
