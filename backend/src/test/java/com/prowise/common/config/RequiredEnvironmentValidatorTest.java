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
                .withProperty("spring.datasource.password", "dummy");
    }
}
