package com.prowise.common.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.diagnostics.FailureAnalysis;
import org.springframework.mock.env.MockEnvironment;

@Tag("NFR-11")
class RequiredEnvironmentValidatorTest {

    private final RequiredEnvironmentValidator validator = new RequiredEnvironmentValidator();

    @Test
    void passesWhenAllRequiredValuesArePresent() {
        MockEnvironment environment = completeEnvironment();

        assertThatCode(() -> validator.postProcessEnvironment(environment, new SpringApplication()))
                .doesNotThrowAnyException();
    }

    @Test
    void blankPasswordFailsWithTheEnvironmentVariableName() {
        MockEnvironment environment = completeEnvironment().withProperty("spring.datasource.password", "  ");

        assertThatThrownBy(() -> validator.postProcessEnvironment(environment, new SpringApplication()))
                .isInstanceOf(MissingEnvironmentException.class)
                .hasMessageContaining("DB_PASSWORD")
                .hasMessageNotContaining("DB_URL");
    }

    @Test
    void reportsEveryMissingVariableAtOnce() {
        MockEnvironment environment = new MockEnvironment();

        assertThatThrownBy(() -> validator.postProcessEnvironment(environment, new SpringApplication()))
                .isInstanceOf(MissingEnvironmentException.class)
                .hasMessageContaining("DB_URL")
                .hasMessageContaining("DB_USERNAME")
                .hasMessageContaining("DB_PASSWORD");
    }

    @Test
    void failureMessageNeverContainsConfiguredValues() {
        MockEnvironment environment = completeEnvironment()
                .withProperty("spring.datasource.password", "")
                .withProperty("spring.datasource.username", "very-private-user");

        assertThatThrownBy(() -> validator.postProcessEnvironment(environment, new SpringApplication()))
                .hasMessageNotContaining("very-private-user");
    }

    @Test
    void missingSigningKeyStopsStartup() {
        MockEnvironment environment = completeEnvironment().withProperty("prowise.auth.jwt-signing-key", "");

        assertThatThrownBy(() -> validator.postProcessEnvironment(environment, new SpringApplication()))
                .isInstanceOf(MissingEnvironmentException.class)
                .hasMessageContaining("JWT_SIGNING_KEY");
    }

    @Test
    void productionPassesWithExplicitConfiguration() {
        assertThatCode(() -> validator.postProcessEnvironment(productionEnvironment(), new SpringApplication()))
                .doesNotThrowAnyException();
    }

    @Test
    void productionRequiresEmailFrontendAndCorsConfiguration() {
        MockEnvironment environment = completeEnvironment();
        environment.setActiveProfiles("prod");

        assertThatThrownBy(() -> validator.postProcessEnvironment(environment, new SpringApplication()))
                .isInstanceOf(MissingEnvironmentException.class)
                .hasMessageContaining("SMTP_HOST")
                .hasMessageContaining("SMTP_USERNAME")
                .hasMessageContaining("FRONTEND_URL")
                .hasMessageContaining("CORS_ALLOWED_ORIGINS");
    }

    @Test
    void productionRefusesSigningKeysPublishedInTheRepository() {
        for (String published : RequiredEnvironmentValidator.PUBLISHED_SIGNING_KEYS) {
            MockEnvironment environment = productionEnvironment().withProperty("prowise.auth.jwt-signing-key", published);

            assertThatThrownBy(() -> validator.postProcessEnvironment(environment, new SpringApplication()))
                    .isInstanceOf(MissingEnvironmentException.class)
                    .hasMessageContaining("JWT_SIGNING_KEY")
                    .hasMessageNotContaining(published);
        }
    }

    @Test
    void failureAnalyzerExplainsHowToFixIt() {
        FailureAnalysis analysis = new MissingEnvironmentFailureAnalyzer()
                .analyze(new MissingEnvironmentException(java.util.List.of("DB_PASSWORD")));

        assertThat(analysis.getDescription()).contains("DB_PASSWORD");
        assertThat(analysis.getAction()).contains(".env.example");
    }

    private static MockEnvironment completeEnvironment() {
        return new MockEnvironment()
                .withProperty("spring.datasource.url", "jdbc:postgresql://localhost:5432/prowise")
                .withProperty("spring.datasource.username", "prowise")
                .withProperty("spring.datasource.password", "dummy")
                .withProperty("prowise.auth.jwt-signing-key", "a-unique-signing-key-for-this-test-only-0123");
    }

    private static MockEnvironment productionEnvironment() {
        MockEnvironment environment = completeEnvironment()
                .withProperty("spring.mail.host", "smtp.example.test")
                .withProperty("spring.mail.username", "mailer")
                .withProperty("spring.mail.password", "dummy")
                .withProperty("prowise.mail.from", "no-reply@example.test")
                .withProperty("prowise.mail.frontend-url", "https://app.example.test")
                .withProperty("prowise.cors.allowed-origins", "https://app.example.test");
        environment.setActiveProfiles("prod");
        return environment;
    }
}
