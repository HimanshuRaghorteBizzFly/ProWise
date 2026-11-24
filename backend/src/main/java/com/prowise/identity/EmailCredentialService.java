package com.prowise.identity;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import com.prowise.notification.EmailMessage;
import com.prowise.notification.smtp.GatewayJavaMailSender;
import com.prowise.notification.smtp.SmtpMailGateway;
import com.prowise.notification.smtp.SmtpSettings;
import com.prowise.notification.smtp.SmtpSettingsProvider;
import com.prowise.operator.operations.EmailDeliveryLogEntity;
import com.prowise.operator.operations.EmailDeliveryLogRepository;

/**
 * Every outgoing email: account links, notifications and the SMTP test email. Account emails carry single-use
 * links only, never a password. Every attempt is recorded in {@code email_delivery_logs} with what really happened:
 * SMTP_ACCEPTED only when the SMTP server accepted the message (this is not proof of inbox delivery), FAILED with
 * the reason, or NOT_SENT when outgoing email is not configured. Links and tokens are never written to the log.
 */
@Service
public class EmailCredentialService {

    public static final String TYPE_ACCOUNT_SETUP = "ACCOUNT_SETUP";
    public static final String TYPE_PASSWORD_RESET = "PASSWORD_RESET";
    public static final String TYPE_OPERATOR_INVITATION = "OPERATOR_INVITATION";
    public static final String TYPE_EMAIL_VERIFICATION = "EMAIL_VERIFICATION";
    public static final String TYPE_OPERATOR_PASSWORD_RESET = "OPERATOR_PASSWORD_RESET";
    public static final String TYPE_ORGANIZATION_INVITATION = "ORGANIZATION_INVITATION";
    public static final String TYPE_SMTP_TEST = "SMTP_TEST";
    public static final String TYPE_NOTIFICATION = "NOTIFICATION";

    /** Delivery-log statuses. QUEUED and RETRY_PENDING are reserved for queued delivery (not used: retries are inline). */
    public static final String STATUS_QUEUED = "QUEUED";
    public static final String STATUS_PROCESSING = "PROCESSING";
    public static final String STATUS_ACCEPTED = "SMTP_ACCEPTED";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_RETRY_PENDING = "RETRY_PENDING";
    public static final String STATUS_NOT_SENT = "NOT_SENT";

    public static final String TEST_EMAIL_SUBJECT = "ProWise SMTP Email Verification";
    static final String TEST_EMAIL_BODY = """
            Hello,

            This is a real SMTP verification email from ProWise Platform.

            Your SMTP configuration has successfully processed this test message.

            Regards,
            ProWise Platform Administration.
            """;

    /** Shown to administrators; deliberately free of SMTP host, user or provider error text. */
    public static final String SAFE_FAILURE_MESSAGE =
            "The email could not be delivered. The account stays pending; use Resend once email delivery works.";
    public static final String NOT_CONFIGURED_MESSAGE =
            "No email was sent because outgoing email is not configured. The account stays pending; use Resend once it is.";

    private static final Logger log = LoggerFactory.getLogger(EmailCredentialService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final EmailDeliveryLogRepository deliveryLogRepository;
    private final SmtpSettingsProvider settingsProvider;
    private final String frontendUrl;

    public EmailCredentialService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            EmailDeliveryLogRepository deliveryLogRepository,
            SmtpSettingsProvider settingsProvider,
            @Value("${prowise.mail.frontend-url:http://localhost:3000}") String frontendUrl
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.deliveryLogRepository = deliveryLogRepository;
        this.settingsProvider = settingsProvider;
        this.frontendUrl = frontendUrl;
    }

    /** True when an SMTP host and account are configured (saved in the panel or in SMTP_* variables). */
    public boolean isConfigured() {
        return mailSenderProvider.getIfAvailable() != null && isConfigured(settingsProvider.current());
    }

    private static boolean isConfigured(SmtpSettings settings) {
        return settings.hasHost() && settings.hasUsername();
    }

    /** First-password link for a pending account (valid 72 hours, single use). */
    public EmailDeliveryResult sendAccountSetupEmail(UUID userId, String recipient, String userName, String setupToken) {
        String setupUrl = frontendUrl + "/reset-password?token=" + setupToken + "&setup=1";
        return send(userId, recipient, "Activate your ProWise account", TYPE_ACCOUNT_SETUP, new Template(
                "Activate your account",
                List.of("Hello " + nameOr(userName) + ",",
                        "An administrator has created a ProWise account for you. Choose your own password to activate it."),
                "Activate my account", setupUrl,
                "This link works once and expires in 72 hours. If it expires, ask your administrator to send a new one."));
    }

