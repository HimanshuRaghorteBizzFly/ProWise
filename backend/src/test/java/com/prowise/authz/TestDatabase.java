package com.prowise.authz;

import org.springframework.jdbc.core.JdbcTemplate;

/** Removes rows created by integration tests (security evidence is append-only, so it is truncated). */
public final class TestDatabase {

    private TestDatabase() {}

    public static void clean(JdbcTemplate jdbc) {
        jdbc.execute("TRUNCATE security_evidence");
        jdbc.update("DELETE FROM password_reset_tokens");
        jdbc.update("DELETE FROM sessions");
        jdbc.update("DELETE FROM grants");
        jdbc.update("DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE NOT is_template)");
        jdbc.update("DELETE FROM roles WHERE NOT is_template");
        jdbc.update("DELETE FROM memberships");
        jdbc.update("DELETE FROM organizations"); // developer tables cascade from organizations
        jdbc.update("DELETE FROM users");
    }
}
