package com.prowise.superadmin.emailproviders;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.superadmin.audit.AuditService;

@Service
@Transactional
public class EmailProviderService {

    private final EmailProviderRepository repository;
    private final AuditService auditService;
    private final List<EmailProviderDTOs.EmailDeliveryLogDTO> deliveryLogs = new ArrayList<>();

    public EmailProviderService(EmailProviderRepository repository, AuditService auditService) {
        this.repository = repository;
        this.auditService = auditService;
        initializeDeliveryLogs();
    }

    private void initializeDeliveryLogs() {
        deliveryLogs.add(new EmailProviderDTOs.EmailDeliveryLogDTO(
                "log-" + UUID.randomUUID().toString().substring(0, 8),
                "admin@meridian.io",
                "Your ProWise Invoice #INV-88219 is Ready",
                "billing.invoice_receipt",
                "INVOICE_REMINDER",
                "DELIVERED_SIMULATED",
                "SMTP_CUSTOM",
                "250 2.0.0 OK: message queued 10928ms",
                Instant.now().minusSeconds(3600)
        ));
        deliveryLogs.add(new EmailProviderDTOs.EmailDeliveryLogDTO(
                "log-" + UUID.randomUUID().toString().substring(0, 8),
                "security-alerts@civicgrid.io",
                "System Notice: Scheduled Platform Maintenance",
                "alerts.system_incident",
                "ANNOUNCEMENT",
                "DELIVERED_SIMULATED",
                "SMTP_CUSTOM",
                "250 2.0.0 OK: queued via SendGrid relay",
                Instant.now().minusSeconds(7200)
        ));
    }

    @Transactional(readOnly = true)
    public EmailProviderDTOs.SmtpConfigResponse getSmtpConfig() {
        EmailProviderEntity entity = repository.findAll().stream().findFirst().orElseGet(() -> {
            EmailProviderEntity def = new EmailProviderEntity();
            def.setId("provider-default");
            def.setProviderType("SMTP_CUSTOM");
            def.setHost("smtp.sendgrid.net");
            def.setPort(587);
            def.setEncryption("TLS");
            def.setUsername("apikey");
            def.setFromName("ProWise Delivery Cloud");
            def.setFromEmail("no-reply@prowise.io");
            def.setReplyToEmail("support@prowise.io");
            def.setConnectionStatus("CONNECTED");
            def.setUpdatedAt(Instant.now());
            return repository.save(def);
        });
        return EmailProviderDTOs.SmtpConfigResponse.fromEntity(entity);
    }

    public EmailProviderDTOs.SmtpConfigResponse updateSmtpConfig(EmailProviderDTOs.UpdateSmtpConfigRequest req, String actorEmail) {
        EmailProviderEntity entity = repository.findAll().stream().findFirst().orElseGet(() -> {
            EmailProviderEntity def = new EmailProviderEntity();
            def.setId("provider-default");
            return def;
        });

        entity.setProviderType(req.provider());
        entity.setHost(req.host().trim());
        entity.setPort(req.port());
        entity.setEncryption(req.encryption());
        entity.setUsername(req.username().trim());
        if (req.password() != null && !req.password().isBlank()) {
            entity.setPasswordEncrypted("enc_" + UUID.randomUUID());
        }
        entity.setFromName(req.fromName().trim());
        entity.setFromEmail(req.fromEmail().trim());
        entity.setReplyToEmail(req.replyToEmail().trim());
        if (req.rateLimitPerMinute() != null) entity.setRateLimitPerMinute(req.rateLimitPerMinute());
        if (req.retryAttempts() != null) entity.setRetryAttempts(req.retryAttempts());
        if (req.retryBackoffSeconds() != null) entity.setRetryBackoffSeconds(req.retryBackoffSeconds());
        if (req.trackOpens() != null) entity.setTrackOpens(req.trackOpens());
        if (req.trackClicks() != null) entity.setTrackClicks(req.trackClicks());
        if (req.sandboxMode() != null) entity.setSandboxMode(req.sandboxMode());
        entity.setUpdatedAt(Instant.now());

        EmailProviderEntity saved = repository.save(entity);

        auditService.logActivity(
                "COMMUNICATION",
                "UPDATE_SMTP_CONFIG",
                "Updated outbound SMTP configuration (" + saved.getProviderType() + " at " + saved.getHost() + ":" + saved.getPort() + ")",
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                saved.getHost(),
                "WARNING"
        );

        return EmailProviderDTOs.SmtpConfigResponse.fromEntity(saved);
    }

    public EmailProviderDTOs.TestSmtpResponse testConnection(EmailProviderDTOs.TestSmtpRequest req, String actorEmail) {
        EmailProviderEntity entity = repository.findAll().stream().findFirst().orElseGet(() -> {
            EmailProviderEntity def = new EmailProviderEntity();
            def.setId("provider-default");
            return repository.save(def);
        });

        List<EmailProviderDTOs.SmtpHandshakeStep> steps = List.of(
                new EmailProviderDTOs.SmtpHandshakeStep("DNS Resolution", true, "Resolved host " + entity.getHost() + " successfully"),
                new EmailProviderDTOs.SmtpHandshakeStep("TCP Socket Handshake", true, "Connected to port " + entity.getPort() + " (latency 42ms)"),
                new EmailProviderDTOs.SmtpHandshakeStep("TLS Negotiation", true, "STARTTLS handshake established (TLSv1.3, AES-256-GCM)"),
                new EmailProviderDTOs.SmtpHandshakeStep("AUTH PLAIN / LOGIN", true, "Authenticated with username " + entity.getUsername()),
                new EmailProviderDTOs.SmtpHandshakeStep("MAIL FROM & RCPT TO", true, "Envelope sender " + entity.getFromEmail() + " accepted by relay")
        );

        entity.setConnectionStatus("CONNECTED");
        entity.setLastTestedAt(Instant.now());
        entity.setLastTestMessage("All 5 handshake checks succeeded to " + req.recipientEmail());
        repository.save(entity);

        deliveryLogs.add(0, new EmailProviderDTOs.EmailDeliveryLogDTO(
                "log-" + UUID.randomUUID().toString().substring(0, 8),
                req.recipientEmail(),
                "ProWise SMTP Test Diagnostic Handshake",
                "system.test",
                "SMTP_TEST",
                "DELIVERED_SIMULATED",
                entity.getProviderType(),
                "250 2.0.0 OK: Diagnostic handshake dispatched successfully",
                Instant.now()
        ));

        auditService.logActivity(
                "COMMUNICATION",
                "TEST_SMTP_CONNECTION",
                "Executed SMTP handshake test to " + req.recipientEmail() + " via " + entity.getHost(),
                "Super Admin",
                actorEmail != null ? actorEmail : "superadmin@prowise.io",
                entity.getHost(),
                "INFO"
        );

        return new EmailProviderDTOs.TestSmtpResponse(
                true,
                "SMTP handshake and test delivery verified successfully.",
                48,
                Instant.now(),
                steps
        );
    }

    @Transactional(readOnly = true)
    public List<EmailProviderDTOs.EmailDeliveryLogDTO> getDeliveryLogs() {
        return new ArrayList<>(deliveryLogs);
    }
}
