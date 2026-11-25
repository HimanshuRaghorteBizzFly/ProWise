-- Project delivery flow (owner decisions of 2026-11-25):
--   * Approvers are chosen per project at creation. They hold task.review ONLY for that project, through a
--     PROJECT-scoped grant of the narrow PROJECT_APPROVER template (project.read + task.review). The existing role
--     templates are not widened. Owner and Organization Admin are never offered as approvers (enforced in code).
--   * A Solo (Individual) submission carries a note, structured evidence (commit links/SHAs, files) and a reported
--     percentage; an approver of that project approves it or requests changes.

-- 1. The PROJECT_APPROVER template. It is never listed with the organization roles and never granted at ORG scope.
INSERT INTO roles (id, name, is_template)
VALUES ('10000000-0000-0000-0000-000000000009', 'PROJECT_APPROVER', TRUE);
INSERT INTO role_templates (role_id) VALUES ('10000000-0000-0000-0000-000000000009');
INSERT INTO role_permissions (role_id, permission_key)
VALUES ('10000000-0000-0000-0000-000000000009', 'project.read'),
       ('10000000-0000-0000-0000-000000000009', 'task.review');

ALTER TABLE grants ADD CONSTRAINT ck_grants_project_approver_scope
    CHECK (template_role_id IS DISTINCT FROM '10000000-0000-0000-0000-000000000009'::uuid OR scope = 'PROJECT');
-- One approver grant per member and project (re-choosing a person is a no-op, not a duplicate).
CREATE UNIQUE INDEX uq_grants_project_approver
    ON grants (org_id, membership_id, scope_id)
    WHERE template_role_id = '10000000-0000-0000-0000-000000000009'::uuid;

-- 2. Solo submissions: structured evidence next to the free-text summary. The evidence JSONB column already exists
--    (V8); new entries store [{type, ref, label}] there. Existing rows are append-only and are left untouched.
