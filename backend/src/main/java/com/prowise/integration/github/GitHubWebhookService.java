package com.prowise.integration.github;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.prowise.common.api.ApiException;

/**
 * Signed GitHub webhook for one connection ({@code POST /v1/integrations/github/webhooks/{connectionId}}).
 *
 * <ol>
 *   <li>The connection id in the URL selects the organization, project and secret; unknown or disconnected = 404.</li>
 *   <li>{@code X-Hub-Signature-256} must be the HMAC-SHA256 of the raw body with that connection's secret (constant-time
 *       comparison); otherwise 401 and nothing is stored.</li>
 *   <li>The payload's repository must be the connected one, so a connection can never ingest another repository.</li>
 *   <li>The delivery id ({@code X-GitHub-Delivery}) is stored once: a replayed delivery is acknowledged and ignored.</li>
 *   <li>push: commits whose message or branch carries a task key are linked to that task (Solo: the project key).
 *       pull_request: the pull request is linked by its title or branch. Evidence only (rule 9).</li>
 * </ol>
 */
@Service
public class GitHubWebhookService {

    private final JdbcTemplate jdbc;
    private final GitHubService github;
    private final ObjectMapper objectMapper;
    private final TransactionTemplate transactions;
    private final GitHubAppApi app;
    private final GitHubAppService installations;

    public GitHubWebhookService(JdbcTemplate jdbc, GitHubService github, ObjectMapper objectMapper,
            TransactionTemplate transactions, GitHubAppApi app, GitHubAppService installations) {
        this.jdbc = jdbc;
        this.github = github;
        this.objectMapper = objectMapper;
        this.transactions = transactions;
        this.app = app;
        this.installations = installations;
    }

