package com.prowise.identity;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.notification.EmailMessage;
import com.prowise.notification.EmailSender;
import com.prowise.org.OrganizationService;

@Service
@Profile("!test")
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final int MAX_ATTEMPTS_PER_WINDOW = 10;
    private static final long RATE_WINDOW_MILLIS = 60_000L;
    private static final Map<String, RateAttempt> RATE_ATTEMPTS = new ConcurrentHashMap<>();

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final OrganizationService organizationService;
    private final EmailSender emailSender;
    private final ObjectProvider<EmailCredentialService> emailCredentialServiceProvider;
    private final AccountTokenService accountTokenService;
    private final long refreshTokenDays;
    private final long accessTokenMinutes;
    private final int signupMaxPerIpPerMinute;

    public AuthService(
            JdbcTemplate jdbc,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            OrganizationService organizationService,
            EmailSender emailSender,
            ObjectProvider<EmailCredentialService> emailCredentialServiceProvider,
            AccountTokenService accountTokenService,
            @Value("${prowise.auth.refresh-token-days:30}") long refreshTokenDays,
            @Value("${prowise.auth.access-token-minutes:15}") long accessTokenMinutes,
            @Value("${prowise.auth.signup-max-per-ip-per-minute:20}") int signupMaxPerIpPerMinute) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.organizationService = organizationService;
        this.emailSender = emailSender;
        this.emailCredentialServiceProvider = emailCredentialServiceProvider;
        this.accountTokenService = accountTokenService;
        this.refreshTokenDays = refreshTokenDays;
        this.accessTokenMinutes = accessTokenMinutes;
        this.signupMaxPerIpPerMinute = signupMaxPerIpPerMinute;
    }

    /**
     * Public self-service registration (approved decision D9). The account is created PENDING_ACTIVATION with the
     * chosen password and the default VIEWER role, which carries no platform authority and no organization; the
     * owner gets organization rights only by creating a workspace after verifying. No session is issued: the
     * emailed single-use 72-hour link activates the account, then the owner signs in.
     *
     * <p>The response is identical whether or not the address is already registered, and an existing account is
     * never changed. A repeated signup for a self-registered account that is still pending re-sends the link
     * (superseding the previous one). Attempts are rate limited per email and per client address.
     */
    @Transactional
