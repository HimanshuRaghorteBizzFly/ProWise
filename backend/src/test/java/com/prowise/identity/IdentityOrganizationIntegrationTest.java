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
import com.prowise.testsupport.TestAccounts;
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

    @Autowired
    private com.prowise.identity.AccountTokenService accountTokens;

    @BeforeEach
    void cleanDatabase() {
        // Same rows as before, plus append-only security evidence and custom roles added in task 1.3.
        com.prowise.authz.TestDatabase.clean(jdbc);
    }

    /**
     * Approved decision D9 supersedes the earlier "signup creates the workspace" follow-up: public signup creates a
     * pending VIEWER with no organization and no session, whatever role or organization the body carries.
     */
    @Test
    void publicRegistrationIgnoresPrivilegedRoleAndOrganizationInputAndIssuesNoSession() throws Exception {
        for (String requestedRole : new String[] {"SUPER_ADMIN", "PLATFORM_OPERATOR", "ORGANIZATION_OWNER"}) {
            String email = uniqueEmail();
            String slug = "registration-" + UUID.randomUUID().toString().replace("-", "");
            mockMvc.perform(post("/v1/auth/signup")
                            .header("X-Forwarded-For", TestAccounts.randomClientAddress())
                            .contentType("application/json")
                            .content(registrationBody(email, slug, requestedRole)))
                    .andExpect(status().isAccepted())
                    .andExpect(jsonPath("$.access_token").doesNotExist());
            Map<String, Object> user = jdbc.queryForMap(
                    "SELECT id, name, role, status, organization_id FROM users WHERE lower(email) = lower(?)", email);

            assertThat(user.get("name")).isEqualTo("Test User");
            assertThat(user.get("role")).isEqualTo("VIEWER");
            assertThat(user.get("status")).isEqualTo("PENDING_ACTIVATION");
            assertThat(user.get("organization_id")).isNull();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM organizations WHERE slug = ?", Integer.class, slug))
                    .isZero();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM memberships WHERE user_id = ?", Integer.class,
                    user.get("id"))).isZero();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM sessions WHERE user_id = ?", Integer.class,
                    user.get("id"))).isZero();
        }
    }

    @Test
    void verifiedOwnerCreatesWorkspaceWithOwnerMembershipAndGrantButNoPlatformAccess() throws Exception {
        String email = uniqueEmail();
        String accessToken = signup(email).path("access_token").asText();
        UUID userId = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = lower(?)", UUID.class, email);
        assertThat(jdbc.queryForObject("SELECT role FROM users WHERE id = ?", String.class, userId)).isEqualTo("VIEWER");

        String slug = "workspace-" + UUID.randomUUID().toString().replace("-", "");
        UUID organizationId = UUID.fromString(createOrganization(accessToken, slug, "UTC").path("id").asText());

        assertThat(jdbc.queryForObject("SELECT role_template FROM memberships WHERE org_id = ? AND user_id = ?",
                String.class, organizationId, userId)).isEqualTo("ORGANIZATION_OWNER");
        assertThat(jdbc.queryForObject("""
                SELECT count(*) FROM grants g
                JOIN memberships m ON m.id = g.membership_id AND m.org_id = g.org_id
                WHERE g.org_id = ? AND m.user_id = ? AND g.scope = 'ORG'
                  AND g.template_role_id = '10000000-0000-0000-0000-000000000001'
                """, Integer.class, organizationId, userId)).isEqualTo(1);

        mockMvc.perform(get("/v1/admin/plans").header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void createsOrganizationAndOwnerMembershipAtomicallyAndKeepsSettingsIsolated() throws Exception {
        String firstEmail = uniqueEmail();
        String firstSlug = "acme-one-" + UUID.randomUUID().toString().replace("-", "");
        createOrganization(signup(firstEmail).path("access_token").asText(), firstSlug, "America/New_York");

        assertThat(jdbc.queryForObject("SELECT count(*) FROM memberships", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM organizations", Integer.class)).isEqualTo(1);

        String secondEmail = uniqueEmail();
        String secondSlug = "acme-two-" + UUID.randomUUID().toString().replace("-", "");
        createOrganization(signup(secondEmail).path("access_token").asText(), secondSlug, "Asia/Kolkata");

        assertThat(jdbc.queryForList("SELECT timezone FROM organizations ORDER BY slug", String.class))
                .contains("America/New_York", "Asia/Kolkata");
        UUID firstOrg = jdbc.queryForObject("""
                SELECT m.org_id FROM memberships m JOIN users u ON u.id = m.user_id WHERE lower(u.email) = lower(?)
                """, UUID.class, firstEmail);
        assertThat(jdbc.queryForObject("SELECT slug FROM organizations WHERE id = ?", String.class, firstOrg))
                .isEqualTo(firstSlug);
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
        JsonNode signin = signin(email);
        String accessToken = signin.path("access_token").asText();
        // Two open sessions: the one from the verified login and this sign-in.
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM sessions WHERE user_id = ? AND revoked_at IS NULL", Integer.class, userId))
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

    /** Signup returns 202 without a session (D9): verify through the real endpoint and sign in. */
    private JsonNode signup(String email) throws Exception {
        TestAccounts.Account account = TestAccounts.signUpVerifyAndLogin(
                mockMvc, jdbc, accountTokens, objectMapper, email, "CorrectHorseBatteryStaple-7!");
        return objectMapper.createObjectNode().put("access_token", account.accessToken());
    }

    private JsonNode createOrganization(String accessToken, String slug, String timezone) throws Exception {
        return objectMapper.readTree(mockMvc.perform(post("/v1/organizations")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType("application/json")
                        .content("""
                                {"name":"Workspace %s","slug":"%s","timezone":"%s",
                                 "calendar":{"workdays":[1,2,3,4,5],"holidays":[]}}
                                """.formatted(slug, slug, timezone)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
    }

    private String registrationBody(String email, String slug, String requestedRole) {
        return registrationBody(email, slug, requestedRole, "UTC");
    }

    private String registrationBody(String email, String slug, String requestedRole, String timezone) {
        String role = requestedRole == null ? "" : ",\"role\":\"" + requestedRole + "\"";
        return """
                {"email":"%s","password":"CorrectHorseBatteryStaple-7!","name":"Test User"%s,
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
                                {"email":"%s","password":"CorrectHorseBatteryStaple-7!"}
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
