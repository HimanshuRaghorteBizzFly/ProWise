package com.prowise.identity;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.superadmin.organizations.OrganizationEntity;
import com.prowise.superadmin.organizations.OrganizationRepository;

/**
 * Seeds predefined demo users and credentials under the organization owned by Dipak Chavan
 * in development/local environments only (profiles: dev, local).
 *
 * Never runs under production profiles ('prod', 'production').
 * Idempotent: safe to run repeatedly without creating duplicate records.
 * Sets must_change_password to false so demo users log in directly to their dashboards.
 */
@Component
@Profile({"dev", "local"})
public class DemoUserSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoUserSeeder.class);
    private static final Set<String> PRODUCTION_PROFILES = Set.of("prod", "production");

    public static final UUID DEMO_ORG_ID = UUID.fromString("6cea41af-fffd-4160-9e01-59e7d88e144d");
    public static final String DEMO_ORG_NAME = "example";
    public static final String DEMO_ORG_SLUG = "example";
    public static final String DEMO_ORG_TIMEZONE = "Asia/Kolkata";

    public static final String OWNER_EMAIL = "dc741094@gmail.com";
    public static final String OWNER_NAME = "Dipak Chavan";

    public record DemoUserSpec(
            String email,
            String password,
            String name,
            String role,
            String department
    ) {}

    public static final List<DemoUserSpec> DEMO_USERS = List.of(
            new DemoUserSpec(OWNER_EMAIL, "Owner@Pwise2026", OWNER_NAME, "ORGANIZATION_OWNER", "Executive"),
            new DemoUserSpec("orgadmin@pwise.demo", "Admin@Pwise2026", "Organization Admin", "ORGANIZATION_ADMIN", "Administration"),
            new DemoUserSpec("manager@pwise.demo", "Manager@Pwise2026", "Project Manager", "PROJECT_MANAGER", "Project Management"),
            new DemoUserSpec("teamlead@pwise.demo", "TeamLead@Pwise2026", "Team Lead", "TEAM_LEAD", "Engineering"),
            new DemoUserSpec("developer@pwise.demo", "Developer@Pwise2026", "Developer", "DEVELOPER", "Engineering"),
            new DemoUserSpec("qa@pwise.demo", "QA@Pwise2026", "QA Reviewer", "QA_REVIEWER", "Quality Assurance")
    );

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final OrganizationRepository organizationRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbc;
    private final Environment environment;

    @Value("${prowise.demo-users.seed-enabled:true}")
    private boolean seedEnabled = true;

    public DemoUserSeeder(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            OrganizationRepository organizationRepository,
            PasswordEncoder passwordEncoder,
            JdbcTemplate jdbc,
            Environment environment) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.organizationRepository = organizationRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbc = jdbc;
        this.environment = environment;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!seedEnabled) {
            log.info("Demo user seeding is disabled via configuration (prowise.demo-users.seed-enabled=false).");
            return;
        }
        if (isProduction()) {
            log.warn("Demo user seeder refusing execution: production profile detected.");
            return;
        }
        try {
            seed();
        } catch (Exception ex) {
            log.warn("Demo user initialization failed or deferred: {}", ex.getMessage(), ex);
        }
    }

    @Transactional
    public void seed() {
        if (isProduction()) {
            throw new IllegalStateException("Demo user seeding is forbidden in production profiles!");
        }

        UUID orgId = ensureOrganizationExists();
        UUID ownerUserId = seedOwnerUser(orgId);

        for (DemoUserSpec spec : DEMO_USERS) {
            if ("ORGANIZATION_OWNER".equals(spec.role())) {
                continue; // Owner already processed above
            }
            seedDemoUser(orgId, spec, ownerUserId);
        }

        log.info("Successfully seeded demo users for organization '{}' ({})", DEMO_ORG_NAME, orgId);
    }

    public boolean isProduction() {
        return Arrays.stream(environment.getActiveProfiles())
                .map(p -> p.toLowerCase(Locale.ROOT))
                .anyMatch(PRODUCTION_PROFILES::contains);
    }

    private UUID ensureOrganizationExists() {
        Optional<OrganizationEntity> byId = organizationRepository.findById(DEMO_ORG_ID);
        if (byId.isPresent()) {
            OrganizationEntity org = byId.get();
            if (org.getOwnerEmail() == null || org.getOwnerEmail().isBlank()) {
                org.setOwnerEmail(OWNER_EMAIL);
                org.setOwnerName(OWNER_NAME);
                organizationRepository.save(org);
            }
            return org.getId();
        }

        Optional<OrganizationEntity> bySlug = organizationRepository.findBySlug(DEMO_ORG_SLUG);
        if (bySlug.isPresent()) {
            OrganizationEntity org = bySlug.get();
            if (org.getOwnerEmail() == null || org.getOwnerEmail().isBlank()) {
                org.setOwnerEmail(OWNER_EMAIL);
                org.setOwnerName(OWNER_NAME);
                organizationRepository.save(org);
            }
            return org.getId();
        }

        // Create organization if it does not exist
        OrganizationEntity newOrg = new OrganizationEntity(DEMO_ORG_ID, DEMO_ORG_NAME, DEMO_ORG_SLUG, DEMO_ORG_TIMEZONE);
        newOrg.setOwnerEmail(OWNER_EMAIL);
        newOrg.setOwnerName(OWNER_NAME);
        newOrg.setState("ACTIVE");
        organizationRepository.save(newOrg);
        return DEMO_ORG_ID;
    }

    private UUID seedOwnerUser(UUID orgId) {
        DemoUserSpec ownerSpec = DEMO_USERS.get(0);
        Optional<UserEntity> existing = userRepository.findByEmailIgnoreCase(ownerSpec.email());
        UserEntity owner;
        if (existing.isPresent()) {
            owner = existing.get();
            // Preserve existing owner account attributes, ensure organization binding, ACTIVE status, and direct login
            owner.setOrganizationId(orgId);
            owner.setRole("ORGANIZATION_OWNER");
            owner.setStatus("ACTIVE");
            owner.setMustChangePassword(false);
            if (owner.getName() == null || owner.getName().isBlank()) {
                owner.setName(ownerSpec.name());
            }
            if (!passwordEncoder.matches(ownerSpec.password(), owner.getPasswordHash())) {
                owner.setPasswordHash(passwordEncoder.encode(ownerSpec.password()));
            }
            owner = userRepository.save(owner);
        } else {
            owner = new UserEntity();
            owner.setId(UUID.randomUUID());
            owner.setEmail(ownerSpec.email().trim().toLowerCase(Locale.ROOT));
            owner.setName(ownerSpec.name());
            owner.setRole("ORGANIZATION_OWNER");
            owner.setDepartment(ownerSpec.department());
            owner.setOrganizationId(orgId);
            owner.setStatus("ACTIVE");
            owner.setMustChangePassword(false);
            owner.setPasswordHash(passwordEncoder.encode(ownerSpec.password()));
            owner = userRepository.save(owner);
        }

        UUID ownerUserId = owner.getId();

        // 1. user_roles
        ensureUserRole(ownerUserId, "ORGANIZATION_OWNER");

        // 2. membership
        UUID membershipId = ensureMembership(orgId, ownerUserId, "ORGANIZATION_OWNER");

        // 3. grant
        UUID templateRoleId = findTemplateRoleId("ORGANIZATION_OWNER");
        ensureGrant(orgId, membershipId, templateRoleId, ownerUserId);

        return ownerUserId;
    }

    private void seedDemoUser(UUID orgId, DemoUserSpec spec, UUID ownerUserId) {
        Optional<UserEntity> existing = userRepository.findByEmailIgnoreCase(spec.email());
        UserEntity user;
        if (existing.isPresent()) {
            user = existing.get();
            user.setName(spec.name());
            user.setRole(spec.role());
            user.setDepartment(spec.department());
            user.setOrganizationId(orgId);
            user.setStatus("ACTIVE");
            user.setMustChangePassword(false); // Enable direct login without password change prompt
            if (!passwordEncoder.matches(spec.password(), user.getPasswordHash())) {
                user.setPasswordHash(passwordEncoder.encode(spec.password()));
            }
            user = userRepository.save(user);
        } else {
            user = new UserEntity();
            user.setId(UUID.randomUUID());
            user.setEmail(spec.email().trim().toLowerCase(Locale.ROOT));
            user.setName(spec.name());
            user.setRole(spec.role());
            user.setDepartment(spec.department());
            user.setOrganizationId(orgId);
            user.setStatus("ACTIVE");
            user.setMustChangePassword(false); // Enable direct login without password change prompt
            user.setPasswordHash(passwordEncoder.encode(spec.password()));
            user = userRepository.save(user);
        }

        UUID userId = user.getId();

        // 1. user_roles
        ensureUserRole(userId, spec.role());

        // 2. membership
        UUID membershipId = ensureMembership(orgId, userId, spec.role());

        // 3. grant
        UUID templateRoleId = findTemplateRoleId(spec.role());
        ensureGrant(orgId, membershipId, templateRoleId, ownerUserId);
    }

    private void ensureUserRole(UUID userId, String roleName) {
        List<UserRoleEntity> roles = userRoleRepository.findByUserId(userId);
        boolean exists = roles.stream().anyMatch(r -> roleName.equalsIgnoreCase(r.getRoleName()));
        if (!exists) {
            userRoleRepository.save(new UserRoleEntity(userId, roleName));
        }
    }

    private UUID ensureMembership(UUID orgId, UUID userId, String roleTemplate) {
        List<UUID> existingIds = jdbc.query(
                "SELECT id FROM memberships WHERE org_id = ? AND user_id = ?",
                (rs, rowNum) -> rs.getObject("id", UUID.class),
                orgId, userId
        );
        if (!existingIds.isEmpty()) {
            UUID membershipId = existingIds.get(0);
            jdbc.update(
                    "UPDATE memberships SET role_template = ?, status = 'ACTIVE', updated_at = now() WHERE id = ?",
                    roleTemplate, membershipId
            );
            return membershipId;
        }

        UUID newId = UUID.randomUUID();
        jdbc.update(
                "INSERT INTO memberships (id, org_id, user_id, role_template, status) VALUES (?, ?, ?, ?, 'ACTIVE')",
                newId, orgId, userId, roleTemplate
        );
        return newId;
    }

    private UUID findTemplateRoleId(String roleName) {
        return jdbc.queryForObject(
                "SELECT id FROM roles WHERE name = ? AND is_template = true",
                UUID.class,
                roleName
        );
    }

    private void ensureGrant(UUID orgId, UUID membershipId, UUID templateRoleId, UUID grantedBy) {
        UUID ownerTemplateId = UUID.fromString("10000000-0000-0000-0000-000000000001");
        if (ownerTemplateId.equals(templateRoleId)) {
            List<UUID> existingOwnerGrants = jdbc.query(
                    "SELECT id FROM grants WHERE org_id = ? AND template_role_id = ?",
                    (rs, rowNum) -> rs.getObject("id", UUID.class),
                    orgId, templateRoleId
            );
            if (!existingOwnerGrants.isEmpty()) {
                jdbc.update(
                        "UPDATE grants SET membership_id = ?, granted_by = ?, updated_at = now() WHERE id = ?",
                        membershipId, grantedBy, existingOwnerGrants.get(0)
                );
                return;
            }
        }

        Integer count = jdbc.queryForObject(
                "SELECT count(*) FROM grants WHERE org_id = ? AND membership_id = ? AND template_role_id = ? AND scope = 'ORG'",
                Integer.class,
                orgId, membershipId, templateRoleId
        );
        if (count == null || count == 0) {
            jdbc.update(
                    "INSERT INTO grants (id, org_id, membership_id, template_role_id, scope, granted_by) VALUES (?, ?, ?, ?, 'ORG', ?)",
                    UUID.randomUUID(), orgId, membershipId, templateRoleId, grantedBy
            );
        }
    }
}
