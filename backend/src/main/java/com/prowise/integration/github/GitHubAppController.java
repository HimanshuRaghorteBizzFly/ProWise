package com.prowise.integration.github;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** GitHub through the Prowise GitHub App: connect once per organization, then one repository per project. */
@RestController
@Tag(name = "GitHub App", description = "Organization installation, repository and branch choice per project, activity feed")
public class GitHubAppController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final GitHubAppService installations;
    private final GitHubService github;
    private final GitHubWebhookService webhooks;

    public GitHubAppController(GitHubAppService installations, GitHubService github, GitHubWebhookService webhooks) {
        this.installations = installations;
        this.github = github;
        this.webhooks = webhooks;
    }

    /* ---- organization */

    @GetMapping("/v1/organizations/{orgId}/github/app")
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    @Operation(summary = "Whether the GitHub App is configured, the organization's installations and whether the caller manages them")
    public GitHubAppService.AppStatus status(@PathVariable UUID orgId, Authentication authentication) {
        return installations.status(authentication, orgId);
    }

    @PostMapping("/v1/organizations/{orgId}/github/app/install")
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    @Operation(summary = "Start connecting GitHub (organization-wide repo.connect): returns the GitHub install URL with a one-time state")
    public GitHubAppService.InstallStart install(@PathVariable UUID orgId,
            @RequestBody(required = false) GitHubAppService.InstallRequest request, Authentication authentication) {
        return installations.startInstall(authentication, orgId, request);
    }

    @PostMapping("/v1/integrations/github/app/callback")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Finish connecting: state, installation id and OAuth code from GitHub's setup redirect")
    public GitHubAppService.CallbackResult callback(@RequestBody GitHubAppService.CallbackRequest request,
            Authentication authentication) {
        return installations.complete(authentication, request);
    }

    @DeleteMapping("/v1/organizations/{orgId}/github/app/installations/{installationId}")
    @PreAuthorize("@permissionService.member(authentication, #orgId)")
    @Operation(summary = "Remove the installation from Prowise (its project links are disconnected; history stays)")
    public ResponseEntity<Void> remove(@PathVariable UUID orgId, @PathVariable UUID installationId,
            @RequestBody GitHubAppService.VersionRequest request, Authentication authentication) {
        installations.remove(authentication, orgId, installationId, request);
        return ResponseEntity.noContent().build();
    }

    /* ---- project (repo.connect on the project: creator, its PM, Owner/Admin) */

    @GetMapping("/v1/projects/{projectId}/github/app/repositories")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Repositories the installation can access, with the project already using each one")
    public List<GitHubAppService.RepositoryChoice> repositories(@PathVariable String projectId,
            @RequestParam("installation_id") UUID installationId, Authentication authentication) {
        return installations.projectRepositories(authentication, projectId, installationId);
    }

    @GetMapping("/v1/projects/{projectId}/github/app/branches")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Branches of one repository of the installation")
    public List<String> branches(@PathVariable String projectId, @RequestParam("installation_id") UUID installationId,
            @RequestParam String repository, Authentication authentication) {
        return installations.projectBranches(authentication, projectId, installationId, repository);
    }

    @PostMapping("/v1/projects/{projectId}/github/app/validate")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Check access, branch, App permissions, events and that no other project uses the repository")
    public GitHubAppService.Validation validate(@PathVariable String projectId,
            @RequestBody GitHubAppService.ChoiceRequest request, Authentication authentication) {
        return installations.projectValidate(authentication, projectId, request);
    }

    @PutMapping("/v1/projects/{projectId}/github/app")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Connect or change the project's repository and branch, then import recent commits and pull requests")
    public GitHubAppService.ConnectResult connect(@PathVariable String projectId,
            @RequestBody GitHubAppService.ChoiceRequest request, Authentication authentication) {
        return installations.connectProject(authentication, projectId, request);
    }

    @PostMapping("/v1/projects/{projectId}/github/sync")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Import recent commits and pull requests now (repo.connect); evidence only, never progress")
    public GitHubService.SyncResult sync(@PathVariable String projectId, Authentication authentication) {
        return github.syncRepository(authentication, projectId);
    }

    @GetMapping("/v1/projects/{projectId}/github/activity")
    @PreAuthorize(MEMBER)
    @Operation(summary = "The project's GitHub activity: commits and pull requests with authors, branches and code-change stats")
    public GitHubService.FeedPage activity(@PathVariable String projectId,
            @RequestParam(required = false) String type, @RequestParam(required = false) String branch,
            @RequestParam(required = false) String author, @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size,
            Authentication authentication) {
        return github.feed(authentication, projectId, new GitHubService.FeedQuery(type, branch, author, q, page, size));
    }

    /* ---- the App's webhook */

    /** Public on purpose: authenticated by the HMAC signature of the App's webhook secret, not by a session. */
    @PostMapping("/v1/integrations/github/app/webhook")
    @PreAuthorize("permitAll()")
    @Operation(summary = "GitHub App webhook (push, pull_request, installation, installation_repositories); signed; replays ignored")
    public Map<String, Object> webhook(@RequestHeader(value = "X-GitHub-Event", required = false) String event,
            @RequestHeader(value = "X-GitHub-Delivery", required = false) String delivery,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
            @RequestBody byte[] body) {
        GitHubWebhookService.Result result = webhooks.receiveApp(event, delivery, signature, body);
        return Map.of("status", result.status(), "linked", result.linked());
    }
}
