package com.prowise.common.config;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.util.StringUtils;

/**
 * Fails startup before any bean is created when required configuration is missing, naming the
 * environment variables (never their values). Runs after config files and backend/.env are loaded.
 *
 * <p>Under the {@code prod} profile, outgoing email, the public frontend URL and CORS origins are also
 * required, and signing keys copied from documentation or examples are refused.
 */
public class RequiredEnvironmentValidator implements EnvironmentPostProcessor, Ordered {

    static final Map<String, String> REQUIRED = new LinkedHashMap<>();
    static final Map<String, String> REQUIRED_IN_PROD = new LinkedHashMap<>();

    /** Signing keys that have appeared in this repository; never acceptable in production. */
    static final Set<String> PUBLISHED_SIGNING_KEYS = Set.of(
            "test-default-signing-key-that-is-at-least-32-bytes-long",
            "test-signing-key-that-is-at-least-32-bytes-long",
            "local-development-signing-key-change-me-32-bytes",
            "replace-with-a-random-32-byte-development-key");

    static {
        REQUIRED.put("spring.datasource.url", "DB_URL");
        REQUIRED.put("spring.datasource.username", "DB_USERNAME");
        REQUIRED.put("spring.datasource.password", "DB_PASSWORD");
        REQUIRED.put("prowise.auth.jwt-signing-key", "JWT_SIGNING_KEY");

        REQUIRED_IN_PROD.put("spring.mail.host", "SMTP_HOST");
        REQUIRED_IN_PROD.put("spring.mail.username", "SMTP_USERNAME");
        REQUIRED_IN_PROD.put("spring.mail.password", "SMTP_PASSWORD");
        REQUIRED_IN_PROD.put("prowise.mail.from", "SMTP_FROM");
        REQUIRED_IN_PROD.put("prowise.mail.frontend-url", "FRONTEND_URL");
        REQUIRED_IN_PROD.put("prowise.cors.allowed-origins", "CORS_ALLOWED_ORIGINS");
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        boolean production = Arrays.stream(environment.getActiveProfiles())
                .anyMatch(profile -> "prod".equals(profile.toLowerCase(Locale.ROOT)));

        List<String> missing = new ArrayList<>(missing(environment, REQUIRED));
        if (production) {
            missing.addAll(missing(environment, REQUIRED_IN_PROD));
            String signingKey = safeGet(environment, "prowise.auth.jwt-signing-key");
            if (StringUtils.hasText(signingKey) && PUBLISHED_SIGNING_KEYS.contains(signingKey.trim())) {
                missing.add("JWT_SIGNING_KEY (a published example value is not allowed in production)");
            }
        }
        if (!missing.isEmpty()) {
            throw new MissingEnvironmentException(missing);
        }
    }

    private static List<String> missing(ConfigurableEnvironment environment, Map<String, String> required) {
        return required.entrySet().stream()
                .filter(entry -> !StringUtils.hasText(safeGet(environment, entry.getKey())))
                .map(Map.Entry::getValue)
                .toList();
    }

    private static String safeGet(ConfigurableEnvironment environment, String key) {
        try {
            return environment.getProperty(key);
        } catch (IllegalArgumentException unresolvablePlaceholder) {
            return null;
        }
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
