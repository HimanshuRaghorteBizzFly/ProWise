-- Flyway Migration V11: Seed Development Login Accounts for Super Admin, Platform Operator, and Developer

-- 1. Ensure Acme organization exists for Developer workspace
INSERT INTO organizations (id, name, slug, timezone, state, work_calendar)
VALUES (
    '0a000000-0000-4000-8000-00000000000a',
    'Acme Health Tech',
    'acme',
    'America/New_York',
    'ACTIVE',
    '{}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- 2. Seed Super Admin Accounts (Password: SuperAdmin2026!)
INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'superadmin@prowise.com',
    '$2a$10$ABz3pFpyw3NC.JhRjL7fZeF7a1Ua2.N/9U4LaMvYXkmyxmchBuxHy',
    'Super Admin',
    'SUPER_ADMIN',
    'ACTIVE',
    false
)
ON CONFLICT (lower(email)) DO UPDATE
SET role = 'SUPER_ADMIN', name = 'Super Admin', status = 'ACTIVE';

INSERT INTO user_roles (user_id, role_name)
SELECT id, 'SUPER_ADMIN' FROM users WHERE lower(email) = 'superadmin@prowise.com'
ON CONFLICT (user_id, role_name) DO NOTHING;

INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
VALUES (
    '00000000-0000-0000-0000-000000000010',
    'superadmin@prowise.io',
    '$2a$10$ABz3pFpyw3NC.JhRjL7fZeF7a1Ua2.N/9U4LaMvYXkmyxmchBuxHy',
    'Arthur Pendelton',
    'SUPER_ADMIN',
    'ACTIVE',
    false
)
ON CONFLICT (lower(email)) DO UPDATE
SET role = 'SUPER_ADMIN', name = 'Arthur Pendelton', status = 'ACTIVE';

INSERT INTO user_roles (user_id, role_name)
SELECT id, 'SUPER_ADMIN' FROM users WHERE lower(email) = 'superadmin@prowise.io'
ON CONFLICT (user_id, role_name) DO NOTHING;

-- 3. Seed Platform Operator Accounts (Password: Operator2026!)
INSERT INTO users (id, email, password_hash, name, role, department, status, must_change_password)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'operator@prowise.io',
    '$2a$10$Pookry5OLzVHFp7uq7C04ed9EUr/WES2UzKll5CSx3s5.BWS2iH4i',
    'Jordan Mercer',
    'PLATFORM_OPERATOR',
    'site-reliability',
    'ACTIVE',
    false
)
ON CONFLICT (lower(email)) DO UPDATE
SET role = 'PLATFORM_OPERATOR', password_hash = '$2a$10$Pookry5OLzVHFp7uq7C04ed9EUr/WES2UzKll5CSx3s5.BWS2iH4i', status = 'ACTIVE';

INSERT INTO user_roles (user_id, role_name)
SELECT id, 'PLATFORM_OPERATOR' FROM users WHERE lower(email) = 'operator@prowise.io'
ON CONFLICT (user_id, role_name) DO NOTHING;

INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
VALUES (
    '00000000-0000-0000-0000-000000000020',
    'main.operator@prowise.io',
    '$2a$10$Pookry5OLzVHFp7uq7C04ed9EUr/WES2UzKll5CSx3s5.BWS2iH4i',
    'Platform Director',
    'PLATFORM_OPERATOR',
    'ACTIVE',
    false
)
ON CONFLICT (lower(email)) DO UPDATE
SET role = 'PLATFORM_OPERATOR', password_hash = '$2a$10$Pookry5OLzVHFp7uq7C04ed9EUr/WES2UzKll5CSx3s5.BWS2iH4i', status = 'ACTIVE';

INSERT INTO user_roles (user_id, role_name)
SELECT id, 'PLATFORM_OPERATOR' FROM users WHERE lower(email) = 'main.operator@prowise.io'
ON CONFLICT (user_id, role_name) DO NOTHING;

UPDATE platform_operators
SET password_hash = '$2a$10$Pookry5OLzVHFp7uq7C04ed9EUr/WES2UzKll5CSx3s5.BWS2iH4i',
    user_id = '00000000-0000-0000-0000-000000000002'
WHERE email = 'operator@prowise.io';

UPDATE platform_operators
SET password_hash = '$2a$10$Pookry5OLzVHFp7uq7C04ed9EUr/WES2UzKll5CSx3s5.BWS2iH4i',
    user_id = '00000000-0000-0000-0000-000000000020'
WHERE email = 'main.operator@prowise.io';

-- 4. Seed Developer Accounts (Password: Developer2026!)
INSERT INTO users (id, email, password_hash, name, role, organization_id, status, must_change_password)
VALUES (
    '00000000-0000-0000-0000-000000000003',
    'alex.rivera@acmehealth.com',
    '$2a$10$dM.NruQ8EOkAyrfyF/2xa.vOwE5EUD62ahGoiWId4Af6FlbzVu.Mi',
    'Alex Rivera',
    'DEVELOPER',
    '0a000000-0000-4000-8000-00000000000a',
    'ACTIVE',
    false
)
ON CONFLICT (lower(email)) DO UPDATE
SET role = 'DEVELOPER', name = 'Alex Rivera', organization_id = '0a000000-0000-4000-8000-00000000000a', status = 'ACTIVE';

INSERT INTO user_roles (user_id, role_name)
SELECT id, 'DEVELOPER' FROM users WHERE lower(email) = 'alex.rivera@acmehealth.com'
ON CONFLICT (user_id, role_name) DO NOTHING;

INSERT INTO users (id, email, password_hash, name, role, organization_id, status, must_change_password)
VALUES (
    '00000000-0000-0000-0000-000000000030',
    'developer@prowise.com',
    '$2a$10$dM.NruQ8EOkAyrfyF/2xa.vOwE5EUD62ahGoiWId4Af6FlbzVu.Mi',
    'Alex Rivera',
    'DEVELOPER',
    '0a000000-0000-4000-8000-00000000000a',
    'ACTIVE',
    false
)
ON CONFLICT (lower(email)) DO UPDATE
SET role = 'DEVELOPER', name = 'Alex Rivera', organization_id = '0a000000-0000-4000-8000-00000000000a', status = 'ACTIVE';

INSERT INTO user_roles (user_id, role_name)
SELECT id, 'DEVELOPER' FROM users WHERE lower(email) = 'developer@prowise.com'
ON CONFLICT (user_id, role_name) DO NOTHING;

-- Link Developer to Organization Membership
INSERT INTO memberships (id, org_id, user_id, role_template, status)
VALUES (
    '00000000-0000-0000-0000-000000000031',
    '0a000000-0000-4000-8000-00000000000a',
    '00000000-0000-0000-0000-000000000003',
    'DEVELOPER',
    'ACTIVE'
)
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Associate developer to seeded projects
UPDATE projects
SET org_id = '0a000000-0000-4000-8000-00000000000a'
WHERE org_id IS NULL;
