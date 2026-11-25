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
        return service(smtpUsername, "http://localhost:3000");
    }

    private EmailCredentialService service(String smtpUsername, String frontendUrl) {
        when(mailSenderProvider.getIfAvailable()).thenReturn(mailSender);
        // Real settings resolution over an empty settings table: the SMTP_* environment fallback applies.
        com.prowise.superadmin.emailproviders.EmailProviderRepository providers =
                mock(com.prowise.superadmin.emailproviders.EmailProviderRepository.class);
        when(providers.findById(any())).thenReturn(java.util.Optional.empty());
        com.prowise.notification.smtp.SmtpSettingsProvider settings = new com.prowise.notification.smtp.SmtpSettingsProvider(
                providers, new com.prowise.notification.smtp.SmtpCredentialCipher(""),
                "smtp.gmail.com", 587, smtpUsername, "", "noreply@prowise.com", "ProWise Platform", "", "");
        return new EmailCredentialService(mailSenderProvider, deliveryLogRepository, settings, frontendUrl);
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
        assertEquals("SMTP_ACCEPTED", result.status());
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

    @Test
    @DisplayName("Operator welcome email carries the sign-in email, the temporary password and the live sign-in link")
    void operatorWelcomeEmail() throws Exception {
        EmailCredentialService.EmailDeliveryResult result = service("smtp-user", "https://prowise.oxo1.com/")
                .sendOperatorWelcomeEmail("new.op@ops.test", "New Op", "Tmp7kQ9xRm2PwZ4a");

        assertTrue(result.success());
        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(sent.capture());
        assertThat(sent.getValue().getSubject()).isEqualTo("Your ProWise operator account");
        assertThat(text(sent.getValue().getContent()))
                .contains("new.op@ops.test")
                .contains("Tmp7kQ9xRm2PwZ4a")
                .contains("https://prowise.oxo1.com/operator/login")
                .doesNotContain("prowise.oxo1.com//")
                .doesNotContain("localhost")
                .doesNotContain("invite=")
                .contains("72 hours")
                .containsIgnoringCase("choose a new password")
                .doesNotContain("never sends passwords");
        ArgumentCaptor<EmailDeliveryLogEntity> log = ArgumentCaptor.forClass(EmailDeliveryLogEntity.class);
        verify(deliveryLogRepository).save(log.capture());
        assertEquals("OPERATOR_INVITATION", log.getValue().getEmailType());
        // The delivery log keeps the subject, never the password.
        assertThat(String.valueOf(log.getValue().getSubject()) + log.getValue().getErrorMessage()).doesNotContain("Tmp7kQ9xRm2PwZ4a");
    }

    @Test
    @DisplayName("Operator welcome email adds a local sign-in link only when one is configured")
    void operatorWelcomeEmailLocalSignInLink() throws Exception {
        EmailCredentialService withLocal = service("smtp-user", "https://prowise.oxo1.com");
        withLocal.setLocalSignInUrl("http://localhost:3000/");
        withLocal.sendOperatorWelcomeEmail("new.op@ops.test", "New Op", "Tmp7kQ9xRm2PwZ4a");
        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender).send(sent.capture());
        assertThat(text(sent.getValue().getContent()))
                .contains("https://prowise.oxo1.com/operator/login")
                .contains("href=\"http://localhost:3000/operator/login\"")
                .contains("Testing locally?");

        org.mockito.Mockito.reset(mailSender);
        when(mailSender.createMimeMessage()).thenAnswer(invocation -> new MimeMessage((Session) null));
        service("smtp-user", "https://prowise.oxo1.com").sendOperatorWelcomeEmail("new.op@ops.test", "New Op", "Tmp7kQ9xRm2PwZ4a");
        verify(mailSender).send(sent.capture());
        assertThat(text(sent.getValue().getContent())).doesNotContain("localhost").doesNotContain("Testing locally?");
    }

    @Test
    @DisplayName("Every linked email (verification, reset, setup) adds the same link on the local copy when configured")
    void localLinkOnEveryEmail() throws Exception {
        EmailCredentialService withLocal = service("smtp-user", "https://prowise.oxo1.com");
        withLocal.setLocalSignInUrl("http://localhost:3000");
        withLocal.sendEmailVerificationEmail(UUID.randomUUID(), "owner@ops.test", "Owner", "verify-abc");
        withLocal.sendPasswordResetEmail(UUID.randomUUID(), "owner@ops.test", "Owner", "reset-xyz");
        ArgumentCaptor<MimeMessage> sent = ArgumentCaptor.forClass(MimeMessage.class);
        verify(mailSender, org.mockito.Mockito.times(2)).send(sent.capture());
        assertThat(text(sent.getAllValues().get(0).getContent()))
                .contains("https://prowise.oxo1.com/verify-email?token=verify-abc")
                .contains("href=\"http://localhost:3000/verify-email?token=verify-abc\"")
                .contains("Testing locally?");
        assertThat(text(sent.getAllValues().get(1).getContent()))
                .contains("href=\"http://localhost:3000/reset-password?token=reset-xyz\"");
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
