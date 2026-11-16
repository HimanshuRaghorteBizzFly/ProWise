package com.prowise.common.config;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.Ordered;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.util.StringUtils;

/**
 * Fails startup before any bean is created when required configuration is missing, naming the
 * environment variables (never their values). Runs after config files and backend/.env are loaded.
 */
public class RequiredEnvironmentValidator implements EnvironmentPostProcessor, Ordered {

    static final Map<String, String> REQUIRED = new LinkedHashMap<>();

    static {
        REQUIRED.put("spring.datasource.url", "DB_URL");
        REQUIRED.put("spring.datasource.username", "DB_USERNAME");
        REQUIRED.put("spring.datasource.password", "DB_PASSWORD");
    }

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        List<String> missing = REQUIRED.entrySet().stream()
                .filter(entry -> !StringUtils.hasText(safeGet(environment, entry.getKey())))
                .map(Map.Entry::getValue)
                .toList();
        if (!missing.isEmpty()) {
            throw new MissingEnvironmentException(missing);
        }
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
