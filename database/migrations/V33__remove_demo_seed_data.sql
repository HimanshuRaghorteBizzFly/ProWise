-- V33: Remove demo data inserted by earlier migrations (owner decision 2026-11-24: the product shows only real data).
-- Applied migrations are never edited (rule 7); this deletes exactly the rows they seeded, matched by their fixed
-- seeded IDs, children before parents. Reference data the application needs stays: role templates and
-- permissions (V3, V4, V20), operator departments and department permissions (V5), default calendar settings (V18),
-- and neutral defaults from V6 (feature flags, branding, policies, default email templates).

-- ---------------------------------------------------------------- V8 developer panel demo content
DELETE FROM discussion_messages      WHERE id IN ('msg-1', 'msg-2');
DELETE FROM discussions              WHERE id IN ('disc-1', 'disc-2');
DELETE FROM developer_notifications  WHERE id IN ('notif-1', 'notif-2', 'notif-3', 'notif-4');
DELETE FROM task_blockers            WHERE id IN ('blk-1');
DELETE FROM code_reviews             WHERE id IN ('rev-1', 'rev-2');
DELETE FROM bugs                     WHERE id IN ('bug-1', 'bug-2');
DELETE FROM file_metadata            WHERE id IN ('file-1', 'file-2');
DELETE FROM github_activity          WHERE id IN ('gh-1', 'gh-2', 'gh-3');
DELETE FROM calendar_events          WHERE id IN ('cal-1', 'cal-2', 'cal-3');
-- Check-ins are append-only (V20 trigger). The only exception ever made: the two demo rows V8 seeded are removed
-- with the guard lifted inside this migration's transaction and restored immediately after.
ALTER TABLE project_progress_checkins DISABLE TRIGGER trg_checkins_append_only;
DELETE FROM project_progress_checkins WHERE id IN ('chk-0', 'chk-1');
ALTER TABLE project_progress_checkins ENABLE TRIGGER trg_checkins_append_only;
DELETE FROM work_items               WHERE id IN ('task-101', 'task-102', 'task-103', 'task-104', 'task-105', 'task-201');
DELETE FROM sprints                  WHERE id IN ('sprint-crm-24', 'sprint-cloud-12');
DELETE FROM developer_preferences    WHERE user_id = 'usr-developer';
DELETE FROM projects                 WHERE id IN ('proj-individual-solo', 'proj-structured-cds', 'proj-cloud-sync');

-- ---------------------------------------------------------------- V9 operator console demo content
DELETE FROM webhook_receipts         WHERE id IN ('wh-901', 'wh-902');
DELETE FROM background_jobs          WHERE id IN ('job-1', 'job-2');
DELETE FROM operational_alerts       WHERE id IN ('alt-1', 'alt-2');
DELETE FROM support_tickets          WHERE id IN ('tkt-501', 'tkt-502');
DELETE FROM incidents                WHERE id IN ('inc-101', 'inc-102');
DELETE FROM integration_installations WHERE id IN ('int-gh-1', 'int-stripe-1', 'int-smtp-1');

-- ---------------------------------------------------------------- V5 / V9 demo platform operators
-- Invitations, sessions and password resets cascade (ON DELETE CASCADE).
DELETE FROM platform_operators WHERE id IN ('op-1', 'op-2', 'op-3', 'op-4', 'op-5', 'op-6', 'op-7', 'op-8', 'op-main-1');

-- ---------------------------------------------------------------- V11 seeded Super Admin account
-- Its password was published in this repository (V22 disabled it). The first real Super Admin comes only from
-- PROWISE_BOOTSTRAP_SUPER_ADMIN_EMAIL (+ optional PROWISE_BOOTSTRAP_SUPER_ADMIN_PASSWORD).
DELETE FROM user_roles            WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM sessions              WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM password_reset_tokens WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM users WHERE id = '00000000-0000-0000-0000-000000000001' AND lower(email) = 'superadmin@prowise.com';

-- ---------------------------------------------------------------- V6 demo billing plans (billing is dormant)
DELETE FROM plan_features WHERE plan_id IN ('plan-free', 'plan-starter', 'plan-pro', 'plan-enterprise');
DELETE FROM plans WHERE id IN ('plan-free', 'plan-starter', 'plan-pro', 'plan-enterprise');

-- ---------------------------------------------------------------- V6 placeholder SMTP row
-- Only while it still holds the untouched seed values; a Super Admin's saved settings are never removed.
-- The service recreates an empty settings row on demand.
DELETE FROM email_providers
WHERE id = 'provider-default' AND admin_configured = false
  AND host = 'smtp.sendgrid.net' AND username = 'apikey' AND password_encrypted IS NULL;
