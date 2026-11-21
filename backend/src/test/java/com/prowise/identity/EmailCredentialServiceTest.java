package com.prowise.identity;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.javamail.JavaMailSender;

import com.prowise.operator.operations.EmailDeliveryLogEntity;
import com.prowise.operator.operations.EmailDeliveryLogRepository;

@DisplayName("Email Credential Service Tests")
class EmailCredentialServiceTest {

    private EmailDeliveryLogRepository deliveryLogRepository;
    private ObjectProvider<JavaMailSender> mailSenderProvider;
    private EmailCredentialService emailService;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        deliveryLogRepository = mock(EmailDeliveryLogRepository.class);
        mailSenderProvider = mock(ObjectProvider.class);

        // When SMTP is not configured (empty smtpUsername), it logs and simulates delivery safely
        emailService = new EmailCredentialService(
                mailSenderProvider,
                deliveryLogRepository,
                "", // empty smtpUsername simulates dev environment
                "noreply@prowise.com",
                "http://localhost:3000"
        );
    }

    @Test
    @DisplayName("Send welcome credentials logs delivery in simulated dev mode")
    void testSendWelcomeCredentialsSimulated() {
        EmailCredentialService.EmailDeliveryResult result = emailService.sendWelcomeCredentials(
                "alex@gmail.com",
                "Alex Henderson",
                "TempPass1234!",
                null
        );

        assertNotNull(result);
        assertEquals("DELIVERED", result.status());
        assertTrue(result.success());
        verify(deliveryLogRepository).save(any(EmailDeliveryLogEntity.class));
    }

    @Test
    @DisplayName("Send password reset email logs delivery in simulated dev mode")
    void testSendPasswordResetEmailSimulated() {
        EmailCredentialService.EmailDeliveryResult result = emailService.sendPasswordResetEmail(
                "alex@gmail.com",
                "Alex Henderson",
                "reset-token-xyz",
                null
        );

        assertNotNull(result);
        assertEquals("DELIVERED", result.status());
        assertTrue(result.success());
        verify(deliveryLogRepository).save(any(EmailDeliveryLogEntity.class));
    }
}
