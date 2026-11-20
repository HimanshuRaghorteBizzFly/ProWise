package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Tag("T01")
class IdentityOrganizationIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void cleanDatabase() {
        // Same rows as before, plus append-only security evidence and custom roles added in task 1.3.
        com.prowise.authz.TestDatabase.clean(jdbc);
    }

    @Test
    void createsOrganizationAndOwnerMembershipAtomicallyAndKeepsSettingsIsolated() throws Exception {
        String email = uniqueEmail();
        JsonNode signup = signup(email);
        String accessToken = signup.path("access_token").asText();

        mockMvc.perform(post("/v1/organizations")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType("application/json")
                        .content("""
                                {"name":"Acme One","slug":"acme-one","timezone":"America/New_York",
                                 "calendar":{"workdays":[1,2,3,4,5],"holidays":["2026-01-01"]}}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Acme One"))
                .andExpect(jsonPath("$.timezone").value("America/New_York"));

        assertThat(jdbc.queryForObject("SELECT count(*) FROM memberships", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM organizations", Integer.class)).isEqualTo(1);

        mockMvc.perform(post("/v1/organizations")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType("application/json")
                        .content("""
                                {"name":"Acme Two","slug":"acme-two","timezone":"Asia/Kolkata",
                                 "calendar":{"workdays":[1,2,3],"holidays":[]}}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.timezone").value("Asia/Kolkata"));

        assertThat(jdbc.queryForList("SELECT timezone FROM organizations ORDER BY slug", String.class))
                .containsExactly("America/New_York", "Asia/Kolkata");
    }

    @Test
    void rejectsInvalidTimezoneAndDuplicateSlug() throws Exception {
        String accessToken = signup(uniqueEmail()).path("access_token").asText();
        String body = """
                {"name":"Acme","slug":"acme","timezone":"Not/AZone","calendar":{"workdays":[1],"holidays":[]}}
                """;

        mockMvc.perform(post("/v1/organizations")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("INVALID_TIMEZONE"));

        String valid = body.replace("Not/AZone", "UTC");
        mockMvc.perform(post("/v1/organizations")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType("application/json")
                        .content(valid))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/v1/organizations")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType("application/json")
                        .content(valid.replace("\"Acme\"", "\"Acme Again\"")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_SLUG"));
    }

    @Test
    void revokedSessionIsRejectedOnTheNextRequest() throws Exception {
        String email = uniqueEmail();
        signup(email);
        JsonNode signin = signin(email);
        String accessToken = signin.path("access_token").asText();

        mockMvc.perform(post("/v1/auth/signout")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType("application/json")
                        .content("{}"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void refreshTokenReuseRevokesTheWholeFamily() throws Exception {
        String email = uniqueEmail();
        signup(email);
        MvcResult signin = signinResult(email);
        String oldRefreshToken = signin.getResponse().getCookie("prowise_refresh_token").getValue();

        MvcResult rotated = refreshResult(oldRefreshToken);
        String rotatedRefreshToken = rotated.getResponse().getCookie("prowise_refresh_token").getValue();
        assertThat(rotatedRefreshToken).isNotEqualTo(oldRefreshToken);

        mockMvc.perform(post("/v1/auth/refresh")
                        .contentType("application/json")
                        .content("{\"refresh_token\":\"" + oldRefreshToken + "\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/v1/auth/refresh")
                        .contentType("application/json")
                        .content("{\"refresh_token\":\"" + rotatedRefreshToken + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void membershipFailureRollsBackOrganizationCreation() throws Exception {
        String accessToken = signup(uniqueEmail()).path("access_token").asText();
        jdbc.execute("""
                CREATE OR REPLACE FUNCTION fail_membership_insert() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'membership insert failure';
                END;
                $$;
                """);
        jdbc.execute("""
                CREATE TRIGGER fail_membership_insert_trigger
                BEFORE INSERT ON memberships FOR EACH ROW EXECUTE FUNCTION fail_membership_insert()
                """);
        try {
            mockMvc.perform(post("/v1/organizations")
                            .header("Authorization", "Bearer " + accessToken)
                            .contentType("application/json")
                            .content("""
                                    {"name":"Rollback Org","slug":"rollback-org","timezone":"UTC",
                                     "calendar":{"workdays":[1],"holidays":[]}}
                                    """))
                    .andExpect(status().isInternalServerError());
        } finally {
            jdbc.execute("DROP TRIGGER fail_membership_insert_trigger ON memberships");
            jdbc.execute("DROP FUNCTION fail_membership_insert()");
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM organizations WHERE slug = 'rollback-org'",
                Integer.class)).isZero();
    }

    private JsonNode signup(String email) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/v1/auth/signup")
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"CorrectHorseBatteryStaple!","name":"Test User"}
                                """.formatted(email)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
    }

    private JsonNode signin(String email) throws Exception {
        return objectMapper.readTree(signinResult(email).getResponse().getContentAsString());
    }

    private MvcResult signinResult(String email) throws Exception {
        return mockMvc.perform(post("/v1/auth/signin")
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"CorrectHorseBatteryStaple!"}
                                """.formatted(email)))
                .andExpect(status().isOk())
                .andReturn();
    }

    private MvcResult refreshResult(String refreshToken) throws Exception {
        return mockMvc.perform(post("/v1/auth/refresh")
                        .contentType("application/json")
                        .content("{\"refresh_token\":\"" + refreshToken + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
    }

    private static String uniqueEmail() {
        return "identity-" + UUID.randomUUID() + "@example.test";
    }
}
