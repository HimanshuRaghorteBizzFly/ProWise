package com.prowise.identity;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.notification.EmailMessage;
import com.prowise.notification.EmailSender;

@Service
@Profile("!test")
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int MAX_ATTEMPTS_PER_WINDOW = 10;
    private static final long RATE_WINDOW_MILLIS = 60_000L;
    private static final Map<String, RateAttempt> RATE_ATTEMPTS = new ConcurrentHashMap<>();

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final EmailSender emailSender;
    private final long refreshTokenDays;

    public AuthService(
            JdbcTemplate jdbc,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            EmailSender emailSender,
            @Value("${prowise.auth.refresh-token-days:30}") long refreshTokenDays) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.emailSender = emailSender;
        this.refreshTokenDays = refreshTokenDays;
    }

    @Transactional
    public TokenPair signup(String email, String password) {
        validateCredentials(email, password);
        UUID userId = UUID.randomUUID();
        try {
            jdbc.update("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)",
                    userId, normalize(email), passwordEncoder.encode(password));
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_IN_USE", "An account already exists for this email.");
        }
        return issueSession(userId, normalize(email));
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
        return issueSession((UUID) user.get("id"), (String) user.get("email"));
    }

    @Transactional(noRollbackFor = ApiException.class)
    public TokenPair refresh(String refreshToken) {
        String hash = hash(refreshToken);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, user_id, family_id, revoked_at, (expires_at <= now()) AS expired "
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
        String email = jdbc.queryForObject("SELECT email FROM users WHERE id = ?", String.class, userId);
        return issueSession(userId, email, familyId);
    }

    @Transactional
    public void signout(AuthPrincipal principal) {
        jdbc.update("UPDATE sessions SET revoked_at = COALESCE(revoked_at, now()) WHERE id = ?",
                principal.sessionId());
    }

    @Transactional(readOnly = true)
    public TokenPair switchOrganization(AuthPrincipal principal, UUID organizationId) {
        Integer membership = jdbc.queryForObject("""
                SELECT count(*) FROM memberships
                WHERE org_id = ? AND user_id = ? AND status = 'ACTIVE'
                """, Integer.class, organizationId, principal.userId());
        if (membership == null || membership != 1) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "The requested resource was not found.");
        }
        return issueSession(principal.userId(), principal.email(), UUID.randomUUID(), organizationId);
    }

    public MeResponse me(UUID userId) {
        Map<String, Object> user = jdbc.queryForMap("SELECT id, email FROM users WHERE id = ?", userId);
        List<MembershipResponse> memberships = jdbc.query(
                "SELECT m.id, m.org_id, m.role_template, m.status, o.name, o.slug, o.timezone, o.work_calendar "
                        + "FROM memberships m JOIN organizations o ON o.id = m.org_id "
                        + "WHERE m.user_id = ? AND m.status = 'ACTIVE' ORDER BY o.slug",
                (rs, rowNum) -> new MembershipResponse(
                        rs.getObject("id", UUID.class), rs.getObject("org_id", UUID.class),
                        rs.getString("role_template"), rs.getString("status"), rs.getString("name"),
                        rs.getString("slug"), rs.getString("timezone"), rs.getString("work_calendar")),
                userId);
        return new MeResponse((UUID) user.get("id"), (String) user.get("email"), memberships);
    }

    @Transactional
    public void requestPasswordReset(String email) {
        enforceRateLimit("password-reset:" + normalizeForRateLimit(email));
        List<UUID> users = jdbc.query("SELECT id FROM users WHERE lower(email) = lower(?)",
                (rs, rowNum) -> rs.getObject("id", UUID.class), email);
        if (!users.isEmpty()) {
            String token = randomToken();
            jdbc.update("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) "
                            + "VALUES (?, ?, ?, now() + interval '30 minutes')",
                    UUID.randomUUID(), users.get(0), hash(token));
            emailSender.send(new EmailMessage(email, "ProWise password reset",
                    "Use this password reset token within 30 minutes: " + token));
        }
    }

    @Transactional
    public void confirmPasswordReset(String token, String password) {
        validatePassword(password);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? "
                        + "AND used_at IS NULL AND expires_at > now()", hash(token));
        if (rows.isEmpty()) {
            throw invalidCredentials();
        }
        jdbc.update("UPDATE users SET password_hash = ?, version = version + 1, updated_at = now() WHERE id = ?",
                passwordEncoder.encode(password), rows.get(0).get("user_id"));
        jdbc.update("UPDATE password_reset_tokens SET used_at = now() WHERE id = ?", rows.get(0).get("id"));
    }

    private TokenPair issueSession(UUID userId, String email) {
        return issueSession(userId, email, UUID.randomUUID());
    }

    private TokenPair issueSession(UUID userId, String email, UUID familyId) {
        return issueSession(userId, email, familyId, null);
    }

    private TokenPair issueSession(UUID userId, String email, UUID familyId, UUID organizationId) {
        String refreshToken = randomToken();
        UUID sessionId = UUID.randomUUID();
        jdbc.update("INSERT INTO sessions (id, user_id, refresh_token_hash, family_id, expires_at) "
                        + "VALUES (?, ?, ?, ?, now() + (? * interval '1 day'))",
                sessionId, userId, hash(refreshToken), familyId, refreshTokenDays);
        String accessToken = jwtService.issueAccessToken(new AuthPrincipal(userId, sessionId, email, organizationId));
        return new TokenPair(accessToken, refreshToken);
    }

    private static ApiException invalidCredentials() {
        return new ApiException(HttpStatus.UNAUTHORIZED, ErrorCodes.INVALID_CREDENTIALS,
                "The credentials are invalid.");
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
        long now = System.currentTimeMillis();
        RateAttempt attempt = RATE_ATTEMPTS.compute(key, (ignored, current) -> {
            if (current == null || now - current.startedAt() >= RATE_WINDOW_MILLIS) {
                return new RateAttempt(now, 1);
            }
            return new RateAttempt(current.startedAt(), current.count() + 1);
        });
        if (attempt.count() > MAX_ATTEMPTS_PER_WINDOW) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, ErrorCodes.RATE_LIMITED,
                    "Too many attempts. Try again later.");
        }
    }

    private static String randomToken() {
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    public record TokenPair(String accessToken, String refreshToken) {}
    public record MeResponse(UUID id, String email, List<MembershipResponse> memberships) {}
    public record MembershipResponse(UUID id, UUID orgId, String roleTemplate, String status,
            String name, String slug, String timezone, String workCalendar) {}
    private record RateAttempt(long startedAt, int count) {}
}
