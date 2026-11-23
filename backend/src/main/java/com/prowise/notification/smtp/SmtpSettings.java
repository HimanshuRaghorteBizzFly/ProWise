package com.prowise.notification.smtp;

import java.util.Locale;

/**
 * The effective outbound SMTP configuration used for one delivery or test. The password is held only in memory
 * and is never printed: {@link #toString()} redacts it.
 */
public record SmtpSettings(
        String provider,
        String host,
        int port,
        Encryption encryption,
        String username,
        String password,
        String fromName,
        String fromEmail,
        String replyTo,
        int rateLimitPerMinute,
        int retryAttempts,
        int retryWaitSeconds,
        Source source
) {

    /** TLS = STARTTLS on a plain port (587), required. SSL = implicit TLS (465). NONE = loopback relays only. */
    public enum Encryption {
        TLS, SSL, NONE;

        public static Encryption parse(String value) {
            if (value == null || value.isBlank()) return TLS;
            String normalized = value.trim().toUpperCase(Locale.ROOT);
            return switch (normalized) {
                case "STARTTLS", "TLS" -> TLS;
                case "SSL", "SMTPS" -> SSL;
                case "NONE" -> NONE;
                default -> throw new IllegalArgumentException("Unknown SMTP encryption: " + value);
            };
        }
    }

    /** Where the settings came from: saved by the Super Admin, or the SMTP_* environment variables. */
    public enum Source { DATABASE, ENVIRONMENT }

    public boolean hasHost() {
        return host != null && !host.isBlank();
    }

    public boolean hasUsername() {
        return username != null && !username.isBlank();
    }

    public boolean hasPassword() {
        return password != null && !password.isBlank();
    }

    /** Everything a real authenticated delivery needs. */
    public boolean isComplete() {
        return hasHost() && port > 0 && hasUsername() && hasPassword() && fromEmail != null && !fromEmail.isBlank();
    }

    public int safeRetryAttempts() {
        return Math.max(1, Math.min(retryAttempts, 5));
    }

    public int safeRetryWaitSeconds() {
        return Math.max(0, Math.min(retryWaitSeconds, 30));
    }

    @Override
    public String toString() {
        return "SmtpSettings[provider=" + provider + ", host=" + host + ", port=" + port + ", encryption=" + encryption
                + ", username=" + username + ", password=" + (hasPassword() ? "<redacted>" : "<none>")
                + ", fromEmail=" + fromEmail + ", source=" + source + "]";
    }
}
