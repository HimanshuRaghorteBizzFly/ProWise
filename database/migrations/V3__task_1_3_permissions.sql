CREATE TABLE roles (
    id UUID PRIMARY KEY,
    org_id UUID REFERENCES organizations (id),
    name VARCHAR(100) NOT NULL,
    is_template BOOLEAN NOT NULL DEFAULT FALSE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_roles_template_org CHECK (
        (is_template AND org_id IS NULL) OR (NOT is_template AND org_id IS NOT NULL)
    ),
    CONSTRAINT uq_roles_org_id_id UNIQUE (org_id, id)
);

CREATE UNIQUE INDEX uq_roles_template_name
    ON roles (name) WHERE is_template;
CREATE UNIQUE INDEX uq_roles_org_name
    ON roles (org_id, name) WHERE NOT is_template;
CREATE INDEX idx_roles_org_id ON roles (org_id);

CREATE TABLE role_templates (
    role_id UUID PRIMARY KEY REFERENCES roles (id),
    CONSTRAINT fk_role_templates_only_templates
        FOREIGN KEY (role_id) REFERENCES roles (id)
);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles (id),
    permission_key VARCHAR(80) NOT NULL,
    PRIMARY KEY (role_id, permission_key)
);

ALTER TABLE memberships
    ADD CONSTRAINT uq_memberships_org_id_id UNIQUE (org_id, id);

CREATE TABLE grants (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id),
    membership_id UUID NOT NULL,
    template_role_id UUID NULL REFERENCES role_templates (role_id),
    org_role_id UUID NULL,
    scope VARCHAR(20) NOT NULL,
    scope_id UUID NULL,
    expires_at TIMESTAMPTZ NULL,
    granted_by UUID NOT NULL REFERENCES users (id),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_grants_membership_org
        FOREIGN KEY (org_id, membership_id) REFERENCES memberships (org_id, id),
    CONSTRAINT fk_grants_org_role_org
        FOREIGN KEY (org_id, org_role_id) REFERENCES roles (org_id, id),
    CONSTRAINT ck_grants_exactly_one_role CHECK (
        (template_role_id IS NOT NULL AND org_role_id IS NULL)
        OR (template_role_id IS NULL AND org_role_id IS NOT NULL)
    ),
    CONSTRAINT ck_grants_scope CHECK (scope IN ('ORG', 'PROJECT')),
    CONSTRAINT ck_grants_scope_id CHECK (
        (scope = 'ORG' AND scope_id IS NULL)
        OR (scope = 'PROJECT' AND scope_id IS NOT NULL)
    )
);

CREATE INDEX idx_grants_org_membership ON grants (org_id, membership_id);
CREATE INDEX idx_grants_org_role ON grants (org_id, org_role_id);
CREATE INDEX idx_grants_org_scope ON grants (org_id, scope, scope_id);

CREATE TABLE security_evidence (
    id UUID PRIMARY KEY,
    org_id UUID NOT NULL REFERENCES organizations (id),
    actor_id UUID REFERENCES users (id),
    event_type VARCHAR(80) NOT NULL,
    target_type VARCHAR(80) NOT NULL,
    target_id UUID,
    request_id VARCHAR(100),
    reason VARCHAR(200) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_evidence_org_time
    ON security_evidence (org_id, occurred_at);
CREATE INDEX idx_security_evidence_org_target
    ON security_evidence (org_id, target_type, target_id);

INSERT INTO roles (id, name, is_template)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'ORGANIZATION_OWNER', TRUE),
    ('10000000-0000-0000-0000-000000000002', 'ORGANIZATION_ADMIN', TRUE),
    ('10000000-0000-0000-0000-000000000003', 'PROJECT_MANAGER', TRUE),
    ('10000000-0000-0000-0000-000000000004', 'TEAM_LEAD', TRUE),
    ('10000000-0000-0000-0000-000000000005', 'DEVELOPER', TRUE),
    ('10000000-0000-0000-0000-000000000006', 'QA_REVIEWER', TRUE),
    ('10000000-0000-0000-0000-000000000007', 'VIEWER', TRUE),
    ('10000000-0000-0000-0000-000000000008', 'PLATFORM_OPERATOR', TRUE);

