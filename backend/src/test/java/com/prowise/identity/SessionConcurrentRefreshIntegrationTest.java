package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

/**
 * Two tabs refresh with the same cookie at the same moment (default grace window): neither tab is logged out, the
 * second gets an access token but no new refresh token (the browser already holds the rotated cookie), and the session
 * is not revoked.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T01")
class SessionConcurrentRefreshIntegrationTest {

    private static final String COOKIE = "prowise_refresh_token";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;

    @BeforeEach
    @AfterEach
    void clean() {
        TestDatabase.clean(jdbc);
    }

    @Test
    @DisplayName("Two tabs refreshing at once both stay signed in; the session is not treated as stolen")
    void simultaneousRefreshFromTwoTabs() throws Exception {
        String email = "tabs-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        String slug = "tabs-" + UUID.randomUUID().toString().substring(0, 10);
        String cookie = mockMvc.perform(post("/v1/auth/signup").contentType("application/json").content("""
                        {"email":"%s","password":"CorrectHorseBatteryStaple!","organization":{"name":"T %s","slug":"%s","timezone":"UTC","calendar":{}}}
                        """.formatted(email, slug, slug))).andExpect(status().isCreated()).andReturn().getResponse().getCookie(COOKIE).getValue();

        MockHttpServletResponse tabA = mockMvc.perform(post("/v1/auth/refresh").cookie(new Cookie(COOKIE, cookie))).andExpect(status().isOk())
                .andReturn().getResponse();
        MockHttpServletResponse tabB = mockMvc.perform(post("/v1/auth/refresh").cookie(new Cookie(COOKIE, cookie))).andExpect(status().isOk())
                .andReturn().getResponse();
        assertThat(tabA.getCookie(COOKIE)).isNotNull();
        assertThat(tabB.getHeaders("Set-Cookie")).noneMatch(h -> h.startsWith(COOKIE + "=") && !h.startsWith(COOKIE + "=;"));
        String tokenB = objectMapper.readTree(tabB.getContentAsString()).path("access_token").asText();
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + tokenB)).andExpect(status().isOk());
        // Tab A's rotated cookie keeps the session going.
        mockMvc.perform(post("/v1/auth/refresh").cookie(new Cookie(COOKIE, tabA.getCookie(COOKIE).getValue()))).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM sessions s JOIN users u ON u.id = s.user_id WHERE lower(u.email) = lower(?) AND s.revoked_at IS NULL",
                Integer.class, email)).isEqualTo(1);
    }
}
