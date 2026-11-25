-- V36: Roles & Permissions Governance (Super Admin), replacing the in-memory role list.
--
-- Rule 12: roles are templates only; a role name grants nothing. What each role can actually do comes from:
--   * Super Admin          -> the PLATFORM_SUPER_ADMIN authority (users.role = 'SUPER_ADMIN'), enforced in code;
--   * Platform Operator    -> operator_department_permissions (V5) + per-operator overrides, enforced by operator auth;
--   * Organization roles   -> role_permissions of the global role templates (V3, V4, V20), reached only through
--                             an org-scoped grant (PermissionService). This page edits those rows directly.
-- platform_role_definitions holds the hierarchy metadata (tier, rank, scope, color, icon) for the governance page.
-- Organization-scope definitions point at their template in `roles`; their permissions are never copied here.
-- platform_role_permissions holds the capability set of platform-scope custom roles, and the documented set of the
-- Platform Operator once a Super Admin edits it (no rows = derived live from department permissions). Both are
-- descriptive: they are not assignable and do not change operator sign-in, which stays with operator departments.
-- Platform (non-tenant) tables: no org_id, same as operator_departments (V5) and platform_operators.

-- 1. A custom template can be deactivated: it is then not listed to tenants, not grantable, and grants of it
--    give no permissions. Only templates can be inactive (tenant-owned roles are deleted instead).
ALTER TABLE roles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE roles ADD CONSTRAINT ck_roles_inactive_only_templates CHECK (is_active OR is_template);

-- 2. Hierarchy metadata.
CREATE TABLE platform_role_definitions (
    id UUID PRIMARY KEY,
    slug VARCHAR(60) NOT NULL,
    name VARCHAR(100) NOT NULL,
    subtitle VARCHAR(120),
    description VARCHAR(1000),
    kind VARCHAR(30) NOT NULL,
    scope VARCHAR(20) NOT NULL,
    tier SMALLINT NOT NULL,
    rank INTEGER,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    color VARCHAR(20) NOT NULL DEFAULT 'blue',
    icon VARCHAR(40) NOT NULL DEFAULT 'Shield',
    template_role_id UUID REFERENCES roles (id),
    created_by VARCHAR(320),
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_prd_kind CHECK (kind IN ('SUPER_ADMIN', 'PLATFORM_OPERATOR', 'ORGANIZATION_TEMPLATE', 'CUSTOM')),
    CONSTRAINT ck_prd_scope CHECK (scope IN ('PLATFORM', 'ORGANIZATION')),
    CONSTRAINT ck_prd_tier CHECK (tier BETWEEN 1 AND 6),
    CONSTRAINT ck_prd_system_kind CHECK (is_system = (kind <> 'CUSTOM')),
    CONSTRAINT ck_prd_system_rank CHECK (is_system = (rank IS NOT NULL)),
    CONSTRAINT ck_prd_system_active CHECK (is_active OR NOT is_system),
    CONSTRAINT ck_prd_org_template CHECK ((scope = 'ORGANIZATION') = (template_role_id IS NOT NULL)),
    CONSTRAINT ck_prd_platform_kinds CHECK (kind NOT IN ('SUPER_ADMIN', 'PLATFORM_OPERATOR') OR scope = 'PLATFORM')
);

CREATE UNIQUE INDEX uq_prd_slug ON platform_role_definitions (lower(slug));
CREATE UNIQUE INDEX uq_prd_template ON platform_role_definitions (template_role_id) WHERE template_role_id IS NOT NULL;
CREATE UNIQUE INDEX uq_prd_single_root_kinds ON platform_role_definitions (kind) WHERE kind IN ('SUPER_ADMIN', 'PLATFORM_OPERATOR');
CREATE UNIQUE INDEX uq_prd_rank ON platform_role_definitions (rank) WHERE rank IS NOT NULL;
CREATE INDEX idx_prd_tier ON platform_role_definitions (tier);

-- 3. Platform-scope capability sets (operator capability keys, never Super Admin authority).
CREATE TABLE platform_role_permissions (
    role_definition_id UUID NOT NULL REFERENCES platform_role_definitions (id) ON DELETE CASCADE,
    capability_key VARCHAR(120) NOT NULL,
    PRIMARY KEY (role_definition_id, capability_key)
);

