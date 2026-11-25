package com.prowise.identity;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.operator.operations.EmailDeliveryLogEntity;
import com.prowise.operator.operations.EmailDeliveryLogRepository;

/**
 * First Super Admin bootstrap (approved decisions D1 to D3, Phase 2).
 *
 * <p>Triggered only by deployment configuration ({@code PROWISE_BOOTSTRAP_SUPER_ADMIN_EMAIL}) through
 * {@link SuperAdminBootstrapRunner} at startup. There is no HTTP endpoint. The account is created
 * PENDING_ACTIVATION with a random unknown password hash, and the owner chooses a password through the existing
 * single-use 72-hour setup link (only its SHA-256 hash is stored). Login is refused until then.
 *
 * <p>Safety rules:
 * <ul>
 *   <li>A transaction-scoped PostgreSQL advisory lock serialises concurrent starts (API and worker, or several
 *       replicas), so two instances can never both create an account.</li>
 *   <li>If any legitimate ACTIVE Super Admin exists, nothing happens. Legacy seeded accounts that still use a
 *       published password ({@link PublishedSeedCredentials}) are not legitimate and are never counted.</li>
 *   <li>Never a second Super Admin: if a legitimate pending Super Admin exists for another address, or the
 *       configured address belongs to any other account, bootstrap refuses and records why.</li>
 *   <li>Fail closed (D2): if the email cannot be delivered the account stays pending. A later restart sends a
 *       fresh link (superseding the old one) unless a delivered link is still valid. The link is never logged.</li>
 *   <li>Every action is written to {@code auth_audit_logs}.</li>
 * </ul>
 * Emergency recovery when no Super Admin can sign in is deliberately not implemented (D3); see docs/decisions.md.
 */
