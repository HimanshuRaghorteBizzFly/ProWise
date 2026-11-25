package com.prowise.integration.github;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * GitHub REST v3 over the JDK HTTP client (no extra dependency), authenticated with a fine-grained read-only token.
 * Owner, repository and ref are validated before they are put in a URL. Nothing about the token or the response body
 * is logged or put into exception messages.
 */
@Component
public class TokenGitHubClient implements GitHubClient {

    static final Pattern NAME = Pattern.compile("^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$");
    private static final Pattern REF = Pattern.compile("^[A-Za-z0-9._/-]{1,200}$");

    private final HttpClient http;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final Duration timeout;

    public TokenGitHubClient(ObjectMapper objectMapper,
            @Value("${prowise.github.api-base-url:https://api.github.com}") String baseUrl,
            @Value("${prowise.github.request-timeout-ms:8000}") long timeoutMs) {
        this.objectMapper = objectMapper;
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.timeout = Duration.ofMillis(Math.max(1000, timeoutMs));
        // No redirects: the Authorization header must never be forwarded to another host.
        this.http = HttpClient.newBuilder().connectTimeout(this.timeout).followRedirects(HttpClient.Redirect.NEVER).build();
    }

    @Override
    public Repository repository(Credential credential, String owner, String repo) {
        JsonNode node = get(credential, repoPath(owner, repo));
        return new Repository(node.path("full_name").asText(), node.path("default_branch").asText("main"),
                node.path("private").asBoolean(false));
    }

    @Override
    public List<Commit> commits(Credential credential, String owner, String repo, String ref, Instant since, int max) {
        StringBuilder path = new StringBuilder(repoPath(owner, repo)).append("/commits?per_page=").append(perPage(max));
        if (ref != null) path.append("&sha=").append(encode(ref(ref)));
        if (since != null) path.append("&since=").append(encode(since.toString()));
        List<Commit> result = new ArrayList<>();
        for (JsonNode node : get(credential, path.toString())) {
            result.add(commit(node));
            if (result.size() >= max) break;
        }
        return result;
    }

    @Override
    public List<String> branches(Credential credential, String owner, String repo, int max) {
        List<String> result = new ArrayList<>();
        for (JsonNode node : get(credential, repoPath(owner, repo) + "/branches?per_page=" + perPage(max))) {
            result.add(node.path("name").asText());
            if (result.size() >= max) break;
        }
        return result;
    }

    @Override
    public List<Commit> compare(Credential credential, String owner, String repo, String base, String head, int max) {
        // Refs are validated to [A-Za-z0-9._/-] (no "..") and GitHub expects branch slashes unencoded here.
        String path = repoPath(owner, repo) + "/compare/" + ref(base) + "..." + ref(head);
        List<Commit> result = new ArrayList<>();
        for (JsonNode node : get(credential, path).path("commits")) {
            result.add(commit(node));
            if (result.size() >= max) break;
        }
        return result;
    }

    @Override
    public List<PullRequest> pullRequests(Credential credential, String owner, String repo, int max) {
        List<PullRequest> result = new ArrayList<>();
        String path = repoPath(owner, repo) + "/pulls?state=all&sort=updated&direction=desc&per_page=" + perPage(max);
        for (JsonNode node : get(credential, path)) {
            result.add(new PullRequest(node.path("number").asInt(), node.path("title").asText(""),
                    node.path("head").path("ref").asText(null), node.path("user").path("login").asText(null),
                    instant(node.path("updated_at").asText(null)), node.path("html_url").asText(null),
                    node.path("state").asText(null)));
            if (result.size() >= max) break;
        }
        return result;
    }

    @Override
    public List<Commit> pullRequestCommits(Credential credential, String owner, String repo, int number, int max) {
        List<Commit> result = new ArrayList<>();
        for (JsonNode node : get(credential, repoPath(owner, repo) + "/pulls/" + number + "/commits?per_page=" + perPage(max))) {
            result.add(commit(node));
            if (result.size() >= max) break;
        }
        return result;
    }

    /* ------------------------------------------------------------------ helpers */

    private Commit commit(JsonNode node) {
        JsonNode commit = node.path("commit");
        return new Commit(node.path("sha").asText(), commit.path("message").asText(""),
                commit.path("author").path("name").asText(null), node.path("author").path("login").asText(null),
                instant(commit.path("author").path("date").asText(null)), node.path("html_url").asText(null));
    }

    private JsonNode get(Credential credential, String path) {
        if (credential == null || credential.token() == null || credential.token().isBlank()) {
            throw new GitHubException(401, "No GitHub token is stored for this repository.");
        }
        HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(timeout)
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .header("User-Agent", "prowise-integration")
                .header("Authorization", "Bearer " + credential.token())
                .GET().build();
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new GitHubException(503, "GitHub could not be reached.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GitHubException(503, "The GitHub request was interrupted.");
        }
        int status = response.statusCode();
        if (status == 401) throw new GitHubException(401, "GitHub refused the token (expired or revoked).");
        if (status == 403) throw new GitHubException(403, "The token has no read access to this repository, or the rate limit was hit.");
        if (status == 404) throw new GitHubException(404, "The repository was not found or the token cannot see it.");
        if (status >= 400) throw new GitHubException(502, "GitHub answered with status " + status + ".");
        try {
            return objectMapper.readTree(response.body());
        } catch (IOException e) {
            throw new GitHubException(502, "GitHub sent an unreadable answer.");
        }
    }

    static String repoPath(String owner, String repo) {
        if (owner == null || repo == null || !NAME.matcher(owner).matches() || !NAME.matcher(repo).matches()) {
            throw new GitHubException(400, "Use the repository as owner/name, for example acme/web.");
        }
        return "/repos/" + owner + "/" + repo;
    }

    private static String ref(String ref) {
        if (!REF.matcher(ref).matches() || ref.contains("..")) throw new GitHubException(400, "Invalid branch name.");
        return ref;
    }

    private static int perPage(int max) {
        return Math.max(1, Math.min(100, max));
    }

    private static String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static Instant instant(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return Instant.parse(value);
        } catch (RuntimeException e) {
            return null;
        }
    }
}
