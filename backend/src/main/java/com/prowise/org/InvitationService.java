package com.prowise.org;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.RoleService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.identity.AuthPrincipal;
import com.prowise.notification.EmailMessage;
import com.prowise.notification.EmailSender;

/**
 * Task 1.2 (FR-002 / T02): expiring, single-use invitations.
 *
 * <ul>
 *   <li>The token is 256 random bits; only its SHA-256 hash is stored. It is sent by email once and never
 *       returned by the API or logged.</li>
 *   <li>Resend rotates the token (the old link dies) and renews the expiry; revoke is immediate.</li>
 *   <li>Accepting needs a signed-in user whose email matches. The invitation row is locked, so two
 *       simultaneous accepts produce exactly one membership.</li>
 *   <li>An unknown, foreign, expired, revoked, used or wrong-account token gets the same 404.</li>
 * </ul>
 */
@Service
public class InvitationService {

    private static final Logger log = LoggerFactory.getLogger(InvitationService.class);
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]{1,64}@[^@\\s]+\\.[^@\\s]{2,}$");
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int DEFAULT_DAYS = 7;
    private static final int MAX_DAYS = 30;

    private static final String SELECT = """
            SELECT i.id, i.email, i.template_role_id, r.name AS role_name, i.team_id, t.name AS team_name,
                   CASE WHEN i.status = 'PENDING' AND i.expires_at <= now() THEN 'EXPIRED' ELSE i.status END AS status,
                   i.expires_at, u.email AS invited_by_email, i.created_at, i.last_sent_at, i.send_count,
                   i.accepted_at, i.revoked_at, i.version
            FROM invitations i
            JOIN roles r ON r.id = i.template_role_id
            JOIN users u ON u.id = i.invited_by
            LEFT JOIN teams t ON t.id = i.team_id AND t.org_id = i.org_id
            """;

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final RoleService roles;
    private final ChangeRecorder changes;
    private final PeopleHistory history;
    private final EmailSender emailSender;
    private final org.springframework.beans.factory.ObjectProvider<com.prowise.identity.EmailCredentialService> credentialEmails;
    private final org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    private final String frontendUrl;

    public InvitationService(JdbcTemplate jdbc, PermissionService permissions, RoleService roles,
            ChangeRecorder changes, PeopleHistory history, EmailSender emailSender,
            org.springframework.beans.factory.ObjectProvider<com.prowise.identity.EmailCredentialService> credentialEmails,
            org.springframework.security.crypto.password.PasswordEncoder passwordEncoder,
            @Value("${prowise.mail.frontend-url:http://localhost:3000}") String frontendUrl) {
        this.credentialEmails = credentialEmails;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.roles = roles;
        this.changes = changes;
        this.history = history;
        this.emailSender = emailSender;
        this.frontendUrl = frontendUrl.replaceAll("/+$", "");
    }

    /* ------------------------------------------------------------------ org side */

    public List<InvitationResponse> list(UUID organizationId, Authentication authentication, String status) {
        permissions.require(authentication, organizationId, PermissionKey.MEMBER_INVITE.value());
        String filter = status == null || status.isBlank() ? null : status.trim().toUpperCase(Locale.ROOT);
        return jdbc.query("SELECT * FROM (" + SELECT + " WHERE i.org_id = ?) x WHERE (CAST(? AS text) IS NULL OR x.status = ?)"
                + " ORDER BY x.created_at DESC LIMIT 200", (rs, n) -> row(rs), organizationId, filter, filter);
    }

    public InvitationResponse get(UUID organizationId, UUID invitationId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.MEMBER_INVITE.value());
        return find(organizationId, invitationId);
    }

    @Transactional
    public InvitationResponse create(UUID organizationId, Authentication authentication, CreateInvitationRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.MEMBER_INVITE.value());
        AuthPrincipal actor = permissions.principal(authentication);
        if (request == null) throw validation("email", "is required");
        String email = normalizeEmail(request.email());
        int days = days(request.expiresInDays());
        // Least privilege (1.3): nobody invites someone into a role holding keys they do not hold themselves.
        String roleName = roles.requireAssignableTemplate(organizationId, authentication, request.templateRoleId(),
                false, "INVITATION", null);
        UUID teamId = request.teamId();
        if (teamId != null) activeTeam(organizationId, teamId);
        Integer existing = jdbc.queryForObject("""
                SELECT count(*) FROM memberships m JOIN users u ON u.id = m.user_id
                WHERE m.org_id = ? AND lower(u.email) = ?
                """, Integer.class, organizationId, email);
        if (existing != null && existing > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_MEMBER", "This person is already a member of the workspace.");
        }
        UUID id = UUID.randomUUID();
        String token = newToken();
        try {
            jdbc.update("""
                    INSERT INTO invitations (id, org_id, email, template_role_id, team_id, token_hash, expires_at, invited_by)
                    VALUES (?, ?, ?, ?, ?, ?, now() + (? * interval '1 day'), ?)
                    """, id, organizationId, email, request.templateRoleId(), teamId, hash(token), days, actor.userId());
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "INVITATION_EXISTS",
                    "An open invitation for this email already exists. Resend or revoke it instead.");
        }
        InvitationResponse created = find(organizationId, id);
        Map<String, Object> snapshot = snapshot(created);
        changes.record(
                new ChangeRecorder.AuditEntry(organizationId, actor.userId(), "invitation.created", "INVITATION", id, null,
                        null, snapshot),
                new ChangeRecorder.DomainEvent(organizationId, "INVITATION", id, 0L, "InvitationCreated", snapshot));
        sendAfterCommit(organizationId, email, roleName, token, created.expiresAt());
        return created;
    }

    @Transactional
    public InvitationResponse resend(UUID organizationId, UUID invitationId, Authentication authentication,
            VersionRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.MEMBER_INVITE.value());
        AuthPrincipal actor = permissions.principal(authentication);
        Map<String, Object> row = lockForChange(organizationId, invitationId, request);
        String token = newToken();
        // Rotation: the old hash is replaced, so the previous link stops working immediately.
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE invitations
                SET token_hash = ?, expires_at = now() + (? * interval '1 day'), send_count = send_count + 1,
                    last_sent_at = now(), version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ? AND status = 'PENDING'
                """, hash(token), DEFAULT_DAYS, invitationId, organizationId, request.expectedVersion()));
        InvitationResponse updated = find(organizationId, invitationId);
        changes.record(
                new ChangeRecorder.AuditEntry(organizationId, actor.userId(), "invitation.resent", "INVITATION",
                        invitationId, null, Map.of("expires_at", String.valueOf(row.get("expires_at"))),
                        Map.of("expires_at", updated.expiresAt().toString(), "send_count", updated.sendCount())),
                new ChangeRecorder.DomainEvent(organizationId, "INVITATION", invitationId, updated.version(),
                        "InvitationResent", Map.of("send_count", updated.sendCount())));
        sendAfterCommit(organizationId, updated.email(), updated.roleName(), token, updated.expiresAt());
        return updated;
    }

    @Transactional
    public InvitationResponse revoke(UUID organizationId, UUID invitationId, Authentication authentication,
            VersionRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.MEMBER_INVITE.value());
        AuthPrincipal actor = permissions.principal(authentication);
        lockForChange(organizationId, invitationId, request);
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE invitations SET status = 'REVOKED', revoked_at = now(), version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ? AND status = 'PENDING'
                """, invitationId, organizationId, request.expectedVersion()));
        InvitationResponse updated = find(organizationId, invitationId);
        changes.record(
                new ChangeRecorder.AuditEntry(organizationId, actor.userId(), "invitation.revoked", "INVITATION",
                        invitationId, null, Map.of("status", "PENDING"), Map.of("status", "REVOKED")),
                new ChangeRecorder.DomainEvent(organizationId, "INVITATION", invitationId, updated.version(),
                        "InvitationRevoked", Map.of("status", "REVOKED")));
        return updated;
    }

    /* ------------------------------------------------------------------ invitee side */

    /** What the signed-in invitee is about to accept. Any invalid case is the same 404. */
    public InvitationPreview preview(Authentication authentication, TokenRequest request) {
        AuthPrincipal principal = permissions.principal(authentication);
        Map<String, Object> row = validInvitation(principal, request, false);
        return new InvitationPreview((UUID) row.get("org_id"), (String) row.get("org_name"), (String) row.get("role_name"),
                (String) row.get("team_name"), (String) row.get("inviter_email"),
                ((Timestamp) row.get("expires_at")).toInstant());
    }

    @Transactional
    public AcceptResponse accept(Authentication authentication, TokenRequest request) {
        AuthPrincipal principal = permissions.principal(authentication);
        // FOR UPDATE: a concurrent accept of the same invitation waits here, then sees ACCEPTED and gets 404.
        Map<String, Object> row = validInvitation(principal, request, true);
        UUID organizationId = (UUID) row.get("org_id");
        List<String> statuses = jdbc.queryForList(
                "SELECT status FROM memberships WHERE org_id = ? AND user_id = ?", String.class, organizationId,
                principal.userId());
        if (!statuses.isEmpty()) {
            throw "ACTIVE".equals(statuses.get(0))
                    ? new ApiException(HttpStatus.CONFLICT, "ALREADY_MEMBER", "You are already a member of this workspace.")
                    : new ApiException(HttpStatus.CONFLICT, "MEMBERSHIP_DISABLED",
                            "Your membership in this workspace is disabled. Ask an administrator to re-enable it.");
        }
        return join(row, principal.userId(), "Accepted invitation");
    }

    /** Membership + ORG grant of the invited role (+ team), invitation closed, history, audit and outbox: one transaction. */
    private AcceptResponse join(Map<String, Object> row, UUID userId, String note) {
        UUID organizationId = (UUID) row.get("org_id");
        UUID invitationId = (UUID) row.get("id");
        String roleName = (String) row.get("role_name");
        UUID membershipId = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)",
                membershipId, organizationId, userId, roleName);
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (?, ?, ?, ?, 'ORG', ?)
                """, UUID.randomUUID(), organizationId, membershipId, row.get("template_role_id"), row.get("invited_by"));
        UUID teamId = (UUID) row.get("team_id");
        if (teamId != null && "ACTIVE".equals(row.get("team_status"))) {
            jdbc.update("INSERT INTO team_members (team_id, org_id, membership_id, added_by) VALUES (?, ?, ?, ?)",
                    teamId, organizationId, membershipId, row.get("invited_by"));
        }
        jdbc.update("""
                UPDATE invitations SET status = 'ACCEPTED', accepted_by = ?, accepted_at = now(), version = version + 1,
                    updated_at = now()
                WHERE id = ? AND status = 'PENDING'
                """, userId, invitationId);
        history.membership(organizationId, membershipId, userId, "JOINED", null, "ACTIVE", null, roleName,
                userId, note);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("membership_id", membershipId.toString());
        payload.put("invitation_id", invitationId.toString());
        payload.put("role", roleName);
        changes.record(
                new ChangeRecorder.AuditEntry(organizationId, userId, "invitation.accepted", "MEMBERSHIP",
                        membershipId, null, null, payload),
                new ChangeRecorder.DomainEvent(organizationId, "MEMBERSHIP", membershipId, 0L, "MemberJoined", payload));
        return new AcceptResponse(organizationId, (String) row.get("org_name"), membershipId, roleName);
    }

    /**
     * What an invitation link is for, before signing in: the person opening the emailed link sees the organization,
     * role and invited address, and whether that address already has an account (sign in and accept) or not (choose
     * a password). Any invalid case is the same 404, so the endpoint reveals nothing without a valid link.
     */
    public PublicInvitationPreview publicPreview(TokenRequest request) {
        Map<String, Object> row = usableInvitation(request, false);
        String email = (String) row.get("email");
        Integer accounts = jdbc.queryForObject("SELECT count(*) FROM users WHERE lower(email) = lower(?)", Integer.class, email);
        return new PublicInvitationPreview((String) row.get("org_name"), (String) row.get("role_name"),
                (String) row.get("team_name"), (String) row.get("inviter_email"), email,
                ((Timestamp) row.get("expires_at")).toInstant(), accounts != null && accounts > 0);
    }

    /**
     * An Owner/Admin added someone who has no Prowise account: the single-use invitation link creates the account
     * with the password the person chooses (it proves they control the invited address), activates it and joins
     * the organization in one transaction. An address that already has an account must sign in and accept instead.
     * A weak password is refused before the link is used, so the person can try again.
     */
    @Transactional
    public AcceptResponse activate(ActivateRequest request) {
        if (request == null) throw invalid();
        String password = request.password();
        if (!com.prowise.identity.PasswordPolicy.isAcceptable(password)) {
            throw validation("password", com.prowise.identity.PasswordPolicy.SUMMARY);
        }
        Map<String, Object> row = usableInvitation(new TokenRequest(request.token()), true);
        String email = ((String) row.get("email")).toLowerCase(Locale.ROOT);
        String name = request.name() == null || request.name().isBlank() ? email.split("@")[0] : request.name().trim();
        if (name.length() > 200) name = name.substring(0, 200);
        UUID userId = UUID.randomUUID();
        int inserted = jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, ?, 'VIEWER', 'ACTIVE', false)
                ON CONFLICT (lower(email)) DO NOTHING
                """, userId, email, passwordEncoder.encode(password), name);
        if (inserted != 1) {
            throw new ApiException(HttpStatus.CONFLICT, "ACCOUNT_EXISTS",
                    "This email already has a Prowise account. Sign in with it, then open the invitation link again to accept.");
        }
        return join(row, userId, "Activated account from invitation");
    }

    private Map<String, Object> usableInvitation(TokenRequest request, boolean lock) {
        if (request == null || request.token() == null || request.token().isBlank() || request.token().length() > 200) {
            throw invalid();
        }
        List<Map<String, Object>> rows = jdbc.queryForList(INVITATION_ROW + (lock ? " FOR UPDATE OF i" : ""),
                hash(request.token().trim()));
        if (rows.isEmpty()) throw invalid();
        Map<String, Object> row = rows.get(0);
        boolean usable = "PENDING".equals(row.get("status")) && !Boolean.TRUE.equals(row.get("expired"))
                && "ACTIVE".equals(row.get("org_state"));
        if (!usable) throw invalid();
        return row;
    }

    /* ------------------------------------------------------------------ helpers */

    private static final String INVITATION_ROW = """
            SELECT i.id, i.org_id, i.email, i.status, i.expires_at, (i.expires_at <= now()) AS expired,
                   i.template_role_id, i.team_id, i.invited_by, r.name AS role_name, o.name AS org_name,
                   o.state AS org_state, t.name AS team_name, t.status AS team_status, u.email AS inviter_email
            FROM invitations i
            JOIN organizations o ON o.id = i.org_id
            JOIN roles r ON r.id = i.template_role_id
            JOIN users u ON u.id = i.invited_by
            LEFT JOIN teams t ON t.id = i.team_id AND t.org_id = i.org_id
            WHERE i.token_hash = ?
            """;

    private Map<String, Object> validInvitation(AuthPrincipal principal, TokenRequest request, boolean lock) {
        if (principal.isOperator() || request == null || request.token() == null || request.token().isBlank()
                || request.token().length() > 200) {
            throw invalid();
        }
        List<Map<String, Object>> rows = jdbc.queryForList(INVITATION_ROW + (lock ? " FOR UPDATE OF i" : ""),
                hash(request.token().trim()));
        if (rows.isEmpty()) throw invalid();
        Map<String, Object> row = rows.get(0);
        String callerEmail = jdbc.queryForObject("SELECT lower(email) FROM users WHERE id = ?", String.class,
                principal.userId());
        boolean usable = "PENDING".equals(row.get("status")) && !Boolean.TRUE.equals(row.get("expired"))
                && "ACTIVE".equals(row.get("org_state"))
                && ((String) row.get("email")).equalsIgnoreCase(callerEmail);
        if (!usable) throw invalid();
        return row;
    }

    private Map<String, Object> lockForChange(UUID organizationId, UUID invitationId, VersionRequest request) {
        if (request == null) throw validation("expected_version", "is required");
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT status, version, expires_at FROM invitations WHERE id = ? AND org_id = ? FOR UPDATE",
                invitationId, organizationId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        Map<String, Object> row = rows.get(0);
        ExpectedVersion.check(((Number) row.get("version")).longValue(), request.expectedVersion());
        if (!"PENDING".equals(row.get("status"))) {
            throw new ApiException(HttpStatus.CONFLICT, "INVITATION_CLOSED",
                    "This invitation was already accepted or revoked.");
        }
        return row;
    }

    private void activeTeam(UUID organizationId, UUID teamId) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM teams WHERE id = ? AND org_id = ? AND status = 'ACTIVE'",
                Integer.class, teamId, organizationId);
        if (count == null || count != 1) throw PermissionService.notFound();
    }

    private InvitationResponse find(UUID organizationId, UUID invitationId) {
        List<InvitationResponse> rows = jdbc.query(SELECT + " WHERE i.org_id = ? AND i.id = ?", (rs, n) -> row(rs),
                organizationId, invitationId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        return rows.get(0);
    }

    private static InvitationResponse row(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new InvitationResponse(rs.getObject("id", UUID.class), rs.getString("email"),
                rs.getObject("template_role_id", UUID.class), rs.getString("role_name"), rs.getObject("team_id", UUID.class),
                rs.getString("team_name"), rs.getString("status"), instant(rs, "expires_at"),
                rs.getString("invited_by_email"), instant(rs, "created_at"), instant(rs, "last_sent_at"),
                rs.getInt("send_count"), instant(rs, "accepted_at"), instant(rs, "revoked_at"), rs.getLong("version"));
    }

    private static Instant instant(java.sql.ResultSet rs, String column) throws java.sql.SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private static Map<String, Object> snapshot(InvitationResponse invitation) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("email", invitation.email());
        snapshot.put("role", invitation.roleName());
        snapshot.put("team_id", invitation.teamId() == null ? null : invitation.teamId().toString());
        snapshot.put("expires_at", invitation.expiresAt().toString());
        return snapshot;
    }

    /**
     * The link travels only by email, after the invitation is committed; it is never logged. It goes through the
     * account email service (SMTP from environment configuration, delivery logged with an honest status); the
     * fallback sender is used only where that service is not available.
     */
    private void sendAfterCommit(UUID organizationId, String email, String roleName, String token, Instant expiresAt) {
        String orgName = jdbc.queryForObject("SELECT name FROM organizations WHERE id = ?", String.class, organizationId);
        Integer accounts = jdbc.queryForObject("SELECT count(*) FROM users WHERE lower(email) = lower(?)", Integer.class, email);
        boolean accountExists = accounts != null && accounts > 0;
        String link = frontendUrl + "/invitations/accept#token=" + token;
        Runnable send = () -> {
            try {
                com.prowise.identity.EmailCredentialService service = credentialEmails.getIfAvailable();
                if (service != null && service.isConfigured()) {
                    service.sendOrganizationInvitationEmail(email, orgName, roleLabel(roleName), link, expiresAt, accountExists);
                } else {
                    emailSender.send(new EmailMessage(email, "You're invited to join " + orgName + " on Prowise",
                            "You have been invited to join " + orgName + " as " + roleLabel(roleName) + ".\n\n"
                                    + "Open this single-use link to " + (accountExists ? "accept" : "create your account") + ":\n"
                                    + link + "\n\nIt expires on " + expiresAt + " (UTC). If you did not expect it, ignore this email."));
                }
            } catch (RuntimeException exception) {
                log.warn("Invitation email could not be sent ({})", exception.getClass().getSimpleName());
            }
        };
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    send.run();
                }
            });
        } else {
            send.run();
        }
    }

    private static String roleLabel(String roleName) {
        String words = roleName.replace('_', ' ').toLowerCase(Locale.ROOT);
        return Character.toUpperCase(words.charAt(0)) + words.substring(1);
    }

    private static int days(Integer requested) {
        if (requested == null) return DEFAULT_DAYS;
        if (requested < 1 || requested > MAX_DAYS) throw validation("expires_in_days", "must be between 1 and 30");
        return requested;
    }

    private static String normalizeEmail(String email) {
        String value = email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
        if (value.length() > 320 || !EMAIL.matcher(value).matches()) throw validation("email", "must be a valid email address");
        return value;
    }

    static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static ApiException invalid() {
        return new ApiException(HttpStatus.NOT_FOUND, "INVITATION_INVALID",
                "This invitation link is invalid, expired, already used, or meant for a different account.");
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    public record CreateInvitationRequest(String email, UUID templateRoleId, UUID teamId, Integer expiresInDays) {}

    public record VersionRequest(long expectedVersion) {}

    public record TokenRequest(String token) {}

    public record InvitationResponse(UUID id, String email, UUID templateRoleId, String roleName, UUID teamId,
            String teamName, String status, Instant expiresAt, String invitedByEmail, Instant createdAt,
            Instant lastSentAt, int sendCount, Instant acceptedAt, Instant revokedAt, long version) {}

    public record InvitationPreview(UUID organizationId, String organizationName, String roleName, String teamName,
            String invitedByEmail, Instant expiresAt) {}

    public record ActivateRequest(String token, String password, String name) {}

    public record PublicInvitationPreview(String organizationName, String roleName, String teamName, String invitedByEmail,
            String email, Instant expiresAt, boolean accountExists) {}

    public record AcceptResponse(UUID organizationId, String organizationName, UUID membershipId, String roleTemplate) {}
}