    /**
     * The Prowise GitHub App's webhook ({@code POST /v1/integrations/github/app/webhook}): signed with the App's webhook
     * secret. installation / installation_repositories update the organization's installation and its links; push and
     * pull_request go to the project linked to that repository through that installation (none = ignored).
     */
    public Result receiveApp(String event, String deliveryId, String signature, byte[] body) {
        String secret = app.webhookSecret();
        if (secret == null || secret.isBlank()) {
            throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "The requested resource was not found.");
        }
        if (!validSignature(secret, signature, body)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_SIGNATURE", "The webhook signature does not match.");
        }
        if (deliveryId == null || deliveryId.isBlank() || deliveryId.length() > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "X-GitHub-Delivery is required.");
        }
        String type = event == null ? "" : event.trim();
        JsonNode payload = json(body);
        if ("ping".equals(type)) return new Result("pong", 0);
        if ("installation".equals(type) || "installation_repositories".equals(type)) {
            transactions.executeWithoutResult(status -> installations.installationEvent(type, payload));
            return new Result("processed", 0);
        }
        long installationId = payload.path("installation").path("id").asLong(0);
        String repository = payload.path("repository").path("full_name").asText("");
        GitHubService.Connection connection = installationId <= 0 || repository.isEmpty() ? null
                : github.byInstallationRepository(installationId, repository);
        if (connection == null) return new Result("ignored", 0);
        return process(connection, type, deliveryId.trim(), payload);
    }

    private JsonNode json(byte[] body) {
        try {
            return objectMapper.readTree(body);
        } catch (Exception e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "The webhook body is not JSON.");
        }
    }

    public Result receive(String connectionId, String event, String deliveryId, String signature, byte[] body) {
        GitHubService.Connection connection = connectionId == null ? null : github.byId(connectionId);
        if (connection == null) throw new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "The requested resource was not found.");
        if (!validSignature(github.decryptSecret(connection), signature, body)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "INVALID_SIGNATURE", "The webhook signature does not match.");
        }
        if (deliveryId == null || deliveryId.isBlank() || deliveryId.length() > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "X-GitHub-Delivery is required.");
        }
        String type = event == null ? "" : event.trim();
        JsonNode payload = json(body);
        String repository = payload.path("repository").path("full_name").asText("");
        if (!"ping".equals(type) && !repository.equalsIgnoreCase(connection.repository())) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "REPOSITORY_MISMATCH",
                    "This webhook is for a different repository than the connected one.");
        }
        return process(connection, type, deliveryId.trim(), payload);
    }

    private Result process(GitHubService.Connection connection, String type, String deliveryId, JsonNode payload) {
        // The delivery row and everything it links commit together: a failure stores nothing, so GitHub's retry of
        // the same delivery is processed again; a successful delivery replayed later is ignored.
        return transactions.execute(status -> {
            int firstTime = jdbc.update("""
                    INSERT INTO github_webhook_deliveries (connection_id, delivery_id, org_id, event) VALUES (?, ?, ?, ?)
                    ON CONFLICT DO NOTHING
                    """, connection.id(), deliveryId, connection.orgId(), type.isEmpty() ? "unknown" : type);
            if (firstTime == 0) return new Result("duplicate", 0);
            if (!"push".equals(type) && !"pull_request".equals(type)) return new Result("ignored", 0);

            Map<String, Object> project = jdbc.queryForMap("SELECT key, mode FROM projects WHERE id = ? AND org_id = ?",
                    connection.projectId(), connection.orgId());
            String projectKey = (String) project.get("key");
            boolean solo = "INDIVIDUAL".equals(project.get("mode"));
            TaskKeyMatcher matcher = new TaskKeyMatcher(projectKey);
            int linked = "push".equals(type)
                    ? push(connection, payload, matcher, projectKey, solo)
                    : pullRequest(connection, payload, matcher, projectKey, solo);
            jdbc.update("UPDATE github_webhook_deliveries SET matched = ? WHERE connection_id = ? AND delivery_id = ?",
                    linked, connection.id(), deliveryId);
            return new Result("processed", linked);
        });
    }

    private int push(GitHubService.Connection connection, JsonNode payload, TaskKeyMatcher matcher, String projectKey,
            boolean solo) {
        String ref = payload.path("ref").asText("");
        String branch = ref.startsWith("refs/heads/") ? ref.substring("refs/heads/".length()) : null;
        int linked = 0;
        List<GitHubService.FeedItem> feed = new ArrayList<>();
        for (JsonNode node : payload.path("commits")) {
            String message = node.path("message").asText("");
            GitHubClient.Commit commit = new GitHubClient.Commit(node.path("id").asText(), message,
                    node.path("author").path("name").asText(null), node.path("author").path("username").asText(null),
                    instant(node.path("timestamp").asText(null)), node.path("url").asText(null));
            // Every pushed commit joins the project's activity feed (stats are filled by the next Sync).
            if (!commit.sha().isBlank()) feed.add(GitHubService.FeedItem.commit(commit, branch, null));
            if (solo) {
                if (matcher.mentionsProject(message) || (branch != null && matcher.mentionsProject(branch))) {
                    linked += store(connection, null, projectKey, List.of(GitHubService.Linked.commit(commit, branch, "MESSAGE")));
                }
                continue;
            }
            List<String> keys = new ArrayList<>(matcher.taskKeys(message));
            String reason = "MESSAGE";
            if (keys.isEmpty() && branch != null) {
                keys.addAll(matcher.taskKeys(branch));
                reason = "BRANCH";
            }
            for (String key : keys) {
                String itemId = taskId(connection, key);
                if (itemId != null) {
                    linked += store(connection, itemId, key, List.of(GitHubService.Linked.commit(commit, branch, reason)));
                }
            }
        }
        github.storeFeed(connection, feed, "WEBHOOK", null);
        return linked;
    }

    private int pullRequest(GitHubService.Connection connection, JsonNode payload, TaskKeyMatcher matcher, String projectKey,
            boolean solo) {
        JsonNode pr = payload.path("pull_request");
        GitHubClient.PullRequest pull = new GitHubClient.PullRequest(pr.path("number").asInt(), pr.path("title").asText(""),
                pr.path("head").path("ref").asText(null), pr.path("user").path("login").asText(null),
                instant(pr.path("updated_at").asText(null)), pr.path("html_url").asText(null),
                pr.path("merged").asBoolean(false) ? "merged" : pr.path("state").asText(null));
        // The pull_request payload carries its code-change stats.
        github.storeFeed(connection, List.of(GitHubService.FeedItem.pullRequest(pull, pr.has("additions")
                ? new GitHubClient.PullRequestStats(pr.path("additions").asInt(0), pr.path("deletions").asInt(0),
                        pr.path("changed_files").asInt(0), pr.path("merged").asBoolean(false), pr.path("base").path("ref").asText(null))
                : null)), "WEBHOOK", null);
        if (solo) {
            boolean mentioned = matcher.mentionsProject(pull.title()) || (pull.branch() != null && matcher.mentionsProject(pull.branch()));
            return mentioned ? store(connection, null, projectKey, List.of(GitHubService.Linked.pullRequest(pull))) : 0;
        }
        java.util.Set<String> keys = new java.util.LinkedHashSet<>(matcher.taskKeys(pull.title()));
        if (pull.branch() != null) keys.addAll(matcher.taskKeys(pull.branch()));
        int linked = 0;
        for (String key : keys) {
            String itemId = taskId(connection, key);
            if (itemId != null) linked += store(connection, itemId, key, List.of(GitHubService.Linked.pullRequest(pull)));
        }
        return linked;
    }

    private int store(GitHubService.Connection connection, String itemId, String key, List<GitHubService.Linked> found) {
        return github.store(connection.orgId(), connection.projectId(), itemId, key, connection, found, "WEBHOOK", null).linked();
    }

    /** The task with this key in the connected project (never another project or organization). */
    private String taskId(GitHubService.Connection connection, String key) {
        return jdbc.queryForList("""
                SELECT id FROM work_items WHERE org_id = ? AND project_id = ? AND upper(key) = upper(?) AND plan_status <> 'RETIRED'
                """, String.class, connection.orgId(), connection.projectId(), key).stream().findFirst().orElse(null);
    }

    static boolean validSignature(String secret, String header, byte[] body) {
        if (secret == null || header == null || !header.startsWith("sha256=") || body == null) return false;
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] expected = HexFormat.of().formatHex(mac.doFinal(body)).getBytes(StandardCharsets.US_ASCII);
            byte[] given = header.substring("sha256=".length()).trim().toLowerCase(java.util.Locale.ROOT)
                    .getBytes(StandardCharsets.US_ASCII);
            return MessageDigest.isEqual(expected, given);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            return false;
        }
    }

    private static Instant instant(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return java.time.OffsetDateTime.parse(value).toInstant();
        } catch (RuntimeException e) {
            return null;
        }
    }

    public record Result(String status, int linked) {}
}
