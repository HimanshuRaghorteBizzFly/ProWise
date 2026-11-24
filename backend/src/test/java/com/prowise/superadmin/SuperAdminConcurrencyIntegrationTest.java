package com.prowise.superadmin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashMap;
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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.identity.RequestThrottle;

/**
 * Rule 5 on every Super Admin console mutation: update/state-change bodies carry expected_version, DELETE takes
 * ?expectedVersion=, a stale value is 409 STALE_VERSION in the standard error shape, and every response exposes
 * version. One representative endpoint per controller, plus the audit actor (rule 4), Idempotency-Key replay and
 * anonymous access.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T05")
@Tag("NFR-06")
class SuperAdminConcurrencyIntegrationTest {

    private static final String PASSWORD = "Concurrency-Pass-01!";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private RequestThrottle throttle;

    private String suffix;
    private String adminEmail;
    private String token;
    private int ipCounter;

    @BeforeEach
    void setUp() throws Exception {
        jdbc.update("DELETE FROM user_login_history");
        jdbc.update("DELETE FROM user_roles");
        jdbc.update("DELETE FROM admin_audit_logs");
        jdbc.update("DELETE FROM license_keys");
        jdbc.update("DELETE FROM incident_assignments WHERE incident_id LIKE 'it-%'");
        jdbc.update("DELETE FROM incidents WHERE id LIKE 'it-%'");
        jdbc.update("DELETE FROM support_access_requests WHERE id LIKE 'it-%'");
        jdbc.update("DELETE FROM maintenance_windows WHERE id LIKE 'it-%'");
        jdbc.update("DELETE FROM operator_audit_logs WHERE operator_id LIKE 'it-%'");
        jdbc.update("DELETE FROM platform_operators WHERE id LIKE 'it-%'");
        TestDatabase.clean(jdbc); // organizations cascade to subscriptions, invoices and payments
        throttle.clear();

        suffix = UUID.randomUUID().toString().substring(0, 8);
        adminEmail = "sa." + suffix + "@prowise.test";
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, 'Concurrency Admin', 'SUPER_ADMIN', 'ACTIVE', false)
                """, id, adminEmail, passwordEncoder.encode(PASSWORD));
        jdbc.update("INSERT INTO user_roles (user_id, role_name) VALUES (?, 'SUPER_ADMIN')", id);
        token = login();
    }

    // ---------------------------------------------------------------- plans

    @Test
    void planUpdateNeedsTheCurrentVersionAndIsAuditedWithTheSignedInActor() throws Exception {
        JsonNode plan = ok(post("/v1/admin/plans"), Map.of("name", "Plan " + suffix, "code", "P" + suffix), 201);
        String id = plan.path("id").asText();
        assertThat(plan.path("version").asLong()).isZero();

        JsonNode updated = ok(patch("/v1/admin/plans/" + id), Map.of("name", "Renamed " + suffix, "expected_version", 0), 200);
        assertThat(updated.path("version").asLong()).isEqualTo(1);
        assertThat(updated.path("name").asText()).isEqualTo("Renamed " + suffix);

        stale(patch("/v1/admin/plans/" + id), Map.of("name", "Lost update", "expected_version", 0));
        assertThat(jdbc.queryForObject("SELECT name FROM plans WHERE id = ?", String.class, id)).isEqualTo("Renamed " + suffix);

        // A missing expected_version is a validation error, never "skip the check".
        call(patch("/v1/admin/plans/" + id), Map.of("name", "No version")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.field_errors[0].field").value("expected_version"));

        // Archive (state change) and delete (query parameter) follow the same rule.
        stale(post("/v1/admin/plans/" + id + "/archive"), Map.of("expected_version", 0));
        JsonNode archived = ok(post("/v1/admin/plans/" + id + "/archive"), Map.of("expected_version", 1), 200);
        assertThat(archived.path("status").asText()).isEqualTo("ARCHIVED");
        mockMvc.perform(auth(delete("/v1/admin/plans/" + id).param("expectedVersion", "1")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        mockMvc.perform(auth(delete("/v1/admin/plans/" + id).param("expectedVersion", "2")))
                .andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM plans WHERE id = ?", Integer.class, id)).isZero();

        List<Map<String, Object>> audit = jdbc.queryForList(
                "SELECT action, actor_email FROM admin_audit_logs WHERE category = 'BILLING' ORDER BY timestamp");
        assertThat(audit).extracting(row -> row.get("action"))
                .containsExactly("CREATE_PLAN", "UPDATE_PLAN", "ARCHIVE_PLAN", "DELETE_PLAN");
        assertThat(audit).allSatisfy(row -> assertThat(row.get("actor_email")).isEqualTo(adminEmail));
    }

    @Test
    void anIdempotencyKeyReplaysTheFirstResultInsteadOfFailingAsStale() throws Exception {
        String id = ok(post("/v1/admin/plans"), Map.of("name", "Idem " + suffix, "code", "I" + suffix), 201).path("id").asText();
        String body = objectMapper.writeValueAsString(Map.of("name", "Idem renamed", "expected_version", 0));
        String key = "plan-rename-" + suffix;

        mockMvc.perform(auth(patch("/v1/admin/plans/" + id)).header("Idempotency-Key", key)
                        .contentType("application/json").content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(1));
        mockMvc.perform(auth(patch("/v1/admin/plans/" + id)).header("Idempotency-Key", key)
                        .contentType("application/json").content(body))
                .andExpect(status().isOk())
                .andExpect(header().string("Idempotent-Replayed", "true"))
                .andExpect(jsonPath("$.version").value(1));
        assertThat(jdbc.queryForObject("SELECT version FROM plans WHERE id = ?", Long.class, id)).isEqualTo(1L);
    }

    // ---------------------------------------------------------------- subscriptions

    @Test
    void subscriptionRenewIsVersionChecked() throws Exception {
        String orgId = createOrg().path("id").asText();
        String planId = ok(post("/v1/admin/plans"), Map.of("name", "Sub plan " + suffix, "code", "S" + suffix,
                "monthly_price", 49), 201).path("id").asText();
        JsonNode sub = ok(post("/v1/admin/subscriptions"), Map.of("org_id", orgId, "plan_id", planId), 201);
        String subId = sub.path("id").asText();
        assertThat(sub.path("version").asLong()).isZero();

        JsonNode renewed = ok(post("/v1/admin/subscriptions/" + subId + "/renew"), Map.of("expected_version", 0), 200);
        assertThat(renewed.path("version").asLong()).isEqualTo(1);
        stale(post("/v1/admin/subscriptions/" + subId + "/cancel"), Map.of("expected_version", 0, "immediate", true));
        JsonNode cancelled = ok(post("/v1/admin/subscriptions/" + subId + "/cancel"), Map.of("expected_version", 1, "immediate", true), 200);
        assertThat(cancelled.path("status").asText()).isEqualTo("CANCELLED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_logs WHERE action IN ('ASSIGN_SUBSCRIPTION', "
                + "'RENEW_SUBSCRIPTION', 'CANCEL_SUBSCRIPTION') AND actor_email = ?", Integer.class, adminEmail)).isEqualTo(3);
    }

    // ---------------------------------------------------------------- organizations

    @Test
    void organizationUpdateSuspendAndBulkSuspendAreVersionChecked() throws Exception {
        JsonNode org = createOrg();
        String id = org.path("id").asText();
        long v0 = org.path("version").asLong();

        JsonNode updated = ok(put("/v1/admin/organizations/" + id), Map.of("industry", "Logistics", "expected_version", v0), 200);
        assertThat(updated.path("version").asLong()).isEqualTo(v0 + 1);
        assertThat(updated.path("seats_used").asInt()).isZero();
        assertThat(updated.path("mrr").decimalValue()).isZero();
        stale(put("/v1/admin/organizations/" + id), Map.of("industry", "Lost", "expected_version", v0));
        stale(post("/v1/admin/organizations/" + id + "/suspend"), Map.of("reason", "Late", "expected_version", v0));

        JsonNode other = createOrg();
        // One stale item refuses the whole batch: nothing is suspended.
        stale(post("/v1/admin/organizations/bulk-suspend"), Map.of("reason", "Audit", "items", List.of(
                Map.of("id", other.path("id").asText(), "expected_version", other.path("version").asLong()),
                Map.of("id", id, "expected_version", v0))));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM organizations WHERE state = 'SUSPENDED'", Integer.class)).isZero();

        call(post("/v1/admin/organizations/bulk-suspend"), Map.of("reason", "Audit", "items", List.of(
                Map.of("id", other.path("id").asText(), "expected_version", other.path("version").asLong()),
                Map.of("id", id, "expected_version", v0 + 1)))).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM organizations WHERE state = 'SUSPENDED'", Integer.class)).isEqualTo(2);

        mockMvc.perform(auth(delete("/v1/admin/organizations/" + id).param("expectedVersion", String.valueOf(v0 + 1))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        mockMvc.perform(auth(get("/v1/admin/organizations/" + UUID.randomUUID())))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    // ---------------------------------------------------------------- invoices and payments

    @Test
    void invoiceVoidAndPaymentRefundAndDeleteAreVersionChecked() throws Exception {
        String orgId = createOrg().path("id").asText();
        JsonNode invoice = ok(post("/v1/admin/invoices"), Map.of("org_id", orgId, "line_items",
                List.of(Map.of("description", "Seats", "quantity", 2, "unit_price", 50))), 201);
        String invoiceId = invoice.path("id").asText();
        stale(post("/v1/admin/invoices/" + invoiceId + "/void"), Map.of("expected_version", invoice.path("version").asLong() + 7));
        JsonNode voided = ok(post("/v1/admin/invoices/" + invoiceId + "/void"), Map.of("expected_version", invoice.path("version").asLong()), 200);
        assertThat(voided.path("status").asText()).isEqualTo("VOID");
        assertThat(voided.path("version").asLong()).isEqualTo(invoice.path("version").asLong() + 1);

        JsonNode payment = ok(post("/v1/admin/payments"), Map.of("org_id", orgId, "amount", 100, "description", "Offline"), 201);
        String paymentId = payment.path("id").asText();
        assertThat(payment.path("version").asLong()).isZero();
        JsonNode refunded = ok(post("/v1/admin/payments/" + paymentId + "/refund"),
                Map.of("amount", 10, "reason", "Goodwill", "expected_version", 0), 200);
        assertThat(refunded.path("version").asLong()).isEqualTo(1);
        stale(post("/v1/admin/payments/" + paymentId + "/refund"), Map.of("amount", 10, "reason", "Twice", "expected_version", 0));
        assertThat(jdbc.queryForObject("SELECT refunded_amount FROM payments WHERE id = ?", java.math.BigDecimal.class, paymentId))
                .isEqualByComparingTo("10");

        mockMvc.perform(auth(delete("/v1/admin/payments/" + paymentId).param("expectedVersion", "0")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        mockMvc.perform(auth(delete("/v1/admin/payments/" + paymentId).param("expectedVersion", "1")))
                .andExpect(status().isNoContent());
    }

    // ---------------------------------------------------------------- communication, flags, licenses, roles

    @Test
    void announcementTemplateFlagLicenseAndRoleChangesAreVersionChecked() throws Exception {
        JsonNode ann = ok(post("/v1/admin/announcements"), Map.of("title", "Notice " + suffix, "message", "Body",
                "type", "INFO", "target_audience", "ALL_ORGS", "channels", List.of("IN_APP_BANNER")), 201);
        stale(post("/v1/admin/announcements/" + ann.path("id").asText() + "/publish"), Map.of("expected_version", 3));
        assertThat(ok(post("/v1/admin/announcements/" + ann.path("id").asText() + "/publish"), Map.of("expected_version", 0), 200)
                .path("status").asText()).isEqualTo("PUBLISHED");

        JsonNode tpl = ok(post("/v1/admin/email-templates"), Map.of("key", "it.tpl." + suffix, "name", "Tpl", "category", "AUTH",
                "subject", "S", "headline", "H", "body_paragraphs", "B"), 201);
        long tplVersion = tpl.path("version").asLong();
        stale(put("/v1/admin/email-templates/" + tpl.path("id").asText()), Map.of("subject", "New", "expected_version", tplVersion + 1));
        assertThat(ok(put("/v1/admin/email-templates/" + tpl.path("id").asText()), Map.of("subject", "New", "expected_version", tplVersion), 200)
                .path("version").asLong()).isEqualTo(tplVersion + 1);

        JsonNode flag = ok(post("/v1/admin/feature-flags"), Map.of("flag_key", "it_flag_" + suffix, "label", "Flag"), 201);
        stale(post("/v1/admin/feature-flags/" + flag.path("id").asText() + "/toggle"), Map.of("enabled", true, "expected_version", 1));
        JsonNode toggled = ok(post("/v1/admin/feature-flags/" + flag.path("id").asText() + "/toggle"), Map.of("enabled", true, "expected_version", 0), 200);
        assertThat(toggled.path("enabled").asBoolean()).isTrue();
        assertThat(toggled.path("version").asLong()).isEqualTo(1);
        mockMvc.perform(auth(delete("/v1/admin/feature-flags/" + flag.path("id").asText()).param("expectedVersion", "1")))
                .andExpect(status().isNoContent());

        JsonNode license = ok(post("/v1/admin/licenses"), Map.of("max_seats", 5), 201);
        stale(post("/v1/admin/licenses/" + license.path("id").asText() + "/revoke"), Map.of("reason", "Ended", "expected_version", 2));
        assertThat(ok(post("/v1/admin/licenses/" + license.path("id").asText() + "/revoke"), Map.of("reason", "Ended", "expected_version", 0), 200)
                .path("status").asText()).isEqualTo("REVOKED");

        JsonNode role = ok(post("/v1/admin/roles"), Map.of("name", "Auditor " + suffix, "slug", "auditor-" + suffix,
                "permissions", List.of("audit.read")), 201); // task 1.5: only capabilities the system enforces
        String roleId = role.path("id").asText();
        stale(put("/v1/admin/roles/" + roleId), Map.of("description", "x", "expected_version", 5));
        assertThat(ok(put("/v1/admin/roles/" + roleId), Map.of("description", "x", "expected_version", 0), 200)
                .path("version").asLong()).isEqualTo(1);
        mockMvc.perform(auth(delete("/v1/admin/roles/" + roleId).param("expectedVersion", "1"))).andExpect(status().isNoContent());
    }

    // ---------------------------------------------------------------- singletons: policies and branding

    @Test
    void policiesAndBrandingUseTheVersionFromTheLastRead() throws Exception {
        long policyVersion = ok(get("/v1/admin/policies"), null, 200).path("version").asLong();
        Map<String, Object> policy = new LinkedHashMap<>(Map.of("checkin_grace_working_days", 4, "stale_webhook_minutes", 30,
                "audit_retention_days", 120, "enforce_mfa_for_operators", true, "auto_suspend_after_past_due_days", 10,
                "default_trial_days", 14, "max_attachment_mb", 25, "maintenance_banner_mode", false));
        policy.put("expected_version", policyVersion + 1);
        stale(put("/v1/admin/policies"), policy);
        policy.put("expected_version", policyVersion);
        assertThat(ok(put("/v1/admin/policies"), policy, 200).path("version").asLong()).isEqualTo(policyVersion + 1);

        long brandingVersion = ok(get("/v1/admin/branding"), null, 200).path("version").asLong();
        stale(put("/v1/admin/branding"), Map.of("platform_name", "ProWise", "support_email", "help@prowise.test",
                "expected_version", brandingVersion + 3));
        assertThat(ok(put("/v1/admin/branding"), Map.of("platform_name", "ProWise", "support_email", "help@prowise.test",
                "expected_version", brandingVersion), 200).path("version").asLong()).isEqualTo(brandingVersion + 1);
    }

    // ---------------------------------------------------------------- operators and operator-module records

    @Test
    void operatorEditsAreVersionCheckedAndSignInBookkeepingDoesNotBumpTheVersion() throws Exception {
        String opId = "it-op-" + suffix;
        jdbc.update("""
                INSERT INTO platform_operators (id, name, email, role_id, access_level, department_id, status,
                    password_hash, password_setup_completed)
                VALUES (?, 'IT Operator', ?, 'role-platform-operator', 'DEPARTMENT_OPERATOR', 'finance-tax', 'ACTIVE', 'x', true)
                """, opId, "it-op-" + suffix + "@ops.test");
        assertThat(ok(get("/v1/operators/" + opId), null, 200).path("version").asLong()).isZero();

        JsonNode updated = ok(patch("/v1/operators/" + opId), Map.of("shift_name", "Night", "expected_version", 0), 200);
        assertThat(updated.path("version").asLong()).isEqualTo(1);
        stale(patch("/v1/operators/" + opId), Map.of("shift_name", "Lost", "expected_version", 0));
        stale(patch("/v1/operators/" + opId + "/status"), Map.of("status", "SUSPENDED", "expected_version", 0));
        stale(post("/v1/operators/" + opId + "/toggle-status"), Map.of("expected_version", 0));
        assertThat(jdbc.queryForObject("SELECT status FROM platform_operators WHERE id = ?", String.class, opId)).isEqualTo("ACTIVE");

        // Sign-in style bookkeeping (failed-login counters) never touches the version column.
        jdbc.update("UPDATE platform_operators SET failed_login_count = failed_login_count + 1 WHERE id = ?", opId);
        assertThat(jdbc.queryForObject("SELECT version FROM platform_operators WHERE id = ?", Long.class, opId)).isEqualTo(1L);

        mockMvc.perform(auth(delete("/v1/operators/" + opId).param("expectedVersion", "0")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        mockMvc.perform(auth(delete("/v1/operators/" + opId).param("expectedVersion", "1"))).andExpect(status().isNoContent());
    }

    @Test
    void incidentAccessRequestAndMaintenanceEditsAreVersionChecked() throws Exception {
        String incident = "it-inc-" + suffix;
        jdbc.update("INSERT INTO incidents (id, title, severity, status, department_id, description) "
                + "VALUES (?, 'Queue backlog', 'SEV_3', 'INVESTIGATING', 'site-reliability', 'Backlog')", incident);
        JsonNode inc = ok(patch("/v1/operator/incidents/" + incident), Map.of("status", "IDENTIFIED", "expected_version", 0), 200);
        assertThat(inc.path("version").asLong()).isEqualTo(1);
        stale(post("/v1/operator/incidents/" + incident + "/resolve"), Map.of("root_cause", "x", "expected_version", 0));
        assertThat(ok(post("/v1/operator/incidents/" + incident + "/resolve"), Map.of("root_cause", "x", "expected_version", 1), 200)
                .path("status").asText()).isEqualTo("RESOLVED");

        String access = "it-acc-" + suffix;
        jdbc.update("INSERT INTO support_access_requests (id, requester_email, reason, status) "
                + "VALUES (?, 'agent@prowise.test', 'Diagnose', 'PENDING_APPROVAL')", access);
        stale(post("/v1/operator/support/access-requests/" + access + "/approve"), Map.of("expected_version", 4));
        assertThat(jdbc.queryForObject("SELECT status FROM support_access_requests WHERE id = ?", String.class, access))
                .isEqualTo("PENDING_APPROVAL");
        assertThat(ok(post("/v1/operator/support/access-requests/" + access + "/reject"), Map.of("expected_version", 0), 200)
                .path("status").asText()).isEqualTo("REJECTED");

        String window = "it-mw-" + suffix;
        jdbc.update("INSERT INTO maintenance_windows (id, title, status, scheduled_start, scheduled_end, created_by) "
                + "VALUES (?, 'Upgrade', 'SCHEDULED', now() + interval '1 day', now() + interval '2 days', 'it')", window);
        stale(patch("/v1/operator/maintenance/" + window), Map.of("status", "CANCELLED", "expected_version", 1));
        assertThat(ok(patch("/v1/operator/maintenance/" + window), Map.of("status", "CANCELLED", "expected_version", 0), 200)
                .path("version").asLong()).isEqualTo(1);
    }

    // ---------------------------------------------------------------- anonymous

    /** Satisfies every body validation above, so 401 is about the missing identity and nothing else. */
    private static final String VALID_FOR_EVERY_ROUTE = "{\"expected_version\":0,\"amount\":1,\"reason\":\"x\",\"enabled\":true,"
            + "\"platform_name\":\"P\",\"support_email\":\"a@b.test\",\"checkin_grace_working_days\":1,\"stale_webhook_minutes\":1,"
            + "\"audit_retention_days\":1,\"enforce_mfa_for_operators\":true,\"auto_suspend_after_past_due_days\":1,"
            + "\"default_trial_days\":1,\"max_attachment_mb\":1,\"maintenance_banner_mode\":false}";

    @Test
    void anonymousCallersAreRefusedBeforeAnyVersionCheck() throws Exception {
        for (MockHttpServletRequestBuilder request : List.of(
                patch("/v1/admin/plans/plan-x"), post("/v1/admin/subscriptions/sub-x/renew"),
                put("/v1/admin/organizations/" + UUID.randomUUID()), post("/v1/admin/invoices/inv-x/void"),
                post("/v1/admin/payments/pay-x/refund"), post("/v1/admin/announcements/ann-x/publish"),
                put("/v1/admin/email-templates/tpl-x"), post("/v1/admin/feature-flags/flag-x/toggle"),
                post("/v1/admin/licenses/lic-x/revoke"), put("/v1/admin/roles/role-x"), put("/v1/admin/policies"),
                put("/v1/admin/branding"), patch("/v1/operators/op-x"), patch("/v1/operator/incidents/inc-x"),
                delete("/v1/admin/plans/plan-x").param("expectedVersion", "0"))) {
            mockMvc.perform(request.contentType("application/json").content(VALID_FOR_EVERY_ROUTE))
                    .andExpect(status().isUnauthorized());
        }
    }

    // ---------------------------------------------------------------- helpers

    private JsonNode createOrg() throws Exception {
        String slug = "it-org-" + UUID.randomUUID().toString().substring(0, 8);
        return ok(post("/v1/admin/organizations"), Map.of("name", "Org " + slug, "slug", slug,
                "owner_name", "Owner", "owner_email", "owner@" + slug + ".test"), 201);
    }

    private void stale(MockHttpServletRequestBuilder request, Object body) throws Exception {
        call(request, body).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.request_id").isNotEmpty())
                .andExpect(jsonPath("$.field_errors").isArray());
    }

    private JsonNode ok(MockHttpServletRequestBuilder request, Object body, int expected) throws Exception {
        String content = call(request, body).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(content);
    }

    private ResultActions call(MockHttpServletRequestBuilder request, Object body) throws Exception {
        MockHttpServletRequestBuilder built = auth(request);
        if (body != null) {
            built = built.contentType("application/json").content(objectMapper.writeValueAsString(body));
        }
        return mockMvc.perform(built);
    }

    private MockHttpServletRequestBuilder auth(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + token);
    }

    private String login() throws Exception {
        String ip = "203.0.113." + (++ipCounter % 250 + 1);
        String body = mockMvc.perform(post("/v1/auth/login").contentType("application/json")
                        .with(r -> { r.setRemoteAddr(ip); return r; })
                        .content(objectMapper.writeValueAsString(Map.of("email", adminEmail, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("access_token").asText();
    }
}
