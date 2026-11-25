package com.prowise.integration.github;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.jsonwebtoken.Jwts;

/**
 * GitHub App over the JDK HTTP client. App calls are signed with a 9-minute RS256 JWT (jjwt, already a dependency);
 * repository calls use installation tokens cached in memory until 5 minutes before they expire. Redirects are never
 * followed, and no credential, key, secret or response body is logged or put in an exception message.
 *
 * <p>Configuration (environment): GITHUB_APP_ID, GITHUB_APP_SLUG, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET,
 * GITHUB_APP_PRIVATE_KEY (PEM, "\n" escapes allowed), GITHUB_APP_WEBHOOK_SECRET. The slug and client id fall back to
 * the platform integration settings (super admin) when unset.
 */
@Component
public class HttpGitHubAppApi implements GitHubAppApi {

    private final HttpClient http;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbc;
    private final String apiBaseUrl;
    private final String webBaseUrl;
    private final Duration timeout;
    private final String appId;
    private final String slug;
    private final String clientId;
    private final String clientSecret;
    private final String privateKeyPem;
    private final String webhookSecret;
    private volatile PrivateKey privateKey;
    private final Map<Long, CachedToken> tokens = new ConcurrentHashMap<>();

    public HttpGitHubAppApi(ObjectMapper objectMapper, JdbcTemplate jdbc,
            @Value("${prowise.github.api-base-url:https://api.github.com}") String apiBaseUrl,
            @Value("${prowise.github.web-base-url:https://github.com}") String webBaseUrl,
            @Value("${prowise.github.request-timeout-ms:8000}") long timeoutMs,
            @Value("${prowise.github.app.id:}") String appId,
            @Value("${prowise.github.app.slug:}") String slug,
            @Value("${prowise.github.app.client-id:}") String clientId,
            @Value("${prowise.github.app.client-secret:}") String clientSecret,
            @Value("${prowise.github.app.private-key:}") String privateKeyPem,
            @Value("${prowise.github.app.webhook-secret:}") String webhookSecret) {
        this.objectMapper = objectMapper;
        this.jdbc = jdbc;
        this.apiBaseUrl = trimSlash(apiBaseUrl);
        this.webBaseUrl = trimSlash(webBaseUrl);
        this.timeout = Duration.ofMillis(Math.max(1000, timeoutMs));
        this.appId = blank(appId);
        this.slug = blank(slug);
        this.clientId = blank(clientId);
        this.clientSecret = blank(clientSecret);
        this.privateKeyPem = blank(privateKeyPem).replace("\\n", "\n");
        this.webhookSecret = blank(webhookSecret);
        this.http = HttpClient.newBuilder().connectTimeout(this.timeout).followRedirects(HttpClient.Redirect.NEVER).build();
    }

    @Override
    public boolean configured() {
        return !appId.isEmpty() && !slug().isEmpty() && !clientId().isEmpty() && !clientSecret.isEmpty()
                && !privateKeyPem.isEmpty() && !webhookSecret.isEmpty();
    }

    @Override
    public String slug() {
        return slug.isEmpty() ? platformSetting("github_app_slug") : slug;
    }

    private String clientId() {
        return clientId.isEmpty() ? platformSetting("github_client_id") : clientId;
    }

    @Override
    public String installUrl(String state) {
        return webBaseUrl + "/apps/" + URLEncoder.encode(slug(), StandardCharsets.UTF_8) + "/installations/new?state="
                + URLEncoder.encode(state, StandardCharsets.UTF_8);
    }

