package com.prowise.authz;

import org.springframework.jdbc.core.JdbcTemplate;

/** Removes rows created by integration tests (security evidence is append-only, so it is truncated). */
public final class TestDatabase {

    private TestDatabase() {}

    public static void clean(JdbcTemplate jdbc) {
        // Task 1.4: audit_log is append-only too, and outbox rows reference organizations.
        jdbc.execute("TRUNCATE security_evidence, audit_log, processed_event, outbox_event, idempotency_key");
        // Task 1.2 people history/teams/invitations and task 2.1 projects in one statement: they reference each other.
        jdbc.execute("TRUNCATE project_date_history, project_members, projects, membership_history, ownership_history,"
                + " handover_items, team_members, invitations, teams CASCADE");
        jdbc.update("DELETE FROM password_reset_tokens");
        jdbc.update("DELETE FROM sessions");
        jdbc.update("DELETE FROM grants");
        // Task 1.5 governance: custom roles (global templates) created by tests; system definitions stay.
        jdbc.update("DELETE FROM platform_role_permissions");
        jdbc.update("""
                DELETE FROM role_permissions WHERE role_id IN
                    (SELECT template_role_id FROM platform_role_definitions WHERE NOT is_system AND template_role_id IS NOT NULL)
                """);
        jdbc.update("""
                DELETE FROM role_templates WHERE role_id IN
                    (SELECT template_role_id FROM platform_role_definitions WHERE NOT is_system AND template_role_id IS NOT NULL)
                """);
        jdbc.update("""
                WITH removed AS (DELETE FROM platform_role_definitions WHERE NOT is_system RETURNING template_role_id)
                DELETE FROM roles WHERE id IN (SELECT template_role_id FROM removed WHERE template_role_id IS NOT NULL)
                """);
        jdbc.update("DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE NOT is_template)");
        jdbc.update("DELETE FROM roles WHERE NOT is_template");
        jdbc.update("DELETE FROM memberships");
        jdbc.update("DELETE FROM organizations"); // developer tables cascade from organizations
        jdbc.update("DELETE FROM users");
    }
}
