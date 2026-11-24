package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
import java.util.UUID;

import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.testsupport.CapturedMail;
import com.prowise.testsupport.TestAccounts;

/**
 * Super Admin password lifecycle: first password through the activation link, login, forgot/reset by email,
 * and change password. The password is chosen by the person, stored only as a BCrypt hash, and every step is audited.
 */
@SpringBootTest(properties = "spring.mail.username=test-smtp-user")
@AutoConfigureMockMvc
@Tag("AS-02")
class SuperAdminPasswordLifecycleIntegrationTest {

    private static final String EMAIL = "owner@prowise.test";
    private static final String FIRST_PASSWORD = "First-Chosen-Pass-1!";
    private static final String NEW_PASSWORD = "Second-Chosen-Pass-2!";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AccountTokenService accountTokens;
    @MockitoBean private JavaMailSender mailSender;

    private UUID userId;

    @BeforeEach
    void setUp() {
        jdbc.update("DELETE FROM auth_audit_logs");
        jdbc.update("DELETE FROM email_delivery_logs");
        jdbc.update("DELETE FROM user_login_history");
        jdbc.update("DELETE FROM user_roles");
        TestDatabase.clean(jdbc);
        reset(mailSender);
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
        userId = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, 'Super Admin', 'SUPER_ADMIN', 'PENDING_ACTIVATION', false)
                """, userId, EMAIL, passwordEncoder.encode(AccountTokenService.randomToken()));
        jdbc.update("INSERT INTO user_roles (user_id, role_name) VALUES (?, 'SUPER_ADMIN')", userId);
    }

    @Test
    void pendingSuperAdminActivatesWithOwnPasswordThenSignsIn() throws Exception {
        String setupToken = accountTokens.issue(userId, AccountTokenService.Purpose.SETUP);

        // Cannot sign in before activation.
        login(EMAIL, FIRST_PASSWORD).andExpect(status().is4xxClientError());

        // A weak password is refused and does not burn the single-use link.
        activate(setupToken, "weakpassword").andExpect(status().isBadRequest());
        activate(setupToken, FIRST_PASSWORD).andExpect(status().isNoContent());
        // Single use.
        activate(setupToken, FIRST_PASSWORD).andExpect(status().is4xxClientError());

        Map<String, Object> row = jdbc.queryForMap("SELECT status, password_hash FROM users WHERE id = ?", userId);
        assertThat(row.get("status")).isEqualTo("ACTIVE");
        String hash = (String) row.get("password_hash");
        assertThat(hash).startsWith("$2").doesNotContain(FIRST_PASSWORD);
        assertThat(audits("ACCOUNT_ACTIVATED")).isEqualTo(1);

        login(EMAIL, FIRST_PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.access_token").isNotEmpty())
                .andExpect(jsonPath("$.target_dashboard_url").value(org.hamcrest.Matchers.containsString("super-admin")))
                .andExpect(jsonPath("$.password").doesNotExist());
    }

    @Test
    void activationEndpointRefusesAResetLink() throws Exception {
        jdbc.update("UPDATE users SET status = 'ACTIVE', password_hash = ? WHERE id = ?", passwordEncoder.encode(FIRST_PASSWORD), userId);
        String resetToken = accountTokens.issue(userId, AccountTokenService.Purpose.RESET);

        activate(resetToken, NEW_PASSWORD).andExpect(status().isBadRequest());
        assertThat(passwordEncoder.matches(FIRST_PASSWORD,
                jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, userId))).isTrue();
    }

    @Test
    void forgotPasswordEmailsAResetLinkWithoutRevealingWhetherTheAccountExists() throws Exception {
        activateDirectly();
        String refreshBefore = json(login(EMAIL, FIRST_PASSWORD).andExpect(status().isOk())).path("refresh_token").asText();

        forgot("nobody-" + UUID.randomUUID() + "@prowise.test").andExpect(status().isAccepted());
        verify(mailSender, never()).send(any(MimeMessage.class));

        forgot(EMAIL).andExpect(status().isAccepted());
        String token = CapturedMail.token(CapturedMail.sentHtml(mailSender).get(0), "reset-password?token=");
        assertThat(CapturedMail.sentHtml(mailSender).get(0)).doesNotContain(FIRST_PASSWORD);

        resetPassword(token, "too-weak").andExpect(status().isBadRequest());
        resetPassword(token, NEW_PASSWORD).andExpect(status().isNoContent());
        resetPassword(token, "Third-Chosen-Pass-3!").andExpect(status().is4xxClientError());

        login(EMAIL, FIRST_PASSWORD).andExpect(status().isUnauthorized());
        login(EMAIL, NEW_PASSWORD).andExpect(status().isOk());
        // Existing sessions end with the reset.
        mockMvc.perform(post("/v1/auth/refresh").contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("refresh_token", refreshBefore))))
                .andExpect(status().isUnauthorized());
        assertThat(audits("PASSWORD_RESET")).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT status FROM email_delivery_logs WHERE email_type = 'PASSWORD_RESET'", String.class))
                .isEqualTo("SMTP_ACCEPTED");
    }

    @Test
    void changePasswordVerifiesCurrentRefusesReuseAndEndsOtherSessions() throws Exception {
        activateDirectly();
        String access = json(login(EMAIL, FIRST_PASSWORD).andExpect(status().isOk())).path("access_token").asText();
        String otherRefresh = json(login(EMAIL, FIRST_PASSWORD).andExpect(status().isOk())).path("refresh_token").asText();

        change(access, "Wrong-Current-Pass-9!", NEW_PASSWORD).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_CURRENT_PASSWORD"));
        change(access, FIRST_PASSWORD, FIRST_PASSWORD).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PASSWORD_REUSE"));
        change(access, FIRST_PASSWORD, "alllowercase-123").andExpect(status().isBadRequest());

        change(access, FIRST_PASSWORD, NEW_PASSWORD).andExpect(status().isOk());

        login(EMAIL, NEW_PASSWORD).andExpect(status().isOk());
        mockMvc.perform(post("/v1/auth/refresh").contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("refresh_token", otherRefresh))))
                .andExpect(status().isUnauthorized());
        assertThat(audits("PASSWORD_CHANGED")).isEqualTo(1);
    }

    /* ------------------------------------------------------------------ helpers */

    private void activateDirectly() throws Exception {
        activate(accountTokens.issue(userId, AccountTokenService.Purpose.SETUP), FIRST_PASSWORD).andExpect(status().isNoContent());
    }

    private Integer audits(String action) {
        return jdbc.queryForObject("SELECT count(*) FROM auth_audit_logs WHERE action = ? AND target_user_id = ?",
                Integer.class, action, userId);
    }

    private ResultActions activate(String token, String password) throws Exception {
        return mockMvc.perform(post("/v1/auth/activate-account").contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of("token", token, "password", password))));
    }

    private ResultActions resetPassword(String token, String password) throws Exception {
        return mockMvc.perform(post("/v1/auth/reset-password").contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of("token", token, "password", password))));
    }

    private ResultActions forgot(String email) throws Exception {
        return mockMvc.perform(post("/v1/auth/forgot-password").header("X-Forwarded-For", TestAccounts.randomClientAddress())
                .contentType("application/json").content(objectMapper.writeValueAsString(Map.of("email", email))));
    }

    private ResultActions login(String email, String password) throws Exception {
        return mockMvc.perform(post("/v1/auth/login").header("X-Forwarded-For", TestAccounts.randomClientAddress())
                .contentType("application/json").content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))));
    }

    private ResultActions change(String access, String current, String next) throws Exception {
        return mockMvc.perform(post("/v1/auth/change-password").header("Authorization", "Bearer " + access)
                .contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of("current_password", current, "new_password", next))));
    }

    private JsonNode json(ResultActions actions) throws Exception {
        return objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
    }
}
