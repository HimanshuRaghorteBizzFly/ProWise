-- Task 1.3: enforce tenant scope on every access path.
-- Adds org binding to sessions, org_id to every tenant child table of the developer module,
-- a target reference to security evidence, and makes security evidence append-only.
-- Existing (V8 seed) rows without an organization are left in place; they are unreachable
-- because every query filters by the token's organization. New rows must carry org_id.

-- 1. Sessions remember the organization they were issued for (org switch / refresh).
ALTER TABLE sessions ADD COLUMN org_id UUID NULL REFERENCES organizations (id);
CREATE INDEX idx_sessions_org_id ON sessions (org_id);

-- 2. org_id on tenant child tables, backfilled from the parent row.
ALTER TABLE sprints ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
UPDATE sprints s SET org_id = p.org_id FROM projects p WHERE p.id = s.project_id AND s.org_id IS NULL;

UPDATE work_items w SET org_id = p.org_id FROM projects p WHERE p.id = w.project_id AND w.org_id IS NULL;
UPDATE bugs b SET org_id = p.org_id FROM projects p WHERE p.id = b.project_id AND b.org_id IS NULL;

ALTER TABLE task_comments ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
UPDATE task_comments c SET org_id = w.org_id FROM work_items w WHERE w.id = c.task_id AND c.org_id IS NULL;

ALTER TABLE task_blockers ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
UPDATE task_blockers b SET org_id = w.org_id FROM work_items w WHERE w.id = b.task_id AND b.org_id IS NULL;

ALTER TABLE project_progress_checkins ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
UPDATE project_progress_checkins c SET org_id = p.org_id FROM projects p WHERE p.id = c.project_id AND c.org_id IS NULL;

ALTER TABLE bug_comments ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
UPDATE bug_comments c SET org_id = b.org_id FROM bugs b WHERE b.id = c.bug_id AND c.org_id IS NULL;

ALTER TABLE code_reviews ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
UPDATE code_reviews r SET org_id = p.org_id FROM projects p WHERE p.id = r.project_id AND r.org_id IS NULL;

ALTER TABLE code_review_comments ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
UPDATE code_review_comments c SET org_id = r.org_id FROM code_reviews r WHERE r.id = c.review_id AND c.org_id IS NULL;

ALTER TABLE discussions ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
UPDATE discussions d SET org_id = p.org_id FROM projects p WHERE p.id = d.project_id AND d.org_id IS NULL;

ALTER TABLE discussion_messages ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
UPDATE discussion_messages m SET org_id = d.org_id FROM discussions d WHERE d.id = m.discussion_id AND m.org_id IS NULL;

ALTER TABLE file_metadata ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
UPDATE file_metadata f SET org_id = p.org_id FROM projects p WHERE p.id = f.project_id AND f.org_id IS NULL;

ALTER TABLE calendar_events ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;
UPDATE calendar_events e SET org_id = p.org_id FROM projects p WHERE p.id = e.project_id AND e.org_id IS NULL;

ALTER TABLE developer_notifications ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;

ALTER TABLE github_activity ADD COLUMN org_id UUID REFERENCES organizations (id) ON DELETE CASCADE;

-- 3. Indexes: every tenant table is queried by org_id first.
CREATE INDEX idx_sprints_org ON sprints (org_id, project_id);
CREATE INDEX idx_work_items_org ON work_items (org_id, project_id);
CREATE INDEX idx_bugs_org ON bugs (org_id, project_id);
CREATE INDEX idx_task_comments_org ON task_comments (org_id, task_id);
CREATE INDEX idx_task_blockers_org ON task_blockers (org_id, task_id);
CREATE INDEX idx_checkins_org ON project_progress_checkins (org_id, project_id);
CREATE INDEX idx_bug_comments_org ON bug_comments (org_id, bug_id);
CREATE INDEX idx_code_reviews_org ON code_reviews (org_id, project_id);
CREATE INDEX idx_code_review_comments_org ON code_review_comments (org_id, review_id);
CREATE INDEX idx_discussions_org ON discussions (org_id, project_id);
CREATE INDEX idx_discussion_messages_org ON discussion_messages (org_id, discussion_id);
CREATE INDEX idx_file_metadata_org ON file_metadata (org_id, project_id);
CREATE INDEX idx_calendar_events_org ON calendar_events (org_id, user_id);
CREATE INDEX idx_dev_notifications_org ON developer_notifications (org_id, user_id);
CREATE INDEX idx_github_activity_org ON github_activity (org_id, created_at DESC);

-- 4. New and updated rows must belong to an organization (legacy NULL rows are not validated).
ALTER TABLE projects ADD CONSTRAINT ck_projects_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE sprints ADD CONSTRAINT ck_sprints_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE work_items ADD CONSTRAINT ck_work_items_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE bugs ADD CONSTRAINT ck_bugs_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE task_comments ADD CONSTRAINT ck_task_comments_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE task_blockers ADD CONSTRAINT ck_task_blockers_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE project_progress_checkins ADD CONSTRAINT ck_checkins_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE bug_comments ADD CONSTRAINT ck_bug_comments_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE code_reviews ADD CONSTRAINT ck_code_reviews_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE code_review_comments ADD CONSTRAINT ck_code_review_comments_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE discussions ADD CONSTRAINT ck_discussions_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE discussion_messages ADD CONSTRAINT ck_discussion_messages_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE file_metadata ADD CONSTRAINT ck_file_metadata_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE calendar_events ADD CONSTRAINT ck_calendar_events_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE developer_notifications ADD CONSTRAINT ck_dev_notifications_org_required CHECK (org_id IS NOT NULL) NOT VALID;
ALTER TABLE github_activity ADD CONSTRAINT ck_github_activity_org_required CHECK (org_id IS NOT NULL) NOT VALID;

-- 5. Security evidence: record the attempted reference (IDs may be non-UUID) and make it append-only.
ALTER TABLE security_evidence ADD COLUMN target_ref VARCHAR(100);

CREATE OR REPLACE FUNCTION prevent_security_evidence_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'security_evidence is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_security_evidence_append_only
    BEFORE UPDATE OR DELETE ON security_evidence
    FOR EACH ROW EXECUTE FUNCTION prevent_security_evidence_change();