-- 4. The nine system roles (reference data the application needs, like the V3 templates; no users, no counts).
INSERT INTO platform_role_definitions
    (id, slug, name, subtitle, description, kind, scope, tier, rank, is_system, color, icon, template_role_id)
VALUES
    ('20000000-0000-0000-0000-000000000001', 'super-admin', 'Super Admin', 'Platform Root Authority',
     'Root governance of the whole platform: organizations, platform users, operators, roles, settings, security and audit. Enforced by the platform (PLATFORM_SUPER_ADMIN authority); it always holds every capability and cannot be deactivated, deleted or assigned from this page.',
     'SUPER_ADMIN', 'PLATFORM', 1, 1, TRUE, 'amber', 'ShieldAlert', NULL),
    ('20000000-0000-0000-0000-000000000002', 'platform-operator', 'Platform Operator', 'Delegated Operations & SRE',
     'Operational oversight without tenant data access: monitoring, incidents, support, integrations, communications and billing operations. Main Platform Operators hold every operator capability; Department Operators hold their department''s set (managed under Operators).',
     'PLATFORM_OPERATOR', 'PLATFORM', 1, 2, TRUE, 'blue', 'Activity', NULL),
    ('20000000-0000-0000-0000-000000000003', 'organization-owner', 'Organization Owner', 'Tenant Ownership & Billing',
     'Accountable owner of one organization: settings, members, roles, teams, projects and audit inside that tenant. Exactly one owner per organization; ownership moves only by transfer.',
     'ORGANIZATION_TEMPLATE', 'ORGANIZATION', 2, 3, TRUE, 'violet', 'Building2', '10000000-0000-0000-0000-000000000001'),
    ('20000000-0000-0000-0000-000000000004', 'organization-admin', 'Organization Admin', 'Workspace & Member Delegation',
     'Runs the workspace for the owner: invites and disables members, manages roles and teams, creates projects and connects repositories.',
     'ORGANIZATION_TEMPLATE', 'ORGANIZATION', 2, 4, TRUE, 'indigo', 'Briefcase', '10000000-0000-0000-0000-000000000002'),
    ('20000000-0000-0000-0000-000000000005', 'project-manager', 'Project Manager', 'Milestones, Scope & Delivery',
     'Plans and steers delivery: project setup, mode, scope changes, deadlines, task creation and assignment, report exports.',
     'ORGANIZATION_TEMPLATE', 'ORGANIZATION', 3, 5, TRUE, 'emerald', 'Calendar', '10000000-0000-0000-0000-000000000003'),
    ('20000000-0000-0000-0000-000000000006', 'team-lead', 'Team Lead', 'Workload & Review Coordination',
     'Coordinates a team''s work: manages teams, creates and assigns tasks and approves or rejects progress check-ins.',
     'ORGANIZATION_TEMPLATE', 'ORGANIZATION', 3, 6, TRUE, 'teal', 'Users', '10000000-0000-0000-0000-000000000004'),
    ('20000000-0000-0000-0000-000000000007', 'developer', 'Developer', 'Task Implementation & Check-ins',
     'Implements the work: updates tasks, edits project details and reports progress through check-ins. Git activity is evidence only.',
     'ORGANIZATION_TEMPLATE', 'ORGANIZATION', 4, 7, TRUE, 'sky', 'Code', '10000000-0000-0000-0000-000000000005'),
    ('20000000-0000-0000-0000-000000000008', 'qa-reviewer', 'QA / Reviewer', 'Verification & Acceptance Testing',
     'Verifies delivered work: reads projects and reviews submitted tasks (accept or send back for rework).',
     'ORGANIZATION_TEMPLATE', 'ORGANIZATION', 4, 8, TRUE, 'rose', 'CheckCircle2', '10000000-0000-0000-0000-000000000006'),
    ('20000000-0000-0000-0000-000000000009', 'viewer', 'Viewer', 'Read-Only Dashboards & Progress',
     'Stakeholder visibility: reads projects and their progress without changing anything.',
     'ORGANIZATION_TEMPLATE', 'ORGANIZATION', 5, 9, TRUE, 'slate', 'Eye', '10000000-0000-0000-0000-000000000007');
