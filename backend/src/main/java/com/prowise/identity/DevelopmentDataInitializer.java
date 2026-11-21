package com.prowise.identity;

import java.util.Arrays;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Initializes development login accounts for Super Admin, Platform Operator, and Developer
 * in the local {@code dev} profile only (SPRING_PROFILES_ACTIVE=dev). It replaces the former Flyway
 * migration V12__seed_development_logins (now database/seeds/legacy), so test and production databases never
 * get known-password accounts and an empty database never depends on seed data.
 *
 * Refuses to run under 'prod' or 'production' profiles.
 * Never overwrites existing accounts.
 */
@Component
@org.springframework.context.annotation.Profile("dev")
public class DevelopmentDataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevelopmentDataInitializer.class);
    private static final Set<String> PRODUCTION_PROFILES = Set.of("prod", "production");

    public static final UUID DEFAULT_ORG_ID = UUID.fromString("0a000000-0000-4000-8000-00000000000a");
    public static final String DEFAULT_ORG_SLUG = "acme";
    public static final String DEFAULT_ORG_NAME = "Acme Health Tech";

    // Development Login Emails
    public static final String SUPER_ADMIN_EMAIL = "superadmin@prowise.com";
    public static final String SUPER_ADMIN_ALIAS = "superadmin@prowise.io";
    public static final String PLATFORM_OPERATOR_EMAIL = "operator@prowise.io";
    public static final String MAIN_OPERATOR_EMAIL = "main.operator@prowise.io";
    public static final String DEVELOPER_EMAIL = "alex.rivera@acmehealth.com";
    public static final String DEVELOPER_ALIAS = "developer@prowise.com";

    // Known Development Passwords
    public static final String DEFAULT_SUPER_ADMIN_PASSWORD = "SuperAdmin2026!";
    public static final String DEFAULT_OPERATOR_PASSWORD = "Operator2026!";
    public static final String DEFAULT_DEVELOPER_PASSWORD = "Developer2026!";

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final Environment environment;

    public DevelopmentDataInitializer(JdbcTemplate jdbc, PasswordEncoder passwordEncoder, Environment environment) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
        this.environment = environment;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (isProduction()) {
            return;
        }

        try {
            ensureOrganizationExists();
            ensureSuperAdminExists();
            ensurePlatformOperatorExists();
            ensureDeveloperExists();
            ensureProjectAssociations();
            log.info("Development login credentials verified: Super Admin, Platform Operator, Developer accounts active.");
        } catch (Exception ex) {
            log.warn("Development login initialization skipped or deferred: {}", ex.getMessage());
        }
    }

    private boolean isProduction() {
        return Arrays.stream(environment.getActiveProfiles())
                .map(p -> p.toLowerCase(Locale.ROOT))
                .anyMatch(PRODUCTION_PROFILES::contains);
    }

    private void ensureOrganizationExists() {
        jdbc.update("""
                INSERT INTO organizations (id, name, slug, timezone, state, work_calendar)
                VALUES (?, ?, ?, 'America/New_York', 'ACTIVE', '{}'::jsonb)
                ON CONFLICT (slug) DO NOTHING
                """, DEFAULT_ORG_ID, DEFAULT_ORG_NAME, DEFAULT_ORG_SLUG);
    }

    private void ensureSuperAdminExists() {
        ensureUserAccount(
                UUID.fromString("00000000-0000-0000-0000-000000000001"),
                SUPER_ADMIN_EMAIL,
                "Super Admin",
                DEFAULT_SUPER_ADMIN_PASSWORD,
                "SUPER_ADMIN",
                null,
                null
        );
        ensureUserAccount(
                UUID.fromString("00000000-0000-0000-0000-000000000010"),
                SUPER_ADMIN_ALIAS,
                "Arthur Pendelton",
                DEFAULT_SUPER_ADMIN_PASSWORD,
                "SUPER_ADMIN",
                null,
                null
        );
    }

    private void ensurePlatformOperatorExists() {
        ensureUserAccount(
                UUID.fromString("00000000-0000-0000-0000-000000000002"),
                PLATFORM_OPERATOR_EMAIL,
                "Jordan Mercer",
                DEFAULT_OPERATOR_PASSWORD,
                "PLATFORM_OPERATOR",
                "site-reliability",
                null
        );
        ensureUserAccount(
                UUID.fromString("00000000-0000-0000-0000-000000000020"),
                MAIN_OPERATOR_EMAIL,
                "Platform Director",
                DEFAULT_OPERATOR_PASSWORD,
                "PLATFORM_OPERATOR",
                null,
                null
        );

        // Synchronize operator password hash in platform_operators table
        String operatorHash = passwordEncoder.encode(DEFAULT_OPERATOR_PASSWORD);
        jdbc.update("UPDATE platform_operators SET password_hash = ? WHERE email IN (?, ?)",
                operatorHash, PLATFORM_OPERATOR_EMAIL, MAIN_OPERATOR_EMAIL);
    }

    private void ensureDeveloperExists() {
        UUID devUserId = UUID.fromString("00000000-0000-0000-0000-000000000003");
        ensureUserAccount(
                devUserId,
                DEVELOPER_EMAIL,
                "Alex Rivera",
                DEFAULT_DEVELOPER_PASSWORD,
                "DEVELOPER",
                null,
                DEFAULT_ORG_ID
        );
        ensureUserAccount(
                UUID.fromString("00000000-0000-0000-0000-000000000030"),
                DEVELOPER_ALIAS,
                "Alex Rivera",
                DEFAULT_DEVELOPER_PASSWORD,
                "DEVELOPER",
                null,
                DEFAULT_ORG_ID
        );

        // Membership in Acme organization
        jdbc.update("""
                INSERT INTO memberships (id, org_id, user_id, role_template, status)
                VALUES (gen_random_uuid(), ?, ?, 'DEVELOPER', 'ACTIVE')
                ON CONFLICT (org_id, user_id) DO NOTHING
                """, DEFAULT_ORG_ID, devUserId);
    }

    private void ensureUserAccount(UUID id, String email, String name, String rawPassword, String role, String department, UUID orgId) {
        String hash = passwordEncoder.encode(rawPassword);
        java.util.List<String> hashes = jdbc.query(
                "SELECT password_hash FROM users WHERE lower(email) = lower(?)",
                (rs, rowNum) -> rs.getString("password_hash"),
                email
        );
        if (!hashes.isEmpty()) {
            String existingHash = hashes.get(0);
            if (existingHash == null || !existingHash.startsWith("$2")) {
                jdbc.update("UPDATE users SET password_hash = ? WHERE lower(email) = lower(?)", hash, email);
            }
            return;
        }

        jdbc.update("""
                INSERT INTO users (id, email, password_hash, name, role, department, organization_id, status, must_change_password)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', false)
                ON CONFLICT (lower(email)) DO NOTHING
                """, id, email, hash, name, role, department, orgId);

        jdbc.update("""
                INSERT INTO user_roles (user_id, role_name)
                SELECT id, ? FROM users WHERE lower(email) = lower(?)
                ON CONFLICT (user_id, role_name) DO NOTHING
                """, role, email);
    }

    private void ensureProjectAssociations() {
        jdbc.update("UPDATE projects SET org_id = ? WHERE org_id IS NULL", DEFAULT_ORG_ID);
    }
}
