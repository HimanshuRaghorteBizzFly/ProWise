package com.prowise.superadmin.emailproviders;

import java.time.Instant;
import java.util.List;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public final class EmailProviderDTOs {

    private EmailProviderDTOs() {}

    public record SmtpConfigResponse(
            String provider,
            String host,
            int port,
            String encryption,
            String username,
            boolean hasPasswordConfigured,
            Instant passwordLastRotatedAt,
            String fromName,
            String fromEmail,
            String replyToEmail,
            int rateLimitPerMinute,
            int retryAttempts,
            int retryBackoffSeconds,
            boolean trackOpens,
            boolean trackClicks,
            boolean sandboxMode,
            String connectionStatus,
            Instant lastTestedAt,
            String lastTestMessage,
            Instant updatedAt
    ) {
        public static SmtpConfigResponse fromEntity(EmailProviderEntity e) {
            return new SmtpConfigResponse(
                    e.getProviderType(),
                    e.getHost(),
                    e.getPort(),
                    e.getEncryption(),
                    e.getUsername(),
                    e.getPasswordEncrypted() != null && !e.getPasswordEncrypted().isEmpty(),
                    e.getUpdatedAt(),
                    e.getFromName(),
                    e.getFromEmail(),
                    e.getReplyToEmail(),
                    e.getRateLimitPerMinute(),
                    e.getRetryAttempts(),
                    e.getRetryBackoffSeconds(),
                    e.getTrackOpens(),
                    e.getTrackClicks(),
                    e.getSandboxMode(),
                    e.getConnectionStatus(),
                    e.getLastTestedAt(),
                    e.getLastTestMessage(),
                    e.getUpdatedAt()
            );
        }
    }

    public record UpdateSmtpConfigRequest(
            @NotBlank String provider,
            @NotBlank String host,
            @NotNull @Min(1) @Max(65535) Integer port,
            @NotBlank String encryption,
            @NotBlank String username,
            String password,
            @NotBlank String fromName,
            @NotBlank @Email String fromEmail,
            @NotBlank @Email String replyToEmail,
            Integer rateLimitPerMinute,
            Integer retryAttempts,
            Integer retryBackoffSeconds,
            Boolean trackOpens,
            Boolean trackClicks,
            Boolean sandboxMode
    ) {}

    public record TestSmtpRequest(
            @NotBlank @Email String recipientEmail
    ) {}

    public record TestSmtpResponse(
            boolean success,
            String message,
            int latencyMs,
            Instant timestamp,
            List<SmtpHandshakeStep> steps
    ) {}

    public record SmtpHandshakeStep(
            String name,
            boolean ok,
            String detail
    ) {}

    public record EmailDeliveryLogDTO(
            String id,
            String recipient,
            String subject,
            String templateKey,
            String source,
            String status,
            String provider,
            String detail,
            Instant sentAt
    ) {}
}
