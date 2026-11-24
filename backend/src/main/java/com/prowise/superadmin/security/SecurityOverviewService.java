package com.prowise.superadmin.security;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import com.fasterxml.jackson.annotation.JsonProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.identity.PublishedSeedCredentials;

/**
 * GET /v1/admin/security/overview: live security posture counted from stored rows (users, sessions,
 * operator_sessions, platform_operators, user_login_history, operator_login_history). Emails are masked and no
 * password hash, token or secret ever leaves this service.
 */
@Service
@Transactional(readOnly = true)
public class SecurityOverviewService {

    static final int RECENT_FAILED_LIMIT = 20;

    private final JdbcTemplate jdbc;

    public SecurityOverviewService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record FailedLogin(String emailMasked, String ipAddress, Instant at, String reason, String source) {}

    public record SecurityOverview(
            @JsonProperty("failed_logins_24h") long failedLogins24h,
            @JsonProperty("failed_logins_7d") long failedLogins7d,
            long lockedAccounts,
            long usersMustChangePassword,
            long activeUserSessions,
            long activeOperatorSessions,
            long superAdminCount,
            long operatorsLocked,
            List<FailedLogin> recentFailedLogins,
            long publishedSeedCredentialAccounts
    ) {}

    public SecurityOverview overview() {
        return new SecurityOverview(
                failedSince("24 hours"),
                failedSince("7 days"),
                count("SELECT count(*) FROM users WHERE locked_until > now()"),
                count("SELECT count(*) FROM users WHERE must_change_password"),
                count("SELECT count(*) FROM sessions WHERE revoked_at IS NULL AND expires_at > now()"),
                count("SELECT count(*) FROM operator_sessions WHERE NOT revoked AND expires_at > now()"),
                count("""
                        SELECT count(*) FROM users u WHERE u.status = 'ACTIVE'
                          AND (upper(u.role) = 'SUPER_ADMIN'
                               OR EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND upper(r.role_name) = 'SUPER_ADMIN'))
                        """),
                count("SELECT count(*) FROM platform_operators WHERE locked_until > now()"),
                recentFailedLogins(),
                publishedSeedCredentialAccounts());
    }

    /** interval is one of two constants above, never client input. */
    private long failedSince(String interval) {
        return count("SELECT (SELECT count(*) FROM user_login_history WHERE status LIKE 'FAILED%' AND created_at > now() - interval '"
                + interval + "') + (SELECT count(*) FROM operator_login_history WHERE status LIKE 'FAILED%' AND occurred_at > now() - interval '"
                + interval + "')");
    }

    private List<FailedLogin> recentFailedLogins() {
        return jdbc.query("""
                SELECT email, ip_address, at, reason, source FROM (
                    SELECT email, ip_address, created_at AS at, failure_reason AS reason, 'USER' AS source
                    FROM user_login_history WHERE status LIKE 'FAILED%'
                    UNION ALL
                    SELECT email, ip_address, occurred_at, COALESCE(failure_reason, status), 'OPERATOR'
                    FROM operator_login_history WHERE status LIKE 'FAILED%'
                ) failed ORDER BY at DESC LIMIT ?
                """, (rs, i) -> new FailedLogin(
                        maskEmail(rs.getString("email")),
                        rs.getString("ip_address"),
                        rs.getTimestamp("at").toInstant(),
                        rs.getString("reason"),
                        rs.getString("source")),
                RECENT_FAILED_LIMIT);
    }

    /**
     * Accounts still signing in with a password published in this repository (deny list in PublishedSeedCredentials).
     * Only seeded addresses are checked, so this costs at most a few BCrypt comparisons per seeded account present.
     */
    private long publishedSeedCredentialAccounts() {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT lower(email) AS email, password_hash FROM users WHERE lower(email) = ANY (?)",
                (Object) PublishedSeedCredentials.USER_ACCOUNTS.keySet().toArray(String[]::new));
        return rows.stream()
                .filter(row -> PublishedSeedCredentials.matchesPublishedPassword((String) row.get("email"), (String) row.get("password_hash")))
                .count();
    }

    private long count(String sql) {
        Long value = jdbc.queryForObject(sql, Long.class);
        return value == null ? 0L : value;
    }

    /** "hi***@gmail.com": first two characters of the local part (one if it is that short), then ***. */
    static String maskEmail(String email) {
        if (email == null || email.isBlank()) {
            return "***";
        }
        String value = email.trim().toLowerCase(Locale.ROOT);
        int at = value.indexOf('@');
        if (at <= 0) {
            return "***";
        }
        String local = value.substring(0, at);
        String visible = local.length() > 2 ? local.substring(0, 2) : local.substring(0, 1);
        return visible + "***" + value.substring(at);
    }
}
