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
 * Local development demo data, active only under the {@code dev} profile.
 *
 * <p>It creates no login accounts and sets no passwords in any profile (approved decision D4, Phase 2). The
 * accounts it used to create had passwords published in this repository; migration V22 disables any that
 * still use them, and this class never re-enables or recreates them. Developers sign in through the Super
 * Admin bootstrap ({@code PROWISE_BOOTSTRAP_SUPER_ADMIN_EMAIL}) and accounts provisioned through the users API.
 */
@Component
@Profile("dev")
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

    private void ensureUserAccount(UUID id, String email, String name, String rawPassword, String role, String department, UUID orgId) {
        String hash = passwordEncoder.encode(rawPassword);
        java.util.List<String> hashes = jdbc.query(
                "SELECT password_hash FROM users WHERE lower(email) = lower(?)",
                (rs, rowNum) -> rs.getString("password_hash"),
                email
        );
        if (!hashes.isEmpty()) {
            String existingHash = hashes.get(0);
            if (existingHash == null || !existingHash.startsWith("$2") || !passwordEncoder.matches(rawPassword, existingHash)) {
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
