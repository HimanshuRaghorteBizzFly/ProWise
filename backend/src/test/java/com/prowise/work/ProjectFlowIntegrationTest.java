package com.prowise.work;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.identity.AccountTokenService;
import com.prowise.integration.github.GitHubClient;
import com.prowise.testsupport.TestAccounts;
import com.prowise.testsupport.github.GitHubWebhookSigner;

/**
 * The project delivery flow end to end (owner decisions 2026-11-25): guided setup of Team and Solo projects, the
 * board rules (assignee only, dependencies block starting), per-project approvers (never the developer themself, never
 * an organization-wide reviewer who was not chosen), changes requested back to In progress, progress from approved
 * points, files, GitHub commits linked by task key (fetched on submit and by a signed, replay-safe webhook).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T12")
@Tag("T22")
@Tag("T27")
@Tag("T31")
class ProjectFlowIntegrationTest {

    private static final UUID OWNER = UUID.fromString("10000000-0000-0000-0000-000000000001");
    private static final UUID ADMIN = UUID.fromString("10000000-0000-0000-0000-000000000002");
    private static final UUID PM = UUID.fromString("10000000-0000-0000-0000-000000000003");
    private static final UUID LEAD = UUID.fromString("10000000-0000-0000-0000-000000000004");
    private static final UUID DEV = UUID.fromString("10000000-0000-0000-0000-000000000005");
    private static final UUID QA = UUID.fromString("10000000-0000-0000-0000-000000000006");
    private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4};
    private static final byte[] PDF = "%PDF-1.7 brief".getBytes(StandardCharsets.US_ASCII);

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AccountTokenService accountTokens;
    @MockitoBean private GitHubClient github;

    private UUID orgId;
    private String ownerToken;
    private UUID ownerMembership;
    private String adminToken;
    private UUID adminMembership;
    private String pmToken;
    private String leadToken;
    private UUID leadMembership;
    private Person dev;
    private String devToken;
    private UUID devMembership;
    private String qaToken;
    private UUID qaMembership;
    private String qaOtherToken;
    private UUID qaOtherMembership;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        Person owner = person("owner");
        String slug = "flow-" + UUID.randomUUID().toString().substring(0, 6);
        orgId = UUID.fromString(tree(mockMvc.perform(auth(post("/v1/organizations"), owner.token()).contentType("application/json")
                        .content("{\"name\":\"" + slug + "\",\"slug\":\"" + slug + "\",\"timezone\":\"UTC\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText());
        ownerToken = switchTo(owner.token(), orgId);
        ownerMembership = jdbc.queryForObject("SELECT id FROM memberships WHERE org_id = ? AND user_id = ?", UUID.class,
                orgId, owner.id());
        Person admin = person("admin");
        adminMembership = member(admin.id(), "ORGANIZATION_ADMIN", ADMIN);
        adminToken = switchTo(admin.token(), orgId);
        Person pm = person("pm");
        member(pm.id(), "PROJECT_MANAGER", PM);
        pmToken = switchTo(pm.token(), orgId);
        Person lead = person("lead");
        leadMembership = member(lead.id(), "TEAM_LEAD", LEAD);
        leadToken = switchTo(lead.token(), orgId);
        dev = person("dev");
        devMembership = member(dev.id(), "DEVELOPER", DEV);
        devToken = switchTo(dev.token(), orgId);
        Person qa = person("qa");
        qaMembership = member(qa.id(), "QA_REVIEWER", QA);
        qaToken = switchTo(qa.token(), orgId);
        Person qaOther = person("qa-other");
        qaOtherMembership = member(qaOther.id(), "QA_REVIEWER", QA);
        qaOtherToken = switchTo(qaOther.token(), orgId);
    }

    @AfterEach
    void tearDown() {
        TestDatabase.clean(jdbc);
    }

    /* ================================================================== Team project */

    @Test
    void teamProjectFromSetupToApprovedPointsWithGitHubEvidence() throws Exception {
        // People offered by the wizard: never Owner or Admin.
        JsonNode options = tree(mockMvc.perform(auth(get("/v1/organizations/{o}/project-setup/options", orgId), pmToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        List<String> offered = new ArrayList<>();
        options.path("people").forEach(p -> offered.add(p.path("membership_id").asText()));
        assertThat(offered).contains(devMembership.toString(), leadMembership.toString(), qaMembership.toString())
                .doesNotContain(ownerMembership.toString(), adminMembership.toString());
        assertThat(options.path("people").get(0).has("open_tasks")).isTrue();

        String document = upload(pmToken, "PROJECT_DOCUMENT", null, null, "brief.pdf", PDF).path("id").asText();

        Map<String, Object> request = teamRequest(100);
        request.put("document_file_ids", List.of(document));
        JsonNode created = tree(setup(pmToken, request).andExpect(status().isCreated())
                .andExpect(jsonPath("$.total_points").value(100))
                .andExpect(jsonPath("$.task_count").value(3))
                .andExpect(jsonPath("$.approvers.length()").value(2))
                .andReturn().getResponse().getContentAsString());
        String projectId = created.path("project").path("id").asText();
        assertThat(created.path("project").path("mode").asText()).isEqualTo("STRUCTURED");
        assertThat(count("SELECT count(*) FROM work_items WHERE project_id = ? AND type = 'TASK' AND plan_status = 'ACTIVE'", projectId))
                .isEqualTo(3);
        assertThat(count("SELECT count(*) FROM scope_versions WHERE project_id = ? AND status = 'ACTIVE' AND version_no = 1", projectId))
                .isEqualTo(1);
        assertThat(count("SELECT count(*) FROM grants WHERE scope = 'PROJECT' AND CAST(scope_id AS text) = ?"
                + " AND template_role_id = '10000000-0000-0000-0000-000000000009'", projectId)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT project_id FROM file_metadata WHERE id = ?", String.class, document)).isEqualTo(projectId);
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'project.setup_completed'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'ProjectSetUp'")).isEqualTo(1);
        String login = taskByTitle(projectId, "Login");
        String dashboard = taskByTitle(projectId, "Dashboard");
        String release = taskByTitle(projectId, "Release");
        assertThat(jdbc.queryForObject("SELECT key FROM work_items WHERE id = ?", String.class, login)).isEqualTo("PRW-1");

        // Nothing approved yet: "Not reported", with the method.
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), ownerToken))
                .andExpect(jsonPath("$.reported").value(false))
                .andExpect(jsonPath("$.label").value("Not reported"))
                .andExpect(jsonPath("$.method_label").value("approved points, 0 of 100"));

        // The developer's board: own tasks; the dependent task names what blocks it and cannot start.
        mockMvc.perform(auth(get("/v1/me/work-items"), devToken)).andExpect(jsonPath("$.length()").value(3));
        mockMvc.perform(auth(get("/v1/work-items/{id}", dashboard), devToken))
                .andExpect(jsonPath("$.blocked_by[0].key").value("PRW-1"))
                .andExpect(jsonPath("$.phase.title").value("Build"));
        start(devToken, dashboard).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("BLOCKED_BY_DEPENDENCY"));
        start(qaToken, login).andExpect(status().isForbidden());
        start(devToken, login).andExpect(status().isOk()).andExpect(jsonPath("$.state").value("IN_PROGRESS"));

        // GitHub: repo.connect connects (Owner/Admin org-wide; the project's creator and PM for this project only). A QA
        // member who can read the project cannot. The token never comes back.
        when(github.repository(any(), eq("acme"), eq("web"))).thenReturn(new GitHubClient.Repository("acme/web", "main", true));
        when(github.commits(any(), eq("acme"), eq("web"), isNull(), any(), anyInt())).thenReturn(List.of(
                new GitHubClient.Commit("abc1234def5678", "PRW-1 add login form", "Dev", "dev-gh", Instant.now(),
                        "https://github.com/acme/web/commit/abc1234def5678"),
                new GitHubClient.Commit("fff0000", "PRW-12 unrelated", "Dev", "dev-gh", Instant.now(), "https://x")));
        when(github.branches(any(), eq("acme"), eq("web"), anyInt())).thenReturn(List.of("main"));
        when(github.pullRequests(any(), eq("acme"), eq("web"), anyInt())).thenReturn(List.of());
        mockMvc.perform(auth(put("/v1/projects/{p}/github", projectId), qaToken).contentType("application/json")
                        .content(json(Map.of("repository", "acme/web", "token", "github_pat_test_only"))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("REPO_CONNECT_REQUIRED"));
        mockMvc.perform(auth(get("/v1/projects/{p}/github", projectId), qaToken))
                .andExpect(jsonPath("$.can_manage").value(false)).andExpect(jsonPath("$.connected").value(false));
        mockMvc.perform(auth(get("/v1/projects/{p}/github", projectId), pmToken)).andExpect(jsonPath("$.can_manage").value(true));
        String connectBody = mockMvc.perform(auth(put("/v1/projects/{p}/github", projectId), adminToken).contentType("application/json")
                        .header("Idempotency-Key", "connect-" + UUID.randomUUID())
                        .content(json(Map.of("repository", "https://github.com/acme/web", "token", "github_pat_test_only"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.repository").value("acme/web"))
                .andExpect(jsonPath("$.webhook_secret").isNotEmpty())
                .andReturn().getResponse().getContentAsString();
        assertThat(connectBody).doesNotContain("github_pat_test_only");
        JsonNode connection = tree(connectBody);
        String secret = connection.path("webhook_secret").asText();
        String connectionId = connection.path("id").asText();
        assertThat(jdbc.queryForObject("SELECT token_ciphertext FROM project_repository_links WHERE id = ?", String.class, connectionId))
                .startsWith("v1:").doesNotContain("github_pat_test_only");
        // Neither the token nor the one-time webhook secret is kept anywhere in plain text (audit, outbox, replay store).
        assertThat(count("SELECT count(*) FROM idempotency_key WHERE response_body LIKE ?", "%" + secret + "%")).isZero();
        assertThat(count("SELECT count(*) FROM audit_log WHERE CAST(new AS text) LIKE ? OR CAST(new AS text) LIKE ?",
                "%" + secret + "%", "%github_pat_test_only%")).isZero();
        assertThat(count("SELECT count(*) FROM outbox_event WHERE CAST(payload AS text) LIKE ? OR CAST(payload AS text) LIKE ?",
                "%" + secret + "%", "%github_pat_test_only%")).isZero();
        mockMvc.perform(auth(get("/v1/projects/{p}/github", projectId), adminToken))
                .andExpect(jsonPath("$.webhook_secret").isEmpty())
                .andExpect(jsonPath("$.webhook_url").value("/v1/integrations/github/webhooks/" + connectionId));

        // Submit with a commit SHA and a screenshot; the matching commit is linked from GitHub.
        upload(qaToken, "SCREENSHOT", null, login, "shot.png", PNG, 403);
        String shot = upload(devToken, "SCREENSHOT", null, login, "shot.png", PNG).path("id").asText();
        submit(devToken, login, List.of(Map.of("type", "COMMIT", "ref", "abc1234"), Map.of("type", "FILE", "ref", shot)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.state").value("IN_REVIEW"));
        mockMvc.perform(auth(get("/v1/work-items/{id}/commits", login), qaToken))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].sha").value("abc1234def5678"))
                .andExpect(jsonPath("$[0].match_reason").value("MESSAGE"));
        // The two chosen approvers and the project's Project Manager are asked to review.
        assertThat(count("SELECT count(*) FROM developer_notifications WHERE category = 'REVIEW_REQUESTED'")).isEqualTo(3);

        // Review queue: only the chosen approvers see it; a QA who was not chosen cannot decide.
        mockMvc.perform(auth(get("/v1/me/review-queue"), qaToken))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].id").value(login));
        mockMvc.perform(auth(get("/v1/me/review-queue"), qaOtherToken)).andExpect(jsonPath("$.length()").value(0));
        review(qaOtherToken, login, 1, "APPROVED", null).andExpect(status().isNotFound());

        // Changes requested: reason required; the task returns to In progress with the reason visible.
        review(qaToken, login, 1, "CHANGES_REQUESTED", null).andExpect(status().isBadRequest());
        review(qaToken, login, 1, "CHANGES_REQUESTED", "Show an error for a wrong password").andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("IN_PROGRESS")).andExpect(jsonPath("$.revision").value(2));
        mockMvc.perform(auth(get("/v1/work-items/{id}", login), devToken))
                .andExpect(jsonPath("$.changes_requested_reason").value("Show an error for a wrong password"));
        assertThat(count("SELECT count(*) FROM developer_notifications WHERE user_id = ? AND category = 'CHANGES_REQUESTED'",
                dev.id().toString())).isEqualTo(1);

        // New review round on the next submission, then approval: its points count.
        submit(devToken, login, List.of(Map.of("type", "COMMIT", "ref", "abc1234"))).andExpect(jsonPath("$.submitted_revision").value(2));
        review(leadToken, login, 2, "APPROVED", null).andExpect(status().isOk()).andExpect(jsonPath("$.state").value("DONE"));
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), pmToken))
                .andExpect(jsonPath("$.reported").value(true))
                .andExpect(jsonPath("$.percent").value(30))
                .andExpect(jsonPath("$.method_label").value("approved points, 30 of 100"));
        JsonNode overview = tree(mockMvc.perform(auth(get("/v1/organizations/{o}/progress-overview", orgId), ownerToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        assertThat(overview.get(0).path("percent").asInt()).isEqualTo(30);
        assertThat(overview.get(0).path("done").asInt()).isEqualTo(1);
        mockMvc.perform(auth(get("/v1/work-items/{id}/activity", login), devToken))
                .andExpect(jsonPath("$[?(@.action == 'work_item.accepted')]").exists())
                .andExpect(jsonPath("$[?(@.action == 'work_item.changes_requested')].reason").value("Show an error for a wrong password"));
        // The dependent task can start now.
        start(devToken, dashboard).andExpect(status().isOk());

        // The project's Project Manager receives submissions and accepts them: the task's points are added.
        start(devToken, release).andExpect(status().isOk());
        submit(devToken, release, List.of(Map.of("type", "LINK", "ref", "https://example.test/release-notes"))).andExpect(status().isOk());
        mockMvc.perform(auth(get("/v1/me/review-queue"), pmToken))
                .andExpect(jsonPath("$[?(@.id == '" + release + "')]").exists());
        review(pmToken, release, 1, "APPROVED", null).andExpect(status().isOk()).andExpect(jsonPath("$.state").value("DONE"));
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), pmToken))
                .andExpect(jsonPath("$.percent").value(50))
                .andExpect(jsonPath("$.method_label").value("approved points, 50 of 100"));

        // Signed webhook: a push mentioning PRW-3 links to that task once; replay, bad signature and other repo do nothing.
        byte[] push = json(Map.of("ref", "refs/heads/main", "repository", Map.of("full_name", "acme/web"),
                "commits", List.of(Map.of("id", "9999aaaa", "message", "PRW-3 release notes", "timestamp", "2026-11-25T10:00:00Z",
                        "url", "https://github.com/acme/web/commit/9999aaaa", "author", Map.of("name", "Dev", "username", "dev-gh")))))
                .getBytes(StandardCharsets.UTF_8);
        webhook(connectionId, "push", "delivery-1", new GitHubWebhookSigner(secret).sign(push), push)
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("processed")).andExpect(jsonPath("$.linked").value(1));
        webhook(connectionId, "push", "delivery-1", new GitHubWebhookSigner(secret).sign(push), push)
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("duplicate"));
        webhook(connectionId, "push", "delivery-2", new GitHubWebhookSigner("wrong").sign(push), push)
                .andExpect(status().isUnauthorized());
        byte[] other = json(Map.of("repository", Map.of("full_name", "evil/other"), "commits", List.of())).getBytes(StandardCharsets.UTF_8);
        webhook(connectionId, "push", "delivery-3", new GitHubWebhookSigner(secret).sign(other), other)
                .andExpect(status().isUnprocessableEntity());
        assertThat(count("SELECT count(*) FROM github_activity WHERE work_item_id = ?", release)).isEqualTo(1);
        // Git activity never changes progress (rule 9).
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), pmToken))
                .andExpect(jsonPath("$.percent").value(50));
    }

    @Test
    void setupRulesAreCheckedOnTheServer() throws Exception {
        setup(pmToken, teamRequest(101)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("POINTS_OVER_LIMIT"));
        Map<String, Object> past = teamRequest(90);
        past.put("start_on", LocalDate.now(ZoneOffset.UTC).minusDays(1).toString());
        setup(pmToken, past).andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("start_on"));
        Map<String, Object> backwards = teamRequest(90);
        backwards.put("target_on", LocalDate.now(ZoneOffset.UTC).minusDays(0).toString());
        backwards.put("start_on", LocalDate.now(ZoneOffset.UTC).plusDays(3).toString());
        setup(pmToken, backwards).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_DATE_RANGE"));

        Map<String, Object> ownerAsDeveloper = teamRequest(90);
        ownerAsDeveloper.put("developer_membership_ids", List.of(ownerMembership.toString()));
        setup(pmToken, ownerAsDeveloper).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ROLE_NOT_ASSIGNABLE"));
        Map<String, Object> adminApprover = teamRequest(90);
        adminApprover.put("approver_membership_ids", List.of(adminMembership.toString()));
        setup(pmToken, adminApprover).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ROLE_NOT_ASSIGNABLE"));
        Map<String, Object> foreign = teamRequest(90);
        foreign.put("qa_membership_ids", List.of(UUID.randomUUID().toString()));
        setup(pmToken, foreign).andExpect(status().isNotFound());

        Map<String, Object> wrongAssignee = teamRequest(90);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> tasks = (List<Map<String, Object>>) wrongAssignee.get("tasks");
        tasks.get(0).put("assignee_membership_id", qaMembership.toString());
        setup(pmToken, wrongAssignee).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("ASSIGNEE_NOT_DEVELOPER"));

        Map<String, Object> loop = teamRequest(90);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> loopTasks = (List<Map<String, Object>>) loop.get("tasks");
        loopTasks.get(0).put("depends_on_ref", "t3");
        loopTasks.get(2).put("depends_on_ref", "t2");
        setup(pmToken, loop).andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("DEPENDENCY_CYCLE"));

        Map<String, Object> soloWithTasks = teamRequest(90);
        soloWithTasks.put("mode", "SOLO");
        soloWithTasks.remove("team_lead_membership_id");
        soloWithTasks.remove("qa_membership_ids");
        setup(pmToken, soloWithTasks).andExpect(status().isBadRequest());

        setup(devToken, teamRequest(90)).andExpect(status().isForbidden());
        assertThat(count("SELECT count(*) FROM projects WHERE org_id = ?", orgId)).isZero();
        // Less than 100 is allowed.
        setup(pmToken, teamRequest(80)).andExpect(status().isCreated()).andExpect(jsonPath("$.total_points").value(80));
    }

    /* ================================================================== Solo project */

    @Test
    void soloProjectSubmitsAPercentThatCountsOnlyOnceAnApproverApprovesIt() throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("name", "Landing page");
        request.put("key", "LND");
        request.put("mode", "SOLO");
        request.put("start_on", LocalDate.now(ZoneOffset.UTC).toString());
        request.put("target_on", LocalDate.now(ZoneOffset.UTC).plusDays(30).toString());
        request.put("developer_membership_ids", List.of(devMembership.toString()));
        request.put("approver_membership_ids", List.of(leadMembership.toString()));
        String projectId = tree(setup(pmToken, request).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).path("project").path("id").asText();

        String shot = upload(devToken, "SCREENSHOT", projectId, null, "hero.png", PNG).path("id").asText();
        String checkin = tree(checkIn(devToken, projectId, 40, List.of(Map.of("type", "COMMIT", "ref", "abc1234"),
                        Map.of("type", "FILE", "ref", shot)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.evidence_items.length()").value(2))
                .andReturn().getResponse().getContentAsString()).path("id").asText();
        mockMvc.perform(auth(get("/v1/projects/{p}/checkins/summary", projectId), devToken))
                .andExpect(jsonPath("$.current.label").value("Not reported"))
                .andExpect(jsonPath("$.pending.percent").value(40))
                .andExpect(jsonPath("$.approvers[0].email").exists());
        JsonNode overview = tree(mockMvc.perform(auth(get("/v1/organizations/{o}/progress-overview", orgId), ownerToken))
                .andReturn().getResponse().getContentAsString());
        assertThat(overview.get(0).path("pending_percent").asInt()).isEqualTo(40);
        assertThat(overview.get(0).path("percent").isNull()).isTrue();
        mockMvc.perform(auth(get("/v1/me/review-queue"), leadToken))
                .andExpect(jsonPath("$[0].kind").value("SOLO")).andExpect(jsonPath("$[0].review_ref").value("checkin-" + checkin));

        decide(devToken, checkin, "APPROVE", null, 0).andExpect(status().isForbidden());
        decide(qaToken, checkin, "APPROVE", null, 0).andExpect(status().isNotFound());
        decide(leadToken, checkin, "REJECT", null, 0).andExpect(status().isBadRequest());
        decide(leadToken, checkin, "REJECT", "Add the mobile layout", 0).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
        String second = tree(checkIn(devToken, projectId, 50, List.of(Map.of("type", "LINK", "ref", "https://example.test/preview")))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
        decide(leadToken, second, "APPROVE", null, 0).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("APPROVED"));
        mockMvc.perform(auth(get("/v1/organizations/{o}/projects/{p}", orgId, projectId), pmToken))
                .andExpect(jsonPath("$.progress.percent").value(50));
        assertThat(count("SELECT count(*) FROM developer_notifications WHERE user_id = ? AND category = 'REVIEW_APPROVED'",
                dev.id().toString())).isEqualTo(1);
    }

    @Test
    void progressListShowsEveryProjectThePmCanSeeWithPagingFiltersAndSort() throws Exception {
        // Three Team projects and one Solo project; one Team project gets 30 approved points.
        String first = null;
        for (String key : List.of("ALPHA", "BRAVO", "CHARLY")) {
            Map<String, Object> team = teamRequest(80);
            team.put("key", key);
            team.put("name", key + " web");
            String id = tree(setup(pmToken, team).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString())
                    .path("project").path("id").asText();
            if (first == null) first = id;
        }
        Map<String, Object> solo = new LinkedHashMap<>();
        solo.put("name", "Delta landing");
        solo.put("key", "DELTA");
        solo.put("mode", "SOLO");
        solo.put("start_on", LocalDate.now(ZoneOffset.UTC).toString());
        solo.put("target_on", LocalDate.now(ZoneOffset.UTC).plusDays(10).toString());
        setup(pmToken, solo).andExpect(status().isCreated());
        String login = taskByTitleIn(first, "Login");
        start(devToken, login).andExpect(status().isOk());
        submit(devToken, login, List.of(Map.of("type", "LINK", "ref", "https://example.test/pr/1"))).andExpect(status().isOk());
        review(pmToken, login, 1, "APPROVED", null).andExpect(status().isOk());

        String base = "/v1/organizations/{o}/progress/projects";
        JsonNode all = tree(mockMvc.perform(auth(get(base, orgId), pmToken)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
        assertThat(all.path("items")).hasSize(4);
        JsonNode alpha = all.path("items").get(0);
        assertThat(alpha.path("key").asText()).isEqualTo("ALPHA");
        assertThat(alpha.path("percent").asInt()).isEqualTo(38); // 30 of 80
        assertThat(alpha.path("method_label").asText()).isEqualTo("approved points, 30 of 80");
        assertThat(all.path("items").get(1).path("label").asText()).isEqualTo("Not reported");
        assertThat(all.path("items").get(3).path("mode").asText()).isEqualTo("INDIVIDUAL");

        // Paging: 2 per page, then the rest; nothing repeated.
        JsonNode page1 = tree(mockMvc.perform(auth(get(base + "?limit=2", orgId), pmToken)).andReturn().getResponse().getContentAsString());
        assertThat(page1.path("items")).hasSize(2);
        assertThat(page1.path("has_more").asBoolean()).isTrue();
        JsonNode page2 = tree(mockMvc.perform(auth(get(base + "?limit=2&cursor=" + page1.path("next_cursor").asText(), orgId), pmToken))
                .andReturn().getResponse().getContentAsString());
        assertThat(page2.path("items")).hasSize(2);
        assertThat(page2.path("items").get(0).path("key").asText()).isEqualTo("CHARLY");
        assertThat(page2.path("has_more").asBoolean()).isFalse();

        // Filters and sort.
        mockMvc.perform(auth(get(base + "?mode=INDIVIDUAL", orgId), pmToken)).andExpect(jsonPath("$.items.length()").value(1));
        mockMvc.perform(auth(get(base + "?q=bravo", orgId), pmToken)).andExpect(jsonPath("$.items[0].key").value("BRAVO"));
        mockMvc.perform(auth(get(base + "?sort=progress", orgId), pmToken)).andExpect(jsonPath("$.items[0].key").value("ALPHA"));
        mockMvc.perform(auth(get(base + "?sort=sideways", orgId), pmToken)).andExpect(status().isBadRequest());

        // A QA member who is on no project sees none; a foreign organization is 404.
        mockMvc.perform(auth(get(base, orgId), qaOtherToken)).andExpect(jsonPath("$.items.length()").value(0));
        mockMvc.perform(auth(get(base, UUID.randomUUID()), pmToken)).andExpect(status().isNotFound());
    }

    /* ================================================================== multi-step Create Project (drafts) */

    @Test
    void aDraftIsPrivateHiddenFromListsAndBecomesAProjectOnlyWhenActivated() throws Exception {
        String today = LocalDate.now(ZoneOffset.UTC).toString();
        // Step 1: basics are checked by the server.
        draft(pmToken, Map.of("name", "Past", "key", "PAST", "mode", "TEAM", "start_on", LocalDate.now(ZoneOffset.UTC).minusDays(1).toString(),
                "target_on", today)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.field_errors[0].field").value("start_on"));
        JsonNode d = tree(draft(pmToken, Map.of("name", "Orbit web", "key", "ORB", "mode", "TEAM", "start_on", today,
                "target_on", LocalDate.now(ZoneOffset.UTC).plusDays(30).toString()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn().getResponse().getContentAsString());
        String id = d.path("id").asText();

        // Hidden: no project exists, other people cannot see the draft, only the creator's draft list shows it.
        assertThat(count("SELECT count(*) FROM projects WHERE org_id = ?", orgId)).isZero();
        mockMvc.perform(auth(get("/v1/organizations/{o}/project-drafts", orgId), pmToken)).andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(auth(get("/v1/project-drafts/{id}", id), adminToken)).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/organizations/{o}/progress/projects", orgId), pmToken)).andExpect(jsonPath("$.items.length()").value(0));

        // Step 2: a staged document.
        String doc = upload(pmToken, "PROJECT_DOCUMENT", null, null, "brief.pdf", PDF).path("id").asText();
        long v = step(id, "documents", Map.of("document_file_ids", List.of(doc)), 0).path("version").asLong();

        // Step 3: points above 100 are refused; a stale version is refused.
        Map<String, Object> over = new LinkedHashMap<>(planBody(101));
        over.put("expected_version", v);
        mockMvc.perform(auth(put("/v1/project-drafts/{id}/plan", id), pmToken).contentType("application/json").content(json(over)))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("POINTS_OVER_LIMIT"));
        Map<String, Object> stale = new LinkedHashMap<>(planBody(80));
        stale.put("expected_version", v - 1);
        mockMvc.perform(auth(put("/v1/project-drafts/{id}/plan", id), pmToken).contentType("application/json").content(json(stale)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        v = step(id, "plan", planBody(80), v).path("version").asLong();

        // Steps 5 and 6: people (never Owner/Admin) and approvers.
        mockMvc.perform(auth(put("/v1/project-drafts/{id}/people", id), pmToken).contentType("application/json")
                        .content(json(Map.of("developer_membership_ids", List.of(adminMembership.toString()), "expected_version", v))))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("ROLE_NOT_ASSIGNABLE"));
        v = step(id, "people", Map.of("team_lead_membership_id", leadMembership.toString(),
                "developer_membership_ids", List.of(devMembership.toString()), "qa_membership_ids", List.of(qaMembership.toString())), v)
                .path("version").asLong();
        v = step(id, "approvers", Map.of("approver_membership_ids", List.of(qaMembership.toString())), v).path("version").asLong();
        assertThat(count("SELECT count(*) FROM projects WHERE org_id = ?", orgId)).isZero();

        // Step 7: activation creates everything in one go.
        String projectId = tree(mockMvc.perform(auth(post("/v1/project-drafts/{id}/activate", id), pmToken).contentType("application/json")
                        .content(json(Map.of("expected_version", v))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.total_points").value(80))
                .andReturn().getResponse().getContentAsString()).path("project").path("id").asText();
        assertThat(count("SELECT count(*) FROM work_items WHERE project_id = ? AND type = 'TASK'", projectId)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT project_id FROM file_metadata WHERE id = ?", String.class, doc)).isEqualTo(projectId);
        assertThat(jdbc.queryForObject("SELECT status FROM project_drafts WHERE id = ?::uuid", String.class, id)).isEqualTo("ACTIVATED");
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type IN ('ProjectSetUp', 'ProjectDraftActivated')")).isEqualTo(2);
        mockMvc.perform(auth(get("/v1/organizations/{o}/progress/projects", orgId), pmToken)).andExpect(jsonPath("$.items.length()").value(1));
        mockMvc.perform(auth(get("/v1/me/work-items"), devToken)).andExpect(jsonPath("$.length()").value(3));
        mockMvc.perform(auth(get("/v1/organizations/{o}/project-drafts", orgId), pmToken)).andExpect(jsonPath("$.length()").value(0));
        // Activating twice changes nothing.
        mockMvc.perform(auth(post("/v1/project-drafts/{id}/activate", id), pmToken).contentType("application/json")
                .content(json(Map.of("expected_version", v + 1)))).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DRAFT_CLOSED"));
    }

    @Test
    void theRepositoryStepVerifiesAccessStoresTheTokenEncryptedAndDiscardRemovesTheDraft() throws Exception {
        String today = LocalDate.now(ZoneOffset.UTC).toString();
        Map<String, Object> solo = Map.of("name", "Solo site", "key", "SOLO", "mode", "SOLO", "start_on", today, "target_on", today);
        // The creator of a draft may connect its repository (owner decision 2026-11-25).
        String pmDraft = tree(draft(pmToken, solo).andReturn().getResponse().getContentAsString()).path("id").asText();
        mockMvc.perform(auth(get("/v1/project-drafts/{id}", pmDraft), pmToken)).andExpect(jsonPath("$.can_connect_repository").value(true));
        // Discard: closed, gone from the list.
        mockMvc.perform(auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/v1/project-drafts/{id}", pmDraft), pmToken)
                .contentType("application/json").content(json(Map.of("expected_version", 0)))).andExpect(status().isNoContent());
        mockMvc.perform(auth(get("/v1/organizations/{o}/project-drafts", orgId), pmToken)).andExpect(jsonPath("$.length()").value(0));

        // An admin (repo.connect) verifies the repository before saving; the token never comes back.
        when(github.repository(any(), eq("acme"), eq("web"))).thenReturn(new GitHubClient.Repository("acme/web", "main", true));
        Map<String, Object> adminSolo = Map.of("name", "Admin site", "key", "ADM", "mode", "SOLO", "start_on", today, "target_on", today);
        String id = tree(draft(adminToken, adminSolo).andReturn().getResponse().getContentAsString()).path("id").asText();
        String body = mockMvc.perform(auth(put("/v1/project-drafts/{id}/repository", id), adminToken).contentType("application/json")
                        .content(json(Map.of("repository", "acme/web", "token", "github_pat_test_only", "expected_version", 0))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.repository.connected").value(true))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain("github_pat_test_only");
        assertThat(jdbc.queryForObject("SELECT repo_token_ciphertext FROM project_drafts WHERE id = ?::uuid", String.class, id))
                .startsWith("v1:");
        String projectId = tree(mockMvc.perform(auth(post("/v1/project-drafts/{id}/activate", id), adminToken).contentType("application/json")
                        .content(json(Map.of("expected_version", 1)))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).path("project").path("id").asText();
        assertThat(jdbc.queryForObject("SELECT repo_name FROM project_repository_links WHERE project_id = ?", String.class, projectId))
                .isEqualTo("acme/web");
        assertThat(jdbc.queryForObject("SELECT repo_token_ciphertext FROM project_drafts WHERE id = ?::uuid", String.class, id)).isNull();
    }

    @Test
    @org.junit.jupiter.api.extension.ExtendWith(org.springframework.boot.test.system.OutputCaptureExtension.class)
    void aProjectManagerConnectsTheRepositoryOfTheirOwnProjectButNotOthers(
            org.springframework.boot.test.system.CapturedOutput output) throws Exception {
        String token = "github_pat_PMSECRETabcd1234";
        String newToken = "github_pat_NEWSECRETzz9876";
        when(github.repository(org.mockito.ArgumentMatchers.argThat((GitHubClient.Credential c) -> c != null
                && (token.equals(c.token()) || newToken.equals(c.token()))), eq("acme"), eq("web")))
                .thenReturn(new GitHubClient.Repository("acme/web", "main", true));
        when(github.repository(org.mockito.ArgumentMatchers.argThat((GitHubClient.Credential c) -> c != null && "bad-token".equals(c.token())),
                eq("acme"), eq("web"))).thenThrow(new GitHubClient.GitHubException(401, "GitHub refused the token: it is wrong, expired or revoked."));
        when(github.repository(org.mockito.ArgumentMatchers.argThat((GitHubClient.Credential c) -> c != null && "slow-token".equals(c.token())),
                eq("acme"), eq("web"))).thenThrow(new GitHubClient.GitHubException(429, "GitHub's rate limit was reached."));
        String today = LocalDate.now(ZoneOffset.UTC).toString();

        // The PM connects the repository of the project they are creating.
        String id = tree(draft(pmToken, Map.of("name", "Repo site", "key", "REPO", "mode", "SOLO", "start_on", today, "target_on", today))
                .andReturn().getResponse().getContentAsString()).path("id").asText();
        String path = "/v1/project-drafts/{id}/repository";
        mockMvc.perform(auth(put(path, id), pmToken).contentType("application/json")
                        .content(json(Map.of("repository", "acme/web", "token", "bad-token", "expected_version", 0))))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("GITHUB_TOKEN_INVALID"))
                .andExpect(jsonPath("$.field_errors[0].field").value("token"));
        mockMvc.perform(auth(put(path, id), pmToken).contentType("application/json")
                        .content(json(Map.of("repository", "acme/web", "token", "slow-token", "expected_version", 0))))
                .andExpect(status().isTooManyRequests()).andExpect(jsonPath("$.code").value("GITHUB_RATE_LIMITED"));
        String body = mockMvc.perform(auth(put(path, id), pmToken).contentType("application/json")
                        .content(json(Map.of("repository", "acme/web", "token", token, "expected_version", 0))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.repository.connected").value(true))
                .andExpect(jsonPath("$.repository.token_last4").value("1234"))
                .andExpect(jsonPath("$.repository.url").value("https://github.com/acme/web"))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain(token);
        // Someone else's draft is invisible.
        mockMvc.perform(auth(put(path, id), adminToken).contentType("application/json")
                .content(json(Map.of("repository", "acme/web", "token", token, "expected_version", 1)))).andExpect(status().isNotFound());

        // Activation keeps the connection; the PM manages it on THIS project: view, replace the token, disconnect.
        String projectId = tree(mockMvc.perform(auth(post("/v1/project-drafts/{id}/activate", id), pmToken).contentType("application/json")
                        .content(json(Map.of("expected_version", 1)))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).path("project").path("id").asText();
        JsonNode view = tree(mockMvc.perform(auth(get("/v1/projects/{p}/github", projectId), pmToken))
                .andExpect(jsonPath("$.can_manage").value(true)).andExpect(jsonPath("$.token_last4").value("1234"))
                .andExpect(jsonPath("$.repository").value("acme/web")).andReturn().getResponse().getContentAsString());
        assertThat(view.toString()).doesNotContain(token);
        String replaced = mockMvc.perform(auth(put("/v1/projects/{p}/github/token", projectId), pmToken).contentType("application/json")
                        .content(json(Map.of("token", newToken, "expected_version", view.path("version").asLong()))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token_last4").value("9876"))
                .andReturn().getResponse().getContentAsString();
        assertThat(replaced).doesNotContain(newToken);
        mockMvc.perform(auth(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/v1/projects/{p}/github", projectId), pmToken)
                .contentType("application/json").content(json(Map.of("expected_version", view.path("version").asLong() + 1))))
                .andExpect(status().isNoContent());
        for (String action : List.of("project_draft.repository_connected", "repository.connected", "repository.token_replaced",
                "repository.disconnected")) {
            assertThat(count("SELECT count(*) FROM audit_log WHERE action = ?", action)).as(action).isEqualTo(1);
        }
        // Org-wide repo.connect was not given to the PM role: a project the PM neither created nor manages is refused.
        Map<String, Object> adminProject = teamRequest(80);
        adminProject.put("key", "ADMN");
        String adminProjectId = tree(setup(adminToken, adminProject).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString()).path("project").path("id").asText();
        mockMvc.perform(auth(put("/v1/projects/{p}/github", adminProjectId), pmToken).contentType("application/json")
                        .content(json(Map.of("repository", "acme/web", "token", token))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("REPO_CONNECT_REQUIRED"));
        assertThat(count("SELECT count(*) FROM grants g JOIN role_permissions rp ON rp.role_id = g.template_role_id"
                + " WHERE g.org_id = ? AND g.scope = 'ORG' AND rp.permission_key = 'repo.connect'"
                + " AND g.membership_id = (SELECT id FROM memberships WHERE org_id = ? AND role_template = 'PROJECT_MANAGER')",
                orgId, orgId)).isZero();

        // Another organization's project is a 404 for this PM.
        Person stranger = person("stranger");
        String slug = "other-" + UUID.randomUUID().toString().substring(0, 6);
        UUID otherOrg = UUID.fromString(tree(mockMvc.perform(auth(post("/v1/organizations"), stranger.token()).contentType("application/json")
                        .content("{\"name\":\"" + slug + "\",\"slug\":\"" + slug + "\",\"timezone\":\"UTC\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText());
        String strangerToken = switchTo(stranger.token(), otherOrg);
        String foreign = tree(mockMvc.perform(auth(post("/v1/organizations/{o}/projects", otherOrg), strangerToken).contentType("application/json")
                        .content(json(Map.of("name", "Foreign", "key", "FRGN", "mode", "STRUCTURED"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
        mockMvc.perform(auth(put("/v1/projects/{p}/github", foreign), pmToken).contentType("application/json")
                .content(json(Map.of("repository", "acme/web", "token", token)))).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/projects/{p}/github", foreign), pmToken)).andExpect(status().isNotFound());

        // The token is never logged.
        assertThat(output.getAll()).doesNotContain(token).doesNotContain(newToken);
    }

    private ResultActions draft(String token, Map<String, Object> basics) throws Exception {
        return mockMvc.perform(auth(post("/v1/organizations/{o}/project-drafts", orgId), token).contentType("application/json")
                .content(json(basics)));
    }

    private JsonNode step(String draftId, String step, Map<String, Object> body, long version) throws Exception {
        Map<String, Object> withVersion = new LinkedHashMap<>(body);
        withVersion.put("expected_version", version);
        return tree(mockMvc.perform(auth(put("/v1/project-drafts/{id}/" + step, draftId), pmToken).contentType("application/json")
                .content(json(withVersion))).andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
    }

    private Map<String, Object> planBody(int total) {
        Map<String, Object> request = teamRequest(total);
        return Map.of("phases", request.get("phases"), "tasks", request.get("tasks"));
    }

    private String taskByTitleIn(String projectId, String title) {
        return jdbc.queryForObject("SELECT id FROM work_items WHERE project_id = ? AND title = ?", String.class, projectId, title);
    }

    @Test
    void filesAreCheckedAndNeverReadableFromOutsideTheProject() throws Exception {
        upload(pmToken, "PROJECT_DOCUMENT", null, null, "tool.exe", "MZ".getBytes(), 422);
        upload(pmToken, "PROJECT_DOCUMENT", null, null, "fake.pdf", PNG, 422);
        upload(devToken, "PROJECT_DOCUMENT", null, null, "brief.pdf", PDF, 403);
        String staged = upload(pmToken, "PROJECT_DOCUMENT", null, null, "brief.pdf", PDF).path("id").asText();
        // A staged file is visible to its uploader only.
        mockMvc.perform(auth(get("/v1/files/{id}/content", staged), pmToken)).andExpect(status().isOk());
        mockMvc.perform(auth(get("/v1/files/{id}/content", staged), devToken)).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/files/{id}/content", UUID.randomUUID().toString()), pmToken)).andExpect(status().isNotFound());
    }

    /* ================================================================== helpers */

    private Map<String, Object> teamRequest(int totalPoints) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("name", "Prowise web " + UUID.randomUUID().toString().substring(0, 4));
        request.put("key", "PRW");
        request.put("mode", "TEAM");
        request.put("start_on", LocalDate.now(ZoneOffset.UTC).toString());
        request.put("target_on", LocalDate.now(ZoneOffset.UTC).plusDays(60).toString());
        request.put("team_lead_membership_id", leadMembership.toString());
        request.put("developer_membership_ids", List.of(devMembership.toString()));
        request.put("qa_membership_ids", List.of(qaMembership.toString()));
        request.put("approver_membership_ids", List.of(qaMembership.toString(), leadMembership.toString()));
        request.put("phases", List.of(Map.of("ref", "p1", "name", "Build"), Map.of("ref", "p2", "name", "Ship")));
        List<Map<String, Object>> tasks = new ArrayList<>();
        tasks.add(new LinkedHashMap<>(Map.of("ref", "t1", "title", "Login", "phase_ref", "p1", "points", 30)));
        Map<String, Object> dashboard = new LinkedHashMap<>(Map.of("ref", "t2", "title", "Dashboard", "phase_ref", "p1",
                "points", totalPoints - 50));
        dashboard.put("depends_on_ref", "t1");
        tasks.add(dashboard);
        tasks.add(new LinkedHashMap<>(Map.of("ref", "t3", "title", "Release", "phase_ref", "p2", "points", 20)));
        request.put("tasks", tasks);
        return request;
    }

    private ResultActions setup(String token, Map<String, Object> body) throws Exception {
        return mockMvc.perform(auth(post("/v1/organizations/{o}/project-setup", orgId), token)
                .contentType("application/json").content(json(body)));
    }

    private JsonNode upload(String token, String kind, String projectId, String workItemId, String name, byte[] content)
            throws Exception {
        return tree(uploadRequest(token, kind, projectId, workItemId, name, content).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString());
    }

    private void upload(String token, String kind, String projectId, String workItemId, String name, byte[] content,
            int expected) throws Exception {
        uploadRequest(token, kind, projectId, workItemId, name, content).andExpect(status().is(expected));
    }

    private ResultActions uploadRequest(String token, String kind, String projectId, String workItemId, String name,
            byte[] content) throws Exception {
        var request = multipart("/v1/organizations/{o}/files", orgId)
                .file(new MockMultipartFile("file", name, "application/octet-stream", content)).param("kind", kind);
        if (projectId != null) request.param("project_id", projectId);
        if (workItemId != null) request.param("work_item_id", workItemId);
        return mockMvc.perform(auth(request, token));
    }

    private ResultActions start(String token, String item) throws Exception {
        return mockMvc.perform(auth(post("/v1/work-items/{id}/start", item), token).contentType("application/json")
                .content(json(Map.of("expected_version", version(item)))));
    }

    private ResultActions submit(String token, String item, List<Map<String, Object>> evidence) throws Exception {
        return mockMvc.perform(auth(post("/v1/work-items/{id}/submissions", item), token).contentType("application/json")
                .content(json(Map.of("expected_version", version(item), "note", "Ready", "evidence", evidence))));
    }

    private ResultActions review(String token, String item, int revision, String decision, String reason) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("submitted_revision", revision);
        body.put("decision", decision);
        if (reason != null) body.put("reason", reason);
        return mockMvc.perform(auth(post("/v1/work-items/{id}/reviews", item), token)
                .contentType("application/json").content(json(body)));
    }

    private ResultActions checkIn(String token, String projectId, int percent, List<Map<String, Object>> evidence)
            throws Exception {
        return mockMvc.perform(auth(post("/v1/projects/{p}/checkins", projectId), token).contentType("application/json")
                .content(json(Map.of("percent", percent, "accomplished", "Hero section done", "next_steps", "Footer",
                        "evidence_items", evidence))));
    }

    private ResultActions decide(String token, String checkin, String decision, String reason, long version) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("decision", decision);
        body.put("expected_version", version);
        if (reason != null) body.put("reason", reason);
        return mockMvc.perform(auth(post("/v1/checkins/{id}/decision", checkin), token)
                .contentType("application/json").content(json(body)));
    }

    private ResultActions webhook(String connection, String event, String delivery, String signature, byte[] body)
            throws Exception {
        return mockMvc.perform(post("/v1/integrations/github/webhooks/{id}", connection).contentType("application/json")
                .header("X-GitHub-Event", event).header("X-GitHub-Delivery", delivery)
                .header("X-Hub-Signature-256", signature).content(body));
    }

    private String taskByTitle(String projectId, String title) {
        return jdbc.queryForObject("SELECT id FROM work_items WHERE project_id = ? AND title = ?", String.class, projectId, title);
    }

    private long version(String item) {
        Long value = jdbc.queryForObject("SELECT version FROM work_items WHERE id = ?", Long.class, item);
        return value == null ? 0 : value;
    }

    private UUID member(UUID userId, String template, UUID templateRoleId) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO memberships (id, org_id, user_id, role_template) VALUES (?, ?, ?, ?)", id, orgId, userId, template);
        jdbc.update("INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by) VALUES (?, ?, ?, ?, 'ORG', ?)",
                UUID.randomUUID(), orgId, id, templateRoleId, userId);
        return id;
    }

    private Person person(String name) throws Exception {
        String email = name + "-" + UUID.randomUUID().toString().substring(0, 8) + "@example.test";
        TestAccounts.Account account = TestAccounts.signUpVerifyAndLogin(
                mockMvc, jdbc, accountTokens, objectMapper, email, "Correct-Horse-Battery-1!");
        return new Person(account.id(), account.accessToken());
    }

    private String switchTo(String token, UUID org) throws Exception {
        return tree(mockMvc.perform(auth(post("/v1/me/organizations/{org}/switch", org), token))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("access_token").asText();
    }

    private int count(String sql, Object... args) {
        Integer value = jdbc.queryForObject(sql, Integer.class, args);
        return value == null ? 0 : value;
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private JsonNode tree(String body) {
        try {
            return objectMapper.readTree(body);
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static <T extends MockHttpServletRequestBuilder> T auth(T builder, String token) {
        builder.header("Authorization", "Bearer " + token);
        return builder;
    }

    private record Person(UUID id, String token) {}
}
