package com.prowise.integration.github;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** Task keys in commit messages, branches and pull request titles; HMAC check of webhook deliveries. */
@Tag("T31")
class TaskKeyMatcherTest {

    private final TaskKeyMatcher matcher = new TaskKeyMatcher("prw");

    @Test
    void findsKeysCaseInsensitivelyWithWordBoundaries() {
        assertThat(matcher.taskKeys("PRW-12: fix login, also prw-3")).containsExactly("PRW-12", "PRW-3");
        assertThat(matcher.taskKeys("feature/PRW-7-dark-mode")).containsExactly("PRW-7");
        assertThat(matcher.taskKeys("PRW-012 leading zeros")).containsExactly("PRW-12");
    }

    @Test
    void neverMatchesInsideLongerKeysOrOtherProjects() {
        assertThat(matcher.taskKeys("PRW-12")).doesNotContain("PRW-1");
        assertThat(matcher.taskKeys("XPRW-1 and PRWX-2 and ABC-3")).isEmpty();
        assertThat(matcher.taskKeys(null)).isEmpty();
    }

    @Test
    void soloProjectsMatchTheProjectKeyItself() {
        assertThat(matcher.mentionsProject("[PRW] login page")).isTrue();
        assertThat(matcher.mentionsProject("prw: tidy")).isTrue();
        assertThat(matcher.mentionsProject("PRWX unrelated")).isFalse();
    }

    @Test
    void webhookSignatureIsTheHmacOfTheRawBody() throws Exception {
        byte[] body = "{\"zen\":\"x\"}".getBytes(StandardCharsets.UTF_8);
        String header = new com.prowise.testsupport.github.GitHubWebhookSigner("s3cret").sign(body);
        assertThat(GitHubWebhookService.validSignature("s3cret", header, body)).isTrue();
        assertThat(GitHubWebhookService.validSignature("other", header, body)).isFalse();
        assertThat(GitHubWebhookService.validSignature("s3cret", header, "{}".getBytes(StandardCharsets.UTF_8))).isFalse();
        assertThat(GitHubWebhookService.validSignature("s3cret", null, body)).isFalse();
        assertThat(GitHubWebhookService.validSignature("s3cret", "sha1=abc", body)).isFalse();
    }
}
