package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.UUID;

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

import jakarta.servlet.http.Cookie;

/**
 * A stale access token (expired, or its session revoked by a workspace switch or sign-out) left in the
 * Authorization header must never lock the user out: sign-in, refresh and sign-out ignore it. A refresh itself does
 * not make the session's access tokens stale (the refresh token rotates on the same session).
 * Every other route still answers 401 for it (task 1.3 rules unchanged).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T01")
@Tag("T06")
class StaleSessionIntegrationTest {

    private static final String PASSWORD = "CorrectHorseBatteryStaple!";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;

    @BeforeEach
    @AfterEach
    void clean() {
        TestDatabase.clean(jdbc);
    }

    private record Registered(String email, UUID orgId, String accessToken, String refreshToken) {}

    private Registered register() throws Exception {
        String email = "stale-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        String slug = "stale-" + UUID.randomUUID().toString().substring(0, 10);
        MockHttpServletResponse response = mockMvc.perform(post("/v1/auth/signup").contentType("application/json").content("""
                        {"email":"%s","password":"%s","name":"Founder",
                         "organization":{"name":"Stale Co %s","slug":"%s","timezone":"UTC","calendar":{}}}
                        """.formatted(email, PASSWORD, slug, slug)))
                .andExpect(status().isCreated()).andReturn().getResponse();
        JsonNode body = objectMapper.readTree(response.getContentAsString());
        return new Registered(email, UUID.fromString(body.path("organization_id").asText()),
                body.path("access_token").asText(), response.getCookie("prowise_refresh_token").getValue());
    }

    /** Switches to the same workspace: the old session (and its access token) becomes stale; returns the new refresh cookie. */
    private String staleBySwitch(Registered user) throws Exception {
        return mockMvc.perform(post("/v1/me/organizations/{org}/switch", user.orgId()).header("Authorization", "Bearer " + user.accessToken()))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("prowise_refresh_token").getValue();
    }

    @Test
    @DisplayName("Right after registration /v1/me and /v1/me/permissions answer 200 with the Owner's real permissions")
    void firstRequestsAfterRegistrationSucceed() throws Exception {
        Registered user = register();
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + user.accessToken())).andExpect(status().isOk());
        String permissions = mockMvc.perform(get("/v1/me/permissions").param("org", user.orgId().toString())
                        .header("Authorization", "Bearer " + user.accessToken()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(permissions).contains("org.manage");
        // The access token is never a cookie: a reload refreshes from the refresh cookie and sends Bearer again.
        mockMvc.perform(get("/v1/me").cookie(new Cookie("prowise_access_token", user.accessToken()))).andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Refresh works while a stale access token is still sent as Bearer or as the cookie")
    void refreshIgnoresAStaleAccessToken() throws Exception {
        Registered user = register();
        String freshRefresh = staleBySwitch(user);
        String stale = user.accessToken();

        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + stale)).andExpect(status().isUnauthorized());

        String next = mockMvc.perform(post("/v1/auth/refresh").header("Authorization", "Bearer " + stale)
                        .cookie(new Cookie("prowise_refresh_token", freshRefresh)))
                .andExpect(status().isOk()).andReturn().getResponse().getCookie("prowise_refresh_token").getValue();
        String token = objectMapper.readTree(mockMvc.perform(post("/v1/auth/refresh")
                        .cookie(new Cookie("prowise_access_token", stale), new Cookie("prowise_refresh_token", next)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("access_token").asText();
        mockMvc.perform(get("/v1/me/permissions").param("org", user.orgId().toString()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Signing in again works with a stale cookie, and lands on the same Owner dashboard")
    void loginIgnoresAStaleAccessCookie() throws Exception {
        Registered user = register();
        staleBySwitch(user);
        for (String path : List.of("/v1/auth/login", "/api/auth/login")) {
            JsonNode login = objectMapper.readTree(mockMvc.perform(post(path).contentType("application/json")
                            .cookie(new Cookie("prowise_access_token", user.accessToken()))
                            .header("Authorization", "Bearer " + user.accessToken())
                            .content("{\"email\":\"" + user.email() + "\",\"password\":\"" + PASSWORD + "\"}"))
                    .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
            assertThat(login.path("target_dashboard_url").asText()).isEqualTo("/org/" + user.orgId() + "/owner/dashboard");
        }
    }

    @Test
    @DisplayName("Signing out with a stale session clears the cookies; protected routes still reject the stale token")
    void staleSignoutClearsCookiesAndProtectedRoutesStay401() throws Exception {
        Registered user = register();
        String current = staleBySwitch(user);
        MockHttpServletResponse signout = mockMvc.perform(post("/v1/auth/signout").header("Authorization", "Bearer " + user.accessToken())
                        .cookie(new Cookie("prowise_refresh_token", current)))
                .andExpect(status().isNoContent()).andReturn().getResponse();
        assertThat(signout.getHeaders("Set-Cookie")).anySatisfy(h -> assertThat(h).startsWith("prowise_refresh_token=;").contains("Max-Age=0"));
        assertThat(signout.getHeaders("Set-Cookie")).anySatisfy(h -> assertThat(h).startsWith("prowise_access_token=;").contains("Max-Age=0")); // legacy cookie
        // The session found from the refresh cookie is revoked: that cookie no longer refreshes.
        mockMvc.perform(post("/v1/auth/refresh").cookie(new Cookie("prowise_refresh_token", current))).andExpect(status().isUnauthorized());

        mockMvc.perform(get("/v1/organizations/{org}/projects", user.orgId()).header("Authorization", "Bearer " + user.accessToken()))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/me").cookie(new Cookie("prowise_access_token", "not-a-jwt"))).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/v1/auth/signout")).andExpect(status().isNoContent()); // nothing to revoke: just clears the cookie
    }
}
