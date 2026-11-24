package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.ResultActions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

/**
 * Phase 1 auth hardening: forced password change enforced by the server, one lockout for every sign-in path,
 * atomic refresh rotation, refresh tokens only in HttpOnly cookies, no trust in client-sent IP headers,
 * audience-bound access tokens, per-IP throttling and Origin checks for cookie-authenticated writes.
 */
@SpringBootTest(properties = {
        "prowise.auth.ip-rate-limit-per-minute=8",
        "prowise.cors.allowed-origins=http://localhost:3000"
})
@AutoConfigureMockMvc
@Tag("NFR-06")
class AuthHardeningIntegrationTest {

    private static final String PASSWORD = "Hardening-Pass-01!";
    private static final String NEW_PASSWORD = "Hardening-Pass-02!";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;
    @Autowired private RequestThrottle throttle;
    @Value("${prowise.auth.jwt-signing-key}") private String signingKey;
    @Value("${prowise.auth.jwt-issuer:prowise}") private String issuer;

    private String email;
    private int ipCounter;

    @BeforeEach
    void setUp() {
        jdbc.update("DELETE FROM user_login_history");
        jdbc.update("DELETE FROM user_roles");
        TestDatabase.clean(jdbc);
        email = "hardening." + UUID.randomUUID().toString().substring(0, 8) + "@prowise.test";
        throttle.clear();
    }

    // ---- 1. Forced password change is enforced by the server, not only by the client redirect.

    @Test
    void aSessionThatMustChangeItsPasswordCanOnlyReachThePasswordChangeAndIdentityEndpoints() throws Exception {
        superAdmin(email, true);
        String token = accessToken(login(email, PASSWORD).andExpect(status().isOk()));

        mockMvc.perform(get("/v1/admin/smtp").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"))
                .andExpect(jsonPath("$.request_id").isNotEmpty());
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + token)).andExpect(status().isOk());

