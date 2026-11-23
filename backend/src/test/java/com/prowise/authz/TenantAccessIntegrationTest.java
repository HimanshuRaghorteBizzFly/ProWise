package com.prowise.authz;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.servlet.http.Cookie;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.prowise.testsupport.TestAccounts;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Task 1.3 acceptance: permissions on every access path.
 * Real HTTP stack (filters, method security, services, PostgreSQL) with two organizations.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T04")
@Tag("T05")
@Tag("T06")
@Tag("AS-07")
class TenantAccessIntegrationTest {

    private static final UUID OWNER = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID ADMIN = UUID.fromString("10000000-0000-0000-0000-000000000002");
    private static final UUID PROJECT_MANAGER = UUID.fromString("10000000-0000-0000-0000-000000000003");
    private static final UUID DEVELOPER = UUID.fromString("10000000-0000-0000-0000-000000000005");
    private static final UUID VIEWER = UUID.fromString("10000000-0000-0000-0000-000000000007");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private com.prowise.identity.AccountTokenService accountTokens;

    @BeforeEach
    @AfterEach
    void cleanDatabase() {
        TestDatabase.clean(jdbc);
    }

    /* ==================================================================
     * T04: a role on project A authorizes its actions on A and none on private project B
     * ================================================================== */

    @Test
    void projectScopedGrantAuthorizesOnlyThatProject() throws Exception {
        Workspace org = workspace("acme");
        Person dev = person("dev");
        UUID membership = member(org.id(), dev.id(), "DEVELOPER");
        String projectA = project(org.id(), "Project A", dev.id());
        String projectB = project(org.id(), "Private B", dev.id());
        grant(org.id(), membership, DEVELOPER, "PROJECT", UUID.fromString(projectA), org.ownerId());
        String taskA = task(org.id(), projectA, dev.id(), "Task on A");
        String taskB = task(org.id(), projectB, dev.id(), "Task on B");
        String token = switchTo(dev.token(), org.id());

        mockMvc.perform(withToken(patch("/v1/developer/tasks/{id}/status", taskA), token)
                        .contentType("application/json").content("{\"state\":\"IN_PROGRESS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("IN_PROGRESS"));

        mockMvc.perform(withToken(patch("/v1/developer/tasks/{id}/status", taskB), token)
                        .contentType("application/json").content("{\"state\":\"DONE\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        assertThat(jdbc.queryForObject("SELECT state FROM work_items WHERE id = ?", String.class, taskB)).isEqualTo("TODO");

        mockMvc.perform(withToken(get("/v1/developer/projects/{id}", projectB), token)).andExpect(status().isNotFound());
        mockMvc.perform(withToken(get("/v1/developer/projects/{id}", projectA), token)).andExpect(status().isOk());

        JsonNode projects = json(mockMvc.perform(withToken(get("/v1/developer/projects"), token))
                .andExpect(status().isOk()).andReturn());
        assertThat(projects.findValuesAsText("id")).containsExactly(projectA);

        // The scoped grant is reported with its scope, and grants no ORG-wide key.
        mockMvc.perform(withToken(get("/v1/me/permissions").param("org", org.id().toString()), token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.permissions").isEmpty())
                .andExpect(jsonPath("$.grants[?(@.key == 'task.update')].scope").value("PROJECT"))
                .andExpect(jsonPath("$.grants[?(@.key == 'task.update')].scope_id").value(projectA));
    }

    /* ==================================================================
     * T05 + AS-07: guessed foreign task, file and notification IDs fail without disclosure
     * ================================================================== */

    @Test
    void foreignIdsFailWithoutDisclosingExistenceAndAreRecorded() throws Exception {
        Workspace orgA = workspace("org-a");
        Workspace orgB = workspace("org-b");
        String projectB = project(orgB.id(), "Secret Merger Project", orgB.ownerId());
        String taskB = task(orgB.id(), projectB, orgB.ownerId(), "Confidential task title");
        String fileB = file(orgB.id(), projectB, "board-minutes.pdf");
        String notificationB = notification(orgB.id(), orgB.ownerId(), "Private alert");
        String tokenA = switchTo(orgA.ownerToken(), orgA.id());

        // Reads and writes on foreign IDs: the same 404 as an ID that never existed.
        String foreign = body(mockMvc.perform(withToken(get("/v1/developer/tasks/{id}/comments", taskB), tokenA))
                .andExpect(status().isNotFound()).andReturn());
        String unknown = body(mockMvc.perform(withToken(get("/v1/developer/tasks/{id}/comments", "task-does-not-exist"), tokenA))
                .andExpect(status().isNotFound()).andReturn());
        assertThat(withoutRequestId(foreign)).isEqualTo(withoutRequestId(unknown));
        assertThat(foreign).doesNotContain(taskB, projectB, "Confidential", "Secret", orgB.id().toString());

        mockMvc.perform(withToken(patch("/v1/developer/tasks/{id}/status", taskB), tokenA)
                        .contentType("application/json").content("{\"state\":\"DONE\"}"))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT state FROM work_items WHERE id = ?", String.class, taskB)).isEqualTo("TODO");

        mockMvc.perform(withToken(get("/v1/developer/files").param("projectId", projectB), tokenA))
                .andExpect(status().isNotFound());
        mockMvc.perform(withToken(post("/v1/developer/files"), tokenA).contentType("application/json")
                        .content("{\"projectId\":\"" + projectB + "\",\"fileName\":\"x.txt\"}"))
                .andExpect(status().isNotFound());
        String files = body(mockMvc.perform(withToken(get("/v1/developer/files"), tokenA)).andExpect(status().isOk()).andReturn());
        assertThat(files).doesNotContain(fileB, "board-minutes");

        mockMvc.perform(withToken(patch("/v1/developer/notifications/{id}/read", notificationB), tokenA))
                .andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("SELECT read FROM developer_notifications WHERE id = ?", Boolean.class, notificationB)).isFalse();
        String notifications = body(mockMvc.perform(withToken(get("/v1/developer/notifications"), tokenA))
                .andExpect(status().isOk()).andReturn());
        assertThat(notifications).doesNotContain("Private alert");

        String reports = body(mockMvc.perform(withToken(get("/v1/developer/reports/summary"), tokenA))
                .andExpect(status().isOk()).andReturn());
        assertThat(reports).doesNotContain(projectB, "Secret Merger");
        // TODO(5.5): no export download exists yet; exports must reauthorize at download time (permissions.md).

        // AS-07: the denied attempts are in A's restricted evidence, attributed to the actor, without B's data.
        List<Map<String, Object>> evidence = jdbc.queryForList(
                "SELECT org_id, actor_id, event_type, target_type, target_ref FROM security_evidence ORDER BY occurred_at");
        assertThat(evidence).isNotEmpty();
        assertThat(evidence).allSatisfy(row -> {
            assertThat(row.get("org_id")).isEqualTo(orgA.id());
            assertThat(row.get("actor_id")).isEqualTo(orgA.ownerId());
        });
        assertThat(evidence).extracting(row -> row.get("target_ref")).contains(taskB, projectB, notificationB);
        assertThat(evidence).extracting(row -> row.get("event_type")).containsOnly("ACCESS_DENIED");

        // Evidence is append-only.
        assertThatThrownBy(() -> jdbc.update("UPDATE security_evidence SET reason = 'changed'"))
                .hasMessageContaining("append-only");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM security_evidence")).hasMessageContaining("append-only");
    }

    @Test
    void foreignOrganizationIsNotFoundButMissingPermissionIsForbidden() throws Exception {
        Workspace orgA = workspace("alpha");
        Workspace orgB = workspace("beta");
        String tokenA = switchTo(orgA.ownerToken(), orgA.id());

        mockMvc.perform(withToken(get("/v1/organizations/{org}/roles", orgB.id()), tokenA))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.field_errors").isArray());
        mockMvc.perform(withToken(get("/v1/me/permissions").param("org", orgB.id().toString()), tokenA))
                .andExpect(status().isNotFound());

        Person viewer = person("viewer");
        grant(orgA.id(), member(orgA.id(), viewer.id(), "VIEWER"), VIEWER, "ORG", null, orgA.ownerId());
        String viewerToken = switchTo(viewer.token(), orgA.id());
        mockMvc.perform(withToken(get("/v1/organizations/{org}/roles", orgA.id()), viewerToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // A valid token that is not bound to the organization is also 404 (the owner signs in again, no switch).
        mockMvc.perform(withToken(get("/v1/organizations/{org}/roles", orgA.id()), signin(orgA.ownerEmail())))
                .andExpect(status().isNotFound());
        // The token the owner used before switching was revoked by the switch.
        mockMvc.perform(withToken(get("/v1/organizations/{org}/roles", orgA.id()), orgA.ownerToken()))
                .andExpect(status().isUnauthorized());
    }

    /* ==================================================================
     * T06: switching organizations reauthorizes tokens, counts and links
     * ================================================================== */

    @Test
    void refreshedTokenForOrganizationAStaysBoundToAAndCannotOpenB() throws Exception {
        Workspace orgA = workspace("refresh-a");
        Workspace orgB = workspace("refresh-b");
        notification(orgA.id(), orgA.ownerId(), "Alert in A");

        MvcResult switched = mockMvc.perform(withToken(post("/v1/me/organizations/{org}/switch", orgA.id()), orgA.ownerToken()))
                .andExpect(status().isOk()).andReturn();
        Cookie refresh = switched.getResponse().getCookie("prowise_refresh_token");
        assertThat(refresh).isNotNull();

        MvcResult refreshed = mockMvc.perform(post("/v1/auth/refresh").cookie(refresh)).andExpect(status().isOk()).andReturn();
        String token = json(refreshed).path("access_token").asText();

        // Still bound to A: A's data is reachable, without selecting the organization again.
        mockMvc.perform(withToken(get("/v1/organizations/{org}/roles", orgA.id()), token)).andExpect(status().isOk());
        mockMvc.perform(withToken(get("/v1/developer/dashboard"), token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread_notifications_count").value(1));
        // B stays closed: no data, no existence signal, and no switch without a membership.
        mockMvc.perform(withToken(get("/v1/organizations/{org}/roles", orgB.id()), token)).andExpect(status().isNotFound());
        mockMvc.perform(withToken(get("/v1/me/permissions").param("org", orgB.id().toString()), token))
                .andExpect(status().isNotFound());
        mockMvc.perform(withToken(post("/v1/me/organizations/{org}/switch", orgB.id()), token))
                .andExpect(status().isNotFound());

        // Once the membership in A is disabled, a refresh no longer carries the binding to A.
        jdbc.update("UPDATE memberships SET status = 'DISABLED' WHERE org_id = ? AND user_id = ?", orgA.id(), orgA.ownerId());
        Cookie next = refreshed.getResponse().getCookie("prowise_refresh_token");
        assertThat(next).isNotNull();
        String unbound = json(mockMvc.perform(post("/v1/auth/refresh").cookie(next)).andExpect(status().isOk()).andReturn())
                .path("access_token").asText();
        mockMvc.perform(withToken(get("/v1/organizations/{org}/roles", orgA.id()), unbound)).andExpect(status().isNotFound());
    }

    @Test
    void switchingOrganizationInvalidatesTheOldTokenAndItsData() throws Exception {
        Workspace orgA = workspace("first");
        String orgB = createOrganization(orgA.ownerToken(), "second");
        UUID orgBId = UUID.fromString(orgB);
        notification(orgA.id(), orgA.ownerId(), "Alert in A");
        notification(orgA.id(), orgA.ownerId(), "Second alert in A");
        notification(orgBId, orgA.ownerId(), "Alert in B");

        String tokenA = switchTo(orgA.ownerToken(), orgA.id());
        mockMvc.perform(withToken(get("/v1/developer/dashboard"), tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread_notifications_count").value(2));

        MvcResult switched = mockMvc.perform(withToken(post("/v1/me/organizations/{org}/switch", orgBId), tokenA))
                .andExpect(status().isOk()).andReturn();
        String tokenB = json(switched).path("access_token").asText();
        Cookie refresh = switched.getResponse().getCookie("prowise_refresh_token");
        assertThat(refresh).isNotNull();

        // The previous organization's token stops working on its next request.
        mockMvc.perform(withToken(get("/v1/developer/notifications"), tokenA)).andExpect(status().isUnauthorized());

        // Counts, lists and links now come from B only; A is unreachable with B's token.
        mockMvc.perform(withToken(get("/v1/developer/dashboard"), tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unread_notifications_count").value(1));
        String listB = body(mockMvc.perform(withToken(get("/v1/developer/notifications"), tokenB)).andReturn());
        assertThat(listB).contains("Alert in B").doesNotContain("Alert in A");
        mockMvc.perform(withToken(get("/v1/organizations/{org}/roles", orgA.id()), tokenB)).andExpect(status().isNotFound());
        mockMvc.perform(withToken(get("/v1/me/permissions").param("org", orgA.id().toString()), tokenB))
                .andExpect(status().isNotFound());

        // Refreshing keeps the binding to B.
        String refreshed = json(mockMvc.perform(post("/v1/auth/refresh").cookie(refresh)).andExpect(status().isOk()).andReturn())
                .path("access_token").asText();
        mockMvc.perform(withToken(get("/v1/me/permissions").param("org", orgB), refreshed)).andExpect(status().isOk());
        mockMvc.perform(withToken(get("/v1/organizations/{org}/roles", orgA.id()), refreshed)).andExpect(status().isNotFound());

        // A workspace the caller is not a member of cannot be selected.
        Workspace stranger = workspace("stranger");
        mockMvc.perform(withToken(post("/v1/me/organizations/{org}/switch", stranger.id()), refreshed))
                .andExpect(status().isNotFound());
    }

    @Test
    void disabledMembershipIsDeniedOnTheNextRequest() throws Exception {
        Workspace org = workspace("gamma");
        Person dev = person("leaver");
        UUID membership = member(org.id(), dev.id(), "DEVELOPER");
        grant(org.id(), membership, DEVELOPER, "ORG", null, org.ownerId());
        String token = switchTo(dev.token(), org.id());
        mockMvc.perform(withToken(get("/v1/developer/notifications"), token)).andExpect(status().isOk());

        jdbc.update("UPDATE memberships SET status = 'DISABLED' WHERE id = ?", membership);

        mockMvc.perform(withToken(get("/v1/developer/notifications"), token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        // A fresh sign-in cannot select the workspace again either.
        mockMvc.perform(withToken(post("/v1/me/organizations/{org}/switch", org.id()), signin(dev.email())))
                .andExpect(status().isNotFound());
    }

    /* ==================================================================
     * Least privilege and self-elevation
     * ================================================================== */

    @Test
    void selfElevationAndGrantingBeyondOwnPowerAreRefused() throws Exception {
        Workspace org = workspace("delta");
        Person admin = person("admin");
        UUID adminMembership = member(org.id(), admin.id(), "ORGANIZATION_ADMIN");
        grant(org.id(), adminMembership, ADMIN, "ORG", null, org.ownerId());
        Person dev = person("someone");
        UUID devMembership = member(org.id(), dev.id(), "DEVELOPER");
        String token = switchTo(admin.token(), org.id());
        String grants = "/v1/organizations/" + org.id() + "/grants";

        // Self-elevation: Project Manager holds project.edit, which the admin does not hold.
        mockMvc.perform(withToken(post(grants), token).contentType("application/json")
                        .content(grantBody(adminMembership, PROJECT_MANAGER)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SELF_ELEVATION_DENIED"));
        // Granting others more than the admin holds.
        mockMvc.perform(withToken(post(grants), token).contentType("application/json")
                        .content(grantBody(devMembership, DEVELOPER)))
                .andExpect(status().isForbidden());
        // The owner role never moves through a grant.
        mockMvc.perform(withToken(post(grants), token).contentType("application/json")
                        .content(grantBody(devMembership, OWNER)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("OWNER_TRANSFER_REQUIRED"));
        // A role within the admin's own power is fine.
        mockMvc.perform(withToken(post(grants), token).contentType("application/json")
                        .content(grantBody(devMembership, VIEWER)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role_name").value("VIEWER"));

        // Custom roles: creating one above own power fails; editing an own role to gain keys is self-elevation.
        String roles = "/v1/organizations/" + org.id() + "/roles";
        mockMvc.perform(withToken(post(roles), token).contentType("application/json")
                        .content("{\"name\":\"Shadow PM\",\"permission_keys\":[\"project.edit\"],\"expected_version\":0}"))
                .andExpect(status().isForbidden());
        JsonNode auditor = json(mockMvc.perform(withToken(post(roles), token).contentType("application/json")
                        .content("{\"name\":\"Auditor\",\"permission_keys\":[\"audit.read\"],\"expected_version\":0}"))
                .andExpect(status().isCreated()).andReturn());
        String auditorId = auditor.path("id").asText();
        mockMvc.perform(withToken(post(grants), token).contentType("application/json")
                        .content("{\"membership_id\":\"" + adminMembership + "\",\"org_role_id\":\"" + auditorId + "\",\"scope\":\"ORG\"}"))
                .andExpect(status().isCreated());
        mockMvc.perform(withToken(patch(roles + "/" + auditorId), token).contentType("application/json")
                        .content("{\"name\":\"Auditor\",\"permission_keys\":[\"audit.read\",\"project.edit\"],\"expected_version\":0}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("SELF_ELEVATION_DENIED"));
        assertThat(jdbc.queryForList("SELECT permission_key FROM role_permissions WHERE role_id = ?::uuid", String.class, auditorId))
                .containsExactly("audit.read");

        // The owner's grant cannot be revoked by an admin.
        Map<String, Object> ownerGrant = jdbc.queryForMap(
                "SELECT id, version FROM grants WHERE org_id = ? AND template_role_id = ?", org.id(), OWNER);
        mockMvc.perform(withToken(delete(grants + "/" + ownerGrant.get("id")), token)
                        .param("expectedVersion", ownerGrant.get("version").toString()))
                .andExpect(status().isForbidden());

        assertThat(jdbc.queryForList("SELECT event_type FROM security_evidence", String.class))
                .contains("SELF_ELEVATION_DENIED", "PRIVILEGE_ESCALATION_DENIED");
    }

    @Test
    void projectGrantMustTargetAProjectOfThisOrganization() throws Exception {
        Workspace orgA = workspace("east");
        Workspace orgB = workspace("west");
        String foreignProject = project(orgB.id(), "West project", orgB.ownerId());
        Person dev = person("dev2");
        UUID membership = member(orgA.id(), dev.id(), "DEVELOPER");
        String token = switchTo(orgA.ownerToken(), orgA.id());

        mockMvc.perform(withToken(post("/v1/organizations/{org}/grants", orgA.id()), token).contentType("application/json")
                        .content("{\"membership_id\":\"" + membership + "\",\"template_role_id\":\"" + VIEWER
                                + "\",\"scope\":\"PROJECT\",\"scope_id\":\"" + foreignProject + "\"}"))
                .andExpect(status().isNotFound());
    }

    @Test
    void databaseRejectsAGrantThatUsesAnotherOrganizationsCustomRole() throws Exception {
        Workspace orgA = workspace("north");
        Workspace orgB = workspace("south");
        UUID roleB = UUID.randomUUID();
        jdbc.update("INSERT INTO roles (id, org_id, name, is_template) VALUES (?, ?, 'B only', FALSE)", roleB, orgB.id());
        UUID membershipA = jdbc.queryForObject("SELECT id FROM memberships WHERE org_id = ?", UUID.class, orgA.id());

        assertThatThrownBy(() -> jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, org_role_id, scope, granted_by)
                VALUES (?, ?, ?, ?, 'ORG', ?)
                """, UUID.randomUUID(), orgA.id(), membershipA, roleB, orgA.ownerId()))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("fk_grants_org_role_org");
    }

    @Test
    void platformRoutesRefuseTenantUsers() throws Exception {
        Workspace org = workspace("tenant");
        String token = switchTo(org.ownerToken(), org.id());
        mockMvc.perform(withToken(get("/v1/admin/plans"), token)).andExpect(status().isForbidden());
        mockMvc.perform(withToken(get("/v1/admin/subscriptions"), token)).andExpect(status().isForbidden());
    }

    /* ==================================================================
     * Fixtures
     * ================================================================== */

    record Person(UUID id, String email, String token) {}

    record Workspace(UUID id, UUID ownerId, String ownerEmail, String ownerToken) {}

    private Person person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        // Signup now returns 202 without a session (D9); verify through the real endpoint, then sign in.
        TestAccounts.Account account = TestAccounts.signUpVerifyAndLogin(
                mockMvc, jdbc, accountTokens, objectMapper, email, "correct-horse-battery");
        return new Person(account.id(), email, account.accessToken());
    }

    private Workspace workspace(String slug) throws Exception {
        Person owner = person(slug + "-owner");
        String id = createOrganization(owner.token(), slug);
        return new Workspace(UUID.fromString(id), owner.id(), owner.email(), owner.token());
    }

    private String createOrganization(String token, String slug) throws Exception {
        String unique = slug + "-" + UUID.randomUUID().toString().substring(0, 6);
        return json(mockMvc.perform(withToken(post("/v1/organizations"), token).contentType("application/json")
                        .content("{\"name\":\"" + unique + "\",\"slug\":\"" + unique + "\",\"timezone\":\"Europe/London\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn()).path("id").asText();
    }

    private String switchTo(String token, UUID orgId) throws Exception {
        return json(mockMvc.perform(withToken(post("/v1/me/organizations/{org}/switch", orgId), token))
                .andExpect(status().isOk()).andReturn()).path("access_token").asText();
    }

    /** A fresh session that is not bound to any organization. */
    private String signin(String email) throws Exception {
        return json(mockMvc.perform(post("/v1/auth/signin").contentType("application/json")
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\"}"))
                .andExpect(status().isOk()).andReturn()).path("access_token").asText();
    }

    private UUID member(UUID orgId, UUID userId, String template) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, orgId, userId, template);
        return id;
    }

    private void grant(UUID orgId, UUID membershipId, UUID templateRoleId, String scope, UUID scopeId, UUID grantedBy) {
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, scope_id, granted_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), orgId, membershipId, templateRoleId, scope, scopeId, grantedBy);
    }

    private String project(UUID orgId, String name, UUID member) {
        String id = UUID.randomUUID().toString();
        jdbc.update("""
                INSERT INTO projects (id, org_id, key, name, mode, member_ids, accountable_owner_id)
                VALUES (?, ?, ?, ?, 'STRUCTURED', ?, ?)
                """, id, orgId, "K" + id.substring(0, 6), name, member.toString(), member.toString());
        return id;
    }

    private String task(UUID orgId, String projectId, UUID assignee, String title) {
        String id = "task-" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO work_items (id, project_id, org_id, key, title, primary_assignee_id, state)
                VALUES (?, ?, ?, ?, ?, ?, 'TODO')
                """, id, projectId, orgId, id.toUpperCase(), title, assignee.toString());
        return id;
    }

    private String file(UUID orgId, String projectId, String name) {
        String id = "file-" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO file_metadata (id, org_id, project_id, uploaded_by, file_name, file_size, file_type, storage_path)
                VALUES (?, ?, ?, 'someone', ?, 10, 'application/pdf', '/files/x')
                """, id, orgId, projectId, name);
        return id;
    }

    private String notification(UUID orgId, UUID userId, String title) {
        String id = "notif-" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO developer_notifications (id, org_id, user_id, category, title, message)
                VALUES (?, ?, ?, 'ASSIGNMENT', ?, 'details')
                """, id, orgId, userId.toString(), title);
        return id;
    }

    private static String grantBody(UUID membershipId, UUID templateRoleId) {
        return "{\"membership_id\":\"" + membershipId + "\",\"template_role_id\":\"" + templateRoleId + "\",\"scope\":\"ORG\"}";
    }

    private static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder builder, String token) {
        return builder.header("Authorization", "Bearer " + token);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private static String body(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString();
    }

    private static String withoutRequestId(String body) {
        return body.replaceAll("\"request_id\":\"[^\"]*\"", "");
    }
}