    @Override
    public Set<Long> userInstallationIds(String code) {
        String form = "client_id=" + enc(clientId()) + "&client_secret=" + enc(clientSecret) + "&code=" + enc(code);
        HttpRequest exchange = base(URI.create(webBaseUrl + "/login/oauth/access_token"))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(form)).build();
        JsonNode answer = send(exchange, "GitHub did not accept the authorization. Start again.");
        String userToken = answer.path("access_token").asText("");
        if (userToken.isEmpty()) {
            throw new GitHubClient.GitHubException(401, "GitHub did not accept the authorization (the code expired or was used). Start again.");
        }
        Set<Long> ids = new LinkedHashSet<>();
        for (int page = 1; page <= 5; page++) {
            JsonNode list = send(base(URI.create(apiBaseUrl + "/user/installations?per_page=100&page=" + page))
                    .header("Authorization", "Bearer " + userToken).GET().build(), "GitHub could not list your installations.");
            JsonNode installations = list.path("installations");
            for (JsonNode node : installations) ids.add(node.path("id").asLong());
            if (installations.size() < 100) break;
        }
        return ids;
    }

    @Override
    public Installation installation(long installationId) {
        JsonNode node = send(base(URI.create(apiBaseUrl + "/app/installations/" + installationId))
                .header("Authorization", "Bearer " + appJwt()).GET().build(), "GitHub could not find this installation.");
        Map<String, String> permissions = new LinkedHashMap<>();
        node.path("permissions").fields().forEachRemaining(e -> permissions.put(e.getKey(), e.getValue().asText()));
        List<String> events = new ArrayList<>();
        node.path("events").forEach(e -> events.add(e.asText()));
        return new Installation(node.path("id").asLong(), node.path("account").path("login").asText(""),
                node.path("account").path("type").asText("User"), node.path("repository_selection").asText(null),
                !node.path("suspended_at").isNull() && !node.path("suspended_at").isMissingNode(), permissions, events);
    }

    @Override
    public GitHubClient.Credential installationToken(long installationId) {
        CachedToken cached = tokens.get(installationId);
        if (cached != null && cached.expiresAt().isAfter(Instant.now().plusSeconds(300))) {
            return new GitHubClient.Credential(cached.token());
        }
        JsonNode node = send(base(URI.create(apiBaseUrl + "/app/installations/" + installationId + "/access_tokens"))
                .header("Authorization", "Bearer " + appJwt()).POST(HttpRequest.BodyPublishers.noBody()).build(),
                "GitHub refused an installation token: the App was removed or suspended.");
        String token = node.path("token").asText("");
        if (token.isEmpty()) throw new GitHubClient.GitHubException(502, "GitHub sent no installation token.");
        Instant expires;
        try {
            expires = Instant.parse(node.path("expires_at").asText());
        } catch (RuntimeException e) {
            expires = Instant.now().plusSeconds(1800);
        }
        tokens.put(installationId, new CachedToken(token, expires));
        return new GitHubClient.Credential(token);
    }

    @Override
    public List<RepositoryOption> repositories(GitHubClient.Credential credential, int max) {
        List<RepositoryOption> result = new ArrayList<>();
        for (int page = 1; page <= 5 && result.size() < max; page++) {
            JsonNode list = send(base(URI.create(apiBaseUrl + "/installation/repositories?per_page=100&page=" + page))
                    .header("Authorization", "Bearer " + credential.token()).GET().build(),
                    "GitHub could not list the installation's repositories.");
            JsonNode repositories = list.path("repositories");
            for (JsonNode node : repositories) {
                result.add(new RepositoryOption(node.path("id").asLong(), node.path("full_name").asText(),
                        node.path("default_branch").asText("main"), node.path("private").asBoolean(false),
                        node.path("description").isNull() ? null : node.path("description").asText(null)));
                if (result.size() >= max) break;
            }
            if (repositories.size() < 100) break;
        }
        return result;
    }

    @Override
    public String webhookSecret() {
        return webhookSecret;
    }

    /* ------------------------------------------------------------------ helpers */

    private String appJwt() {
        if (!configured()) throw new GitHubClient.GitHubException(503, "The GitHub App is not configured on this server.");
        Instant now = Instant.now();
        return Jwts.builder().issuer(appId).issuedAt(Date.from(now.minusSeconds(60)))
                .expiration(Date.from(now.plusSeconds(540))).signWith(privateKey(), Jwts.SIG.RS256).compact();
    }

    private PrivateKey privateKey() {
        PrivateKey key = privateKey;
        if (key != null) return key;
        try {
            boolean pkcs1 = privateKeyPem.contains("BEGIN RSA PRIVATE KEY");
            String body = privateKeyPem.replaceAll("-----(BEGIN|END) (RSA )?PRIVATE KEY-----", "").replaceAll("\\s", "");
            byte[] der = Base64.getDecoder().decode(body);
            key = KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(pkcs1 ? pkcs1ToPkcs8(der) : der));
            privateKey = key;
            return key;
        } catch (Exception e) {
            // Never include the key or the parser's message.
            throw new GitHubClient.GitHubException(503, "The GitHub App private key on this server is not a valid PEM key.");
        }
    }

    /** GitHub hands out PKCS#1 ("BEGIN RSA PRIVATE KEY"); the JDK reads PKCS#8, so wrap it in the rsaEncryption header. */
    static byte[] pkcs1ToPkcs8(byte[] pkcs1) {
        byte[] version = {0x02, 0x01, 0x00};
        byte[] algorithm = {0x30, 0x0d, 0x06, 0x09, 0x2a, (byte) 0x86, 0x48, (byte) 0x86, (byte) 0xf7, 0x0d, 0x01, 0x01,
                0x01, 0x05, 0x00};
        ByteArrayOutputStream inner = new ByteArrayOutputStream();
        inner.writeBytes(version);
        inner.writeBytes(algorithm);
        inner.writeBytes(der(0x04, pkcs1));
        return der(0x30, inner.toByteArray());
    }

    private static byte[] der(int tag, byte[] content) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        out.write(tag);
        int length = content.length;
        if (length < 0x80) {
            out.write(length);
        } else {
            int bytes = length > 0xFFFFFF ? 4 : length > 0xFFFF ? 3 : length > 0xFF ? 2 : 1;
            out.write(0x80 | bytes);
            for (int i = bytes - 1; i >= 0; i--) out.write((length >>> (8 * i)) & 0xFF);
        }
        out.writeBytes(content);
        return out.toByteArray();
    }

    private HttpRequest.Builder base(URI uri) {
        return HttpRequest.newBuilder(uri).timeout(timeout)
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .header("User-Agent", "prowise-integration");
    }

    private JsonNode send(HttpRequest request, String notFoundMessage) {
        HttpResponse<String> response;
        try {
            response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (IOException e) {
            throw new GitHubClient.GitHubException(503, "GitHub could not be reached.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new GitHubClient.GitHubException(503, "The GitHub request was interrupted.");
        }
        int status = response.statusCode();
        boolean rateLimited = status == 429 || (status == 403
                && "0".equals(response.headers().firstValue("X-RateLimit-Remaining").orElse(null)));
        if (rateLimited) throw new GitHubClient.GitHubException(429, "GitHub's rate limit was reached. Try again in a few minutes.");
        if (status == 401) throw new GitHubClient.GitHubException(401, "GitHub refused the Prowise App credentials.");
        if (status == 403) throw new GitHubClient.GitHubException(403, "The GitHub App has no access to this.");
        if (status == 404) throw new GitHubClient.GitHubException(404, notFoundMessage);
        if (status >= 400) throw new GitHubClient.GitHubException(502, "GitHub answered with status " + status + ".");
        try {
            return objectMapper.readTree(response.body());
        } catch (IOException e) {
            throw new GitHubClient.GitHubException(502, "GitHub sent an unreadable answer.");
        }
    }

    private String platformSetting(String column) {
        if (!"github_app_slug".equals(column) && !"github_client_id".equals(column)) return "";
        try {
            List<String> values = jdbc.queryForList("SELECT " + column + " FROM platform_integration_settings LIMIT 1", String.class);
            return values.isEmpty() || values.get(0) == null ? "" : values.get(0).trim();
        } catch (RuntimeException e) {
            return "";
        }
    }

    private static String enc(String value) {
        return URLEncoder.encode(value == null ? "" : value, StandardCharsets.UTF_8);
    }

    private static String blank(String value) {
        return value == null ? "" : value.trim();
    }

    private static String trimSlash(String value) {
        String v = value == null ? "" : value.trim();
        return v.endsWith("/") ? v.substring(0, v.length() - 1) : v;
    }

    private record CachedToken(String token, Instant expiresAt) {
        @Override
        public String toString() {
            return "CachedToken[***]";
        }
    }
}
