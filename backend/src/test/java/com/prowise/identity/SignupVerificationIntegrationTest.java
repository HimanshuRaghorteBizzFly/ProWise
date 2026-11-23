package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
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

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.MockMvcPrint;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.testsupport.CapturedMail;
import com.prowise.testsupport.TestAccounts;

/**
 * Approved decision D9 (Phase 2): public signup stays open but verifies the address before the account can sign
 * in, gives the same answer for known and unknown addresses, is rate limited, and starts with no privileges.
 */
@SpringBootTest(properties = "spring.mail.username=test-smtp-user")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ExtendWith(OutputCaptureExtension.class)
@Tag("T01")
@Tag("NFR-06")
class SignupVerificationIntegrationTest {

    private static final String VERIFY_LINK = "verify-email?token=";
    private static final String PASSWORD = "Self-Chosen-Signup-Pass-1";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private AccountTokenService accountTokenService;

    @MockitoBean private JavaMailSender mailSender;

    private String email;

    @BeforeEach
    void setUp() {
        TestDatabase.clean(jdbc);
        reset(mailSender);
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
        email = "self." + UUID.randomUUID().toString().substring(0, 8) + "@test.prowise";
    }

    @Test
    void signupCreatesAPendingViewerAndIssuesNoSession() throws Exception {
        MvcResult result = signup(email, PASSWORD)
                .andExpect(status().isAccepted())
                .andExpect(header().doesNotExist("Set-Cookie"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.access_token").doesNotExist())
                .andExpect(jsonPath("$.refresh_token").doesNotExist())
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).doesNotContain(PASSWORD);
        Map<String, Object> user = jdbc.queryForMap("SELECT id, status, role, organization_id FROM users WHERE lower(email) = ?", email);
        assertThat(user).containsEntry("status", "PENDING_ACTIVATION").containsEntry("role", "VIEWER");
        assertThat(user.get("organization_id")).isNull();
        assertThat(count("SELECT count(*) FROM memberships WHERE user_id = ?", user.get("id"))).isZero();
        assertThat(count("SELECT count(*) FROM password_reset_tokens WHERE user_id = ? AND purpose = 'VERIFY' AND used_at IS NULL "
                + "AND expires_at BETWEEN now() + interval '71 hours' AND now() + interval '73 hours'", user.get("id"))).isEqualTo(1);
        assertThat(CapturedMail.sentHtml(mailSender).get(0)).contains(VERIFY_LINK);

        login(email, PASSWORD)
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_PENDING_ACTIVATION"));
    }

    @Test
    void theEmailedLinkActivatesTheAccountOnce() throws Exception {
        signup(email, PASSWORD).andExpect(status().isAccepted());
        String token = CapturedMail.token(CapturedMail.sentHtml(mailSender).get(0), VERIFY_LINK);

        verifyEmail(token).andExpect(status().isNoContent());
        verifyEmail(token).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_TOKEN"));

        login(email, PASSWORD).andExpect(status().isOk()).andExpect(jsonPath("$.target_dashboard_url").value("/create-organization"));
        assertThat(count("SELECT count(*) FROM auth_audit_logs WHERE action = 'EMAIL_VERIFIED' "
                + "AND target_user_id = (SELECT id FROM users WHERE lower(email) = ?)", email)).isEqualTo(1);
    }

    @Test
    void invalidExpiredOrForeignTokensDoNotActivate() throws Exception {
        signup(email, PASSWORD).andExpect(status().isAccepted());
        UUID userId = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = ?", UUID.class, email);
        String verifyToken = CapturedMail.token(CapturedMail.sentHtml(mailSender).get(0), VERIFY_LINK);

        verifyEmail("not-a-real-token").andExpect(status().isBadRequest());
        verifyEmail("").andExpect(status().isBadRequest());

        // A verify link cannot set a password through the reset endpoint, and stays usable for its own purpose.
        mockMvc.perform(post("/v1/auth/reset-password").contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("token", verifyToken, "password", "Attacker-Chosen-Pass-1"))))
                .andExpect(status().isUnauthorized());
        // A reset or setup token cannot verify an address.
        String resetToken = accountTokenService.issue(userId, AccountTokenService.Purpose.RESET);
        String setupToken = accountTokenService.issue(userId, AccountTokenService.Purpose.SETUP);
        verifyEmail(resetToken).andExpect(status().isBadRequest());
        verifyEmail(setupToken).andExpect(status().isBadRequest());
        assertThat(accountStatus(userId)).isEqualTo("PENDING_ACTIVATION");

