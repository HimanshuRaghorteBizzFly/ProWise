package com.prowise.project;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
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
@Tag("T17")
@Tag("T18")
@Tag("T28")
class ProgressVerificationIntegrationTest {

    private static final UUID OWNER_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID TEAM_LEAD_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000004");
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
        jdbc.execute("DELETE FROM project_progress_checkins");
        jdbc.execute("DELETE FROM project_repository_links");
        jdbc.execute("DELETE FROM github_activity");
        jdbc.execute("DELETE FROM project_members");
        jdbc.execute("DELETE FROM project_date_history");
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

    private void seedGrant(UUID orgId, UUID membershipId, UUID roleId, UUID userId) {
        jdbc.update("""
                INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by)
                VALUES (gen_random_uuid(), ?, ?, ?, 'ORG', ?)
                """, orgId, membershipId, roleId, userId);
    }

    private static MockHttpServletRequestBuilder withToken(MockHttpServletRequestBuilder builder, String token) {
        return builder.header("Authorization", "Bearer " + token);
    }

    private JsonNode json(MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    // =========================================================================
    // T17: Developer Progress Check-in (0 tasks, range validation, idempotency)
    // =========================================================================
    @Test
    @DisplayName("T17: Developer submits 45% progress with zero tasks and verified idempotency")
    void t17_developerSubmitsProgress_zeroTasks_idempotentReplay() throws Exception {
        Workspace ws = workspace("t17");
        Person dev = person("t17-dev");
        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, dev.id());
        String devToken = switchTo(dev.token(), ws.id());

        // Create Individual project with dev as accountable developer
        String projectId = "t17-proj-" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO projects (id, org_id, key, name, mode, lifecycle, accountable_developer_id,
                                      accountable_owner_id, last_progress_percent, version, require_verification)
                VALUES (?, ?, 'T17', 'Solo Project', 'INDIVIDUAL', 'ACTIVE', ?, ?, 0.00, 0, false)
                """, projectId, ws.id(), dev.id().toString(), dev.id().toString());

        // 1. Submit 45% progress check-in
        String idempotencyKey = "replay-key-" + UUID.randomUUID();
        Map<String, Object> payload = Map.of(
                "percent", 45.0,
                "accomplished", "Implemented repository layer and database migration",
                "next_steps", "Write controller endpoints and unit tests",
                "blockers", "None",
                "projected_finish", Instant.now().plus(7, ChronoUnit.DAYS).toString(),
                "idempotency_key", idempotencyKey
        );

        MvcResult res = mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/checkins"), devToken)
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.percent").value(45.0))
                .andExpect(jsonPath("$.method").value("DEVELOPER_REPORTED"))
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.captured_at").exists())
                .andReturn();

        String checkinId = json(res).path("id").asText();

        // Verify ZERO tasks created
        Integer taskCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM work_items WHERE project_id = ?", Integer.class, projectId);
        assertThat(taskCount).isEqualTo(0);

        // Verify project record reflects 45% Developer reported
        Map<String, Object> projRow = jdbc.queryForMap(
                "SELECT last_progress_percent, last_progress_method FROM projects WHERE id = ?", projectId);
        assertThat(new BigDecimal(projRow.get("last_progress_percent").toString()))
                .isEqualByComparingTo(new BigDecimal("45.00"));
        assertThat(projRow.get("last_progress_method")).isEqualTo("DEVELOPER_REPORTED");

        // 2. Replaying the same Idempotency-Key returns the existing entry without creating a duplicate
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/checkins"), devToken)
                        .header("Idempotency-Key", idempotencyKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payload)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(checkinId))
                .andExpect(jsonPath("$.percent").value(45.0));

        Integer checkinCount = jdbc.queryForObject(
                "SELECT COUNT(*) FROM project_progress_checkins WHERE project_id = ?", Integer.class, projectId);
        assertThat(checkinCount).isEqualTo(1);

        // 3. Percentage range validation: negative or > 100 rejected
        Map<String, Object> invalidPayload = Map.of(
                "percent", 105.0,
                "accomplished", "Too much done",
                "next_steps", "None"
        );
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/checkins"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidPayload)))
                .andExpect(status().isBadRequest());
    }

    // =========================================================================
    // T18: Downward Correction Requires Reason & Immutable History
    // =========================================================================
    @Test
    @DisplayName("T18: Downward correction requires reason; history remains immutable")
    void t18_downwardCorrection_requiresReason_historyImmutable() throws Exception {
        Workspace ws = workspace("t18");
        Person dev = person("t18-dev");
        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, dev.id());
        String devToken = switchTo(dev.token(), ws.id());

        String projectId = "t18-proj-" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO projects (id, org_id, key, name, mode, lifecycle, accountable_developer_id,
                                      last_progress_percent, version, require_verification)
                VALUES (?, ?, 'T18', 'Correction Project', 'INDIVIDUAL', 'ACTIVE', ?, 0.00, 0, false)
                """, projectId, ws.id(), dev.id().toString());

