package com.prowise.integration.github;

import java.time.Instant;
import java.util.List;

/**
 * Read-only access to one GitHub repository. {@link TokenGitHubClient} uses a fine-grained, read-only personal access
 * token; a GitHub App implementation can replace it without touching callers. Implementations never log or echo the
 * credential.
 */
public interface GitHubClient {

    /** The repository as GitHub names it, or a {@link GitHubException} when the credential cannot read it. */
    Repository repository(Credential credential, String owner, String repo);

    /** Newest commits reachable from {@code ref} (a branch name; null = default branch) since {@code since}. */
    List<Commit> commits(Credential credential, String owner, String repo, String ref, Instant since, int max);

    List<String> branches(Credential credential, String owner, String repo, int max);

    /** Commits on {@code head} that are not on {@code base} (GitHub compare), oldest first. */
    List<Commit> compare(Credential credential, String owner, String repo, String base, String head, int max);

    /** Recently updated pull requests (open and closed). */
    List<PullRequest> pullRequests(Credential credential, String owner, String repo, int max);

    List<Commit> pullRequestCommits(Credential credential, String owner, String repo, int number, int max);

    /** The credential is held in memory only for the call. {@link #toString()} never reveals it. */
    record Credential(String token) {
        @Override
        public String toString() {
            return "Credential[***]";
        }
    }

    record Repository(String fullName, String defaultBranch, boolean privateRepository) {}

    record Commit(String sha, String message, String authorName, String authorLogin, Instant committedAt, String url) {}

    record PullRequest(int number, String title, String branch, String authorLogin, Instant updatedAt, String url,
            String state) {}

    /** A refused or failed GitHub call; the message is safe to show (no token, no response body). */
    class GitHubException extends RuntimeException {
        private final int status;

        public GitHubException(int status, String message) {
            super(message);
            this.status = status;
        }

        public int status() {
            return status;
        }
    }
}
