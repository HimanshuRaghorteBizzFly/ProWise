-- Owner decision 2026-11-25: whoever creates a project (and the project's Project Manager) may connect that project's
-- GitHub repository, for THAT project only. A narrow PROJECT_REPO_MANAGER template (project.read, repo.connect,
-- repo.read) is granted at PROJECT scope; the Project Manager template does NOT get organization-wide repo.connect.
-- Owner and Organization Admin keep their organization-wide repo.connect. The template is never listed or assignable
-- in role management, and the database refuses an ORG-scope grant of it.
-- The last 4 characters of a stored token are kept in clear so people can recognise which token is in use; the token
-- itself stays encrypted (APP_ENCRYPTION_KEY) and is never returned.

INSERT INTO roles (id, name, is_template)
VALUES ('10000000-0000-0000-0000-000000000010', 'PROJECT_REPO_MANAGER', TRUE);
INSERT INTO role_templates (role_id) VALUES ('10000000-0000-0000-0000-000000000010');
INSERT INTO role_permissions (role_id, permission_key)
VALUES ('10000000-0000-0000-0000-000000000010', 'project.read'),
       ('10000000-0000-0000-0000-000000000010', 'repo.connect'),
       ('10000000-0000-0000-0000-000000000010', 'repo.read');

ALTER TABLE grants ADD CONSTRAINT ck_grants_project_repo_manager_scope
    CHECK (template_role_id IS DISTINCT FROM '10000000-0000-0000-0000-000000000010'::uuid OR scope = 'PROJECT');
CREATE UNIQUE INDEX uq_grants_project_repo_manager
    ON grants (org_id, membership_id, scope_id)
    WHERE template_role_id = '10000000-0000-0000-0000-000000000010'::uuid;

-- Existing projects: their creator (when still an active member) and their Project Manager.
INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, scope_id, granted_by)
SELECT gen_random_uuid(), p.org_id, m.id, '10000000-0000-0000-0000-000000000010'::uuid, 'PROJECT', CAST(p.id AS uuid), p.created_by
FROM projects p
JOIN memberships m ON m.org_id = p.org_id AND m.status = 'ACTIVE'
    AND (m.id = p.project_manager_membership_id OR m.user_id = p.created_by)
WHERE p.org_id IS NOT NULL AND p.created_by IS NOT NULL
  AND p.id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND m.role_template NOT IN ('ORGANIZATION_OWNER', 'ORGANIZATION_ADMIN', 'PLATFORM_OPERATOR')
ON CONFLICT DO NOTHING;

ALTER TABLE project_repository_links ADD COLUMN token_last4 VARCHAR(4) NULL;
ALTER TABLE project_drafts ADD COLUMN repo_token_last4 VARCHAR(4) NULL;