    /** Password reset link (valid 30 minutes, single use). */
    public EmailDeliveryResult sendPasswordResetEmail(UUID userId, String recipient, String userName, String resetToken) {
        String resetUrl = frontendUrl + "/reset-password?token=" + resetToken;
        return send(userId, recipient, "Reset your ProWise password", TYPE_PASSWORD_RESET, new Template(
                "Reset your password",
                List.of("Hello " + nameOr(userName) + ",",
                        "We received a request to reset the password of your ProWise account. Signing in with the new "
                                + "password ends your other sessions."),
                "Choose a new password", resetUrl,
                "This link works once and expires in 30 minutes. If you did not ask for a reset, ignore this email: "
                        + "your password stays the same."));
    }

    /** Platform operator invitation link (valid 72 hours, single use). Operators have no row in {@code users}. */
    public EmailDeliveryResult sendOperatorInvitationEmail(String recipient, String operatorName, String invitationToken) {
        String acceptUrl = frontendUrl + "/operator/login?invite=" + invitationToken;
        return send(null, recipient, "Your ProWise operator invitation", TYPE_OPERATOR_INVITATION, new Template(
                "You are invited to operate ProWise",
                List.of("Hello " + nameOr(operatorName) + ",",
                        "You have been invited to the ProWise platform operations console. Choose your own password to accept."),
                "Accept invitation", acceptUrl,
                "This link works once and expires in 72 hours."));
    }

    /** Email verification after public signup (valid 72 hours, single use). The account stays pending until used. */
    public EmailDeliveryResult sendEmailVerificationEmail(UUID userId, String recipient, String userName, String verifyToken) {
        String verifyUrl = frontendUrl + "/verify-email?token=" + verifyToken;
        return send(userId, recipient, "Confirm your ProWise email", TYPE_EMAIL_VERIFICATION, new Template(
                "Confirm your email",
                List.of("Hello " + nameOr(userName) + ",",
                        "Thanks for signing up for ProWise. Confirm this email address to activate your account, then sign in."),
                "Confirm my email", verifyUrl,
                "This link works once and expires in 72 hours. If you did not sign up, ignore this email."));
    }

    /** Platform operator password reset link (valid 30 minutes, single use). Operators have no row in {@code users}. */
    public EmailDeliveryResult sendOperatorPasswordResetEmail(String recipient, String operatorName, String resetToken) {
        String resetUrl = frontendUrl + "/operator/login?reset=" + resetToken;
        return send(null, recipient, "Reset your ProWise operator password", TYPE_OPERATOR_PASSWORD_RESET, new Template(
                "Reset your operator password",
                List.of("Hello " + nameOr(operatorName) + ",",
                        "We received a request to reset your ProWise platform operator password."),
                "Choose a new password", resetUrl,
                "This link works once and expires in 30 minutes. If you did not ask for a reset, ignore this email."));
    }

    /**
     * Organization invitation (task 1.2). A new person creates their account from the link (choosing their own
     * password); someone who already has an account signs in and accepts. Single use; expires as shown.
     */
    public EmailDeliveryResult sendOrganizationInvitationEmail(String recipient, String organizationName, String roleLabel,
            String acceptUrl, Instant expiresAt, boolean accountExists) {
        String expires = java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm 'UTC'", java.util.Locale.ENGLISH)
                .withZone(java.time.ZoneOffset.UTC).format(expiresAt);
        return send(null, recipient, "You're invited to join " + organizationName + " on ProWise", TYPE_ORGANIZATION_INVITATION,
                new Template("Join " + organizationName,
                        List.of("Hello,",
                                "You have been invited to join " + organizationName + " on ProWise as " + roleLabel + ".",
                                accountExists
                                        ? "Sign in with this email address, then accept the invitation."
                                        : "Open the link to create your account: you choose your own password."),
                        accountExists ? "Sign in and accept" : "Create my account", acceptUrl,
                        "This link works once and expires on " + expires + ". If you did not expect this invitation, ignore this email."));
    }

    /* ------------------------------------------------------------------ rendering and delivery */

    /** One transactional email: heading, paragraphs, one call to action and a note. All text is escaped on render. */
    record Template(String heading, List<String> paragraphs, String actionLabel, String actionUrl, String note) {}

    private EmailDeliveryResult send(UUID userId, String recipient, String subject, String emailType, Template template) {
        return sendHtmlEmail(userId, recipient, subject, renderHtml(template), renderText(template), emailType);
    }