        // Expired.
        jdbc.update("UPDATE password_reset_tokens SET expires_at = now() - interval '1 second' WHERE user_id = ? AND purpose = 'VERIFY'", userId);
        verifyEmail(verifyToken).andExpect(status().isBadRequest());
        assertThat(accountStatus(userId)).isEqualTo("PENDING_ACTIVATION");
    }

    @Test
    void signupForARegisteredAddressLooksTheSameAndChangesNothing() throws Exception {
        UUID existing = insertUser(email, "Original-Owner-Pass-1", "DEVELOPER", "ACTIVE");
        String hashBefore = jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, existing);
        String newcomer = "new." + email;

        String knownBody = signup(email, "Attacker-Chosen-Pass-1").andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();
        String unknownBody = signup(newcomer, PASSWORD).andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();

        assertThat(knownBody).isEqualTo(unknownBody);
        assertThat(jdbc.queryForMap("SELECT status, role, password_hash FROM users WHERE id = ?", existing))
                .containsEntry("status", "ACTIVE").containsEntry("role", "DEVELOPER").containsEntry("password_hash", hashBefore);
        verify(mailSender, times(1)).send(any(MimeMessage.class)); // only the newcomer was emailed
        login(email, "Attacker-Chosen-Pass-1").andExpect(status().isUnauthorized());
        login(email, "Original-Owner-Pass-1").andExpect(status().isOk());
    }

    @Test
    void repeatingSignupWhilePendingResendsTheLinkWithoutChangingThePassword() throws Exception {
        signup(email, PASSWORD).andExpect(status().isAccepted());
        signup(email, "Second-Attempt-Pass-1").andExpect(status().isAccepted());

        List<String> mails = CapturedMail.sentHtml(mailSender);
        assertThat(mails).hasSize(2);
        String first = CapturedMail.token(mails.get(0), VERIFY_LINK);
        String second = CapturedMail.token(mails.get(1), VERIFY_LINK);
        verifyEmail(first).andExpect(status().isBadRequest()); // superseded
        verifyEmail(second).andExpect(status().isNoContent());
        login(email, "Second-Attempt-Pass-1").andExpect(status().isUnauthorized());
        login(email, PASSWORD).andExpect(status().isOk());
        assertThat(count("SELECT count(*) FROM users WHERE lower(email) = ?", email)).isEqualTo(1);
    }

    @Test
    void signupNeverSendsAVerifyLinkToAnAdministratorProvisionedPendingAccount() throws Exception {
        UUID invited = insertUser(email, "Unknown-Random-Value-1", "DEVELOPER", "PENDING_ACTIVATION");

        signup(email, PASSWORD).andExpect(status().isAccepted());

        verify(mailSender, never()).send(any(MimeMessage.class));
        assertThat(count("SELECT count(*) FROM password_reset_tokens WHERE user_id = ?", invited)).isZero();
    }

    @Test
    void weakPasswordsAndInvalidAddressesAreRejected() throws Exception {
        signup(email, "short-1").andExpect(status().isBadRequest());
        signup("not-an-email", PASSWORD).andExpect(status().isBadRequest());
        assertThat(count("SELECT count(*) FROM users")).isZero();
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void signupIsRateLimitedPerAddress() throws Exception {
        for (int attempt = 1; attempt <= 10; attempt++) {
            signup(email, PASSWORD).andExpect(status().isAccepted());
        }
        signup(email, PASSWORD).andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("RATE_LIMITED"));
    }

    @Test
    void signupIsRateLimitedPerClientAddress() throws Exception {
        String client = TestAccounts.randomClientAddress();
        for (int attempt = 1; attempt <= 20; attempt++) {
            signupFrom(client, attempt + "." + email, PASSWORD).andExpect(status().isAccepted());
        }
        signupFrom(client, "21." + email, PASSWORD).andExpect(status().isTooManyRequests());
        assertThat(count("SELECT count(*) FROM users")).isEqualTo(20);
    }

    @Test
    void concurrentSignupsForOneAddressCreateOneAccount() throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(4);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Integer>> results = new ArrayList<>();
            for (int i = 0; i < 4; i++) {
                results.add(pool.submit(() -> {
                    start.await();
                    return signup(email, PASSWORD).andReturn().getResponse().getStatus();
                }));
            }
            start.countDown();
            for (Future<Integer> result : results) {
                assertThat(result.get()).isEqualTo(202);
            }
        } finally {
            pool.shutdownNow();
        }
        assertThat(count("SELECT count(*) FROM users WHERE lower(email) = ?", email)).isEqualTo(1);
    }

    @Test
    void aVerifiedSelfRegisteredAccountHasNoPlatformAuthorityUntilItCreatesAWorkspace() throws Exception {
        TestAccounts.Account account = TestAccounts.signUpVerifyAndLogin(mockMvc, jdbc, accountTokenService, objectMapper, email, PASSWORD);
        String bearer = "Bearer " + account.accessToken();

        mockMvc.perform(get("/v1/admin/users").header("Authorization", bearer)).andExpect(status().isForbidden());
        mockMvc.perform(get("/v1/operators").header("Authorization", bearer)).andExpect(status().isForbidden());
        mockMvc.perform(post("/v1/operators").header("Authorization", bearer).contentType("application/json")
                        .content("{\"name\":\"x\",\"email\":\"x@test.prowise\",\"department\":\"finance-tax\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/v1/organizations").header("Authorization", bearer).contentType("application/json")
                        .content("""
                                {"name":"Self Org","slug":"self-%s","timezone":"UTC","calendar":{"workdays":[1,2,3,4,5],"holidays":[]}}
                                """.formatted(UUID.randomUUID().toString().substring(0, 8))))
                .andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("SELECT role_template FROM memberships WHERE user_id = ?", String.class, account.id()))
                .isEqualTo("ORGANIZATION_OWNER");
    }

    @Test
    void passwordsAndLinksNeverReachTheApplicationLog(CapturedOutput output) throws Exception {
        signup(email, PASSWORD).andExpect(status().isAccepted());
        String token = CapturedMail.token(CapturedMail.sentHtml(mailSender).get(0), VERIFY_LINK);
        verifyEmail(token).andExpect(status().isNoContent());

        assertThat(output.getAll()).doesNotContain(PASSWORD).doesNotContain(token);
    }

    private ResultActions signup(String address, String password) throws Exception {
        return signupFrom(TestAccounts.randomClientAddress(), address, password);
    }

    private ResultActions signupFrom(String client, String address, String password) throws Exception {
        return mockMvc.perform(post("/v1/auth/signup").header("X-Forwarded-For", client).contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of("email", address, "password", password, "name", "Self Registered"))));
    }

    private ResultActions verifyEmail(String token) throws Exception {
        return mockMvc.perform(post("/v1/auth/verify-email").contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of("token", token))));
    }

    private ResultActions login(String address, String password) throws Exception {
        return mockMvc.perform(post("/v1/auth/login").contentType("application/json")
                .content(objectMapper.writeValueAsString(Map.of("email", address, "password", password))));
    }

    private String accountStatus(UUID userId) {
        return jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, userId);
    }

    private UUID insertUser(String address, String password, String role, String userStatus) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, password_hash, name, role, status, must_change_password) "
                + "VALUES (?, ?, ?, ?, ?, ?, false)", id, address, passwordEncoder.encode(password), address, role, userStatus);
        return id;
    }

    private long count(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }
}
