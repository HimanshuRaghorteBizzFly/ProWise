package com.prowise.testsupport;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.identity.AccountTokenService;

/**
 * Creates a verified self-registered account through the real public endpoints (approved decision D9):
 * {@code POST /v1/auth/signup} (202, pending, no session), {@code POST /v1/auth/verify-email} with a link token,
 * then {@code POST /v1/auth/login}. The verification token the test uses is issued through
 * {@link AccountTokenService} because the emailed raw value is never stored; issuing it supersedes the emailed one,
 * exactly as a resend would.
 *
 * <p>Each signup comes from its own client address so the per-address signup limit applies to the test that
 * checks it, not to fixtures.
 */
public final class TestAccounts {

    private TestAccounts() {}

    public record Account(UUID id, String email, String accessToken, MvcResult login) {}

    public static Account signUpVerifyAndLogin(MockMvc mockMvc, JdbcTemplate jdbc, AccountTokenService tokens,
            ObjectMapper objectMapper, String email, String password) throws Exception {
        mockMvc.perform(post("/v1/auth/signup")
                        .header("X-Forwarded-For", randomClientAddress())
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "email", email, "password", password, "name", email.split("@")[0]))))
                .andExpect(status().isAccepted());
        UUID id = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = lower(?)", UUID.class, email);
        String token = tokens.issue(id, AccountTokenService.Purpose.VERIFY);
        mockMvc.perform(post("/v1/auth/verify-email")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(java.util.Map.of("token", token))))
                .andExpect(status().isNoContent());
        MvcResult login = mockMvc.perform(post("/v1/auth/login")
                        .contentType("application/json")
                        .content(objectMapper.writeValueAsString(java.util.Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(login.getResponse().getContentAsString());
        return new Account(id, email, body.path("access_token").asText(), login);
    }

    public static String randomClientAddress() {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        return "10." + random.nextInt(256) + "." + random.nextInt(256) + "." + random.nextInt(1, 255);
    }
}
