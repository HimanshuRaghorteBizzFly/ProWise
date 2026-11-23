package com.prowise.identity;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
<<<<<<< HEAD
 * Initializes development login accounts for Super Admin, Platform Operator, and Developer
 * in the local {@code dev} profile only (SPRING_PROFILES_ACTIVE=dev). It replaces the former Flyway
 * migration V12__seed_development_logins (now database/seeds/legacy), so test and production databases never
 * get known-password accounts and an empty database never depends on seed data.
=======
 * Local development demo data, active only under the {@code dev} profile.
>>>>>>> b46fd9c (Update ProWise application)
 *
 * <p>It creates no login accounts and sets no passwords in any profile (approved decision D4, Phase 2). The
 * accounts it used to create had passwords published in this repository; migration V18 disables any that
 * still use them, and this class never re-enables or recreates them. Developers sign in through the Super
 * Admin bootstrap ({@code PROWISE_BOOTSTRAP_SUPER_ADMIN_EMAIL}) and accounts provisioned through the users API.
 */
@Component
<<<<<<< HEAD
@org.springframework.context.annotation.Profile("dev")
=======
@Profile("dev")
>>>>>>> b46fd9c (Update ProWise application)
public class DevelopmentDataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevelopmentDataInitializer.class);

    public static final UUID DEFAULT_ORG_ID = UUID.fromString("0a000000-0000-4000-8000-00000000000a");
    public static final String DEFAULT_ORG_SLUG = "acme";
    public static final String DEFAULT_ORG_NAME = "Acme Health Tech";

    private final JdbcTemplate jdbc;

    public DevelopmentDataInitializer(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        try {
            jdbc.update("""
                    INSERT INTO organizations (id, name, slug, timezone, state, work_calendar)
                    VALUES (?, ?, ?, 'America/New_York', 'ACTIVE', '{}'::jsonb)
                    ON CONFLICT (slug) DO NOTHING
                    """, DEFAULT_ORG_ID, DEFAULT_ORG_NAME, DEFAULT_ORG_SLUG);
            jdbc.update("UPDATE projects SET org_id = ? WHERE org_id IS NULL", DEFAULT_ORG_ID);
            log.info("Development demo organization verified. No login accounts are created.");
        } catch (Exception ex) {
            log.warn("Development demo data skipped: {}", ex.getClass().getSimpleName());
        }
    }
}
