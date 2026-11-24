package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.PermissionService;
import com.prowise.superadmin.organizations.OrganizationEntity;
import com.prowise.superadmin.organizations.OrganizationRepository;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@DisplayName("Pwise Demo User Seeder Integration and Verification Tests")
class DemoUserSeederTest {

    private static final UUID DEMO_ORG_ID = DemoUserSeeder.DEMO_ORG_ID;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DemoUserSeeder demoUserSeeder;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserRoleRepository userRoleRepository;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private Environment environment;

    @BeforeEach
    void setup() {
        demoUserSeeder.seed();
    }

    @Test
    @DisplayName("1. Verify all 6 demo users exist with correct organization ID, status, and direct login flag")
    void testAllSixUsersExist() {
        for (DemoUserSeeder.DemoUserSpec spec : DemoUserSeeder.DEMO_USERS) {
            Optional<UserEntity> userOpt = userRepository.findByEmailIgnoreCase(spec.email());
            assertThat(userOpt).as("User %s must exist", spec.email()).isPresent();

            UserEntity user = userOpt.get();
            assertThat(user.getOrganizationId()).as("User %s organization ID", spec.email()).isEqualTo(DEMO_ORG_ID);
            assertThat(user.getRole()).as("User %s role", spec.email()).isEqualTo(spec.role());
            assertThat(user.getStatus()).as("User %s status", spec.email()).isEqualTo("ACTIVE");
            assertThat(user.getMustChangePassword()).as("User %s must_change_password flag must be false for direct login", spec.email()).isFalse();
        }
    }

    @Test
    @DisplayName("2. Verify organization exists with correct ID and owner email")
    void testOrganizationConfiguredCorrectly() {
        Optional<OrganizationEntity> orgOpt = organizationRepository.findById(DEMO_ORG_ID);
        assertThat(orgOpt).isPresent();
        OrganizationEntity org = orgOpt.get();
        assertThat(org.getName()).isEqualTo("example");
        assertThat(org.getSlug()).isEqualTo("example");
        assertThat(org.getState()).isEqualTo("ACTIVE");
        assertThat(org.getOwnerEmail()).isEqualTo(DemoUserSeeder.OWNER_EMAIL);
    }

    @Test
    @DisplayName("3. Verify password encoding: hashes are valid BCrypt and match credentials")
    void testPasswordEncoding() {
        for (DemoUserSeeder.DemoUserSpec spec : DemoUserSeeder.DEMO_USERS) {
            UserEntity user = userRepository.findByEmailIgnoreCase(spec.email()).orElseThrow();
            String hash = user.getPasswordHash();

            assertThat(hash).as("Hash for %s must not be plain text", spec.email()).isNotEqualTo(spec.password());
            assertThat(hash).as("Hash for %s must be BCrypt format", spec.email()).startsWith("$2");
            assertThat(passwordEncoder.matches(spec.password(), hash))
                    .as("Password for %s must match encoded hash", spec.email())
                    .isTrue();
        }
    }

