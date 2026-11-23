package com.prowise.identity;

import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

    private final SecretKey key;
    private final Duration accessTokenLifetime;
    private final String issuer;

    /**
     * HMAC-signed access tokens. The key and issuer come only from configuration (JWT_SIGNING_KEY, JWT_ISSUER in
     * the environment or backend/.env); parsing verifies the signature, the expiry and the issuer, and the key is
     * never logged or echoed in errors.
     */
    @org.springframework.beans.factory.annotation.Autowired
    public JwtService(
            @Value("${prowise.auth.jwt-signing-key}") String signingKey,
            @Value("${prowise.auth.access-token-minutes:15}") long accessTokenMinutes,
            @Value("${prowise.auth.jwt-issuer:prowise}") String issuer) {
        if (signingKey == null || signingKey.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SIGNING_KEY must contain at least 32 bytes.");
        }
        this.key = Keys.hmacShaKeyFor(signingKey.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        this.accessTokenLifetime = Duration.ofMinutes(accessTokenMinutes);
        if (issuer == null || issuer.isBlank()) {
            throw new IllegalStateException("JWT_ISSUER must not be blank.");
        }
        this.issuer = issuer.trim();
    }

    /** Default issuer; for unit tests that build the service directly. */
    public JwtService(String signingKey, long accessTokenMinutes) {
        this(signingKey, accessTokenMinutes, "prowise");
    }

    public String issueAccessToken(AuthPrincipal principal) {
        Instant now = Instant.now();
        var builder = Jwts.builder()
                .issuer(issuer)
                .subject(principal.userId().toString())
                .claim("sid", principal.sessionId().toString())
                .claim("email", principal.email())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTokenLifetime)));
        if (principal.role() != null) {
            builder.claim("role", principal.role());
        }
        if (principal.name() != null) {
            builder.claim("name", principal.name());
        }
        if (principal.mustChangePassword()) {
            builder.claim("mustChangePassword", true);
        }
        if (principal.isOperator()) {
            builder.claim("type", "OPERATOR");
            builder.claim("opid", principal.operatorId());
            if (principal.departmentId() != null) builder.claim("dept", principal.departmentId());
            if (principal.accessLevel() != null) builder.claim("accessLevel", principal.accessLevel());
        }
        if (principal.organizationId() != null) {
            builder.claim("org", principal.organizationId().toString());
        }
        return builder.signWith(key).compact();
    }

    public AuthPrincipal parse(String token) {
        Claims claims = Jwts.parser().verifyWith(key).requireIssuer(issuer).build().parseSignedClaims(token).getPayload();
        String type = claims.get("type", String.class);
        if ("OPERATOR".equalsIgnoreCase(type)) {
            String opid = claims.get("opid", String.class);
            String role = claims.get("role", String.class);
            String dept = claims.get("dept", String.class);
            String accessLevel = claims.get("accessLevel", String.class);
            String sub = claims.getSubject();
            UUID parsedUserId = null;
            if (sub != null && !sub.isBlank()) {
                try {
                    parsedUserId = UUID.fromString(sub);
                } catch (IllegalArgumentException ignored) {
                    parsedUserId = null;
                }
            }
            if (parsedUserId == null) {
                parsedUserId = UUID.nameUUIDFromBytes(("operator:" + opid).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            }
            return new AuthPrincipal(
                    parsedUserId,
                    UUID.fromString(claims.get("sid", String.class)),
                    claims.get("email", String.class),
                    null,
                    opid,
                    role,
                    dept,
                    accessLevel != null ? accessLevel : "DEPARTMENT_OPERATOR",
                    false,
                    claims.get("name", String.class)
            );
        }
        String organization = claims.get("org", String.class);
        String role = claims.get("role", String.class);
        String name = claims.get("name", String.class);
        Boolean mustChangePassword = claims.get("mustChangePassword", Boolean.class);

        return new AuthPrincipal(
                UUID.fromString(claims.getSubject()),
                UUID.fromString(claims.get("sid", String.class)),
                claims.get("email", String.class),
                organization == null ? null : UUID.fromString(organization),
                null,
                role,
                null,
                null,
                Boolean.TRUE.equals(mustChangePassword),
                name
        );
    }
}
