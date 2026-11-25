package com.prowise.superadmin.emailproviders;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
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
import com.prowise.testsupport.FakeSmtpServer;
import com.prowise.testsupport.TestAccounts;

/**
 * SMTP administration end to end: real settings persistence (secret encrypted, never returned), real connection
 * tests and real test emails against a local SMTP socket, real delivery logs, and Super Admin-only access.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("SMTP")
class SmtpAdminIntegrationTest {

    private static final String ADMIN_PASSWORD = "Admin-Own-Password-1";
    private static final String OPERATOR_PASSWORD = "Operator-Own-Pass-123";
    private static final String SMTP_SECRET = "abcd efgh ijkl mnop";
    private static final String BASE = "/v1/admin/smtp";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ObjectMapper objectMapper;

    private String adminToken;
    private String suffix;

    @BeforeEach
    void setUp() throws Exception {
        resetSmtpState();
        TestDatabase.clean(jdbc);
        suffix = UUID.randomUUID().toString().substring(0, 8);
        String adminEmail = "smtp-admin-" + suffix + "@test.prowise";
        jdbc.update("INSERT INTO users (id, email, password_hash, name, role, status, must_change_password) "
                + "VALUES (gen_random_uuid(), ?, ?, 'Admin', 'SUPER_ADMIN', 'ACTIVE', false)",
                adminEmail, passwordEncoder.encode(ADMIN_PASSWORD));
        adminToken = json(mockMvc.perform(post("/v1/auth/login").contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("email", adminEmail, "password", ADMIN_PASSWORD))))
                .andExpect(status().isOk())).path("access_token").asText();
    }

    @AfterEach
    void tearDown() {
        resetSmtpState();
        jdbc.update("DELETE FROM platform_operators WHERE lower(email) LIKE ?", "%-" + suffix + "@ops.test");
    }

    private void resetSmtpState() {
        jdbc.update("DELETE FROM smtp_connection_tests");
        jdbc.update("DELETE FROM email_delivery_logs");
        jdbc.update("""
                UPDATE email_providers SET admin_configured = false, password_encrypted = NULL, password_updated_at = NULL,
                    connection_status = 'NOT_TESTED', last_tested_at = NULL, last_test_message = NULL
                """);
    }

    @Test
    void freshInstallIsNotTestedAndNeverClaimsConnected() throws Exception {
        asAdmin(get(BASE + "/settings"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.connection_status").value("NOT_TESTED"))
                .andExpect(jsonPath("$.last_tested_at").doesNotExist())
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void savingEncryptsThePasswordNeverReturnsItAndDoesNotMeanConnected() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(FakeSmtpServer.Mode.NORMAL)) {
            JsonNode saved = save(server.port(), SMTP_SECRET, currentVersion());
            String body = saved.toString();

            assertThat(body).doesNotContain(SMTP_SECRET).doesNotContain("abcd");
            assertThat(saved.path("credentials_configured").asBoolean()).isTrue();
            assertThat(saved.path("password_source").asText()).isEqualTo("DATABASE");
            assertThat(saved.path("connection_status").asText()).isEqualTo("NOT_TESTED");

            String stored = jdbc.queryForObject("SELECT password_encrypted FROM email_providers WHERE id = 'provider-default'", String.class);
            assertThat(stored).startsWith("v1:").doesNotContain("abcd");

            // A later save without a password keeps the stored secret.
            JsonNode again = save(server.port(), null, saved.path("version").asLong());
            assertThat(again.path("credentials_configured").asBoolean()).isTrue();
            assertThat(jdbc.queryForObject("SELECT password_encrypted FROM email_providers WHERE id = 'provider-default'", String.class))
                    .isEqualTo(stored);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_logs WHERE action = 'UPDATE_SMTP_CONFIG'", Integer.class))
                    .isGreaterThanOrEqualTo(2);
        }
    }

    @Test
    void staleVersionIsRejected() throws Exception {
        long version = currentVersion();
        save(7, SMTP_SECRET, version);
        asAdmin(put(BASE + "/settings"), settingsBody(7, null, version))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"));
    }

    @Test
    void unencryptedTransportIsOnlyAllowedForALoopbackRelay() throws Exception {
        Map<String, Object> body = settingsBody(587, SMTP_SECRET, currentVersion());
        body.put("host", "smtp.example.com");
        asAdmin(put(BASE + "/settings"), body)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void connectionTestReportsTheRealResultAndRecordsIt() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(FakeSmtpServer.Mode.AUTH_REJECT)) {
            save(server.port(), SMTP_SECRET, currentVersion());

            asAdmin(post(BASE + "/test-connection"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("AUTHENTICATION_FAILED"))
                    .andExpect(jsonPath("$.tested_at").isNotEmpty());
            asAdmin(get(BASE + "/settings")).andExpect(jsonPath("$.connection_status").value("AUTHENTICATION_FAILED"));

            server.mode(FakeSmtpServer.Mode.NORMAL);
            asAdmin(post(BASE + "/test-connection"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("CONNECTED"));
            asAdmin(get(BASE + "/settings"))
                    .andExpect(jsonPath("$.connection_status").value("CONNECTED"))
                    .andExpect(jsonPath("$.last_tested_at").isNotEmpty());

            List<String> recorded = jdbc.queryForList("SELECT status FROM smtp_connection_tests ORDER BY tested_at", String.class);
            assertThat(recorded).containsExactly("AUTHENTICATION_FAILED", "CONNECTED");
        }
    }

    @Test
    void testEmailIsReallySentAndLoggedWithTheServersReply() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(FakeSmtpServer.Mode.NORMAL)) {
            save(server.port(), SMTP_SECRET, currentVersion());

            JsonNode result = json(asAdmin(post(BASE + "/test-email"), Map.of("recipient", "owner@example.test"))
                    .andExpect(status().isOk()));

            assertThat(result.path("accepted").asBoolean()).isTrue();
            assertThat(result.path("status").asText()).isEqualTo("SMTP_ACCEPTED");
            assertThat(result.path("smtp_response").asText()).isEqualTo(FakeSmtpServer.QUEUE_REPLY);
            assertThat(result.path("message_id").asText()).isNotBlank();
            assertThat(result.path("sender").asText()).isEqualTo("mailer@example.test");
            assertThat(server.messages()).hasSize(1);
            assertThat(server.messages().get(0)).contains("Subject: ProWise SMTP Email Verification")
                    .contains("This is a real SMTP verification email from ProWise Platform.");

            Map<String, Object> row = jdbc.queryForMap("SELECT * FROM email_delivery_logs WHERE email_type = 'SMTP_TEST'");
            assertThat(row.get("status")).isEqualTo("SMTP_ACCEPTED");
            assertThat(row.get("message_id")).isNotNull();
            assertThat(row.get("smtp_response")).isEqualTo(FakeSmtpServer.QUEUE_REPLY);
            assertThat(row.get("sent_at")).isNotNull();
        }
    }

    @Test
    void failedTestEmailIsLoggedAsFailedWithoutASentDate() throws Exception {
        try (FakeSmtpServer server = new FakeSmtpServer(FakeSmtpServer.Mode.AUTH_REJECT)) {
            save(server.port(), SMTP_SECRET, currentVersion());

            asAdmin(post(BASE + "/test-email"), Map.of("recipient", "owner@example.test"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.accepted").value(false))
                    .andExpect(jsonPath("$.status").value("FAILED"))
                    .andExpect(jsonPath("$.error").isNotEmpty());

            Map<String, Object> row = jdbc.queryForMap("SELECT * FROM email_delivery_logs WHERE email_type = 'SMTP_TEST'");
            assertThat(row.get("status")).isEqualTo("FAILED");
            assertThat(row.get("sent_at")).isNull();
            assertThat(String.valueOf(row.get("error_message"))).doesNotContain(SMTP_SECRET);
        }
    }

    @Test
    void invalidRecipientIsRejected() throws Exception {
        asAdmin(post(BASE + "/test-email"), Map.of("recipient", "not-an-address"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deliveryLogsArePagedAndFilterable() throws Exception {
        insertLog("a@example.test", "SMTP_ACCEPTED", "ACCOUNT_SETUP", "2026-11-01T10:00:00Z");
        insertLog("b@example.test", "FAILED", "PASSWORD_RESET", "2026-11-10T10:00:00Z");
        insertLog("c@other.test", "SMTP_ACCEPTED", "SMTP_TEST", "2026-11-20T10:00:00Z");

        JsonNode all = json(asAdmin(get(BASE + "/logs?page=0&size=2")).andExpect(status().isOk()));
        assertThat(all.path("total").asLong()).isEqualTo(3);
        assertThat(all.path("items")).hasSize(2);
        assertThat(all.path("items").get(0).path("recipient").asText()).isEqualTo("c@other.test");

        assertThat(json(asAdmin(get(BASE + "/logs?status=FAILED"))).path("total").asLong()).isEqualTo(1);
        assertThat(json(asAdmin(get(BASE + "/logs?type=SMTP_TEST"))).path("total").asLong()).isEqualTo(1);
        assertThat(json(asAdmin(get(BASE + "/logs?q=example.test"))).path("total").asLong()).isEqualTo(2);
        assertThat(json(asAdmin(get(BASE + "/logs?from=2026-11-05T00:00:00Z&to=2026-11-15T00:00:00Z"))).path("total").asLong())
                .isEqualTo(1);
    }

    @Test
    void onlyTheSuperAdminCanReachSmtpAdministration() throws Exception {
        String operatorEmail = "main-" + suffix + "@ops.test";
        jdbc.update("""
                INSERT INTO platform_operators (id, name, email, role_id, access_level, department_id, status,
                    password_hash, password_setup_completed)
                VALUES (?, 'Main', ?, 'role-platform-operator', 'MAIN_PLATFORM_OPERATOR', NULL, 'ACTIVE', ?, true)
                """, "op-smtp-" + suffix, operatorEmail, passwordEncoder.encode(OPERATOR_PASSWORD));
        String operatorToken = json(mockMvc.perform(post("/v1/auth/operator/login")
                        .with(com.prowise.testsupport.TestAccounts.randomClient())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("email", operatorEmail, "password", OPERATOR_PASSWORD))))
                .andExpect(status().isOk())).path("access_token").asText();

        List<MockHttpServletRequestBuilder> routes = List.of(
                get(BASE + "/settings"), put(BASE + "/settings"), post(BASE + "/test-connection"),
                post(BASE + "/test-email"), post(BASE + "/verify-sender"), get(BASE + "/logs"));
        for (MockHttpServletRequestBuilder route : routes) {
            mockMvc.perform(route.header("Authorization", "Bearer " + operatorToken)
                    .contentType("application/json").content("{}")).andExpect(status().isForbidden());
        }
        for (MockHttpServletRequestBuilder route : List.of(get(BASE + "/settings"), post(BASE + "/test-email"), get(BASE + "/logs"))) {
            mockMvc.perform(route.contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
        }
        // Operators keep read-only visibility of delivery logs, but cannot fake a delivery through "retry".
        insertLog("x@example.test", "FAILED", "PASSWORD_RESET", "2026-11-20T10:00:00Z");
        mockMvc.perform(get("/v1/operator/email/delivery").header("Authorization", "Bearer " + operatorToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("FAILED"));
        mockMvc.perform(post("/v1/operator/email/log-x/retry").header("Authorization", "Bearer " + operatorToken))
                .andExpect(status().isConflict());
        assertThat(jdbc.queryForObject("SELECT status FROM email_delivery_logs WHERE id = 'log-x'", String.class)).isEqualTo("FAILED");
    }

    /* ------------------------------------------------------------------ helpers */

    private long currentVersion() throws Exception {
        return json(asAdmin(get(BASE + "/settings"))).path("version").asLong();
    }

    private JsonNode save(int port, String password, long version) throws Exception {
        return json(asAdmin(put(BASE + "/settings"), settingsBody(port, password, version)).andExpect(status().isOk()));
    }

    private static Map<String, Object> settingsBody(int port, String password, long version) {
        Map<String, Object> body = new HashMap<>();
        body.put("provider", "SMTP_CUSTOM");
        body.put("host", "127.0.0.1");
        body.put("port", port);
        body.put("encryption", "NONE");
        body.put("username", "mailer@example.test");
        if (password != null) body.put("password", password);
        body.put("from_name", "ProWise Platform");
        body.put("from_email", "mailer@example.test");
        body.put("reply_to_email", "support@example.test");
        body.put("rate_limit_per_minute", 60);
        body.put("retry_attempts", 1);
        body.put("retry_wait_seconds", 0);
        body.put("expected_version", version);
        return body;
    }

    private void insertLog(String recipient, String status, String type, String createdAt) {
        String id = recipient.startsWith("x@") ? "log-x" : "eml_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        jdbc.update("""
                INSERT INTO email_delivery_logs (id, recipient, subject, provider, status, attempts, created_at, sent_at, email_type)
                VALUES (?, ?, 'Subject', 'SMTP', ?, 1, CAST(? AS timestamptz),
                        CASE WHEN ? = 'SMTP_ACCEPTED' THEN CAST(? AS timestamptz) END, ?)
                """, id, recipient, status, createdAt, status, createdAt, type);
    }

    private ResultActions asAdmin(MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request.header("Authorization", "Bearer " + adminToken));
    }

    private ResultActions asAdmin(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return mockMvc.perform(request.header("Authorization", "Bearer " + adminToken)
                .contentType("application/json").content(objectMapper.writeValueAsString(body)));
    }

    private JsonNode json(ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }
}
