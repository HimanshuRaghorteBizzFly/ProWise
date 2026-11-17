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

    public JwtService(
            @Value("${prowise.auth.jwt-signing-key}") String signingKey,
            @Value("${prowise.auth.access-token-minutes:15}") long accessTokenMinutes) {
        if (signingKey == null || signingKey.getBytes(java.nio.charset.StandardCharsets.UTF_8).length < 32) {
            throw new IllegalStateException("JWT_SIGNING_KEY must contain at least 32 bytes.");
        }
        this.key = Keys.hmacShaKeyFor(signingKey.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        this.accessTokenLifetime = Duration.ofMinutes(accessTokenMinutes);
    }

    public String issueAccessToken(AuthPrincipal principal) {
        Instant now = Instant.now();
        var builder = Jwts.builder()
                .subject(principal.userId().toString())
                .claim("sid", principal.sessionId().toString())
                .claim("email", principal.email())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(accessTokenLifetime)));
        if (principal.organizationId() != null) {
            builder.claim("org", principal.organizationId().toString());
        }
        return builder.signWith(key).compact();
    }

    public AuthPrincipal parse(String token) {
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        String organization = claims.get("org", String.class);
        return new AuthPrincipal(
                UUID.fromString(claims.getSubject()),
                UUID.fromString(claims.get("sid", String.class)),
                claims.get("email", String.class),
                organization == null ? null : UUID.fromString(organization));
    }
}