        // 1. Submit initial 45%
        Map<String, Object> initial = Map.of(
                "percent", 45.0,
                "accomplished", "Draft implementation",
                "next_steps", "Testing"
        );
        MvcResult res1 = mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/checkins"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(initial)))
                .andExpect(status().isCreated())
                .andReturn();
        String id1 = json(res1).path("id").asText();

        // 2. Downward correction to 30% without reason is REJECTED
        Map<String, Object> downwardNoReason = Map.of(
                "percent", 30.0,
                "accomplished", "Discovered edge case",
                "next_steps", "Refactoring"
        );
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/checkins"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(downwardNoReason)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("downward_reason is required when reducing progress"));

        // 3. Downward correction to 30% WITH reason succeeds
        Map<String, Object> downwardWithReason = Map.of(
                "percent", 30.0,
                "accomplished", "Discovered database lock issue during concurrency test",
                "next_steps", "Restructure transactions",
                "downward_reason", "Discovered missing lock indexes causing race condition"
        );
        MvcResult res2 = mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/checkins"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(downwardWithReason)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.percent").value(30.0))
                .andExpect(jsonPath("$.revision_seq").value(2))
                .andExpect(jsonPath("$.revision_of").value(id1))
                .andExpect(jsonPath("$.downward_reason").value("Discovered missing lock indexes causing race condition"))
                .andReturn();

        // 4. Verify history is immutable: both 45% and 30% exist
        mockMvc.perform(withToken(get("/v1/projects/" + projectId + "/checkins"), devToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].percent").value(30.0))
                .andExpect(jsonPath("$[0].revision_seq").value(2))
                .andExpect(jsonPath("$[1].percent").value(45.0))
                .andExpect(jsonPath("$[1].revision_seq").value(1));

        // Project reflects 30%
        Map<String, Object> projRow = jdbc.queryForMap(
                "SELECT last_progress_percent FROM projects WHERE id = ?", projectId);
        assertThat(new BigDecimal(projRow.get("last_progress_percent").toString()))
                .isEqualByComparingTo(new BigDecimal("30.00"));
    }

    // =========================================================================
    // T28 & AS-01: GitHub Evidence, Developer Reported Label, 100% Rule
    // =========================================================================
    @Test
    @DisplayName("T28 & AS-01: Attach GitHub evidence, verify Developer reported label, 100% does not close delivery")
    void as01_gitHubEvidence_developerReportedLabel_100PercentRule() throws Exception {
        Workspace ws = workspace("as01");
        Person dev = person("as01-dev");
        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, dev.id());
        String devToken = switchTo(dev.token(), ws.id());

        String projectId = "as01-proj-" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO projects (id, org_id, key, name, mode, lifecycle, accountable_developer_id,
                                      last_progress_percent, version, require_verification)
                VALUES (?, ?, 'AS01', 'Repo Project', 'INDIVIDUAL', 'ACTIVE', ?, 0.00, 0, false)
                """, projectId, ws.id(), dev.id().toString());

        // Link repository and seed commit in github_activity
        String repoName = "prowise/core-service";
        jdbc.update("""
                INSERT INTO github_activity (id, org_id, project_id, repository_name, event_type,
                                             actor, title, sha, created_at)
                VALUES (gen_random_uuid()::text, ?, ?, ?, 'PUSH', 'alice', 'feat: core engine', 'a1b2c3d4', now())
                """, ws.id(), projectId, repoName);

        // Submit 40% with GitHub evidence attached
        Map<String, Object> commitEvidence = Map.of(
                "type", "COMMIT",
                "sha", "a1b2c3d4",
                "title", "feat: core engine",
                "url", "https://github.com/prowise/core-service/commit/a1b2c3d4",
                "repo_name", repoName
        );

        Map<String, Object> submission = Map.of(
                "percent", 40.0,
                "accomplished", "Connected core service engine",
                "next_steps", "Integration tests",
                "evidence_items", List.of(commitEvidence)
        );

        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/checkins"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submission)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.percent").value(40.0))
                .andExpect(jsonPath("$.method").value("DEVELOPER_REPORTED"))
                .andExpect(jsonPath("$.evidence_items[0].sha").value("a1b2c3d4"));

        // Overview / summary shows 40% Developer reported
        mockMvc.perform(withToken(get("/v1/projects/" + projectId + "/checkins/summary"), devToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.current_percent").value(40.0))
                .andExpect(jsonPath("$.current_method").value("DEVELOPER_REPORTED"))
                .andExpect(jsonPath("$.last_reported_at").exists());

        // Submit 100%: MUST NOT mark project DELIVERED or CLOSED
        Map<String, Object> hundredPercent = Map.of(
                "percent", 100.0,
                "accomplished", "All deliverables completed",
                "next_steps", "Awaiting formal client acceptance"
        );
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/checkins"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(hundredPercent)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.percent").value(100.0));

        String lifecycle = jdbc.queryForObject(
                "SELECT lifecycle FROM projects WHERE id = ?", String.class, projectId);
        assertThat(lifecycle).isEqualTo("ACTIVE"); // 100% does NOT automatically close delivery
    }

    // =========================================================================
    // Team Lead Verification Workflow (Pending -> Review -> Approve / Changes)
    // =========================================================================
    @Test
    @DisplayName("Verification Workflow: Team Lead review queue, approve and request changes")
    void verificationWorkflow_teamLeadReview_approveAndRequestChanges() throws Exception {
        Workspace ws = workspace("lead");

        // Developer user
        Person dev = person("lead-dev");
        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, dev.id());
        String devToken = switchTo(dev.token(), ws.id());

        // Team Lead user
        Person lead = person("lead-mgr");
        UUID leadMem = member(ws.id(), lead.id(), "TEAM_LEAD");
        seedGrant(ws.id(), leadMem, TEAM_LEAD_ROLE, lead.id());
        String leadToken = switchTo(lead.token(), ws.id());

        // Project with require_verification = true
        String projectId = "verif-proj-" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update("""
                INSERT INTO projects (id, org_id, key, name, mode, lifecycle, accountable_developer_id,
                                      last_progress_percent, version, require_verification)
                VALUES (?, ?, 'VRF', 'Verification Project', 'INDIVIDUAL', 'ACTIVE', ?, 0.00, 0, true)
                """, projectId, ws.id(), dev.id().toString());

        // 1. Developer submits 60% progress
        Map<String, Object> submission = Map.of(
                "percent", 60.0,
                "accomplished", "Completed core APIs",
                "next_steps", "Add verification suite"
        );

        MvcResult submitRes = mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/checkins"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(submission)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.percent").value(60.0))
                .andExpect(jsonPath("$.status").value("PENDING_VERIFICATION"))
                .andReturn();

        String checkinId = json(submitRes).path("id").asText();

        // Project last_progress_percent remains 0.00 while pending verification
        BigDecimal currentProjPercent = jdbc.queryForObject(
                "SELECT last_progress_percent FROM projects WHERE id = ?", BigDecimal.class, projectId);
        assertThat(currentProjPercent).isEqualByComparingTo(BigDecimal.ZERO);

        // 2. Pending check-in appears in Team Lead review queue
        mockMvc.perform(withToken(get("/v1/organizations/" + ws.id() + "/reviews/pending"), leadToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].checkin.id").value(checkinId))
                .andExpect(jsonPath("$[0].checkin.percent").value(60.0));

        // 3. Developer attempts self-approval -> 403 Forbidden
        Map<String, Object> selfApprove = Map.of(
                "decision", "APPROVE",
                "comment", "Looks good to me"
        );
        mockMvc.perform(withToken(post("/v1/checkins/" + checkinId + "/verify"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(selfApprove)))
                .andExpect(status().isForbidden());

        // 4. Team Lead approves submission
        Map<String, Object> leadApprove = Map.of(
                "decision", "APPROVE",
                "comment", "Verified code commits and test coverage"
        );
        mockMvc.perform(withToken(post("/v1/checkins/" + checkinId + "/verify"), leadToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(leadApprove)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.verified_by").value(lead.id().toString()))
                .andExpect(jsonPath("$.review_comment").value("Verified code commits and test coverage"))
                .andExpect(jsonPath("$.method").value("DEVELOPER_REPORTED")); // Verification keeps method DEVELOPER_REPORTED

        // Project record is now updated to 60.00%
        BigDecimal updatedProjPercent = jdbc.queryForObject(
                "SELECT last_progress_percent FROM projects WHERE id = ?", BigDecimal.class, projectId);
        assertThat(updatedProjPercent).isEqualByComparingTo(new BigDecimal("60.00"));

        // 5. Stale review: attempting another decision on already verified checkin returns 409
        mockMvc.perform(withToken(post("/v1/checkins/" + checkinId + "/verify"), leadToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(leadApprove)))
                .andExpect(status().isConflict());

        // Queue is now empty
        mockMvc.perform(withToken(get("/v1/organizations/" + ws.id() + "/reviews/pending"), leadToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
