package com.prowise.superadmin.emailproviders;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import jakarta.persistence.criteria.Predicate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.identity.EmailCredentialService;
import com.prowise.notification.smtp.SmtpCredentialCipher;
import com.prowise.notification.smtp.SmtpMailGateway;
import com.prowise.notification.smtp.SmtpSettings;
import com.prowise.notification.smtp.SmtpSettingsProvider;
import com.prowise.operator.operations.EmailDeliveryLogEntity;
import com.prowise.operator.operations.EmailDeliveryLogRepository;
import com.prowise.superadmin.audit.AuditService;

/**
 * Platform SMTP administration. Nothing here is simulated: a connection status comes only from a real SMTP
 * conversation, a test email is really sent, and logs are read from PostgreSQL. Saving settings never marks
 * SMTP as connected. Every change is audited in the same transaction (admin_audit_logs; platform scope has no org).
 */
@Service
public class EmailProviderService {

    static final Set<String> PROVIDERS = Set.of("GMAIL", "SENDGRID", "AWS_SES", "POSTMARK", "MAILGUN", "SMTP_CUSTOM");
    private static final Set<String> LOOPBACK = Set.of("localhost", "127.0.0.1", "::1");
    private static final String ACCEPTANCE_NOTE = "SMTP_ACCEPTED means the SMTP server accepted the message for delivery. "
            + "It does not prove the message reached the inbox; check the recipient mailbox (including spam).";

    private final EmailProviderRepository repository;
    private final AuditService auditService;
    private final SmtpSettingsProvider settingsProvider;
    private final SmtpMailGateway gateway;
    private final SmtpCredentialCipher cipher;
    private final EmailCredentialService emailService;
    private final EmailDeliveryLogRepository logRepository;
    private final JdbcTemplate jdbc;

    public EmailProviderService(EmailProviderRepository repository, AuditService auditService,
            SmtpSettingsProvider settingsProvider, SmtpMailGateway gateway, SmtpCredentialCipher cipher,
            EmailCredentialService emailService, EmailDeliveryLogRepository logRepository, JdbcTemplate jdbc) {
        this.repository = repository;
        this.auditService = auditService;
        this.settingsProvider = settingsProvider;
        this.gateway = gateway;
        this.cipher = cipher;
        this.emailService = emailService;
        this.logRepository = logRepository;
        this.jdbc = jdbc;
    }

    /* ------------------------------------------------------------------ settings */

    @Transactional
    public EmailProviderDTOs.SmtpSettingsResponse getSettings() {
        return toResponse(row());
    }

