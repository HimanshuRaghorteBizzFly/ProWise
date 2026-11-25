-- =============================================================================
-- DEVELOPMENT-ONLY SEED DATA (NEVER RUN IN PRODUCTION)
-- =============================================================================
-- Seeds the "example" development organization and 6 direct-login demo users
-- with must_change_password = false, active memberships, user_roles, and ORG
-- grants so you can sign in directly to each role dashboard.
--
-- Prerequisites:
--   1. Flyway migrations (V1..V37+) have already been applied to the database.
--   2. Run manually only in local/development environments:
--        psql "postgresql://prowise:prowise-dev-password@localhost:5432/prowise" -v ON_ERROR_STOP=1 -f database/seed/dev_seed_logins.sql
-- =============================================================================

BEGIN;

DO $$
DECLARE
    v_org_id          UUID := '6cea41af-fffd-4160-9e01-59e7d88e144d';
    v_existing_org_id UUID;
    v_owner_id        UUID;
    v_user_id         UUID;
    v_membership_id   UUID;
    v_template_role   UUID;
    v_owner_tpl_id    UUID := '10000000-0000-0000-0000-000000000001';
    v_existing_grant  UUID;
    rec               RECORD;
BEGIN
    -- 1. Ensure organization exists (reuse by id or slug if already present).
    SELECT id INTO v_existing_org_id
    FROM organizations
    WHERE id = v_org_id OR slug = 'example'
    ORDER BY (id = v_org_id) DESC
    LIMIT 1;

    IF v_existing_org_id IS NULL THEN
        INSERT INTO organizations (
            id, name, slug, timezone, work_calendar, state, owner_name, owner_email
        ) VALUES (
            v_org_id, 'example', 'example', 'Asia/Kolkata', '{}'::jsonb, 'ACTIVE',
            'Dipak Chavan', 'dc741094@gmail.com'
        );
    ELSE
        v_org_id := v_existing_org_id;
        UPDATE organizations
        SET name        = 'example',
            state       = 'ACTIVE',
            owner_name  = COALESCE(NULLIF(owner_name, ''), 'Dipak Chavan'),
            owner_email = COALESCE(NULLIF(owner_email, ''), 'dc741094@gmail.com'),
            updated_at  = now()
        WHERE id = v_org_id;
    END IF;

    -- 2. Seed all 6 direct-login users (Owner first so granted_by can reference v_owner_id).
    FOR rec IN
        SELECT * FROM (VALUES
            (
                '11111111-1111-4111-8111-111111111101'::uuid,
                'dc741094@gmail.com',
                '$2a$10$fDmqSvlNN0HwXv7qcF0U2exx.Pb.OnApHkZmOqKt5h6JLnofzCp/y', -- Owner@Pwise2026
                'Dipak Chavan',
                'ORGANIZATION_OWNER',
                'Executive'
            ),
            (
                '11111111-1111-4111-8111-111111111102'::uuid,
                'orgadmin@pwise.demo',
                '$2a$10$mTDCDwOCU7jv4vPfxl6iSeV5dEaxE/TfwC72SavNNIwR6mrBtXpH.', -- Admin@Pwise2026
                'Organization Admin',
                'ORGANIZATION_ADMIN',
                'Administration'
            ),
            (
                '11111111-1111-4111-8111-111111111103'::uuid,
                'manager@pwise.demo',
                '$2a$10$WdU/BF4dXXbKFhEh.Q1LSepXxmQGxjb2W8vcdyeMe9TcOsa2g/UgG', -- Manager@Pwise2026
                'Project Manager',
                'PROJECT_MANAGER',
                'Project Management'
            ),
            (
                '11111111-1111-4111-8111-111111111104'::uuid,
                'teamlead@pwise.demo',
                '$2a$10$TMWe4bNjqf6X6bhFKv1xqOqLG2jUFbZeGwhjcUpUfBbGuO7/Rff9y', -- TeamLead@Pwise2026
                'Team Lead',
                'TEAM_LEAD',
                'Engineering'
            ),
            (
                '11111111-1111-4111-8111-111111111105'::uuid,
                'developer@pwise.demo',
                '$2a$10$y4ycVfXYY7FAXmU2bKtw1Of/VFypWErU4Wxe6e.n3SlwDm1H5urKW', -- Developer@Pwise2026
                'Developer',
                'DEVELOPER',
                'Engineering'
            ),
            (
                '11111111-1111-4111-8111-111111111106'::uuid,
                'qa@pwise.demo',
                '$2a$10$egFce4OYRPxVYhgms9aJPOQyOedqNPy2jrxpM7gTjbufr/dHNSPNq', -- QA@Pwise2026
                'QA Reviewer',
                'QA_REVIEWER',
                'Quality Assurance'
            )
        ) AS t(default_id, email, password_hash, full_name, role_name, department)
    LOOP
        SELECT id INTO v_user_id
        FROM users
        WHERE lower(email) = lower(rec.email)
        LIMIT 1;

        IF v_user_id IS NULL THEN
            v_user_id := rec.default_id;
            INSERT INTO users (
                id, email, password_hash, status, name, role, department,
                organization_id, must_change_password, failed_login_count, locked_until
            ) VALUES (
                v_user_id, lower(rec.email), rec.password_hash, 'ACTIVE', rec.full_name,
                rec.role_name, rec.department, v_org_id, false, 0, NULL
            );
        ELSE
            UPDATE users
            SET password_hash        = rec.password_hash,
                status               = 'ACTIVE',
                name                 = rec.full_name,
                role                 = rec.role_name,
                department           = rec.department,
                organization_id      = v_org_id,
                must_change_password = false,
                failed_login_count   = 0,
                locked_until         = NULL,
                updated_at           = now()
            WHERE id = v_user_id;
        END IF;

        IF rec.role_name = 'ORGANIZATION_OWNER' THEN
            v_owner_id := v_user_id;
        END IF;

        -- user_roles
        INSERT INTO user_roles (user_id, role_name)
        VALUES (v_user_id, rec.role_name)
        ON CONFLICT (user_id, role_name) DO NOTHING;

        -- membership
        SELECT id INTO v_membership_id
        FROM memberships
        WHERE org_id = v_org_id AND user_id = v_user_id
        LIMIT 1;

        IF v_membership_id IS NULL THEN
            v_membership_id := gen_random_uuid();
            INSERT INTO memberships (id, org_id, user_id, role_template, status)
            VALUES (v_membership_id, v_org_id, v_user_id, rec.role_name, 'ACTIVE');
        ELSE
            UPDATE memberships
            SET role_template = rec.role_name,
                status        = 'ACTIVE',
                updated_at    = now()
            WHERE id = v_membership_id;
        END IF;

        -- grant (ORG scope via role template)
        SELECT id INTO v_template_role
        FROM roles
        WHERE name = rec.role_name AND is_template = true
        LIMIT 1;

        IF v_template_role IS NULL THEN
            RAISE EXCEPTION 'Missing template role: %', rec.role_name;
        END IF;

        IF v_template_role = v_owner_tpl_id THEN
            SELECT id INTO v_existing_grant
            FROM grants
            WHERE org_id = v_org_id AND template_role_id = v_owner_tpl_id
            LIMIT 1;

            IF v_existing_grant IS NOT NULL THEN
                UPDATE grants
                SET membership_id = v_membership_id,
                    granted_by    = v_owner_id,
                    updated_at    = now()
                WHERE id = v_existing_grant;
            ELSE
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (gen_random_uuid(), v_org_id, v_membership_id, v_template_role, 'ORG', v_owner_id);
            END IF;
        ELSE
            IF NOT EXISTS (
                SELECT 1 FROM grants
                WHERE org_id = v_org_id
                  AND membership_id = v_membership_id
                  AND template_role_id = v_template_role
                  AND scope = 'ORG'
            ) THEN
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (gen_random_uuid(), v_org_id, v_membership_id, v_template_role, 'ORG', v_owner_id);
            END IF;
        END IF;
    END LOOP;
END $$;

COMMIT;
