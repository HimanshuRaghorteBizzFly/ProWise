package com.prowise.integration.github;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import com.prowise.authz.PermissionKey;
import com.prowise.authz.PermissionService;
import com.prowise.authz.SecurityEvidenceService;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.change.ChangeRecorder;
import com.prowise.common.crypto.AppSecretCipher;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.identity.AuthPrincipal;
import com.prowise.project.ProjectService;

/**
 * One GitHub repository per project (tasks 4.1 to 4.3, the parts the delivery flow needs).
 *
 * <ul>
 *   <li>Connect / disconnect / rotate the webhook secret: {@code repo.connect} (organization-wide or on the project;
 *       Owner and Admin by the matrix). The fine-grained read-only token is verified against GitHub, then stored
 *       encrypted (APP_ENCRYPTION_KEY). It is never returned, logged or put in audit rows. The webhook secret is shown
 *       once, when it is created, so it can be pasted into GitHub.</li>
 *   <li>Commits and pull requests are linked to a task when its key (e.g. PRW-12) is in the commit message, the branch
 *       name or the pull request title; Solo projects link commits that mention the project key. Fetched on submit
 *       and on demand, and received by the signed webhook. Evidence only: never completion or progress (rule 9).</li>
 *   <li>Everything is org-scoped: a connection belongs to one project of one organization, and a sync only ever reads
 *       the repository stored on that connection.</li>
 * </ul>
 */
@Service
public class GitHubService {

    private static final SecureRandom RANDOM = new SecureRandom();
    static final String APP = "GITHUB_APP";
    private static final int IMPORT_COMMITS = 30;
    private static final int IMPORT_PULL_REQUESTS = 20;
    private static final int MAX_COMMITS = 100;

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final SecurityEvidenceService evidence;
    private final ProjectService projects;
    private final AppSecretCipher cipher;
    private final GitHubClient client;
    private final ChangeRecorder changes;
    private final TransactionTemplate transactions;
    private final GitHubAppApi app;
    private final String webhookBaseUrl;

    public GitHubService(JdbcTemplate jdbc, PermissionService permissions, SecurityEvidenceService evidence,
            ProjectService projects, AppSecretCipher cipher, GitHubClient client, ChangeRecorder changes,
            TransactionTemplate transactions, GitHubAppApi app,
            @Value("${prowise.github.webhook-base-url:}") String webhookBaseUrl) {
        this.app = app;
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.evidence = evidence;
        this.projects = projects;
        this.cipher = cipher;
        this.client = client;
        this.changes = changes;
        this.transactions = transactions;
        this.webhookBaseUrl = webhookBaseUrl == null ? "" : webhookBaseUrl.trim().replaceAll("/+$", "");
    }

    /* ================================================================== connection */

    @Transactional(readOnly = true)
    public ConnectionView view(Authentication authentication, String projectId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        boolean canManage = canManage(authentication, orgId, project.id());
        Connection connection = active(orgId, project.id());
        return toView(connection, canManage, null);
    }

    @Transactional
    public ConnectionView connect(Authentication authentication, String projectId, ConnectRequest request) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        requireManage(authentication, orgId, project.id());
        AuthPrincipal actor = permissions.principal(authentication);
        if (request == null) throw validation("repository", "is required");
        String[] parts = repository(request.repository());
        String token = request.token() == null ? "" : request.token().trim();
        if (token.isEmpty() || token.length() > 255 || token.chars().anyMatch(Character::isWhitespace)) {
            throw validation("token", "paste the fine-grained read-only token");
        }
        if (!cipher.isAvailable()) cipher.encrypt("probe"); // 503 ENCRYPTION_KEY_MISSING before calling GitHub
        jdbc.queryForList("SELECT id FROM projects WHERE id = ? AND org_id = ? FOR UPDATE", project.id(), orgId);
        if (active(orgId, project.id()) != null) {
            throw new ApiException(HttpStatus.CONFLICT, "REPOSITORY_ALREADY_CONNECTED",
                    "This project already has a connected repository. Disconnect it first.");
        }

        GitHubClient.Repository repo = verify(token, parts);

