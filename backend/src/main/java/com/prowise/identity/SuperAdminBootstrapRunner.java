package com.prowise.identity;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/**
 * Runs {@link SuperAdminBootstrapService} once per startup when deployment configuration sets
 * {@code PROWISE_BOOTSTRAP_SUPER_ADMIN_EMAIL}. A failure is logged by class name only (never a link or token) and
 * does not stop the application: bootstrap is fail-closed and simply retries on the next start.
 */
@Component
public class SuperAdminBootstrapRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SuperAdminBootstrapRunner.class);

    private final SuperAdminBootstrapService bootstrapService;
    private final String configuredEmail;

    public SuperAdminBootstrapRunner(SuperAdminBootstrapService bootstrapService,
            @Value("${prowise.bootstrap.super-admin-email:}") String configuredEmail) {
        this.bootstrapService = bootstrapService;
        this.configuredEmail = configuredEmail;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (configuredEmail == null || configuredEmail.isBlank()) {
            return;
        }
        try {
            SuperAdminBootstrapService.Result result = bootstrapService.bootstrap(configuredEmail);
            log.info("Super Admin bootstrap finished: {}", result.outcome());
        } catch (RuntimeException ex) {
            log.error("Super Admin bootstrap failed: {}", ex.getClass().getSimpleName());
        }
    }
}
