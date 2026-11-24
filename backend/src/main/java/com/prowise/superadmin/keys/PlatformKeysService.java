package com.prowise.superadmin.keys;

import java.util.ArrayList;
import java.util.List;

import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

/**
 * Read-only status of the server configuration the platform needs. Values come from the running server's
 * environment (environment variables, or {@code backend/.env} locally), never from a file path chosen here.
 * Secrets are reported only as configured / missing; their values never leave the server, and nothing in this
 * service writes configuration. Keys are changed on the server and take effect on restart.
 */
@Service
public class PlatformKeysService {

    private record KeyMeta(String key, String category, String purpose, boolean secret, boolean required) {}

    private static final List<KeyMeta> KEYS = List.of(
        new KeyMeta("JWT_SIGNING_KEY", "Auth & Security", "Signs access tokens. Random, at least 32 bytes.", true, true),
        new KeyMeta("JWT_ISSUER", "Auth & Security", "Issuer claim of access tokens.", false, false),
        new KeyMeta("ACCESS_TOKEN_MINUTES", "Auth & Security", "Lifetime of access tokens in minutes.", false, false),
        new KeyMeta("REFRESH_TOKEN_DAYS", "Auth & Security", "Lifetime of refresh sessions in days.", false, false),
        new KeyMeta("DB_URL", "Database", "PostgreSQL JDBC connection URL.", false, true),
        new KeyMeta("DB_USERNAME", "Database", "PostgreSQL user name.", false, true),
        new KeyMeta("DB_PASSWORD", "Database", "PostgreSQL password.", true, true),
        new KeyMeta("SMTP_HOST", "SMTP Email", "Outgoing mail server (fallback until saved on the SMTP Email page).", false, false),
        new KeyMeta("SMTP_PORT", "SMTP Email", "SMTP port, usually 587 (STARTTLS) or 465 (SSL).", false, false),
        new KeyMeta("SMTP_USERNAME", "SMTP Email", "SMTP user name.", false, false),
        new KeyMeta("SMTP_PASSWORD", "SMTP Email", "SMTP password or Gmail App Password.", true, false),
        new KeyMeta("SMTP_FROM", "SMTP Email", "Default sender address.", false, false),
        new KeyMeta("SMTP_CREDENTIAL_ENCRYPTION_KEY", "SMTP Email", "Encrypts an SMTP password saved from the SMTP Email page (AES-256-GCM).", true, false),
        new KeyMeta("FRONTEND_URL", "Application & Web", "Public web address used in email links.", false, true),
        new KeyMeta("CORS_ALLOWED_ORIGINS", "Application & Web", "Browser origins allowed to call the API.", false, true),
        new KeyMeta("AUTH_SECURE_COOKIES", "Application & Web", "Secure attribute on session cookies (true behind HTTPS).", false, false),
        new KeyMeta("PROWISE_BOOTSTRAP_SUPER_ADMIN_EMAIL", "Super Admin", "First Super Admin. Remove once that account is active.", false, false),
        new KeyMeta("PROWISE_BOOTSTRAP_SUPER_ADMIN_PASSWORD", "Super Admin", "Optional initial password for the first Super Admin. Remove after first sign-in.", true, false)
    );

    private final Environment environment;

    public PlatformKeysService(Environment environment) {
        this.environment = environment;
    }

    public PlatformKeysDTOs.PlatformKeysResponse getKeys() {
        List<PlatformKeysDTOs.KeyItem> items = new ArrayList<>(KEYS.size());
        for (KeyMeta meta : KEYS) {
            String raw = environment.getProperty(meta.key());
            boolean configured = raw != null && !raw.isBlank();
            String value = meta.secret() || !configured ? null : displayValue(meta.key(), raw.trim());
            items.add(new PlatformKeysDTOs.KeyItem(meta.key(), meta.category(), meta.purpose(),
                    meta.secret(), meta.required(), configured, value));
        }
        return new PlatformKeysDTOs.PlatformKeysResponse(items);
    }

    /** A JDBC URL may carry credentials in its query string or user-info part; only host, port and database are shown. */
    private static String displayValue(String key, String value) {
        if (!"DB_URL".equals(key)) return value;
        String withoutQuery = value.contains("?") ? value.substring(0, value.indexOf('?')) : value;
        int at = withoutQuery.indexOf('@');
        int scheme = withoutQuery.indexOf("//");
        if (at > 0 && scheme >= 0 && at > scheme) {
            withoutQuery = withoutQuery.substring(0, scheme + 2) + withoutQuery.substring(at + 1);
        }
        return withoutQuery;
    }
}
