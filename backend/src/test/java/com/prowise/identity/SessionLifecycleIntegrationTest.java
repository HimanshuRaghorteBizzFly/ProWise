package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

/**
 * Sessions: 15-minute access token (Bearer), 7-day opaque refresh token in an httpOnly cookie only, rotated on every
 * refresh on the same session, reuse revokes the whole session family, disabled users cannot refresh, the org
 * binding survives refreshes, and the limit is absolute from sign-in.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T01")
@Tag("T06")
class SessionLifecycleIntegrationTest {

    private static final String PASSWORD = "CorrectHorseBatteryStaple!";
    private static final String COOKIE = "prowise_refresh_token";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwt;

    @BeforeEach
    @AfterEach
    void clean() {
        TestDatabase.clean(jdbc);
    }

    private record Session(String email, UUID userId, UUID orgId, String accessToken, String refreshToken) {}

    private Session signup() throws Exception {
        String email = "sess-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        String slug = "sess-" + UUID.randomUUID().toString().substring(0, 10);
        MockHttpServletResponse response = mockMvc.perform(post("/v1/auth/signup").contentType("application/json").content("""
                        {"email":"%s","password":"%s","name":"Founder",
                         "organization":{"name":"Session Co %s","slug":"%s","timezone":"UTC","calendar":{}}}
                        """.formatted(email, PASSWORD, slug, slug)))
                .andExpect(status().isCreated()).andReturn().getResponse();
        JsonNode body = objectMapper.readTree(response.getContentAsString());
        UUID userId = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = lower(?)", UUID.class, email);
        return new Session(email, userId, UUID.fromString(body.path("organization_id").asText()), body.path("access_token").asText(),
                response.getCookie(COOKIE).getValue());
    }

    private MockHttpServletResponse refresh(String refreshToken) throws Exception {
        return mockMvc.perform(post("/v1/auth/refresh").cookie(new Cookie(COOKIE, refreshToken))).andReturn().getResponse();
    }

    private String accessToken(MockHttpServletResponse response) throws Exception {
        return objectMapper.readTree(response.getContentAsString()).path("access_token").asText();
    }

    /** Moves the rotation of an old token outside the two-tabs grace window, so presenting it again is reuse. */
    private void ageRotation(String oldRefreshToken) {
        String hash = AuthService.hash(oldRefreshToken);
        UUID session = jdbc.queryForObject("SELECT session_id FROM session_refresh_history WHERE token_hash = ?", UUID.class, hash);
        jdbc.update("DELETE FROM session_refresh_history WHERE token_hash = ?", hash);
        jdbc.update("INSERT INTO session_refresh_history (token_hash, session_id, rotated_at) VALUES (?, ?, now() - interval '5 minutes')", hash, session);
    }

    private int audits(UUID userId, String action) {
        Integer n = jdbc.queryForObject("SELECT count(*) FROM auth_audit_logs WHERE target_user_id = ? AND action = ?", Integer.class, userId, action);
        return n == null ? 0 : n;
    }

    @Test
    @DisplayName("The refresh token only travels in an httpOnly, SameSite=Lax cookie limited to the auth path, for 7 days")
    void refreshTokenIsAnHttpOnlyCookieOnly() throws Exception {
        String email = "cookie-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        String slug = "cookie-" + UUID.randomUUID().toString().substring(0, 10);
        MockHttpServletResponse response = mockMvc.perform(post("/v1/auth/signup").contentType("application/json").content("""
                        {"email":"%s","password":"%s","organization":{"name":"C %s","slug":"%s","timezone":"UTC","calendar":{}}}
                        """.formatted(email, PASSWORD, slug, slug))).andExpect(status().isCreated()).andReturn().getResponse();
        assertThat(response.getContentAsString()).doesNotContain("refresh");
        String header = response.getHeaders("Set-Cookie").stream().filter(h -> h.startsWith(COOKIE + "=") && !h.startsWith(COOKIE + "=;"))
                .findFirst().orElseThrow();
        assertThat(header).contains("HttpOnly").contains("SameSite=Lax").contains("Path=/api/v1/auth").contains("Max-Age=" + Duration.ofDays(7).toSeconds())
                .contains("Secure");
        String refreshToken = response.getCookie(COOKIE).getValue();
        assertThat(refreshToken).doesNotContain("."); // opaque, not a JWT
        // Stored only as a hash.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM sessions WHERE refresh_token_hash = ?", Integer.class, refreshToken)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM sessions WHERE refresh_token_hash = ?", Integer.class, AuthService.hash(refreshToken)))
                .isEqualTo(1);
        // A refresh token in a request body is not accepted.
        mockMvc.perform(post("/v1/auth/refresh").contentType("application/json").content("{\"refresh_token\":\"" + refreshToken + "\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("SESSION_ENDED"));
    }

    @Test
    @DisplayName("After the access token expires, refresh (cookie only, as on a page reload) gives a new one bound to the same org")
    void refreshWorksAfterTheAccessTokenExpires() throws Exception {
        Session s = signup();
        AuthPrincipal principal = jwt.parse(s.accessToken());
        String expired = jwt.issueAccessToken(principal, Instant.now().minus(Duration.ofMinutes(20)));
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + expired)).andExpect(status().isUnauthorized());

        // Page reload: no access token in memory, only the cookie; the expired token may still be sent and is ignored.
        MockHttpServletResponse refreshed = mockMvc.perform(post("/v1/auth/refresh").header("Authorization", "Bearer " + expired)
                .cookie(new Cookie(COOKIE, s.refreshToken()))).andExpect(status().isOk()).andReturn().getResponse();
        String token = accessToken(refreshed);
        assertThat(jwt.parse(token).organizationId()).isEqualTo(s.orgId());
        assertThat(jwt.parse(token).sessionId()).isEqualTo(principal.sessionId()); // same session, rotated token
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk())
                .andExpect(jsonPath("$.organization_id").value(s.orgId().toString()));
        mockMvc.perform(get("/v1/me/permissions").param("org", s.orgId().toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        assertThat(audits(s.userId(), "SESSION_REFRESHED")).isEqualTo(1);
    }

    @Test
    @DisplayName("Rotation: each refresh replaces the token; earlier access tokens stay valid; reusing an old token revokes the session")
    void rotationAndReuseDetection() throws Exception {
        Session s = signup();
        MockHttpServletResponse first = refresh(s.refreshToken());
        assertThat(first.getStatus()).isEqualTo(200);
        String second = first.getCookie(COOKIE).getValue();
        assertThat(second).isNotEqualTo(s.refreshToken());
        // In-flight requests with the previous access token keep working (no logout race at the 15-minute mark).
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + s.accessToken())).andExpect(status().isOk());

        ageRotation(s.refreshToken());
        MockHttpServletResponse reuse = refresh(s.refreshToken());
        assertThat(reuse.getStatus()).isEqualTo(401);
        assertThat(reuse.getHeaders("Set-Cookie")).anySatisfy(h -> assertThat(h).startsWith(COOKIE + "=;").contains("Max-Age=0"));
        // The whole session is gone: the newest token and every access token of it.
        assertThat(refresh(second).getStatus()).isEqualTo(401);
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + accessToken(first))).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("SELECT revoked_reason FROM sessions WHERE user_id = ?", String.class, s.userId())).isEqualTo("REFRESH_REUSE");
        assertThat(audits(s.userId(), "REFRESH_TOKEN_REUSE")).isEqualTo(1);
    }

    @Test
    @DisplayName("A disabled user cannot refresh; an inactive membership drops the org binding")
    void disabledUserCannotRefresh() throws Exception {
        Session s = signup();
        jdbc.update("UPDATE users SET status = 'DISABLED' WHERE id = ?", s.userId());
        MockHttpServletResponse denied = refresh(s.refreshToken());
        assertThat(denied.getStatus()).isEqualTo(401);
        assertThat(objectMapper.readTree(denied.getContentAsString()).path("message").asText()).isEqualTo("Your session ended. Please sign in again.");
        assertThat(audits(s.userId(), "REFRESH_DENIED")).isEqualTo(1);
        jdbc.update("UPDATE users SET status = 'ACTIVE' WHERE id = ?", s.userId());
        assertThat(refresh(s.refreshToken()).getStatus()).isEqualTo(401); // that session stays revoked
    }

    @Test
    @DisplayName("The 7 days are absolute from sign-in: refreshing never extends the session; an expired session cannot refresh")
    void absoluteLifetime() throws Exception {
        Session s = signup();
        Timestamp before = jdbc.queryForObject("SELECT expires_at FROM sessions WHERE user_id = ?", Timestamp.class, s.userId());
        assertThat(Duration.between(Instant.now(), before.toInstant()).toHours()).isBetween(167L, 168L);
        String next = refresh(s.refreshToken()).getCookie(COOKIE).getValue();
        Timestamp after = jdbc.queryForObject("SELECT expires_at FROM sessions WHERE user_id = ?", Timestamp.class, s.userId());
        assertThat(after).isEqualTo(before);
        jdbc.update("UPDATE sessions SET expires_at = now() - interval '1 minute' WHERE user_id = ?", s.userId());
        assertThat(refresh(next).getStatus()).isEqualTo(401);
    }

    @Test
    @DisplayName("Logout revokes the session and clears the cookie; log out everywhere revokes every session; all audited, no tokens logged")
    void logoutAndLogoutEverywhere() throws Exception {
        Session s = signup();
        MockHttpServletResponse otherDevice = mockMvc.perform(post("/v1/auth/signin").contentType("application/json")
                .content("{\"email\":\"" + s.email() + "\",\"password\":\"" + PASSWORD + "\"}")).andExpect(status().isOk()).andReturn().getResponse();
        String otherRefresh = otherDevice.getCookie(COOKIE).getValue();

        MockHttpServletResponse out = mockMvc.perform(post("/v1/auth/logout").header("Authorization", "Bearer " + s.accessToken())
                .cookie(new Cookie(COOKIE, s.refreshToken()))).andExpect(status().isNoContent()).andReturn().getResponse();
        assertThat(out.getHeaders("Set-Cookie")).anySatisfy(h -> assertThat(h).startsWith(COOKIE + "=;").contains("Max-Age=0").contains("Path=/api/v1/auth"));
        assertThat(refresh(s.refreshToken()).getStatus()).isEqualTo(401);
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + s.accessToken())).andExpect(status().isUnauthorized());
        assertThat(refresh(otherRefresh).getStatus()).isEqualTo(200); // the other device is untouched

        // A fresh device logs out everywhere.
        MockHttpServletResponse third = mockMvc.perform(post("/v1/auth/signin").contentType("application/json")
                .content("{\"email\":\"" + s.email() + "\",\"password\":\"" + PASSWORD + "\"}")).andExpect(status().isOk()).andReturn().getResponse();
        mockMvc.perform(post("/v1/auth/signin").contentType("application/json")
                .content("{\"email\":\"" + s.email() + "\",\"password\":\"" + PASSWORD + "\"}")).andExpect(status().isOk());
        mockMvc.perform(post("/v1/auth/logout-all").header("Authorization", "Bearer " + accessToken(third))).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM sessions WHERE user_id = ? AND revoked_at IS NULL", Integer.class, s.userId())).isZero();

        assertThat(audits(s.userId(), "LOGIN")).isEqualTo(4); // signup + 3 sign-ins
        assertThat(audits(s.userId(), "LOGOUT")).isEqualTo(1);
        assertThat(audits(s.userId(), "LOGOUT_EVERYWHERE")).isEqualTo(1);
        List<String> details = jdbc.queryForList("SELECT details::text FROM auth_audit_logs WHERE target_user_id = ?", String.class, s.userId());
        assertThat(details).noneMatch(d -> d.contains(s.refreshToken()) || d.contains(s.accessToken()) || d.contains(otherRefresh));
    }
}
