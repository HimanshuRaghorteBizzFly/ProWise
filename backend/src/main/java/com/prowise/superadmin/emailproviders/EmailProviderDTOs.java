package com.prowise.superadmin.emailproviders;

import java.time.Instant;
import java.util.List;

/**
 * SMTP administration contract. No response type has a password field: only whether one is configured and
 * where it comes from. Requests are validated in {@link EmailProviderService} (after authorization).
 */
public final class EmailProviderDTOs {

    private EmailProviderDTOs() {}

    public record SmtpSettingsResponse(
            String provider,
            String host,
            int port,
            String encryption,
            String username,
            /** True when a password is available to the server (saved encrypted, or SMTP_PASSWORD). */
            boolean credentialsConfigured,
            /** DATABASE, ENVIRONMENT, NONE or UNREADABLE. */
            String passwordSource,
            Instant passwordUpdatedAt,
            /** False when SMTP_CREDENTIAL_ENCRYPTION_KEY is missing: a password cannot be saved from the panel. */
            boolean encryptionKeyConfigured,
            /** DATABASE once the Super Admin saved settings, otherwise ENVIRONMENT (SMTP_* variables). */
            String settingsSource,
            String fromName,
            String fromEmail,
            String replyToEmail,
            int rateLimitPerMinute,
            int retryAttempts,
            int retryWaitSeconds,
            /** Written only by a real connection test: NOT_TESTED until the first one. */
            String connectionStatus,
            Instant lastTestedAt,
            String lastTestMessage,
            String problem,
            String updatedBy,
            Instant updatedAt,
            long version
    ) {}

    public record UpdateSmtpSettingsRequest(
            String provider,
            String host,
            Integer port,
            String encryption,
            String username,
            /** Write-only. Omit or leave blank to keep the stored password. */
            String password,
            String fromName,
            String fromEmail,
            String replyToEmail,
            Integer rateLimitPerMinute,
            Integer retryAttempts,
            Integer retryWaitSeconds,
            Long expectedVersion
    ) {}

    public record ConnectionTestResponse(
            String status,
            long latencyMs,
            String serverResponse,
            String detail,
            boolean encrypted,
            String host,
            int port,
            String encryption,
            Instant testedAt
    ) {}

    public record TestEmailRequest(String recipient) {}

    public record TestEmailResponse(
            boolean accepted,
            /** SMTP_ACCEPTED, FAILED or NOT_SENT. */
            String status,
            String recipient,
            String sender,
            String provider,
            Instant attemptedAt,
            String messageId,
            String smtpResponse,
            String error,
            int attempts,
            String logId,
            String note
    ) {}

    public record VerifySenderRequest(String senderEmail) {}

    public record VerifySenderResponse(
            String senderEmail,
            boolean accepted,
            String connectionStatus,
            String smtpResponse,
            String detail,
            boolean matchesAuthenticatedAccount,
            Instant checkedAt
    ) {}

    public record EmailDeliveryLogDTO(
            String id,
            String recipient,
            String sender,
            String subject,
            String emailType,
            String provider,
            String status,
            int attempts,
            String smtpResponse,
            String errorCode,
            String errorMessage,
            String messageId,
            Instant createdAt,
            Instant sentAt
    ) {}

    public record EmailDeliveryLogPage(List<EmailDeliveryLogDTO> items, int page, int size, long total, int totalPages) {}
}
