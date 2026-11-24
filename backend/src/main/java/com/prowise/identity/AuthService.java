package com.prowise.identity;

import java.time.Instant;
import java.util.List;
import java.util.Map;
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
    private final boolean slidingRefresh;
    private final long reuseGraceSeconds;

    public AuthService(
            JdbcTemplate jdbc,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            OrganizationService organizationService,
            EmailSender emailSender,
            ObjectProvider<EmailCredentialService> emailCredentialServiceProvider,
            @Value("${prowise.auth.refresh-token-days}") long refreshTokenDays,
            @Value("${prowise.auth.access-token-minutes}") long accessTokenMinutes,
            @Value("${prowise.auth.refresh-sliding}") boolean slidingRefresh,
            @Value("${prowise.auth.refresh-reuse-grace-seconds}") long reuseGraceSeconds) {
        this.slidingRefresh = slidingRefresh;
        this.reuseGraceSeconds = reuseGraceSeconds;
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
     * Company registration. One transaction: user, organization, ACTIVE owner membership, Organization Owner grant,
     * audit row and OrganizationCreated outbox event (OrganizationService via ChangeRecorder). The caller never
     * chooses a role or an organization id: the new user is always the one and only Owner of the new organization,
     * and the session is bound to it.
     */
    @Transactional
    public SignupResult signup(String email, String password, String name,
            OrganizationService.CreateOrganizationRequest organization) {
        validateCredentials(email, password);
        String normalizedEmail = normalize(email);
        String displayName = name == null || name.isBlank()
                ? normalizedEmail.substring(0, normalizedEmail.indexOf('@'))
                : name.trim();
        try {
            jdbc.update("INSERT INTO users (id, email, password_hash, name, role, status, must_change_password) "
                            + "VALUES (?, ?, ?, ?, 'ORGANIZATION_OWNER', 'ACTIVE', false)",
                    userId, normalizedEmail, passwordEncoder.encode(password), displayName);
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_IN_USE", "An account already exists for this email.");
        }

        OrganizationService.CreateOrganizationRequest workspace = organization == null
                ? defaultRegistrationOrganization(displayName, userId)
                : organization;
        OrganizationService.OrganizationResponse created = organizationService.createForRegistration(userId, workspace);
        jdbc.update("UPDATE users SET organization_id = ? WHERE id = ?", created.id(), userId);
        Integer owners = jdbc.queryForObject("""
                SELECT count(*) FROM memberships m
                JOIN grants g ON g.membership_id = m.id AND g.org_id = m.org_id AND g.scope = 'ORG'
                JOIN roles r ON r.id = g.template_role_id AND r.is_template AND r.name = 'ORGANIZATION_OWNER'
                WHERE m.org_id = ? AND m.status = 'ACTIVE' AND m.role_template = 'ORGANIZATION_OWNER'
                """, Integer.class, created.id());
        if (owners == null || owners != 1) {
            // Rolls the whole registration back: a workspace without exactly one Owner must never exist.
            throw new IllegalStateException("Registration did not produce exactly one Organization Owner.");
        }
        TokenPair tokens = issueSession(userId, normalizedEmail, UUID.randomUUID(), created.id(),
                "ORGANIZATION_OWNER", displayName, false);
        recordAuditLog("LOGIN", userId, normalizedEmail, userId, "{\"method\":\"signup\"}", null);
        return new SignupResult(tokens, created.id(), LandingPolicy.dashboardFor("ORGANIZATION_OWNER", created.id()));
    }

    /** Active memberships of a user (the only source for tenant landing pages and token role claims). */
    private List<LandingPolicy.Membership> activeMemberships(UUID userId) {
        return jdbc.query("""
                SELECT m.org_id, m.role_template FROM memberships m
                JOIN organizations o ON o.id = m.org_id
                WHERE m.user_id = ? AND m.status = 'ACTIVE'
                ORDER BY m.created_at, m.org_id
                """, (rs, n) -> new LandingPolicy.Membership(rs.getObject("org_id", UUID.class),
                rs.getString("role_template")), userId);
    }

    /** Platform role for platform accounts; otherwise the role template of the bound membership (or none). */
    private String tokenRole(UUID userId, UUID organizationId, String userRole) {
        if (LandingPolicy.isPlatformRole(userRole)) return userRole.trim().toUpperCase(java.util.Locale.ROOT);
        if (organizationId == null) return null;
        return activeMemberships(userId).stream()
                .filter(m -> organizationId.equals(m.orgId()))
                .map(LandingPolicy.Membership::roleTemplate)
                .findFirst().orElse(null);
    }

    @Transactional
    public TokenPair signin(String email, String password) {
        enforceRateLimit("signin:" + normalizeForRateLimit(email));
        Map<String, Object> user;
        try {
            user = jdbc.queryForMap("SELECT id, email, password_hash, status FROM users WHERE lower(email) = lower(?)",
                    email);
        } catch (org.springframework.dao.EmptyResultDataAccessException exception) {
            throw invalidCredentials();
        }
        if (!"ACTIVE".equals(user.get("status"))
                || !passwordEncoder.matches(password, (String) user.get("password_hash"))) {
            throw invalidCredentials();
        }
        UUID userId = (UUID) user.get("id");
        LandingPolicy.Landing landing = LandingPolicy.resolve((String) user.get("role"), activeMemberships(userId), null);
        TokenPair tokens = issueSession(userId, (String) user.get("email"), UUID.randomUUID(), landing.organizationId(),
                landing.role(), (String) user.get("name"), false);
        recordAuditLog("LOGIN", userId, (String) user.get("email"), userId, "{\"method\":\"signin\"}", null);
        return tokens;
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
        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "Email and password are required.");
        }
        enforceRateLimit("signin:" + normalizeForRateLimit(email));

        String normalizedEmail = normalize(email);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, email, password_hash, status, name, role, department, must_change_password, "
                        + "(locked_until IS NOT NULL AND locked_until > now()) AS locked "
                        + "FROM users WHERE lower(email) = lower(?)",
                normalizedEmail);

        if (rows.isEmpty()) {
            passwordEncoder.matches(password, DUMMY_HASH); // same work as a real check: no timing hint
            recordLoginAttempt(null, normalizedEmail, ip, userAgent, "FAILED", "User not found");
            throw invalidCredentials();
        }

        Map<String, Object> user = rows.get(0);
        UUID userId = (UUID) user.get("id");
        String status = (String) user.get("status");
        String name = (String) user.get("name");
        String accountRole = user.get("role") == null ? "" : ((String) user.get("role")).trim().toUpperCase(java.util.Locale.ROOT);
        String department = (String) user.get("department");
        boolean mustChangePassword = Boolean.TRUE.equals(user.get("must_change_password"));

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

        // The landing page comes from the real account type and ACTIVE memberships, never from a default:
        // platform dashboards only for platform accounts; one workspace = bound session; several = picker; none =
        // "no workspace yet". A platform account is never bound to an organization.
        LandingPolicy.Landing landing = LandingPolicy.resolve(role, activeMemberships(userId), null);
        organizationId = landing.organizationId();
        role = landing.role();
        String targetDashboardUrl = Boolean.TRUE.equals(mustChangePassword) ? LandingPolicy.CHANGE_PASSWORD
                : landing.targetUrl();

        TokenPair tokens = issueSession(userId, normalizedEmail, UUID.randomUUID(), organizationId, role, name, Boolean.TRUE.equals(mustChangePassword));

        try {
            jdbc.update("UPDATE users SET last_login_at = now() WHERE id = ?", userId);
        } catch (Exception ignored) {}
        recordLoginAttempt(userId, normalizedEmail, ip, userAgent, "SUCCESS", null);
        recordAuditLog("LOGIN", userId, normalizedEmail, userId, "{\"method\":\"password\"}", ip);

        UserSummary userSummary = new UserSummary(userId, normalizedEmail, name, role, department, organizationId,
                lookupOrgName(organizationId), mustChangePassword);
        return new AuthResponse(tokens.accessToken(), tokens.refreshToken(), accessTokenMinutes * 60, mustChangePassword,
                targetDashboardUrl, userSummary, requiresSelection, choices);
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

    /**
     * Rotates the refresh token of the session it belongs to and issues a new access token for the SAME session, so
     * access tokens already handed to other requests or tabs stay valid until their own expiry. The session keeps
     * its organization binding while that membership is ACTIVE; a user who is no longer ACTIVE cannot refresh.
     * An old (already rotated) token is reuse: the whole session family is revoked and audited. Only the narrow
     * case of two tabs refreshing with the same token within {@code refresh-reuse-grace-seconds} is answered with a
     * new access token and no new refresh token (the browser already holds the rotated cookie).
     */
    @Transactional(noRollbackFor = ApiException.class)
    public TokenPair refresh(String refreshToken, String ip) {
        if (refreshToken == null || refreshToken.isBlank()) throw sessionEnded();
        String hash = hash(refreshToken);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT s.id, s.user_id, s.family_id, s.org_id, s.revoked_at, (s.expires_at <= now()) AS expired, u.status, u.email
                FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.refresh_token_hash = ? FOR UPDATE OF s
                """, hash);
        boolean graceReplay = false;
        if (rows.isEmpty()) {
            // Not the current token: an old one of a rotated session?
            List<Map<String, Object>> old = jdbc.queryForList("""
                    SELECT h.session_id, (h.rotated_at > now() - (? * interval '1 second')) AS within_grace
                    FROM session_refresh_history h WHERE h.token_hash = ?
                    """, reuseGraceSeconds, hash);
            if (old.isEmpty()) throw sessionEnded();
            UUID sessionId = (UUID) old.get(0).get("session_id");
            rows = jdbc.queryForList("""
                    SELECT s.id, s.user_id, s.family_id, s.org_id, s.revoked_at, (s.expires_at <= now()) AS expired, u.status, u.email
                    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? FOR UPDATE OF s
                    """, sessionId);
            Map<String, Object> session = rows.get(0);
            if (!Boolean.TRUE.equals(old.get(0).get("within_grace")) || session.get("revoked_at") != null) {
                revokeFamily((UUID) session.get("family_id"), "REFRESH_REUSE");
                recordAuditLog("REFRESH_TOKEN_REUSE", (UUID) session.get("user_id"), (String) session.get("email"),
                        (UUID) session.get("user_id"), "{\"session_id\":\"" + sessionId + "\"}", ip);
                throw sessionEnded();
            }
            graceReplay = true; // two tabs refreshed at the same moment
        }
        Map<String, Object> row = rows.get(0);
        UUID sessionId = (UUID) row.get("id");
        UUID userId = (UUID) row.get("user_id");
        if (row.get("revoked_at") != null || Boolean.TRUE.equals(row.get("expired"))) {
            throw sessionEnded();
        }
        if (!"ACTIVE".equals(row.get("status"))) {
            jdbc.update("UPDATE sessions SET revoked_at = now(), revoked_reason = 'USER_INACTIVE' WHERE id = ?", sessionId);
            recordAuditLog("REFRESH_DENIED", userId, (String) row.get("email"), userId, "{\"reason\":\"user_inactive\"}", ip);
            throw sessionEnded();
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
            jdbc.update("UPDATE sessions SET org_id = NULL WHERE id = ?", sessionId);
        }
        String newRefreshToken = null;
        if (!graceReplay) {
            newRefreshToken = randomToken();
            jdbc.update("INSERT INTO session_refresh_history (token_hash, session_id) VALUES (?, ?)", hash, sessionId);
            jdbc.update("""
                    UPDATE sessions SET refresh_token_hash = ?, last_refreshed_at = now(), refresh_count = refresh_count + 1,
                        expires_at = CASE WHEN ? THEN now() + (? * interval '1 day') ELSE expires_at END
                    WHERE id = ?
                    """, hash(newRefreshToken), slidingRefresh, refreshTokenDays, sessionId);
            recordAuditLog("SESSION_REFRESHED", userId, (String) user.get("email"), userId, "{\"session_id\":\"" + sessionId + "\"}", ip);
        }
        // The role claim is re-derived on every refresh (platform role, or the bound membership's template), so a
        // changed membership takes effect on the next refresh.
        String accessToken = jwtService.issueAccessToken(new AuthPrincipal(userId, sessionId, (String) user.get("email"), organizationId,
                null, tokenRole(userId, organizationId, (String) user.get("role")), null, null,
                Boolean.TRUE.equals(user.get("must_change_password")), (String) user.get("name")));
        return new TokenPair(accessToken, newRefreshToken);
    }

    /** Revokes the session of this access token (or, without one, of this refresh token) and audits it. */
    @Transactional
    public void signout(AuthPrincipal principal, String refreshToken, String ip) {
        UUID sessionId = principal != null ? principal.sessionId() : null;
        if (sessionId == null && refreshToken != null && !refreshToken.isBlank()) {
            sessionId = jdbc.query("SELECT id FROM sessions WHERE refresh_token_hash = ?",
                    rs -> rs.next() ? rs.getObject(1, UUID.class) : null, hash(refreshToken));
        }
        if (sessionId == null) return;
        Map<String, Object> s = jdbc.queryForList("SELECT s.user_id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?", sessionId)
                .stream().findFirst().orElse(null);
        jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()), revoked_reason = COALESCE(revoked_reason, 'LOGOUT') WHERE id = ?",
                sessionId);
        if (s != null) {
            recordAuditLog("LOGOUT", (UUID) s.get("user_id"), (String) s.get("email"), (UUID) s.get("user_id"),
                    "{\"session_id\":\"" + sessionId + "\"}", ip);
        }
    }

    /** Log out everywhere: revokes every open session of the signed-in user. */
    @Transactional
    public int signoutEverywhere(AuthPrincipal principal, String ip) {
        int revoked = jdbc.update("""
                UPDATE sessions SET revoked_at = now(), revoked_reason = 'LOGOUT_EVERYWHERE' WHERE user_id = ? AND revoked_at IS NULL
                """, principal.userId());
        recordAuditLog("LOGOUT_EVERYWHERE", principal.userId(), principal.email(), principal.userId(), "{\"sessions\":" + revoked + "}", ip);
        return revoked;
    }

    private void revokeFamily(UUID familyId, String reason) {
        jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()), revoked_reason = COALESCE(revoked_reason, ?) WHERE family_id = ?",
                reason, familyId);
    }

    private static ApiException sessionEnded() {
        return new ApiException(HttpStatus.UNAUTHORIZED, "SESSION_ENDED", "Your session ended. Please sign in again.");
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
        Map<String, Object> current = jdbc.queryForList("SELECT family_id, expires_at FROM sessions WHERE id = ? AND user_id = ?",
                principal.sessionId(), principal.userId()).stream().findFirst().orElse(null);
        UUID familyId = current == null ? null : (UUID) current.get("family_id");
        jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()), revoked_reason = COALESCE(revoked_reason, 'SWITCHED') WHERE id = ?",
                principal.sessionId());
        Map<String, Object> user = jdbc.queryForMap("SELECT role, name FROM users WHERE id = ?", principal.userId());
        // The switched session keeps the sign-in's absolute expiry: switching workspaces never extends the 7 days.
        Instant expiresAt = current == null ? null : ((java.sql.Timestamp) current.get("expires_at")).toInstant();
        return issueSession(principal.userId(), principal.email(), familyId == null ? UUID.randomUUID() : familyId,
                organizationId, tokenRole(principal.userId(), organizationId, (String) user.get("role")),
                (String) user.get("name"), false, expiresAt);
    }

    private boolean hasActiveMembership(UUID userId, UUID organizationId) {
        return sessionRole(userId, null, organizationId) != null;
    }

    /**
     * The signed-in identity, its ACTIVE memberships, and the session's active workspace: the organization the token
     * is bound to and that membership's role template. The landing page is computed the same way as at login.
     */
    public ExtendedMeResponse me(AuthPrincipal principal) {
        ExtendedMeResponse base = me(principal.userId());
        Map<String, Object> user = jdbc.queryForMap("SELECT role FROM users WHERE id = ?", principal.userId());
        LandingPolicy.Landing landing = LandingPolicy.resolve((String) user.get("role"),
                activeMemberships(principal.userId()), principal.organizationId());
        boolean bound = landing.kind() == LandingPolicy.Kind.WORKSPACE
                && landing.organizationId().equals(principal.organizationId());
        String target = base.mustChangePassword() ? LandingPolicy.CHANGE_PASSWORD
                : bound || landing.kind() != LandingPolicy.Kind.WORKSPACE ? landing.targetUrl() : LandingPolicy.SELECT_WORKSPACE;
        return new ExtendedMeResponse(base.id(), base.email(), base.name(), landing.role(), base.department(),
                bound ? principal.organizationId() : null, bound ? lookupOrgName(principal.organizationId()) : null,
                base.phone(), base.status(), base.mustChangePassword(), target, base.memberships(),
                landing.kind().name(), LandingPolicy.isPlatformRole((String) user.get("role")));
    }

    private ExtendedMeResponse me(UUID userId) {
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
                Boolean.TRUE.equals(mustChangePassword),
                resolveDashboardUrl(role, organizationId, mustChangePassword),
                memberships,
                null,
                false
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
        if (LandingPolicy.isPlatformRole(role)) {
            return LandingPolicy.resolve(role, List.of(), null).targetUrl();
        }
        return organizationId == null ? LandingPolicy.SELECT_WORKSPACE : LandingPolicy.dashboardFor(role, organizationId);
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
        return issueSession(userId, email, familyId, organizationId, role, name, mustChangePassword, null);
    }

    /** New session row; expiresAt null = a fresh sign-in (now + refresh-token-days), else carried over (switch). */
    private TokenPair issueSession(UUID userId, String email, UUID familyId, UUID organizationId, String role, String name,
            boolean mustChangePassword, Instant expiresAt) {
        String refreshToken = randomToken();
        UUID sessionId = UUID.randomUUID();
        // The session remembers its organization (task 1.3, T06) so refresh keeps the binding.
        if (expiresAt == null) {
            jdbc.update("INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, org_id, expires_at) "
                            + "VALUES (?, ?, ?, ?, ?, now() + (? * interval '1 day'))",
                    sessionId, userId, hash(refreshToken), familyId, organizationId, refreshTokenDays);
        } else {
            jdbc.update("INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, org_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)",
                    sessionId, userId, hash(refreshToken), familyId, organizationId, java.sql.Timestamp.from(expiresAt));
        }
        String accessToken = jwtService.issueAccessToken(new AuthPrincipal(userId, sessionId, email, organizationId,
                null, role, null, null, mustChangePassword, name));
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

    /** refreshToken is null when a refresh only renewed the access token (concurrent refresh within the grace window). */
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
            List<MembershipResponse> memberships,
            /** PLATFORM, WORKSPACE, SELECT_WORKSPACE or NO_WORKSPACE. */
            String landing,
            boolean platformAccount
    ) {}
    /** Registration result: tokens, the new organization (session is bound to it) and its Owner dashboard. */
    public record SignupResult(TokenPair tokens, UUID organizationId, String targetDashboardUrl) {}
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
    /** Login result. The refresh token only travels in the httpOnly cookie (never in the JSON body). */
    public record AuthResponse(
            String accessToken,
            @com.fasterxml.jackson.annotation.JsonIgnore String refreshToken,
            long expiresIn,
            boolean mustChangePassword,
            String targetDashboardUrl,
            UserSummary user,
            boolean requiresOrganizationSelection,
            List<OrganizationChoice> organizations
    ) {}
    public record MembershipResponse(UUID id, UUID orgId, String roleTemplate, String status,
            String name, String slug, String timezone, String workCalendar) {}
    private record RateAttempt(long startedAt, int count) {}
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
