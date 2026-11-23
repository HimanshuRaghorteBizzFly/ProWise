package com.prowise.identity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;

import jakarta.mail.Multipart;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;

import com.prowise.operator.operations.EmailDeliveryLogEntity;
import com.prowise.operator.operations.EmailDeliveryLogRepository;

@DisplayName("Email Credential Service Tests")
class EmailCredentialServiceTest {

    private EmailDeliveryLogRepository deliveryLogRepository;
    private ObjectProvider<JavaMailSender> mailSenderProvider;
    private JavaMailSender mailSender;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        deliveryLogRepository = mock(EmailDeliveryLogRepository.class);
        mailSenderProvider = mock(ObjectProvider.class);
        mailSender = mock(JavaMailSender.class);
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
    }

    private EmailCredentialService service(String smtpUsername) {
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        return new EmailCredentialService(mailSenderProvider, deliveryLogRepository, smtpUsername,
                "noreply@prowise.com", "http://localhost:3000");
    }

    @Test
    @DisplayName("Without SMTP configuration nothing is sent and the result says so")
    void notConfiguredIsReportedAsNotSent() {
        UUID userId = UUID.randomUUID();
        EmailCredentialService.EmailDeliveryResult result =
                service("").sendAccountSetupEmail(userId, "alex@gmail.com", "Alex Henderson", "setup-token-abc");

        assertFalse(result.success());
        assertEquals("NOT_SENT", result.status());
        ArgumentCaptor<EmailDeliveryLogEntity> log = ArgumentCaptor.forClass(EmailDeliveryLogEntity.class);
        verify(deliveryLogRepository).save(log.capture());
        assertEquals("NOT_SENT", log.getValue().getStatus());
        assertEquals(userId, log.getValue().getUserId());
        assertEquals("ACCOUNT_SETUP", log.getValue().getEmailType());
    }

    @Test
    @DisplayName("Setup email carries a 72-hour link and never a password")
    void setupEmailContainsLinkOnly() throws Exception {
        EmailCredentialService.EmailDeliveryResult result =
                service("smtp-user").sendAccountSetupEmail(UUID.randomUUID(), "alex@gmail.com", "Alex", "setup-token-abc");

        assertTrue(result.success());
        assertEquals("DELIVERED", result.status());
        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(sent.capture());
        String html = text(sent.getValue().getContent());
        assertThat(html).contains("http://localhost:3000/reset-password?token=setup-token-abc&amp;setup=1")
                .contains("72 hours")
                .doesNotContainIgnoringCase("temporary password");
    }

    @Test
    @DisplayName("SMTP failure is recorded and the returned message reveals no server detail")
    void failureMessageIsSafe() {
        doThrow(new MailSendException("smtp.internal.example rejected relay-user")).when(mailSender).send(any(MimeMessage.class));

        EmailCredentialService.EmailDeliveryResult result =
                service("smtp-user").sendAccountSetupEmail(UUID.randomUUID(), "alex@gmail.com", "Alex", "setup-token-abc");

        assertFalse(result.success());
        assertEquals("FAILED", result.status());
        assertEquals(EmailCredentialService.SAFE_FAILURE_MESSAGE, result.message());
        assertThat(result.message()).doesNotContain("smtp.internal.example");
    }

    @Test
    @DisplayName("Password reset email keeps its 30-minute link")
    void passwordResetEmail() throws Exception {
        UUID userId = UUID.randomUUID();
        EmailCredentialService.EmailDeliveryResult result =
                service("smtp-user").sendPasswordResetEmail(userId, "alex@gmail.com", "Alex", "reset-token-xyz");

        assertTrue(result.success());
        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(sent.capture());
        assertThat(text(sent.getValue().getContent()))
                .contains("reset-password?token=reset-token-xyz").contains("30 minutes");
        ArgumentCaptor<EmailDeliveryLogEntity> log = ArgumentCaptor.forClass(EmailDeliveryLogEntity.class);
        verify(deliveryLogRepository).save(log.capture());
        assertEquals("PASSWORD_RESET", log.getValue().getEmailType());
    }

    private static String text(Object content) throws Exception {
        if (content instanceof String s) return s;
        if (content instanceof Multipart multipart) {
            StringBuilder all = new StringBuilder();
            for (int i = 0; i < multipart.getCount(); i++) all.append(text(multipart.getBodyPart(i).getContent()));
            return all.toString();
        }
        return "";
    }
}