        String secret = newSecret();
        String fullName = repo.fullName();
        List<String> existing = jdbc.queryForList(
                "SELECT id FROM project_repository_links WHERE org_id = ? AND project_id = ? AND lower(repo_name) = lower(?)",
                String.class, orgId, project.id(), fullName);
        String id = existing.isEmpty() ? "prl-" + UUID.randomUUID().toString().substring(0, 12) : existing.get(0);
        if (existing.isEmpty()) {
            jdbc.update("""
                    INSERT INTO project_repository_links (id, org_id, project_id, repo_name, default_branch, provider, owner_name,
                        repo_short_name, token_ciphertext, webhook_secret_ciphertext, status, connected_by, token_last4)
                    VALUES (?, ?, ?, ?, ?, 'GITHUB_TOKEN', ?, ?, ?, ?, 'ACTIVE', ?, ?)
                    """, id, orgId, project.id(), fullName, repo.defaultBranch(), parts[0], parts[1], cipher.encrypt(token),
                    cipher.encrypt(secret), actor.userId(), last4(token));
        } else {
            jdbc.update("""
                    UPDATE project_repository_links SET repo_name = ?, default_branch = ?, provider = 'GITHUB_TOKEN',
                        owner_name = ?, repo_short_name = ?, token_ciphertext = ?, webhook_secret_ciphertext = ?, status = 'ACTIVE',
                        connected_by = ?, last_error = NULL, token_last4 = ?, version = version + 1, updated_at = now()
                    WHERE id = ? AND org_id = ?
                    """, fullName, repo.defaultBranch(), parts[0], parts[1], cipher.encrypt(token), cipher.encrypt(secret),
                    actor.userId(), last4(token), id, orgId);
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("repository", fullName);
        snapshot.put("provider", "GITHUB_TOKEN");
        snapshot.put("project_id", project.id());
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, actor.userId(), "repository.connected", "PROJECT",
                        UUID.fromString(project.id()), null, null, snapshot),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()), project.version(),
                        "RepositoryConnected", snapshot));
        return toView(active(orgId, project.id()), true, secret);
    }

    /** Result of checking a repository before a project exists (Create Project draft). The token is not echoed. */
    public record VerifiedRepository(String fullName, String owner, String repo, String defaultBranch, String tokenCiphertext,
            String tokenLast4) {}

    /**
     * Checks with the real GitHub API that {@code token} can read {@code repository} and returns it with the token
     * already encrypted. The caller decides who may do this (the draft's creator, see ProjectDraftService).
     */
    public VerifiedRepository verifyForDraft(String repository, String token) {
        String[] parts = repository(repository);
        String clean = cleanToken(token);
        String ciphertext = cipher.encrypt(clean); // 503 ENCRYPTION_KEY_MISSING before calling GitHub
        GitHubClient.Repository repo = verify(clean, parts);
        return new VerifiedRepository(repo.fullName(), parts[0], parts[1], repo.defaultBranch(), ciphertext, last4(clean));
    }

    /** Replaces the stored token of the connected repository after checking the new one can read it. */
    @Transactional
    public ConnectionView replaceToken(Authentication authentication, String projectId, TokenRequest request) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        requireManage(authentication, orgId, project.id());
        Connection connection = requireActive(orgId, project.id());
        requireTokenProvider(connection);
        if (request == null || request.expectedVersion() == null) throw validation("expected_version", "is required");
        ExpectedVersion.check(connection.version(), request.expectedVersion());
        String clean = cleanToken(request.token());
        String ciphertext = cipher.encrypt(clean);
        verify(clean, repository(connection.repository()));
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE project_repository_links SET token_ciphertext = ?, token_last4 = ?, last_error = NULL,
                    version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, ciphertext, last4(clean), connection.id(), orgId, connection.version()));
        record(orgId, permissions.principal(authentication).userId(), project, "repository.token_replaced",
                "RepositoryTokenReplaced", connection.repository());
        return toView(active(orgId, project.id()), true, null);
    }

    /** Real GitHub check with clear errors: wrong token, no access, repository not found, rate limit, unreachable. */
    private GitHubClient.Repository verify(String token, String[] parts) {
        GitHubClient.Repository repo;
        try {
            repo = client.repository(new GitHubClient.Credential(token), parts[0], parts[1]);
        } catch (GitHubClient.GitHubException e) {
            String code = switch (e.status()) {
                case 401 -> "GITHUB_TOKEN_INVALID";
                case 403 -> "GITHUB_NO_ACCESS";
                case 404 -> "GITHUB_REPO_NOT_FOUND";
                case 429 -> "GITHUB_RATE_LIMITED";
                case 400 -> "VALIDATION_FAILED";
                default -> "GITHUB_UNAVAILABLE";
            };
            HttpStatus status = e.status() == 429 ? HttpStatus.TOO_MANY_REQUESTS
                    : e.status() >= 500 ? HttpStatus.BAD_GATEWAY : HttpStatus.UNPROCESSABLE_ENTITY;
            throw new ApiException(status, code, e.getMessage(),
                    List.of(new ApiError.FieldError(e.status() == 404 || e.status() == 400 ? "repository" : "token", e.getMessage())));
        }
        if (!repo.fullName().equalsIgnoreCase(parts[0] + "/" + parts[1])) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "GITHUB_REPO_NOT_FOUND",
                    "GitHub answered for a different repository. Check the name.",
                    List.of(new ApiError.FieldError("repository", "does not match")));
        }
        return repo;
    }

    private static String cleanToken(String token) {
        String clean = token == null ? "" : token.trim();
        if (clean.isEmpty() || clean.length() > 255 || clean.chars().anyMatch(Character::isWhitespace)) {
            throw validation("token", "paste the fine-grained read-only token");
        }
        return clean;
    }

    /** The last 4 characters (shown so people recognise which token is stored); never the token itself. */
    static String last4(String token) {
        return token.length() <= 4 ? "****" : token.substring(token.length() - 4);
    }

    public record TokenRequest(String token, Long expectedVersion) {}

    /** Connects a just-activated project with a repository verified on its draft (inside the activation transaction). */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void connectFromDraft(UUID orgId, UUID actorId, String projectId, long projectVersion, String fullName,
            String defaultBranch, String tokenCiphertext, String tokenLast4) {
        String[] parts = repository(fullName);
        String id = "prl-" + UUID.randomUUID().toString().substring(0, 12);
        jdbc.update("""
                INSERT INTO project_repository_links (id, org_id, project_id, repo_name, default_branch, provider, owner_name,
                    repo_short_name, token_ciphertext, webhook_secret_ciphertext, status, connected_by, token_last4)
                VALUES (?, ?, ?, ?, ?, 'GITHUB_TOKEN', ?, ?, ?, ?, 'ACTIVE', ?, ?)
                """, id, orgId, projectId, fullName, defaultBranch == null ? "main" : defaultBranch, parts[0], parts[1],
                tokenCiphertext, cipher.encrypt(newSecret()), actorId, tokenLast4);
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("repository", fullName);
        snapshot.put("provider", "GITHUB_TOKEN");
        snapshot.put("project_id", projectId);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, actorId, "repository.connected", "PROJECT", UUID.fromString(projectId),
                        "Connected while creating the project", null, snapshot),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(projectId), projectVersion,
                        "RepositoryConnected", snapshot));
    }

    @Transactional
    public ConnectionView rotateWebhookSecret(Authentication authentication, String projectId, VersionRequest request) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        requireManage(authentication, orgId, project.id());
        Connection connection = requireActive(orgId, project.id());
        requireTokenProvider(connection);
        ExpectedVersion.check(connection.version(), expected(request));
        String secret = newSecret();
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE project_repository_links SET webhook_secret_ciphertext = ?, version = version + 1, updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, cipher.encrypt(secret), connection.id(), orgId, connection.version()));
        record(orgId, permissions.principal(authentication).userId(), project, "repository.webhook_rotated",
                "RepositoryWebhookRotated", connection.repository());
        return toView(active(orgId, project.id()), true, secret);
    }

    @Transactional
    public void disconnect(Authentication authentication, String projectId, VersionRequest request) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        requireManage(authentication, orgId, project.id());
        Connection connection = requireActive(orgId, project.id());
        ExpectedVersion.check(connection.version(), expected(request));
        // The credential is forgotten; linked evidence stays (it is history).
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE project_repository_links SET status = 'DISCONNECTED', token_ciphertext = NULL, version = version + 1,
                    updated_at = now()
                WHERE id = ? AND org_id = ? AND version = ?
                """, connection.id(), orgId, connection.version()));
        record(orgId, permissions.principal(authentication).userId(), project, "repository.disconnected",
                "RepositoryDisconnected", connection.repository());
    }

    /* ================================================================== GitHub App links */

    /** A repository chosen through the organization's GitHub App installation (already validated by the caller). */
    public record AppLink(String fullName, String branch, UUID installationRef, boolean privateRepository) {}

    /**
     * Links (or switches) the project's repository through the App installation: business change, audit and outbox in
     * the caller's transaction. A live link is replaced only with {@code expectedVersion}; the repository may not be
     * live on another project of the organization (each project has its own repository).
     */
    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void connectAppLink(UUID orgId, UUID actorId, String projectId, long projectVersion, AppLink link,
            Long expectedVersion, String reason) {
        String[] parts = repository(link.fullName());
        jdbc.queryForList("SELECT id FROM projects WHERE id = ? AND org_id = ? FOR UPDATE", projectId, orgId);
        Connection current = active(orgId, projectId);
        String previous = null;
        if (current != null) {
            if (expectedVersion == null) {
                throw new ApiException(HttpStatus.CONFLICT, "REPOSITORY_ALREADY_CONNECTED",
                        "This project already has a connected repository. Send expected_version to change it.");
            }
            ExpectedVersion.check(current.version(), expectedVersion);
            previous = current.repository() + "@" + current.defaultBranch();
            ExpectedVersion.requireUpdated(jdbc.update("""
                    UPDATE project_repository_links SET status = 'DISCONNECTED', token_ciphertext = NULL, version = version + 1,
                        updated_at = now()
                    WHERE id = ? AND org_id = ? AND version = ?
                    """, current.id(), orgId, current.version()));
        }
        requireNotInUse(orgId, projectId, link.fullName());
        try {
            jdbc.update("""
                    INSERT INTO project_repository_links (id, org_id, project_id, repo_name, default_branch, provider, owner_name,
                        repo_short_name, installation_ref, repo_private, status, connected_by)
                    VALUES (?, ?, ?, ?, ?, 'GITHUB_APP', ?, ?, ?, ?, 'ACTIVE', ?)
                    """, "prl-" + UUID.randomUUID().toString().substring(0, 12), orgId, projectId, link.fullName(),
                    link.branch(), parts[0], parts[1], link.installationRef(), link.privateRepository(), actorId);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            throw repositoryInUse();
        }
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("repository", link.fullName());
        snapshot.put("branch", link.branch());
        snapshot.put("provider", APP);
        snapshot.put("project_id", projectId);
        if (previous != null) snapshot.put("previous", previous);
        changes.record(
                new ChangeRecorder.AuditEntry(orgId, actorId, previous == null ? "repository.connected" : "repository.changed",
                        "PROJECT", UUID.fromString(projectId), reason, null, snapshot),
                new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(projectId), projectVersion,
                        previous == null ? "RepositoryConnected" : "RepositoryChanged", snapshot));
    }

    /** 409 when the repository is live on another project of the organization. */
    void requireNotInUse(UUID orgId, String projectId, String fullName) {
        List<String> inUse = jdbc.queryForList("""
                SELECT project_id FROM project_repository_links
                WHERE org_id = ? AND lower(repo_name) = lower(?) AND provider <> 'LEGACY' AND status <> 'DISCONNECTED'
                  AND (CAST(? AS varchar) IS NULL OR project_id <> ?)
                """, String.class, orgId, fullName, projectId, projectId);
        if (!inUse.isEmpty()) throw repositoryInUse();
    }

    private static ApiException repositoryInUse() {
        return new ApiException(HttpStatus.CONFLICT, "REPOSITORY_IN_USE",
                "This repository is already connected to another project. Each project has its own repository.",
                List.of(new ApiError.FieldError("repository", "is connected to another project")));
    }

    /**
     * Imports recent commits (on the connected branch) and pull requests into the project's activity feed with their
     * code-change stats, and links those that carry a task key (Team) or the project key (Solo) as task evidence.
     * Network calls run outside any transaction; a GitHub problem is stored on the connection and returned. Never
     * touches completion, status or progress (rule 9).
     */
    public SyncResult importRecent(UUID orgId, String projectId, UUID actorId) {
        Connection connection = active(orgId, projectId);
        if (connection == null) return SyncResult.notConnected();
        Map<String, Object> project = jdbc.queryForMap("SELECT key, mode FROM projects WHERE id = ? AND org_id = ?",
                projectId, orgId);
        String projectKey = (String) project.get("key");
        boolean solo = "INDIVIDUAL".equals(project.get("mode"));
        TaskKeyMatcher matcher = new TaskKeyMatcher(projectKey);
        try {
            GitHubClient.Credential credential = credential(connection);
            String owner = connection.owner();
            String repo = connection.repo();
            List<GitHubClient.Commit> commits = orEmpty(client.commits(credential, owner, repo, connection.defaultBranch(),
                    null, IMPORT_COMMITS));
            java.util.Set<String> withStats = new java.util.HashSet<>(jdbc.queryForList("""
                    SELECT sha FROM github_activity
                    WHERE org_id = ? AND project_id = ? AND scope = 'FEED' AND event_type = 'COMMIT' AND additions IS NOT NULL
                    """, String.class, orgId, projectId));
            List<FeedItem> feed = new ArrayList<>();
            for (GitHubClient.Commit commit : commits) {
                GitHubClient.ChangeStats stats = withStats.contains(commit.sha()) ? null
                        : stats(() -> client.commitStats(credential, owner, repo, commit.sha()));
                feed.add(FeedItem.commit(commit, connection.defaultBranch(), stats));
            }
            List<GitHubClient.PullRequest> pulls = orEmpty(client.pullRequests(credential, owner, repo, IMPORT_PULL_REQUESTS));
            for (GitHubClient.PullRequest pull : pulls) {
                feed.add(FeedItem.pullRequest(pull, stats(() -> client.pullRequestStats(credential, owner, repo, pull.number()))));
            }
            int added = storeFeed(connection, feed, "IMPORT", actorId);
            linkEvidence(orgId, projectId, connection, commits, pulls, matcher, projectKey, solo, actorId);
            return new SyncResult(true, true, added, null);
        } catch (GitHubClient.GitHubException e) {
            return failed(orgId, connection, e);
        }
    }

    /** Manual "Sync now" from the project (repo.connect on the project). */
    public SyncResult syncRepository(Authentication authentication, String projectId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        requireManage(authentication, orgId, project.id());
        if (active(orgId, project.id()) == null) throw PermissionService.notFound();
        return importRecent(orgId, project.id(), permissions.principal(authentication).userId());
    }

    private void linkEvidence(UUID orgId, String projectId, Connection connection, List<GitHubClient.Commit> commits,
            List<GitHubClient.PullRequest> pulls, TaskKeyMatcher matcher, String projectKey, boolean solo, UUID actorId) {
        Map<String, List<Linked>> byKey = new LinkedHashMap<>();
        for (GitHubClient.Commit commit : commits) {
            if (solo) {
                if (matcher.mentionsProject(commit.message())) {
                    byKey.computeIfAbsent(projectKey, k -> new ArrayList<>()).add(Linked.commit(commit, connection.defaultBranch(), "MESSAGE"));
                }
                continue;
            }
            for (String key : matcher.taskKeys(commit.message())) {
                byKey.computeIfAbsent(key, k -> new ArrayList<>()).add(Linked.commit(commit, connection.defaultBranch(), "MESSAGE"));
            }
        }
        for (GitHubClient.PullRequest pull : pulls) {
            if (solo) {
                if (matcher.mentionsProject(pull.title()) || (pull.branch() != null && matcher.mentionsProject(pull.branch()))) {
                    byKey.computeIfAbsent(projectKey, k -> new ArrayList<>()).add(Linked.pullRequest(pull));
                }
                continue;
            }
            java.util.Set<String> keys = new java.util.LinkedHashSet<>(matcher.taskKeys(pull.title()));
            if (pull.branch() != null) keys.addAll(matcher.taskKeys(pull.branch()));
            for (String key : keys) byKey.computeIfAbsent(key, k -> new ArrayList<>()).add(Linked.pullRequest(pull));
        }
        for (Map.Entry<String, List<Linked>> entry : byKey.entrySet()) {
            String itemId = solo ? null : jdbc.queryForList("""
                    SELECT id FROM work_items WHERE org_id = ? AND project_id = ? AND upper(key) = upper(?) AND plan_status <> 'RETIRED'
                    """, String.class, orgId, projectId, entry.getKey()).stream().findFirst().orElse(null);
            if (!solo && itemId == null) continue;
            store(orgId, projectId, itemId, entry.getKey(), connection, entry.getValue(), "FETCH", actorId);
        }
    }

    /** One commit or pull request in the project's activity feed, with optional code-change stats. */
    record FeedItem(String type, String sha, Integer prNumber, String message, String actor, String branch, String baseBranch,
            String state, String url, Instant at, Integer additions, Integer deletions, Integer filesChanged) {
        static FeedItem commit(GitHubClient.Commit commit, String branch, GitHubClient.ChangeStats stats) {
            return new FeedItem("COMMIT", commit.sha(), null, commit.message(),
                    commit.authorLogin() != null ? commit.authorLogin() : commit.authorName() != null ? commit.authorName() : "unknown",
                    branch, null, null, commit.url(), commit.committedAt(),
                    stats == null ? null : stats.additions(), stats == null ? null : stats.deletions(),
                    stats == null ? null : stats.filesChanged());
        }

        static FeedItem pullRequest(GitHubClient.PullRequest pull, GitHubClient.PullRequestStats stats) {
            String state = stats != null && stats.merged() ? "merged" : pull.state();
            return new FeedItem("PULL_REQUEST", null, pull.number(), pull.title(),
                    pull.authorLogin() == null ? "unknown" : pull.authorLogin(), pull.branch(),
                    stats == null ? null : stats.baseBranch(), state, pull.url(), pull.updatedAt(),
                    stats == null ? null : stats.additions(), stats == null ? null : stats.deletions(),
                    stats == null ? null : stats.filesChanged());
        }
    }

    /** Upserts feed rows (once per commit / pull request per project); audit and outbox when something is new. */
    int storeFeed(Connection connection, List<FeedItem> items, String source, UUID actorId) {
        if (items.isEmpty()) return 0;
        Integer added = transactions.execute(status -> {
            int inserted = 0;
            for (FeedItem item : items) {
                Boolean fresh = jdbc.queryForObject("""
                        INSERT INTO github_activity (id, repository_name, event_type, actor, title, detail, sha, pr_number, branch,
                            status, org_id, project_id, url, occurred_at, source, scope, additions, deletions, files_changed,
                            base_branch)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'FEED', ?, ?, ?, ?)
                        ON CONFLICT (project_id, event_type, (COALESCE(sha, 'pr-' || pr_number::text))) WHERE scope = 'FEED'
                        DO UPDATE SET repository_name = EXCLUDED.repository_name, title = EXCLUDED.title, detail = EXCLUDED.detail,
                            status = COALESCE(EXCLUDED.status, github_activity.status),
                            branch = COALESCE(github_activity.branch, EXCLUDED.branch),
                            base_branch = COALESCE(EXCLUDED.base_branch, github_activity.base_branch),
                            url = COALESCE(EXCLUDED.url, github_activity.url),
                            occurred_at = COALESCE(EXCLUDED.occurred_at, github_activity.occurred_at),
                            additions = COALESCE(EXCLUDED.additions, github_activity.additions),
                            deletions = COALESCE(EXCLUDED.deletions, github_activity.deletions),
                            files_changed = COALESCE(EXCLUDED.files_changed, github_activity.files_changed)
                        RETURNING (xmax = 0)
                        """, Boolean.class, "gha-" + UUID.randomUUID(), connection.repository(), item.type(),
                        clip(item.actor(), 100), clip(firstLine(item.message()), 255), clip(item.message(), 4000), item.sha(),
                        item.prNumber(), clip(item.branch(), 100), clip(item.state(), 30), connection.orgId(),
                        connection.projectId(), clip(item.url(), 500), item.at() == null ? null : Timestamp.from(item.at()),
                        source, item.additions(), item.deletions(), item.filesChanged(), clip(item.baseBranch(), 100));
                if (Boolean.TRUE.equals(fresh)) inserted++;
            }
            jdbc.update("UPDATE project_repository_links SET last_synced_at = now(), last_error = NULL WHERE id = ? AND org_id = ?",
                    connection.id(), connection.orgId());
            if (inserted > 0) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("repository", connection.repository());
                data.put("imported", inserted);
                data.put("source", source);
                data.put("project_id", connection.projectId());
                changes.record(
                        new ChangeRecorder.AuditEntry(connection.orgId(), actorId, "github.activity_imported", "PROJECT",
                                UUID.fromString(connection.projectId()), null, null, data),
                        new ChangeRecorder.DomainEvent(connection.orgId(), "PROJECT", UUID.fromString(connection.projectId()), 0L,
                                "GitHubActivityImported", data));
            }
            return inserted;
        });
        return added == null ? 0 : added;
    }

    private static <T> T stats(java.util.function.Supplier<T> call) {
        try {
            return call.get();
        } catch (GitHubClient.GitHubException e) {
            if (e.status() == 429) throw e; // stop the import instead of spending the rest of the rate limit
            return null; // stats are optional; the row is still imported
        }
    }

    private static <T> List<T> orEmpty(List<T> list) {
        return list == null ? List.of() : list;
    }

    /* ================================================================== activity feed */

    public record FeedQuery(String type, String branch, String author, String q, Integer page, Integer size) {}

    public record FeedItemView(String id, String type, String sha, Integer prNumber, String title, String message,
            String author, String branch, String baseBranch, String state, String url, Instant occurredAt, Integer additions,
            Integer deletions, Integer filesChanged, List<String> taskKeys, String source) {}

    public record FeedPage(boolean connected, String repository, String repositoryUrl, String branch, Instant lastSyncedAt,
            String lastError, List<FeedItemView> items, long total, int page, int size, List<String> branches,
            List<String> authors) {}

    /** The project's GitHub activity feed (any reader of the project). Evidence only, never progress. */
    @Transactional(readOnly = true)
    public FeedPage feed(Authentication authentication, String projectId, FeedQuery query) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        Connection connection = active(orgId, project.id());
        int size = query == null || query.size() == null ? 20 : Math.max(1, Math.min(100, query.size()));
        int page = query == null || query.page() == null ? 0 : Math.max(0, query.page());
        StringBuilder where = new StringBuilder(" WHERE f.org_id = ? AND f.project_id = ? AND f.scope = 'FEED'");
        List<Object> args = new ArrayList<>(List.of(orgId, project.id()));
        if (connection != null) {
            where.append(" AND lower(f.repository_name) = lower(?)");
            args.add(connection.repository());
        }
        String base = where.toString();
        List<Object> baseArgs = List.copyOf(args);
        if (query != null && query.type() != null && !query.type().isBlank()) {
            String type = query.type().trim().toUpperCase(Locale.ROOT);
            if (!type.equals("COMMIT") && !type.equals("PULL_REQUEST")) throw validation("type", "use COMMIT or PULL_REQUEST");
            where.append(" AND f.event_type = ?");
            args.add(type);
        }
        if (query != null && query.branch() != null && !query.branch().isBlank()) {
            where.append(" AND f.branch = ?");
            args.add(clip(query.branch().trim(), 100));
        }
        if (query != null && query.author() != null && !query.author().isBlank()) {
            where.append(" AND f.actor = ?");
            args.add(clip(query.author().trim(), 100));
        }
        if (query != null && query.q() != null && !query.q().isBlank()) {
            String like = "%" + clip(query.q().trim(), 100).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" AND (f.title ILIKE ? OR f.sha ILIKE ? OR CAST(f.pr_number AS text) = ?)");
            args.add(like);
            args.add(clip(query.q().trim(), 64) + "%");
            args.add(query.q().trim().replace("#", ""));
        }
        Long total = jdbc.queryForObject("SELECT count(*) FROM github_activity f" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(size);
        pageArgs.add((long) page * size);
        List<FeedItemView> items = jdbc.query("""
                SELECT f.id, f.event_type, f.sha, f.pr_number, f.title, f.detail, f.actor, f.branch, f.base_branch, f.status,
                       f.url, COALESCE(f.occurred_at, f.created_at) AS at, f.additions, f.deletions, f.files_changed, f.source,
                       (SELECT string_agg(DISTINCT e.linked_task_key, ',') FROM github_activity e
                         WHERE e.org_id = f.org_id AND e.project_id = f.project_id AND e.scope = 'EVIDENCE'
                           AND e.event_type = f.event_type AND e.linked_task_key IS NOT NULL
                           AND COALESCE(e.sha, 'pr-' || e.pr_number::text) = COALESCE(f.sha, 'pr-' || f.pr_number::text)) AS task_keys
                FROM github_activity f""" + where + " ORDER BY at DESC, f.created_at DESC LIMIT ? OFFSET ?",
                (rs, n) -> {
                    String keys = rs.getString("task_keys");
                    return new FeedItemView(rs.getString("id"), rs.getString("event_type"), rs.getString("sha"),
                            (Integer) rs.getObject("pr_number"), rs.getString("title"), rs.getString("detail"),
                            rs.getString("actor"), rs.getString("branch"), rs.getString("base_branch"), rs.getString("status"),
                            rs.getString("url"), rs.getTimestamp("at").toInstant(), (Integer) rs.getObject("additions"),
                            (Integer) rs.getObject("deletions"), (Integer) rs.getObject("files_changed"),
                            keys == null ? List.of() : List.of(keys.split(",")), rs.getString("source"));
                }, pageArgs.toArray());
        List<String> branches = jdbc.queryForList("SELECT DISTINCT f.branch FROM github_activity f" + base
                + " AND f.branch IS NOT NULL ORDER BY f.branch LIMIT 50", String.class, baseArgs.toArray());
        List<String> authors = jdbc.queryForList("SELECT DISTINCT f.actor FROM github_activity f" + base
                + " ORDER BY f.actor LIMIT 50", String.class, baseArgs.toArray());
        return new FeedPage(connection != null, connection == null ? null : connection.repository(),
                connection == null ? null : "https://github.com/" + connection.repository(),
                connection == null ? null : connection.defaultBranch(), connection == null ? null : connection.lastSyncedAt(),
                connection == null ? null : connection.lastError(), items, total == null ? 0 : total, page, size, branches,
                authors);
    }

    /* ================================================================== sync */

    /**
     * Fetches GitHub activity for one task and links what mentions its key. Never throws: a GitHub problem is stored
     * on the connection (shown to admins) and the result says so. Network calls run outside any transaction.
     */
    public SyncResult syncTask(Authentication authentication, String workItemId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        Map<String, Object> item = workItem(orgId, workItemId, authentication);
        return syncTaskInternal(orgId, (String) item.get("project_id"), (String) item.get("id"), (String) item.get("key"),
                permissions.principal(authentication).userId());
    }

    /** Solo projects: commits that mention the project key. */
    public SyncResult syncProject(Authentication authentication, String projectId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        Connection connection = active(orgId, project.id());
        if (connection == null) return SyncResult.notConnected();
        TaskKeyMatcher matcher = new TaskKeyMatcher(project.key());
        try {
            GitHubClient.Credential credential = credential(connection);
            Instant since = project.createdAt().minus(1, ChronoUnit.DAYS);
            List<Linked> found = new ArrayList<>();
            for (GitHubClient.Commit commit : client.commits(credential, connection.owner(), connection.repo(), null, since, MAX_COMMITS)) {
                if (matcher.mentionsProject(commit.message())) found.add(Linked.commit(commit, null, "MESSAGE"));
            }
            return store(orgId, project.id(), null, project.key(), connection, found, "FETCH",
                    permissions.principal(authentication).userId());
        } catch (GitHubClient.GitHubException e) {
            return failed(orgId, connection, e);
        }
    }

    SyncResult syncTaskInternal(UUID orgId, String projectId, String itemId, String key, UUID actorId) {
        Connection connection = active(orgId, projectId);
        if (connection == null) return SyncResult.notConnected();
        String projectKey = key.substring(0, key.lastIndexOf('-'));
        TaskKeyMatcher matcher = new TaskKeyMatcher(projectKey);
        try {
            GitHubClient.Credential credential = credential(connection);
            Instant since = jdbc.queryForObject("SELECT created_at FROM projects WHERE id = ? AND org_id = ?",
                    Timestamp.class, projectId, orgId).toInstant().minus(1, ChronoUnit.DAYS);
            List<Linked> found = new ArrayList<>();
            for (GitHubClient.Commit commit : client.commits(credential, connection.owner(), connection.repo(), null, since, MAX_COMMITS)) {
                if (matcher.taskKeys(commit.message()).contains(key)) found.add(Linked.commit(commit, null, "MESSAGE"));
            }
            for (String branch : client.branches(credential, connection.owner(), connection.repo(), 100)) {
                if (!matcher.taskKeys(branch).contains(key) || branch.equals(connection.defaultBranch())) continue;
                for (GitHubClient.Commit commit : client.compare(credential, connection.owner(), connection.repo(),
                        connection.defaultBranch(), branch, 50)) {
                    found.add(Linked.commit(commit, branch, "BRANCH"));
                }
            }
            for (GitHubClient.PullRequest pr : client.pullRequests(credential, connection.owner(), connection.repo(), 50)) {
                boolean mentioned = matcher.taskKeys(pr.title()).contains(key)
                        || (pr.branch() != null && matcher.taskKeys(pr.branch()).contains(key));
                if (!mentioned) continue;
                found.add(Linked.pullRequest(pr));
                for (GitHubClient.Commit commit : client.pullRequestCommits(credential, connection.owner(), connection.repo(),
                        pr.number(), 50)) {
                    found.add(Linked.commit(commit, pr.branch(), "PULL_REQUEST"));
                }
            }
            return store(orgId, projectId, itemId, key, connection, found, "FETCH", actorId);
        } catch (GitHubClient.GitHubException e) {
            return failed(orgId, connection, e);
        }
    }

    /** Writes linked activity once (unique per task/project and commit or pull request), with audit and outbox. */
    SyncResult store(UUID orgId, String projectId, String itemId, String key, Connection connection, List<Linked> found,
            String source, UUID actorId) {
        Integer added = transactions.execute(status -> {
            int inserted = 0;
            for (Linked link : found) {
                inserted += jdbc.update("""
                        INSERT INTO github_activity (id, repository_name, event_type, actor, title, detail, sha, pr_number, branch,
                            status, linked_task_key, org_id, project_id, work_item_id, url, occurred_at, source, match_reason)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT DO NOTHING
                        """, "gha-" + UUID.randomUUID(), connection.repository(), link.type(), clip(link.actor(), 100),
                        clip(firstLine(link.title()), 255), clip(link.title(), 4000), link.sha(), link.prNumber(),
                        clip(link.branch(), 100), clip(link.state(), 30), key, orgId, projectId, itemId, clip(link.url(), 500),
                        link.at() == null ? null : Timestamp.from(link.at()), source, link.matchReason());
            }
            jdbc.update("UPDATE project_repository_links SET last_synced_at = now(), last_error = NULL WHERE id = ? AND org_id = ?",
                    connection.id(), orgId);
            if (inserted > 0) {
                Map<String, Object> data = new LinkedHashMap<>();
                data.put("repository", connection.repository());
                data.put("linked", inserted);
                data.put("key", key);
                data.put("source", source);
                data.put("project_id", projectId);
                if (itemId != null) data.put("work_item_id", itemId);
                changes.record(
                        new ChangeRecorder.AuditEntry(orgId, actorId, "github.activity_linked", "PROJECT",
                                UUID.fromString(projectId), null, null, data),
                        new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(projectId), 0L,
                                "GitHubActivityLinked", data));
            }
            return inserted;
        });
        return new SyncResult(true, true, added == null ? 0 : added, null);
    }

    private SyncResult failed(UUID orgId, Connection connection, GitHubClient.GitHubException e) {
        transactions.executeWithoutResult(status -> jdbc.update(
                "UPDATE project_repository_links SET last_error = ? WHERE id = ? AND org_id = ?",
                clip(e.getMessage(), 500), connection.id(), orgId));
        return new SyncResult(true, false, 0, e.getMessage());
    }

    /* ================================================================== reads */

    @Transactional(readOnly = true)
    public List<ActivityView> taskActivity(Authentication authentication, String workItemId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        Map<String, Object> item = workItem(orgId, workItemId, authentication);
        return jdbc.query(ACTIVITY + " WHERE org_id = ? AND work_item_id = ? ORDER BY occurred_at DESC NULLS LAST, created_at DESC",
                (rs, n) -> activity(rs), orgId, item.get("id"));
    }

    @Transactional(readOnly = true)
    public List<ActivityView> projectActivity(Authentication authentication, String projectId) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        return jdbc.query(ACTIVITY + " WHERE org_id = ? AND project_id = ? AND source IS NOT NULL AND scope = 'EVIDENCE'"
                + " ORDER BY occurred_at DESC NULLS LAST, created_at DESC LIMIT 200", (rs, n) -> activity(rs), orgId, project.id());
    }

    private static final String ACTIVITY = """
            SELECT id, event_type, actor, title, detail, sha, pr_number, branch, status, linked_task_key, url, occurred_at,
                   created_at, source, match_reason, repository_name
            FROM github_activity
            """;

    private static ActivityView activity(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp at = rs.getTimestamp("occurred_at");
        return new ActivityView(rs.getString("id"), rs.getString("event_type"), rs.getString("actor"), rs.getString("title"),
                rs.getString("detail"), rs.getString("sha"), (Integer) rs.getObject("pr_number"), rs.getString("branch"),
                rs.getString("status"), rs.getString("linked_task_key"), rs.getString("url"),
                at == null ? rs.getTimestamp("created_at").toInstant() : at.toInstant(), rs.getString("source"),
                rs.getString("match_reason"), rs.getString("repository_name"));
    }

    /* ================================================================== helpers */

    record Connection(String id, UUID orgId, String projectId, String repository, String owner, String repo,
            String defaultBranch, String tokenCiphertext, String secretCiphertext, String status, Instant lastSyncedAt,
            String lastError, long version, String connectedByEmail, String tokenLast4, String provider,
            UUID installationRef, Long installationGithubId, String installationStatus, String installationAccount,
            Boolean privateRepository) {}

    Connection active(UUID orgId, String projectId) {
        return jdbc.query(CONNECTION + " WHERE l.org_id = ? AND l.project_id = ? AND l.provider <> 'LEGACY' AND l.status <> 'DISCONNECTED'",
                (rs, n) -> connection(rs), orgId, projectId).stream().findFirst().orElse(null);
    }

    /** Any organization: only the signed per-repository webhook (token connections) looks a connection up by its id. */
    Connection byId(String connectionId) {
        return jdbc.query(CONNECTION + " WHERE l.id = ? AND l.provider = 'GITHUB_TOKEN' AND l.status <> 'DISCONNECTED'",
                (rs, n) -> connection(rs), connectionId).stream().findFirst().orElse(null);
    }

    /** Any organization: the App webhook finds the live link of a repository through the installation that sent it. */
    Connection byInstallationRepository(long installationGithubId, String fullName) {
        return jdbc.query(CONNECTION + " WHERE l.provider = 'GITHUB_APP' AND l.status = 'ACTIVE' AND i.installation_id = ?"
                + " AND i.status = 'ACTIVE' AND lower(l.repo_name) = lower(?)",
                (rs, n) -> connection(rs), installationGithubId, fullName).stream().findFirst().orElse(null);
    }

    private static final String CONNECTION = """
            SELECT l.id, l.org_id, l.project_id, l.repo_name, l.owner_name, l.repo_short_name, l.default_branch,
                   l.token_ciphertext, l.webhook_secret_ciphertext, l.status, l.last_synced_at, l.last_error, l.version, l.token_last4,
                   l.provider, l.installation_ref, l.repo_private, i.installation_id AS installation_github_id,
                   i.status AS installation_status, i.account_login AS installation_account,
                   u.email AS connected_by_email
            FROM project_repository_links l LEFT JOIN users u ON u.id = l.connected_by
            LEFT JOIN github_app_installations i ON i.id = l.installation_ref AND i.org_id = l.org_id
            """;

    private static Connection connection(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp synced = rs.getTimestamp("last_synced_at");
        return new Connection(rs.getString("id"), rs.getObject("org_id", UUID.class), rs.getString("project_id"),
                rs.getString("repo_name"), rs.getString("owner_name"), rs.getString("repo_short_name"),
                rs.getString("default_branch"), rs.getString("token_ciphertext"), rs.getString("webhook_secret_ciphertext"),
                rs.getString("status"), synced == null ? null : synced.toInstant(), rs.getString("last_error"),
                rs.getLong("version"), rs.getString("connected_by_email"), rs.getString("token_last4"),
                rs.getString("provider"), rs.getObject("installation_ref", UUID.class),
                (Long) rs.getObject("installation_github_id"), rs.getString("installation_status"),
                rs.getString("installation_account"), (Boolean) rs.getObject("repo_private"));
    }

    String decryptSecret(Connection connection) {
        return cipher.decrypt(connection.secretCiphertext());
    }

    GitHubClient.Credential credential(Connection connection) {
        if (APP.equals(connection.provider())) {
            if (connection.installationGithubId() == null || !"ACTIVE".equals(connection.installationStatus())) {
                throw new GitHubClient.GitHubException(403,
                        "The organization's GitHub App installation is suspended or removed. An admin can reconnect GitHub.");
            }
            return app.installationToken(connection.installationGithubId());
        }
        if (connection.tokenCiphertext() == null) throw new GitHubClient.GitHubException(401, "No token is stored.");
        return new GitHubClient.Credential(cipher.decrypt(connection.tokenCiphertext()));
    }

    private Connection requireActive(UUID orgId, String projectId) {
        Connection connection = active(orgId, projectId);
        if (connection == null) throw PermissionService.notFound();
        return connection;
    }

    private boolean canManage(Authentication authentication, UUID orgId, String projectId) {
        return permissions.canOnProject(authentication, orgId, projectId, PermissionKey.REPO_CONNECT.value());
    }

    private void requireManage(Authentication authentication, UUID orgId, String projectId) {
        if (!canManage(authentication, orgId, projectId)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "REPO_CONNECT_REQUIRED",
                    "Connecting a repository needs the repo.connect permission. Ask an organization admin.");
        }
    }

    ConnectionView toView(Connection connection, boolean canManage, String secretOnce) {
        if (connection == null) {
            return new ConnectionView(false, null, null, null, null, null, null, null, 0, canManage, null, null, null, null,
                    null, null, null, null, 0);
        }
        boolean viaApp = APP.equals(connection.provider());
        String path = "/v1/integrations/github/webhooks/" + connection.id();
        Integer feed = jdbc.queryForObject(
                "SELECT count(*) FROM github_activity WHERE org_id = ? AND project_id = ? AND scope = 'FEED'",
                Integer.class, connection.orgId(), connection.projectId());
        // App links: GitHub delivers events to the App's own webhook, so there is no per-repository URL or secret.
        return new ConnectionView(true, connection.id(), connection.repository(), connection.status(),
                connection.connectedByEmail(), connection.lastSyncedAt(), connection.lastError(),
                viaApp ? null : webhookBaseUrl.isEmpty() ? path : webhookBaseUrl + path, connection.version(), canManage,
                secretOnce, connection.tokenLast4(), "https://github.com/" + connection.repository(), connection.provider(),
                connection.defaultBranch(), connection.installationRef(), connection.installationAccount(),
                connection.privateRepository(), feed == null ? 0 : feed);
    }

    private static void requireTokenProvider(Connection connection) {
        if (APP.equals(connection.provider())) {
            throw new ApiException(HttpStatus.CONFLICT, "NOT_A_TOKEN_CONNECTION",
                    "This repository is connected through the organization's GitHub App; it has no token or webhook secret.");
        }
    }

    private void record(UUID orgId, UUID actorId, ProjectService.ProjectResponse project, String action, String event,
            String repository) {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("repository", repository);
        data.put("project_id", project.id());
        changes.record(new ChangeRecorder.AuditEntry(orgId, actorId, action, "PROJECT", UUID.fromString(project.id()), null,
                null, data), new ChangeRecorder.DomainEvent(orgId, "PROJECT", UUID.fromString(project.id()),
                project.version(), event, data));
    }

    /** The work item in this organization whose project the caller can read; else 404 with evidence. */
    private Map<String, Object> workItem(UUID orgId, String workItemId, Authentication authentication) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, project_id, key FROM work_items WHERE id = ? AND org_id = ?", workItemId == null ? "" : workItemId, orgId);
        if (rows.isEmpty() || !projects.readable(orgId, (String) rows.get(0).get("project_id"), authentication)) {
            evidence.recordDenied(permissions.principal(authentication), SecurityEvidenceService.ACCESS_DENIED, "WORK_ITEM",
                    workItemId == null ? null : workItemId.substring(0, Math.min(workItemId.length(), 100)),
                    "Foreign, unknown or unreadable work item");
            throw PermissionService.notFound();
        }
        return rows.get(0);
    }

    private static String[] repository(String value) {
        String repo = value == null ? "" : value.trim();
        if (repo.toLowerCase(Locale.ROOT).startsWith("https://github.com/")) repo = repo.substring("https://github.com/".length());
        if (repo.endsWith(".git")) repo = repo.substring(0, repo.length() - 4);
        repo = repo.replaceAll("/+$", "");
        String[] parts = repo.split("/");
        if (parts.length != 2 || !TokenGitHubClient.NAME.matcher(parts[0]).matches()
                || !TokenGitHubClient.NAME.matcher(parts[1]).matches()) {
            throw validation("repository", "use owner/name, for example acme/web");
        }
        return parts;
    }

    private static String newSecret() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }

    private static long expected(VersionRequest request) {
        if (request == null || request.expectedVersion() == null) throw validation("expected_version", "is required");
        return request.expectedVersion();
    }

    static String firstLine(String value) {
        if (value == null) return "";
        int newline = value.indexOf('\n');
        return (newline < 0 ? value : value.substring(0, newline)).trim();
    }

    static String clip(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The request has invalid fields.",
                List.of(new ApiError.FieldError(field, message)));
    }

    /* ================================================================== records */

    /** One commit or pull request to link. */
    record Linked(String type, String sha, Integer prNumber, String title, String actor, String branch, String state,
            String url, Instant at, String matchReason) {
        static Linked commit(GitHubClient.Commit commit, String branch, String reason) {
            return new Linked("COMMIT", commit.sha(), null, commit.message(),
                    commit.authorLogin() != null ? commit.authorLogin() : commit.authorName() != null ? commit.authorName() : "unknown",
                    branch, null, commit.url(), commit.committedAt(), reason);
        }

        static Linked pullRequest(GitHubClient.PullRequest pr) {
            return new Linked("PULL_REQUEST", null, pr.number(), pr.title(), pr.authorLogin() == null ? "unknown" : pr.authorLogin(),
                    pr.branch(), pr.state(), pr.url(), pr.updatedAt(), "PULL_REQUEST");
        }
    }

    public record ConnectRequest(String repository, String token) {}

    public record VersionRequest(Long expectedVersion) {}

    /** The token is never part of this view. {@code webhookSecret} is present only right after it was created. */
    public record ConnectionView(boolean connected, String id, String repository, String status, String connectedBy,
            Instant lastSyncedAt, String lastError, String webhookUrl, long version, boolean canManage,
            String webhookSecret,
            /** Last 4 characters of the stored token (the token itself is never returned). */
            String tokenLast4, String repositoryUrl,
            /** GITHUB_APP (through the organization's installation) or GITHUB_TOKEN. */
            String provider, String branch, UUID installationId, String installationAccount, Boolean privateRepository,
            /** Imported commits and pull requests in the project's activity feed. */
            int activityCount) {}

    public record SyncResult(boolean connected, boolean ok, int linked, String problem) {
        static SyncResult notConnected() {
            return new SyncResult(false, true, 0, null);
        }
    }

    public record ActivityView(String id, String type, String author, String title, String message, String sha,
            Integer prNumber, String branch, String state, String taskKey, String url, Instant occurredAt, String source,
            String matchReason, String repository) {}
}
