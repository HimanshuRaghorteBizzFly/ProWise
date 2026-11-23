-- READ-ONLY preview for migration V18 (disable published seed credentials). Changes nothing.
-- Run it against a shared or production database BEFORE deploying V18, for example:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/scripts/preview_v18_seed_credentials.sql
--
-- V18 itself decides with BCrypt, which plain SQL cannot evaluate here. This script lists every row V18 will
-- examine and flags those whose hash is byte-identical to a hash published in migrations V7, V9, V10 or V11.
-- Rows re-hashed by the old development initializer carry a different salt, so they show
-- published_migration_hash = false but may still match a published password; V18 checks those with BCrypt.
-- Rows that V18 does not match are left untouched.
BEGIN TRANSACTION READ ONLY;

SELECT 'users' AS source,
       u.id::text AS id,
       lower(u.email) AS email,
       u.role,
       u.status,
       u.password_hash IN (
           '$2a$10$ABz3pFpyw3NC.JhRjL7fZeF7a1Ua2.N/9U4LaMvYXkmyxmchBuxHy',  -- SuperAdmin2026! (V10, V11)
           '$2a$10$Pookry5OLzVHFp7uq7C04ed9EUr/WES2UzKll5CSx3s5.BWS2iH4i',  -- Operator2026!   (V11)
           '$2a$10$dM.NruQ8EOkAyrfyF/2xa.vOwE5EUD62ahGoiWId4Af6FlbzVu.Mi'   -- Developer2026!  (V11)
       ) AS published_migration_hash,
       (SELECT count(*) FROM sessions s WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now())
           AS open_sessions
FROM users u
WHERE lower(u.email) IN (
    'superadmin@prowise.com', 'superadmin@prowise.io', 'operator@prowise.io', 'main.operator@prowise.io',
    'alex.rivera@acmehealth.com', 'developer@prowise.com', 'dr.sarah.lin@acmehealth.com',
    'david.kim@acmehealth.com', 'priya.raman@acmehealth.com', 'marcus.chen@acmehealth.com',
    'elena.ruiz@acmehealth.com', 'jordan.lee@acmehealth.com')
ORDER BY email;

SELECT 'platform_operators' AS source,
       o.id,
       lower(o.email) AS email,
       o.access_level,
       o.department_id,
       o.status,
       o.password_setup_completed,
       o.password_hash = '$2a$10$4b0rjVL9OrfiXT2yXc11c.x5Q.wK12FsTd/UzkoOtp2GKu7ujVdQK' AS published_migration_hash, -- Operator2026! (V7, V9)
       (SELECT count(*) FROM operator_sessions s WHERE s.operator_id = o.id AND NOT s.revoked AND s.expires_at > now())
           AS open_sessions
FROM platform_operators o
ORDER BY o.id;

-- Accounts that are NOT seeded and would remain the only active Super Admins after V18.
SELECT id, lower(email) AS email, status
FROM users
WHERE upper(role) = 'SUPER_ADMIN'
  AND lower(email) NOT IN ('superadmin@prowise.com', 'superadmin@prowise.io')
ORDER BY email;

ROLLBACK;
