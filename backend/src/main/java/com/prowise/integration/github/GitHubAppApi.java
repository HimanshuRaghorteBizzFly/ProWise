package com.prowise.integration.github;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The Prowise GitHub App, as GitHub sees it: install link, the installer's own installations (OAuth during install),
 * installation details and short-lived installation tokens. {@link HttpGitHubAppApi} talks to GitHub; tests replace it.
 * Implementations never log or echo a credential, the private key, the client secret or a user token.
 */
public interface GitHubAppApi {

    /** True when the App id, slug, client id/secret, private key and webhook secret are all set. */
    boolean configured();

    /** Public App slug (github.com/apps/&lt;slug&gt;); empty when not configured. */
    String slug();

    /** Where the browser goes to install (or configure) the App; {@code state} comes back on the setup URL. */
    String installUrl(String state);

    /**
     * Ids of the installations the GitHub user who just authorized the App (OAuth {@code code}) can access. The user
     * token is used for this one call and dropped. Proves the installer controls the installation id they returned with.
     */
    Set<Long> userInstallationIds(String code);

    Installation installation(long installationId);

    /** A short-lived (about 1 hour) installation token, cached in memory only; never stored, logged or returned. */
    GitHubClient.Credential installationToken(long installationId);

    /** Repositories the installation was granted (most recently pushed first, as GitHub lists them). */
    List<RepositoryOption> repositories(GitHubClient.Credential credential, int max);

    /** Secret GitHub signs App webhook deliveries with; empty when not configured. */
    String webhookSecret();

    record Installation(long id, String accountLogin, String accountType, String repositorySelection, boolean suspended,
            Map<String, String> permissions, List<String> events) {}

    record RepositoryOption(long id, String fullName, String defaultBranch, boolean privateRepository, String description) {}
}
