package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
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
import org.springframework.beans.factory.support.StaticListableBeanFactory;
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
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.identity.SuperAdminBootstrapService.Outcome;
import com.prowise.operator.operations.EmailDeliveryLogRepository;
import com.prowise.testsupport.CapturedMail;

/**
 * Approved decisions D1 to D3 (Phase 2): the first Super Admin comes only from deployment configuration, with a
 * single-use 72-hour setup link, and bootstrap is concurrency safe, idempotent across restarts and fail closed.
 */
@SpringBootTest(properties = "spring.mail.username=test-smtp-user")
@AutoConfigureMockMvc(print = MockMvcPrint.NONE)
@ExtendWith(OutputCaptureExtension.class)
@Tag("NFR-06")
@Tag("NFR-12")
class SuperAdminBootstrapIntegrationTest {

    private static final String SETUP_LINK = "reset-password?token=";
    private static final String CHOSEN_PASSWORD = "Bootstrap-Owner-Pass-7";

    @Autowired private SuperAdminBootstrapService bootstrapService;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AccountTokenService accountTokenService;
    @Autowired private EmailDeliveryLogRepository deliveryLogRepository;
    @Autowired private com.prowise.notification.smtp.SmtpSettingsProvider settingsProvider;
    @Autowired @org.springframework.beans.factory.annotation.Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping handlerMapping;

    @MockitoBean private JavaMailSender mailSender;

    private String adminEmail;

    @BeforeEach
    void setUp() {
        TestDatabase.clean(jdbc);
        reset(mailSender);
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
        adminEmail = "first.admin." + UUID.randomUUID().toString().substring(0, 8) + "@test.prowise";
    }

