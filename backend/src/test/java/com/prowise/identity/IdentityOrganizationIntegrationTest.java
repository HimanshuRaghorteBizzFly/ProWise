package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.Map;
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
    void publicRegistrationCreatesOwnerWorkspaceAndIgnoresPrivilegedRoleInput() throws Exception {
        for (String requestedRole : new String[] {"SUPER_ADMIN", "PLATFORM_OPERATOR"}) {
            String email = uniqueEmail();
            String slug = "registration-" + UUID.randomUUID().toString().replace("-", "");
            JsonNode response = objectMapper.readTree(mockMvc.perform(post("/v1/auth/signup")
                            .contentType("application/json")
                            .content(registrationBody(email, slug, requestedRole)))
                    .andExpect(status().isCreated())
                    .andReturn().getResponse().getContentAsString());
            UUID userId = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = lower(?)", UUID.class, email);
            Map<String, Object> user = jdbc.queryForMap(
                    "SELECT name, role, organization_id FROM users WHERE id = ?", userId);
            UUID organizationId = (UUID) user.get("organization_id");

            assertThat(user.get("name")).isEqualTo("Test User");
            assertThat(user.get("role")).isEqualTo("ORGANIZATION_OWNER");
            assertThat(organizationId).isNotNull();
            assertThat(jdbc.queryForObject("SELECT name FROM organizations WHERE id = ?", String.class, organizationId))
                    .isEqualTo("Workspace " + slug);
            assertThat(jdbc.queryForObject("SELECT role_template FROM memberships WHERE org_id = ? AND user_id = ?",
                    String.class, organizationId, userId)).isEqualTo("ORGANIZATION_OWNER");
            assertThat(jdbc.queryForObject("""
                    SELECT count(*) FROM grants g
                    JOIN memberships m ON m.id = g.membership_id AND m.org_id = g.org_id
                    WHERE g.org_id = ? AND m.user_id = ? AND g.scope = 'ORG'
                      AND g.template_role_id = '10000000-0000-0000-0000-000000000001'
                    """, Integer.class, organizationId, userId)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT org_id FROM sessions WHERE user_id = ?", UUID.class, userId))
                    .isEqualTo(organizationId);

            mockMvc.perform(get("/v1/admin/plans")
                            .header("Authorization", "Bearer " + response.path("access_token").asText()))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void registrationWithoutOrganizationDetailsStillCreatesAnOwnerWorkspace() throws Exception {
        String email = uniqueEmail();
        mockMvc.perform(post("/v1/auth/signup")
                        .contentType("application/json")
                        .content("""
                                {"email":"%s","password":"CorrectHorseBatteryStaple!"}
                                """.formatted(email)))
                .andExpect(status().isCreated());

        Map<String, Object> user = jdbc.queryForMap(
                "SELECT role, organization_id FROM users WHERE lower(email) = lower(?)", email);
        UUID userId = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = lower(?)", UUID.class, email);
        UUID organizationId = (UUID) user.get("organization_id");
        assertThat(user.get("role")).isEqualTo("ORGANIZATION_OWNER");
        assertThat(organizationId).isNotNull();
        assertThat(jdbc.queryForObject(
                "SELECT role_template FROM memberships WHERE org_id = ? AND user_id = ?",
                String.class, organizationId, userId)).isEqualTo("ORGANIZATION_OWNER");
    }

    @Test
    void registrationRollsBackUserAndOrganizationWhenOwnerMembershipFails() throws Exception {
        String email = uniqueEmail();
        String slug = "rollback-" + UUID.randomUUID().toString().replace("-", "");
        jdbc.execute("""
                CREATE OR REPLACE FUNCTION fail_registration_membership() RETURNS trigger
                LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'membership insert failure';
                END;
                $$;
                """);
        jdbc.execute("""
                CREATE TRIGGER fail_registration_membership_trigger
                BEFORE INSERT ON memberships FOR EACH ROW EXECUTE FUNCTION fail_registration_membership()
                """);
        try {
            mockMvc.perform(post("/v1/auth/signup")
                            .contentType("application/json")
                            .content(registrationBody(email, slug, null)))
                    .andExpect(status().isInternalServerError());
        } finally {
            jdbc.execute("DROP TRIGGER fail_registration_membership_trigger ON memberships");
            jdbc.execute("DROP FUNCTION fail_registration_membership()");
        }

        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE lower(email) = lower(?)",
                Integer.class, email)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM organizations WHERE slug = ?",
                Integer.class, slug)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM sessions", Integer.class)).isZero();
    }

    @Test
    void createsOrganizationAndOwnerMembershipAtomicallyAndKeepsSettingsIsolated() throws Exception {
        String firstEmail = uniqueEmail();
        String firstSlug = "acme-one-" + UUID.randomUUID().toString().replace("-", "");
        JsonNode firstSignup = signup(firstEmail, firstSlug, "America/New_York");

        assertThat(jdbc.queryForObject("SELECT count(*) FROM memberships", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM organizations", Integer.class)).isEqualTo(1);

        String secondEmail = uniqueEmail();
        String secondSlug = "acme-two-" + UUID.randomUUID().toString().replace("-", "");
        signup(secondEmail, secondSlug, "Asia/Kolkata");

        assertThat(jdbc.queryForList("SELECT timezone FROM organizations ORDER BY slug", String.class))
                .contains("America/New_York", "Asia/Kolkata");
        UUID userOrgId = jdbc.queryForObject("SELECT organization_id FROM users WHERE lower(email) = lower(?)",
                UUID.class, firstEmail);
        assertThat(jdbc.queryForObject("SELECT slug FROM organizations WHERE id = ?", String.class, userOrgId))
                .isEqualTo(firstSlug);
        assertThat(firstSignup.path("access_token").asText()).isNotBlank();
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
        UUID userId = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = lower(?)", UUID.class, email);
        UUID organizationId = jdbc.queryForObject(
                "SELECT organization_id FROM users WHERE id = ?", UUID.class, userId);
        JsonNode signin = signin(email);
        String accessToken = signin.path("access_token").asText();
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM sessions WHERE user_id = ? AND org_id = ?", Integer.class, userId, organizationId))
                .isEqualTo(2);

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

        // Outside the two-tabs grace window, presenting the old token again is reuse.
        String oldHash = AuthService.hash(oldRefreshToken);
        UUID session = jdbc.queryForObject("SELECT session_id FROM session_refresh_history WHERE token_hash = ?", UUID.class, oldHash);
        jdbc.update("DELETE FROM session_refresh_history WHERE token_hash = ?", oldHash);
        jdbc.update("INSERT INTO session_refresh_history (token_hash, session_id, rotated_at) VALUES (?, ?, now() - interval '5 minutes')", oldHash, session);
        mockMvc.perform(post("/v1/auth/refresh").cookie(new jakarta.servlet.http.Cookie("prowise_refresh_token", oldRefreshToken)))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/v1/auth/refresh").cookie(new jakarta.servlet.http.Cookie("prowise_refresh_token", rotatedRefreshToken)))
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
        String slug = "identity-" + UUID.randomUUID().toString().replace("-", "");
        return signup(email, slug, "UTC");
    }

    private JsonNode signup(String email, String slug, String timezone) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/v1/auth/signup")
                        .contentType("application/json")
                        .content(registrationBody(email, slug, null, timezone)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
    }

    private String registrationBody(String email, String slug, String requestedRole) {
        return registrationBody(email, slug, requestedRole, "UTC");
    }

    private String registrationBody(String email, String slug, String requestedRole, String timezone) {
        String role = requestedRole == null ? "" : ",\"role\":\"" + requestedRole + "\"";
        return """
                {"email":"%s","password":"CorrectHorseBatteryStaple!","name":"Test User"%s,
                 "organization":{"name":"Workspace %s","slug":"%s","timezone":"%s",
                                 "calendar":{"workdays":[1,2,3,4,5],"holidays":[]}}}
                """.formatted(email, role, slug, slug, timezone);
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
        return mockMvc.perform(post("/v1/auth/refresh").cookie(new jakarta.servlet.http.Cookie("prowise_refresh_token", refreshToken)))
                .andExpect(status().isOk())
                .andReturn();
    }

    private static String uniqueEmail() {
        return "identity-" + UUID.randomUUID() + "@example.test";
    }
}
