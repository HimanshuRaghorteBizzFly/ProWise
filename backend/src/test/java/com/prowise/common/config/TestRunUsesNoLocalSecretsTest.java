package com.prowise.common.config;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.env.Environment;

/**
 * The Maven test run must never read backend/.env: with real SMTP credentials there, every signup, invitation and
 * bootstrap in a test would send real email. Tests that need mail set their own property and mock the sender.
 */
@SpringBootTest
class TestRunUsesNoLocalSecretsTest {

    @Autowired private Environment environment;

    @Test
    void noSmtpCredentialsOrBootstrapAddressReachTheTests() {
        assertThat(environment.getProperty("spring.mail.username", "")).isBlank();
        assertThat(environment.getProperty("spring.mail.password", "")).isBlank();
        assertThat(environment.getProperty("prowise.bootstrap.super-admin-email", "")).isBlank();
        assertThat(environment.getProperty("prowise.bootstrap.super-admin-password", "")).isBlank();
    }
}
