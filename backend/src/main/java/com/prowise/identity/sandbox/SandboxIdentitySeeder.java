package com.prowise.identity.sandbox;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Loads the sandbox identities (Org A and Org B, five fake users each). Enabled with
 * {@code prowise.sandbox.seed-enabled=true} (on in the dev profile). Refuses to run under a
 * production profile. Database inserts are wired in task 1.1 once the identity tables exist.
 */
@Component
public class SandboxIdentitySeeder implements ApplicationRunner {

    public static final String SEED_RESOURCE = "/seed/sandbox-identities.json";
    static final Set<String> PRODUCTION_PROFILES = Set.of("prod", "production");

    private static final Logger log = LoggerFactory.getLogger(SandboxIdentitySeeder.class);

    private final Environment environment;
    private final ObjectMapper objectMapper;

    public SandboxIdentitySeeder(Environment environment, ObjectMapper objectMapper) {
        this.environment = environment;
        this.objectMapper = objectMapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!environment.getProperty("prowise.sandbox.seed-enabled", Boolean.class, false)) {
            return;
        }
        SandboxDataset dataset = seed();
        long users = dataset.organizations().stream().mapToLong(org -> org.users().size()).sum();
        log.info("Sandbox identities loaded: {} organisations, {} users (database insert arrives in task 1.1)",
                dataset.organizations().size(), users);
    }

    public SandboxDataset seed() {
        refuseInProduction();
        SandboxDataset dataset = load();
        validate(dataset);
        return dataset;
    }

    private void refuseInProduction() {
        boolean production = Arrays.stream(environment.getActiveProfiles())
                .map(profile -> profile.toLowerCase(Locale.ROOT))
                .anyMatch(PRODUCTION_PROFILES::contains);
        if (production) {
            throw new IllegalStateException(
                    "Sandbox seed refused: a production profile is active. Fake identities never run in production.");
        }
    }

    private SandboxDataset load() {
        try (InputStream in = SandboxIdentitySeeder.class.getResourceAsStream(SEED_RESOURCE)) {
            if (in == null) {
                throw new IllegalStateException("Sandbox seed file missing: " + SEED_RESOURCE);
            }
            return objectMapper.readValue(in, SandboxDataset.class);
        } catch (IOException exception) {
            throw new UncheckedIOException("Sandbox seed file is invalid", exception);
        }
    }

    private static void validate(SandboxDataset dataset) {
        Set<Object> ids = new HashSet<>();
        for (SandboxDataset.Organization org : dataset.organizations()) {
            require(ids.add(org.id()), "duplicate organisation id");
            for (SandboxDataset.User user : org.users()) {
                require(ids.add(user.id()), "duplicate user id");
                require(user.email().endsWith("@" + org.slug() + ".test"), "sandbox emails must use the .test domain");
            }
        }
    }

    private static void require(boolean condition, String message) {
        if (!condition) {
            throw new IllegalStateException("Sandbox seed invalid: " + message);
        }
    }
}
