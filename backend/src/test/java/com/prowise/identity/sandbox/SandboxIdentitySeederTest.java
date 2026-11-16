package com.prowise.identity.sandbox;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Set;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.mock.env.MockEnvironment;

@Tag("AS-01")
class SandboxIdentitySeederTest {

    @Test
    void datasetHasTwoOrganisationsWithFiveFakeUsersEach() {
        SandboxDataset dataset = seeder(new MockEnvironment().withProperty("spring.profiles.active", "dev")).seed();

        assertThat(dataset.organizations()).extracting(SandboxDataset.Organization::slug)
                .containsExactly("org-a", "org-b");
        for (SandboxDataset.Organization org : dataset.organizations()) {
            assertThat(org.users()).hasSize(5);
            assertThat(org.users()).allSatisfy(user ->
                    assertThat(user.email()).endsWith("@" + org.slug() + ".test"));
        }
        assertThat(dataset.organizations().get(0).users())
                .extracting(SandboxDataset.User::email)
                .contains("owner@org-a.test");
    }

    @Test
    void identifiersAreUniqueAcrossTenants() {
        SandboxDataset dataset = seeder(new MockEnvironment()).seed();

        Set<String> userIds = dataset.organizations().stream()
                .flatMap(org -> org.users().stream())
                .map(user -> user.id().toString())
                .collect(Collectors.toSet());
        assertThat(userIds).hasSize(10);
        assertThat(dataset.organizations().get(0).id()).isNotEqualTo(dataset.organizations().get(1).id());
    }

    @ParameterizedTest
    @ValueSource(strings = {"prod", "production", "PROD"})
    void refusesToRunInProduction(String profile) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("worker", profile);

        assertThatThrownBy(() -> seeder(environment).seed())
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("refused")
                .hasMessageContaining("production");
    }

    @Test
    void seedFileContainsNoCredentials() throws Exception {
        String raw = new String(getClass().getResourceAsStream(SandboxIdentitySeeder.SEED_RESOURCE).readAllBytes());

        assertThat(raw.toLowerCase()).doesNotContain("password", "token", "secret");
    }

    private static SandboxIdentitySeeder seeder(MockEnvironment environment) {
        return new SandboxIdentitySeeder(environment, new ObjectMapper());
    }
}
