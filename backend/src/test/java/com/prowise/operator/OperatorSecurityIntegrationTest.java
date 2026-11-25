package com.prowise.operator;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.test.web.servlet.MvcResult;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.testsupport.CapturedMail;
import com.prowise.testsupport.TestAccounts;

/**
 * Approved decision D5 (Phase 2): only Super Admin manages platform operators; no operator, Main or department,
 * can create operators or change any access level, department, permission or status. Operator login, refresh
 * rotation, single-use reset links and session invalidation are verified over HTTP.
 */
@SpringBootTest(properties = "spring.mail.username=test-smtp-user")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@Tag("NFR-06")
class OperatorSecurityIntegrationTest {

    private static final String OPERATOR_PASSWORD = "Operator-Own-Pass-123";
    private static final String ADMIN_PASSWORD = "Admin-Own-Password-1";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private ObjectMapper objectMapper;

    @MockitoBean private JavaMailSender mailSender;

    private String suffix;
    private String mainId;
    private String deptId;
    private String mainEmail;
    private String deptEmail;
    private String adminToken;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        reset(mailSender);
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
        suffix = UUID.randomUUID().toString().substring(0, 8);
        mainId = "op-tm-" + suffix;
        deptId = "op-td-" + suffix;
        mainEmail = "main-" + suffix + "@ops.test";
        deptEmail = "dept-" + suffix + "@ops.test";
        insertOperator(mainId, mainEmail, "MAIN_PLATFORM_OPERATOR", null);
        insertOperator(deptId, deptEmail, "DEPARTMENT_OPERATOR", "finance-tax");

