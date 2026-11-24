package com.prowise.testsupport;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;

/** Signed-in Super Admin and operator sessions for operator console tests (rows are removed by {@link #cleanup}). */
public final class ConsoleSessions {

    public static final String PASSWORD = "Console-Test-Pass-123";

    private ConsoleSessions() {}

    public static String superAdmin(MockMvc mvc, JdbcTemplate jdbc, PasswordEncoder encoder, ObjectMapper mapper)
            throws Exception {
        String email = "console-admin-" + UUID.randomUUID().toString().substring(0, 8) + "@test.prowise";
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, 'Console Admin', 'SUPER_ADMIN', 'ACTIVE', false)
                """, id, email, encoder.encode(PASSWORD));
        jdbc.update("INSERT INTO user_roles (user_id, role_name) VALUES (?, 'SUPER_ADMIN')", id);
        String body = mvc.perform(post("/v1/auth/login").with(TestAccounts.randomClient()).contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).path("access_token").asText();
    }

    /** Inserts an ACTIVE operator (id prefix "op-cs-") and signs it in; returns the access token. */
    public static String operator(MockMvc mvc, JdbcTemplate jdbc, PasswordEncoder encoder, ObjectMapper mapper,
            String id, String accessLevel, String department) throws Exception {
        String email = id + "@console.test";
        jdbc.update("""
                INSERT INTO platform_operators (id, name, email, role_id, access_level, department_id, status,
                    password_hash, password_setup_completed)
                VALUES (?, ?, ?, 'role-platform-operator', ?, ?, 'ACTIVE', ?, true)
                """, id, id, email, accessLevel, department, encoder.encode(PASSWORD));
        String body = mvc.perform(post("/v1/auth/operator/login").with(TestAccounts.randomClient())
                        .contentType("application/json")
                        .content(mapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).path("access_token").asText();
    }

    public static String operatorId(String label) {
        return "op-cs-" + label + "-" + UUID.randomUUID().toString().substring(0, 6);
    }

    /** Empties the operator console stores so every test starts from real zeros. */
    public static void cleanup(JdbcTemplate jdbc) {
        jdbc.update("DELETE FROM operator_permission_overrides WHERE operator_id LIKE 'op-cs-%'");
        jdbc.update("DELETE FROM platform_operators WHERE id LIKE 'op-cs-%'");
        jdbc.update("DELETE FROM operator_activity_logs");
        jdbc.update("DELETE FROM operator_audit_logs");
        jdbc.update("DELETE FROM api_error_logs");
        jdbc.update("DELETE FROM backup_runs");
        jdbc.update("DELETE FROM operator_email_drafts");
        jdbc.update("DELETE FROM announcements");
        jdbc.update("DELETE FROM incident_assignments");
        jdbc.update("DELETE FROM incidents");
        jdbc.update("DELETE FROM support_access_requests");
        jdbc.update("DELETE FROM support_tickets");
        jdbc.update("DELETE FROM operational_alerts");
        jdbc.update("DELETE FROM background_jobs");
        jdbc.update("DELETE FROM webhook_receipts");
        jdbc.update("DELETE FROM maintenance_windows");
        jdbc.update("DELETE FROM email_delivery_logs");
        jdbc.update("DELETE FROM invoices");
        jdbc.update("DELETE FROM payments");
        jdbc.update("DELETE FROM subscriptions");
        jdbc.update("DELETE FROM plans WHERE id LIKE 'plan-cs-%'");
    }
}
