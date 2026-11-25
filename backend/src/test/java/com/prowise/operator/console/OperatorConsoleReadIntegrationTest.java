package com.prowise.operator.console;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.identity.AccountTokenService;
import com.prowise.testsupport.ConsoleSessions;
import com.prowise.testsupport.TestAccounts;

/**
 * Operator console read endpoints over real rows: empty database gives zeros and empty pages, values match
 * inserted rows, filters and pagination work, and the operator department permissions are enforced.
 */
@SpringBootTest
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Tag("NFR-06")
class OperatorConsoleReadIntegrationTest {

    private static final List<String> READ_ENDPOINTS = List.of(
            "/v1/operator/activity-logs", "/v1/operator/organizations", "/v1/operator/subscriptions",
            "/v1/operator/payments/failures", "/v1/operator/invoices/delivery", "/v1/operator/api-errors",
            "/v1/operator/api-errors/summary", "/v1/operator/backups", "/v1/operator/announcement-drafts",
            "/v1/operator/email-drafts", "/v1/operator/dashboard", "/v1/operator/dashboard/stats");

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder encoder;
    @Autowired private ObjectMapper mapper;
    @Autowired private AccountTokenService tokens;

    private String admin;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        ConsoleSessions.cleanup(jdbc);
        admin = ConsoleSessions.superAdmin(mvc, jdbc, encoder, mapper);
    }

    @AfterEach
    void tearDown() {
        ConsoleSessions.cleanup(jdbc);
    }

    @Test
    void anonymousIs401AndNonOperatorUserIs403() throws Exception {
        TestAccounts.Account user = TestAccounts.signUpVerifyAndLogin(mvc, jdbc, tokens, mapper,
                "plain-" + UUID.randomUUID().toString().substring(0, 6) + "@test.prowise", "Plain-User-Pass-123");
        for (String path : READ_ENDPOINTS) {
            mvc.perform(get(path)).andExpect(status().isUnauthorized());
            mvc.perform(get(path).header("Authorization", "Bearer " + user.accessToken()))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
    }

    @Test
    void emptyDatabaseGivesEmptyPagesAndZeros() throws Exception {
        for (String path : List.of("/v1/operator/activity-logs", "/v1/operator/subscriptions",
                "/v1/operator/payments/failures", "/v1/operator/invoices/delivery", "/v1/operator/api-errors",
                "/v1/operator/announcement-drafts", "/v1/operator/email-drafts")) {
            asAdmin(path).andExpect(status().isOk())
                    .andExpect(jsonPath("$.items.length()").value(0))
                    .andExpect(jsonPath("$.total").value(0))
                    .andExpect(jsonPath("$.page").value(0))
                    .andExpect(jsonPath("$.size").value(25));
        }
        // The Super Admin's own user has no organization: none exist.
        asAdmin("/v1/operator/organizations").andExpect(jsonPath("$.total").value(0));
        asAdmin("/v1/operator/api-errors/summary").andExpect(status().isOk())
                .andExpect(jsonPath("$.total").value(0)).andExpect(jsonPath("$.by_status.length()").value(0));
        asAdmin("/v1/operator/backups").andExpect(jsonPath("$.configured").value(false))
                .andExpect(jsonPath("$.running").value(false)).andExpect(jsonPath("$.total").value(0));
        JsonNode stats = json(asAdmin("/v1/operator/dashboard/stats").andExpect(status().isOk()));
        for (String key : List.of("openIncidents", "openTickets", "pendingWebhooks", "failedJobs", "unacknowledgedAlerts",
                "pendingAccessRequests", "failedOutboxEvents", "failedEmailDeliveries24h", "activeMaintenanceWindows")) {
            assertThat(stats.path(key).asLong(-1)).as(key).isZero();
        }
        assertThat(stats.path("systemHealthScore").isNull()).isTrue();
        assertThat(stats.path("operationalStatus").isNull()).isTrue();
        assertThat(stats.path("organizationsByState").path("ACTIVE").asLong(-1)).isZero();
        JsonNode dashboard = json(asAdmin("/v1/operator/dashboard").andExpect(status().isOk()));
        assertThat(dashboard.path("department_data").path("health_score").isNull()).isTrue();
        dashboard.path("kpis").forEach(kpi -> assertThat(kpi.path("value").asText()).isEqualTo("0"));
    }

    @Test
    void dashboardCountsMatchInsertedRows() throws Exception {
        UUID org = org("Dash Org", "dash-org", "ACTIVE");
        org("Dash Suspended", "dash-susp", "SUSPENDED");
        jdbc.update("INSERT INTO incidents (id, title, severity, status, description) VALUES ('inc-cs-1', 'A', 'SEV_2', 'INVESTIGATING', 'x')");
        jdbc.update("INSERT INTO incidents (id, title, severity, status, description) VALUES ('inc-cs-2', 'B', 'SEV_3', 'RESOLVED', 'x')");
        jdbc.update("INSERT INTO support_tickets (id, subject, customer_name, customer_email, priority, status, description) "
                + "VALUES ('tkt-cs-1', 'S', 'C', 'c@x.test', 'HIGH', 'OPEN', 'd')");
        jdbc.update("INSERT INTO support_access_requests (id, requester_email, org_id, reason, status) "
                + "VALUES ('sar-cs-1', 'r@x.test', ?, 'why', 'PENDING_APPROVAL')", org);
        jdbc.update("INSERT INTO operational_alerts (id, title, message, source_module) VALUES ('alt-cs-1', 'T', 'M', 'mod')");
        jdbc.update("INSERT INTO background_jobs (id, job_name, queue_name, status) VALUES ('job-cs-1', 'j', 'q', 'FAILED')");
        jdbc.update("INSERT INTO email_delivery_logs (id, recipient, subject, provider, status, created_at) "
                + "VALUES ('eml-cs-1', 'a@x.test', 's', 'SMTP', 'FAILED', now())");
        jdbc.update("INSERT INTO email_delivery_logs (id, recipient, subject, provider, status, created_at) "
                + "VALUES ('eml-cs-2', 'a@x.test', 's', 'SMTP', 'FAILED', now() - interval '3 days')");
        jdbc.update("INSERT INTO maintenance_windows (id, title, status, scheduled_start, scheduled_end, created_by) "
                + "VALUES ('mw-cs-1', 'M', 'IN_PROGRESS', now(), now() + interval '1 hour', 'x')");

        JsonNode stats = json(asAdmin("/v1/operator/dashboard/stats").andExpect(status().isOk()));
        assertThat(stats.path("openIncidents").asLong()).isEqualTo(1);
        assertThat(stats.path("openTickets").asLong()).isEqualTo(1);
        assertThat(stats.path("pendingAccessRequests").asLong()).isEqualTo(1);
        assertThat(stats.path("unacknowledgedAlerts").asLong()).isEqualTo(1);
        assertThat(stats.path("failedJobs").asLong()).isEqualTo(1);
        assertThat(stats.path("failedEmailDeliveries24h").asLong()).isEqualTo(1);
        assertThat(stats.path("activeMaintenanceWindows").asLong()).isEqualTo(1);
        assertThat(stats.path("organizationsByState").path("ACTIVE").asLong()).isEqualTo(1);
        assertThat(stats.path("organizationsByState").path("SUSPENDED").asLong()).isEqualTo(1);

        JsonNode dashboard = json(asAdmin("/v1/operator/dashboard").andExpect(status().isOk()));
        assertThat(dashboard.path("department").asText()).isEqualTo("all");
        assertThat(dashboard.path("department_data").path("open_incidents").asLong()).isEqualTo(1);
        assertThat(kpi(dashboard, "Open incidents")).isEqualTo("1");
        assertThat(kpi(dashboard, "Active organizations")).isEqualTo("1");

        String sre = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, ConsoleSessions.operatorId("sre"),
                "DEPARTMENT_OPERATOR", "site-reliability");
        JsonNode sreDash = json(as(sre, "/v1/operator/dashboard").andExpect(status().isOk()));
        assertThat(sreDash.path("department").asText()).isEqualTo("site-reliability");
        assertThat(kpi(sreDash, "Failed jobs")).isEqualTo("1");
    }

    @Test
    void organizationsShowRealMembersProjectsSubscriptionAndOwner() throws Exception {
        UUID org = org("Acme Works", "acme-works", "ACTIVE");
        UUID other = org("Beta Labs", "beta-labs", "SUSPENDED");
        UUID owner = user("owner-" + UUID.randomUUID().toString().substring(0, 6) + "@acme.test");
        UUID member = user("member-" + UUID.randomUUID().toString().substring(0, 6) + "@acme.test");
        UUID disabled = user("gone-" + UUID.randomUUID().toString().substring(0, 6) + "@acme.test");
        membership(org, owner, "ORGANIZATION_OWNER", "ACTIVE");
        membership(org, member, "DEVELOPER", "ACTIVE");
        membership(org, disabled, "DEVELOPER", "DISABLED");
        project(org, owner, "PLANNED");
        project(org, owner, "ACTIVE");
        plan("plan-cs-pro", "CSPRO", "Console Pro");
        subscription("sub-cs-1", org, "plan-cs-pro", "ACTIVE");

        JsonNode page = json(asAdmin("/v1/operator/organizations?search=acme").andExpect(status().isOk()));
        assertThat(page.path("total").asLong()).isEqualTo(1);
        JsonNode item = page.path("items").get(0);
        assertThat(item.path("name").asText()).isEqualTo("Acme Works");
        assertThat(item.path("slug").asText()).isEqualTo("acme-works");
        assertThat(item.path("member_count").asLong()).isEqualTo(2);
        assertThat(item.path("project_count").asLong()).isEqualTo(2);
        assertThat(item.path("subscription_status").asText()).isEqualTo("ACTIVE");
        assertThat(item.path("plan_name").asText()).isEqualTo("Console Pro");
        assertThat(item.path("owner_email").asText()).startsWith("owner-");

        asAdmin("/v1/operator/organizations?state=SUSPENDED").andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value(other.toString()))
                .andExpect(jsonPath("$.items[0].subscription_status").doesNotExist());
        asAdmin("/v1/operator/organizations?size=1&page=1").andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.items.length()").value(1)).andExpect(jsonPath("$.page").value(1));
        asAdmin("/v1/operator/organizations?size=500").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field_errors[0].field").value("size"));

        JsonNode detail = json(asAdmin("/v1/operator/organizations/" + org).andExpect(status().isOk()));
        assertThat(detail.path("member_count").asLong()).isEqualTo(2);
        assertThat(detail.path("disabled_member_count").asLong()).isEqualTo(1);
        assertThat(detail.path("project_count").asLong()).isEqualTo(2);
        assertThat(detail.path("projects_by_lifecycle").path("PLANNED").asLong()).isEqualTo(1);
        assertThat(detail.path("subscriptions").size()).isEqualTo(1);
        asAdmin("/v1/operator/organizations/" + UUID.randomUUID()).andExpect(status().isNotFound());
        asAdmin("/v1/operator/organizations/not-a-uuid").andExpect(status().isNotFound());
    }

    @Test
    void subscriptionsPaymentFailuresAndInvoiceDeliveryComeFromRealRows() throws Exception {
        UUID org = org("Billing Org", "billing-org", "ACTIVE");
        plan("plan-cs-basic", "CSBASIC", "Console Basic");
        subscription("sub-cs-a", org, "plan-cs-basic", "ACTIVE");
        subscription("sub-cs-b", org, "plan-cs-basic", "PAST_DUE");
        jdbc.update("INSERT INTO payments (id, transaction_ref, org_id, subscription_id, amount, status, description, failure_reason) "
                + "VALUES ('pay-cs-1', 'TX-CS-1', ?, 'sub-cs-b', 49.00, 'FAILED', 'Monthly', 'card_declined')", org);
        jdbc.update("INSERT INTO payments (id, transaction_ref, org_id, amount, status, description) "
                + "VALUES ('pay-cs-2', 'TX-CS-2', ?, 49.00, 'SUCCEEDED', 'Monthly')", org);
        jdbc.update("INSERT INTO invoices (id, invoice_number, org_id, subscription_id, payment_id, status, total) "
                + "VALUES ('inv-cs-1', 'INV-CS-1', ?, 'sub-cs-b', 'pay-cs-1', 'OPEN', 49.00)", org);
        jdbc.update("INSERT INTO invoices (id, invoice_number, org_id, status, total) VALUES ('inv-cs-2', 'INV-CS-2', ?, 'PAID', 10.00)", org);
        jdbc.update("INSERT INTO email_delivery_logs (id, recipient, subject, provider, status, invoice_id, created_at) "
                + "VALUES ('eml-cs-i1', 'billing@org.test', 'Invoice', 'SMTP', 'FAILED', 'inv-cs-1', now() - interval '1 hour')");
        jdbc.update("INSERT INTO email_delivery_logs (id, recipient, subject, provider, status, invoice_id, sent_at, created_at) "
                + "VALUES ('eml-cs-i2', 'billing@org.test', 'Invoice', 'SMTP', 'SMTP_ACCEPTED', 'inv-cs-1', now(), now())");

        asAdmin("/v1/operator/subscriptions").andExpect(jsonPath("$.total").value(2));
        asAdmin("/v1/operator/subscriptions?status=past_due").andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].id").value("sub-cs-b"))
                .andExpect(jsonPath("$.items[0].org_name").value("Billing Org"))
                .andExpect(jsonPath("$.items[0].plan_code").value("CSBASIC"));
        asAdmin("/v1/operator/subscriptions?plan=CSBASIC").andExpect(jsonPath("$.total").value(2));
        asAdmin("/v1/operator/subscriptions?plan=nothing").andExpect(jsonPath("$.total").value(0));

        asAdmin("/v1/operator/payments/failures").andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].transaction_ref").value("TX-CS-1"))
                .andExpect(jsonPath("$.items[0].invoice_number").value("INV-CS-1"))
                .andExpect(jsonPath("$.items[0].failure_reason").value("card_declined"))
                .andExpect(jsonPath("$.items[0].org_name").value("Billing Org"));

        JsonNode invoices = json(asAdmin("/v1/operator/invoices/delivery").andExpect(status().isOk()));
        assertThat(invoices.path("total").asLong()).isEqualTo(2);
        for (JsonNode inv : invoices.path("items")) {
            if ("INV-CS-1".equals(inv.path("invoice_number").asText())) {
                assertThat(inv.path("delivery_status").asText()).isEqualTo("SMTP_ACCEPTED");
                assertThat(inv.path("delivery_attempts").asLong()).isEqualTo(2);
                assertThat(inv.path("recipient_email").asText()).isEqualTo("billing@org.test");
            } else {
                assertThat(inv.path("delivery_status").asText()).isEqualTo("NOT_SENT");
                assertThat(inv.path("delivery_attempts").asLong()).isZero();
            }
        }
        asAdmin("/v1/operator/invoices/delivery?delivery_status=NOT_SENT").andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.items[0].invoice_number").value("INV-CS-2"));
    }

    @Test
    void activityLogsMergeBothSourcesWithFiltersAndPaging() throws Exception {
        String opId = ConsoleSessions.operatorId("act");
        ConsoleSessions.operator(mvc, jdbc, encoder, mapper, opId, "MAIN_PLATFORM_OPERATOR", null);
        jdbc.update("DELETE FROM operator_activity_logs");
        jdbc.update("DELETE FROM operator_audit_logs");
        jdbc.update("INSERT INTO operator_activity_logs (operator_id, action, resource_type, resource_id, details, created_at) "
                + "VALUES (?, 'INCIDENT_CREATED', 'incidents', 'inc-9', 'Created incident: DB slow', now() - interval '2 hours')", opId);
        jdbc.update("INSERT INTO operator_activity_logs (operator_id, action, resource_type, details, created_at) "
                + "VALUES (?, 'TICKET_UPDATED', 'support_tickets', 'Updated ticket', now() - interval '1 hour')", opId);
        jdbc.update("INSERT INTO operator_audit_logs (operator_id, actor_name, action, module_key, details, occurred_at) "
                + "VALUES ('op-other', 'Other Op', 'PERMISSION_CHANGED', 'system.alerts', 'grant', now())");

        JsonNode all = json(asAdmin("/v1/operator/activity-logs").andExpect(status().isOk()));
        assertThat(all.path("total").asLong()).isEqualTo(3);
        assertThat(all.path("items").get(0).path("source").asText()).isEqualTo("AUDIT");
        assertThat(all.path("items").get(2).path("operator_name").asText()).isEqualTo(opId);
        asAdmin("/v1/operator/activity-logs?operator=" + opId).andExpect(jsonPath("$.total").value(2));
        asAdmin("/v1/operator/activity-logs?action=incident_created").andExpect(jsonPath("$.total").value(1));
        mvc.perform(get("/v1/operator/activity-logs").param("search", "db slow").header("Authorization", "Bearer " + admin)).andExpect(jsonPath("$.total").value(1));
        mvc.perform(get("/v1/operator/activity-logs").param("search", "100%").header("Authorization", "Bearer " + admin)).andExpect(jsonPath("$.total").value(0));
        mvc.perform(get("/v1/operator/activity-logs").param("from", java.time.Instant.now().minusSeconds(5400).toString()).header("Authorization", "Bearer " + admin))
                .andExpect(jsonPath("$.total").value(2));
        asAdmin("/v1/operator/activity-logs?size=2&page=1").andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.total").value(3));
        asAdmin("/v1/operator/activity-logs?from=2030-01-01T00:00:00Z&to=2020-01-01T00:00:00Z")
                .andExpect(status().isBadRequest());
    }

    @Test
    void departmentPermissionsAndOverridesAreEnforced() throws Exception {
        String financeId = ConsoleSessions.operatorId("fin");
        String finance = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, financeId, "DEPARTMENT_OPERATOR", "finance-tax");
        as(finance, "/v1/operator/subscriptions").andExpect(status().isOk());
        as(finance, "/v1/operator/payments/failures").andExpect(status().isOk());
        as(finance, "/v1/operator/invoices/delivery").andExpect(status().isOk());
        for (String denied : List.of("/v1/operator/activity-logs", "/v1/operator/organizations", "/v1/operator/api-errors",
                "/v1/operator/api-errors/summary", "/v1/operator/backups", "/v1/operator/email-drafts",
                "/v1/operator/announcement-drafts")) {
            as(finance, denied).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
        // An individual DENY beats the department default; an individual GRANT adds a module.
        jdbc.update("INSERT INTO operator_permission_overrides (operator_id, module_key, permission_action, override_type) "
                + "VALUES (?, 'billing.subscriptions', 'view', 'DENY')", financeId);
        jdbc.update("INSERT INTO operator_permission_overrides (operator_id, module_key, permission_action, override_type) "
                + "VALUES (?, 'audit.activity_logs', 'view', 'GRANT')", financeId);
        as(finance, "/v1/operator/subscriptions").andExpect(status().isForbidden());
        as(finance, "/v1/operator/activity-logs").andExpect(status().isOk());

        String main = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, ConsoleSessions.operatorId("main"),
                "MAIN_PLATFORM_OPERATOR", null);
        for (String path : READ_ENDPOINTS) {
            as(main, path).andExpect(status().isOk());
        }
        String sre = ConsoleSessions.operator(mvc, jdbc, encoder, mapper, ConsoleSessions.operatorId("sre"),
                "DEPARTMENT_OPERATOR", "site-reliability");
        as(sre, "/v1/operator/api-errors").andExpect(status().isOk());
        as(sre, "/v1/operator/backups").andExpect(status().isOk());
        as(sre, "/v1/operator/subscriptions").andExpect(status().isForbidden());
    }

    // ---------------------------------------------------------------- helpers

    private ResultActions asAdmin(String path) throws Exception {
        return as(admin, path);
    }

    private ResultActions as(String token, String path) throws Exception {
        return mvc.perform(get(path).header("Authorization", "Bearer " + token));
    }

    private JsonNode json(ResultActions actions) throws Exception {
        return mapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private static String kpi(JsonNode dashboard, String label) {
        for (JsonNode k : dashboard.path("kpis")) {
            if (label.equals(k.path("label").asText())) return k.path("value").asText();
        }
        throw new AssertionError("No KPI " + label + " in " + dashboard.path("kpis"));
    }

    private UUID org(String name, String slug, String state) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO organizations (id, name, slug, timezone, state) VALUES (?, ?, ?, 'UTC', ?)", id, name, slug, state);
        return id;
    }

    private UUID user(String email) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, password_hash, name, status) VALUES (?, ?, 'x', 'U', 'ACTIVE')", id, email);
        return id;
    }

    private void membership(UUID org, UUID user, String role, String status) {
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template, status) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID(), org, user, role, status);
    }

    private void project(UUID org, UUID owner, String lifecycle) {
        String id = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO projects (id, org_id, key, name, mode, member_ids, accountable_owner_id, lifecycle) "
                + "VALUES (?, ?, ?, 'P', 'STRUCTURED', ?, ?, ?)", id, org, "K" + id.substring(0, 6), owner.toString(),
                owner.toString(), lifecycle);
    }

    private void plan(String id, String code, String name) {
        jdbc.update("INSERT INTO plans (id, code, name) VALUES (?, ?, ?)", id, code, name);
    }

    private void subscription(String id, UUID org, String plan, String status) {
        jdbc.update("INSERT INTO subscriptions (id, org_id, plan_id, status, seats) VALUES (?, ?, ?, ?, 5)", id, org, plan, status);
    }
}
