package com.prowise.superadmin.users;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import jakarta.mail.BodyPart;
import jakarta.mail.Multipart;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

/**
 * Approved decisions 2, 3 and 4: accounts are provisioned without any administrator-known password,
 * owners set their own password through an expiring single-use link, and nothing secret is returned or logged.
 */
@SpringBootTest(properties = "spring.mail.username=test-smtp-user")
// No MockMvc request dumps: the log assertion below must see application output only, not the test harness echoing bodies.
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ExtendWith(OutputCaptureExtension.class)
@Tag("NFR-06")
@Tag("NFR-12")
class AccountSetupIntegrationTest {

    private static final String ADMIN_PASSWORD = "Admin-Test-Password-1";
    private static final String NEW_PASSWORD = "Chosen-By-Owner-Pass-9";
    private static final Pattern SETUP_LINK = Pattern.compile("reset-password\\?token=([A-Za-z0-9_-]+)");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ObjectMapper objectMapper;

    @MockitoBean private JavaMailSender mailSender;

    /** Unique per test: the sign-in rate limiter (10 per minute per address) is shared across tests. */
    private String adminEmail;
    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        reset(mailSender);
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
        adminEmail = "platform.admin." + UUID.randomUUID() + "@test.prowise";
        insertUser(adminEmail, ADMIN_PASSWORD, "SUPER_ADMIN");
        adminToken = login(adminEmail, ADMIN_PASSWORD);
    }

    // ---------- authorization on every users endpoint ----------

    @Test
    void anonymousCallersAreRejectedOnEveryUserEndpoint() throws Exception {
        UUID someone = insertUser("someone@test.prowise", "Someone-Test-Pass-1", "VIEWER");
        for (MockHttpServletRequestBuilder request : allUserEndpoints(someone)) {
            mockMvc.perform(request).andExpect(status().isUnauthorized());
        }
        assertThat(count("SELECT count(*) FROM password_reset_tokens")).isZero();
    }

    @Test
    void tenantUsersAndOperatorsAreForbiddenOnEveryUserEndpoint() throws Exception {
        UUID someone = insertUser("someone@test.prowise", "Someone-Test-Pass-1", "VIEWER");
        insertUser("dev@test.prowise", "Developer-Test-Pass-1", "DEVELOPER");
        insertUser("ops@test.prowise", "Operator-Test-Pass-1", "PLATFORM_OPERATOR");
        for (String token : List.of(login("dev@test.prowise", "Developer-Test-Pass-1"),
                login("ops@test.prowise", "Operator-Test-Pass-1"))) {
            for (MockHttpServletRequestBuilder request : allUserEndpoints(someone)) {
                mockMvc.perform(request.header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
            }
        }
    }

    // ---------- provisioning ----------

    @Test
    void createdAccountIsPendingAndNoPasswordIsReturnedOrEmailed() throws Exception {
        String body = mockMvc.perform(asAdmin(post("/v1/admin/users"))
                        .contentType("application/json")
                        .content("""
                                {"name":"Jane Doe","email":"jane@test.prowise","role":"DEVELOPER",
                                 "custom_password":"Admin-Chosen-Pass-1"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING_ACTIVATION"))
                .andExpect(jsonPath("$.email_delivery_status").value("SMTP_ACCEPTED"))
                .andReturn().getResponse().getContentAsString();

        JsonNode json = objectMapper.readTree(body);
        assertThat(json.has("temp_password")).isFalse();
        assertThat(body).doesNotContain("Admin-Chosen-Pass-1");

        UUID userId = UUID.fromString(json.get("id").asText());
        String hash = jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, userId);
        assertThat(passwordEncoder.matches("Admin-Chosen-Pass-1", hash)).isFalse();

        String html = onlySentEmailHtml();
        assertThat(html).doesNotContainIgnoringCase("temporary password").doesNotContain("Admin-Chosen-Pass-1");
        String token = tokenFrom(html);

        Map<String, Object> row = jdbc.queryForMap(
                "SELECT token_hash, purpose, used_at, EXTRACT(EPOCH FROM (expires_at - now()))::bigint AS remaining_seconds "
                        + "FROM password_reset_tokens WHERE user_id = ?", userId);
        assertThat(row.get("purpose")).isEqualTo("SETUP");
        assertThat(row.get("token_hash")).isEqualTo(sha256(token));
        assertThat(row.get("used_at")).isNull();
        // Database clock, so JVM/container clock skew cannot make this flaky.
        assertThat(Duration.ofSeconds(((Number) row.get("remaining_seconds")).longValue()))
                .isBetween(Duration.ofHours(71), Duration.ofHours(72));
        assertThat(count("SELECT count(*) FROM password_reset_tokens WHERE token_hash = ?", token)).isZero();

        assertThat(jdbc.queryForObject(
                "SELECT status FROM email_delivery_logs WHERE user_id = ? AND email_type = 'ACCOUNT_SETUP'",
                String.class, userId)).isEqualTo("SMTP_ACCEPTED");
    }

    @Test
    void pendingAccountCannotSignInUntilSetupIsCompletedAndTheLinkWorksOnce() throws Exception {
        UUID userId = createUserAsAdmin("owner@test.prowise");
        String token = tokenFrom(onlySentEmailHtml());

        // Even a correct-looking password cannot open a pending account.
        jdbc.update("UPDATE users SET password_hash = ? WHERE id = ?", passwordEncoder.encode(NEW_PASSWORD), userId);
        mockMvc.perform(post("/v1/auth/login").contentType("application/json")
                        .content(credentials("owner@test.prowise", NEW_PASSWORD)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_PENDING_ACTIVATION"));

        completeSetup(token, NEW_PASSWORD).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, userId)).isEqualTo("ACTIVE");
        login("owner@test.prowise", NEW_PASSWORD);

        completeSetup(token, "Another-Owner-Pass-2").andExpect(status().isUnauthorized());
    }

    @Test
    void expiredSetupLinkIsRejected() throws Exception {
        UUID userId = createUserAsAdmin("late@test.prowise");
        String token = tokenFrom(onlySentEmailHtml());
        jdbc.update("UPDATE password_reset_tokens SET expires_at = now() - interval '1 minute' WHERE user_id = ?", userId);

        completeSetup(token, NEW_PASSWORD).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, userId))
                .isEqualTo("PENDING_ACTIVATION");
    }

    @Test
    void resendSupersedesTheEarlierSetupLink() throws Exception {
        UUID userId = createUserAsAdmin("resend@test.prowise");
        String first = tokenFrom(onlySentEmailHtml());
        reset(mailSender);
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));

        mockMvc.perform(asAdmin(post("/v1/admin/users/{id}/resend-invitation", userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email_delivery_status").value("SMTP_ACCEPTED"))
                .andExpect(jsonPath("$.temp_password").doesNotExist());
        String second = tokenFrom(onlySentEmailHtml());
        assertThat(second).isNotEqualTo(first);

        completeSetup(first, NEW_PASSWORD).andExpect(status().isUnauthorized());
        completeSetup(second, NEW_PASSWORD).andExpect(status().isNoContent());
    }

    @Test
    void resendIsRefusedForAnAccountThatIsAlreadyActive() throws Exception {
        UUID active = insertUser("active@test.prowise", "Active-Test-Pass-1", "DEVELOPER");
        mockMvc.perform(asAdmin(post("/v1/admin/users/{id}/resend-invitation", active)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACCOUNT_ALREADY_ACTIVE"));
    }

    @Test
    void failedSetupEmailKeepsThePendingAccountAndShowsASafeMessage() throws Exception {
        doThrow(new MailSendException("smtp.internal.example:587 rejected credentials for relay-user"))
                .when(mailSender).send(any(MimeMessage.class));

        String body = mockMvc.perform(asAdmin(post("/v1/admin/users")).contentType("application/json")
                        .content("{\"name\":\"Fail Case\",\"email\":\"fail@test.prowise\",\"role\":\"VIEWER\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING_ACTIVATION"))
                .andExpect(jsonPath("$.email_delivery_status").value("FAILED"))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("smtp.internal.example").doesNotContain("relay-user");

        UUID userId = UUID.fromString(objectMapper.readTree(body).get("id").asText());
        assertThat(jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, userId))
                .isEqualTo("PENDING_ACTIVATION");

        // The administrator sees the failure on the account and can resend once email works again.
        mockMvc.perform(asAdmin(get("/v1/admin/users/{id}", userId)))
                .andExpect(jsonPath("$.email_delivery_status").value("FAILED"));
    }

    @Test
    void privilegedRolesCannotBeAssignedThroughTheUsersApi() throws Exception {
        for (String role : List.of("SUPER_ADMIN", "PLATFORM_SUPER_ADMIN", "PLATFORM_OPERATOR", "super_admin")) {
            mockMvc.perform(asAdmin(post("/v1/admin/users")).contentType("application/json")
                            .content("{\"email\":\"" + UUID.randomUUID() + "@test.prowise\",\"role\":\"" + role + "\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("ROLE_NOT_ASSIGNABLE"));
        }
        UUID viewer = insertUser("viewer@test.prowise", "Viewer-Test-Pass-1", "VIEWER");
        mockMvc.perform(asAdmin(put("/v1/admin/users/{id}", viewer)).contentType("application/json")
                        .content("{\"role\":\"SUPER_ADMIN\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("ROLE_NOT_ASSIGNABLE"));

        assertThat(jdbc.queryForObject("SELECT role FROM users WHERE id = ?", String.class, viewer)).isEqualTo("VIEWER");
        assertThat(count("SELECT count(*) FROM users WHERE role IN ('SUPER_ADMIN','PLATFORM_OPERATOR') AND lower(email) <> ?",
                adminEmail)).isZero();
        assertThat(count("SELECT count(*) FROM auth_audit_logs WHERE action = 'PRIVILEGED_ROLE_ASSIGNMENT_DENIED' "
                + "AND actor_email = ?", adminEmail)).isEqualTo(5);
    }

    @Test
    void pendingAccountCannotBeSwitchedToActiveThroughTheStatusEndpoint() throws Exception {
        UUID userId = createUserAsAdmin("skip@test.prowise");
        mockMvc.perform(asAdmin(patch("/v1/admin/users/{id}/status", userId)).contentType("application/json")
                        .content("{\"status\":\"ACTIVE\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACCOUNT_PENDING_ACTIVATION"));
    }

    // ---------- administrator-triggered reset ----------

    @Test
    void adminResetSendsAThirtyMinuteLinkRevokesSessionsAndReturnsNoPassword() throws Exception {
        UUID userId = insertUser("member@test.prowise", "Member-Old-Pass-1", "DEVELOPER");
        login("member@test.prowise", "Member-Old-Pass-1");

        mockMvc.perform(asAdmin(post("/v1/admin/users/{id}/reset-password", userId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.temp_password").doesNotExist())
                .andExpect(jsonPath("$.email_delivery_status").value("SMTP_ACCEPTED"));

        assertThat(count("SELECT count(*) FROM sessions WHERE user_id = ? AND revoked_at IS NULL", userId)).isZero();
        // Measured against the database clock: the test JVM and the database container can differ by milliseconds.
        Map<String, Object> row = jdbc.queryForMap(
                "SELECT purpose, EXTRACT(EPOCH FROM (expires_at - now()))::bigint AS remaining_seconds "
                        + "FROM password_reset_tokens WHERE user_id = ?", userId);
        assertThat(row.get("purpose")).isEqualTo("RESET");
        assertThat(Duration.ofSeconds(((Number) row.get("remaining_seconds")).longValue()))
                .isBetween(Duration.ofMinutes(29), Duration.ofMinutes(30));

        completeSetup(tokenFrom(onlySentEmailHtml()), NEW_PASSWORD).andExpect(status().isNoContent());
        login("member@test.prowise", NEW_PASSWORD);
    }

    @Test
    void forgotPasswordIssuesNothingForAPendingAccount() throws Exception {
        UUID userId = createUserAsAdmin("quiet@test.prowise");
        reset(mailSender);
        mockMvc.perform(post("/v1/auth/forgot-password").contentType("application/json")
                        .content("{\"email\":\"quiet@test.prowise\"}"))
                .andExpect(status().isAccepted());
        assertThat(count("SELECT count(*) FROM password_reset_tokens WHERE user_id = ? AND purpose = 'RESET'", userId)).isZero();
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void setupTokensAndPasswordsNeverReachTheLogs(CapturedOutput output) throws Exception {
        createUserAsAdmin("logs@test.prowise");
        String token = tokenFrom(onlySentEmailHtml());
        completeSetup(token, NEW_PASSWORD).andExpect(status().isNoContent());

        assertThat(output.getAll()).doesNotContain(token).doesNotContain(NEW_PASSWORD).doesNotContain(ADMIN_PASSWORD)
                .doesNotContain(sha256(token));
    }

    // ---------- helpers ----------

    private List<MockHttpServletRequestBuilder> allUserEndpoints(UUID id) {
        return List.of(
                post("/v1/admin/users").contentType("application/json").content("{\"email\":\"x@test.prowise\"}"),
                get("/v1/admin/users"),
                get("/v1/admin/users/{id}", id),
                put("/v1/admin/users/{id}", id).contentType("application/json").content("{\"name\":\"x\"}"),
                patch("/v1/admin/users/{id}/status", id).contentType("application/json").content("{\"status\":\"DISABLED\"}"),
                post("/v1/admin/users/{id}/reset-password", id),
                post("/v1/admin/users/{id}/resend-invitation", id),
                get("/v1/admin/users/{id}/login-history", id));
    }

    private UUID createUserAsAdmin(String email) throws Exception {
        String body = mockMvc.perform(asAdmin(post("/v1/admin/users")).contentType("application/json")
                        .content("{\"name\":\"Test Owner\",\"email\":\"" + email + "\",\"role\":\"DEVELOPER\"}"))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return UUID.fromString(objectMapper.readTree(body).get("id").asText());
    }

    private MockHttpServletRequestBuilder asAdmin(MockHttpServletRequestBuilder request) {
        return request.header("Authorization", "Bearer " + adminToken);
    }

    private org.springframework.test.web.servlet.ResultActions completeSetup(String token, String password) throws Exception {
        return mockMvc.perform(post("/v1/auth/reset-password").contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of("token", token, "password", password))));
    }

    private String login(String email, String password) throws Exception {
        String body = mockMvc.perform(post("/v1/auth/login").contentType("application/json")
                        .content(credentials(email, password)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).get("access_token").asText();
    }

    private String credentials(String email, String password) throws Exception {
        return objectMapper.writeValueAsString(Map.of("email", email, "password", password));
    }

    private UUID insertUser(String email, String password, String role) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, password_hash, name, role, status, must_change_password) "
                + "VALUES (?, ?, ?, ?, ?, 'ACTIVE', false)", id, email, passwordEncoder.encode(password), email, role);
        return id;
    }

    private String onlySentEmailHtml() throws Exception {
        ArgumentCaptor<MimeMessage> captor = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(captor.capture());
        return htmlOf(captor.getValue().getContent());
    }

    private static String htmlOf(Object content) throws Exception {
        if (content instanceof String text) return text;
        if (content instanceof Multipart multipart) {
            StringBuilder all = new StringBuilder();
            for (int i = 0; i < multipart.getCount(); i++) {
                BodyPart part = multipart.getBodyPart(i);
                all.append(htmlOf(part.getContent()));
            }
            return all.toString();
        }
        return "";
    }

    private static String tokenFrom(String html) {
        Matcher matcher = SETUP_LINK.matcher(html);
        assertThat(matcher.find()).as("email contains a reset-password link").isTrue();
        return matcher.group(1);
    }

    private long count(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    private static String sha256(String value) throws Exception {
        return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    }
}
