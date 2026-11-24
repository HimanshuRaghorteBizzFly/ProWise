package com.prowise.superadmin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.identity.PublishedSeedCredentials;
import com.prowise.identity.RequestThrottle;

/**
 * The Super Admin read models over real data: GET /v1/admin/reports/overview, GET /v1/admin/security/overview and
 * GET/PUT /v1/admin/integration-settings. Values must match the inserted rows; an empty platform gives zeros and
 * empty lists, never estimates.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T05")
@Tag("NFR-06")
class SuperAdminInsightsIntegrationTest {

    private static final String PASSWORD = "Insights-Pass-01!";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private RequestThrottle throttle;

    private String adminEmail;
    private String token;

    @BeforeEach
    void setUp() throws Exception {
        jdbc.update("DELETE FROM user_login_history");
        jdbc.update("DELETE FROM operator_login_history");
        jdbc.update("DELETE FROM user_roles");
        jdbc.update("DELETE FROM admin_audit_logs");
        jdbc.update("DELETE FROM license_keys");
        jdbc.update("DELETE FROM platform_integration_settings");
        jdbc.update("DELETE FROM operator_sessions WHERE operator_id LIKE 'it-%'");
        jdbc.update("DELETE FROM platform_operators WHERE id LIKE 'it-%'");
        TestDatabase.clean(jdbc); // organizations cascade to subscriptions, invoices and payments
        jdbc.update("DELETE FROM plan_features WHERE plan_id LIKE 'it-%'");
        jdbc.update("DELETE FROM plans WHERE id LIKE 'it-%'");
        throttle.clear();

        adminEmail = "insights." + UUID.randomUUID().toString().substring(0, 8) + "@prowise.test";
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, 'Insights Admin', 'SUPER_ADMIN', 'ACTIVE', false)
                """, id, adminEmail, passwordEncoder.encode(PASSWORD));
        jdbc.update("INSERT INTO user_roles (user_id, role_name) VALUES (?, 'SUPER_ADMIN')", id);
        token = login();
        // The sign-in above is real data too; start every test from an empty history.
        jdbc.update("DELETE FROM user_login_history");
        jdbc.update("DELETE FROM admin_audit_logs");
    }

    // ---------------------------------------------------------------- reports

    @Test
    void anEmptyPlatformReportsZerosAndEmptyLists() throws Exception {
        JsonNode report = getJson("/v1/admin/reports/overview");
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        assertThat(report.at("/range/to").asText()).isEqualTo(today.toString());
        assertThat(report.at("/range/from").asText()).isEqualTo(today.minusMonths(12).plusDays(1).toString());

        assertThat(report.at("/organizations/total").asLong()).isZero();
        assertThat(report.at("/organizations/active").asLong()).isZero();
        assertThat(report.at("/organizations/trial").asLong()).isZero();
        assertThat(report.at("/organizations/suspended").asLong()).isZero();
        assertThat(report.at("/organizations/created_by_month")).isEmpty();
        assertThat(report.at("/users/total").asLong()).as("only the signed-in Super Admin exists").isEqualTo(1);
        assertThat(report.at("/subscriptions/by_status")).isEmpty();
        assertThat(report.at("/subscriptions/by_plan")).isEmpty();
        assertThat(report.at("/subscriptions/mrr").decimalValue()).isZero();
        assertThat(report.at("/subscriptions/arr").decimalValue()).isZero();
        assertThat(report.at("/invoices/by_status")).isEmpty();
        assertThat(report.at("/invoices/billed_total").decimalValue()).isZero();
        assertThat(report.at("/invoices/paid_total").decimalValue()).isZero();
        assertThat(report.at("/invoices/outstanding_total").decimalValue()).isZero();
        assertThat(report.at("/payments/succeeded_total").decimalValue()).isZero();
        assertThat(report.at("/payments/refunded_total").decimalValue()).isZero();
        assertThat(report.at("/payments/failed_count").asLong()).isZero();
        assertThat(report.at("/audit/by_category")).isEmpty();
        assertThat(report.at("/audit/by_day")).isEmpty();
        assertThat(report.at("/logins/by_day")).isEmpty();
    }

    @Test
    void reportValuesMatchTheInsertedRows() throws Exception {
        UUID active = org("it-active", "ACTIVE", "2026-03-10T12:00:00Z");
        UUID suspended = org("it-suspended", "SUSPENDED", "2026-03-20T12:00:00Z");
        org("it-old", "ACTIVE", "2020-01-01T00:00:00Z"); // outside the range: counted in totals only
        jdbc.update("INSERT INTO plans (id, code, name, monthly_price, annual_price) VALUES ('it-plan', 'IT_PLAN', 'IT Plan', 100, 1200)");
        jdbc.update("INSERT INTO subscriptions (id, org_id, plan_id, billing_cycle, status, amount) VALUES "
                + "('it-s1', ?, 'it-plan', 'MONTHLY', 'ACTIVE', 100), ('it-s2', ?, 'it-plan', 'ANNUAL', 'ACTIVE', 1200), "
                + "('it-s3', ?, 'it-plan', 'MONTHLY', 'TRIALING', 0)", active, suspended, suspended);
        jdbc.update("INSERT INTO invoices (id, invoice_number, org_id, issue_date, status, total) VALUES "
                + "('it-i1', 'IT-1', ?, '2026-04-01', 'PAID', 300), ('it-i2', 'IT-2', ?, '2026-04-02', 'OPEN', 50), "
                + "('it-i3', 'IT-3', ?, '2026-04-03', 'VOID', 999), ('it-i4', 'IT-4', ?, '2019-04-03', 'PAID', 7)",
                active, active, active, active);
        jdbc.update("INSERT INTO payments (id, transaction_ref, org_id, amount, refunded_amount, status, description, created_at) VALUES "
                + "('it-p1', 'IT-T1', ?, 300, 0, 'SUCCEEDED', 'a', '2026-04-01T10:00:00Z'), "
                + "('it-p2', 'IT-T2', ?, 80, 30, 'PARTIALLY_REFUNDED', 'b', '2026-04-02T10:00:00Z'), "
                + "('it-p3', 'IT-T3', ?, 40, 0, 'FAILED', 'c', '2026-04-03T10:00:00Z')", active, active, active);
        jdbc.update("INSERT INTO admin_audit_logs (category, action, summary, actor_name, actor_email, timestamp) VALUES "
                + "('BILLING', 'A', 's', 'n', 'e', '2026-04-01T09:00:00Z'), ('BILLING', 'B', 's', 'n', 'e', '2026-04-01T10:00:00Z'), "
                + "('SECURITY', 'C', 's', 'n', 'e', '2026-04-02T09:00:00Z')");
        jdbc.update("INSERT INTO user_login_history (email, status, failure_reason, created_at) VALUES "
                + "('a@x.test', 'SUCCESS', NULL, '2026-04-01T08:00:00Z'), ('a@x.test', 'FAILED', 'Invalid password', '2026-04-01T08:05:00Z')");
        jdbc.update("INSERT INTO operator_login_history (email, status, occurred_at) VALUES ('op@x.test', 'FAILED_INVALID_CREDENTIALS', '2026-04-01T09:00:00Z')");

        JsonNode report = getJson("/v1/admin/reports/overview?from=2026-03-01&to=2026-04-30");

        assertThat(report.at("/organizations/total").asLong()).isEqualTo(3);
        assertThat(report.at("/organizations/active").asLong()).isEqualTo(2);
        assertThat(report.at("/organizations/suspended").asLong()).isEqualTo(1);
        assertThat(report.at("/organizations/trial").asLong()).isEqualTo(1);
        assertThat(report.at("/organizations/created_by_month")).hasSize(1);
        assertThat(report.at("/organizations/created_by_month/0/month").asText()).isEqualTo("2026-03");
        assertThat(report.at("/organizations/created_by_month/0/count").asLong()).isEqualTo(2);

        assertThat(statusCounts(report.at("/subscriptions/by_status"))).containsEntry("ACTIVE", 2L).containsEntry("TRIALING", 1L);
        assertThat(report.at("/subscriptions/by_plan/0/plan_id").asText()).isEqualTo("it-plan");
        assertThat(report.at("/subscriptions/by_plan/0/plan_name").asText()).isEqualTo("IT Plan");
        assertThat(report.at("/subscriptions/by_plan/0/count").asLong()).isEqualTo(2);
        assertThat(report.at("/subscriptions/mrr").decimalValue()).isEqualByComparingTo("200"); // 100 + 1200 / 12
        assertThat(report.at("/subscriptions/arr").decimalValue()).isEqualByComparingTo("2400");

        assertThat(report.at("/invoices/by_status")).hasSize(3); // the 2019 invoice is outside the range
        assertThat(report.at("/invoices/billed_total").decimalValue()).isEqualByComparingTo("350");
        assertThat(report.at("/invoices/paid_total").decimalValue()).isEqualByComparingTo("300");
        assertThat(report.at("/invoices/outstanding_total").decimalValue()).isEqualByComparingTo("50");

        assertThat(report.at("/payments/succeeded_total").decimalValue()).isEqualByComparingTo("380");
        assertThat(report.at("/payments/refunded_total").decimalValue()).isEqualByComparingTo("30");
        assertThat(report.at("/payments/failed_count").asLong()).isEqualTo(1);

        assertThat(report.at("/audit/by_category/0/category").asText()).isEqualTo("BILLING");
        assertThat(report.at("/audit/by_category/0/count").asLong()).isEqualTo(2);
        assertThat(report.at("/audit/by_day")).hasSize(2);
        assertThat(report.at("/audit/by_day/0/date").asText()).isEqualTo("2026-04-01");
        assertThat(report.at("/audit/by_day/0/count").asLong()).isEqualTo(2);

        assertThat(report.at("/logins/by_day")).hasSize(1);
        assertThat(report.at("/logins/by_day/0/date").asText()).isEqualTo("2026-04-01");
        assertThat(report.at("/logins/by_day/0/succeeded").asLong()).isEqualTo(1);
        assertThat(report.at("/logins/by_day/0/failed").asLong()).isEqualTo(2);
    }

    @Test
    void anInvertedRangeIsAValidationError() throws Exception {
        mockMvc.perform(auth(get("/v1/admin/reports/overview?from=2026-05-01&to=2026-04-01")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.field_errors[0].field").value("from"));
    }

    // ---------------------------------------------------------------- security overview

    @Test
    void securityOverviewCountsRealRowsAndMasksEmails() throws Exception {
        JsonNode empty = getJson("/v1/admin/security/overview");
        assertThat(empty.path("failed_logins_24h").asLong()).isZero();
        assertThat(empty.path("failed_logins_7d").asLong()).isZero();
        assertThat(empty.path("locked_accounts").asLong()).isZero();
        assertThat(empty.path("users_must_change_password").asLong()).isZero();
        assertThat(empty.path("active_user_sessions").asLong()).isEqualTo(1); // the signed-in Super Admin
        assertThat(empty.path("super_admin_count").asLong()).isEqualTo(1);
        // Operators are platform rows other test classes may leave locked: compare against the count before the insert.
        long operatorsLockedBefore = empty.path("operators_locked").asLong();
        assertThat(operatorsLockedBefore).isEqualTo(jdbc.queryForObject(
                "SELECT count(*) FROM platform_operators WHERE locked_until > now()", Long.class));
        assertThat(empty.path("recent_failed_logins")).isEmpty();
        assertThat(empty.path("published_seed_credential_accounts").asLong()).isZero();

        jdbc.update("INSERT INTO user_login_history (email, ip_address, status, failure_reason, created_at) VALUES "
                + "('hidden.person@gmail.com', '198.51.100.7', 'FAILED', 'Invalid password', now() - interval '1 hour'), "
                + "('x@corp.test', '198.51.100.8', 'FAILED', 'Account locked', now() - interval '3 days'), "
                + "('ok@corp.test', '198.51.100.9', 'SUCCESS', NULL, now() - interval '1 hour')");
        jdbc.update("INSERT INTO operator_login_history (email, ip_address, status, failure_reason, occurred_at) VALUES "
                + "('op@ops.test', '198.51.100.10', 'FAILED_LOCKED', 'Account locked', now() - interval '2 hours')");
        jdbc.update("INSERT INTO users (id, email, password_hash, name, status, must_change_password, locked_until) VALUES "
                + "(?, 'locked@corp.test', 'x', 'L', 'ACTIVE', true, now() + interval '10 minutes')", UUID.randomUUID());
        jdbc.update("INSERT INTO platform_operators (id, name, email, department_id, status, locked_until) VALUES "
                + "('it-locked-op', 'Locked', 'locked-op@ops.test', 'finance-tax', 'ACTIVE', now() + interval '10 minutes')");
        // An account still using a password published in this repository.
        jdbc.update("DELETE FROM users WHERE lower(email) = 'developer@prowise.com'");
        jdbc.update("INSERT INTO users (id, email, password_hash, name, status) VALUES (?, 'developer@prowise.com', ?, 'Seed', 'DISABLED')",
                UUID.randomUUID(), passwordEncoder.encode(PublishedSeedCredentials.DEVELOPER));

        JsonNode overview = getJson("/v1/admin/security/overview");
        assertThat(overview.path("failed_logins_24h").asLong()).isEqualTo(2);
        assertThat(overview.path("failed_logins_7d").asLong()).isEqualTo(3);
        assertThat(overview.path("locked_accounts").asLong()).isEqualTo(1);
        assertThat(overview.path("users_must_change_password").asLong()).isEqualTo(1);
        assertThat(overview.path("operators_locked").asLong()).isEqualTo(operatorsLockedBefore + 1);
        assertThat(overview.path("published_seed_credential_accounts").asLong()).isEqualTo(1);

        JsonNode recent = overview.path("recent_failed_logins");
        assertThat(recent).hasSize(3);
        assertThat(recent.get(0).path("email_masked").asText()).isEqualTo("hi***@gmail.com");
        assertThat(recent.get(0).path("ip_address").asText()).isEqualTo("198.51.100.7");
        assertThat(recent.get(0).path("reason").asText()).isEqualTo("Invalid password");
        assertThat(recent.get(0).path("at").asText()).isNotBlank();
        assertThat(recent.toString()).doesNotContain("hidden.person").doesNotContain("password_hash");

        jdbc.update("DELETE FROM users WHERE lower(email) = 'developer@prowise.com'");
    }

    // ---------------------------------------------------------------- integration settings

    @Test
    void integrationSettingsAreCreatedWithDefaultsValidatedVersionedAndAudited() throws Exception {
        JsonNode initial = getJson("/v1/admin/integration-settings");
        assertThat(initial.path("github_app_slug").asText()).isEmpty();
        assertThat(initial.path("github_client_id").asText()).isEmpty();
        assertThat(initial.path("webhook_max_retries").asInt()).isEqualTo(5);
        assertThat(initial.path("webhook_timeout_seconds").asInt()).isEqualTo(10);
        assertThat(initial.path("webhook_signature_required").asBoolean()).isTrue();
        assertThat(initial.path("allowed_event_types")).isEmpty();
        assertThat(initial.path("version").asLong()).isZero();
        assertThat(initial.toString()).doesNotContain("secret").doesNotContain("private_key");

        Map<String, Object> invalid = new HashMap<>(Map.of("github_app_slug", "Bad Slug!", "github_client_id", "Iv1 spaces",
                "webhook_max_retries", 21, "webhook_timeout_seconds", 0, "webhook_signature_required", true,
                "allowed_event_types", List.of("push", "DROP TABLE"), "expected_version", 0));
        JsonNode errors = objectMapper.readTree(mockMvc.perform(json(put("/v1/admin/integration-settings"), invalid))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andReturn().getResponse().getContentAsString()).path("field_errors");
        List<String> fields = new ArrayList<>();
        errors.forEach(e -> fields.add(e.path("field").asText()));
        assertThat(fields).contains("github_app_slug", "github_client_id", "webhook_max_retries", "webhook_timeout_seconds",
                "allowed_event_types");
        invalid.remove("expected_version");
        invalid.put("webhook_max_retries", 3);
        mockMvc.perform(json(put("/v1/admin/integration-settings"), invalid)).andExpect(status().isBadRequest());

        Map<String, Object> valid = Map.of("github_app_slug", "prowise-app", "github_client_id", "Iv1.0123abcd",
                "webhook_max_retries", 8, "webhook_timeout_seconds", 30, "webhook_signature_required", false,
                "allowed_event_types", List.of("push", "pull_request", "push"), "expected_version", 0);
        JsonNode saved = objectMapper.readTree(mockMvc.perform(json(put("/v1/admin/integration-settings"), valid))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(saved.path("version").asLong()).isEqualTo(1);
        assertThat(saved.path("webhook_max_retries").asInt()).isEqualTo(8);
        assertThat(saved.path("allowed_event_types").toString()).isEqualTo("[\"push\",\"pull_request\"]");
        assertThat(saved.path("updated_by").asText()).isEqualTo(adminEmail);

        // Replaying the old version is a lost update: refused, and the stored row is unchanged.
        Map<String, Object> staleWrite = new HashMap<>(valid);
        staleWrite.put("webhook_max_retries", 1);
        mockMvc.perform(json(put("/v1/admin/integration-settings"), staleWrite))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        assertThat(jdbc.queryForObject("SELECT webhook_max_retries FROM platform_integration_settings", Integer.class)).isEqualTo(8);

        assertThat(jdbc.queryForList("SELECT actor_email FROM admin_audit_logs WHERE action = 'UPDATE_INTEGRATION_SETTINGS'", String.class))
                .containsExactly(adminEmail);
    }

    @Test
    void theNewEndpointsRefuseAnonymousCallers() throws Exception {
        mockMvc.perform(get("/v1/admin/reports/overview")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/admin/security/overview")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/admin/integration-settings")).andExpect(status().isUnauthorized());
        mockMvc.perform(put("/v1/admin/integration-settings").contentType("application/json").content("{\"expected_version\":0}"))
                .andExpect(status().isUnauthorized());
    }

    // ---------------------------------------------------------------- helpers

    private UUID org(String slug, String state, String createdAt) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO organizations (id, name, slug, timezone, state, created_at) VALUES (?, ?, ?, 'UTC', ?, ?::timestamptz)",
                id, slug, slug + "-" + id.toString().substring(0, 6), state, createdAt);
        return id;
    }

    private static Map<String, Long> statusCounts(JsonNode rows) {
        Map<String, Long> counts = new HashMap<>();
        rows.forEach(row -> counts.put(row.path("status").asText(), row.path("count").asLong()));
        return counts;
    }

    private JsonNode getJson(String path) throws Exception {
        return objectMapper.readTree(mockMvc.perform(auth(get(path))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private MockHttpServletRequestBuilder json(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return auth(request).contentType("application/json").content(objectMapper.writeValueAsString(body));
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + token);
    }

    private String login() throws Exception {
        String body = mockMvc.perform(post("/v1/auth/login").contentType("application/json")
                        .with(r -> { r.setRemoteAddr("203.0.113.77"); return r; })
                        .content(objectMapper.writeValueAsString(Map.of("email", adminEmail, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("access_token").asText();
    }
}