    @Test
    @DisplayName("4. Verify organization memberships and user_roles for every user")
    void testMembershipsAndUserRoles() {
        for (DemoUserSeeder.DemoUserSpec spec : DemoUserSeeder.DEMO_USERS) {
            UserEntity user = userRepository.findByEmailIgnoreCase(spec.email()).orElseThrow();

            // Verify user_roles table
            List<UserRoleEntity> userRoles = userRoleRepository.findByUserId(user.getId());
            assertThat(userRoles.stream().anyMatch(r -> spec.role().equalsIgnoreCase(r.getRoleName())))
                    .as("user_roles must contain %s for user %s", spec.role(), spec.email())
                    .isTrue();

            // Verify memberships table
            List<Map<String, Object>> memberships = jdbc.queryForList(
                    "SELECT id, org_id, role_template, status FROM memberships WHERE org_id = ? AND user_id = ?",
                    DEMO_ORG_ID, user.getId()
            );
            assertThat(memberships).hasSize(1);
            assertThat(memberships.get(0).get("role_template")).isEqualTo(spec.role());
            assertThat(memberships.get(0).get("status")).isEqualTo("ACTIVE");

            // Verify grants table
            Integer grantCount = jdbc.queryForObject(
                    "SELECT count(*) FROM grants g JOIN roles r ON r.id = g.template_role_id " +
                            "WHERE g.org_id = ? AND g.membership_id = ? AND r.name = ? AND g.scope = 'ORG'",
                    Integer.class,
                    DEMO_ORG_ID, memberships.get(0).get("id"), spec.role()
            );
            assertThat(grantCount).as("Grant for role %s on user %s must exist", spec.role(), spec.email()).isEqualTo(1);
        }

        // Verify unique owner constraint: exactly one owner membership for example organization
        Integer ownerCount = jdbc.queryForObject(
                "SELECT count(*) FROM memberships WHERE org_id = ? AND role_template = 'ORGANIZATION_OWNER'",
                Integer.class,
                DEMO_ORG_ID
        );
        assertThat(ownerCount).isEqualTo(1);
    }

    @Test
    @DisplayName("5. Verify authentication via POST /api/auth/login routes directly to workspace dashboards")
    void testLoginAuthenticationAndDashboards() throws Exception {
        Map<String, String> expectedDashboards = Map.of(
                "dc741094@gmail.com", "/org/" + DEMO_ORG_ID + "/owner/dashboard",
                "orgadmin@pwise.demo", "/org/" + DEMO_ORG_ID + "/admin/dashboard",
                "manager@pwise.demo", "/org/" + DEMO_ORG_ID + "/manager/dashboard",
                "teamlead@pwise.demo", "/org/" + DEMO_ORG_ID + "/lead/dashboard",
                "developer@pwise.demo", "/org/" + DEMO_ORG_ID + "/developer/dashboard",
                "qa@pwise.demo", "/org/" + DEMO_ORG_ID + "/reviewer/dashboard"
        );

        for (DemoUserSeeder.DemoUserSpec spec : DemoUserSeeder.DEMO_USERS) {
            String payload = objectMapper.writeValueAsString(new AuthController.Credentials(
                    spec.email(),
                    spec.password()
            ));

            MvcResult result = mockMvc.perform(post("/api/auth/login")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(payload))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.access_token").isNotEmpty())
                    .andExpect(jsonPath("$.refresh_token").doesNotExist()) // only in the httpOnly cookie
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie().httpOnly("prowise_refresh_token", true))
                    .andExpect(jsonPath("$.user.email").value(spec.email()))
                    .andExpect(jsonPath("$.user.role").value(spec.role()))
                    .andExpect(jsonPath("$.user.organization_id").value(DEMO_ORG_ID.toString()))
                    .andExpect(jsonPath("$.must_change_password").value(false))
                    .andExpect(jsonPath("$.target_dashboard_url").value(expectedDashboards.get(spec.email())))
                    .andReturn();

            JsonNode response = objectMapper.readTree(result.getResponse().getContentAsString());
            String accessToken = response.get("access_token").asText();

            // Verify calling /v1/me returns the bound organization and matching role dashboard URL
            mockMvc.perform(get("/v1/me")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.organization_id").value(DEMO_ORG_ID.toString()))
                    .andExpect(jsonPath("$.role").value(spec.role()))
                    .andExpect(jsonPath("$.target_dashboard_url").value(expectedDashboards.get(spec.email())));
        }
    }

