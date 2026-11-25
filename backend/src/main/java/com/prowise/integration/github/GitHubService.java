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
    private static final int MAX_COMMITS = 100;

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final SecurityEvidenceService evidence;
    private final ProjectService projects;
    private final AppSecretCipher cipher;
    private final GitHubClient client;
    private final ChangeRecorder changes;
    private final TransactionTemplate transactions;
    private final String webhookBaseUrl;

    public GitHubService(JdbcTemplate jdbc, PermissionService permissions, SecurityEvidenceService evidence,
            ProjectService projects, AppSecretCipher cipher, GitHubClient client, ChangeRecorder changes,
            TransactionTemplate transactions, @Value("${prowise.github.webhook-base-url:}") String webhookBaseUrl) {
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

        GitHubClient.Repository repo;
        try {
            repo = client.repository(new GitHubClient.Credential(token), parts[0], parts[1]);
        } catch (GitHubClient.GitHubException e) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "GITHUB_ACCESS_FAILED", e.getMessage(),
                    List.of(new ApiError.FieldError(e.status() == 404 ? "repository" : "token", e.getMessage())));
        }
        if (!repo.fullName().equalsIgnoreCase(parts[0] + "/" + parts[1])) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "GITHUB_ACCESS_FAILED",
                    "GitHub answered for a different repository. Check the name.",
                    List.of(new ApiError.FieldError("repository", "does not match")));
        }

        String secret = newSecret();
        String fullName = repo.fullName();
        List<String> existing = jdbc.queryForList(
                "SELECT id FROM project_repository_links WHERE org_id = ? AND project_id = ? AND lower(repo_name) = lower(?)",
                String.class, orgId, project.id(), fullName);
        String id = existing.isEmpty() ? "prl-" + UUID.randomUUID().toString().substring(0, 12) : existing.get(0);
        if (existing.isEmpty()) {
            jdbc.update("""
                    INSERT INTO project_repository_links (id, org_id, project_id, repo_name, default_branch, provider, owner_name,
                        repo_short_name, token_ciphertext, webhook_secret_ciphertext, status, connected_by)
                    VALUES (?, ?, ?, ?, ?, 'GITHUB_TOKEN', ?, ?, ?, ?, 'ACTIVE', ?)
                    """, id, orgId, project.id(), fullName, repo.defaultBranch(), parts[0], parts[1], cipher.encrypt(token),
                    cipher.encrypt(secret), actor.userId());
        } else {
            jdbc.update("""
                    UPDATE project_repository_links SET repo_name = ?, default_branch = ?, provider = 'GITHUB_TOKEN',
                        owner_name = ?, repo_short_name = ?, token_ciphertext = ?, webhook_secret_ciphertext = ?, status = 'ACTIVE',
                        connected_by = ?, last_error = NULL, version = version + 1, updated_at = now()
                    WHERE id = ? AND org_id = ?
                    """, fullName, repo.defaultBranch(), parts[0], parts[1], cipher.encrypt(token), cipher.encrypt(secret),
                    actor.userId(), id, orgId);
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

    @Transactional
    public ConnectionView rotateWebhookSecret(Authentication authentication, String projectId, VersionRequest request) {
        UUID orgId = permissions.requireTokenOrganization(authentication);
        ProjectService.ProjectResponse project = projects.get(orgId, projectId, authentication);
        requireManage(authentication, orgId, project.id());
        Connection connection = requireActive(orgId, project.id());
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
        return jdbc.query(ACTIVITY + " WHERE org_id = ? AND project_id = ? AND source IS NOT NULL"
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
            String lastError, long version, String connectedByEmail) {}

    Connection active(UUID orgId, String projectId) {
        return jdbc.query(CONNECTION + " WHERE l.org_id = ? AND l.project_id = ? AND l.provider <> 'LEGACY' AND l.status <> 'DISCONNECTED'",
                (rs, n) -> connection(rs), orgId, projectId).stream().findFirst().orElse(null);
    }

    /** Any organization: only the signed webhook looks a connection up by its id. */
    Connection byId(String connectionId) {
        return jdbc.query(CONNECTION + " WHERE l.id = ? AND l.provider <> 'LEGACY' AND l.status <> 'DISCONNECTED'",
                (rs, n) -> connection(rs), connectionId).stream().findFirst().orElse(null);
    }

    private static final String CONNECTION = """
            SELECT l.id, l.org_id, l.project_id, l.repo_name, l.owner_name, l.repo_short_name, l.default_branch,
                   l.token_ciphertext, l.webhook_secret_ciphertext, l.status, l.last_synced_at, l.last_error, l.version,
                   u.email AS connected_by_email
            FROM project_repository_links l LEFT JOIN users u ON u.id = l.connected_by
            """;

    private static Connection connection(java.sql.ResultSet rs) throws java.sql.SQLException {
        Timestamp synced = rs.getTimestamp("last_synced_at");
        return new Connection(rs.getString("id"), rs.getObject("org_id", UUID.class), rs.getString("project_id"),
                rs.getString("repo_name"), rs.getString("owner_name"), rs.getString("repo_short_name"),
                rs.getString("default_branch"), rs.getString("token_ciphertext"), rs.getString("webhook_secret_ciphertext"),
                rs.getString("status"), synced == null ? null : synced.toInstant(), rs.getString("last_error"),
                rs.getLong("version"), rs.getString("connected_by_email"));
    }

    String decryptSecret(Connection connection) {
        return cipher.decrypt(connection.secretCiphertext());
    }

    private GitHubClient.Credential credential(Connection connection) {
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

    private ConnectionView toView(Connection connection, boolean canManage, String secretOnce) {
        if (connection == null) return new ConnectionView(false, null, null, null, null, null, null, null, 0, canManage, null);
        String path = "/v1/integrations/github/webhooks/" + connection.id();
        return new ConnectionView(true, connection.id(), connection.repository(), connection.status(),
                connection.connectedByEmail(), connection.lastSyncedAt(), connection.lastError(),
                webhookBaseUrl.isEmpty() ? path : webhookBaseUrl + path, connection.version(), canManage, secretOnce);
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
            String webhookSecret) {}

    public record SyncResult(boolean connected, boolean ok, int linked, String problem) {
        static SyncResult notConnected() {
            return new SyncResult(false, true, 0, null);
        }
    }

    public record ActivityView(String id, String type, String author, String title, String message, String sha,
            Integer prNumber, String branch, String state, String taskKey, String url, Instant occurredAt, String source,
            String matchReason, String repository) {}
}