    @Test
    void freshDatabaseCreatesOnePendingSuperAdminWithASetupLinkAndAudit() throws Exception {
        SuperAdminBootstrapService.Result result = bootstrapService.bootstrap("  " + adminEmail.toUpperCase() + " ");

        assertThat(result.outcome()).isEqualTo(Outcome.CREATED);
        assertThat(result.emailDeliveryStatus()).isEqualTo("SMTP_ACCEPTED");
        Map<String, Object> user = jdbc.queryForMap("SELECT id, email, role, status, password_hash FROM users WHERE id = ?", result.userId());
        assertThat(user.get("email")).isEqualTo(adminEmail);
        assertThat(user.get("role")).isEqualTo("SUPER_ADMIN");
        assertThat(user.get("status")).isEqualTo("PENDING_ACTIVATION");
        assertThat(PublishedSeedCredentials.matchesPublishedPassword(adminEmail, (String) user.get("password_hash"))).isFalse();
        assertThat(count("SELECT count(*) FROM user_roles WHERE user_id = ? AND role_name = 'SUPER_ADMIN'", result.userId())).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM password_reset_tokens WHERE user_id = ? AND purpose = 'SETUP' "
                + "AND used_at IS NULL AND expires_at BETWEEN now() + interval '71 hours' AND now() + interval '73 hours'", result.userId()))
                .isEqualTo(1);
        assertThat(count("SELECT count(*) FROM auth_audit_logs WHERE action = 'SUPER_ADMIN_BOOTSTRAP_CREATED' AND target_user_id = ?",
                result.userId())).isEqualTo(1);

        // Only the hash is stored, and the emailed link is the setup flow.
        String html = CapturedMail.sentHtml(mailSender).get(0);
        String token = CapturedMail.token(html, SETUP_LINK);
        assertThat(html).contains("setup=1").doesNotContainIgnoringCase("password:");
        assertThat(count("SELECT count(*) FROM password_reset_tokens WHERE token_hash = ?", AccountTokenService.hash(token))).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM password_reset_tokens WHERE token_hash = ?", token)).isZero();

        // Login is refused until the owner sets a password.
        mockMvc.perform(post("/v1/auth/login").contentType("application/json").content(credentials(adminEmail, CHOSEN_PASSWORD)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void setupLinkActivatesTheAccountOnceAndLaterStartsDoNothing() throws Exception {
        bootstrapService.bootstrap(adminEmail);
        String token = CapturedMail.token(CapturedMail.sentHtml(mailSender).get(0), SETUP_LINK);

        mockMvc.perform(post("/v1/auth/reset-password").contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("token", token, "password", CHOSEN_PASSWORD))))
                .andExpect(status().isNoContent());
        mockMvc.perform(post("/v1/auth/reset-password").contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("token", token, "password", "Another-Pass-1234"))))
                .andExpect(status().isUnauthorized()); // single use
        mockMvc.perform(post("/v1/auth/login").contentType("application/json").content(credentials(adminEmail, CHOSEN_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.target_dashboard_url").value("/super-admin/dashboard"));

        reset(mailSender);
        assertThat(bootstrapService.bootstrap(adminEmail).outcome()).isEqualTo(Outcome.ACTIVE_SUPER_ADMIN_EXISTS);
        assertThat(bootstrapService.bootstrap("someone.else@test.prowise").outcome()).isEqualTo(Outcome.ACTIVE_SUPER_ADMIN_EXISTS);
        verify(mailSender, never()).send(any(MimeMessage.class));
        assertThat(count("SELECT count(*) FROM users WHERE upper(role) = 'SUPER_ADMIN'")).isEqualTo(1);
    }

    @Test
    void restartWhileTheDeliveredLinkIsValidSendsNothingAndCreatesNoDuplicate() throws Exception {
        UUID first = bootstrapService.bootstrap(adminEmail).userId();

        SuperAdminBootstrapService.Result restart = bootstrapService.bootstrap(adminEmail);

        assertThat(restart.outcome()).isEqualTo(Outcome.SETUP_LINK_STILL_VALID);
        assertThat(restart.userId()).isEqualTo(first);
        verify(mailSender, times(1)).send(any(MimeMessage.class));
        assertThat(count("SELECT count(*) FROM users")).isEqualTo(1);
    }

    @Test
    void failedDeliveryKeepsTheAccountPendingAndTheNextStartSendsAFreshLink() throws Exception {
        doThrow(new MailSendException("smtp.internal.example: 535 auth failed for mailer")).when(mailSender).send(any(MimeMessage.class));
        SuperAdminBootstrapService.Result first = bootstrapService.bootstrap(adminEmail);
        assertThat(first.outcome()).isEqualTo(Outcome.CREATED);
        assertThat(first.emailDeliveryStatus()).isEqualTo("FAILED");
        assertThat(jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, first.userId())).isEqualTo("PENDING_ACTIVATION");
        String undeliveredToken = CapturedMail.token(CapturedMail.sentHtml(mailSender).get(0), SETUP_LINK);

        reset(mailSender);
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
        doNothing().when(mailSender).send(any(MimeMessage.class));
        SuperAdminBootstrapService.Result retry = bootstrapService.bootstrap(adminEmail);

        assertThat(retry.outcome()).isEqualTo(Outcome.SETUP_LINK_RESENT);
        assertThat(retry.emailDeliveryStatus()).isEqualTo("SMTP_ACCEPTED");
        assertThat(retry.userId()).isEqualTo(first.userId());
        String freshToken = CapturedMail.token(CapturedMail.sentHtml(mailSender).get(0), SETUP_LINK);
        assertThat(freshToken).isNotEqualTo(undeliveredToken);
        // The earlier link was superseded.
        mockMvc.perform(post("/v1/auth/reset-password").contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("token", undeliveredToken, "password", CHOSEN_PASSWORD))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/v1/auth/reset-password").contentType("application/json")
                        .content(objectMapper.writeValueAsString(Map.of("token", freshToken, "password", CHOSEN_PASSWORD))))
                .andExpect(status().isNoContent());
        assertThat(count("SELECT count(*) FROM auth_audit_logs WHERE action = 'SUPER_ADMIN_BOOTSTRAP_RESENT' AND target_user_id = ?",
                first.userId())).isEqualTo(1);
    }

    @Test
    void withoutOutgoingEmailNothingIsSentAndTheAccountStaysPending() {
        EmailCredentialService notConfigured = new EmailCredentialService(
                new StaticListableBeanFactory().getBeanProvider(JavaMailSender.class), deliveryLogRepository,
                settingsProvider, "http://localhost:3000");
        SuperAdminBootstrapService service = new SuperAdminBootstrapService(
                jdbc, passwordEncoder, accountTokenService, notConfigured, deliveryLogRepository);

        SuperAdminBootstrapService.Result result = service.bootstrap(adminEmail);

        assertThat(result.outcome()).isEqualTo(Outcome.CREATED);
        assertThat(result.emailDeliveryStatus()).isEqualTo("NOT_SENT");
        assertThat(jdbc.queryForObject("SELECT status FROM users WHERE id = ?", String.class, result.userId())).isEqualTo("PENDING_ACTIVATION");
        // Not delivered, so the next start tries again instead of assuming the link arrived.
        assertThat(service.bootstrap(adminEmail).outcome()).isEqualTo(Outcome.SETUP_LINK_RESENT);
        assertThat(count("SELECT count(*) FROM users")).isEqualTo(1);
    }

    @Test
    void concurrentStartsCreateExactlyOneSuperAdmin() throws Exception {
        List<Outcome> sameEmail = runConcurrently(adminEmail, adminEmail, adminEmail, adminEmail);
        assertThat(sameEmail).containsOnlyOnce(Outcome.CREATED);
        assertThat(count("SELECT count(*) FROM users")).isEqualTo(1);

        TestDatabase.clean(jdbc);
        List<Outcome> differentEmails = runConcurrently("a." + adminEmail, "b." + adminEmail, "c." + adminEmail);
        assertThat(differentEmails).containsOnlyOnce(Outcome.CREATED);
        assertThat(differentEmails).filteredOn(o -> o == Outcome.REFUSED_OTHER_PENDING_SUPER_ADMIN).hasSize(2);
        assertThat(count("SELECT count(*) FROM users WHERE upper(role) = 'SUPER_ADMIN'")).isEqualTo(1);
    }

    @Test
    void legacySeededSuperAdminWithAPublishedPasswordDoesNotCount() {
        // Exactly as migration V10 left it: ACTIVE, published hash.
        jdbc.update("INSERT INTO users (id, email, password_hash, name, role, status, must_change_password) VALUES "
                + "(gen_random_uuid(), 'superadmin@prowise.com', '$2a$10$ABz3pFpyw3NC.JhRjL7fZeF7a1Ua2.N/9U4LaMvYXkmyxmchBuxHy', "
                + "'Super Admin', 'SUPER_ADMIN', 'ACTIVE', false)");

        assertThat(bootstrapService.bootstrap(adminEmail).outcome()).isEqualTo(Outcome.CREATED);
    }

    @Test
    void anExistingLegitimateSuperAdminIsPreservedAndNoneIsAdded() {
        UUID existing = insertUser("real.admin@test.prowise", "Real-Admin-Own-Pass-1", "SUPER_ADMIN", "ACTIVE");
        String hashBefore = jdbc.queryForObject("SELECT password_hash FROM users WHERE id = ?", String.class, existing);

        assertThat(bootstrapService.bootstrap(adminEmail).outcome()).isEqualTo(Outcome.ACTIVE_SUPER_ADMIN_EXISTS);

        assertThat(count("SELECT count(*) FROM users")).isEqualTo(1);
        assertThat(jdbc.queryForMap("SELECT status, password_hash FROM users WHERE id = ?", existing))
                .containsEntry("status", "ACTIVE").containsEntry("password_hash", hashBefore);
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void aConfiguredAddressThatBelongsToAnotherAccountIsNeverPromoted() {
        UUID developer = insertUser(adminEmail, "Developer-Own-Pass-1", "DEVELOPER", "ACTIVE");

        SuperAdminBootstrapService.Result result = bootstrapService.bootstrap(adminEmail);

        assertThat(result.outcome()).isEqualTo(Outcome.REFUSED_EMAIL_IN_USE);
        assertThat(jdbc.queryForObject("SELECT role FROM users WHERE id = ?", String.class, developer)).isEqualTo("DEVELOPER");
        assertThat(count("SELECT count(*) FROM user_roles WHERE user_id = ?", developer)).isZero();
        assertThat(count("SELECT count(*) FROM auth_audit_logs WHERE action = 'SUPER_ADMIN_BOOTSTRAP_REFUSED' AND target_user_id = ?",
                developer)).isEqualTo(1);
        verify(mailSender, never()).send(any(MimeMessage.class));
    }

    @Test
    void blankOrInvalidConfigurationDoesNothing() {
        assertThat(bootstrapService.bootstrap(null).outcome()).isEqualTo(Outcome.NOT_CONFIGURED);
        assertThat(bootstrapService.bootstrap("   ").outcome()).isEqualTo(Outcome.NOT_CONFIGURED);
        assertThat(bootstrapService.bootstrap("not-an-email").outcome()).isEqualTo(Outcome.INVALID_EMAIL);
        assertThat(bootstrapService.bootstrap("two words@test.prowise").outcome()).isEqualTo(Outcome.INVALID_EMAIL);
        assertThat(count("SELECT count(*) FROM users")).isZero();
    }

    @Test
    void noHttpEndpointCanTriggerBootstrap() {
        List<String> patterns = new ArrayList<>();
        handlerMapping.getHandlerMethods().keySet().forEach(info -> patterns.addAll(info.getPatternValues()));
        assertThat(patterns).isNotEmpty();
        assertThat(patterns).noneMatch(pattern -> pattern.toLowerCase().contains("bootstrap"));
    }

    @Test
    void setupLinksAndTokensNeverReachTheApplicationLog(CapturedOutput output) throws Exception {
        bootstrapService.bootstrap(adminEmail);
        String token = CapturedMail.token(CapturedMail.sentHtml(mailSender).get(0), SETUP_LINK);

        assertThat(output.getAll()).doesNotContain(token).doesNotContain(SETUP_LINK);
    }

    private List<Outcome> runConcurrently(String... emails) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(emails.length);
        CountDownLatch start = new CountDownLatch(1);
        try {
            List<Future<Outcome>> futures = new ArrayList<>();
            for (String email : emails) {
                Callable<Outcome> task = () -> {
                    start.await();
                    return bootstrapService.bootstrap(email).outcome();
                };
                futures.add(pool.submit(task));
            }
            start.countDown();
            List<Outcome> outcomes = new ArrayList<>();
            for (Future<Outcome> future : futures) {
                outcomes.add(future.get());
            }
            return outcomes;
        } finally {
            pool.shutdownNow();
        }
    }

    private UUID insertUser(String email, String password, String role, String status) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, password_hash, name, role, status, must_change_password) "
                + "VALUES (?, ?, ?, ?, ?, ?, false)", id, email, passwordEncoder.encode(password), email, role, status);
        return id;
    }

    private String credentials(String email, String password) throws Exception {
        return objectMapper.writeValueAsString(Map.of("email", email, "password", password));
    }

    private long count(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }
}
