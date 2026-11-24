-- Task 2.3: never two live occurrences for one due window.
-- V18 made (project, kind, date, policy_version) unique, which blocks moving a target back to an earlier date
-- (A -> B -> A) yet still allows two OPEN target occurrences under different policy versions.
-- Live = OPEN or PAUSED. A project has at most one live TARGET and one live CHECKIN occurrence at a time;
-- superseded, met, missed and excused rows are history and may repeat a date.

ALTER TABLE due_occurrences DROP CONSTRAINT IF EXISTS uq_occurrences_window;
UPDATE due_occurrences d SET status = 'SUPERSEDED', updated_at = now()
WHERE d.status IN ('OPEN', 'PAUSED')
  AND EXISTS (SELECT 1 FROM due_occurrences n WHERE n.project_id = d.project_id AND n.kind = d.kind
              AND n.status IN ('OPEN', 'PAUSED') AND (n.created_at, n.id) > (d.created_at, d.id));
CREATE UNIQUE INDEX uq_occurrences_one_live ON due_occurrences (project_id, kind) WHERE status IN ('OPEN', 'PAUSED');
ALTER TABLE due_occurrences ADD CONSTRAINT ck_occurrences_kind CHECK (kind IN ('CHECKIN', 'TARGET')) NOT VALID;
ALTER TABLE due_occurrences ADD CONSTRAINT ck_occurrences_status
    CHECK (status IN ('OPEN', 'MET', 'MISSED', 'EXCUSED', 'SUPERSEDED', 'PAUSED')) NOT VALID;
ALTER TABLE due_occurrences ADD COLUMN IF NOT EXISTS superseded_reason TEXT;
