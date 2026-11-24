package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.IncorrectClaimException;
import io.jsonwebtoken.MissingClaimException;
import io.jsonwebtoken.security.SignatureException;

/** Access tokens: signed with the configured key, issued by Prowise, short-lived; anything else is refused. */
@Tag("NFR-06")
class JwtServiceTest {

    private static final String KEY = "unit-test-signing-key-that-is-long-enough-for-hmac-sha-256";
    private static final String OTHER_KEY = "another-signing-key-that-is-long-enough-for-hmac-sha-256!";

    private static AuthPrincipal principal() {
        return new AuthPrincipal(UUID.randomUUID(), UUID.randomUUID(), "dev@acme.test", UUID.randomUUID(), null,
                "DEVELOPER", null, null, false, "Dev");
    }

    @Test
    void roundTripKeepsIdentityRoleAndOrganization() {
        JwtService jwt = new JwtService(KEY, 15, "prowise");
        AuthPrincipal original = principal();
        AuthPrincipal parsed = jwt.parse(jwt.issueAccessToken(original));
        assertThat(parsed.userId()).isEqualTo(original.userId());
        assertThat(parsed.sessionId()).isEqualTo(original.sessionId());
        assertThat(parsed.organizationId()).isEqualTo(original.organizationId());
        assertThat(parsed.role()).isEqualTo("DEVELOPER");
    }

    @Test
    void expiredTokenIsRefused() {
        String expired = new JwtService(KEY, -1, "prowise").issueAccessToken(principal());
        assertThatThrownBy(() -> new JwtService(KEY, 15, "prowise").parse(expired)).isInstanceOf(ExpiredJwtException.class);
    }

    @Test
    void tokenFromAnotherIssuerOrWithoutIssuerIsRefused() {
        String foreign = new JwtService(KEY, 15, "someone-else").issueAccessToken(principal());
        assertThatThrownBy(() -> new JwtService(KEY, 15, "prowise").parse(foreign)).isInstanceOf(IncorrectClaimException.class);
        String unsignedIssuer = io.jsonwebtoken.Jwts.builder().subject(UUID.randomUUID().toString())
                .claim("sid", UUID.randomUUID().toString())
                .expiration(new java.util.Date(System.currentTimeMillis() + 60_000))
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(KEY.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .compact();
        assertThatThrownBy(() -> new JwtService(KEY, 15, "prowise").parse(unsignedIssuer)).isInstanceOf(MissingClaimException.class);
    }

    @Test
    void tokenSignedWithAnotherKeyOrTamperedIsRefused() {
        String other = new JwtService(OTHER_KEY, 15, "prowise").issueAccessToken(principal());
        assertThatThrownBy(() -> new JwtService(KEY, 15, "prowise").parse(other)).isInstanceOf(SignatureException.class);

        String token = new JwtService(KEY, 15, "prowise").issueAccessToken(principal());
        String[] parts = token.split("\\.");
        String forgedPayload = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(
                "{\"sub\":\"00000000-0000-0000-0000-000000000001\",\"role\":\"SUPER_ADMIN\",\"iss\":\"prowise\"}".getBytes());
        assertThatThrownBy(() -> new JwtService(KEY, 15, "prowise").parse(parts[0] + "." + forgedPayload + "." + parts[2]))
                .isInstanceOf(SignatureException.class);
    }

    @Test
    void shortKeyStopsStartup() {
        assertThatThrownBy(() -> new JwtService("too-short", 15, "prowise")).isInstanceOf(IllegalStateException.class)
                .hasMessageNotContaining("too-short"); // the key itself is never echoed
    }
}