        String adminEmail = "admin-" + suffix + "@test.prowise";
        jdbc.update("INSERT INTO users (id, email, password_hash, name, role, status, must_change_password) "
                + "VALUES (gen_random_uuid(), ?, ?, 'Admin', 'SUPER_ADMIN', 'ACTIVE', false)",
                adminEmail, passwordEncoder.encode(ADMIN_PASSWORD));
        adminToken = json(mockMvc.perform(post("/v1/auth/login").contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("email", adminEmail, "password", ADMIN_PASSWORD))))
                .andExpect(status().isOk())).path("access_token").asText();
    }

    @AfterEach
    void removeOperators() {
        jdbc.update("DELETE FROM platform_operators WHERE id LIKE ? OR lower(email) LIKE ?", "op-t%-" + suffix, "%-" + suffix + "@ops.test");
    }

    @Test
    void neitherMainNorDepartmentOperatorsCanManageOperators() throws Exception {
        for (String email : List.of(mainEmail, deptEmail)) {
            String token = operatorLogin(email, OPERATOR_PASSWORD).path("access_token").asText();
            for (MockHttpServletRequestBuilder request : managementRequests(deptId)) {
                mockMvc.perform(request.header("Authorization", "Bearer " + token))
                        .andExpect(status().isForbidden());
            }
            // Reads stay available to operators.
            mockMvc.perform(get("/v1/operators").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        }
        Map<String, Object> dept = jdbc.queryForMap("SELECT access_level, department_id, status, role_id FROM platform_operators WHERE id = ?", deptId);
        assertThat(dept).containsEntry("access_level", "DEPARTMENT_OPERATOR").containsEntry("department_id", "finance-tax")
                .containsEntry("status", "ACTIVE").containsEntry("role_id", "role-platform-operator");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM platform_operators WHERE lower(email) = ?", Integer.class,
                "escalated-" + suffix + "@ops.test")).isZero();
    }

    @Test
    void superAdminCreatesOperatorsOnlyAsInvitedWithAnEmailedInvitation() throws Exception {
        String email = "new-" + suffix + "@ops.test";
        asAdmin(post("/v1/operators"), Map.of("name", "New Op", "email", email, "access_level", "DEPARTMENT_OPERATOR",
                        "department", "trust-compliance", "status", "ACTIVE"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("INVITED"));

        Map<String, Object> row = jdbc.queryForMap("SELECT status, password_setup_completed, department_id, password_hash "
                + "FROM platform_operators WHERE lower(email) = ?", email);
        assertThat(row).containsEntry("status", "INVITED").containsEntry("password_setup_completed", false)
                .containsEntry("department_id", "trust-compliance");
        assertThat(passwordEncoder.matches("Operator2026!", (String) row.get("password_hash"))).isFalse();
        String html = CapturedMail.sentHtml(mailSender).get(0);
        assertThat(html).contains("/operator/login").contains(email).doesNotContain("invite=");
        assertThat(temporaryPasswordIn(html)).hasSizeGreaterThanOrEqualTo(16);
    }

    @Test
    void anEmailedTemporaryPasswordMustBeReplacedBeforeTheFirstSessionAndWorksOnlyOnce() throws Exception {
        String email = "temp-" + suffix + "@ops.test";
        asAdmin(post("/v1/operators"), Map.of("name", "Temp Op", "email", email, "access_level", "DEPARTMENT_OPERATOR",
                        "department", "trust-compliance"))
                .andExpect(status().isCreated());
        String temporaryPassword = temporaryPasswordIn(CapturedMail.sentHtml(mailSender).get(0));
        String operatorId = jdbc.queryForObject("SELECT id FROM platform_operators WHERE lower(email) = ?", String.class, email);
        int sessionsBefore = jdbc.queryForObject("SELECT count(*) FROM operator_sessions WHERE operator_id = ?", Integer.class, operatorId);

        // The temporary password proves who they are, but opens no session: a new password comes first.
        operatorPost("/v1/auth/operator/login", Map.of("email", email, "password", temporaryPassword))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"))
                .andExpect(jsonPath("$.access_token").doesNotExist());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM operator_sessions WHERE operator_id = ?", Integer.class, operatorId))
                .isEqualTo(sessionsBefore);

        // The password policy applies to the replacement and a weak attempt does not burn the temporary password.
        operatorPost("/v1/auth/operator/accept-invitation", Map.of("token", temporaryPassword, "new_password", "alllowercaseletters"))
                .andExpect(status().isBadRequest());
        operatorPost("/v1/auth/operator/accept-invitation", Map.of("token", temporaryPassword, "new_password", "Chosen-Operator-Pass-7!"))
                .andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("SELECT status FROM platform_operators WHERE id = ?", String.class, operatorId)).isEqualTo("ACTIVE");

        operatorLogin(email, "Chosen-Operator-Pass-7!");
        // Replay: the temporary password neither signs in nor resets the account again.
        operatorPost("/v1/auth/operator/login", Map.of("email", email, "password", temporaryPassword))
                .andExpect(status().isUnauthorized());
        operatorPost("/v1/auth/operator/accept-invitation", Map.of("token", temporaryPassword, "new_password", "Hijack-Operator-Pass-8!"))
                .andExpect(status().isBadRequest());
        operatorLogin(email, "Chosen-Operator-Pass-7!");
    }

    @Test
    void resendingReplacesTheTemporaryPasswordAndTheOldOneStopsWorking() throws Exception {
        String email = "resend-" + suffix + "@ops.test";
        asAdmin(post("/v1/operators"), Map.of("name", "Resend Op", "email", email, "access_level", "DEPARTMENT_OPERATOR",
                        "department", "trust-compliance"))
                .andExpect(status().isCreated());
        String first = temporaryPasswordIn(CapturedMail.sentHtml(mailSender).get(0));
        String operatorId = jdbc.queryForObject("SELECT id FROM platform_operators WHERE lower(email) = ?", String.class, email);

        asAdmin(post("/v1/operators/" + operatorId + "/resend-invite"), Map.of()).andExpect(status().is2xxSuccessful());
        List<String> mails = CapturedMail.sentHtml(mailSender);
        String second = temporaryPasswordIn(mails.get(mails.size() - 1));
        assertThat(second).isNotEqualTo(first);

        operatorPost("/v1/auth/operator/login", Map.of("email", email, "password", first))
                .andExpect(status().isUnauthorized());
        operatorPost("/v1/auth/operator/login", Map.of("email", email, "password", second))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
    }

    @Test
    void aSuspendedOperatorCannotReactivateItselfWithAnOpenTemporaryPassword() throws Exception {
        String email = "susp-" + suffix + "@ops.test";
        asAdmin(post("/v1/operators"), Map.of("name", "Susp Op", "email", email, "access_level", "DEPARTMENT_OPERATOR",
                        "department", "trust-compliance"))
                .andExpect(status().isCreated());
        String temporaryPassword = temporaryPasswordIn(CapturedMail.sentHtml(mailSender).get(0));
        String operatorId = jdbc.queryForObject("SELECT id FROM platform_operators WHERE lower(email) = ?", String.class, email);
        jdbc.update("UPDATE platform_operators SET status = 'SUSPENDED' WHERE id = ?", operatorId);

        operatorPost("/v1/auth/operator/accept-invitation", Map.of("token", temporaryPassword, "new_password", "Chosen-Operator-Pass-7!"))
                .andExpect(status().isBadRequest());
        assertThat(jdbc.queryForObject("SELECT status FROM platform_operators WHERE id = ?", String.class, operatorId)).isEqualTo("SUSPENDED");
    }

    private static String temporaryPasswordIn(String html) {
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("Temporary password: ([A-Za-z0-9]+)").matcher(html);
        assertThat(m.find()).as("temporary password in the email").isTrue();
        return m.group(1);
    }

    @Test
    void operatorManagementRejectsInventedDepartmentsLevelsAndTheSuperAdminRole() throws Exception {
        String email = "bad-" + suffix + "@ops.test";
        asAdmin(post("/v1/operators"), Map.of("name", "X", "email", email, "department", "galactic-ops"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("UNKNOWN_DEPARTMENT"));
        asAdmin(post("/v1/operators"), Map.of("name", "X", "email", email, "access_level", "DEPARTMENT_OPERATOR"))
                .andExpect(status().isBadRequest());
        asAdmin(post("/v1/operators"), Map.of("name", "X", "email", email, "access_level", "ROOT", "department", "finance-tax"))
                .andExpect(status().isBadRequest());
        asAdmin(post("/v1/operators"), Map.of("name", "X", "email", email, "department", "finance-tax", "role_id", "role-super-admin"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("ROLE_NOT_ASSIGNABLE"));
        asAdmin(patch("/v1/operators/" + deptId), Map.of("role_id", "role-super-admin"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("ROLE_NOT_ASSIGNABLE"));
        asAdmin(patch("/v1/operators/" + deptId + "/access-level"), Map.of("access_level", "GOD_MODE"))
                .andExpect(status().isBadRequest());
        asAdmin(patch("/v1/operators/" + deptId + "/department"), Map.of("department_id", "galactic-ops"))
                .andExpect(status().isBadRequest());
        asAdmin(patch("/v1/operators/" + deptId + "/status"), Map.of("status", "SUPERUSER"))
                .andExpect(status().isBadRequest());

        assertThat(jdbc.queryForObject("SELECT count(*) FROM platform_operators WHERE lower(email) = ?", Integer.class, email)).isZero();
        assertThat(jdbc.queryForMap("SELECT access_level, department_id, role_id, status FROM platform_operators WHERE id = ?", deptId))
                .containsEntry("access_level", "DEPARTMENT_OPERATOR").containsEntry("department_id", "finance-tax")
                .containsEntry("role_id", "role-platform-operator").containsEntry("status", "ACTIVE");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM operator_audit_logs WHERE action = 'OPERATOR_ROLE_REFUSED' "
                + "AND (operator_id = ? OR operator_id = ?)", Integer.class, deptId, email)).isEqualTo(2);
    }

    @Test
    void superAdminChangesAccessLevelAndTheOperatorsSessionsAreRevoked() throws Exception {
        String token = operatorLogin(deptEmail, OPERATOR_PASSWORD).path("access_token").asText();
        mockMvc.perform(get("/v1/operator/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk());

        asAdmin(patch("/v1/operators/" + deptId + "/access-level"),
                Map.of("access_level", "MAIN_PLATFORM_OPERATOR", "expected_version", operatorVersion(deptId)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/v1/operator/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
    }

    @Test
    void refreshRotatesAndAReplayedRefreshTokenIsRefused() throws Exception {
        MvcResult loginResult = operatorPost("/v1/auth/operator/login", Map.of("email", deptEmail, "password", OPERATOR_PASSWORD))
                .andExpect(status().isOk()).andReturn();
        JsonNode login = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        String firstRefresh = loginResult.getResponse().getCookie("prowise_operator_refresh_token").getValue();

        MvcResult rotated = operatorPost("/v1/auth/operator/refresh", Map.of("refresh_token", firstRefresh))
                .andExpect(status().isOk()).andReturn();
        assertThat(rotated.getResponse().getCookie("prowise_operator_refresh_token").getValue()).isNotBlank().isNotEqualTo(firstRefresh);

        operatorPost("/v1/auth/operator/refresh", Map.of("refresh_token", firstRefresh)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/operator/me").header("Authorization", "Bearer " + login.path("access_token").asText()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void forgotPasswordEmailsASingleUseLinkAndTheResetIsAtomic() throws Exception {
        operatorPost("/v1/auth/operator/forgot-password", Map.of("email", deptEmail)).andExpect(status().isOk());
        String html = CapturedMail.sentHtml(mailSender).get(0);
        String token = CapturedMail.token(html, "operator/login?reset=");
        assertThat(html).doesNotContain("reset token is");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM operator_password_resets WHERE token_hash = ?", Integer.class, token)).isZero();

        operatorPost("/v1/auth/operator/reset-password", Map.of("token", token, "new_password", "Short-1"))
                .andExpect(status().isBadRequest());

        // Two concurrent submissions of the same link: exactly one succeeds.
        List<Integer> statuses = concurrently(2, () -> operatorPost("/v1/auth/operator/reset-password",
                Map.of("token", token, "new_password", "Fresh-Operator-Pass-9")).andReturn().getResponse().getStatus());
        assertThat(statuses).containsExactlyInAnyOrder(200, 400);

        operatorPost("/v1/auth/operator/reset-password", Map.of("token", token, "new_password", "Another-Operator-Pass-9"))
                .andExpect(status().isBadRequest());
        operatorLogin(deptEmail, "Fresh-Operator-Pass-9");
        operatorPost("/v1/auth/operator/login", Map.of("email", deptEmail, "password", OPERATOR_PASSWORD))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void aNewResetRequestSupersedesTheEarlierLink() throws Exception {
        operatorPost("/v1/auth/operator/forgot-password", Map.of("email", deptEmail)).andExpect(status().isOk());
        operatorPost("/v1/auth/operator/forgot-password", Map.of("email", deptEmail)).andExpect(status().isOk());
        List<String> mails = CapturedMail.sentHtml(mailSender);
        String first = CapturedMail.token(mails.get(0), "operator/login?reset=");
        String second = CapturedMail.token(mails.get(1), "operator/login?reset=");

        operatorPost("/v1/auth/operator/reset-password", Map.of("token", first, "new_password", "Fresh-Operator-Pass-9"))
                .andExpect(status().isBadRequest());
        operatorPost("/v1/auth/operator/reset-password", Map.of("token", second, "new_password", "Fresh-Operator-Pass-9"))
                .andExpect(status().isOk());
    }

    @Test
    void suspendingAnOperatorInvalidatesItsTokenImmediately() throws Exception {
        String token = operatorLogin(deptEmail, OPERATOR_PASSWORD).path("access_token").asText();

        asAdmin(patch("/v1/operators/" + deptId + "/status"), Map.of("status", "SUSPENDED", "expected_version", operatorVersion(deptId)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/v1/operator/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        operatorPost("/v1/auth/operator/login", Map.of("email", deptEmail, "password", OPERATOR_PASSWORD))
                .andExpect(status().isForbidden());
    }

    @Test
    void anOperatorWhoNeverAcceptedTheInvitationCannotSignIn() throws Exception {
        jdbc.update("UPDATE platform_operators SET password_setup_completed = false WHERE id = ?", deptId);

        operatorPost("/v1/auth/operator/login", Map.of("email", deptEmail, "password", OPERATOR_PASSWORD))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SETUP_INCOMPLETE"));
    }

    // ---- Phase 1 hardening: operator sign-in matches user sign-in.

    @Test
    void anInactiveOperatorIsOnlyRevealedAfterTheRightPassword() throws Exception {
        jdbc.update("UPDATE platform_operators SET status = 'INACTIVE' WHERE id = ?", deptId);
        operatorPost("/v1/auth/operator/login", Map.of("email", deptEmail, "password", "Wrong-Password-77!"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        operatorPost("/v1/auth/operator/login", Map.of("email", deptEmail, "password", OPERATOR_PASSWORD))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_INACTIVE"));
    }

    @Test
    void fiveWrongPasswordsLockTheOperatorAccount() throws Exception {
        for (int i = 0; i < 5; i++) {
            operatorPost("/v1/auth/operator/login", Map.of("email", deptEmail, "password", "Wrong-Password-77!"))
                    .andExpect(status().isUnauthorized());
        }
        operatorPost("/v1/auth/operator/login", Map.of("email", deptEmail, "password", OPERATOR_PASSWORD))
                .andExpect(status().isLocked())
                .andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));
    }

    @Test
    void operatorTokensNeverAppearInResponseBodiesAndCookiesAreHttpOnly() throws Exception {
        MvcResult login = operatorPost("/v1/auth/operator/login", Map.of("email", deptEmail, "password", OPERATOR_PASSWORD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refresh_token").doesNotExist())
                .andExpect(jsonPath("$.access_token").isNotEmpty())
                .andReturn();
        jakarta.servlet.http.Cookie refresh = login.getResponse().getCookie("prowise_operator_refresh_token");
        assertThat(refresh).isNotNull();
        assertThat(refresh.isHttpOnly()).isTrue();
        mockMvc.perform(post("/v1/auth/operator/refresh").cookie(refresh))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refresh_token").doesNotExist());
    }

    @Test
    void aReplayedOperatorRefreshTokenSignsOutEveryOperatorSession() throws Exception {
        MvcResult first = operatorPost("/v1/auth/operator/login", Map.of("email", deptEmail, "password", OPERATOR_PASSWORD))
                .andExpect(status().isOk()).andReturn();
        JsonNode other = operatorLogin(deptEmail, OPERATOR_PASSWORD);
        jakarta.servlet.http.Cookie stolen = first.getResponse().getCookie("prowise_operator_refresh_token");

        mockMvc.perform(post("/v1/auth/operator/refresh").cookie(stolen)).andExpect(status().isOk());
        mockMvc.perform(post("/v1/auth/operator/refresh").cookie(stolen)).andExpect(status().isUnauthorized());

        mockMvc.perform(get("/v1/operator/me").header("Authorization", "Bearer " + other.path("access_token").asText()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void concurrentOperatorRefreshesWithOneTokenYieldAtMostOneSession() throws Exception {
        jakarta.servlet.http.Cookie refresh = operatorPost("/v1/auth/operator/login",
                        Map.of("email", deptEmail, "password", OPERATOR_PASSWORD))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("prowise_operator_refresh_token");
        List<Integer> statuses = concurrently(6, () -> mockMvc.perform(post("/v1/auth/operator/refresh").cookie(refresh))
                .andReturn().getResponse().getStatus());
        assertThat(statuses.stream().filter(s -> s == 200).count()).isLessThanOrEqualTo(1);
    }

    @Test
    void invitationAcceptanceUsesThePasswordPolicyIsSingleUseUnderConcurrencyAndEndsOldSessions() throws Exception {
        JsonNode existing = operatorLogin(deptEmail, OPERATOR_PASSWORD);
        String raw = com.prowise.operator.auth.OperatorAuthService.randomToken();
        jdbc.update("INSERT INTO operator_invitations (operator_id, email, token_hash, expires_at) VALUES (?, ?, ?, now() + interval '1 day')",
                deptId, deptEmail, com.prowise.operator.auth.OperatorAuthService.hash(raw));

        operatorPost("/v1/auth/operator/accept-invitation", Map.of("token", raw, "new_password", "alllowercaseletters"))
                .andExpect(status().isBadRequest());

        List<Integer> statuses = concurrently(5, () -> operatorPost("/v1/auth/operator/accept-invitation",
                Map.of("token", raw, "new_password", "Accepted-Invite-Pass-4!")).andReturn().getResponse().getStatus());
        assertThat(statuses.stream().filter(s -> s == 201).count()).isEqualTo(1);

        mockMvc.perform(get("/v1/operator/me").header("Authorization", "Bearer " + existing.path("access_token").asText()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void operatorPasswordResetUsesTheFullPasswordPolicy() throws Exception {
        String raw = com.prowise.operator.auth.OperatorAuthService.randomToken();
        jdbc.update("INSERT INTO operator_password_resets (operator_id, email, token_hash, expires_at) VALUES (?, ?, ?, now() + interval '30 minutes')",
                deptId, deptEmail, com.prowise.operator.auth.OperatorAuthService.hash(raw));
        operatorPost("/v1/auth/operator/reset-password", Map.of("token", raw, "new_password", "alllowercaseletters"))
                .andExpect(status().isBadRequest());
        // The weak attempt did not burn the single-use link.
        operatorPost("/v1/auth/operator/reset-password", Map.of("token", raw, "new_password", "Strong-Reset-Pass-5!"))
                .andExpect(status().isOk());
    }

    @Test
    void aSignedInOperatorChangesItsPasswordAndEveryOtherSessionEnds() throws Exception {
        String otherDevice = operatorLogin(deptEmail, OPERATOR_PASSWORD).path("access_token").asText();
        String token = operatorLogin(deptEmail, OPERATOR_PASSWORD).path("access_token").asText();
        String newPassword = "Rotated-Operator-Pass-7!";

        MvcResult changed = changePassword(token, OPERATOR_PASSWORD, newPassword).andExpect(status().isOk()).andReturn();
        String freshToken = changed.getResponse().getCookie("prowise_operator_access_token").getValue();
        assertThat(changed.getResponse().getContentAsString()).doesNotContain(newPassword);

        // The caller keeps working on its fresh session; every earlier session (other device and this one) ended.
        mockMvc.perform(get("/v1/operator/me").header("Authorization", "Bearer " + freshToken)).andExpect(status().isOk());
        mockMvc.perform(get("/v1/operator/me").header("Authorization", "Bearer " + otherDevice)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/operator/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());

        operatorPost("/v1/auth/operator/login", Map.of("email", deptEmail, "password", OPERATOR_PASSWORD))
                .andExpect(status().isUnauthorized());
        operatorLogin(deptEmail, newPassword);

        assertThat(jdbc.queryForObject("SELECT count(*) FROM operator_activity_logs WHERE operator_id = ? "
                + "AND action = 'OPERATOR_PASSWORD_CHANGED'", Integer.class, deptId)).isEqualTo(1);
        // admin_audit_logs is not cleared between tests: count this operator's row only.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM admin_audit_logs WHERE action = 'OPERATOR_PASSWORD_CHANGED' "
                + "AND actor_email = ?", Integer.class, deptEmail)).isEqualTo(1);
    }

    @Test
    void changingThePasswordNeedsTheRightCurrentPasswordAFreshPasswordAndASignedInOperator() throws Exception {
        String token = operatorLogin(deptEmail, OPERATOR_PASSWORD).path("access_token").asText();
        String hashBefore = jdbc.queryForObject("SELECT password_hash FROM platform_operators WHERE id = ?", String.class, deptId);

        changePassword(token, "Wrong-Current-Pass-1!", "Rotated-Operator-Pass-7!").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CURRENT_PASSWORD"));
        changePassword(token, OPERATOR_PASSWORD, "alllowercaseletters").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.field_errors[0].field").value("new_password"));
        changePassword(token, OPERATOR_PASSWORD, OPERATOR_PASSWORD).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_REUSE"));
        changePassword(null, OPERATOR_PASSWORD, "Rotated-Operator-Pass-7!").andExpect(status().isUnauthorized());

        // Nothing changed and the session is still valid after the refusals.
        assertThat(jdbc.queryForObject("SELECT password_hash FROM platform_operators WHERE id = ?", String.class, deptId))
                .isEqualTo(hashBefore);
        mockMvc.perform(get("/v1/operator/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM operator_activity_logs WHERE operator_id = ? "
                + "AND action = 'OPERATOR_PASSWORD_CHANGED'", Integer.class, deptId)).isZero();
    }

    @Test
    void aReplayedChangePasswordWithTheOldSessionIsRefused() throws Exception {
        String token = operatorLogin(deptEmail, OPERATOR_PASSWORD).path("access_token").asText();
        changePassword(token, OPERATOR_PASSWORD, "Rotated-Operator-Pass-7!").andExpect(status().isOk());
        // The same request again: the old session was revoked, so it cannot change the password a second time.
        changePassword(token, OPERATOR_PASSWORD, "Second-Operator-Pass-8!").andExpect(status().isUnauthorized());
        operatorLogin(deptEmail, "Rotated-Operator-Pass-7!");
    }

    private ResultActions changePassword(String accessToken, String current, String next) throws Exception {
        MockHttpServletRequestBuilder request = post("/v1/auth/operator/change-password")
                .with(com.prowise.testsupport.TestAccounts.randomClient())
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of("current_password", current, "new_password", next)));
        if (accessToken != null) request.header("Authorization", "Bearer " + accessToken);
        return mockMvc.perform(request);
    }

    private List<MockHttpServletRequestBuilder> managementRequests(String target) throws Exception {
        String createBody = objectMapper.writeValueAsString(Map.of("name", "Escalated", "email", "escalated-" + suffix + "@ops.test",
                "access_level", "MAIN_PLATFORM_OPERATOR"));
        return List.of(
                post("/v1/operators").contentType("application/json").content(createBody),
                patch("/v1/operators/" + target).contentType("application/json").content("{\"access_level\":\"MAIN_PLATFORM_OPERATOR\"}"),
                patch("/v1/operators/" + target + "/access-level").contentType("application/json").content("{\"access_level\":\"MAIN_PLATFORM_OPERATOR\"}"),
                patch("/v1/operators/" + target + "/department").contentType("application/json").content("{\"department_id\":\"site-reliability\"}"),
                patch("/v1/operators/" + target + "/status").contentType("application/json").content("{\"status\":\"SUSPENDED\"}"),
                put("/v1/operators/" + target + "/permissions").contentType("application/json")
                        .content("{\"overrides\":[{\"module_key\":\"billing.invoices\",\"action\":\"edit\",\"override_type\":\"GRANT\"}]}"),
                post("/v1/operators/" + target + "/toggle-status"),
                post("/v1/operators/" + target + "/revoke-sessions"),
                post("/v1/operators/" + target + "/resend-invite"),
                delete("/v1/operators/" + target));
    }

    /** The version a Super Admin client would have read before editing (rule 5: expected_version). */
    private long operatorVersion(String id) {
        return jdbc.queryForObject("SELECT version FROM platform_operators WHERE id = ?", Long.class, id);
    }

    private void insertOperator(String id, String email, String accessLevel, String department) {
        jdbc.update("""
                INSERT INTO platform_operators (id, name, email, role_id, access_level, department_id, status,
                    password_hash, password_setup_completed)
                VALUES (?, ?, ?, 'role-platform-operator', ?, ?, 'ACTIVE', ?, true)
                """, id, id, email, accessLevel, department, passwordEncoder.encode(OPERATOR_PASSWORD));
    }

    private JsonNode operatorLogin(String email, String password) throws Exception {
        return json(operatorPost("/v1/auth/operator/login", Map.of("email", email, "password", password))
                .andExpect(status().isOk()));
    }

    private ResultActions operatorPost(String path, Map<String, String> body) throws Exception {
        return mockMvc.perform(post(path).with(com.prowise.testsupport.TestAccounts.randomClient())
                .contentType("application/json").content(objectMapper.writeValueAsString(body)));
    }

    private ResultActions asAdmin(MockHttpServletRequestBuilder request, Map<String, ?> body) throws Exception {
        return mockMvc.perform(request.header("Authorization", "Bearer " + adminToken)
                .contentType("application/json").content(objectMapper.writeValueAsString(body)));
    }

    private JsonNode json(ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }

    private interface StatusCall {
        int call() throws Exception;
    }

    private static List<Integer> concurrently(int threads, StatusCall call) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Integer>> futures = new ArrayList<>();
            for (int i = 0; i < threads; i++) {
                futures.add(pool.submit(() -> {
                    start.await();
                    return call.call();
                }));
            }
            start.countDown();
            List<Integer> results = new ArrayList<>();
            for (Future<Integer> future : futures) {
                results.add(future.get());
            }
            return results;
        } finally {
            pool.shutdownNow();
        }
    }
}
