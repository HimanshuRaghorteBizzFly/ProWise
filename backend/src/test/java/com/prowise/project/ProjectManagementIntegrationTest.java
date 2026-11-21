package com.prowise.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;

@SpringBootTest
@AutoConfigureMockMvc
@Tag("T09")
@Tag("T11")
class ProjectManagementIntegrationTest {

    private static final UUID OWNER_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID DEVELOPER_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000005");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    @AfterEach
    void cleanDatabase() {
        TestDatabase.clean(jdbc);
        jdbc.execute("DELETE FROM outbox_event");
        jdbc.execute("DELETE FROM audit_log");
        jdbc.execute("DELETE FROM project_members");
        jdbc.execute("DELETE FROM project_date_history");
        jdbc.execute("DELETE FROM project_ownership_history");
        jdbc.execute("DELETE FROM projects");
    }

    private record Person(UUID id, String email, String token) {}
    private record Workspace(UUID id, UUID ownerId, String ownerEmail, String ownerToken) {}

    private Person person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        MvcResult res = mockMvc.perform(post("/v1/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + email + "\",\"password\":\"correct-horse-battery\"}"))
                .andExpect(status().isCreated()).andReturn();
        JsonNode signup = json(res);
        UUID id = jdbc.queryForObject("SELECT id FROM users WHERE lower(email) = lower(?)", UUID.class, email);
        return new Person(id, email, signup.path("access_token").asText());
    }

    private Workspace workspace(String slug) throws Exception {
        Person owner = person(slug + "-owner");
        String unique = slug + "-" + UUID.randomUUID().toString().substring(0, 6);
        MvcResult res = mockMvc.perform(withToken(post("/v1/organizations"), owner.token())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"" + unique + "\",\"slug\":\"" + unique + "\",\"timezone\":\"Europe/London\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn();
        String orgIdStr = json(res).path("id").asText();
        UUID orgId = UUID.fromString(orgIdStr);
        String switchedToken = switchTo(owner.token(), orgId);
        return new Workspace(orgId, owner.id(), owner.email(), switchedToken);
    }

    private String switchTo(String token, UUID orgId) throws Exception {
        return json(mockMvc.perform(withToken(post("/v1/me/organizations/{org}/switch", orgId), token))
                .andExpect(status().isOk()).andReturn()).path("access_token").asText();
    }

    private UUID member(UUID orgId, UUID userId, String template) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, orgId, userId, template);
        return id;
    }

    private static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder builder, String token) {
        return builder.header("Authorization", "Bearer " + token);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    /* ==================================================================
     * T09: Create Project with required fields and unique project key
     * ================================================================== */

    @Test
    @DisplayName("T09: Create project with valid fields succeeds and creates audit log and outbox event")
    void testCreateProjectSuccess() throws Exception {
        Workspace ws = workspace("alpha");
        Instant now = Instant.now();
        Instant target = now.plus(30, ChronoUnit.DAYS);

        String payload = """
                {
                    "name": "Alpha Platform",
                    "key": "ALPHA",
                    "description": "Core platform architecture",
                    "mode": "STRUCTURED",
                    "priority": "HIGH",
                    "lifecycle": "ACTIVE",
                    "startDate": "%s",
                    "targetDate": "%s",
                    "timezone": "America/New_York"
                }
                """.formatted(now.toString(), target.toString());

        MvcResult result = mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws.id()), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value("ALPHA"))
                .andExpect(jsonPath("$.name").value("Alpha Platform"))
                .andExpect(jsonPath("$.mode").value("STRUCTURED"))
                .andExpect(jsonPath("$.priority").value("HIGH"))
                .andExpect(jsonPath("$.last_progress_percent").value(0))
                .andExpect(jsonPath("$.health").value("ON_TRACK"))
                .andExpect(jsonPath("$.archived").value(false))
                .andReturn();

        String projectId = json(result).path("id").asText();
        assertThat(projectId).isNotEmpty();

        // Verify audit log row exists
        Integer auditCount = jdbc.queryForObject(
                "SELECT count(*) FROM audit_log WHERE org_id = ? AND action = 'project.create'",
                Integer.class, ws.id());
        assertThat(auditCount).isGreaterThanOrEqualTo(1);

        // Verify outbox event row exists
        Integer outboxCount = jdbc.queryForObject(
                "SELECT count(*) FROM outbox_event WHERE org_id = ? AND event_type = 'ProjectCreated'",
                Integer.class, ws.id());
        assertThat(outboxCount).isGreaterThanOrEqualTo(1);
    }

    @Test
    @DisplayName("T09: Duplicate project key in the same organization is rejected with 409 CONFLICT")
    void testDuplicateKeyInSameOrgRejected() throws Exception {
        Workspace ws = workspace("dupe-test");

        String payload1 = """
                {
                    "name": "Project First",
                    "key": "PRJ1",
                    "mode": "STRUCTURED"
                }
                """;

        mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws.id()), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload1))
                .andExpect(status().isCreated());

        String payload2 = """
                {
                    "name": "Project Duplicate Key",
                    "key": "PRJ1",
                    "mode": "STRUCTURED"
                }
                """;

        mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws.id()), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload2))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_KEY"));
    }

    @Test
    @DisplayName("T09: Same project key is permitted in two different organizations")
    void testSameKeyInDifferentOrgsAllowed() throws Exception {
        Workspace ws1 = workspace("org-one");
        Workspace ws2 = workspace("org-two");

        String payload = """
                {
                    "name": "Shared Key Project",
                    "key": "SHARED",
                    "mode": "STRUCTURED"
                }
                """;

        mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws1.id()), ws1.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value("SHARED"));

        mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws2.id()), ws2.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.key").value("SHARED"));
    }

    @Test
    @DisplayName("T09: Invalid date range (target date earlier than start date) is rejected with 400")
    void testInvalidDateRangeRejected() throws Exception {
        Workspace ws = workspace("dates-test");
        Instant start = Instant.now();
        Instant invalidTarget = start.minus(5, ChronoUnit.DAYS);

        String payload = """
                {
                    "name": "Time Traveler Project",
                    "key": "TIMETR",
                    "startDate": "%s",
                    "targetDate": "%s"
                }
                """.formatted(start.toString(), invalidTarget.toString());

        mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws.id()), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_DATE_RANGE"));
    }

    @Test
    @DisplayName("T09: Foreign owner or member (from another org or non-existent) is rejected with 400")
    void testForeignOwnerRejected() throws Exception {
        Workspace wsA = workspace("org-a");
        Workspace wsB = workspace("org-b");

        // Use Org B's owner ID as accountable developer in Org A
        String payload = """
                {
                    "name": "Cross Tenant Project",
                    "key": "XTEN",
                    "accountableDeveloperId": "%s"
                }
                """.formatted(wsB.ownerId().toString());

        mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", wsA.id()), wsA.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("FOREIGN_OWNER"));
    }

    /* ==================================================================
     * T11: Individual project without tasks & zero fake progress
     * ================================================================== */

    @Test
    @DisplayName("T11: Individual mode project has zero tasks and no invented percentage")
    void testIndividualProjectZeroTasksAndZeroProgress() throws Exception {
        Workspace ws = workspace("solo-org");

        String payload = """
                {
                    "name": "Solo Developer Project",
                    "key": "SOLO1",
                    "mode": "INDIVIDUAL",
                    "priority": "MEDIUM"
                }
                """;

        MvcResult result = mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws.id()), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mode").value("INDIVIDUAL"))
                .andExpect(jsonPath("$.last_progress_percent").value(0))
                .andReturn();

        String projectId = json(result).path("id").asText();

        // T11 guarantee: exactly ZERO tasks in database
        Integer taskCount = jdbc.queryForObject(
                "SELECT count(*) FROM work_items WHERE project_id = ?",
                Integer.class, projectId);
        assertThat(taskCount).isEqualTo(0);

        // Accountable developer defaulted or set to valid org member
        String accDev = json(result).path("accountable_developer_id").asText();
        assertThat(accDev).isNotEmpty();
    }

    /* ==================================================================
     * Target Date History, Versioning & Concurrency Control
     * ================================================================== */

    @Test
    @DisplayName("Deadline change requires reason and is tracked in project_date_history")
    void testTargetDateChangeRequiresReason() throws Exception {
        Workspace ws = workspace("deadline-org");
        Instant now = Instant.now();
        Instant target1 = now.plus(10, ChronoUnit.DAYS);
        Instant target2 = now.plus(20, ChronoUnit.DAYS);

        String createPayload = """
                {
                    "name": "Deadline Project",
                    "key": "DEADL",
                    "startDate": "%s",
                    "targetDate": "%s"
                }
                """.formatted(now.toString(), target1.toString());

        MvcResult createRes = mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws.id()), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createPayload))
                .andExpect(status().isCreated()).andReturn();

        String projectId = json(createRes).path("id").asText();
        long version = json(createRes).path("version").asLong();

        // 1. Changing targetDate without reason is rejected
        String noReasonPayload = """
                {
                    "targetDate": "%s",
                    "expectedVersion": %d
                }
                """.formatted(target2.toString(), version);

        mockMvc.perform(withToken(patch("/v1/projects/{id}", projectId), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(noReasonPayload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("MISSING_DEADLINE_REASON"));

        // 2. Changing targetDate with reason succeeds and records history
        String withReasonPayload = """
                {
                    "targetDate": "%s",
                    "targetDateReason": "Scope increase requested by client",
                    "expectedVersion": %d
                }
                """.formatted(target2.toString(), version);

        mockMvc.perform(withToken(patch("/v1/projects/{id}", projectId), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(withReasonPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date_history[0].reason").value("Scope increase requested by client"));

        // Verify history table in PostgreSQL
        List<Map<String, Object>> histories = jdbc.queryForList(
                "SELECT reason FROM project_date_history WHERE project_id = ?", projectId);
        assertThat(histories).hasSize(1);
        assertThat(histories.get(0).get("reason")).isEqualTo("Scope increase requested by client");
    }

    @Test
    @DisplayName("Optimistic locking rejects stale expectedVersion with 409 STALE_VERSION")
    void testOptimisticLockingStaleVersion() throws Exception {
        Workspace ws = workspace("lock-org");

        MvcResult createRes = mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws.id()), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Locking Project\",\"key\":\"LOCKP\"}"))
                .andExpect(status().isCreated()).andReturn();

        String projectId = json(createRes).path("id").asText();
        long version = json(createRes).path("version").asLong();

        // Concurrent/Stale update with incorrect version
        String stalePayload = """
                {
                    "name": "Updated Title",
                    "expectedVersion": %d
                }
                """.formatted(version + 99);

        mockMvc.perform(withToken(patch("/v1/projects/{id}", projectId), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(stalePayload))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STALE_VERSION"));
    }

    @Test
    @DisplayName("Archived project rejects updates with 409 PROJECT_ARCHIVED until restored")
    void testArchivedProjectRejectsEdits() throws Exception {
        Workspace ws = workspace("archive-org");

        MvcResult createRes = mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws.id()), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Archivable Project\",\"key\":\"ARCHP\"}"))
                .andExpect(status().isCreated()).andReturn();

        String projectId = json(createRes).path("id").asText();
        long version = json(createRes).path("version").asLong();

        // Archive the project
        mockMvc.perform(withToken(post("/v1/projects/{id}/archive", projectId), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":" + version + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(true));

        // Attempting to edit an archived project fails with 409
        mockMvc.perform(withToken(patch("/v1/projects/{id}", projectId), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"New Name After Archive\",\"expectedVersion\":" + (version + 1) + "}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROJECT_ARCHIVED"));

        // Restore the project
        mockMvc.perform(withToken(post("/v1/projects/{id}/restore", projectId), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":" + (version + 1) + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(false));

        // Now editing succeeds
        mockMvc.perform(withToken(patch("/v1/projects/{id}", projectId), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Active Name Again\",\"expectedVersion\":" + (version + 2) + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Active Name Again"));
    }

    /* ==================================================================
     * Multi-tenancy & Security Isolation
     * ================================================================== */

    @Test
    @DisplayName("Foreign org access returns 404 and writes security evidence without disclosing project")
    void testTenantIsolationCrossOrg404() throws Exception {
        Workspace wsA = workspace("tenant-a");
        Workspace wsB = workspace("tenant-b");

        MvcResult createRes = mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", wsA.id()), wsA.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Confidential Project A\",\"key\":\"SECA\"}"))
                .andExpect(status().isCreated()).andReturn();

        String projectA = json(createRes).path("id").asText();

        // wsB's owner attempts to read wsA's project
        mockMvc.perform(withToken(get("/v1/projects/{id}", projectA), wsB.ownerToken()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        // Security evidence recorded against tenant B for denied access
        Integer deniedCount = jdbc.queryForObject(
                "SELECT count(*) FROM security_evidence WHERE org_id = ? AND target_ref = ?",
                Integer.class, wsB.id(), projectA);
        assertThat(deniedCount).isGreaterThanOrEqualTo(1);
    }

    @Test
    @DisplayName("Manage project members: add, list, and remove project members")
    void testProjectMemberManagement() throws Exception {
        Workspace ws = workspace("members-org");
        Person dev = person("dev1");
        UUID membershipId = member(ws.id(), dev.id(), "DEVELOPER");

        MvcResult createRes = mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws.id()), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Team Project\",\"key\":\"TEAM1\"}"))
                .andExpect(status().isCreated()).andReturn();

        String projectId = json(createRes).path("id").asText();

        // 1. Add member
        String addMemberPayload = """
                {
                    "membershipId": "%s",
                    "role": "DEVELOPER"
                }
                """.formatted(membershipId.toString());

        mockMvc.perform(withToken(post("/v1/projects/{id}/members", projectId), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(addMemberPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.membership_id").value(membershipId.toString()))
                .andExpect(jsonPath("$.role").value("DEVELOPER"));

        // 2. List members
        mockMvc.perform(withToken(get("/v1/projects/{id}/members", projectId), ws.ownerToken()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.membership_id == '" + membershipId.toString() + "')].role").value("DEVELOPER"));

        // 3. Remove member
        mockMvc.perform(withToken(delete("/v1/projects/{id}/members/{membershipId}", projectId, membershipId), ws.ownerToken()))
                .andExpect(status().isNoContent());

        // Verify removed from project_members table
        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM project_members WHERE project_id = ? AND membership_id = ?",
                Integer.class, projectId, membershipId);
        assertThat(count).isEqualTo(0);
    }
}
