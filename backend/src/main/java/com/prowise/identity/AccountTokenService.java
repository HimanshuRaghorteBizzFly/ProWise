package com.prowise.identity;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Single-use account tokens stored in {@code password_reset_tokens}. Only the SHA-256 hash is persisted;
 * the raw value exists only in the email that carries the link.
 *
 * <ul>
 *   <li>{@link Purpose#SETUP}: first password for a pending account, valid 72 hours. Issuing a new one
 *       supersedes every earlier unused setup token of that user.</li>
 *   <li>{@link Purpose#RESET}: password reset, valid 30 minutes.</li>
 *   <li>{@link Purpose#VERIFY}: email verification after public signup, valid 72 hours, superseded like SETUP.</li>
 * </ul>
 * A token is only ever consumed for the purposes its caller accepts, so a link of one kind cannot be
 * replayed on another endpoint.
 */
@Service
public class AccountTokenService {

    private static final SecureRandom RANDOM = new SecureRandom();

    public enum Purpose {
        SETUP(Duration.ofHours(72)),
        RESET(Duration.ofMinutes(30)),
        VERIFY(Duration.ofHours(72));

        private final Duration lifetime;

        Purpose(Duration lifetime) {
            this.lifetime = lifetime;
        }

        public Duration lifetime() {
            return lifetime;
        }
    }

    public record ConsumedToken(UUID userId, Purpose purpose) {}

    private final JdbcTemplate jdbc;

    public AccountTokenService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Stores the hash of a new token and returns the raw value for the email link only. */
    @Transactional
    public String issue(UUID userId, Purpose purpose) {
        if (purpose != Purpose.RESET) {
            jdbc.update("UPDATE password_reset_tokens SET used_at = now() "
                    + "WHERE user_id = ? AND purpose = ? AND used_at IS NULL", userId, purpose.name());
        }
        String token = randomToken();
        jdbc.update("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, purpose) "
                        + "VALUES (?, ?, ?, now() + (? * interval '1 second'), ?)",
                UUID.randomUUID(), userId, hash(token), purpose.lifetime().toSeconds(), purpose.name());
        return token;
    }

    /**
     * Marks the token used and returns its owner, in one statement so two concurrent submissions
     * cannot both succeed. Unknown, expired, superseded or already used tokens return empty.
     */
    @Transactional
    public Optional<ConsumedToken> consume(String rawToken, Purpose... accepted) {
        if (rawToken == null || rawToken.isBlank() || accepted == null || accepted.length == 0) {
            return Optional.empty();
        }
        String[] purposes = java.util.Arrays.stream(accepted).map(Purpose::name).toArray(String[]::new);
        List<ConsumedToken> rows = jdbc.query(connection -> {
                    java.sql.PreparedStatement statement = connection.prepareStatement("""
                            UPDATE password_reset_tokens SET used_at = now()
                            WHERE token_hash = ? AND purpose = ANY (?) AND used_at IS NULL AND expires_at > now()
                            RETURNING user_id, purpose
                            """);
                    statement.setString(1, hash(rawToken.trim()));
                    statement.setArray(2, connection.createArrayOf("varchar", purposes));
                    return statement;
                },
                (rs, rowNum) -> new ConsumedToken(rs.getObject("user_id", UUID.class), Purpose.valueOf(rs.getString("purpose"))));
        return rows.stream().findFirst();
    }

    public static String randomToken() {
        byte[] bytes = new byte[48];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }
}
