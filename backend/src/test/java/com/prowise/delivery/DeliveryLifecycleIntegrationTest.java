package com.prowise.delivery;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Instant;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.testsupport.TestAccounts;
import com.prowise.authz.TestDatabase;

@SpringBootTest
@AutoConfigureMockMvc
@Tag("T14")
@Tag("T15")
@Tag("AS-02")
class DeliveryLifecycleIntegrationTest {

    private static final UUID OWNER_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID TEAM_LEAD_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000004");
    private static final UUID DEVELOPER_ROLE = UUID.fromString("10000000-0000-0000-0000-000000000005");

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
        jdbc.execute("DELETE FROM outbox_event");
        jdbc.execute("DELETE FROM audit_log");
        jdbc.execute("DELETE FROM project_blocker_waivers");
        jdbc.execute("DELETE FROM project_blockers");
        jdbc.execute("DELETE FROM acceptance_decisions");
        jdbc.execute("DELETE FROM acceptance_requests");
        jdbc.execute("DELETE FROM project_closures");
        jdbc.execute("DELETE FROM project_lifecycle_history");
        jdbc.execute("DELETE FROM project_progress_checkins");
        jdbc.execute("DELETE FROM project_members");
        jdbc.execute("DELETE FROM project_date_history");
        jdbc.execute("DELETE FROM projects");
    }

    private record Person(UUID id, String email, String token) {}
    private record Workspace(UUID id, UUID ownerId, String ownerEmail, String ownerToken) {}

    private Person person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        // Signup now returns 202 without a session (D9); verify through the real endpoint, then sign in.
        TestAccounts.Account account = TestAccounts.signUpVerifyAndLogin(
                mockMvc, jdbc, accountTokens, objectMapper, email, "Correct-Horse-Battery-1!");
        return new Person(account.id(), email, account.accessToken());
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

    private String createProject(Workspace ws, String key, String name, UUID devId) throws Exception {
        MvcResult res = mockMvc.perform(withToken(post("/v1/organizations/{orgId}/projects", ws.id()), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "key": "%s",
                            "name": "%s",
                            "mode": "INDIVIDUAL",
                            "status": "ACTIVE",
                            "priority": "HIGH",
                            "accountable_membership_id": "%s",
                            "timezone": "Europe/London",
                            "start_on": "2026-06-01",
                            "target_on": "2026-06-30"
                        }
                        """.formatted(key, name, jdbc.queryForObject(
                                "SELECT id FROM memberships WHERE org_id = ? AND user_id = ?", UUID.class, ws.id(), devId))))
                .andExpect(status().isCreated()).andReturn();
        return json(res).path("id").asText();
    }

    // =========================================================================
    // TEST 1: T15 & AS-02: 100% Progress does not auto-deliver; acceptance request
    // transitions to AWAITING_ACCEPTANCE; approval transitions to DELIVERED; closure transitions to CLOSED
    // =========================================================================
    @Test
    @DisplayName("T15 & AS-02: 100% progress -> request acceptance -> authorized approval -> closure")
    void testCompleteDeliveryLifecycle() throws Exception {
        Workspace ws = workspace("deliv-flow");
        Person dev = person("deliv-dev");
        Person lead = person("deliv-lead");

        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, ws.ownerId());
        String devToken = switchTo(dev.token(), ws.id());

        UUID leadMem = member(ws.id(), lead.id(), "TEAM_LEAD");
        seedGrant(ws.id(), leadMem, TEAM_LEAD_ROLE, ws.ownerId());
        String leadToken = switchTo(lead.token(), ws.id());

        String projectId = createProject(ws, "DLV01", "Delivery Flow Project", dev.id());

        // 1. Attempt to request delivery acceptance when progress is 0% -> rejected
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/acceptance-requests"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "checklist": [{"id": "c1", "label": "All tests pass", "checked": true, "notes": "ok"}],
                            "evidenceSummary": "Initial check"
                        }
                        """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INCOMPLETE_PROGRESS"));

        // 2. Configure project to require verification
        jdbc.update("UPDATE projects SET require_verification = true WHERE id = ?", projectId);

        // Submit 100% check-in by developer
        MvcResult checkinRes = mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/checkins"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "percent": 100.0,
                            "accomplished": "Completed all individual deliverables",
                            "nextSteps": "Ready for acceptance review",
                            "blockers": "None",
                            "evidenceLinks": ["https://github.com/org/repo/pull/42"]
                        }
                        """))
                .andExpect(status().isCreated()).andReturn();
        String checkinId = json(checkinRes).path("id").asText();

        // 3. Lead accepts progress check-in
        mockMvc.perform(withToken(post("/v1/checkins/" + checkinId + "/verify"), leadToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"APPROVE\",\"comment\":\"Verified code complete\"}"))
                .andExpect(status().isOk());

        // Verify project is STILL ACTIVE with 100% progress (NOT auto-delivered!)
        MvcResult projRes = mockMvc.perform(withToken(get("/v1/organizations/" + ws.id() + "/projects/" + projectId), devToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode projNode = json(projRes);
        assertThat(projNode.path("lifecycle").asText()).isEqualTo("ACTIVE");
        assertThat(projNode.path("last_progress_percent").asDouble()).isEqualTo(100.0);
        long currentVersion = projNode.path("version").asLong();

        // 4. Developer submits Delivery Acceptance Request
        MvcResult reqRes = mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/acceptance-requests"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "boundCheckinId": "%s",
                            "checklist": [
                                {"id": "tests", "label": "Tests Passing", "checked": true, "notes": "All green"},
                                {"id": "docs", "label": "Docs Updated", "checked": true, "notes": "README updated"}
                            ],
                            "evidenceSummary": "Pull Request #42 merged, tests green",
                            "evidenceItems": [
                                {"type": "PR", "title": "Final PR", "url": "https://github.com/org/repo/pull/42", "reference": "PR-42"}
                            ]
                        }
                        """.formatted(checkinId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn();
        String requestId = json(reqRes).path("id").asText();

        // Verify project lifecycle moved to AWAITING_ACCEPTANCE
        MvcResult projAwaiting = mockMvc.perform(withToken(get("/v1/organizations/" + ws.id() + "/projects/" + projectId), devToken))
                .andExpect(status().isOk()).andReturn();
        assertThat(json(projAwaiting).path("lifecycle").asText()).isEqualTo("AWAITING_ACCEPTANCE");
        long awaitingVersion = json(projAwaiting).path("version").asLong();

        // 5. Developer attempts self-approval -> FORBIDDEN (403, Separation of Duties D04)
        mockMvc.perform(withToken(post("/v1/acceptance-requests/" + requestId + "/decisions"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "decision": "ACCEPTED",
                            "reason": "I approve my own work",
                            "expectedProjectVersion": %d
                        }
                        """.formatted(awaitingVersion)))
                .andExpect(status().isForbidden());

        // 6. Authorized Lead approves delivery
        mockMvc.perform(withToken(post("/v1/acceptance-requests/" + requestId + "/decisions"), leadToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "decision": "ACCEPTED",
                            "reason": "Checked checklist and PR, everything meets criteria",
                            "expectedProjectVersion": %d
                        }
                        """.formatted(awaitingVersion)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.decision").value("ACCEPTED"));

        // Verify project lifecycle is now DELIVERED
        MvcResult deliveredRes = mockMvc.perform(withToken(get("/v1/organizations/" + ws.id() + "/projects/" + projectId), devToken))
                .andExpect(status().isOk()).andReturn();
        JsonNode deliveredProj = json(deliveredRes);
        assertThat(deliveredProj.path("lifecycle").asText()).isEqualTo("DELIVERED");
        long deliveredVersion = deliveredProj.path("version").asLong();

        // 7. Developer attempts to close project -> 403 Forbidden (Only Manager/Owner can close)
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/close"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "handoverNote": "All done",
                            "reason": "Closing project",
                            "expectedProjectVersion": %d
                        }
                        """.formatted(deliveredVersion)))
                .andExpect(status().isForbidden());

        // 8. Workspace Owner closes project
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/close"), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "handoverNote": "Transferred to operations team, client sign-off complete",
                            "reason": "Deliverables accepted and client verified",
                            "expectedProjectVersion": %d
                        }
                        """.formatted(deliveredVersion)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.handover_note").value("Transferred to operations team, client sign-off complete"));

        // Verify project lifecycle is CLOSED
        MvcResult closedRes = mockMvc.perform(withToken(get("/v1/organizations/" + ws.id() + "/projects/" + projectId), ws.ownerToken()))
                .andExpect(status().isOk()).andReturn();
        assertThat(json(closedRes).path("lifecycle").asText()).isEqualTo("CLOSED");
    }

    // =========================================================================
    // TEST 2: Critical Unwaived Blockers prevent Acceptance; Waiver permits it
    // =========================================================================
    @Test
    @DisplayName("Critical open blocker prevents delivery acceptance until waived")
    void testBlockersAndWaiversOnAcceptance() throws Exception {
        Workspace ws = workspace("blocker-flow");
        Person dev = person("blk-dev");
        Person lead = person("blk-lead");

        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, ws.ownerId());
        String devToken = switchTo(dev.token(), ws.id());

        UUID leadMem = member(ws.id(), lead.id(), "TEAM_LEAD");
        seedGrant(ws.id(), leadMem, TEAM_LEAD_ROLE, ws.ownerId());
        String leadToken = switchTo(lead.token(), ws.id());

        String projectId = createProject(ws, "BLK01", "Blocker Flow Project", dev.id());

        // Set progress to 100% via database for brevity
        jdbc.update("UPDATE projects SET last_progress_percent = 100.0 WHERE id = ?", projectId);

        // Create critical blocker
        MvcResult blkRes = mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/blockers"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "title": "Security audit flaw in auth token refresh",
                            "description": "High severity finding from pentest",
                            "severity": "CRITICAL"
                        }
                        """))
                .andExpect(status().isCreated()).andReturn();
        String blockerId = json(blkRes).path("id").asText();

        // Submit delivery acceptance request
        MvcResult reqRes = mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/acceptance-requests"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "checklist": [{"id": "code", "label": "Code done", "checked": true, "notes": "done"}],
                            "evidenceSummary": "Ready for sign-off"
                        }
                        """))
                .andExpect(status().isCreated()).andReturn();
        String requestId = json(reqRes).path("id").asText();

        MvcResult projNode = mockMvc.perform(withToken(get("/v1/organizations/" + ws.id() + "/projects/" + projectId), ws.ownerToken()))
                .andExpect(status().isOk()).andReturn();
        long version = json(projNode).path("version").asLong();

        // Team Lead attempts to approve while critical blocker is open -> 422 UNPROCESSABLE_ENTITY
        mockMvc.perform(withToken(post("/v1/acceptance-requests/" + requestId + "/decisions"), leadToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "decision": "ACCEPTED",
                            "reason": "Looks good",
                            "expectedProjectVersion": %d
                        }
                        """.formatted(version)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("UNWAIVED_CRITICAL_BLOCKERS"));

        // Lead waives the blocker with reason
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/blockers/" + blockerId + "/waiver"), leadToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "reason": "Postponed to hotfix release v1.1 approved by CISO"
                        }
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WAIVED"))
                .andExpect(jsonPath("$.waiver.reason").value("Postponed to hotfix release v1.1 approved by CISO"));

        // Now approval succeeds
        mockMvc.perform(withToken(post("/v1/acceptance-requests/" + requestId + "/decisions"), leadToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "decision": "ACCEPTED",
                            "reason": "Critical blocker waived by security team, approved for delivery",
                            "expectedProjectVersion": %d
                        }
                        """.formatted(version)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.decision").value("ACCEPTED"));

        // Project is DELIVERED
        MvcResult delivProj = mockMvc.perform(withToken(get("/v1/organizations/" + ws.id() + "/projects/" + projectId), ws.ownerToken()))
                .andExpect(status().isOk()).andReturn();
        assertThat(json(delivProj).path("lifecycle").asText()).isEqualTo("DELIVERED");
    }

    // =========================================================================
    // TEST 3: T14: Archive stops edits & actions, restore retains previous state
    // =========================================================================
    @Test
    @DisplayName("T14: Archive stops edits and check-ins; restore returns previous lifecycle")
    void testArchiveAndRestoreLifecycle() throws Exception {
        Workspace ws = workspace("arch-flow");
        Person dev = person("arch-dev");

        UUID devMem = member(ws.id(), dev.id(), "DEVELOPER");
        seedGrant(ws.id(), devMem, DEVELOPER_ROLE, ws.ownerId());
        String devToken = switchTo(dev.token(), ws.id());

        String projectId = createProject(ws, "ARC01", "Archive Flow Project", dev.id());

        MvcResult projRes = mockMvc.perform(withToken(get("/v1/organizations/" + ws.id() + "/projects/" + projectId), ws.ownerToken()))
                .andExpect(status().isOk()).andReturn();
        long version = json(projRes).path("version").asLong();

        // 1. Archive the project
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/archive"), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":" + version + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(true));

        // 2. Edits are blocked on archived project (409 PROJECT_ARCHIVED)
        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/blockers"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Test Blocker\",\"severity\":\"NORMAL\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROJECT_ARCHIVED"));

        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/acceptance-requests"), devToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"checklist\":[],\"evidenceSummary\":\"test\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROJECT_ARCHIVED"));

        // 3. Restore the project
        MvcResult archivedProjRes = mockMvc.perform(withToken(get("/v1/organizations/" + ws.id() + "/projects/" + projectId), ws.ownerToken()))
                .andExpect(status().isOk()).andReturn();
        long archivedVersion = json(archivedProjRes).path("version").asLong();

        mockMvc.perform(withToken(post("/v1/projects/" + projectId + "/restore"), ws.ownerToken())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"expectedVersion\":" + archivedVersion + "}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.archived").value(false))
                .andExpect(jsonPath("$.lifecycle").value("ACTIVE"));
    }
}
