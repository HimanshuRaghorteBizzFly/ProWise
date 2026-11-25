package com.prowise.identity;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

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
    /** Wrong passwords in a row before the account is locked, and for how long. */
    static final int MAX_FAILED_ATTEMPTS = 5;
    static final int LOCK_MINUTES = 15;
    /** Roles held by the account itself (platform scope); every other role comes from a membership. */
    static final java.util.Set<String> PLATFORM_ROLES = java.util.Set.of("SUPER_ADMIN", "PLATFORM_OPERATOR");
    /** BCrypt of a random value nobody knows: compared against for unknown emails so timing reveals nothing. */
    private static final String DUMMY_HASH =
            new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode(AccountTokenService.randomToken());

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
    private final RequestThrottle throttle;

    public AuthService(
            JdbcTemplate jdbc,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            OrganizationService organizationService,
            EmailSender emailSender,
            ObjectProvider<EmailCredentialService> emailCredentialServiceProvider,
            AccountTokenService accountTokenService,
            RequestThrottle throttle,
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
        this.throttle = throttle;
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
    public void signup(String email, String password, String name, String ip) {
        signup(email, password, name, null, null, ip);
    }

    /**
     * Organization signup: as {@link #signup(String, String, String, String)}, and the account also names the
     * organization it will own. The workspace is only requested here; it is created when the address is confirmed
     * ({@link #verifyEmail}), so nothing tenant-scoped exists for an unconfirmed address. A repeated signup for a
     * pending account never changes the workspace it requested.
     */
    @Transactional
    public void signup(String email, String password, String name, String organizationName, String timezone, String ip) {
        validateCredentials(email, password);
        RequestedWorkspace workspace = requestedWorkspace(organizationName, timezone);
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
        if (workspace != null) {
            jdbc.update("INSERT INTO pending_signup_workspaces (user_id, organization_name, timezone) VALUES (?, ?, ?)",
                    userId, workspace.name(), workspace.timezone());
        }
        sendVerificationLink(userId, normalizedEmail, displayName, "SIGNUP_REGISTERED", ip);
    }

    /** Workspace requested on the signup form; {@code null} when the form named none. */
    private record RequestedWorkspace(String name, String timezone) {}

    static final int WORKSPACE_NAME_MIN = 2;
    static final int WORKSPACE_NAME_MAX = 120;

    private static RequestedWorkspace requestedWorkspace(String organizationName, String timezone) {
        boolean named = organizationName != null && !organizationName.isBlank();
        boolean zoned = timezone != null && !timezone.isBlank();
        if (!named && !zoned) {
            return null;
        }
        List<com.prowise.common.api.ApiError.FieldError> errors = new java.util.ArrayList<>();
        String name = named ? organizationName.trim().replaceAll("\\s+", " ") : "";
        if (!named) {
            errors.add(new com.prowise.common.api.ApiError.FieldError("organization_name", "is required"));
        } else if (name.length() < WORKSPACE_NAME_MIN || name.length() > WORKSPACE_NAME_MAX) {
            errors.add(new com.prowise.common.api.ApiError.FieldError("organization_name",
                    "must be " + WORKSPACE_NAME_MIN + " to " + WORKSPACE_NAME_MAX + " characters"));
        } else if (name.codePoints().filter(Character::isLetterOrDigit).count() < WORKSPACE_NAME_MIN) {
            errors.add(new com.prowise.common.api.ApiError.FieldError("organization_name", "must contain letters or digits"));
        }
        String zone = zoned ? timezone.trim() : "";
        if (!zoned) {
            errors.add(new com.prowise.common.api.ApiError.FieldError("timezone", "is required"));
        } else if (!java.time.ZoneId.getAvailableZoneIds().contains(zone)) {
            errors.add(new com.prowise.common.api.ApiError.FieldError("timezone", "must be a valid IANA timezone"));
        }
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.", errors);
        }
        return new RequestedWorkspace(name, zone);
    }

    /** Lower-case address for the organization, from its name; a random suffix when that address is taken. */
    private String freeSlugFor(String organizationName) {
        String base = organizationName.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9]+", "-")
                .replaceAll("(^-+|-+$)", "");
        if (base.isEmpty()) base = "workspace";
        if (base.length() > 60) base = base.substring(0, 60).replaceAll("-+$", "");
        String slug = base;
        for (int attempt = 0; slugTaken(slug); attempt++) {
            if (attempt >= 10) {
                throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_SLUG", "Could not reserve an address for the workspace.");
            }
            slug = base + "-" + UUID.randomUUID().toString().substring(0, 6);
        }
        return slug;
    }

    private boolean slugTaken(String slug) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM organizations WHERE slug = ?", Integer.class, slug);
        return n != null && n > 0;
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

        // Organization signup: the requested workspace is created now, with this account as its Organization Owner.
        // OrganizationService writes the organization, owner membership, audit row and OrganizationCreated event; all
        // of it commits (or rolls back) together with the activation above.
        List<Map<String, Object>> requested = jdbc.queryForList(
                "SELECT organization_name, timezone FROM pending_signup_workspaces WHERE user_id = ? FOR UPDATE", consumed.userId());
        if (!requested.isEmpty()) {
            String orgName = (String) requested.get(0).get("organization_name");
            organizationService.createForRegistration(consumed.userId(), new OrganizationService.CreateOrganizationRequest(
                    orgName, freeSlugFor(orgName), (String) requested.get(0).get("timezone"),
                    Map.of("workDays", List.of(1, 2, 3, 4, 5), "dailyHours", 8, "holidays", List.of())));
            jdbc.update("DELETE FROM pending_signup_workspaces WHERE user_id = ?", consumed.userId());
        }
    }

    private void sendVerificationLink(UUID userId, String email, String name, String auditAction, String ip) {
        String token = accountTokenService.issue(userId, AccountTokenService.Purpose.VERIFY);
        String status = EmailCredentialService.STATUS_NOT_SENT;
        EmailCredentialService credService = emailCredentialServiceProvider.getIfAvailable();
        if (credService != null) {
            status = credService.sendEmailVerificationEmail(userId, email, name, token).status();
        }
        recordAuditLog(auditAction, null, null, userId, "{\"email_delivery_status\":\"" + status + "\"}", ip);
    }

    public TokenPair signin(String email, String password) {
        return signin(email, password, null, null);
    }

    /**
     * Legacy sign-in. Same checks as {@link #login} (rate limits, lockout, login history, pending/disabled answers)
     * through {@link #authenticate}; only the session differs: it is not bound to any organization, the client binds
     * one explicitly through the switch endpoint (task 1.3, T06).
     */
    @Transactional(noRollbackFor = ApiException.class)
    public TokenPair signin(String email, String password, String ip, String userAgent) {
        Map<String, Object> user = authenticate(email, password, ip, userAgent);
        UUID userId = (UUID) user.get("id");
        jdbc.update("UPDATE users SET last_login_at = now() WHERE id = ?", userId);
        recordLoginAttempt(userId, normalize(email), ip, userAgent, "SUCCESS", null);
        return issueSession(userId, (String) user.get("email"));
    }

    /**
     * The credential check every sign-in path shares: per-email and per-address throttling, a timing-safe miss for
     * unknown addresses, DISABLED answered directly, the lock checked before the password, five wrong passwords in a
     * row lock the account, and a pending account revealed only after the right password. Returns the users row.
     */
    /** Optional so unit tests can build the service without the organization module. */
    private org.springframework.beans.factory.ObjectProvider<com.prowise.org.InvitationService> invitations;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setInvitationService(org.springframework.beans.factory.ObjectProvider<com.prowise.org.InvitationService> invitations) {
        this.invitations = invitations;
    }

    private java.util.Optional<UUID> createdFromTemporaryPassword(String email, String password) {
        com.prowise.org.InvitationService service = invitations == null ? null : invitations.getIfAvailable();
        return service == null ? java.util.Optional.empty() : service.createAccountFromTemporaryPassword(email, password);
    }

    private Map<String, Object> authenticate(String email, String password, String ip, String userAgent) {
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "Email and password are required.");
        }
        throttle.checkIp("signin", ip);
        enforceRateLimit("signin:" + normalizeForRateLimit(email));

        String normalizedEmail = normalize(email);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, email, password_hash, status, name, role, department, must_change_password, "
                        + "(locked_until IS NOT NULL AND locked_until > now()) AS locked "
                        + "FROM users WHERE lower(email) = lower(?)",
                normalizedEmail);

        if (rows.isEmpty()) {
            // Someone invited to an organization signs in for the first time with the emailed temporary password:
            // that creates the account and the membership (InvitationService), then sign-in continues normally.
            java.util.Optional<UUID> created = createdFromTemporaryPassword(normalizedEmail, password);
            if (created.isPresent()) {
                password = password.trim();
                rows = new java.util.ArrayList<>(jdbc.queryForList(
                        "SELECT id, email, password_hash, status, name, role, department, must_change_password, "
                                + "(locked_until IS NOT NULL AND locked_until > now()) AS locked, "
                                + "true AS temporary_password_sign_in "
                                + "FROM users WHERE id = ?",
                        created.get()));
            }
        }
        if (rows.isEmpty()) {
            passwordEncoder.matches(password, DUMMY_HASH); // same work as a real check: no timing hint
            recordLoginAttempt(null, normalizedEmail, ip, userAgent, "FAILED", "User not found");
            throw invalidCredentials();
        }

        Map<String, Object> user = rows.get(0);
        UUID userId = (UUID) user.get("id");
        String status = (String) user.get("status");

        // Every address follows the same rules: no account (whatever its email or role) bypasses a check below.

        // A suspended account is told so directly (approved decision D4: seeded logins answer ACCOUNT_DISABLED).
        if ("DISABLED".equalsIgnoreCase(status)) {
            recordLoginAttempt(userId, normalizedEmail, ip, userAgent, "FAILED", "Account suspended");
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED",
                    "Your account has been suspended. Please contact your administrator.");
        }
        if (Boolean.TRUE.equals(user.get("locked"))) {
            recordLoginAttempt(userId, normalizedEmail, ip, userAgent, "FAILED", "Account locked");
            throw new ApiException(HttpStatus.LOCKED, "ACCOUNT_LOCKED",
                    "Too many failed sign-in attempts. Try again in " + LOCK_MINUTES + " minutes or reset your password.");
        }

        if (!passwordEncoder.matches(password, (String) user.get("password_hash"))) {
            registerFailedAttempt(userId);
            recordLoginAttempt(userId, normalizedEmail, ip, userAgent, "FAILED", "Invalid password");
            throw invalidCredentials();
        }
        jdbc.update("UPDATE users SET failed_login_count = 0, locked_until = NULL "
                + "WHERE id = ? AND (failed_login_count > 0 OR locked_until IS NOT NULL)", userId);

        // Checked after the password so the response does not reveal that a pending account exists.
        if ("PENDING_ACTIVATION".equalsIgnoreCase(status)) {
            recordLoginAttempt(userId, normalizedEmail, ip, userAgent, "FAILED", "Account pending activation");
            throw new ApiException(HttpStatus.FORBIDDEN, "ACCOUNT_PENDING_ACTIVATION",
                    "Activate your account using the link we emailed you, then sign in.");
        }
        return user;
    }

    public AuthResponse login(String email, String password, String ip, String userAgent) {
        return login(email, password, null, ip, userAgent);
    }

    /**
     * The one sign-in for all nine roles. Platform roles (Super Admin, Platform Operator) come from the account and
     * are never bound to an organization. Every organization role comes from the member's ACTIVE membership in an
     * ACTIVE organization, never from the {@code users.role} column, so the same person can be a Developer in one
     * organization and an Owner in another. With several usable memberships the session starts unbound and the
     * client asks the person to choose (switch endpoint), unless {@code requestedOrganizationId} names one of them.
     *
     * <p>Five wrong passwords in a row lock the account for 15 minutes; the lock is checked before the password, so
     * guessing stops even with the right one. A pending account is only revealed after the right password.
     */
    @Transactional(noRollbackFor = ApiException.class)
    public AuthResponse login(String email, String password, UUID requestedOrganizationId, String ip, String userAgent) {
        Map<String, Object> user = authenticate(email, password, ip, userAgent);
        String normalizedEmail = normalize(email);
        UUID userId = (UUID) user.get("id");
        String name = (String) user.get("name");
        String accountRole = user.get("role") == null ? "" : ((String) user.get("role")).trim().toUpperCase(java.util.Locale.ROOT);
        String department = (String) user.get("department");
        boolean mustChangePassword = Boolean.TRUE.equals(user.get("must_change_password"));
        boolean temporaryPasswordSignIn = Boolean.TRUE.equals(user.get("temporary_password_sign_in"));

        UUID organizationId = null;
        String role;
        List<OrganizationChoice> choices = List.of();
        boolean requiresSelection = false;
        if (PLATFORM_ROLES.contains(accountRole)) {
            // A platform role works outside every tenant: never bind that session to an organization.
            role = accountRole;
        } else {
            List<MembershipRow> all = memberships(userId);
            List<MembershipRow> usable = all.stream().filter(MembershipRow::usable).toList();
            choices = usable.stream().map(m -> new OrganizationChoice(m.orgId(), m.orgName(), m.role(),
                    resolveDashboardUrl(m.role(), m.orgId(), false))).toList();
            if (requestedOrganizationId != null) {
                MembershipRow chosen = usable.stream().filter(m -> m.orgId().equals(requestedOrganizationId)).findFirst()
                        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND,
                                "The requested resource was not found."));
                organizationId = chosen.orgId();
                role = chosen.role();
            } else if (usable.size() == 1) {
                organizationId = usable.get(0).orgId();
                role = usable.get(0).role();
            } else if (usable.size() > 1) {
                requiresSelection = true;
                role = null; // no organization role until one is chosen; the token carries no role authority
            } else if (!all.isEmpty()) {
                boolean orgSuspended = all.stream()
                        .anyMatch(m -> "ACTIVE".equals(m.membershipStatus()) && !"ACTIVE".equals(m.orgState()));
                recordLoginAttempt(userId, normalizedEmail, ip, userAgent, "FAILED",
                        orgSuspended ? "Organization suspended" : "Membership disabled");
                throw orgSuspended
                        ? new ApiException(HttpStatus.FORBIDDEN, "ORGANIZATION_SUSPENDED",
                                "Your organization's workspace is suspended. Contact your organization owner or Prowise support.")
                        : new ApiException(HttpStatus.FORBIDDEN, "MEMBERSHIP_DISABLED",
                                "Your access to your organization has been suspended. Contact your organization administrator.");
            } else {
                role = "VIEWER"; // no organization yet: a verified self-registered owner creates the first workspace
            }
        }

        String targetDashboardUrl = requiresSelection
                ? (mustChangePassword ? "/change-password" : "/select-org")
                : resolveDashboardUrl(role, organizationId, mustChangePassword);

        TokenPair tokens = issueSession(userId, normalizedEmail, UUID.randomUUID(), organizationId, role, name,
                mustChangePassword, ip, userAgent);
        jdbc.update("UPDATE users SET last_login_at = now() WHERE id = ?", userId);
        recordLoginAttempt(userId, normalizedEmail, ip, userAgent, "SUCCESS", null);

        UserSummary userSummary = new UserSummary(userId, normalizedEmail, name, role, department, organizationId,
                lookupOrgName(organizationId), mustChangePassword);
        return new AuthResponse(tokens.accessToken(), tokens.refreshToken(), accessTokenMinutes * 60, mustChangePassword,
                targetDashboardUrl, userSummary, requiresSelection, choices, temporaryPasswordSignIn);
    }

    /** Counts a wrong password; the fifth in a row locks the account and starts the count again. */
    private void registerFailedAttempt(UUID userId) {
        jdbc.update("""
                UPDATE users SET
                    locked_until = CASE WHEN failed_login_count + 1 >= ? THEN now() + (? * interval '1 minute') ELSE locked_until END,
                    failed_login_count = CASE WHEN failed_login_count + 1 >= ? THEN 0 ELSE failed_login_count + 1 END
                WHERE id = ?
                """, MAX_FAILED_ATTEMPTS, LOCK_MINUTES, MAX_FAILED_ATTEMPTS, userId);
    }

    /** Every membership of the person with its organization's state, for login decisions and the chooser. */
    private List<MembershipRow> memberships(UUID userId) {
        return jdbc.query("""
                SELECT m.org_id, o.name, m.role_template, m.status, o.state
                FROM memberships m JOIN organizations o ON o.id = m.org_id
                WHERE m.user_id = ? ORDER BY lower(o.name), o.id
                """, (rs, n) -> new MembershipRow(rs.getObject("org_id", UUID.class), rs.getString("name"),
                rs.getString("role_template"), rs.getString("status"), rs.getString("state")), userId);
    }

    /**
     * The role a session carries. Bound to {@code organizationId}: the ACTIVE membership's role in an ACTIVE
     * organization, or null when there is none, also for a platform account (an organization-bound token never
     * carries platform authority). Unbound: the account's platform role, or null.
     */
    private String sessionRole(UUID userId, String accountRole, UUID organizationId) {
        if (organizationId == null) {
            String platform = accountRole == null ? "" : accountRole.trim().toUpperCase(java.util.Locale.ROOT);
            return PLATFORM_ROLES.contains(platform) ? platform : null;
        }
        List<String> roles = jdbc.queryForList("""
                SELECT m.role_template FROM memberships m JOIN organizations o ON o.id = m.org_id
                WHERE m.org_id = ? AND m.user_id = ? AND m.status = 'ACTIVE' AND o.state = 'ACTIVE'
                """, String.class, organizationId, userId);
        return roles.isEmpty() ? null : roles.get(0);
    }

    @Transactional
    public TokenPair changePassword(UUID userId, String currentPassword, String newPassword, String ip) {
        return changePassword(userId, null, currentPassword, newPassword, ip);
    }

    @Transactional
    public TokenPair changePassword(UUID userId, UUID currentOrganization, String currentPassword, String newPassword, String ip) {
        validatePassword(newPassword);

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
        if (passwordEncoder.matches(newPassword, currentHash)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "PASSWORD_REUSE", "Choose a password different from your current one.");
        }

        String newHash = passwordEncoder.encode(newPassword);
        jdbc.update("UPDATE users SET password_hash = ?, must_change_password = false, version = version + 1, updated_at = now() WHERE id = ?",
                newHash, userId);

        // Invalidate previous sessions
        jdbc.update("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", userId);

        String email = (String) user.get("email");
        String name = (String) user.get("name");

        recordAuditLog("PASSWORD_CHANGED", userId, email, userId, "{\"changedBy\":\"user\"}", ip);

        // Keep the caller's organization (when still usable) and its membership role; never the users-row role.
        UUID orgId = currentOrganization;
        String role = sessionRole(userId, (String) user.get("role"), orgId);
        if (orgId != null && role == null) orgId = null;
        return issueSession(userId, email, UUID.randomUUID(), orgId, role, name, false, ip, null);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public TokenPair refresh(String refreshToken) {
        String hash = hash(refreshToken);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, user_id, family_id, org_id, revoked_at, user_agent, ip_address, (expires_at <= now()) AS expired "
                        + "FROM sessions WHERE refresh_token_hash = ?",
                hash);
        if (rows.isEmpty()) {
            throw invalidCredentials();
        }
        Map<String, Object> row = rows.get(0);
        UUID familyId = (UUID) row.get("family_id");
        if (row.get("revoked_at") != null || Boolean.TRUE.equals(row.get("expired"))) {
            // Reuse of a rotated or revoked refresh token: close the whole family (stolen-token defence).
            jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = ?",
                    familyId);
            throw invalidCredentials();
        }
        UUID userId = (UUID) row.get("user_id");
        // Claim the token atomically: of two concurrent refreshes with the same token only one revokes the row;
        // the loser is treated as reuse and closes the family, exactly like a replay after rotation.
        int claimed = jdbc.update("UPDATE sessions SET revoked_at = now() WHERE id = ? AND revoked_at IS NULL", row.get("id"));
        if (claimed != 1) {
            jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = ?", familyId);
            throw invalidCredentials();
        }
        Map<String, Object> user = jdbc.queryForMap(
                "SELECT email, status, role, name, must_change_password FROM users WHERE id = ?", userId);
        if (!"ACTIVE".equals(user.get("status"))) {
            // A disabled or pending account gets no new session; its whole refresh family is closed.
            jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE family_id = ?", familyId);
            throw invalidCredentials();
        }
        // Keep the organization binding only while the membership and the organization are still active
        // (task 1.3, T06); the role is re-read from that membership, so a role change applies on the next refresh.
        UUID organizationId = (UUID) row.get("org_id");
        String role = sessionRole(userId, (String) user.get("role"), organizationId);
        if (organizationId != null && role == null) {
            organizationId = null;
        }
        return issueSession(userId, (String) user.get("email"), familyId, organizationId, role,
                (String) user.get("name"), Boolean.TRUE.equals(user.get("must_change_password")),
                (String) row.get("ip_address"), (String) row.get("user_agent"));
    }

    @Transactional
    public void signout(AuthPrincipal principal) {
        if (principal != null && principal.sessionId() != null) {
            jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = ?",
                    principal.sessionId());
        }
    }

    public TokenPair switchOrganization(AuthPrincipal principal, UUID organizationId) {
        return switchOrganizationWithRole(principal, organizationId).tokens();
    }

    /**
     * Issues an access token bound to {@code organizationId} (task 1.3, T06) carrying the membership's role there.
     * The current session is revoked in the same transaction, so the previous organization's access token and
     * refresh token stop working on their next use; the new session continues the same refresh family.
     */
    @Transactional
    public SwitchResult switchOrganizationWithRole(AuthPrincipal principal, UUID organizationId) {
        Map<String, Object> user = principal.isOperator() ? null
                : jdbc.queryForMap("SELECT role, name FROM users WHERE id = ?", principal.userId());
        // The membership role there; a platform account that is also a member gets only that role (no platform authority).
        String role = user == null || organizationId == null ? null : sessionRole(principal.userId(), null, organizationId);
        if (role == null) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "The requested resource was not found.");
        }
        Map<String, Object> current = jdbc.query("SELECT family_id, ip_address, user_agent FROM sessions WHERE id = ? AND user_id = ?",
                rs -> rs.next() ? Map.<String, Object>of("family_id", rs.getObject("family_id", UUID.class),
                        "ip", String.valueOf(rs.getString("ip_address")), "ua", String.valueOf(rs.getString("user_agent"))) : null,
                principal.sessionId(), principal.userId());
        jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = ?", principal.sessionId());
        UUID familyId = current == null ? UUID.randomUUID() : (UUID) current.get("family_id");
        TokenPair tokens = issueSession(principal.userId(), principal.email(), familyId, organizationId, role,
                (String) user.get("name"), false,
                current == null ? null : nullIfText((String) current.get("ip")), current == null ? null : nullIfText((String) current.get("ua")));
        return new SwitchResult(tokens, role, resolveDashboardUrl(role, organizationId, false));
    }

    private static String nullIfText(String value) {
        return value == null || "null".equals(value) ? null : value;
    }

    private boolean hasActiveMembership(UUID userId, UUID organizationId) {
        return sessionRole(userId, null, organizationId) != null;
    }

    /** The signed-in identity as the current session sees it: role and organization of this token, not the users row. */
    public ExtendedMeResponse me(AuthPrincipal principal) {
        UUID userId = principal.userId();
        Map<String, Object> user = jdbc.queryForMap(
                "SELECT id, email, name, role, department, phone, status, must_change_password FROM users WHERE id = ?",
                userId);

        List<MembershipResponse> memberships = jdbc.query(
                "SELECT m.id, m.org_id, m.role_template, m.status, o.name, o.slug, o.timezone, o.work_calendar "
                        + "FROM memberships m JOIN organizations o ON o.id = m.org_id "
                        + "WHERE m.user_id = ? AND m.status = 'ACTIVE' AND o.state = 'ACTIVE' ORDER BY o.slug",
                (rs, rowNum) -> new MembershipResponse(
                        rs.getObject("id", UUID.class), rs.getObject("org_id", UUID.class),
                        rs.getString("role_template"), rs.getString("status"), rs.getString("name"),
                        rs.getString("slug"), rs.getString("timezone"), rs.getString("work_calendar")),
                userId);

        UUID organizationId = principal.organizationId();
        String role = sessionRole(userId, (String) user.get("role"), organizationId);
        boolean mustChangePassword = Boolean.TRUE.equals(user.get("must_change_password"));
        String target;
        if (role == null && organizationId == null && memberships.size() > 1) {
            target = "/select-org";
        } else if (role == null && organizationId == null && memberships.size() == 1) {
            target = resolveDashboardUrl(memberships.get(0).roleTemplate(), memberships.get(0).orgId(), mustChangePassword);
        } else {
            target = resolveDashboardUrl(role == null ? "VIEWER" : role, organizationId, mustChangePassword);
        }

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
                mustChangePassword,
                target,
                memberships
        );
    }

    public ExtendedMeResponse me(UUID userId) {
        return me(new AuthPrincipal(userId, null, null, null, null, null, null, null, false, null));
    }

    /* ------------------------------------------------------------------ self-service sessions */

    /** The caller's open sessions (one per signed-in device), newest first; the current one is marked. */
    public List<SessionView> sessions(AuthPrincipal principal) {
        return jdbc.query("""
                SELECT s.id, s.created_at, COALESCE(s.last_used_at, s.created_at) AS last_used_at, s.expires_at,
                       s.user_agent, s.ip_address, o.name AS org_name
                FROM sessions s LEFT JOIN organizations o ON o.id = s.org_id
                WHERE s.user_id = ? AND s.revoked_at IS NULL AND s.expires_at > now()
                ORDER BY s.created_at DESC
                LIMIT 50
                """, (rs, n) -> new SessionView(rs.getObject("id", UUID.class), rs.getTimestamp("created_at").toInstant(),
                rs.getTimestamp("last_used_at").toInstant(), rs.getTimestamp("expires_at").toInstant(),
                rs.getString("user_agent"), rs.getString("ip_address"), rs.getString("org_name"),
                rs.getObject("id", UUID.class).equals(principal.sessionId())), principal.userId());
    }

    /** Signs one of the caller's own devices out. Someone else's or an unknown session is a 404. */
    @Transactional
    public void revokeSession(AuthPrincipal principal, UUID sessionId) {
        int updated = jdbc.update("UPDATE sessions SET revoked_at = now() WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
                sessionId, principal.userId());
        if (updated != 1) {
            throw new ApiException(HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND, "The requested resource was not found.");
        }
        recordAuditLog("SESSION_REVOKED", principal.userId(), principal.email(), principal.userId(),
                "{\"current\":" + sessionId.equals(principal.sessionId()) + "}", null);
    }

    /** Signs every other device out; the current session stays. */
    @Transactional
    public int revokeOtherSessions(AuthPrincipal principal) {
        int count = jdbc.update("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND id <> ? AND revoked_at IS NULL",
                principal.userId(), principal.sessionId());
        recordAuditLog("SESSIONS_REVOKED", principal.userId(), principal.email(), principal.userId(),
                "{\"count\":" + count + "}", null);
        return count;
    }

    @Transactional
    public void requestPasswordReset(String email) {
        requestPasswordReset(email, null);
    }

    /** Throttled per address as well as per email, so one client cannot spray reset emails across many accounts. */
    public void requestPasswordReset(String email, String ip) {
        throttle.checkIp("password-reset", ip);
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
        auditPasswordEvent(consumed.purpose() == AccountTokenService.Purpose.SETUP ? "ACCOUNT_ACTIVATED" : "PASSWORD_RESET", userId);
    }

    /**
     * First password for a pending account (the emailed setup link). Accepts only SETUP links, so a reset link can
     * never be replayed here. The password is validated before the single-use link is consumed.
     */
    @Transactional
    public void activateAccount(String token, String password) {
        validatePassword(password);
        AccountTokenService.ConsumedToken consumed = accountTokenService.consume(token, AccountTokenService.Purpose.SETUP)
                .orElseThrow(AuthService::invalidLink);
        int updated = jdbc.update("UPDATE users SET password_hash = ?, must_change_password = false, status = 'ACTIVE', "
                + "version = version + 1, updated_at = now() WHERE id = ? AND status = 'PENDING_ACTIVATION'",
                passwordEncoder.encode(password), consumed.userId());
        if (updated != 1) {
            throw invalidLink(); // rolls back the token consumption with the rest of the transaction
        }
        jdbc.update("UPDATE sessions SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", consumed.userId());
        auditPasswordEvent("ACCOUNT_ACTIVATED", consumed.userId());
    }

    private void auditPasswordEvent(String action, UUID userId) {
        String email = jdbc.queryForObject("SELECT email FROM users WHERE id = ?", String.class, userId);
        recordAuditLog(action, userId, email, userId, "{\"via\":\"emailed_link\"}", null);
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
        return issueSession(userId, email, familyId, organizationId, role, name, mustChangePassword, null, null);
    }

    private TokenPair issueSession(UUID userId, String email, UUID familyId, UUID organizationId, String role, String name,
            boolean mustChangePassword, String ip, String userAgent) {
        String refreshToken = randomToken();
        UUID sessionId = UUID.randomUUID();
        // The session remembers its organization (task 1.3, T06) so refresh keeps the binding, and the device
        // details the member needs to recognise it in "My sessions".
        jdbc.update("INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, org_id, expires_at, ip_address, user_agent, last_used_at) "
                        + "VALUES (?, ?, ?, ?, ?, now() + (? * interval '1 day'), ?, ?, now())",
                sessionId, userId, hash(refreshToken), familyId, organizationId, refreshTokenDays,
                truncate(ip, 64), truncate(userAgent, 300));

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
        List<String> problems = PasswordPolicy.violations(password);
        if (!problems.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, PasswordPolicy.SUMMARY,
                    problems.stream().map(p -> new com.prowise.common.api.ApiError.FieldError("password", p)).toList());
        }
    }

    private static String normalize(String email) {
        return email.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private static String normalizeForRateLimit(String email) {
        return email == null ? "" : normalize(email);
    }

    private void enforceRateLimit(String key) {
        enforceRateLimit(key, MAX_ATTEMPTS_PER_WINDOW);
    }

    private void enforceRateLimit(String key, int maxAttempts) {
        throttle.check(key, maxAttempts);
    }

    private static String randomToken() {
        return AccountTokenService.randomToken();
    }

    static String hash(String value) {
        return AccountTokenService.hash(value);
    }

    /** The refresh token travels only in the HttpOnly cookie; it is never serialised into a response body. */
    public record TokenPair(String accessToken, @com.fasterxml.jackson.annotation.JsonIgnore String refreshToken) {}
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
            @com.fasterxml.jackson.annotation.JsonIgnore String refreshToken,
            long expiresIn,
            boolean mustChangePassword,
            String targetDashboardUrl,
            UserSummary user,
            boolean requiresOrganizationSelection,
            List<OrganizationChoice> organizations,
            /** True only on the sign-in that created the account from an emailed temporary password. */
            boolean signedInWithTemporaryPassword
    ) {}
    public record MembershipResponse(UUID id, UUID orgId, String roleTemplate, String status,
            String name, String slug, String timezone, String workCalendar) {}
    private record MembershipRow(UUID orgId, String orgName, String role, String membershipStatus, String orgState) {
        boolean usable() {
            return "ACTIVE".equals(membershipStatus) && "ACTIVE".equals(orgState);
        }
    }
    /** An organization the person can sign into, with the role and dashboard it gives. */
    public record OrganizationChoice(UUID organizationId, String name, String role, String targetDashboardUrl) {}
    public record SwitchResult(TokenPair tokens, String role, String targetDashboardUrl) {}
    public record SessionView(UUID id, Instant createdAt, Instant lastUsedAt, Instant expiresAt, String userAgent,
            String ipAddress, String organizationName, boolean current) {}

    private static String truncate(String value, int max) {
        return value == null ? null : value.length() <= max ? value : value.substring(0, max);
    }
}
