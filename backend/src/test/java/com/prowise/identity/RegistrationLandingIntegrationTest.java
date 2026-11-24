package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

/**
 * Registration and login landing. Registering a company makes the user the one and only Owner of a new organization
 * in one transaction and binds the session to it; every login lands from the real account type and ACTIVE
 * memberships, never from a default (no Super Admin fallback for normal users).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T01")
@Tag("T06")
class RegistrationLandingIntegrationTest {

    private static final String PASSWORD = "CorrectHorseBatteryStaple!";
    private static final UUID OWNER_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID ADMIN_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000002");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;


    @BeforeEach
    void clean() {
        TestDatabase.clean(jdbc);
    }

    @AfterEach
    void cleanAfter() {
        TestDatabase.clean(jdbc);
    }

    /* ================================================================== registration */

    @Test
    @DisplayName("Registering creates exactly one ACTIVE Owner membership with the Owner grant, audited, and lands on the Owner dashboard")
    void registrationCreatesTheOnlyOwnerAndLandsOnTheOwnerDashboard() throws Exception {
        String email = unique("founder");
        JsonNode signup = signup(email, null, null);
        UUID orgId = UUID.fromString(signup.path("organization_id").asText());
        UUID userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID.class, email);

        assertThat(signup.path("role").asText()).isEqualTo("ORGANIZATION_OWNER");
        assertThat(signup.path("target_dashboard_url").asText()).isEqualTo("/org/" + orgId + "/owner/dashboard");
        assertThat(count("SELECT count(*) FROM memberships WHERE org_id = ?", orgId)).isEqualTo(1);
        assertThat(count("""
                SELECT count(*) FROM memberships WHERE org_id = ? AND user_id = ? AND status = 'ACTIVE'
                  AND role_template = 'ORGANIZATION_OWNER'
                """, orgId, userId)).isEqualTo(1);
        assertThat(count("""
                SELECT count(*) FROM grants g JOIN memberships m ON m.id = g.membership_id
                WHERE g.org_id = ? AND m.user_id = ? AND g.scope = 'ORG' AND g.template_role_id = ?
                """, orgId, userId, OWNER_ROLE)).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT role FROM users WHERE id = ?", String.class, userId))
                .isEqualTo("ORGANIZATION_OWNER");
        assertThat(count("SELECT count(*) FROM audit_log WHERE org_id = ? AND action = 'organization.created'", orgId)).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE org_id = ? AND event_type = 'OrganizationCreated'", orgId)).isEqualTo(1);

        // The very first requests with the signup token succeed on the owner pages.
        String token = signup.path("access_token").asText();
        JsonNode permissions = json(mockMvc.perform(get("/v1/me/permissions").param("org", orgId.toString())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(permissions.toString()).contains("org.manage", "member.invite", "project.create", "audit.read");
        mockMvc.perform(get("/v1/organizations/{org}/projects", orgId).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organization_id").value(orgId.toString()))
                .andExpect(jsonPath("$.role").value("ORGANIZATION_OWNER"))
                .andExpect(jsonPath("$.landing").value("WORKSPACE"))
                .andExpect(jsonPath("$.platform_account").value(false))
                .andExpect(jsonPath("$.target_dashboard_url").value("/org/" + orgId + "/owner/dashboard"));
    }

    @Test
    @DisplayName("Registration cannot choose its role, organization or platform access")
    void registrationCannotChooseItsRole() throws Exception {
        UUID foreignOrg = UUID.fromString(signup(unique("other"), null, null).path("organization_id").asText());
        for (String requested : List.of("SUPER_ADMIN", "PLATFORM_OPERATOR", "VIEWER", "DEVELOPER")) {
            String email = unique("sneaky");
            JsonNode signup = signup(email, requested, foreignOrg);
            UUID orgId = UUID.fromString(signup.path("organization_id").asText());
            assertThat(orgId).isNotEqualTo(foreignOrg);
            assertThat(signup.path("role").asText()).isEqualTo("ORGANIZATION_OWNER");
            assertThat(jdbc.queryForObject("SELECT role FROM users WHERE email = ?", String.class, email))
                    .isEqualTo("ORGANIZATION_OWNER");
            assertThat(count("SELECT count(*) FROM memberships m JOIN users u ON u.id = m.user_id WHERE u.email = ?", email))
                    .isEqualTo(1);
            // No platform authority: the Super Admin API stays closed.
            mockMvc.perform(get("/api/super-admin/users").header("Authorization", "Bearer " + signup.path("access_token").asText()))
                    .andExpect(status().isForbidden());
        }
        assertThat(count("SELECT count(*) FROM memberships WHERE org_id = ?", foreignOrg)).isEqualTo(1);
    }

    /* ================================================================== login landing */

    @Test
    @DisplayName("Login lands the Owner on the Owner dashboard with a session bound to that organization")
    void ownerLoginLandsOnOwnerDashboard() throws Exception {
        String email = unique("owner");
        UUID orgId = UUID.fromString(signup(email, null, null).path("organization_id").asText());
        JsonNode login = login(email);
        assertThat(login.path("target_dashboard_url").asText()).isEqualTo("/org/" + orgId + "/owner/dashboard");
        assertThat(login.path("user").path("role").asText()).isEqualTo("ORGANIZATION_OWNER");
        assertThat(login.path("user").path("organization_id").asText()).isEqualTo(orgId.toString());
        mockMvc.perform(get("/v1/me/permissions").param("org", orgId.toString())
                        .header("Authorization", "Bearer " + login.path("access_token").asText()))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("Login lands an Organization Admin on the Admin dashboard, whatever the users.role column says")
    void adminLoginLandsOnAdminDashboard() throws Exception {
        UUID orgId = UUID.fromString(signup(unique("boss"), null, null).path("organization_id").asText());
        String email = unique("admin");
        UUID userId = user(email, "ORGANIZATION_OWNER"); // stale global column must not decide the landing
        member(orgId, userId, "ORGANIZATION_ADMIN", ADMIN_ROLE);
        JsonNode login = login(email);
        assertThat(login.path("target_dashboard_url").asText()).isEqualTo("/org/" + orgId + "/admin/dashboard");
        assertThat(login.path("user").path("role").asText()).isEqualTo("ORGANIZATION_ADMIN");
    }

    @Test
    @DisplayName("A user with two organizations goes to the workspace picker with an unbound session")
    void twoOrganizationsGoToTheWorkspacePicker() throws Exception {
        String email = unique("multi");
        UUID first = UUID.fromString(signup(email, null, null).path("organization_id").asText());
        UUID second = UUID.fromString(signup(unique("second"), null, null).path("organization_id").asText());
        UUID userId = jdbc.queryForObject("SELECT id FROM users WHERE email = ?", UUID.class, email);
        member(second, userId, "ORGANIZATION_ADMIN", ADMIN_ROLE);

        JsonNode login = login(email);
        assertThat(login.path("target_dashboard_url").asText()).isEqualTo("/select-workspace");
        assertThat(login.path("user").path("organization_id").isNull()).isTrue();
        String token = login.path("access_token").asText();
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.landing").value("SELECT_WORKSPACE"))
                .andExpect(jsonPath("$.memberships.length()").value(2));
        // Choosing a workspace binds the session; the role claim follows that membership.
        String switched = json(mockMvc.perform(post("/v1/me/organizations/{org}/switch", second)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("access_token").asText();
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + switched))
                .andExpect(jsonPath("$.organization_id").value(second.toString()))
                .andExpect(jsonPath("$.role").value("ORGANIZATION_ADMIN"))
                .andExpect(jsonPath("$.target_dashboard_url").value("/org/" + second + "/admin/dashboard"));
        assertThat(first).isNotEqualTo(second);
    }

    @Test
    @DisplayName("A user without an active membership sees \"no workspace yet\", never a platform dashboard")
    void noMembershipLandsOnNoWorkspace() throws Exception {
        String email = unique("lonely");
        user(email, "SUPER_ADMIN_LOOKALIKE");
        JsonNode login = login(email);
        assertThat(login.path("target_dashboard_url").asText()).isEqualTo("/no-workspace");
        assertThat(login.path("user").path("organization_id").isNull()).isTrue();
        mockMvc.perform(get("/v1/me").header("Authorization", "Bearer " + login.path("access_token").asText()))
                .andExpect(jsonPath("$.landing").value("NO_WORKSPACE"))
                .andExpect(jsonPath("$.target_dashboard_url").value("/no-workspace"));

        // A disabled membership does not count either.
        String disabled = unique("gone");
        UUID orgId = UUID.fromString(signup(unique("org"), null, null).path("organization_id").asText());
        UUID userId = user(disabled, "DEVELOPER");
        UUID membership = member(orgId, userId, "ORGANIZATION_ADMIN", ADMIN_ROLE);
        jdbc.update("UPDATE memberships SET status = 'DISABLED' WHERE id = ?", membership);
        assertThat(login(disabled).path("target_dashboard_url").asText()).isEqualTo("/no-workspace");
    }

    @Test
    @DisplayName("Normal users never get Super Admin routing; real platform accounts still do")
    void onlyPlatformAccountsReachPlatformDashboards() throws Exception {
        String ownerEmail = unique("normal");
        signup(ownerEmail, "SUPER_ADMIN", null);
        JsonNode owner = login(ownerEmail);
        assertThat(owner.path("target_dashboard_url").asText()).doesNotContain("super-admin").startsWith("/org/");
        mockMvc.perform(get("/api/super-admin/users").header("Authorization", "Bearer " + owner.path("access_token").asText()))
                .andExpect(status().isForbidden());

        String adminEmail = unique("platform");
        user(adminEmail, "SUPER_ADMIN");
        JsonNode admin = login(adminEmail);
        assertThat(admin.path("target_dashboard_url").asText()).isEqualTo("/super-admin/dashboard");
        assertThat(admin.path("user").path("role").asText()).isEqualTo("SUPER_ADMIN");
        mockMvc.perform(get("/api/super-admin/users").header("Authorization", "Bearer " + admin.path("access_token").asText()))
                .andExpect(status().isOk());
    }

    /* ================================================================== helpers */

    private JsonNode signup(String email, String requestedRole, UUID requestedOrg) throws Exception {
        String slug = "co-" + UUID.randomUUID().toString().substring(0, 12);
        String extra = (requestedRole == null ? "" : ",\"role\":\"" + requestedRole + "\"")
                + (requestedOrg == null ? "" : ",\"organization_id\":\"" + requestedOrg + "\",\"org_id\":\"" + requestedOrg + "\"");
        String body = """
                {"email":"%s","password":"%s","name":"Founder"%s,
                 "organization":{"name":"Company %s","slug":"%s","timezone":"Europe/London",
                                 "calendar":{"workdays":[1,2,3,4,5],"holidays":[]}}}
                """.formatted(email, PASSWORD, extra, slug, slug);
        return json(mockMvc.perform(post("/v1/auth/signup").contentType("application/json").content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
    }

    private JsonNode login(String email) throws Exception {
        return json(mockMvc.perform(post("/v1/auth/login").contentType("application/json")
                        .content("{\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private UUID user(String email, String globalRole) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, password_hash, name, role, status, must_change_password) "
                + "VALUES (?, ?, ?, 'Test', ?, 'ACTIVE', false)", id, email, passwordEncoder.encode(PASSWORD), globalRole);
        return id;
    }

    private UUID member(UUID orgId, UUID userId, String template, UUID roleId) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, orgId, userId, template);
        jdbc.update("INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by) VALUES (?, ?, ?, ?, 'ORG', ?)",
                UUID.randomUUID(), orgId, id, roleId, userId);
        return id;
    }

    private static String unique(String prefix) {
        return prefix + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
    }

    private int count(String sql, Object... args) {
        Integer value = jdbc.queryForObject(sql, Integer.class, args);
        return value == null ? 0 : value;
    }

    private JsonNode json(String body) throws Exception {
        return objectMapper.readTree(body);
    }
}