        MvcResult changed = mockMvc.perform(post("/v1/auth/change-password").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("current_password", PASSWORD, "new_password", NEW_PASSWORD))))
                .andExpect(status().isOk()).andReturn();
        String fresh = objectMapper.readTree(changed.getResponse().getContentAsString()).path("access_token").asText();

        mockMvc.perform(get("/v1/admin/smtp").header("Authorization", "Bearer " + fresh)).andExpect(status().isOk());
    }

    @Test
    void theRequirementIsReadFromTheAccountSoATokenIssuedBeforeItWasSetIsAlsoBlocked() throws Exception {
        UUID id = superAdmin(email, false);
        String token = accessToken(login(email, PASSWORD).andExpect(status().isOk()));
        jdbc.update("UPDATE users SET must_change_password = true WHERE id = ?", id);

        mockMvc.perform(get("/v1/admin/smtp").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("PASSWORD_CHANGE_REQUIRED"));
    }

    // ---- 2. The legacy /auth/signin path shares the lockout of /auth/login.

    @Test
    void legacySigninCannotBypassTheAccountLockout() throws Exception {
        superAdmin(email, false);
        for (int i = 0; i < 5; i++) {
            signin(email, "Wrong-Password-99!").andExpect(status().isUnauthorized());
        }
        signin(email, PASSWORD).andExpect(status().isLocked()).andExpect(jsonPath("$.code").value("ACCOUNT_LOCKED"));
        login(email, PASSWORD).andExpect(status().isLocked());
    }

    // ---- 3. Refresh rotation is atomic: one refresh token yields one new session, never two.

    @Test
    void concurrentRefreshesWithTheSameTokenProduceExactlyOneNewSession() throws Exception {
        superAdmin(email, false);
        String refresh = refreshCookie(login(email, PASSWORD).andExpect(status().isOk()));

        int threads = 6;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch start = new CountDownLatch(1);
        List<Future<Integer>> results = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                Callable<Integer> task = () -> {
                    start.await();
                    return mockMvc.perform(post("/v1/auth/refresh").cookie(new Cookie("prowise_refresh_token", refresh)))
                            .andReturn().getResponse().getStatus();
                };
                results.add(pool.submit(task));
            }
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> f : results) statuses.add(f.get());
            assertThat(statuses.stream().filter(s -> s == 200).count()).isLessThanOrEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    // ---- 4. Refresh tokens live only in HttpOnly cookies; no response body exposes them to JavaScript.

    @Test
    void loginRefreshAndPasswordChangeNeverPutTheRefreshTokenInTheBody() throws Exception {
        superAdmin(email, false);
        MvcResult login = login(email, PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refresh_token").doesNotExist())
                .andExpect(jsonPath("$.access_token").isNotEmpty())
                .andReturn();
        Cookie refreshCookie = login.getResponse().getCookie("prowise_refresh_token");
        assertThat(refreshCookie).isNotNull();
        assertThat(refreshCookie.isHttpOnly()).isTrue();

        mockMvc.perform(post("/v1/auth/refresh").cookie(refreshCookie))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refresh_token").doesNotExist());

        String token = accessToken(login(email, PASSWORD));
        mockMvc.perform(post("/v1/auth/change-password").header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json(Map.of("current_password", PASSWORD, "new_password", NEW_PASSWORD))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.refresh_token").doesNotExist())
                .andExpect(jsonPath("$.access_token").isNotEmpty());
    }

    // ---- 5. A client cannot choose the IP address recorded for it.

    @Test
    void aSpoofedForwardedForHeaderIsNotRecordedAsTheClientAddress() throws Exception {
        superAdmin(email, false);
        mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .header("X-Forwarded-For", "203.0.113.77")
                        .with(request -> { request.setRemoteAddr("198.51.100.5"); return request; })
                        .content(json(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk());

        List<String> ips = jdbc.queryForList(
                "SELECT ip_address FROM user_login_history WHERE lower(email) = lower(?)", String.class, email);
        assertThat(ips).isNotEmpty().allMatch(ip -> !ip.contains("203.0.113.77"));
    }

    // ---- 6. Access tokens are bound to this API's audience and type.

    @Test
    void issuedAccessTokensCarryTheApiAudience() throws Exception {
        superAdmin(email, false);
        String token = accessToken(login(email, PASSWORD).andExpect(status().isOk()));
        var claims = Jwts.parser().verifyWith(Keys.hmacShaKeyFor(signingKey.getBytes(StandardCharsets.UTF_8)))
                .build().parseSignedClaims(token).getPayload();
        assertThat(claims.getAudience()).contains(JwtService.AUDIENCE);
        assertThat(claims.get("typ", String.class)).isEqualTo("access");
    }

    @Test
    void aCorrectlySignedTokenWithoutTheAudienceOrTypeIsRejected() {
        var key = Keys.hmacShaKeyFor(signingKey.getBytes(StandardCharsets.UTF_8));
        String noAudience = Jwts.builder().issuer(issuer).subject(UUID.randomUUID().toString())
                .claim("sid", UUID.randomUUID().toString()).claim("typ", "access")
                .expiration(Date.from(Instant.now().plusSeconds(300))).signWith(key).compact();
        String wrongType = Jwts.builder().issuer(issuer).audience().add(JwtService.AUDIENCE).and()
                .subject(UUID.randomUUID().toString()).claim("sid", UUID.randomUUID().toString()).claim("typ", "refresh")
                .expiration(Date.from(Instant.now().plusSeconds(300))).signWith(key).compact();

        assertThatThrownBy(() -> jwtService.parse(noAudience)).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> jwtService.parse(wrongType)).isInstanceOf(RuntimeException.class);
    }

    // ---- 7. Per-IP throttling stops spraying many accounts from one address.

    @Test
    void oneAddressIsThrottledAcrossManyDifferentAccounts() throws Exception {
        String ip = "198.51.100." + (++ipCounter + 100);
        int limited = 0;
        for (int i = 0; i < 12; i++) {
            int code = mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                            .with(request -> { request.setRemoteAddr(ip); return request; })
                            .content(json(Map.of("email", "spray" + i + "@prowise.test", "password", PASSWORD))))
                    .andReturn().getResponse().getStatus();
            if (code == 429) limited++;
        }
        assertThat(limited).isGreaterThan(0);
    }

    @Test
    void forgotPasswordIsThrottledPerAddress() throws Exception {
        String ip = "198.51.100." + (++ipCounter + 150);
        int limited = 0;
        for (int i = 0; i < 12; i++) {
            int code = mockMvc.perform(post("/v1/auth/forgot-password").contentType(MediaType.APPLICATION_JSON)
                            .with(request -> { request.setRemoteAddr(ip); return request; })
                            .content(json(Map.of("email", "reset" + i + "@prowise.test"))))
                    .andReturn().getResponse().getStatus();
            if (code == 429) limited++;
        }
        assertThat(limited).isGreaterThan(0);
    }

    // ---- 8. Cookie-authenticated writes from a foreign Origin are refused (CSRF defence in depth).

    @Test
    void aCookieAuthenticatedWriteFromAForeignOriginIsRejected() throws Exception {
        superAdmin(email, false);
        MvcResult login = login(email, PASSWORD).andExpect(status().isOk()).andReturn();
        Cookie access = login.getResponse().getCookie("prowise_access_token");

        mockMvc.perform(post("/v1/auth/logout").cookie(access).header("Origin", "https://evil.example"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_REJECTED"));
        // Same call from the application's own origin works.
        mockMvc.perform(post("/v1/auth/logout").cookie(access).header("Origin", "http://localhost:3000"))
                .andExpect(status().isNoContent());
    }

    @Test
    void aCookieWriteWithoutAnOriginHeaderFromANonBrowserClientIsAllowed() throws Exception {
        // Browsers always send Origin on cross-site writes; server-to-server clients and the Next.js rewrite proxy
        // may not. Those are not CSRF vectors, so they pass (SameSite=Lax still applies in browsers).
        superAdmin(email, false);
        Cookie access = login(email, PASSWORD).andExpect(status().isOk()).andReturn()
                .getResponse().getCookie("prowise_access_token");
        mockMvc.perform(post("/v1/auth/logout").cookie(access)).andExpect(status().isNoContent());
    }

    @Test
    void refreshWithTheRefreshCookieFromAForeignOriginIsRejected() throws Exception {
        superAdmin(email, false);
        String refresh = refreshCookie(login(email, PASSWORD).andExpect(status().isOk()));
        mockMvc.perform(post("/v1/auth/refresh").cookie(new Cookie("prowise_refresh_token", refresh))
                        .header("Origin", "https://evil.example"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_REJECTED"));
    }

    // ---------------------------------------------------------------- helpers

    private UUID superAdmin(String address, boolean mustChange) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, 'Hardening Admin', 'SUPER_ADMIN', 'ACTIVE', ?)
                """, id, address, passwordEncoder.encode(PASSWORD), mustChange);
        jdbc.update("INSERT INTO user_roles (user_id, role_name) VALUES (?, 'SUPER_ADMIN')", id);
        return id;
    }

    private ResultActions login(String address, String password) throws Exception {
        String ip = "192.0.2." + (++ipCounter % 250 + 1);
        return mockMvc.perform(post("/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .with(request -> { request.setRemoteAddr(ip); return request; })
                .content(json(Map.of("email", address, "password", password))));
    }

    private ResultActions signin(String address, String password) throws Exception {
        return mockMvc.perform(post("/v1/auth/signin").contentType(MediaType.APPLICATION_JSON)
                .content(json(Map.of("email", address, "password", password))));
    }

    private String accessToken(ResultActions actions) throws Exception {
        JsonNode body = objectMapper.readTree(actions.andReturn().getResponse().getContentAsString());
        return body.path("access_token").asText();
    }

    private String refreshCookie(ResultActions actions) throws Exception {
        Cookie cookie = actions.andReturn().getResponse().getCookie("prowise_refresh_token");
        assertThat(cookie).isNotNull();
        return cookie.getValue();
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }
}
