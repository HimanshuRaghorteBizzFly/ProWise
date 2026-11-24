package com.prowise.notification.smtp;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mail.javamail.JavaMailSender;

/**
 * Real SMTP wiring. Defining the {@link JavaMailSender} here replaces Spring Boot's static auto-configured one,
 * so every email (account setup, password reset, invitations, notifications, test emails) uses the live settings.
 * Tests replace this bean with a mock or point the settings at a local test SMTP socket; nothing is simulated.
 */
@Configuration
public class SmtpConfiguration {

    @Bean
    SmtpMailGateway smtpMailGateway(
            @Value("${prowise.mail.connect-timeout-ms:10000}") int connectMs,
            @Value("${prowise.mail.read-timeout-ms:15000}") int readMs,
            @Value("${prowise.mail.write-timeout-ms:15000}") int writeMs) {
        return new SmtpMailGateway(new SmtpTimeouts(connectMs, readMs, writeMs));
    }

    @Bean
    JavaMailSender javaMailSender(SmtpSettingsProvider settingsProvider, SmtpMailGateway gateway) {
        return new GatewayJavaMailSender(settingsProvider, gateway);
    }
}