    /**
     * Table layout with inline styles (email clients drop {@code <style>} blocks and flexbox), a visible fallback
     * link under the button, and a footer that says links are the only thing ever sent: never a password.
     */
    static String renderHtml(Template t) {
        StringBuilder paragraphs = new StringBuilder();
        for (String p : t.paragraphs()) {
            paragraphs.append("<p style=\"margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;\">")
                    .append(HtmlUtils.htmlEscape(p)).append("</p>");
        }
        String url = HtmlUtils.htmlEscape(t.actionUrl());
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>%1$s</title></head>
                <body style="margin:0;padding:0;background-color:#f1f5f9;">
                  <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f1f5f9;padding:32px 12px;">
                    <tr><td align="center">
                      <table role="presentation" width="100%%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
                        <tr><td style="padding:24px 32px;border-bottom:1px solid #e2e8f0;">
                          <span style="display:inline-block;width:32px;height:32px;line-height:32px;text-align:center;border-radius:8px;background-color:#2563eb;color:#ffffff;font-weight:700;font-size:16px;">P</span>
                          <span style="font-size:17px;font-weight:700;color:#0f172a;vertical-align:middle;padding-left:8px;">ProWise</span>
                        </td></tr>
                        <tr><td style="padding:32px;">
                          <h1 style="margin:0 0 18px;font-size:22px;line-height:1.3;color:#0f172a;">%1$s</h1>
                          %2$s
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
                            <tr><td style="border-radius:8px;background-color:#2563eb;">
                              <a href="%3$s" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">%4$s</a>
                            </td></tr>
                          </table>
                          <p style="margin:0 0 6px;font-size:13px;color:#64748b;">If the button does not work, copy this link into your browser:</p>
                          <p style="margin:0 0 20px;font-size:13px;word-break:break-all;"><a href="%3$s" style="color:#2563eb;">%3$s</a></p>
                          <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">%5$s</p>
                        </td></tr>
                        <tr><td style="padding:18px 32px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">
                          ProWise never sends passwords by email and will never ask you for one. This is an automated message; replies are not read.
                        </td></tr>
                      </table>
                    </td></tr>
                  </table>
                </body>
                </html>
                """.formatted(HtmlUtils.htmlEscape(t.heading()), paragraphs, url, HtmlUtils.htmlEscape(t.actionLabel()),
                HtmlUtils.htmlEscape(t.note()));
    }

    /** Plain-text alternative for clients that do not show HTML (and for spam filters). */
    static String renderText(Template t) {
        StringBuilder text = new StringBuilder(t.heading()).append("\n\n");
        for (String p : t.paragraphs()) text.append(p).append("\n\n");
        text.append(t.actionLabel()).append(":\n").append(t.actionUrl()).append("\n\n").append(t.note())
                .append("\n\n--\nProWise never sends passwords by email and will never ask you for one.\n");
        return text.toString();
    }

    private static String nameOr(String name) {
        return name != null && !name.isBlank() ? name.trim() : "there";
    }

    private EmailDeliveryResult sendHtmlEmail(UUID userId, String recipient, String subject, String htmlBody, String textBody,
            String emailType) {
        Delivery delivery = deliver(userId, recipient, subject, emailType, helper -> helper.setText(textBody, htmlBody));
        return switch (delivery.log().getStatus()) {
            case STATUS_ACCEPTED -> new EmailDeliveryResult(true, STATUS_ACCEPTED,
                    "The email was accepted by the SMTP server for " + recipient + ".");
            case STATUS_NOT_SENT -> new EmailDeliveryResult(false, STATUS_NOT_SENT, NOT_CONFIGURED_MESSAGE);
            default -> new EmailDeliveryResult(false, STATUS_FAILED, SAFE_FAILURE_MESSAGE);
        };
    }

    /**
     * The SMTP test email from the admin panel: the exact text required for verification, sent with the live
     * settings, logged, and reported with the server's own reply. SMTP acceptance is not proof of inbox delivery.
     */
    public TestEmailResult sendTestEmail(String recipient) {
        Instant attemptedAt = Instant.now();
        Delivery delivery = deliver(null, recipient, TEST_EMAIL_SUBJECT, TYPE_SMTP_TEST, helper -> helper.setText(TEST_EMAIL_BODY, false));
        EmailDeliveryLogEntity entry = delivery.log();
        boolean accepted = STATUS_ACCEPTED.equals(entry.getStatus());
        return new TestEmailResult(accepted, entry.getStatus(), recipient, entry.getSender(), entry.getProvider(), attemptedAt,
                entry.getMessageId(), entry.getSmtpResponse(), accepted ? null : entry.getErrorMessage(), entry.getAttempts(),
                entry.getId());
    }

    /** Plain-text notification for the {@link com.prowise.notification.EmailSender} port; logged like every email. */
    public void sendNotification(EmailMessage message) {
        deliver(null, message.to(), message.subject(), TYPE_NOTIFICATION, helper -> helper.setText(message.textBody(), false));
    }

    @FunctionalInterface
    private interface Body {
        void apply(MimeMessageHelper helper) throws jakarta.mail.MessagingException;
    }

    private record Delivery(EmailDeliveryLogEntity log) {}

    private Delivery deliver(UUID userId, String recipient, String subject, String emailType, Body body) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        SmtpSettings settings = settingsProvider.current();

        EmailDeliveryLogEntity entry = new EmailDeliveryLogEntity();
        entry.setId("eml_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        entry.setRecipient(recipient);
        entry.setSubject(subject);
        entry.setProvider(isConfigured(settings) ? settings.provider() : "NOT_CONFIGURED");
        entry.setSender(settings.fromEmail() == null || settings.fromEmail().isBlank() ? null : settings.fromEmail());
        entry.setUserId(userId);
        entry.setEmailType(emailType);
        entry.setAttempts(0);
        entry.setCreatedAt(Instant.now());
        entry.setSentAt(null);
        entry.setStatus(STATUS_PROCESSING);

        if (mailSender == null || !isConfigured(settings)) {
            log.warn("{} email to {} was not sent: outgoing email is not configured", emailType, recipient);
            entry.setStatus(STATUS_NOT_SENT);
            entry.setErrorCode("SMTP_NOT_CONFIGURED");
            entry.setErrorMessage("Outgoing email is not configured.");
            return record(entry);
        }

        MimeMessage message;
        try {
            message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            if (settings.fromEmail() != null && !settings.fromEmail().isBlank()) {
                if (settings.fromName() != null && !settings.fromName().isBlank()) {
                    helper.setFrom(settings.fromEmail(), settings.fromName().trim());
                } else {
                    helper.setFrom(settings.fromEmail());
                }
            }
            if (settings.replyTo() != null && !settings.replyTo().isBlank()) {
                helper.setReplyTo(settings.replyTo());
            }
            helper.setTo(recipient);
            helper.setSubject(subject);
            body.apply(helper);
        } catch (Exception ex) {
            entry.setStatus(STATUS_FAILED);
            entry.setErrorCode("INVALID_MESSAGE");
            entry.setErrorMessage("The message could not be built: " + ex.getClass().getSimpleName());
            return record(entry);
        }

        if (mailSender instanceof GatewayJavaMailSender gatewaySender) {
            SmtpMailGateway.Receipt receipt = gatewaySender.sendWithReceipt(message);
            entry.setAttempts(Math.max(1, receipt.attempts()));
            entry.setMessageId(receipt.messageId());
            entry.setSmtpResponse(receipt.smtpResponse());
            if (receipt.accepted()) {
                entry.setStatus(STATUS_ACCEPTED);
                entry.setSentAt(Instant.now());
                log.info("{} email to {} accepted by the SMTP server", emailType, recipient);
            } else {
                entry.setStatus(receipt.status() == com.prowise.notification.smtp.SmtpStatus.NOT_CONFIGURED ? STATUS_NOT_SENT : STATUS_FAILED);
                entry.setErrorCode(receipt.status().name());
                // Classifier text: an explanation plus the server's own reply, never a credential.
                entry.setErrorMessage(receipt.errorDetail());
                log.error("{} email to {} failed: {}", emailType, recipient, receipt.status());
            }
            return record(entry);
        }

        // Any other JavaMailSender (a test double): accepted when send() returns.
        entry.setAttempts(1);
        try {
            mailSender.send(message);
            entry.setStatus(STATUS_ACCEPTED);
            entry.setSentAt(Instant.now());
            entry.setMessageId(message.getMessageID());
            log.info("{} email to {} accepted by the mail sender", emailType, recipient);
        } catch (Exception ex) {
            // The exception class is enough to diagnose; its message can echo SMTP hosts or user names.
            log.error("{} email to {} failed: {}", emailType, recipient, ex.getClass().getSimpleName());
            entry.setStatus(STATUS_FAILED);
            entry.setErrorCode("SMTP_SEND_FAILURE");
            entry.setErrorMessage(ex.getClass().getSimpleName());
        }
        return record(entry);
    }

    private Delivery record(EmailDeliveryLogEntity entry) {
        try {
            deliveryLogRepository.save(entry);
        } catch (Exception e) {
            log.warn("Could not record email delivery log: {}", e.getClass().getSimpleName());
        }
        return new Delivery(entry);
    }

    public record TestEmailResult(boolean accepted, String status, String recipient, String sender, String provider,
            Instant attemptedAt, String messageId, String smtpResponse, String error, int attempts, String logId) {}

    public record EmailDeliveryResult(boolean success, String status, String message) {}
}
