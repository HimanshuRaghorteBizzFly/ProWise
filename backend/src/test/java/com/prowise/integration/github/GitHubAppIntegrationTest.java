package com.prowise.integration.github;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.authz.TestDatabase;
import com.prowise.identity.AccountTokenService;
import com.prowise.testsupport.TestAccounts;
import com.prowise.testsupport.github.GitHubWebhookSigner;

/**
 * GitHub through the Prowise GitHub App (task 4.1, owner decision 2026-11-25): an Owner/Admin connects GitHub once for
 * the organization; the project's creator / PM then picks one repository and branch per project (while creating it or
 * later), Prowise validates it, links it, and imports recent commits and pull requests with code-change stats. The
 * App webhook is signed and replay-safe. GitHub activity never completes tasks or changes progress (rule 9).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Tag("T31")
@Tag("T32")
@ExtendWith(OutputCaptureExtension.class)
class GitHubAppIntegrationTest {

    private static final UUID ADMIN = UUID.fromString("10000000-0000-0000-0000-000000000002");
    private static final UUID PM = UUID.fromString("10000000-0000-0000-0000-000000000003");
    private static final UUID LEAD = UUID.fromString("10000000-0000-0000-0000-000000000004");
    private static final UUID DEV = UUID.fromString("10000000-0000-0000-0000-000000000005");
    private static final UUID QA = UUID.fromString("10000000-0000-0000-0000-000000000006");
    private static final long INSTALLATION = 4242L;
    private static final String INSTALL_TOKEN = "ghs_INSTALLATIONsecretTOKEN0042";
    private static final String WEBHOOK_SECRET = "TEST-ONLY-app-webhook-secret";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private AccountTokenService accountTokens;
    @MockitoBean private GitHubClient github;
    @MockitoBean private GitHubAppApi app;

    private UUID orgId;
    private String ownerToken;
    private String adminToken;
    private String pmToken;
    private String devToken;
    private UUID leadMembership;
    private UUID devMembership;
    private UUID qaMembership;

    @BeforeEach
    void setUp() throws Exception {
        TestDatabase.clean(jdbc);
        Person owner = person("owner");
        orgId = organization(owner.token());
        ownerToken = switchTo(owner.token(), orgId);
        Person admin = person("admin");
        member(admin.id(), "ORGANIZATION_ADMIN", ADMIN);
        adminToken = switchTo(admin.token(), orgId);
        Person pm = person("pm");
        member(pm.id(), "PROJECT_MANAGER", PM);
        pmToken = switchTo(pm.token(), orgId);
        Person lead = person("lead");
        leadMembership = member(lead.id(), "TEAM_LEAD", LEAD);
        Person dev = person("dev");
        devMembership = member(dev.id(), "DEVELOPER", DEV);
        devToken = switchTo(dev.token(), orgId);
        Person qa = person("qa");
        qaMembership = member(qa.id(), "QA_REVIEWER", QA);

        when(app.configured()).thenReturn(true);
        when(app.slug()).thenReturn("prowise-test");
        when(app.installUrl(anyString())).thenAnswer(a -> "https://github.com/apps/prowise-test/installations/new?state=" + a.getArgument(0));
        when(app.webhookSecret()).thenReturn(WEBHOOK_SECRET);
        when(app.installation(INSTALLATION)).thenReturn(new GitHubAppApi.Installation(INSTALLATION, "acme", "Organization",
                "selected", false, Map.of("contents", "read", "metadata", "read", "pull_requests", "read"),
                List.of("push", "pull_request")));
        when(app.installationToken(INSTALLATION)).thenReturn(new GitHubClient.Credential(INSTALL_TOKEN));
        when(app.repositories(any(), anyInt())).thenReturn(List.of(
                new GitHubAppApi.RepositoryOption(1, "acme/web", "main", true, "Web app"),
                new GitHubAppApi.RepositoryOption(2, "acme/api", "main", false, null)));
        for (String repo : List.of("web", "api")) {
            when(github.repository(any(), eq("acme"), eq(repo))).thenReturn(new GitHubClient.Repository("acme/" + repo, "main", true));
            when(github.branches(any(), eq("acme"), eq(repo), anyInt())).thenReturn(List.of("main", "develop"));
            when(github.branchExists(any(), eq("acme"), eq(repo), eq("main"))).thenReturn(true);
            when(github.branchExists(any(), eq("acme"), eq(repo), eq("develop"))).thenReturn(true);
        }
        when(github.commits(any(), eq("acme"), eq("web"), eq("main"), isNull(), anyInt())).thenReturn(List.of(
                new GitHubClient.Commit("abc1234def5678", "PRW-1 add login form", "Dev", "dev-gh", Instant.now(), "https://github.com/acme/web/commit/abc1234"),
                new GitHubClient.Commit("fff0000aaa1111", "chore: bump deps", "Dev", "dev-gh", Instant.now(), "https://github.com/acme/web/commit/fff0000")));
        when(github.commitStats(any(), eq("acme"), eq("web"), anyString())).thenReturn(new GitHubClient.ChangeStats(10, 2, 3));
        when(github.pullRequests(any(), eq("acme"), eq("web"), anyInt())).thenReturn(List.of(
                new GitHubClient.PullRequest(7, "PRW-1 login page", "feature/PRW-1", "dev-gh", Instant.now(),
                        "https://github.com/acme/web/pull/7", "closed")));
        when(github.pullRequestStats(any(), eq("acme"), eq("web"), eq(7)))
                .thenReturn(new GitHubClient.PullRequestStats(40, 5, 4, true, "main"));
    }

    @AfterEach
    void tearDown() {
        TestDatabase.clean(jdbc);
    }

    /* ================================================================== organization: connect GitHub once */

    @Test
    void anAdminConnectsGitHubOnceAndTheInstallationIsProvenAndSingleUse(CapturedOutput output) throws Exception {
        // Not configured on the server: a clear 503, nothing to click.
        when(app.configured()).thenReturn(false);
        mockMvc.perform(auth(get("/v1/organizations/{o}/github/app", orgId), adminToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.configured").value(false));
        install(adminToken, null).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("GITHUB_APP_NOT_CONFIGURED"));
        when(app.configured()).thenReturn(true);

        // Only organization-wide repo.connect (Owner / Admin) connects GitHub for the organization.
        install(pmToken, null).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("REPO_CONNECT_REQUIRED"));
        install(adminToken, "https://evil.example/steal").andExpect(status().isBadRequest());
        String returnTo = "/org/" + orgId + "/admin/integrations";
        String url = tree(install(adminToken, returnTo).andExpect(status().isOk()).andReturn().getResponse().getContentAsString())
                .path("install_url").asText();
        assertThat(url).startsWith("https://github.com/apps/prowise-test/installations/new?state=");
        String state = url.substring(url.indexOf("state=") + 6);
        assertThat(count("SELECT count(*) FROM github_app_install_states WHERE state_hash = ?", state)).isZero(); // hash only

        // The state belongs to the admin who started it.
        callback(pmToken, state, INSTALLATION, "good-code").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GITHUB_STATE_INVALID"));
        // The OAuth code must prove the installer's GitHub account can access the installation id.
        when(app.userInstallationIds("someone-else")).thenReturn(Set.of(999L));
        callback(adminToken, state, INSTALLATION, "someone-else").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("GITHUB_INSTALLATION_NOT_YOURS"));
        callback(adminToken, state, INSTALLATION, "").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GITHUB_AUTHORIZATION_REQUIRED"));
        when(app.userInstallationIds("good-code")).thenReturn(Set.of(INSTALLATION));
        callback(adminToken, state, INSTALLATION, "good-code").andExpect(status().isOk())
                .andExpect(jsonPath("$.account").value("acme")).andExpect(jsonPath("$.return_to").value(returnTo));
        // Single use.
        callback(adminToken, state, INSTALLATION, "good-code").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GITHUB_STATE_USED"));
        assertThat(count("SELECT count(*) FROM github_app_installations WHERE org_id = ? AND installation_id = ?", orgId, INSTALLATION))
                .isEqualTo(1);
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'github.installation_connected'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'GitHubInstallationConnected'")).isEqualTo(1);

        // Expired states are refused.
        String late = stateOf(install(adminToken, null));
        jdbc.update("UPDATE github_app_install_states SET expires_at = now() - interval '1 minute' WHERE used_at IS NULL");
        callback(adminToken, late, INSTALLATION, "good-code").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GITHUB_STATE_EXPIRED"));

        // Every member sees the connection; only Owner/Admin manage it.
        mockMvc.perform(auth(get("/v1/organizations/{o}/github/app", orgId), pmToken))
                .andExpect(jsonPath("$.configured").value(true)).andExpect(jsonPath("$.can_manage").value(false))
                .andExpect(jsonPath("$.installations[0].account").value("acme"));

        // The same GitHub installation cannot be claimed by another organization.
        Person stranger = person("stranger");
        UUID otherOrg = organization(stranger.token());
        String strangerToken = switchTo(stranger.token(), otherOrg);
        String theirs = stateOf(mockMvc.perform(auth(post("/v1/organizations/{o}/github/app/install", otherOrg), strangerToken)
                .contentType("application/json").content("{}")));
        callback(strangerToken, theirs, INSTALLATION, "good-code").andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("GITHUB_INSTALLATION_IN_USE"));
        // A foreign organization's GitHub page is a 404.
        mockMvc.perform(auth(get("/v1/organizations/{o}/github/app", otherOrg), adminToken)).andExpect(status().isNotFound());

        // Remove from Prowise (expectedVersion), audited.
        JsonNode installation = tree(mockMvc.perform(auth(get("/v1/organizations/{o}/github/app", orgId), adminToken))
                .andReturn().getResponse().getContentAsString()).path("installations").get(0);
        mockMvc.perform(auth(delete("/v1/organizations/{o}/github/app/installations/{i}", orgId, installation.path("id").asText()),
                adminToken).contentType("application/json").content(json(Map.of("expected_version", 99))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        mockMvc.perform(auth(delete("/v1/organizations/{o}/github/app/installations/{i}", orgId, installation.path("id").asText()),
                adminToken).contentType("application/json").content(json(Map.of("expected_version", installation.path("version").asLong()))))
                .andExpect(status().isNoContent());
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'github.installation_removed'")).isEqualTo(1);
        assertThat(output.getAll()).doesNotContain(INSTALL_TOKEN).doesNotContain("good-code");
    }

    /* ================================================================== project: repository and branch */

    @Test
    void theProjectManagerPicksARepositoryAndBranchAndActivityIsImportedButNeverProgress(CapturedOutput output) throws Exception {
        UUID installation = seedInstallation(orgId, INSTALLATION);
        String projectId = teamProject(pmToken, "PRW");
        String login = jdbc.queryForObject("SELECT id FROM work_items WHERE project_id = ? AND key = 'PRW-1'", String.class, projectId);
        String statusBefore = jdbc.queryForObject("SELECT state FROM work_items WHERE id = ?", String.class, login);

        // Choosing: the PM of this project yes; a developer no; another organization's project or installation 404.
        mockMvc.perform(auth(get("/v1/projects/{p}/github/app/repositories", projectId).param("installation_id", installation.toString()), pmToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].full_name").value("acme/web")).andExpect(jsonPath("$[0].used_by_project").doesNotExist());
        mockMvc.perform(auth(get("/v1/projects/{p}/github/app/repositories", projectId).param("installation_id", installation.toString()), devToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(auth(get("/v1/projects/{p}/github/app/branches", projectId).param("installation_id", installation.toString())
                        .param("repository", "acme/web"), pmToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$[1]").value("develop"));
        Person stranger = person("stranger");
        UUID otherOrg = organization(stranger.token());
        UUID foreignInstallation = seedInstallation(otherOrg, 777L);
        mockMvc.perform(auth(get("/v1/projects/{p}/github/app/repositories", projectId)
                .param("installation_id", foreignInstallation.toString()), pmToken)).andExpect(status().isNotFound());

        // Confirmation screen: every check; a missing branch fails validation and connect.
        mockMvc.perform(auth(post("/v1/projects/{p}/github/app/validate", projectId), pmToken).contentType("application/json")
                        .content(json(choice(installation, "acme/web", "nope", null))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.ok").value(false))
                .andExpect(jsonPath("$.checks[1].key").value("branch")).andExpect(jsonPath("$.checks[1].ok").value(false));
        connect(pmToken, projectId, choice(installation, "acme/web", "nope", null)).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("GITHUB_BRANCH_NOT_FOUND"));
        mockMvc.perform(auth(post("/v1/projects/{p}/github/app/validate", projectId), pmToken).contentType("application/json")
                        .content(json(choice(installation, "acme/web", "main", null))))
                .andExpect(jsonPath("$.ok").value(true)).andExpect(jsonPath("$.account").value("acme"))
                .andExpect(jsonPath("$.private_repository").value(true));

        // Connect: link + audit + outbox, then recent commits and pull requests are imported with stats.
        String body = connect(pmToken, projectId, choice(installation, "acme/web", "main", null)).andExpect(status().isOk())
                .andExpect(jsonPath("$.connection.provider").value("GITHUB_APP"))
                .andExpect(jsonPath("$.connection.branch").value("main"))
                .andExpect(jsonPath("$.connection.installation_account").value("acme"))
                .andExpect(jsonPath("$.connection.webhook_url").doesNotExist())
                .andExpect(jsonPath("$.imported.ok").value(true)).andExpect(jsonPath("$.imported.linked").value(3))
                .andReturn().getResponse().getContentAsString();
        assertThat(body).doesNotContain(INSTALL_TOKEN);
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'repository.connected'")).isEqualTo(1);
        assertThat(count("SELECT count(*) FROM outbox_event WHERE event_type = 'RepositoryConnected'")).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT token_ciphertext FROM project_repository_links WHERE project_id = ? AND status = 'ACTIVE'",
                String.class, projectId)).isNull();

        // GitHub Activity tab: commits and pull requests, authors, branches, stats, the task each one mentions.
        mockMvc.perform(auth(get("/v1/projects/{p}/github/activity", projectId), devToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.connected").value(true)).andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.branches[0]").value("feature/PRW-1"));
        JsonNode pulls = tree(mockMvc.perform(auth(get("/v1/projects/{p}/github/activity", projectId).param("type", "PULL_REQUEST"), pmToken))
                .andExpect(jsonPath("$.total").value(1)).andReturn().getResponse().getContentAsString()).path("items").get(0);
        assertThat(pulls.path("state").asText()).isEqualTo("merged");
        assertThat(pulls.path("additions").asInt()).isEqualTo(40);
        assertThat(pulls.path("files_changed").asInt()).isEqualTo(4);
        assertThat(pulls.path("task_keys").get(0).asText()).isEqualTo("PRW-1");
        mockMvc.perform(auth(get("/v1/projects/{p}/github/activity", projectId).param("q", "login form"), pmToken))
                .andExpect(jsonPath("$.total").value(1)).andExpect(jsonPath("$.items[0].additions").value(10));
        mockMvc.perform(auth(get("/v1/projects/{p}/github/activity", projectId).param("type", "BOGUS"), pmToken))
                .andExpect(status().isBadRequest());
        // Task evidence keeps working; nothing completed, nothing reported (rule 9).
        mockMvc.perform(auth(get("/v1/work-items/{id}/commits", login), pmToken)).andExpect(jsonPath("$.length()").value(2));
        assertThat(jdbc.queryForObject("SELECT state FROM work_items WHERE id = ?", String.class, login)).isEqualTo(statusBefore);
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), ownerToken))
                .andExpect(jsonPath("$.reported").value(false));

        // Sync again: deduplicated.
        mockMvc.perform(auth(post("/v1/projects/{p}/github/sync", projectId), pmToken)).andExpect(status().isOk())
                .andExpect(jsonPath("$.linked").value(0));
        mockMvc.perform(auth(post("/v1/projects/{p}/github/sync", projectId), devToken)).andExpect(status().isForbidden());
        assertThat(count("SELECT count(*) FROM github_activity WHERE project_id = ? AND scope = 'FEED'", projectId)).isEqualTo(3);

        // App links have no token or webhook secret to replace.
        JsonNode view = tree(mockMvc.perform(auth(get("/v1/projects/{p}/github", projectId), pmToken))
                .andReturn().getResponse().getContentAsString());
        mockMvc.perform(auth(put("/v1/projects/{p}/github/token", projectId), pmToken).contentType("application/json")
                .content(json(Map.of("token", "x", "expected_version", view.path("version").asLong()))))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_A_TOKEN_CONNECTION"));

        // Each project has its own repository.
        String second = teamProject(pmToken, "SEC");
        mockMvc.perform(auth(get("/v1/projects/{p}/github/app/repositories", second).param("installation_id", installation.toString()), pmToken))
                .andExpect(jsonPath("$[0].used_by_project").exists());
        connect(pmToken, second, choice(installation, "acme/web", "main", null)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REPOSITORY_IN_USE"));

        // Change repository / branch: needs the current version.
        connect(pmToken, projectId, choice(installation, "acme/api", "develop", null)).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REPOSITORY_ALREADY_CONNECTED"));
        connect(pmToken, projectId, choice(installation, "acme/api", "develop", view.path("version").asLong() + 5))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("STALE_VERSION"));
        JsonNode changed = tree(connect(pmToken, projectId, choice(installation, "acme/api", "develop", view.path("version").asLong()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.connection.repository").value("acme/api"))
                .andExpect(jsonPath("$.connection.branch").value("develop")).andReturn().getResponse().getContentAsString());
        assertThat(count("SELECT count(*) FROM audit_log WHERE action = 'repository.changed'")).isEqualTo(1);
        // The old repository is free again for the second project.
        connect(pmToken, second, choice(installation, "acme/web", "main", null)).andExpect(status().isOk());

        // Disconnect: the activity tab then shows the disconnected state.
        mockMvc.perform(auth(delete("/v1/projects/{p}/github", projectId), pmToken).contentType("application/json")
                .content(json(Map.of("expected_version", changed.path("connection").path("version").asLong()))))
                .andExpect(status().isNoContent());
        mockMvc.perform(auth(get("/v1/projects/{p}/github/activity", projectId), pmToken))
                .andExpect(jsonPath("$.connected").value(false));
        // Another organization's project: 404.
        String strangerToken = switchTo(stranger.token(), otherOrg);
        String foreign = tree(mockMvc.perform(auth(post("/v1/organizations/{o}/projects", otherOrg), strangerToken).contentType("application/json")
                        .content(json(Map.of("name", "Foreign", "key", "FRGN", "mode", "STRUCTURED"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
        connect(pmToken, foreign, choice(installation, "acme/web", "main", null)).andExpect(status().isNotFound());
        mockMvc.perform(auth(get("/v1/projects/{p}/github/activity", foreign), pmToken)).andExpect(status().isNotFound());

        assertThat(output.getAll()).doesNotContain(INSTALL_TOKEN);
    }

    @Test
    void theCreatorPicksTheRepositoryThroughTheAppWhileCreatingTheProject() throws Exception {
        UUID installation = seedInstallation(orgId, INSTALLATION);
        String today = LocalDate.now(ZoneOffset.UTC).toString();
        String draft = tree(mockMvc.perform(auth(post("/v1/organizations/{o}/project-drafts", orgId), pmToken).contentType("application/json")
                        .content(json(Map.of("name", "Solo site", "key", "SOLO", "mode", "SOLO", "start_on", today, "target_on", today))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText();
        mockMvc.perform(auth(get("/v1/project-drafts/{d}/github/repositories", draft).param("installation_id", installation.toString()), pmToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2));
        // Someone else's draft is invisible.
        mockMvc.perform(auth(get("/v1/project-drafts/{d}/github/repositories", draft).param("installation_id", installation.toString()), adminToken))
                .andExpect(status().isNotFound());
        mockMvc.perform(auth(post("/v1/project-drafts/{d}/github/validate", draft), pmToken).contentType("application/json")
                        .content(json(choice(installation, "acme/web", "main", null))))
                .andExpect(jsonPath("$.ok").value(true));
        Map<String, Object> step = new LinkedHashMap<>(choice(installation, "acme/web", "main", null));
        step.put("expected_version", 0);
        mockMvc.perform(auth(put("/v1/project-drafts/{d}/repository", draft), pmToken).contentType("application/json").content(json(step)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.repository.provider").value("GITHUB_APP"))
                .andExpect(jsonPath("$.repository.branch").value("main"))
                .andExpect(jsonPath("$.repository.account").value("acme"))
                .andExpect(jsonPath("$.repository.token_last4").doesNotExist());
        String projectId = tree(mockMvc.perform(auth(post("/v1/project-drafts/{d}/activate", draft), pmToken).contentType("application/json")
                        .content(json(Map.of("expected_version", 1)))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).path("project").path("id").asText();
        assertThat(jdbc.queryForObject("SELECT provider FROM project_repository_links WHERE project_id = ? AND status = 'ACTIVE'",
                String.class, projectId)).isEqualTo("GITHUB_APP");
        // Imported right after the project was created.
        assertThat(count("SELECT count(*) FROM github_activity WHERE project_id = ? AND scope = 'FEED'", projectId)).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT repo_installation_ref FROM project_drafts WHERE id = ?::uuid", UUID.class, draft)).isNull();
    }

    /* ================================================================== the App's webhook */

    @Test
    void theAppWebhookIsSignedReplaySafeAndRoutedByInstallationAndRepository() throws Exception {
        UUID installation = seedInstallation(orgId, INSTALLATION);
        String projectId = teamProject(pmToken, "PRW");
        connect(pmToken, projectId, choice(installation, "acme/web", "main", null)).andExpect(status().isOk());
        int before = count("SELECT count(*) FROM github_activity WHERE project_id = ? AND scope = 'FEED'", projectId);

        byte[] push = json(Map.of("ref", "refs/heads/feature/PRW-1", "installation", Map.of("id", INSTALLATION),
                "repository", Map.of("full_name", "acme/web"),
                "commits", List.of(Map.of("id", "9999aaaabbbbcccc", "message", "PRW-1 validation", "timestamp", "2026-11-25T10:00:00Z",
                        "url", "https://github.com/acme/web/commit/9999aaa", "author", Map.of("name", "Dev", "username", "dev-gh")))))
                .getBytes(StandardCharsets.UTF_8);
        GitHubWebhookSigner signer = new GitHubWebhookSigner(WEBHOOK_SECRET);
        appWebhook("push", "d-1", "sha256=" + "0".repeat(64), push).andExpect(status().isUnauthorized());
        appWebhook("push", "d-1", signer.sign(push), push).andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("processed")).andExpect(jsonPath("$.linked").value(1));
        appWebhook("push", "d-1", signer.sign(push), push).andExpect(jsonPath("$.status").value("duplicate"));
        assertThat(count("SELECT count(*) FROM github_activity WHERE project_id = ? AND scope = 'FEED'", projectId)).isEqualTo(before + 1);

        // A repository not linked through this installation is ignored.
        byte[] other = json(Map.of("ref", "refs/heads/main", "installation", Map.of("id", INSTALLATION),
                "repository", Map.of("full_name", "acme/unlinked"), "commits", List.of())).getBytes(StandardCharsets.UTF_8);
        appWebhook("push", "d-2", signer.sign(other), other).andExpect(jsonPath("$.status").value("ignored"));

        // Uninstalled on GitHub: the installation is removed and the project link shows the problem.
        byte[] deleted = json(Map.of("action", "deleted", "installation", Map.of("id", INSTALLATION))).getBytes(StandardCharsets.UTF_8);
        appWebhook("installation", "d-3", signer.sign(deleted), deleted).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT status FROM github_app_installations WHERE id = ?", String.class, installation))
                .isEqualTo("REMOVED");
        mockMvc.perform(auth(get("/v1/projects/{p}/github", projectId), pmToken))
                .andExpect(jsonPath("$.status").value("ERROR")).andExpect(jsonPath("$.last_error").exists());
        // Progress untouched by any of it.
        mockMvc.perform(auth(get("/v1/projects/{p}/structured-progress", projectId), ownerToken))
                .andExpect(jsonPath("$.reported").value(false));
    }

    /* ================================================================== helpers */

    private ResultActions install(String token, String returnTo) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        if (returnTo != null) body.put("return_to", returnTo);
        return mockMvc.perform(auth(post("/v1/organizations/{o}/github/app/install", orgId), token).contentType("application/json")
                .content(json(body)));
    }

    private String stateOf(ResultActions result) throws Exception {
        String url = tree(result.andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).path("install_url").asText();
        return url.substring(url.indexOf("state=") + 6);
    }

    private ResultActions callback(String token, String state, long installationId, String code) throws Exception {
        return mockMvc.perform(auth(post("/v1/integrations/github/app/callback"), token).contentType("application/json")
                .content(json(Map.of("state", state, "installation_id", installationId, "code", code, "setup_action", "install"))));
    }

    private ResultActions connect(String token, String projectId, Map<String, Object> body) throws Exception {
        return mockMvc.perform(auth(put("/v1/projects/{p}/github/app", projectId), token).contentType("application/json")
                .content(json(body)));
    }

    private static Map<String, Object> choice(UUID installation, String repository, String branch, Long expectedVersion) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("installation_id", installation.toString());
        body.put("repository", repository);
        body.put("branch", branch);
        if (expectedVersion != null) body.put("expected_version", expectedVersion);
        return body;
    }

    private ResultActions appWebhook(String event, String delivery, String signature, byte[] body) throws Exception {
        return mockMvc.perform(post("/v1/integrations/github/app/webhook").contentType("application/json")
                .header("X-GitHub-Event", event).header("X-GitHub-Delivery", delivery)
                .header("X-Hub-Signature-256", signature).content(body));
    }

    private UUID seedInstallation(UUID org, long installationId) {
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO github_app_installations (id, org_id, installation_id, account_login, account_type, status)
                VALUES (?, ?, ?, 'acme', 'Organization', 'ACTIVE')
                """, id, org, installationId);
        return id;
    }

    private String teamProject(String token, String key) throws Exception {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("name", "Project " + key);
        request.put("key", key);
        request.put("mode", "TEAM");
        request.put("start_on", LocalDate.now(ZoneOffset.UTC).toString());
        request.put("target_on", LocalDate.now(ZoneOffset.UTC).plusDays(60).toString());
        request.put("team_lead_membership_id", leadMembership.toString());
        request.put("developer_membership_ids", List.of(devMembership.toString()));
        request.put("qa_membership_ids", List.of(qaMembership.toString()));
        request.put("approver_membership_ids", List.of(qaMembership.toString()));
        request.put("phases", List.of(Map.of("ref", "p1", "name", "Build")));
        List<Map<String, Object>> tasks = new ArrayList<>();
        tasks.add(Map.of("ref", "t1", "title", "Login", "phase_ref", "p1", "points", 60));
        tasks.add(Map.of("ref", "t2", "title", "Release", "phase_ref", "p1", "points", 40));
        request.put("tasks", tasks);
        return tree(mockMvc.perform(auth(post("/v1/organizations/{o}/project-setup", orgId), token).contentType("application/json")
                .content(json(request))).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString())
                .path("project").path("id").asText();
    }

    private UUID organization(String token) throws Exception {
        String slug = "gh-" + UUID.randomUUID().toString().substring(0, 6);
        return UUID.fromString(tree(mockMvc.perform(auth(post("/v1/organizations"), token).contentType("application/json")
                        .content("{\"name\":\"" + slug + "\",\"slug\":\"" + slug + "\",\"timezone\":\"UTC\","
                                + "\"calendar\":{\"workdays\":[1,2,3,4,5],\"holidays\":[]}}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString()).path("id").asText());
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
