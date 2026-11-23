package com.prowise.identity;

import java.time.Instant;
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

import com.prowise.operator.operations.EmailDeliveryLogEntity;
import com.prowise.operator.operations.EmailDeliveryLogRepository;

/**
 * Account emails. They carry single-use links only: never a password. Every attempt is recorded in
 * {@code email_delivery_logs} with an honest status (DELIVERED, FAILED or NOT_SENT) so administrators can resend.
 * Links and tokens are never written to the application log.
 */
@Service
public class EmailCredentialService {

    public static final String TYPE_ACCOUNT_SETUP = "ACCOUNT_SETUP";
    public static final String TYPE_PASSWORD_RESET = "PASSWORD_RESET";
    public static final String TYPE_OPERATOR_INVITATION = "OPERATOR_INVITATION";
    public static final String TYPE_EMAIL_VERIFICATION = "EMAIL_VERIFICATION";
    public static final String TYPE_OPERATOR_PASSWORD_RESET = "OPERATOR_PASSWORD_RESET";

    public static final String STATUS_DELIVERED = "DELIVERED";
    public static final String STATUS_FAILED = "FAILED";
    public static final String STATUS_NOT_SENT = "NOT_SENT";

    /** Shown to administrators; deliberately free of SMTP host, user or provider error text. */
    public static final String SAFE_FAILURE_MESSAGE =
            "The email could not be delivered. The account stays pending; use Resend once email delivery works.";
    public static final String NOT_CONFIGURED_MESSAGE =
            "No email was sent because outgoing email is not configured. The account stays pending; use Resend once it is.";

    private static final Logger log = LoggerFactory.getLogger(EmailCredentialService.class);

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final EmailDeliveryLogRepository deliveryLogRepository;
    private final String smtpUsername;
    private final String defaultFrom;
    private final String frontendUrl;

