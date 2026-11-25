package com.prowise.superadmin;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.PermissionService;
import com.prowise.authz.TestDatabase;
import com.prowise.identity.AuthPrincipal;
import com.prowise.identity.RequestThrottle;
import com.prowise.superadmin.roles.SystemRoleBaseline;

/**
 * Roles &amp; Permissions Governance (task 1.5): persisted roles, real user counts, custom role lifecycle with
 * expected_version, Super Admin protection, baseline reset / re-sync, enforcement through tenant grants, and access.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T05")
@Tag("NFR-06")
class SuperAdminRoleGovernanceIntegrationTest {

    private static final String PASSWORD = "Governance-Pass-01!";
    private static final String DEVELOPER_DEF = "20000000-0000-0000-0000-000000000007";
    private static final String OWNER_DEF = "20000000-0000-0000-0000-000000000003";
    private static final UUID DEVELOPER_TEMPLATE = UUID.fromString("10000000-0000-0000-0000-000000000005");

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private RequestThrottle throttle;
    @Autowired private PermissionService permissionService;

    private String adminEmail;
    private String token;
    private int ipCounter;

    @BeforeEach
    void setUp() throws Exception {
        jdbc.update("DELETE FROM user_login_history");
        jdbc.update("DELETE FROM user_roles");
        jdbc.update("DELETE FROM admin_audit_logs");
        TestDatabase.clean(jdbc);
        throttle.clear();
        adminEmail = "roles." + UUID.randomUUID().toString().substring(0, 8) + "@prowise.test";
        user(adminEmail, "SUPER_ADMIN");
        token = login(adminEmail);
    }

    /** System roles are shared reference data: put every template and definition back exactly as migrated. */
    @AfterEach
    void restoreSystemRoles() {
        for (Map.Entry<UUID, Set<String>> entry : SystemRoleBaseline.ORGANIZATION_TEMPLATES.entrySet()) {
            jdbc.update("DELETE FROM role_permissions WHERE role_id = ?", entry.getKey());
            for (String key : entry.getValue()) {
                jdbc.update("INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)", entry.getKey(), key);
            }
        }
        jdbc.update("DELETE FROM platform_role_permissions");
        jdbc.update("UPDATE platform_role_definitions SET name = 'Super Admin', color = 'amber' WHERE slug = 'super-admin'");
        TestDatabase.clean(jdbc);
    }

    // ---------------------------------------------------------------- list, catalog, real counts

    @Test
    @Tag("AS-02")
    void theNineSystemRolesComeFromTheDatabaseInRankOrderWithRealCounts() throws Exception {
        JsonNode roles = ok(get("/v1/admin/roles"), null, 200);
        List<String> slugs = new ArrayList<>();
        roles.forEach(r -> slugs.add(r.path("slug").asText()));
        assertThat(slugs).containsExactly("super-admin", "platform-operator", "organization-owner", "organization-admin",
                "project-manager", "team-lead", "developer", "qa-reviewer", "viewer");
        for (int i = 0; i < 9; i++) {
            assertThat(roles.get(i).path("rank").asInt()).isEqualTo(i + 1);
            assertThat(roles.get(i).path("rank_label").asText()).isEqualTo("#" + (i + 1));
            assertThat(roles.get(i).path("is_system").asBoolean()).isTrue();
        }
        assertThat(roles.get(0).path("tier").asInt()).isEqualTo(1);
        assertThat(roles.get(2).path("tier_name").asText()).isEqualTo("Tenant Administration");
        assertThat(roles.get(8).path("tier").asInt()).isEqualTo(5);

        // Real holders only: one active Super Admin (this test's), active operators as stored, nobody in tenants yet.
        long superAdmins = jdbc.queryForObject("SELECT count(*) FROM users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE'", Long.class);
        long operators = jdbc.queryForObject("SELECT count(*) FROM platform_operators WHERE status = 'ACTIVE'", Long.class);
        assertThat(roles.get(0).path("user_count").asLong()).isEqualTo(superAdmins).isEqualTo(1);
        assertThat(roles.get(1).path("user_count").asLong()).isEqualTo(operators);
        for (int i = 2; i < 9; i++) assertThat(roles.get(i).path("user_count").asLong()).isZero();

        // Capabilities reflect enforcement: Super Admin holds the whole catalog, templates their role_permissions.
        JsonNode catalog = ok(get("/v1/admin/permissions"), null, 200);
        int total = catalog.path("total").asInt();
        assertThat(catalog.path("module_count").asInt()).isGreaterThan(5);
        assertThat(roles.get(0).path("capability_count").asInt()).isEqualTo(total);
        assertThat(roles.get(0).path("catalog_size").asInt()).isEqualTo(total);
        assertThat(texts(roles.get(6).path("permissions")))
                .containsExactlyElementsOf(new TreeSet<>(SystemRoleBaseline.ORGANIZATION_TEMPLATES.get(DEVELOPER_TEMPLATE)));
        assertThat(roles.get(6).path("baseline_drift").asBoolean()).isFalse();

        // A member with an active, unexpired grant of Developer is counted; a disabled one is not.
        UUID org = organization();
        membershipWithGrant(org, "dev1@acme.test", DEVELOPER_TEMPLATE, "ACTIVE");
        membershipWithGrant(org, "dev2@acme.test", DEVELOPER_TEMPLATE, "DISABLED");
        JsonNode developer = ok(get("/v1/admin/roles/" + DEVELOPER_DEF), null, 200);
        assertThat(developer.path("user_count").asLong()).isEqualTo(1);
        assertThat(developer.path("organization_count").asLong()).isEqualTo(1);
        JsonNode holders = ok(get("/v1/admin/roles/" + DEVELOPER_DEF + "/holders"), null, 200);
        assertThat(holders).hasSize(1);
        assertThat(holders.get(0).path("email").asText()).isEqualTo("dev1@acme.test");
        JsonNode matches = ok(get("/v1/admin/roles/holder-search").param("q", "dev1@acme"), null, 200);
        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).path("role_id").asText()).isEqualTo(DEVELOPER_DEF);
    }

    @Test
    void noInventedPeopleAnywhere() throws Exception {
        String body = call(get("/v1/admin/roles"), null).andReturn().getResponse().getContentAsString()
                + call(get("/v1/admin/roles/20000000-0000-0000-0000-000000000001/holders"), null).andReturn().getResponse().getContentAsString();
        for (String fake : List.of("Marcus", "Elena", "Devon", "Jordan Mercer", "Site Reliability Engineer",
                "Workspace Administrator", "Full-Stack Developer", "Executive Delivery Viewer", "assigned_users")) {
            assertThat(body).doesNotContain(fake);
        }
        assertThat(body).contains(adminEmail);
    }

    // ---------------------------------------------------------------- custom roles: persistence, versions, enforcement

    @Test
    void customOrganizationRoleIsPersistedVersionedAndEnforcedThroughGrants() throws Exception {
        JsonNode created = ok(post("/v1/admin/roles"), Map.of("name", "Release Manager", "description", "Ships releases",
                "tier", 3, "color", "orange", "icon", "Rocket", "permissions", List.of("project.read", "report.export")), 201);
        String id = created.path("id").asText();
        assertThat(created.path("slug").asText()).isEqualTo("release-manager");
        assertThat(created.path("is_system").asBoolean()).isFalse();
        assertThat(created.path("tier").asInt()).isEqualTo(3);
        assertThat(created.path("rank_label").asText()).isEqualTo("#6.1");
        assertThat(created.path("template_name").asText()).isEqualTo("CUSTOM_RELEASE_MANAGER");
        assertThat(created.path("version").asLong()).isZero();

        // Persisted: a separate request (and the DB) sees it.
        assertThat(ok(get("/v1/admin/roles"), null, 200).findValuesAsText("slug")).contains("release-manager");
        UUID templateId = jdbc.queryForObject("SELECT template_role_id FROM platform_role_definitions WHERE id = ?::uuid",
                UUID.class, id);
        assertThat(jdbc.queryForList("SELECT permission_key FROM role_permissions WHERE role_id = ? ORDER BY 1",
                String.class, templateId)).containsExactly("project.read", "report.export");

        // A tenant member granted the template gets exactly its keys (PermissionService), nothing from its name.
        UUID org = organization();
        UUID userId = membershipWithGrant(org, "rm@acme.test", templateId, "ACTIVE");
        UsernamePasswordAuthenticationToken member = memberAuth(userId, org);
        assertThat(permissionService.can(member, org, "report.export")).isTrue();
        assertThat(permissionService.can(member, org, "task.create")).isFalse();

        // Details: stale 409, then ok.
        stale(put("/v1/admin/roles/" + id), Map.of("description", "x", "expected_version", 3));
        JsonNode renamed = ok(put("/v1/admin/roles/" + id), Map.of("name", "Release Captain", "expected_version", 0), 200);
        assertThat(renamed.path("version").asLong()).isEqualTo(1);
        call(put("/v1/admin/roles/" + id), Map.of("name", "No version")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.field_errors[0].field").value("expected_version"));

        // Permissions: stale 409, then ok -> effective immediately for the existing grant.
        stale(put("/v1/admin/roles/" + id + "/permissions"), Map.of("permissions", List.of("task.create"), "expected_version", 0));
        JsonNode changed = ok(put("/v1/admin/roles/" + id + "/permissions"),
                Map.of("permissions", List.of("project.read", "task.create"), "expected_version", 1), 200);
        assertThat(texts(changed.path("permissions"))).containsExactly("project.read", "task.create");
        assertThat(permissionService.can(member, org, "task.create")).isTrue();
        assertThat(permissionService.can(member, org, "report.export")).isFalse();

        // Unknown keys and platform-root keys are refused.
        call(put("/v1/admin/roles/" + id + "/permissions"), Map.of("permissions", List.of("made.up"), "expected_version", 2))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("INVALID_PERMISSION"));
        call(put("/v1/admin/roles/" + id + "/permissions"),
                Map.of("permissions", List.of("platform.roles.manage"), "expected_version", 2))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SUPER_ADMIN_PROTECTED"));

        // Deactivated: grants give nothing, and it is in use so it cannot be deleted.
        JsonNode inactive = ok(post("/v1/admin/roles/" + id + "/toggle-active"), Map.of("expected_version", 2), 200);
        assertThat(inactive.path("is_active").asBoolean()).isFalse();
        assertThat(permissionService.can(member, org, "task.create")).isFalse();
        call(delete("/v1/admin/roles/" + id).param("expectedVersion", "3"), null)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ROLE_IN_USE"));
        ok(post("/v1/admin/roles/" + id + "/toggle-active"), Map.of("expected_version", 3), 200);
        assertThat(permissionService.can(member, org, "task.create")).isTrue();

        // Once nobody holds it: stale delete 409, then 204 and 404 afterwards (template rows gone too).
        jdbc.update("DELETE FROM grants WHERE template_role_id = ?", templateId);
        jdbc.update("DELETE FROM memberships WHERE role_template = 'CUSTOM_RELEASE_MANAGER'");
        call(delete("/v1/admin/roles/" + id).param("expectedVersion", "1"), null)
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        call(delete("/v1/admin/roles/" + id).param("expectedVersion", "4"), null).andExpect(status().isNoContent());
        call(get("/v1/admin/roles/" + id), null).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM roles WHERE id = ?", Integer.class, templateId)).isZero();

        // Every change is audited with the signed-in actor.
        JsonNode history = ok(get("/v1/admin/roles/audit-log"), null, 200);
        assertThat(history.findValuesAsText("action")).contains("ROLE_CREATED", "ROLE_UPDATED", "ROLE_PERMISSIONS_CHANGED",
                "ROLE_DEACTIVATED", "ROLE_ACTIVATED", "ROLE_DELETED");
        assertThat(history.findValuesAsText("actor_email")).containsOnly(adminEmail);
    }

    @Test
    void customRolesCanBeBasedOnOrClonedFromRolesButNeverFromSuperAdmin() throws Exception {
        JsonNode based = ok(post("/v1/admin/roles"), Map.of("name", "Senior Developer", "base_role_id", DEVELOPER_DEF), 201);
        assertThat(texts(based.path("permissions")))
                .containsExactlyElementsOf(new TreeSet<>(SystemRoleBaseline.ORGANIZATION_TEMPLATES.get(DEVELOPER_TEMPLATE)));
        assertThat(based.path("tier").asInt()).isEqualTo(6);

        JsonNode clone = ok(post("/v1/admin/roles/" + DEVELOPER_DEF + "/clone"), Map.of("new_name", "Developer Copy"), 201);
        assertThat(clone.path("slug").asText()).isEqualTo("developer-copy");
        assertThat(clone.path("tier").asInt()).isEqualTo(4);
        assertThat(clone.path("scope").asText()).isEqualTo("ORGANIZATION");

        String superAdmin = SystemRoleBaseline.SUPER_ADMIN_DEFINITION_ID.toString();
        call(post("/v1/admin/roles/" + superAdmin + "/clone"), Map.of("new_name", "Shadow Root"))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SUPER_ADMIN_PROTECTED"));
        call(post("/v1/admin/roles"), Map.of("name", "Shadow Root", "scope", "PLATFORM", "base_role_id", superAdmin))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SUPER_ADMIN_PROTECTED"));
        call(post("/v1/admin/roles"), Map.of("name", "Shadow Root", "scope", "PLATFORM",
                "permissions", List.of("platform.users.manage")))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SUPER_ADMIN_PROTECTED"));

        // Duplicate slug, tier/scope mismatch.
        call(post("/v1/admin/roles"), Map.of("name", "Developer Copy", "permissions", List.of("project.read")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_ROLE"));
        call(post("/v1/admin/roles"), Map.of("name", "Platform Thing", "tier", 1, "permissions", List.of("project.read")))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.field_errors[0].field").value("tier"));

        // Platform-scope custom roles take operator capability keys and are definition-only.
        JsonNode platform = ok(post("/v1/admin/roles"), Map.of("name", "Incident Desk", "scope", "PLATFORM", "tier", 1,
                "permissions", List.of("incidents.management:view")), 201);
        assertThat(platform.path("enforcement").asText()).isEqualTo("DEFINITION_ONLY");
        assertThat(platform.path("assignable").asBoolean()).isFalse();
        assertThat(platform.path("user_count").asLong()).isZero();
        assertThat(platform.path("rank_label").asText()).isEqualTo("#2.1");
    }

    // ---------------------------------------------------------------- system roles

    @Test
    void superAdminIsProtectedButItsDetailsCanChange() throws Exception {
        String id = SystemRoleBaseline.SUPER_ADMIN_DEFINITION_ID.toString();
        JsonNode role = ok(get("/v1/admin/roles/" + id), null, 200);
        long v = role.path("version").asLong();
        assertThat(role.path("is_protected").asBoolean()).isTrue();
        assertThat(role.path("permissions_editable").asBoolean()).isFalse();

        call(put("/v1/admin/roles/" + id + "/permissions"), Map.of("permissions", List.of("project.read"), "expected_version", v))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SUPER_ADMIN_PROTECTED"));
        call(post("/v1/admin/roles/" + id + "/toggle-active"), Map.of("expected_version", v))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SUPER_ADMIN_PROTECTED"));
        call(delete("/v1/admin/roles/" + id).param("expectedVersion", String.valueOf(v)), null)
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SUPER_ADMIN_PROTECTED"));
        call(put("/v1/admin/roles/" + id), Map.of("tier", 6, "expected_version", v))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SYSTEM_ROLE_PROTECTED"));

        JsonNode renamed = ok(put("/v1/admin/roles/" + id), Map.of("name", "Platform Super Admin", "color", "rose",
                "expected_version", v), 200);
        assertThat(renamed.path("name").asText()).isEqualTo("Platform Super Admin");
        assertThat(renamed.path("slug").asText()).isEqualTo("super-admin");
        assertThat(renamed.path("rank").asInt()).isEqualTo(1);
        assertThat(renamed.path("capability_count").asInt()).isEqualTo(renamed.path("catalog_size").asInt());
        assertThat(jdbc.queryForObject("SELECT is_active FROM platform_role_definitions WHERE id = ?::uuid", Boolean.class, id)).isTrue();
    }

    @Test
    void systemTemplatesAreEditableAndResetOrResyncToTheBaseline() throws Exception {
        JsonNode developer = ok(get("/v1/admin/roles/" + DEVELOPER_DEF), null, 200);
        long v = developer.path("version").asLong();
        call(post("/v1/admin/roles/" + DEVELOPER_DEF + "/toggle-active"), Map.of("expected_version", v))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("SYSTEM_ROLE_PROTECTED"));

        List<String> next = new ArrayList<>(SystemRoleBaseline.ORGANIZATION_TEMPLATES.get(DEVELOPER_TEMPLATE));
        next.add("audit.read");
        JsonNode edited = ok(put("/v1/admin/roles/" + DEVELOPER_DEF + "/permissions"),
                Map.of("permissions", next, "expected_version", v), 200);
        assertThat(edited.path("baseline_drift").asBoolean()).isTrue();
        assertThat(jdbc.queryForList("SELECT permission_key FROM role_permissions WHERE role_id = ?", String.class,
                DEVELOPER_TEMPLATE)).contains("audit.read");

        // Owner must keep its governance keys.
        JsonNode owner = ok(get("/v1/admin/roles/" + OWNER_DEF), null, 200);
        call(put("/v1/admin/roles/" + OWNER_DEF + "/permissions"), Map.of("permissions", List.of("project.read"),
                "expected_version", owner.path("version").asLong()))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("OWNER_KEYS_REQUIRED"));

        // Reset one role.
        stale(post("/v1/admin/roles/" + DEVELOPER_DEF + "/reset-baseline"), Map.of("expected_version", v));
        JsonNode reset = ok(post("/v1/admin/roles/" + DEVELOPER_DEF + "/reset-baseline"),
                Map.of("expected_version", v + 1), 200);
        assertThat(reset.path("baseline_drift").asBoolean()).isFalse();

        // Platform Operator: documented set stored, then re-sync restores it to the department-derived set.
        String operatorDef = SystemRoleBaseline.PLATFORM_OPERATOR_DEFINITION_ID.toString();
        JsonNode operator = ok(get("/v1/admin/roles/" + operatorDef), null, 200);
        ok(put("/v1/admin/roles/" + operatorDef + "/permissions"), Map.of("permissions",
                List.of("incidents.management:view"), "expected_version", operator.path("version").asLong()), 200);

        // Drift the developer again, then re-sync everything: every system role must be listed with its version.
        JsonNode dev2 = ok(get("/v1/admin/roles/" + DEVELOPER_DEF), null, 200);
        ok(put("/v1/admin/roles/" + DEVELOPER_DEF + "/permissions"),
                Map.of("permissions", List.of("project.read"), "expected_version", dev2.path("version").asLong()), 200);
        JsonNode roles = ok(get("/v1/admin/roles"), null, 200);
        List<Map<String, Object>> items = new ArrayList<>();
        roles.forEach(r -> {
            if (r.path("is_system").asBoolean()) {
                items.add(Map.of("id", r.path("id").asText(), "expected_version", r.path("version").asLong()));
            }
        });
        call(post("/v1/admin/roles/system/resync"), Map.of("items", items.subList(0, 3)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("items"));
        List<Map<String, Object>> staleItems = new ArrayList<>(items);
        Map<String, Object> first = new HashMap<>(staleItems.get(2));
        first.put("expected_version", 999);
        staleItems.set(2, first);
        stale(post("/v1/admin/roles/system/resync"), Map.of("items", staleItems));
        JsonNode resync = ok(post("/v1/admin/roles/system/resync"), Map.of("items", items), 200);
        assertThat(texts(resync.path("changed"))).containsExactlyInAnyOrder("platform-operator", "developer");
        for (Map.Entry<UUID, Set<String>> entry : SystemRoleBaseline.ORGANIZATION_TEMPLATES.entrySet()) {
            assertThat(new TreeSet<>(jdbc.queryForList("SELECT permission_key FROM role_permissions WHERE role_id = ?",
                    String.class, entry.getKey()))).isEqualTo(entry.getValue());
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM platform_role_permissions", Integer.class)).isZero();
        assertThat(ok(get("/v1/admin/roles/" + DEVELOPER_DEF + "/history"), null, 200).findValuesAsText("action"))
                .contains("ROLE_PERMISSIONS_CHANGED", "ROLE_RESET_TO_BASELINE");
        assertThat(ok(get("/v1/admin/roles/audit-log"), null, 200).findValuesAsText("action")).contains("SYSTEM_ROLES_RESYNCED");
    }

    @Test
    void migratedTemplatesMatchTheVersionControlledBaseline() {
        for (Map.Entry<UUID, Set<String>> entry : SystemRoleBaseline.ORGANIZATION_TEMPLATES.entrySet()) {
            assertThat(new TreeSet<>(jdbc.queryForList("SELECT permission_key FROM role_permissions WHERE role_id = ?",
                    String.class, entry.getKey()))).as("template %s", entry.getKey()).isEqualTo(entry.getValue());
        }
    }

    @Test
    void compareShowsDifferences() throws Exception {
        JsonNode cmp = ok(get("/v1/admin/roles/compare").param("ids", DEVELOPER_DEF + "," + OWNER_DEF), null, 200);
        assertThat(cmp.path("roles")).hasSize(2);
        boolean anyDiff = false;
        for (JsonNode row : cmp.path("rows")) anyDiff |= row.path("differs").asBoolean();
        assertThat(anyDiff).isTrue();
        call(get("/v1/admin/roles/compare").param("ids", DEVELOPER_DEF), null).andExpect(status().isUnprocessableEntity());
        call(get("/v1/admin/roles/compare").param("ids", DEVELOPER_DEF + "," + UUID.randomUUID()), null)
                .andExpect(status().isNotFound());
    }

    // ---------------------------------------------------------------- access, unknown ids, replay

    @Test
    void anonymousIs401NonAdminIs403AndUnknownIdsAre404() throws Exception {
        mockMvc.perform(get("/v1/admin/roles")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/v1/admin/permissions")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/v1/admin/roles/system/resync").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());

        String viewerEmail = "viewer." + UUID.randomUUID().toString().substring(0, 8) + "@prowise.test";
        user(viewerEmail, "VIEWER");
        String viewerToken = login(viewerEmail);
        for (MockHttpServletRequestBuilder request : List.of(get("/v1/admin/roles"), get("/v1/admin/permissions"),
                get("/v1/admin/roles/audit-log"), get("/v1/admin/roles/" + DEVELOPER_DEF + "/holders"))) {
            mockMvc.perform(request.header("Authorization", "Bearer " + viewerToken)).andExpect(status().isForbidden());
        }
        mockMvc.perform(put("/v1/admin/roles/" + DEVELOPER_DEF + "/permissions").header("Authorization", "Bearer " + viewerToken)
                        .contentType("application/json").content("{\"permissions\":[\"audit.read\"],\"expected_version\":0}"))
                .andExpect(status().isForbidden());

        call(get("/v1/admin/roles/" + UUID.randomUUID()), null).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("The requested resource was not found."));
        call(get("/v1/admin/roles/role-super-admin"), null).andExpect(status().isNotFound());
    }

    @Test
    void createWithTheSameIdempotencyKeyIsAppliedOnce() throws Exception {
        String body = objectMapper.writeValueAsString(Map.of("name", "Replay Role", "permissions", List.of("project.read")));
        String key = UUID.randomUUID().toString();
        mockMvc.perform(post("/v1/admin/roles").header("Authorization", "Bearer " + token).header("Idempotency-Key", key)
                .contentType("application/json").content(body)).andExpect(status().isCreated());
        mockMvc.perform(post("/v1/admin/roles").header("Authorization", "Bearer " + token).header("Idempotency-Key", key)
                .contentType("application/json").content(body)).andExpect(status().isCreated())
                .andExpect(header().string("Idempotent-Replayed", "true"));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM platform_role_definitions WHERE slug = 'replay-role'",
                Integer.class)).isEqualTo(1);
    }

    // ---------------------------------------------------------------- helpers

    private UUID user(String email, String role) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, status, must_change_password)
                VALUES (?, ?, ?, 'Governance Test', ?, 'ACTIVE', false)
                """, id, email, passwordEncoder.encode(PASSWORD), role);
        jdbc.update("INSERT INTO user_roles (user_id, role_name) VALUES (?, ?)", id, role);
        return id;
    }

    private UUID organization() {
        UUID org = UUID.randomUUID();
        jdbc.update("INSERT INTO organizations (id, name, slug, timezone) VALUES (?, ?, ?, 'UTC')", org,
                "Acme " + org.toString().substring(0, 6), "acme-" + org.toString().substring(0, 8));
        return org;
    }

    private UUID membershipWithGrant(UUID org, String email, UUID templateId, String status) {
        UUID userId = UUID.randomUUID();
        jdbc.update("INSERT INTO users (id, email, password_hash, name, status) VALUES (?, ?, 'x', ?, 'ACTIVE')",
                userId, email, email);
        UUID membership = UUID.randomUUID();
        String templateName = jdbc.queryForObject("SELECT name FROM roles WHERE id = ?", String.class, templateId);
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template, status) VALUES (?, ?, ?, ?, ?)",
                membership, org, userId, templateName, status);
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (?, ?, ?, ?, 'ORG', ?)
                """, UUID.randomUUID(), org, membership, templateId, userId);
        return userId;
    }

    private static UsernamePasswordAuthenticationToken memberAuth(UUID userId, UUID org) {
        return new UsernamePasswordAuthenticationToken(new AuthPrincipal(userId, UUID.randomUUID(), "m@acme.test", org),
                null, List.of());
    }

    private static List<String> texts(JsonNode array) {
        List<String> out = new ArrayList<>();
        array.forEach(n -> out.add(n.asText()));
        return out;
    }

    private void stale(MockHttpServletRequestBuilder request, Object body) throws Exception {
        call(request, body).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"))
                .andExpect(jsonPath("$.request_id").isNotEmpty());
    }

    private JsonNode ok(MockHttpServletRequestBuilder request, Object body, int expected) throws Exception {
        String content = call(request, body).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(content);
    }

    private ResultActions call(MockHttpServletRequestBuilder request, Object body) throws Exception {
        MockHttpServletRequestBuilder built = request.header("Authorization", "Bearer " + token);
        if (body != null) {
            built = built.contentType("application/json").content(objectMapper.writeValueAsString(body));
        }
        return mockMvc.perform(built);
    }

    private String login(String email) throws Exception {
        String ip = "198.51.100." + (++ipCounter % 250 + 1);
        String body = mockMvc.perform(post("/v1/auth/login").contentType("application/json")
                        .with(r -> { r.setRemoteAddr(ip); return r; })
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", PASSWORD))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body).path("access_token").asText();
    }

    @SuppressWarnings("unused")
    private static Map<String, Object> map(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }
}