    @Test
    @DisplayName("6. Verify effective permissions and access boundaries for each role")
    void testEffectivePermissionsAndBoundaries() throws Exception {
        // Owner has org.manage and audit.read
        String ownerToken = loginAndGetToken("dc741094@gmail.com", "Owner@Pwise2026");
        MvcResult ownerPerms = mockMvc.perform(get("/v1/me/permissions")
                        .param("org", DEMO_ORG_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + ownerToken))
                .andExpect(status().isOk())
                .andReturn();
        String ownerJson = ownerPerms.getResponse().getContentAsString();
        assertThat(ownerJson).contains("org.manage", "member.invite", "project.create", "audit.read", "project.archive");

        // Admin has member.invite and project.create, but NOT org.manage or project.archive
        String adminToken = loginAndGetToken("orgadmin@pwise.demo", "Admin@Pwise2026");
        MvcResult adminPerms = mockMvc.perform(get("/v1/me/permissions")
                        .param("org", DEMO_ORG_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andReturn();
        String adminJson = adminPerms.getResponse().getContentAsString();
        assertThat(adminJson).contains("member.invite", "project.create", "audit.read");
        assertThat(adminJson).doesNotContain("\"org.manage\"", "\"project.archive\"");

        // Developer has project.read, task.update, but NOT org.manage or member.invite
        String devToken = loginAndGetToken("developer@pwise.demo", "Developer@Pwise2026");
        MvcResult devPerms = mockMvc.perform(get("/v1/me/permissions")
                        .param("org", DEMO_ORG_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + devToken))
                .andExpect(status().isOk())
                .andReturn();
        String devJson = devPerms.getResponse().getContentAsString();
        assertThat(devJson).contains("project.read", "task.update", "project.progress.report");
        assertThat(devJson).doesNotContain("\"org.manage\"", "\"member.invite\"", "\"project.create\"");

        // QA Reviewer has project.read, task.review, but NOT task.create or org.manage
        String qaToken = loginAndGetToken("qa@pwise.demo", "QA@Pwise2026");
        MvcResult qaPerms = mockMvc.perform(get("/v1/me/permissions")
                        .param("org", DEMO_ORG_ID.toString())
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + qaToken))
                .andExpect(status().isOk())
                .andReturn();
        String qaJson = qaPerms.getResponse().getContentAsString();
        assertThat(qaJson).contains("project.read", "task.review");
        assertThat(qaJson).doesNotContain("\"task.create\"", "\"org.manage\"", "\"member.invite\"");

        // Organization users cannot access Super Admin endpoints
        mockMvc.perform(get("/api/super-admin/users")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + devToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("7. Verify idempotency: running seeder multiple times does not duplicate records")
    void testIdempotency() {
        int initialUserCount = userRepository.findByOrganizationId(DEMO_ORG_ID).size();
        UUID ownerIdBefore = userRepository.findByEmailIgnoreCase(DemoUserSeeder.OWNER_EMAIL).orElseThrow().getId();

        // Run seed 3 more times
        demoUserSeeder.seed();
        demoUserSeeder.seed();
        demoUserSeeder.seed();

        int afterUserCount = userRepository.findByOrganizationId(DEMO_ORG_ID).size();
        UUID ownerIdAfter = userRepository.findByEmailIgnoreCase(DemoUserSeeder.OWNER_EMAIL).orElseThrow().getId();

        assertThat(afterUserCount).isEqualTo(initialUserCount);
        assertThat(ownerIdAfter).isEqualTo(ownerIdBefore);

        // Verify membership count for org
        Integer membershipCount = jdbc.queryForObject(
                "SELECT count(*) FROM memberships WHERE org_id = ?",
                Integer.class,
                DEMO_ORG_ID
        );
        assertThat(membershipCount).isEqualTo(6);
    }

    @Test
    @DisplayName("8. Verify seeder refuses execution when a production profile is active")
    void testRefusesExecutionInProduction() {
        MockEnvironment prodEnv = new MockEnvironment();
        prodEnv.setActiveProfiles("production");

        DemoUserSeeder prodSeeder = new DemoUserSeeder(
                userRepository,
                userRoleRepository,
                organizationRepository,
                passwordEncoder,
                jdbc,
                prodEnv
        );

        assertThatThrownBy(prodSeeder::seed)
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("production");
    }

    private String loginAndGetToken(String email, String password) throws Exception {
        String payload = objectMapper.writeValueAsString(new AuthController.Credentials(email, password));
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
        return node.get("access_token").asText();
    }
}
