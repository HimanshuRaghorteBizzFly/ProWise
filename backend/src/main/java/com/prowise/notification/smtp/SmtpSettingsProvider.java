package com.prowise.notification.smtp;

import java.util.Locale;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import com.prowise.superadmin.emailproviders.EmailProviderEntity;
import com.prowise.superadmin.emailproviders.EmailProviderRepository;

/**
 * Resolves the SMTP settings every delivery uses. Settings the Super Admin saved win; until then the SMTP_*
 * environment variables are used. A password saved from the panel is decrypted here, in memory only. When the
 * panel saved no password and the username matches SMTP_USERNAME, SMTP_PASSWORD is used.
 */
@Component
public class SmtpSettingsProvider {

    public enum PasswordSource { DATABASE, ENVIRONMENT, NONE, UNREADABLE }

    public record Resolved(SmtpSettings settings, PasswordSource passwordSource, String problem) {}

    private final EmailProviderRepository repository;
    private final SmtpCredentialCipher cipher;
    private final String envHost;
    private final int envPort;
    private final String envUsername;
    private final String envPassword;
    private final String envFrom;
    private final String envFromName;
    private final String envReplyTo;
    private final String envEncryption;

    public SmtpSettingsProvider(EmailProviderRepository repository, SmtpCredentialCipher cipher,
            @Value("${spring.mail.host:}") String envHost,
            @Value("${spring.mail.port:587}") int envPort,
            @Value("${spring.mail.username:}") String envUsername,
            @Value("${spring.mail.password:}") String envPassword,
            @Value("${prowise.mail.from:}") String envFrom,
            @Value("${prowise.mail.from-name:ProWise Platform}") String envFromName,
            @Value("${prowise.mail.reply-to:}") String envReplyTo,
            @Value("${prowise.mail.encryption:}") String envEncryption) {
        this.repository = repository;
        this.cipher = cipher;
        this.envHost = trim(envHost);
        this.envPort = envPort;
        this.envUsername = trim(envUsername);
        this.envPassword = envPassword == null ? "" : envPassword;
        this.envFrom = trim(envFrom);
        this.envFromName = trim(envFromName);
        this.envReplyTo = trim(envReplyTo);
        this.envEncryption = trim(envEncryption);
    }

    public SmtpSettings current() {
        return resolve().settings();
    }

    public Resolved resolve() {
        Optional<EmailProviderEntity> row = repository.findById(EmailProviderEntity.DEFAULT_ID);
        if (row.isPresent() && row.get().isAdminConfigured()) {
            return fromDatabase(row.get());
        }
        return fromEnvironment();
    }

    /** True when SMTP_USERNAME and SMTP_PASSWORD are present in the server environment. */
    public boolean environmentHasCredentials() {
        return !envUsername.isEmpty() && !envPassword.isBlank();
    }

    public String environmentUsername() {
        return envUsername;
    }

    private Resolved fromDatabase(EmailProviderEntity e) {
        String password = null;
        PasswordSource source = PasswordSource.NONE;
        String problem = null;
        if (e.getPasswordEncrypted() != null && !e.getPasswordEncrypted().isBlank()) {
            try {
                password = cipher.decrypt(e.getPasswordEncrypted());
                source = PasswordSource.DATABASE;
            } catch (SmtpCredentialCipher.CredentialUnreadableException ex) {
                source = PasswordSource.UNREADABLE;
                problem = ex.getMessage() + " Enter the SMTP password again.";
            }
        } else if (!envPassword.isBlank() && envUsername.equalsIgnoreCase(trim(e.getUsername()))) {
            password = envPassword;
            source = PasswordSource.ENVIRONMENT;
        }
        SmtpSettings settings = new SmtpSettings(e.getProviderType(), trim(e.getHost()), e.getPort(),
                SmtpSettings.Encryption.parse(e.getEncryption()), trim(e.getUsername()), password,
                e.getFromName(), trim(e.getFromEmail()), trim(e.getReplyToEmail()),
                e.getRateLimitPerMinute(), e.getRetryAttempts(), e.getRetryBackoffSeconds(), SmtpSettings.Source.DATABASE);
        return new Resolved(settings, source, problem);
    }

    private Resolved fromEnvironment() {
        SmtpSettings.Encryption encryption = envEncryption.isEmpty()
                ? (envPort == 465 ? SmtpSettings.Encryption.SSL : SmtpSettings.Encryption.TLS)
                : SmtpSettings.Encryption.parse(envEncryption);
        String from = envFrom.isEmpty() ? envUsername : envFrom;
        SmtpSettings settings = new SmtpSettings(providerFor(envHost), envHost, envPort, encryption, envUsername,
                envPassword.isBlank() ? null : envPassword, envFromName, from, envReplyTo, 60, 3, 5,
                SmtpSettings.Source.ENVIRONMENT);
        return new Resolved(settings, envPassword.isBlank() ? PasswordSource.NONE : PasswordSource.ENVIRONMENT, null);
    }

    static String providerFor(String host) {
        String h = host == null ? "" : host.toLowerCase(Locale.ROOT);
        if (h.endsWith("gmail.com") || h.endsWith("googlemail.com")) return "GMAIL";
        if (h.contains("sendgrid")) return "SENDGRID";
        if (h.contains("amazonaws.com")) return "AWS_SES";
        if (h.contains("postmarkapp")) return "POSTMARK";
        if (h.contains("mailgun")) return "MAILGUN";
        return "SMTP_CUSTOM";
    }

    private static String trim(String value) {
        return value == null ? "" : value.trim();
    }
}
