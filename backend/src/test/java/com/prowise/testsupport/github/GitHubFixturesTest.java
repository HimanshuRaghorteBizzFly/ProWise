package com.prowise.testsupport.github;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

@Tag("T27")
class GitHubFixturesTest {

    private final GitHubWebhookSigner signer = GitHubWebhookSigner.forTests();

    @Test
    void storedSignaturesMatchTheTestKey() {
        for (GitHubFixtures.Delivery delivery : GitHubFixtures.deliveries()) {
            boolean valid = signer.verify(delivery.body(), delivery.signature());
            assertThat(valid).as(delivery.name()).isEqualTo(delivery.expectValid());
        }
    }

    @Test
    void pullRequestAndPushPayloadsAreSigned() throws Exception {
        GitHubFixtures.Delivery pr = GitHubFixtures.delivery("pull_request.opened");
        GitHubFixtures.Delivery push = GitHubFixtures.delivery("push.main");

        assertThat(pr.event()).isEqualTo("pull_request");
        assertThat(push.event()).isEqualTo("push");
        assertThat(signer.sign(pr.body())).isEqualTo(pr.signature());
        assertThat(signer.sign(push.body())).isEqualTo(push.signature());
        JsonNode prJson = new ObjectMapper().readTree(pr.body());
        assertThat(prJson.path("action").asText()).isEqualTo("opened");
        assertThat(prJson.path("pull_request").path("number").asInt()).isPositive();
    }

    @Test
    void tamperedPayloadFailsVerification() {
        GitHubFixtures.Delivery tampered = GitHubFixtures.delivery("pull_request.tampered");
        GitHubFixtures.Delivery original = GitHubFixtures.delivery("pull_request.opened");

        assertThat(tampered.signature()).as("reuses the original signature").isEqualTo(original.signature());
        assertThat(tampered.body()).isNotEqualTo(original.body());
        assertThat(signer.verify(tampered.body(), tampered.signature())).isFalse();
    }

    @Test
    void duplicateDeliveryRepeatsTheSameDeliveryIdAndBody() {
        GitHubFixtures.Delivery duplicate = GitHubFixtures.delivery("push.main.duplicate");
        GitHubFixtures.Delivery original = GitHubFixtures.delivery("push.main");

        assertThat(duplicate.deliveryId()).isEqualTo(original.deliveryId());
        assertThat(duplicate.body()).isEqualTo(original.body());
        assertThat(signer.verify(duplicate.body(), duplicate.signature())).isTrue();
    }

    @Test
    void wrongKeyMissingPrefixAndNullAreRejected() {
        byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
        String good = signer.sign(body);

        assertThat(new GitHubWebhookSigner("other-key").verify(body, good)).isFalse();
        assertThat(signer.verify(body, good.substring("sha256=".length()))).isFalse();
        assertThat(signer.verify(body, null)).isFalse();
        assertThat(good).matches("sha256=[0-9a-f]{64}");
    }

    @Test
    void fixturesContainNoRealCredentials() {
        for (String file : new String[] {"pull_request.opened.json", "push.main.json", "deliveries.json"}) {
            String raw = new String(GitHubFixtures.read(file), StandardCharsets.UTF_8).toLowerCase();
            assertThat(raw).as(file).doesNotContain("password", "token", "secret", "ghp_");
        }
    }
}