    public EmailCredentialService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            EmailDeliveryLogRepository deliveryLogRepository,
            @Value("${spring.mail.username:}") String smtpUsername,
            @Value("${prowise.mail.from:no-reply@prowise.com}") String defaultFrom,
            @Value("${prowise.mail.frontend-url:http://localhost:3000}") String frontendUrl
    ) {
        this.mailSenderProvider = mailSenderProvider;
        this.deliveryLogRepository = deliveryLogRepository;
        this.smtpUsername = smtpUsername;
        this.defaultFrom = defaultFrom;
        this.frontendUrl = frontendUrl;
    }

    /** First-password link for a pending account (valid 72 hours, single use). */
    public EmailDeliveryResult sendAccountSetupEmail(UUID userId, String recipient, String userName, String setupToken) {
        String setupUrl = frontendUrl + "/reset-password?token=" + setupToken + "&setup=1";
        String body = """
                <p>Hello %s, an administrator has created a ProWise account for you.</p>
                <p>Choose your own password to activate it. You will never be sent a password by email.</p>
                %s
                <p class="small">This link works once and expires in 72 hours. If it expires, ask your administrator to resend it.</p>
                """.formatted(escape(userName, "there"), button(setupUrl, "Set up my account"));
        return sendHtmlEmail(userId, recipient, "Set up your ProWise account", page("Set up your ProWise account", body),
                TYPE_ACCOUNT_SETUP);
    }

    /** Password reset link (valid 30 minutes, single use). */
    public EmailDeliveryResult sendPasswordResetEmail(UUID userId, String recipient, String userName, String resetToken) {
        String resetUrl = frontendUrl + "/reset-password?token=" + resetToken;
        String body = """
                <p>Hello %s, we received a request to reset your ProWise password.</p>
                %s
                <p class="small">This link works once and expires in 30 minutes. If you did not request this reset, you can ignore this email.</p>
                """.formatted(escape(userName, "there"), button(resetUrl, "Reset my password"));
        return sendHtmlEmail(userId, recipient, "ProWise password reset", page("Password reset", body), TYPE_PASSWORD_RESET);
    }

    /** Platform operator invitation link (valid 72 hours, single use). Operators have no row in {@code users}. */
    public EmailDeliveryResult sendOperatorInvitationEmail(String recipient, String operatorName, String invitationToken) {
        String acceptUrl = frontendUrl + "/operator/login?invite=" + invitationToken;
        String body = """
                <p>Hello %s, you have been invited to operate the ProWise platform.</p>
                <p>Choose your own password to accept the invitation.</p>
                %s
                <p class="small">This link works once and expires in 72 hours.</p>
                """.formatted(escape(operatorName, "there"), button(acceptUrl, "Accept invitation"));
        return sendHtmlEmail(null, recipient, "Your ProWise operator invitation", page("Operator invitation", body),
                TYPE_OPERATOR_INVITATION);
    }

    /** Email verification after public signup (valid 72 hours, single use). The account stays pending until used. */
    public EmailDeliveryResult sendEmailVerificationEmail(UUID userId, String recipient, String userName, String verifyToken) {
        String verifyUrl = frontendUrl + "/verify-email?token=" + verifyToken;
        String body = """
                <p>Hello %s, thanks for signing up for ProWise.</p>
                <p>Confirm this email address to activate your account. You can sign in once it is confirmed.</p>
                %s
                <p class="small">This link works once and expires in 72 hours. If you did not sign up, you can ignore this email.</p>
                """.formatted(escape(userName, "there"), button(verifyUrl, "Confirm my email"));
        return sendHtmlEmail(userId, recipient, "Confirm your ProWise email", page("Confirm your email", body),
                TYPE_EMAIL_VERIFICATION);
    }

    /** Platform operator password reset link (valid 30 minutes, single use). Operators have no row in {@code users}. */
    public EmailDeliveryResult sendOperatorPasswordResetEmail(String recipient, String operatorName, String resetToken) {
        String resetUrl = frontendUrl + "/operator/login?reset=" + resetToken;
        String body = """
                <p>Hello %s, we received a request to reset your ProWise platform operator password.</p>
                %s
                <p class="small">This link works once and expires in 30 minutes. If you did not request this reset, you can ignore this email.</p>
                """.formatted(escape(operatorName, "there"), button(resetUrl, "Reset my password"));
        return sendHtmlEmail(null, recipient, "ProWise operator password reset", page("Operator password reset", body),
                TYPE_OPERATOR_PASSWORD_RESET);
    }

    private EmailDeliveryResult sendHtmlEmail(UUID userId, String recipient, String subject, String htmlBody, String emailType) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        boolean hasSmtpConfig = smtpUsername != null && !smtpUsername.isBlank();

        EmailDeliveryLogEntity logEntity = new EmailDeliveryLogEntity();
        logEntity.setId("eml_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        logEntity.setRecipient(recipient);
        logEntity.setSubject(subject);
        logEntity.setProvider(hasSmtpConfig ? "SMTP" : "Not configured");
        logEntity.setUserId(userId);
        logEntity.setEmailType(emailType);
        logEntity.setAttempts(1);
        logEntity.setCreatedAt(Instant.now());
        logEntity.setSentAt(Instant.now());

        if (mailSender == null || !hasSmtpConfig) {
            log.warn("{} email to {} was not sent: outgoing email is not configured", emailType, recipient);
            logEntity.setStatus(STATUS_NOT_SENT);
            logEntity.setErrorCode("SMTP_NOT_CONFIGURED");
            record(logEntity);
            return new EmailDeliveryResult(false, STATUS_NOT_SENT, NOT_CONFIGURED_MESSAGE);
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(defaultFrom != null && !defaultFrom.isBlank() ? defaultFrom : "no-reply@prowise.com");
            helper.setTo(recipient);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);

            mailSender.send(message);

            logEntity.setStatus(STATUS_DELIVERED);
            record(logEntity);
            log.info("{} email sent to {}", emailType, recipient);
            return new EmailDeliveryResult(true, STATUS_DELIVERED, "The email was sent to " + recipient + ".");
        } catch (Exception ex) {
            // The exception class is enough to diagnose; its message can echo SMTP hosts or user names.
            log.error("{} email to {} failed: {}", emailType, recipient, ex.getClass().getSimpleName());
            logEntity.setStatus(STATUS_FAILED);
            logEntity.setErrorCode("SMTP_SEND_FAILURE");
            logEntity.setErrorMessage(ex.getClass().getSimpleName());
            record(logEntity);
            return new EmailDeliveryResult(false, STATUS_FAILED, SAFE_FAILURE_MESSAGE);
        }
    }

    private void record(EmailDeliveryLogEntity logEntity) {
        try {
            deliveryLogRepository.save(logEntity);
        } catch (Exception e) {
            log.warn("Could not record email delivery log: {}", e.getClass().getSimpleName());
        }
    }

    private static String escape(String value, String fallback) {
        return HtmlUtils.htmlEscape(value != null && !value.isBlank() ? value : fallback);
    }

    private static String button(String url, String label) {
        return "<p style=\"text-align:center\"><a class=\"btn\" href=\"" + HtmlUtils.htmlEscape(url) + "\">" + label + "</a></p>";
    }

    private static String page(String title, String body) {
        return """
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <title>%s</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
                    .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; }
                    h1 { color: #f8fafc; font-size: 22px; margin: 0 0 16px; text-align: center; }
                    p { color: #cbd5e1; font-size: 14px; line-height: 1.6; }
                    .small { color: #94a3b8; font-size: 13px; }
                    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 12px 0; }
                    .footer { text-align: center; margin-top: 28px; font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 16px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <h1>%s</h1>
                    %s
                    <div class="footer">ProWise</div>
                  </div>
                </body>
                </html>
                """.formatted(HtmlUtils.htmlEscape(title), HtmlUtils.htmlEscape(title), body);
    }

    public record EmailDeliveryResult(boolean success, String status, String message) {}
}
