package com.prowise.integration.github;

import java.util.List;
import java.util.Map;

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
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/** GitHub repository per project, linked commits per task, and the signed webhook. */
@RestController
@Tag(name = "GitHub", description = "Connect one repository per project; commits linked to tasks by key (evidence only)")
public class GitHubController {

    private static final String MEMBER = "@permissionService.tokenOrgMember(authentication)";

    private final GitHubService github;
    private final GitHubWebhookService webhooks;

    public GitHubController(GitHubService github, GitHubWebhookService webhooks) {
        this.github = github;
        this.webhooks = webhooks;
    }

    @GetMapping("/v1/projects/{projectId}/github")
    @PreAuthorize(MEMBER)
    @Operation(summary = "The project's GitHub connection (never the token) and whether the caller may manage it")
    public GitHubService.ConnectionView connection(@PathVariable String projectId, Authentication authentication) {
        return github.view(authentication, projectId);
    }

    @PutMapping("/v1/projects/{projectId}/github")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Connect owner/repo with a fine-grained read-only token (repo.connect); returns the webhook secret once")
    public GitHubService.ConnectionView connect(@PathVariable String projectId,
            @RequestBody GitHubService.ConnectRequest request, Authentication authentication) {
        return github.connect(authentication, projectId, request);
    }

    @PutMapping("/v1/projects/{projectId}/github/token")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Replace the stored token (repo.connect on this project); verified against GitHub, never returned")
    public GitHubService.ConnectionView replaceToken(@PathVariable String projectId,
            @RequestBody GitHubService.TokenRequest request, Authentication authentication) {
        return github.replaceToken(authentication, projectId, request);
    }

    @PostMapping("/v1/projects/{projectId}/github/webhook-secret")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Rotate the webhook secret (repo.connect); returns the new secret once")
    public GitHubService.ConnectionView rotate(@PathVariable String projectId,
            @RequestBody GitHubService.VersionRequest request, Authentication authentication) {
        return github.rotateWebhookSecret(authentication, projectId, request);
    }

    @DeleteMapping("/v1/projects/{projectId}/github")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Disconnect the repository (repo.connect); the stored token is deleted, linked evidence stays")
    public ResponseEntity<Void> disconnect(@PathVariable String projectId,
            @RequestBody GitHubService.VersionRequest request, Authentication authentication) {
        github.disconnect(authentication, projectId, request);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/v1/work-items/{workItemId}/commits")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Commits and pull requests linked to the task by its key (evidence only, never progress)")
    public List<GitHubService.ActivityView> taskCommits(@PathVariable String workItemId, Authentication authentication) {
        return github.taskActivity(authentication, workItemId);
    }

    @PostMapping("/v1/work-items/{workItemId}/commits/refresh")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Fetch GitHub activity for the task now")
    public GitHubService.SyncResult refreshTask(@PathVariable String workItemId, Authentication authentication) {
        return github.syncTask(authentication, workItemId);
    }

    @GetMapping("/v1/projects/{projectId}/commits")
    @PreAuthorize(MEMBER)
    @Operation(summary = "GitHub activity linked to the project (Solo: commits that mention the project key)")
    public List<GitHubService.ActivityView> projectCommits(@PathVariable String projectId, Authentication authentication) {
        return github.projectActivity(authentication, projectId);
    }

    @PostMapping("/v1/projects/{projectId}/commits/refresh")
    @PreAuthorize(MEMBER)
    @Operation(summary = "Fetch commits that mention the project key now (Solo projects)")
    public GitHubService.SyncResult refreshProject(@PathVariable String projectId, Authentication authentication) {
        return github.syncProject(authentication, projectId);
    }

    /** Public on purpose: authenticated by the HMAC signature of the connection's secret, not by a session. */
    @PostMapping("/v1/integrations/github/webhooks/{connectionId}")
    @PreAuthorize("permitAll()")
    @Operation(summary = "GitHub webhook (push, pull_request); X-Hub-Signature-256 required; replays are ignored")
    public Map<String, Object> webhook(@PathVariable String connectionId,
            @RequestHeader(value = "X-GitHub-Event", required = false) String event,
            @RequestHeader(value = "X-GitHub-Delivery", required = false) String delivery,
            @RequestHeader(value = "X-Hub-Signature-256", required = false) String signature,
            @RequestBody byte[] body) {
        GitHubWebhookService.Result result = webhooks.receive(connectionId, event, delivery, signature, body);
        return Map.of("status", result.status(), "linked", result.linked());
    }
}
