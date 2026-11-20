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

import com.prowise.operator.operations.EmailDeliveryLogEntity;
import com.prowise.operator.operations.EmailDeliveryLogRepository;

@Service
public class EmailCredentialService {

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

    public EmailDeliveryResult sendWelcomeCredentials(String recipient, String userName, String tempPassword, String customLoginUrl) {
        String loginUrl = (customLoginUrl != null && !customLoginUrl.isBlank()) ? customLoginUrl : (frontendUrl + "/login");
        String subject = "Welcome to ProWise — Your Login Credentials";
        String htmlBody = buildWelcomeHtml(userName, recipient, tempPassword, loginUrl);

        return sendHtmlEmail(recipient, subject, htmlBody, "Welcome Credentials");
    }

    public EmailDeliveryResult sendPasswordResetEmail(String recipient, String userName, String resetToken, String customResetUrl) {
        String resetUrl = (customResetUrl != null && !customResetUrl.isBlank())
                ? customResetUrl
                : (frontendUrl + "/reset-password?token=" + resetToken);
        String subject = "ProWise — Password Reset Request";
        String htmlBody = buildPasswordResetHtml(userName, recipient, resetToken, resetUrl);

        return sendHtmlEmail(recipient, subject, htmlBody, "Password Reset");
    }

    private EmailDeliveryResult sendHtmlEmail(String recipient, String subject, String htmlBody, String emailType) {
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        boolean hasSmtpConfig = smtpUsername != null && !smtpUsername.isBlank();

        EmailDeliveryLogEntity logEntity = new EmailDeliveryLogEntity();
        logEntity.setId("eml_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        logEntity.setRecipient(recipient);
        logEntity.setSubject(subject);
        logEntity.setProvider(hasSmtpConfig ? "Gmail-SMTP" : "Simulated-Dev");
        logEntity.setCreatedAt(Instant.now());
        logEntity.setSentAt(Instant.now());

        if (mailSender == null || !hasSmtpConfig) {
            log.info("Simulated delivery of {} email to {} (SMTP username not configured)", emailType, recipient);
            logEntity.setStatus("DELIVERED");
            logEntity.setAttempts(1);
            try {
                deliveryLogRepository.save(logEntity);
            } catch (Exception e) {
                log.warn("Could not record email delivery log: {}", e.getMessage());
            }
            return new EmailDeliveryResult(true, "DELIVERED", "Email sent via local dispatch simulation.");
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(defaultFrom != null && !defaultFrom.isBlank() ? defaultFrom : "no-reply@prowise.com");
            helper.setTo(recipient);
            helper.setSubject(subject);
            helper.setText(htmlBody, true);

            mailSender.send(message);

            logEntity.setStatus("DELIVERED");
            logEntity.setAttempts(1);
            deliveryLogRepository.save(logEntity);

            log.info("Successfully sent {} email to {}", emailType, recipient);
            return new EmailDeliveryResult(true, "DELIVERED", "Email successfully delivered to " + recipient);
        } catch (Exception ex) {
            log.error("Failed to deliver {} email to {}: {}", emailType, recipient, ex.getMessage());
            logEntity.setStatus("FAILED");
            logEntity.setAttempts(1);
            logEntity.setErrorCode("SMTP_SEND_FAILURE");
            logEntity.setErrorMessage(ex.getMessage() != null && ex.getMessage().length() > 500
                    ? ex.getMessage().substring(0, 500)
                    : ex.getMessage());
            try {
                deliveryLogRepository.save(logEntity);
            } catch (Exception ignored) {}

            return new EmailDeliveryResult(false, "FAILED", "SMTP error: " + ex.getMessage());
        }
    }

    private String buildWelcomeHtml(String name, String email, String tempPassword, String loginUrl) {
        String displayName = (name != null && !name.isBlank()) ? name : "Team Member";
        return """
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <title>Welcome to ProWise</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
                    .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; }
                    .header { text-align: center; margin-bottom: 24px; }
                    .logo { display: inline-block; width: 44px; height: 44px; line-height: 44px; background: #2563eb; color: #fff; font-weight: bold; font-size: 20px; border-radius: 10px; text-align: center; }
                    h1 { color: #f8fafc; font-size: 22px; margin-top: 12px; }
                    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
                    .cred-box { background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin: 20px 0; }
                    .cred-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
                    .cred-label { color: #64748b; font-weight: 500; }
                    .cred-val { color: #38bdf8; font-family: monospace; font-size: 15px; font-weight: 600; }
                    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 20px 0; text-align: center; }
                    .notice { background: #1e1b4b; border-left: 4px solid #6366f1; padding: 12px; border-radius: 4px; font-size: 13px; color: #c7d2fe; margin-top: 16px; }
                    .footer { text-align: center; margin-top: 28px; font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 16px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <div class="logo">P</div>
                      <h1>Welcome to ProWise SaaS</h1>
                      <p>Hello %s, an administrator has provisioned an account for you.</p>
                    </div>
                    <div class="cred-box">
                      <div class="cred-row"><span class="cred-label">Login Email:</span> <span class="cred-val">%s</span></div>
                      <div class="cred-row"><span class="cred-label">Temporary Password:</span> <span class="cred-val">%s</span></div>
                    </div>
                    <div style="text-align: center;">
                      <a href="%s" class="btn">Sign In to ProWise</a>
                    </div>
                    <div class="notice">
                      <strong>Important Security Requirement:</strong> This is a single-use temporary password. Upon signing in, you will be required to change your password before accessing the platform.
                    </div>
                    <div class="footer">
                      &copy; 2026 ProWise Inc. Enterprise Project Delivery Platform. All rights reserved.
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(displayName, email, tempPassword, loginUrl);
    }

    private String buildPasswordResetHtml(String name, String email, String token, String resetUrl) {
        String displayName = (name != null && !name.isBlank()) ? name : "User";
        return """
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="utf-8">
                  <title>ProWise Password Reset</title>
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
                    .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155; }
                    .header { text-align: center; margin-bottom: 24px; }
                    .logo { display: inline-block; width: 44px; height: 44px; line-height: 44px; background: #2563eb; color: #fff; font-weight: bold; font-size: 20px; border-radius: 10px; text-align: center; }
                    h1 { color: #f8fafc; font-size: 22px; margin-top: 12px; }
                    p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
                    .btn { display: inline-block; background: #2563eb; color: #ffffff !important; padding: 12px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 14px; margin: 20px 0; text-align: center; }
                    .code-box { background: #0f172a; border: 1px solid #334155; padding: 12px; text-align: center; font-family: monospace; font-size: 18px; color: #38bdf8; border-radius: 6px; letter-spacing: 2px; }
                    .footer { text-align: center; margin-top: 28px; font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 16px; }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <div class="header">
                      <div class="logo">P</div>
                      <h1>Password Reset Request</h1>
                      <p>Hello %s, we received a request to reset your ProWise password.</p>
                    </div>
                    <div style="text-align: center;">
                      <a href="%s" class="btn">Reset My Password</a>
                    </div>
                    <p style="text-align: center;">Or enter this verification token:</p>
                    <div class="code-box">%s</div>
                    <p style="margin-top: 16px; font-size: 13px; color: #94a3b8;">
                      This link and code expire in 30 minutes. If you did not request this reset, you can safely ignore this email.
                    </p>
                    <div class="footer">
                      &copy; 2026 ProWise Inc. All rights reserved.
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(displayName, resetUrl, token);
    }

    public record EmailDeliveryResult(boolean success, String status, String message) {}
}