@Service
public class SuperAdminBootstrapService {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminBootstrapService.class);
    /** Arbitrary constant identifying this lock in pg_locks ("PrWsBoot"). */
    static final long ADVISORY_LOCK_KEY = 0x5072577342_6F6F74L;
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    static final String ACTOR = "system:super-admin-bootstrap";

    public enum Outcome {
        NOT_CONFIGURED,
        INVALID_EMAIL,
        ACTIVE_SUPER_ADMIN_EXISTS,
        CREATED,
        SETUP_LINK_RESENT,
        SETUP_LINK_STILL_VALID,
        REFUSED_EMAIL_IN_USE,
        CREATED_WITH_INITIAL_PASSWORD,
        ACTIVATED_WITH_INITIAL_PASSWORD,
        WEAK_INITIAL_PASSWORD,
        /** The configured initial password is one published in this repository (PublishedSeedCredentials). */
        PUBLISHED_INITIAL_PASSWORD,
        REFUSED_OTHER_PENDING_SUPER_ADMIN
    }

    public record Result(Outcome outcome, UUID userId, String emailDeliveryStatus) {}

    private record SuperAdminRow(UUID id, String email, String status) {}

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final AccountTokenService accountTokenService;
    private final EmailCredentialService emailCredentialService;
    private final EmailDeliveryLogRepository deliveryLogRepository;

    public SuperAdminBootstrapService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder,
            AccountTokenService accountTokenService, EmailCredentialService emailCredentialService,
            EmailDeliveryLogRepository deliveryLogRepository) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.accountTokenService = accountTokenService;
        this.emailCredentialService = emailCredentialService;
        this.deliveryLogRepository = deliveryLogRepository;
    }

    /** Setup-link bootstrap (no initial password configured). */
    @Transactional
    public Result bootstrap(String configuredEmail) {
        return bootstrap(configuredEmail, null);
    }

    /**
     * Bootstrap with an optional initial password ({@code PROWISE_BOOTSTRAP_SUPER_ADMIN_PASSWORD}). When set, the
     * account is created (or a pending bootstrap account is activated) ACTIVE with {@code must_change_password},
     * so the first sign-in forces a new password; no email is sent and no setup link remains usable. It never
     * changes an ACTIVE Super Admin, so the variable cannot act as a password reset. A password that fails
     * {@link PasswordPolicy} is refused and nothing is created. The password itself is never logged or audited.
     */
    @Transactional
    public Result bootstrap(String configuredEmail, String initialPassword) {
        boolean withPassword = initialPassword != null && !initialPassword.isBlank();
        if (configuredEmail == null || configuredEmail.isBlank()) {
            return new Result(Outcome.NOT_CONFIGURED, null, null);
        }
        String email = configuredEmail.trim().toLowerCase(Locale.ROOT);
        if (email.length() > 320 || !EMAIL.matcher(email).matches()) {
            log.warn("Super Admin bootstrap skipped: PROWISE_BOOTSTRAP_SUPER_ADMIN_EMAIL is not a valid address");
            return new Result(Outcome.INVALID_EMAIL, null, null);
        }
        if (withPassword && !PasswordPolicy.isAcceptable(initialPassword)) {
            log.warn("Super Admin bootstrap skipped: PROWISE_BOOTSTRAP_SUPER_ADMIN_PASSWORD does not meet the password policy. {}",
                    PasswordPolicy.SUMMARY);
            return new Result(Outcome.WEAK_INITIAL_PASSWORD, null, null);
        }
        if (withPassword && PublishedSeedCredentials.PASSWORDS.contains(initialPassword)) {
            log.warn("Super Admin bootstrap skipped: PROWISE_BOOTSTRAP_SUPER_ADMIN_PASSWORD is a password published in "
                    + "this repository. Choose a private password.");
            return new Result(Outcome.PUBLISHED_INITIAL_PASSWORD, null, null);
        }

        // Held until this transaction ends; a concurrent start waits here and then sees the committed result.
        jdbc.queryForList("SELECT pg_advisory_xact_lock(?)", ADVISORY_LOCK_KEY);

        List<SuperAdminRow> legitimate = legitimateSuperAdmins();
        if (legitimate.stream().anyMatch(row -> "ACTIVE".equals(row.status()))) {
            log.info("Super Admin bootstrap not needed: an active Super Admin exists");
            return new Result(Outcome.ACTIVE_SUPER_ADMIN_EXISTS, null, null);
        }

        List<UUID> existing = jdbc.query("SELECT id FROM users WHERE lower(email) = ?",
                (rs, rowNum) -> rs.getObject("id", UUID.class), email);
        if (!existing.isEmpty()) {
            UUID userId = existing.get(0);
            Optional<SuperAdminRow> pending = legitimate.stream().filter(row -> row.id().equals(userId)).findFirst();
            if (pending.isEmpty()) {
                // Never promote an existing account through configuration.
                audit("SUPER_ADMIN_BOOTSTRAP_REFUSED", userId, "{\"reason\":\"email_belongs_to_another_account\"}");
                log.warn("Super Admin bootstrap refused: the configured address already belongs to a non-Super-Admin account");
                return new Result(Outcome.REFUSED_EMAIL_IN_USE, userId, null);
            }
            return withPassword ? activateWithInitialPassword(userId, initialPassword) : resendIfNeeded(userId, email);
        }

        if (!legitimate.isEmpty()) {
            audit("SUPER_ADMIN_BOOTSTRAP_REFUSED", legitimate.get(0).id(), "{\"reason\":\"another_super_admin_is_pending\"}");
            log.warn("Super Admin bootstrap refused: another Super Admin account is already pending activation");
            return new Result(Outcome.REFUSED_OTHER_PENDING_SUPER_ADMIN, legitimate.get(0).id(), null);
        }

        UUID userId = UUID.randomUUID();
        if (withPassword) {
            jdbc.update("""
                    INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                    VALUES (?, ?, ?, 'Super Admin', 'SUPER_ADMIN', 'ACTIVE', true)
                    """, userId, email, passwordEncoder.encode(initialPassword));
            grantSuperAdminRole(userId);
            audit("SUPER_ADMIN_BOOTSTRAP_CREATED", userId, "{\"method\":\"initial_password\"}");
            log.info("Super Admin bootstrap created an active account with the configured initial password; "
                    + "a password change is required at first sign-in");
            return new Result(Outcome.CREATED_WITH_INITIAL_PASSWORD, userId, null);
        }
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, 'Super Admin', 'SUPER_ADMIN', 'PENDING_ACTIVATION', false)
                """, userId, email, passwordEncoder.encode(AccountTokenService.randomToken()));
        grantSuperAdminRole(userId);
        String status = sendSetupLink(userId, email);
        audit("SUPER_ADMIN_BOOTSTRAP_CREATED", userId, "{\"email_delivery_status\":\"" + status + "\"}");
        log.info("Super Admin bootstrap created a pending account; setup email status {}", status);
        return new Result(Outcome.CREATED, userId, status);
    }

    private void grantSuperAdminRole(UUID userId) {
        jdbc.update("INSERT INTO user_roles (user_id, role_name) VALUES (?, 'SUPER_ADMIN') ON CONFLICT (user_id, role_name) DO NOTHING",
                userId);
    }

    /** Activates the pending bootstrap account with the configured password and retires its open setup links. */
    private Result activateWithInitialPassword(UUID userId, String initialPassword) {
        jdbc.update("""
                UPDATE users SET password_hash = ?, status = 'ACTIVE', must_change_password = true,
                       failed_login_count = 0, locked_until = NULL, updated_at = now()
                WHERE id = ? AND status = 'PENDING_ACTIVATION'
                """, passwordEncoder.encode(initialPassword), userId);
        jdbc.update("UPDATE password_reset_tokens SET used_at = now() WHERE user_id = ? AND used_at IS NULL", userId);
        audit("SUPER_ADMIN_BOOTSTRAP_ACTIVATED", userId, "{\"method\":\"initial_password\"}");
        log.info("Super Admin bootstrap activated the pending account with the configured initial password; "
                + "a password change is required at first sign-in");
        return new Result(Outcome.ACTIVATED_WITH_INITIAL_PASSWORD, userId, null);
    }

    private Result resendIfNeeded(UUID userId, String email) {
        boolean delivered = deliveryLogRepository
                .findFirstByUserIdAndEmailTypeOrderByCreatedAtDesc(userId, EmailCredentialService.TYPE_ACCOUNT_SETUP)
                .map(EmailDeliveryLogEntity::getStatus)
                .filter(EmailCredentialService.STATUS_ACCEPTED::equals)
                .isPresent();
        Integer openLinks = jdbc.queryForObject("""
                SELECT count(*) FROM password_reset_tokens
                WHERE user_id = ? AND purpose = 'SETUP' AND used_at IS NULL AND expires_at > now()
                """, Integer.class, userId);
        if (delivered && openLinks != null && openLinks > 0) {
            log.info("Super Admin bootstrap: the pending account already has a delivered, unexpired setup link");
            return new Result(Outcome.SETUP_LINK_STILL_VALID, userId, EmailCredentialService.STATUS_ACCEPTED);
        }
        String status = sendSetupLink(userId, email);
        audit("SUPER_ADMIN_BOOTSTRAP_RESENT", userId, "{\"email_delivery_status\":\"" + status + "\"}");
        log.info("Super Admin bootstrap re-sent the setup link; email status {}", status);
        return new Result(Outcome.SETUP_LINK_RESENT, userId, status);
    }

    private String sendSetupLink(UUID userId, String email) {
        // issue() supersedes every earlier unused setup link of this account.
        String token = accountTokenService.issue(userId, AccountTokenService.Purpose.SETUP);
        return emailCredentialService.sendAccountSetupEmail(userId, email, "Super Admin", token).status();
    }

    /** ACTIVE or pending Super Admins, excluding seeded accounts whose hash still verifies against a published password. */
    private List<SuperAdminRow> legitimateSuperAdmins() {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT u.id, lower(u.email) AS email, u.status, u.password_hash FROM users u
                WHERE u.status IN ('ACTIVE', 'PENDING_ACTIVATION')
                  AND (upper(u.role) = 'SUPER_ADMIN'
                       OR EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND upper(r.role_name) = 'SUPER_ADMIN'))
                ORDER BY u.created_at, u.id
                """);
        return rows.stream()
                .filter(row -> !(PublishedSeedCredentials.isSeededUserEmail((String) row.get("email"))
                        && PublishedSeedCredentials.matchesPublishedPassword((String) row.get("email"), (String) row.get("password_hash"))))
                .map(row -> new SuperAdminRow((UUID) row.get("id"), (String) row.get("email"), (String) row.get("status")))
                .toList();
    }

    private void audit(String action, UUID targetUserId, String details) {
        jdbc.update("""
                INSERT INTO auth_audit_logs (id, action, actor_id, actor_email, target_user_id, details, ip_address)
                VALUES (?, ?, NULL, ?, ?, CAST(? AS jsonb), NULL)
                """, UUID.randomUUID(), action, ACTOR, targetUserId, details);
    }
}