<<<<<<< HEAD
    public TokenPair signup(String email, String password, String name,
            OrganizationService.CreateOrganizationRequest organization) {
        validateCredentials(email, password);
        UUID userId = UUID.randomUUID();
        String normalizedEmail = normalize(email);
        String displayName = name == null || name.isBlank()
                ? normalizedEmail.substring(0, normalizedEmail.indexOf('@'))
                : name.trim();
        try {
            jdbc.update("INSERT INTO users (id, email, password_hash, name, role, status, must_change_password) VALUES (?, ?, ?, ?, 'VIEWER', 'ACTIVE', false)",
                    userId, normalizedEmail, passwordEncoder.encode(password), displayName);
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_IN_USE", "An account already exists for this email.");
        }

        OrganizationService.CreateOrganizationRequest workspace = organization == null
                ? defaultRegistrationOrganization(displayName, userId)
                : organization;
        OrganizationService.OrganizationResponse created = organizationService.createForRegistration(userId, workspace);
        jdbc.update("UPDATE users SET role = 'ORGANIZATION_OWNER', organization_id = ? WHERE id = ?",
                created.id(), userId);
        return issueSession(userId, normalizedEmail, UUID.randomUUID(), created.id(),
                "ORGANIZATION_OWNER", displayName, false);
=======
    public void signup(String email, String password, String name, String ip) {
        validateCredentials(email, password);
        String normalizedEmail = normalize(email);
        enforceRateLimit("signup:" + normalizedEmail, MAX_ATTEMPTS_PER_WINDOW);
        enforceRateLimit("signup-ip:" + (ip == null ? "" : ip), signupMaxPerIpPerMinute);

        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT id, name, status FROM users WHERE lower(email) = lower(?)", normalizedEmail);
        if (!existing.isEmpty()) {
            Map<String, Object> row = existing.get(0);
            UUID existingId = (UUID) row.get("id");
            Integer selfRegistered = jdbc.queryForObject(
                    "SELECT count(*) FROM password_reset_tokens WHERE user_id = ? AND purpose = 'VERIFY'",
                    Integer.class, existingId);
            if ("PENDING_ACTIVATION".equals(row.get("status")) && selfRegistered != null && selfRegistered > 0) {
                sendVerificationLink(existingId, normalizedEmail, (String) row.get("name"), "SIGNUP_VERIFICATION_RESENT", ip);
            } else {
                recordAuditLog("SIGNUP_EXISTING_EMAIL", null, null, existingId, "{\"changed\":false}", ip);
            }
            return;
        }

        UUID userId = UUID.randomUUID();
        String displayName = (name == null || name.isBlank()) ? normalizedEmail.split("@")[0] : name.trim();
        if (displayName.length() > 200) {
            displayName = displayName.substring(0, 200);
        }
        int inserted = jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, ?, 'VIEWER', 'PENDING_ACTIVATION', false)
                ON CONFLICT (lower(email)) DO NOTHING
                """, userId, normalizedEmail, passwordEncoder.encode(password), displayName);
        if (inserted != 1) {
            return; // a concurrent signup for the same address won; same response
        }
        sendVerificationLink(userId, normalizedEmail, displayName, "SIGNUP_REGISTERED", ip);
    }

    /** Activates a self-registered account from its emailed link. Single use; the account must still be pending. */
    @Transactional
    public void verifyEmail(String token) {
        AccountTokenService.ConsumedToken consumed = accountTokenService.consume(token, AccountTokenService.Purpose.VERIFY)
                .orElseThrow(AuthService::invalidLink);
        int updated = jdbc.update("UPDATE users SET status = 'ACTIVE', version = version + 1, updated_at = now() "
                + "WHERE id = ? AND status = 'PENDING_ACTIVATION'", consumed.userId());
        if (updated != 1) {
            throw invalidLink(); // rolls back the token consumption with the rest of the transaction
        }
        recordAuditLog("EMAIL_VERIFIED", consumed.userId(), null, consumed.userId(), "{\"via\":\"signup_link\"}", null);
    }

    private void sendVerificationLink(UUID userId, String email, String name, String auditAction, String ip) {
        String token = accountTokenService.issue(userId, AccountTokenService.Purpose.VERIFY);
        String status = EmailCredentialService.STATUS_NOT_SENT;
        EmailCredentialService credService = emailCredentialServiceProvider.getIfAvailable();
        if (credService != null) {
            status = credService.sendEmailVerificationEmail(userId, email, name, token).status();
        }
        recordAuditLog(auditAction, null, null, userId, "{\"email_delivery_status\":\"" + status + "\"}", ip);
>>>>>>> b46fd9c (Update ProWise application)
    }

    @Transactional
    public TokenPair signin(String email, String password) {
        enforceRateLimit("signin:" + normalizeForRateLimit(email));
        Map<String, Object> user;
        try {
            user = jdbc.queryForMap("SELECT id, email, password_hash, status, name, role, organization_id "
                            + "FROM users WHERE lower(email) = lower(?)",
                    email);
        } catch (org.springframework.dao.EmptyResultDataAccessException exception) {
            throw invalidCredentials();
        }
        if (!"ACTIVE".equals(user.get("status"))
                || !passwordEncoder.matches(password, (String) user.get("password_hash"))) {
            throw invalidCredentials();
        }
        UUID userId = (UUID) user.get("id");
        String role = (String) user.get("role");
        UUID organizationId = (UUID) user.get("organization_id");
        if ("SUPER_ADMIN".equalsIgnoreCase(role)) {
            organizationId = null;
        } else if (organizationId == null) {
            List<UUID> memberships = jdbc.query(
                    "SELECT org_id FROM memberships WHERE user_id = ? AND status = 'ACTIVE' ORDER BY created_at LIMIT 1",
                    (rs, rowNum) -> rs.getObject("org_id", UUID.class), userId);
            if (!memberships.isEmpty()) organizationId = memberships.get(0);
        }
        return issueSession(userId, (String) user.get("email"), UUID.randomUUID(), organizationId,
                role == null || role.isBlank() ? "VIEWER" : role, (String) user.get("name"), false);
    }

    private OrganizationService.CreateOrganizationRequest defaultRegistrationOrganization(String name, UUID userId) {
        String slug = "workspace-" + userId.toString().replace("-", "").substring(0, 16);
        return new OrganizationService.CreateOrganizationRequest(name + " Workspace", slug, "UTC",
                Map.of("workDays", List.of(1, 2, 3, 4, 5), "dailyHours", 8, "holidays", List.of()));
    }

    @Transactional
    public AuthResponse login(String email, String password, String ip, String userAgent) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "Email and password are required.");
        }
        enforceRateLimit("signin:" + normalizeForRateLimit(email));

        String normalizedEmail = normalize(email);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, email, password_hash, status, name, role, department, organization_id, must_change_password "
                        + "FROM users WHERE lower(email) = lower(?)",
                normalizedEmail);

        if (rows.isEmpty()) {
            recordLoginAttempt(null, normalizedEmail, ip, userAgent, "FAILED", "User not found");
            throw invalidCredentials();
        }

        Map<String, Object> user = rows.get(0);
        UUID userId = (UUID) user.get("id");
        String status = (String) user.get("status");
        String passwordHash = (String) user.get("password_hash");
        String name = (String) user.get("name");
        String role = (String) user.get("role");
        String department = (String) user.get("department");
        UUID organizationId = (UUID) user.get("organization_id");
        Boolean mustChangePassword = (Boolean) user.get("must_change_password");

        if ("DISABLED".equalsIgnoreCase(status)) {
            recordLoginAttempt(userId, normalizedEmail, ip, userAgent, "FAILED", "Account deactivated");
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED", "Your account has been deactivated. Please contact your administrator.");
        }

        if (!passwordEncoder.matches(password, passwordHash)) {
            recordLoginAttempt(userId, normalizedEmail, ip, userAgent, "FAILED", "Invalid password");
            throw invalidCredentials();
        }

<<<<<<< HEAD
        // A Platform Administrator works outside every tenant: never bind that session to an organization.
        if ("SUPER_ADMIN".equalsIgnoreCase(role)) {
            organizationId = null;
        } else if (organizationId == null) {
            // If organizationId is null, look up first active membership
=======
        // Checked after the password so the response does not reveal that a pending account exists.
        if ("PENDING_ACTIVATION".equalsIgnoreCase(status)) {
            recordLoginAttempt(userId, normalizedEmail, ip, userAgent, "FAILED", "Account pending activation");
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_PENDING_ACTIVATION",
                    "Activate your account using the link we emailed you, then sign in.");
        }

        // If organizationId is null, look up first active membership
        if (organizationId == null) {
>>>>>>> b46fd9c (Update ProWise application)
            List<UUID> orgs = jdbc.query("SELECT org_id FROM memberships WHERE user_id = ? AND status = 'ACTIVE' LIMIT 1",
                    (rs, rowNum) -> rs.getObject("org_id", UUID.class), userId);
            if (!orgs.isEmpty()) {
                organizationId = orgs.get(0);
            }
        }

        if (role == null || role.isBlank()) {
            role = "VIEWER";
        }

        String targetDashboardUrl = resolveDashboardUrl(role, organizationId, mustChangePassword);

        TokenPair tokens = issueSession(userId, normalizedEmail, UUID.randomUUID(), organizationId, role, name, Boolean.TRUE.equals(mustChangePassword));

        try {
            jdbc.update("UPDATE users SET last_login_at = now() WHERE id = ?", userId);
        } catch (Exception ignored) {}
        recordLoginAttempt(userId, normalizedEmail, ip, userAgent, "SUCCESS", null);

        String orgName = lookupOrgName(organizationId);
        UserSummary userSummary = new UserSummary(userId, normalizedEmail, name, role, department, organizationId, orgName, Boolean.TRUE.equals(mustChangePassword));

        return new AuthResponse(
                tokens.accessToken(),
                tokens.refreshToken(),
                accessTokenMinutes * 60,
                Boolean.TRUE.equals(mustChangePassword),
                targetDashboardUrl,
                userSummary
        );
    }

    @Transactional
    public TokenPair changePassword(UUID userId, String currentPassword, String newPassword, String ip) {
        if (newPassword == null || newPassword.length() < 8) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "New password must contain at least 8 characters.");
        }

        Map<String, Object> user;
        try {
            user = jdbc.queryForMap(
                    "SELECT id, email, password_hash, must_change_password, role, name, organization_id FROM users WHERE id = ?",
                    userId);
        } catch (org.springframework.dao.EmptyResultDataAccessException ex) {
            throw new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "User not found.");
        }

        String currentHash = (String) user.get("password_hash");
        Boolean mustChange = (Boolean) user.get("must_change_password");

        if (currentPassword != null && !currentPassword.isBlank()) {
            if (!passwordEncoder.matches(currentPassword, currentHash)) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_CURRENT_PASSWORD", "The current password is incorrect.");
            }
        } else if (!Boolean.TRUE.equals(mustChange)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "CURRENT_PASSWORD_REQUIRED", "Current password is required.");
        }

        String newHash = passwordEncoder.encode(newPassword);
        jdbc.update("UPDATE users SET password_hash = ?, must_change_password = false, version = version + 1, updated_at = now() WHERE id = ?",
                newHash, userId);

        // Invalidate previous sessions
        jdbc.update("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", userId);

        String email = (String) user.get("email");
        String role = (String) user.get("role");
        String name = (String) user.get("name");
        UUID orgId = (UUID) user.get("organization_id");

        recordAuditLog("PASSWORD_CHANGED", userId, email, userId, "{\"changedBy\":\"user\"}", ip);

        return issueSession(userId, email, UUID.randomUUID(), orgId, role, name, false);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public TokenPair refresh(String refreshToken) {
        String hash = hash(refreshToken);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, user_id, family_id, org_id, revoked_at, (expires_at <= now()) AS expired "
                        + "FROM sessions WHERE refresh_token_hash = ?",
                hash);
        if (rows.isEmpty()) {
            throw invalidCredentials();
        }
        Map<String, Object> row = rows.get(0);
        UUID familyId = (UUID) row.get("family_id");
        if (row.get("revoked_at") != null || Boolean.TRUE.equals(row.get("expired"))) {
            jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = ?",
                    familyId);
            throw invalidCredentials();
        }
        UUID userId = (UUID) row.get("user_id");
        jdbc.update("UPDATE sessions SET revoked_at = now() WHERE id = ?", row.get("id"));
<<<<<<< HEAD
        Map<String, Object> user = jdbc.queryForMap(
                "SELECT email, role, name, must_change_password FROM users WHERE id = ?", userId);
        // Keep the organization binding only while the membership is still active (task 1.3, T06).
        UUID organizationId = (UUID) row.get("org_id");
        if (organizationId != null && !hasActiveMembership(userId, organizationId)) {
            organizationId = null;
        }
        // Role and name come from the user row now, so a changed role takes effect on the next refresh.
        return issueSession(userId, (String) user.get("email"), familyId, organizationId, (String) user.get("role"),
                (String) user.get("name"), Boolean.TRUE.equals(user.get("must_change_password")));
=======
        Map<String, Object> owner = jdbc.queryForMap("SELECT email, status FROM users WHERE id = ?", userId);
        if (!"ACTIVE".equals(owner.get("status"))) {
            // A disabled or pending account gets no new session; its whole refresh family is closed.
            jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = ?", familyId);
            throw invalidCredentials();
        }
        return issueSession(userId, (String) owner.get("email"), familyId);
>>>>>>> b46fd9c (Update ProWise application)
    }

    @Transactional
    public void signout(AuthPrincipal principal) {
        if (principal != null && principal.sessionId() != null) {
            jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = ?",
                    principal.sessionId());
        }
    }

    /**
     * Issues an access token bound to {@code organizationId} (task 1.3, T06). The current session is revoked in
     * the same transaction, so the previous organization's access token and refresh token stop working on their
     * next use; the new session continues the same refresh family and remembers the organization.
     */
    @Transactional
    public TokenPair switchOrganization(AuthPrincipal principal, UUID organizationId) {
        if (principal.isOperator() || !hasActiveMembership(principal.userId(), organizationId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "The requested resource was not found.");
        }
        UUID familyId = jdbc.query("SELECT family_id FROM sessions WHERE id = ? AND user_id = ?",
                rs -> rs.next() ? rs.getObject("family_id", UUID.class) : null,
                principal.sessionId(), principal.userId());
        jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = ?", principal.sessionId());
        Map<String, Object> user = jdbc.queryForMap("SELECT role, name FROM users WHERE id = ?", principal.userId());
        return issueSession(principal.userId(), principal.email(), familyId == null ? UUID.randomUUID() : familyId,
                organizationId, (String) user.get("role"), (String) user.get("name"), false);
    }

    private boolean hasActiveMembership(UUID userId, UUID organizationId) {
        if (userId == null || organizationId == null) {
            return false;
        }
        Integer membership = jdbc.queryForObject("""
                SELECT count(*) FROM memberships
                WHERE org_id = ? AND user_id = ? AND status = 'ACTIVE'
                """, Integer.class, organizationId, userId);
        return membership != null && membership == 1;
    }

    public ExtendedMeResponse me(UUID userId) {
        Map<String, Object> user = jdbc.queryForMap(
                "SELECT id, email, name, role, department, organization_id, phone, status, must_change_password FROM users WHERE id = ?",
                userId);

        List<MembershipResponse> memberships = jdbc.query(
                "SELECT m.id, m.org_id, m.role_template, m.status, o.name, o.slug, o.timezone, o.work_calendar "
                        + "FROM memberships m JOIN organizations o ON o.id = m.org_id "
                        + "WHERE m.user_id = ? AND m.status = 'ACTIVE' ORDER BY o.slug",
                (rs, rowNum) -> new MembershipResponse(
                        rs.getObject("id", UUID.class), rs.getObject("org_id", UUID.class),
                        rs.getString("role_template"), rs.getString("status"), rs.getString("name"),
                        rs.getString("slug"), rs.getString("timezone"), rs.getString("work_calendar")),
                userId);

        String role = (String) user.get("role");
        UUID organizationId = (UUID) user.get("organization_id");
        Boolean mustChangePassword = (Boolean) user.get("must_change_password");

        return new ExtendedMeResponse(
                (UUID) user.get("id"),
                (String) user.get("email"),
                (String) user.get("name"),
                role,
                (String) user.get("department"),
                organizationId,
                lookupOrgName(organizationId),
                (String) user.get("phone"),
                (String) user.get("status"),
                Boolean.TRUE.equals(mustChangePassword),
                resolveDashboardUrl(role, organizationId, mustChangePassword),
                memberships
        );
    }

    @Transactional
    public void requestPasswordReset(String email) {
        enforceRateLimit("password-reset:" + normalizeForRateLimit(email));
        // Pending accounts finish setup through their invitation link (or an administrator's resend),
        // so a reset request for them silently issues nothing, like an unknown address.
        List<Map<String, Object>> users = jdbc.queryForList(
                "SELECT id, name FROM users WHERE lower(email) = lower(?) AND status <> 'PENDING_ACTIVATION'", email);
        if (!users.isEmpty()) {
            Map<String, Object> u = users.get(0);
            UUID userId = (UUID) u.get("id");
            String name = (String) u.get("name");
            String token = accountTokenService.issue(userId, AccountTokenService.Purpose.RESET);

            EmailCredentialService credService = emailCredentialServiceProvider.getIfAvailable();
            if (credService != null) {
                credService.sendPasswordResetEmail(userId, email, name, token);
            } else {
                emailSender.send(new EmailMessage(email, "ProWise password reset",
                        "Use this password reset token within 30 minutes: " + token));
            }
        }
    }

    @Transactional
    public void confirmPasswordReset(String token, String password) {
        // Validate first so a weak password does not burn the single-use token.
        validatePassword(password);
        // A signup verification link can never set a password through this endpoint.
        AccountTokenService.ConsumedToken consumed = accountTokenService.consume(token,
                        AccountTokenService.Purpose.SETUP, AccountTokenService.Purpose.RESET)
                .orElseThrow(AuthService::invalidCredentials);
        UUID userId = consumed.userId();
        String encoded = passwordEncoder.encode(password);
        int updated;
        if (consumed.purpose() == AccountTokenService.Purpose.SETUP) {
            // Setup activates only an account that is still pending; a disabled account stays disabled.
            updated = jdbc.update("UPDATE users SET password_hash = ?, must_change_password = false, status = 'ACTIVE', "
                    + "version = version + 1, updated_at = now() WHERE id = ? AND status = 'PENDING_ACTIVATION'", encoded, userId);
        } else {
            updated = jdbc.update("UPDATE users SET password_hash = ?, must_change_password = false, "
                    + "version = version + 1, updated_at = now() WHERE id = ?", encoded, userId);
        }
        if (updated != 1) {
            throw invalidCredentials(); // rolls back the token consumption with the rest of the transaction
        }
        jdbc.update("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", userId);
    }

    public static String resolveDashboardUrl(String role, UUID organizationId, Boolean mustChangePassword) {
        if (Boolean.TRUE.equals(mustChangePassword)) {
            return "/change-password";
        }
        String cleanRole = role != null ? role.trim().toUpperCase() : "VIEWER";
        String orgStr = organizationId != null ? organizationId.toString() : "";

        return switch (cleanRole) {
            case "SUPER_ADMIN" -> "/super-admin/dashboard";
            case "PLATFORM_OPERATOR" -> "/platform-operator/dashboard";
            case "ORGANIZATION_OWNER" -> organizationId != null ? "/org/" + orgStr + "/owner/dashboard" : "/select-org";
            case "ORGANIZATION_ADMIN" -> organizationId != null ? "/org/" + orgStr + "/admin/dashboard" : "/select-org";
            case "PROJECT_MANAGER" -> organizationId != null ? "/org/" + orgStr + "/manager/dashboard" : "/select-org";
            case "TEAM_LEAD" -> organizationId != null ? "/org/" + orgStr + "/lead/dashboard" : "/select-org";
            case "DEVELOPER" -> organizationId != null ? "/org/" + orgStr + "/developer/dashboard" : "/select-org";
            case "QA_REVIEWER" -> organizationId != null ? "/org/" + orgStr + "/reviewer/dashboard" : "/select-org";
            default -> organizationId != null ? "/org/" + orgStr + "/viewer/dashboard" : "/create-organization"; // a verified self-registered owner creates the first workspace
        };
    }

    private TokenPair issueSession(UUID userId, String email) {
        return issueSession(userId, email, UUID.randomUUID(), null, null, null, false);
    }

    private TokenPair issueSession(UUID userId, String email, UUID familyId) {
        return issueSession(userId, email, familyId, null, null, null, false);
    }

    private TokenPair issueSession(UUID userId, String email, UUID familyId, UUID organizationId) {
        return issueSession(userId, email, familyId, organizationId, null, null, false);
    }

    private TokenPair issueSession(UUID userId, String email, UUID familyId, UUID organizationId, String role, String name, boolean mustChangePassword) {
        String refreshToken = randomToken();
        UUID sessionId = UUID.randomUUID();
<<<<<<< HEAD
        // The session remembers its organization (task 1.3, T06) so refresh keeps the binding.
        jdbc.update("INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, org_id, expires_at) "
                        + "VALUES (?, ?, ?, ?, ?, now() + (? * interval '1 day'))",
                sessionId, userId, hash(refreshToken), familyId, organizationId, refreshTokenDays);
        String accessToken = jwtService.issueAccessToken(new AuthPrincipal(userId, sessionId, email, organizationId,
                null, role, null, null, mustChangePassword, name));
=======
        jdbc.update("INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, expires_at) "
                        + "VALUES (?, ?, ?, ?, now() + (? * interval '1 day'))",
                sessionId, userId, hash(refreshToken), familyId, refreshTokenDays);

        // A users-table platform operator acts with the access level and department of its own active
        // platform_operators row. Without such a row the token carries no operator claims at all (it used to be
        // given MAIN_PLATFORM_OPERATOR unconditionally).
        String opId = null;
        String dept = null;
        String accessLevel = null;
        if ("PLATFORM_OPERATOR".equalsIgnoreCase(role)) {
            List<Map<String, Object>> ops = jdbc.queryForList("""
                    SELECT id, department_id, access_level FROM platform_operators
                    WHERE (user_id = ? OR lower(email) = lower(?)) AND status = 'ACTIVE' AND password_setup_completed
                    ORDER BY id LIMIT 1
                    """, userId, email);
            if (!ops.isEmpty()) {
                opId = Objects.toString(ops.get(0).get("id"), null);
                dept = Objects.toString(ops.get(0).get("department_id"), null);
                accessLevel = Objects.toString(ops.get(0).get("access_level"), null);
            }
        }

        AuthPrincipal principal = new AuthPrincipal(
                userId, sessionId, email, organizationId, opId, role, dept,
                accessLevel, mustChangePassword, name
        );

        String accessToken = jwtService.issueAccessToken(principal);
>>>>>>> b46fd9c (Update ProWise application)
        return new TokenPair(accessToken, refreshToken);
    }

    private void recordLoginAttempt(UUID userId, String email, String ip, String userAgent, String status, String failureReason) {
        try {
            jdbc.update("""
                    INSERT INTO user_login_history (id, user_id, email, ip_address, user_agent, status, failure_reason)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """, UUID.randomUUID(), userId, email, ip, userAgent, status, failureReason);
        } catch (Exception ex) {
            log.warn("Could not record login attempt: {}", ex.getMessage());
        }
    }

    private void recordAuditLog(String action, UUID actorId, String actorEmail, UUID targetUserId, String details, String ip) {
        try {
            jdbc.update("""
                    INSERT INTO auth_audit_logs (id, action, actor_id, actor_email, target_user_id, details, ip_address)
                    VALUES (?, ?, ?, ?, ?, ?::jsonb, ?)
                    """, UUID.randomUUID(), action, actorId, actorEmail, targetUserId, details, ip);
        } catch (Exception ex) {
            log.warn("Could not record auth audit log: {}", ex.getMessage());
        }
    }

    private String lookupOrgName(UUID orgId) {
        if (orgId == null) return null;
        try {
            List<String> names = jdbc.query("SELECT name FROM organizations WHERE id = ?",
                    (rs, rowNum) -> rs.getString("name"), orgId);
            return names.isEmpty() ? null : names.get(0);
        } catch (Exception e) {
            return null;
        }
    }

    private static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, ErrorCodes.INVALID_CREDENTIALS,
                "The credentials are invalid.");
    }

    private static ApiException invalidLink() {
        return new ApiException(HttpStatus.BAD_REQUEST, "INVALID_TOKEN",
                "This link is invalid, already used or expired.");
    }

    private static void validateCredentials(String email, String password) {
        if (email == null || !email.contains("@")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED,
                    "The request has invalid fields.");
        }
        validatePassword(password);
    }

    private static void validatePassword(String password) {
        if (password == null || password.length() < 12) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED,
                    "The request has invalid fields.");
        }
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private static String normalizeForRateLimit(String email) {
        return email == null ? "" : normalize(email);
    }

    private static void enforceRateLimit(String key) {
        enforceRateLimit(key, MAX_ATTEMPTS_PER_WINDOW);
    }

    private static void enforceRateLimit(String key, int maxAttempts) {
        long now = System.currentTimeMillis();
        RateAttempt attempt = RATE_ATTEMPTS.compute(key, (ignored, current) -> {
            if (current == null || now - current.startedAt() >= RATE_WINDOW_MILLIS) {
                return new RateAttempt(now, 1);
            }
            return new RateAttempt(current.startedAt(), current.count() + 1);
        });
        if (attempt.count() > maxAttempts) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, ErrorCodes.RATE_LIMITED,
                    "Too many attempts. Try again later.");
        }
    }

    private static String randomToken() {
        return AccountTokenService.randomToken();
    }

    static String hash(String value) {
        return AccountTokenService.hash(value);
    }

    public record TokenPair(String accessToken, String refreshToken) {}
    public record MeResponse(UUID id, String email, List<MembershipResponse> memberships) {}
    public record ExtendedMeResponse(
            UUID id,
            String email,
            String name,
            String role,
            String department,
            UUID organizationId,
            String organizationName,
            String phone,
            String status,
            boolean mustChangePassword,
            String targetDashboardUrl,
            List<MembershipResponse> memberships
    ) {}
    public record UserSummary(
            UUID id,
            String email,
            String name,
            String role,
            String department,
            UUID organizationId,
            String organizationName,
            boolean mustChangePassword
    ) {}
    public record AuthResponse(
            String accessToken,
            String refreshToken,
            long expiresIn,
            boolean mustChangePassword,
            String targetDashboardUrl,
            UserSummary user
    ) {}
    public record MembershipResponse(UUID id, UUID orgId, String roleTemplate, String status,
            String name, String slug, String timezone, String workCalendar) {}
    private record RateAttempt(long startedAt, int count) {}
}