INSERT INTO role_templates (role_id)
SELECT id FROM roles WHERE is_template;

INSERT INTO role_permissions (role_id, permission_key)
SELECT r.id, p.permission_key
FROM roles r
JOIN (VALUES
    ('ORGANIZATION_OWNER', 'org.manage'),
    ('ORGANIZATION_OWNER', 'member.invite'),
    ('ORGANIZATION_OWNER', 'member.disable'),
    ('ORGANIZATION_OWNER', 'role.manage'),
    ('ORGANIZATION_OWNER', 'team.manage'),
    ('ORGANIZATION_OWNER', 'project.create'),
    ('ORGANIZATION_OWNER', 'project.read'),
    ('ORGANIZATION_OWNER', 'project.edit'),
    ('ORGANIZATION_OWNER', 'project.archive'),
    ('ORGANIZATION_OWNER', 'project.mode.change'),
    ('ORGANIZATION_OWNER', 'project.scope.change'),
    ('ORGANIZATION_OWNER', 'project.deadline.edit'),
    ('ORGANIZATION_OWNER', 'project.progress.report'),
    ('ORGANIZATION_OWNER', 'task.create'),
    ('ORGANIZATION_OWNER', 'task.assign'),
    ('ORGANIZATION_OWNER', 'task.update'),
    ('ORGANIZATION_OWNER', 'task.review'),
    ('ORGANIZATION_OWNER', 'repo.connect'),
    ('ORGANIZATION_OWNER', 'repo.read'),
    ('ORGANIZATION_OWNER', 'report.export'),
    ('ORGANIZATION_OWNER', 'audit.read'),
    ('ORGANIZATION_ADMIN', 'member.invite'),
    ('ORGANIZATION_ADMIN', 'member.disable'),
    ('ORGANIZATION_ADMIN', 'role.manage'),
    ('ORGANIZATION_ADMIN', 'team.manage'),
    ('ORGANIZATION_ADMIN', 'project.create'),
    ('ORGANIZATION_ADMIN', 'project.read'),
    ('ORGANIZATION_ADMIN', 'repo.connect'),
    ('ORGANIZATION_ADMIN', 'repo.read'),
    ('ORGANIZATION_ADMIN', 'report.export'),
    ('ORGANIZATION_ADMIN', 'audit.read'),
    ('PROJECT_MANAGER', 'project.create'),
    ('PROJECT_MANAGER', 'project.read'),
    ('PROJECT_MANAGER', 'project.edit'),
    ('PROJECT_MANAGER', 'project.mode.change'),
    ('PROJECT_MANAGER', 'project.scope.change'),
    ('PROJECT_MANAGER', 'project.deadline.edit'),
    ('PROJECT_MANAGER', 'task.create'),
    ('PROJECT_MANAGER', 'task.assign'),
    ('PROJECT_MANAGER', 'task.update'),
    ('PROJECT_MANAGER', 'repo.read'),
    ('PROJECT_MANAGER', 'report.export'),
    ('TEAM_LEAD', 'team.manage'),
    ('TEAM_LEAD', 'project.read'),
    ('TEAM_LEAD', 'task.create'),
    ('TEAM_LEAD', 'task.assign'),
    ('TEAM_LEAD', 'task.update'),
    ('TEAM_LEAD', 'repo.read'),
    ('DEVELOPER', 'project.read'),
    ('DEVELOPER', 'project.edit'),
    ('DEVELOPER', 'task.update'),
    ('DEVELOPER', 'repo.read'),
    ('DEVELOPER', 'project.progress.report'),
    ('QA_REVIEWER', 'project.read'),
    ('QA_REVIEWER', 'task.review'),
    ('VIEWER', 'project.read')
) AS p(role_name, permission_key) ON p.role_name = r.name;