    @Transactional
    public EmailProviderDTOs.SmtpSettingsResponse updateSettings(EmailProviderDTOs.UpdateSmtpSettingsRequest req, String actor) {
        List<ApiError.FieldError> errors = new ArrayList<>();
        String provider = upper(req.provider());
        if (!PROVIDERS.contains(provider)) errors.add(field("provider", "Choose a supported provider."));
        String host = trim(req.host());
        if (host.isEmpty() || host.length() > 255 || !host.matches("^[A-Za-z0-9.:\\-\\[\\]]+$")) {
            errors.add(field("host", "Enter a valid SMTP host name."));
        }
        if (req.port() == null || req.port() < 1 || req.port() > 65535) errors.add(field("port", "Enter a port from 1 to 65535."));
        SmtpSettings.Encryption encryption = null;
        try {
            encryption = SmtpSettings.Encryption.parse(req.encryption());
        } catch (IllegalArgumentException e) {
            errors.add(field("encryption", "Choose STARTTLS (TLS), SSL or NONE."));
        }
        if (encryption == SmtpSettings.Encryption.NONE && !LOOPBACK.contains(host.toLowerCase(Locale.ROOT))) {
            errors.add(field("encryption", "Unencrypted SMTP is only allowed for a relay on this server (localhost)."));
        }
        String username = trim(req.username());
        if (username.isEmpty() || username.length() > 255) errors.add(field("username", "Enter the SMTP account username."));
        String password = req.password() == null ? "" : req.password();
        if (password.length() > 500) errors.add(field("password", "The password is too long."));
        String fromName = trim(req.fromName());
        if (fromName.length() > 120 || fromName.matches(".*[\\r\\n].*")) errors.add(field("from_name", "Enter a sender name up to 120 characters."));
        String fromEmail = trim(req.fromEmail());
        if (!SmtpMailGateway.isValidAddress(fromEmail)) errors.add(field("from_email", "Enter a valid sender email."));
        String replyTo = trim(req.replyToEmail());
        if (!replyTo.isEmpty() && !SmtpMailGateway.isValidAddress(replyTo)) errors.add(field("reply_to_email", "Enter a valid reply-to email."));
        int rateLimit = req.rateLimitPerMinute() == null ? 60 : req.rateLimitPerMinute();
        if (rateLimit < 1 || rateLimit > 10_000) errors.add(field("rate_limit_per_minute", "Use 1 to 10000 emails per minute."));
        int retryAttempts = req.retryAttempts() == null ? 3 : req.retryAttempts();
        if (retryAttempts < 1 || retryAttempts > 5) errors.add(field("retry_attempts", "Use 1 to 5 attempts."));
        int retryWait = req.retryWaitSeconds() == null ? 5 : req.retryWaitSeconds();
        if (retryWait < 0 || retryWait > 30) errors.add(field("retry_wait_seconds", "Use 0 to 30 seconds."));
        if (req.expectedVersion() == null) errors.add(field("expected_version", "Send the version you loaded."));
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.", errors);
        }
        if (!password.isBlank() && !cipher.isAvailable()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "SMTP_ENCRYPTION_KEY_MISSING",
                    "The server has no SMTP_CREDENTIAL_ENCRYPTION_KEY, so a password cannot be stored. Set it and restart the API.");
        }

        EmailProviderEntity entity = row();
        ExpectedVersion.check(entity.getVersion(), req.expectedVersion());
        entity.setProviderType(provider);
        entity.setHost(host);
        entity.setPort(req.port());
        entity.setEncryption(encryption.name());
        entity.setUsername(username);
        boolean passwordChanged = !password.isBlank();
        if (passwordChanged) {
            entity.setPasswordEncrypted(cipher.encrypt(password));
            entity.setPasswordUpdatedAt(Instant.now());
        }
        entity.setFromName(fromName.isEmpty() ? "ProWise Platform" : fromName);
        entity.setFromEmail(fromEmail);
        entity.setReplyToEmail(replyTo);
        entity.setRateLimitPerMinute(rateLimit);
        entity.setRetryAttempts(retryAttempts);
        entity.setRetryBackoffSeconds(retryWait);
        entity.setAdminConfigured(true);
        // Saving is not connecting: the status is only ever set by a real test.
        entity.setConnectionStatus("NOT_TESTED");
        entity.setLastTestMessage("Settings changed. Run Test Connection to verify them.");
        entity.setUpdatedBy(actor);
        entity.setUpdatedAt(Instant.now());
        EmailProviderEntity saved = repository.saveAndFlush(entity);

        auditService.logActivity("COMMUNICATION", "UPDATE_SMTP_CONFIG",
                "Updated SMTP settings (" + provider + " " + host + ":" + req.port() + ", " + encryption.name() + ")"
                        + (passwordChanged ? "; SMTP password replaced" : ""),
                "Super Admin", actor, host, "WARNING");
        return toResponse(saved);
    }

    /* ------------------------------------------------------------------ live checks */

    @Transactional
    public EmailProviderDTOs.ConnectionTestResponse testConnection(String actor) {
        SmtpSettingsProvider.Resolved resolved = settingsProvider.resolve();
        SmtpSettings settings = resolved.settings();
        SmtpMailGateway.ConnectionResult result = resolved.problem() != null
                ? new SmtpMailGateway.ConnectionResult(com.prowise.notification.smtp.SmtpStatus.NOT_CONFIGURED, 0, null, resolved.problem(), false)
                : gateway.testConnection(settings);
        Instant testedAt = Instant.now();

        EmailProviderEntity entity = row();
        jdbc.update("""
                INSERT INTO smtp_connection_tests (id, provider_id, status, host, port, encryption, latency_ms, server_response,
                    detail, tested_by, tested_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), entity.getId(), result.status().name(), settings.host(), settings.port(),
                settings.encryption().name(), (int) result.latencyMs(), result.serverResponse(), result.detail(), actor,
                java.sql.Timestamp.from(testedAt));
        entity.setConnectionStatus(result.status().name());
        entity.setLastTestedAt(testedAt);
        entity.setLastTestMessage(result.detail());
        repository.save(entity);

        auditService.logActivity("COMMUNICATION", "TEST_SMTP_CONNECTION",
                "SMTP connection test to " + settings.host() + ":" + settings.port() + " result " + result.status(),
                "Super Admin", actor, settings.host(), result.status() == com.prowise.notification.smtp.SmtpStatus.CONNECTED ? "INFO" : "WARNING");
        return new EmailProviderDTOs.ConnectionTestResponse(result.status().name(), result.latencyMs(), result.serverResponse(),
                result.detail(), result.encrypted(), settings.host(), settings.port(), settings.encryption().name(), testedAt);
    }

    @Transactional
    public EmailProviderDTOs.TestEmailResponse sendTestEmail(EmailProviderDTOs.TestEmailRequest req, String actor) {
        String recipient = req == null ? "" : trim(req.recipient());
        if (!SmtpMailGateway.isValidAddress(recipient)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.",
                    List.of(field("recipient", "Enter a valid recipient email address.")));
        }
        EmailCredentialService.TestEmailResult r = emailService.sendTestEmail(recipient);
        auditService.logActivity("COMMUNICATION", "SEND_SMTP_TEST_EMAIL",
                "SMTP test email to " + recipient + " result " + r.status(), "Super Admin", actor, recipient,
                r.accepted() ? "INFO" : "WARNING");
        return new EmailProviderDTOs.TestEmailResponse(r.accepted(), r.status(), r.recipient(), r.sender(), r.provider(),
                r.attemptedAt(), r.messageId(), r.smtpResponse(), r.error(), r.attempts(), r.logId(), ACCEPTANCE_NOTE);
    }

    @Transactional
    public EmailProviderDTOs.VerifySenderResponse verifySender(EmailProviderDTOs.VerifySenderRequest req, String actor) {
        SmtpSettings settings = settingsProvider.current();
        String sender = req == null || trim(req.senderEmail()).isEmpty() ? trim(settings.fromEmail()) : trim(req.senderEmail());
        if (!SmtpMailGateway.isValidAddress(sender)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.",
                    List.of(field("sender_email", "Enter a valid sender email address.")));
        }
        SmtpMailGateway.SenderCheck check = gateway.verifySender(settings, sender);
        auditService.logActivity("COMMUNICATION", "VERIFY_SMTP_SENDER",
                "Sender check for " + sender + ": " + (check.accepted() ? "accepted" : "not accepted"), "Super Admin", actor, sender, "INFO");
        return new EmailProviderDTOs.VerifySenderResponse(sender, check.accepted(), check.connectionStatus().name(),
                check.smtpResponse(), check.detail(), check.matchesAuthenticatedAccount(), Instant.now());
    }

    /* ------------------------------------------------------------------ logs */

    @Transactional(readOnly = true)
    public EmailProviderDTOs.EmailDeliveryLogPage logs(int page, int size, String q, String status, String type, String from, String to) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(size, 100));
        Instant fromInstant = parseInstant(from, "from");
        Instant toInstant = parseInstant(to, "to");
        Specification<EmailDeliveryLogEntity> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (q != null && !q.isBlank()) {
                String like = "%" + q.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("recipient")), like, '\\'),
                        cb.like(cb.lower(root.get("subject")), like, '\\'),
                        cb.like(cb.lower(cb.coalesce(root.get("messageId"), "")), like, '\\')));
            }
            if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
                predicates.add(cb.equal(root.get("status"), status.trim().toUpperCase(Locale.ROOT)));
            }
            if (type != null && !type.isBlank() && !"ALL".equalsIgnoreCase(type)) {
                predicates.add(cb.equal(root.get("emailType"), type.trim().toUpperCase(Locale.ROOT)));
            }
            if (fromInstant != null) predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), fromInstant));
            if (toInstant != null) predicates.add(cb.lessThan(root.get("createdAt"), toInstant));
            return cb.and(predicates.toArray(Predicate[]::new));
        };
        Page<EmailDeliveryLogEntity> result = logRepository.findAll(spec,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by("id"))));
        List<EmailProviderDTOs.EmailDeliveryLogDTO> items = result.getContent().stream().map(e -> new EmailProviderDTOs.EmailDeliveryLogDTO(
                e.getId(), e.getRecipient(), e.getSender(), e.getSubject(), e.getEmailType(), e.getProvider(), e.getStatus(),
                e.getAttempts(), e.getSmtpResponse(), e.getErrorCode(), e.getErrorMessage(), e.getMessageId(), e.getCreatedAt(),
                e.getSentAt())).toList();
        return new EmailProviderDTOs.EmailDeliveryLogPage(items, safePage, safeSize, result.getTotalElements(), result.getTotalPages());
    }

    /* ------------------------------------------------------------------ helpers */

    private EmailProviderEntity row() {
        return repository.findById(EmailProviderEntity.DEFAULT_ID).orElseGet(() -> {
            EmailProviderEntity created = new EmailProviderEntity();
            created.setId(EmailProviderEntity.DEFAULT_ID);
            return repository.saveAndFlush(created);
        });
    }

    private EmailProviderDTOs.SmtpSettingsResponse toResponse(EmailProviderEntity e) {
        SmtpSettingsProvider.Resolved resolved = settingsProvider.resolve();
        SmtpSettings s = resolved.settings();
        boolean fromDatabase = e.isAdminConfigured();
        return new EmailProviderDTOs.SmtpSettingsResponse(
                s.provider(), s.host(), s.port(), s.encryption().name(), s.username(),
                s.hasPassword(), resolved.passwordSource().name(),
                fromDatabase ? e.getPasswordUpdatedAt() : null,
                cipher.isAvailable(),
                fromDatabase ? "DATABASE" : "ENVIRONMENT",
                s.fromName(), s.fromEmail(), s.replyTo(),
                s.rateLimitPerMinute(), s.retryAttempts(), s.retryWaitSeconds(),
                e.getConnectionStatus(), e.getLastTestedAt(), e.getLastTestMessage(),
                resolved.problem(), e.getUpdatedBy(), e.getUpdatedAt(), e.getVersion());
    }

    private static Instant parseInstant(String value, String name) {
        if (value == null || value.isBlank()) return null;
        try {
            return value.length() == 10 ? java.time.LocalDate.parse(value).atStartOfDay(java.time.ZoneOffset.UTC).toInstant() : Instant.parse(value);
        } catch (DateTimeParseException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_FAILED, "The request has invalid fields.",
                    List.of(field(name, "Use an ISO date (2026-11-23) or instant (2026-11-23T10:00:00Z).")));
        }
    }

    private static ApiError.FieldError field(String name, String message) {
        return new ApiError.FieldError(name, message);
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private static String upper(String value) {
        return trim(value).toUpperCase(Locale.ROOT);
    }
}
