package com.prowise.superadmin.roles;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.regex.Pattern;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.authz.PermissionKey;
import com.prowise.common.api.ApiError;
import com.prowise.common.api.ApiException;
import com.prowise.common.persistence.ExpectedVersion;
import com.prowise.superadmin.audit.AuditService;
import com.prowise.superadmin.common.AdminRequests;

/**
 * Roles &amp; Permissions Governance, persisted in platform_role_definitions (V36) over the real authorization model.
 *
 * <p>What editing changes (rule 12: a role name grants nothing by itself):
 * <ul>
 *   <li>Organization roles (system templates and organization-scope custom roles) are global role templates. Their
 *       capabilities are the template's role_permissions rows, which PermissionService reads through each tenant's
 *       org-scoped grants. Editing them changes what every holder in every organization can do, immediately.
 *       Tenant admins can grant a custom template only when they hold all of its keys (RoleService least privilege).</li>
 *   <li>Super Admin is enforced in code (PLATFORM_SUPER_ADMIN authority). Locked: never edited, deactivated, deleted,
 *       cloned or used as a base; no role can receive a platform-root capability.</li>
 *   <li>Platform Operator is derived live from operator department permissions (edited under Operators).</li>
 *   <li>Platform-scope custom roles are definitions only (operator capability keys); they are not assignable.</li>
 * </ul>
 * Every mutation: Super Admin only, expected_version (409 STALE_VERSION), version-guarded UPDATE, and an
 * admin_audit_logs row in the same transaction (platform changes have no org_id, so no tenant audit/outbox row).
 */
@Service
public class SuperAdminRoleService {

    static final String KIND_SUPER_ADMIN = "SUPER_ADMIN";
    static final String KIND_PLATFORM_OPERATOR = "PLATFORM_OPERATOR";
    static final String KIND_TEMPLATE = "ORGANIZATION_TEMPLATE";
    static final String KIND_CUSTOM = "CUSTOM";

    static final String ENFORCEMENT_TEMPLATE = "ORGANIZATION_TEMPLATE";
    static final String ENFORCEMENT_PLATFORM = "PLATFORM_AUTHORITY";
    static final String ENFORCEMENT_OPERATOR = "OPERATOR_DEPARTMENTS";
    static final String ENFORCEMENT_DEFINITION = "DEFINITION_ONLY";

    private static final String AUDIT_CATEGORY = "ROLE";
    private static final String ACTOR_NAME = "Super Admin";
    private static final int CUSTOM_TIER = 6;
    private static final Pattern SLUG = Pattern.compile("^[a-z0-9]+(-[a-z0-9]+)*$");
    private static final Pattern ICON = Pattern.compile("^[A-Za-z0-9]{1,40}$");
    private static final Set<String> COLORS = Set.of("amber", "blue", "violet", "indigo", "emerald", "teal", "sky",
            "rose", "slate", "orange", "cyan", "fuchsia", "lime", "pink");

    static final Map<Integer, String> TIER_NAMES = Map.of(
            1, "Platform Governance",
            2, "Tenant Administration",
            3, "Delivery Leadership",
            4, "Engineering & Quality Verification",
            5, "Stakeholder & Read-Only Governance",
            6, "Custom Roles");

    private final JdbcTemplate jdbc;
    private final RoleCapabilityCatalog catalog;
    private final AuditService audit;

    public SuperAdminRoleService(JdbcTemplate jdbc, RoleCapabilityCatalog catalog, AuditService audit) {
        this.jdbc = jdbc;
        this.catalog = catalog;
        this.audit = audit;
    }

    /* ------------------------------------------------------------------ reads */

    @Transactional(readOnly = true)
    public List<SuperAdminRoleDTOs.AdminRoleResponse> listRoles() {
        List<RoleCapabilityCatalog.Capability> all = catalog.all();
        Set<String> allKeys = catalog.keysOf(all);
        Set<String> operatorKeys = catalog.platformOperatorKeys();

        List<Definition> defs = jdbc.query("""
                SELECT d.*, r.name AS template_name
                FROM platform_role_definitions d LEFT JOIN roles r ON r.id = d.template_role_id
                """, (rs, rowNum) -> definition(rs));
        defs.sort(Comparator.comparingInt(Definition::tier)
                .thenComparing(d -> d.rank() == null ? Integer.MAX_VALUE : d.rank())
                .thenComparing(Definition::createdAt)
                .thenComparing(d -> d.id().toString()));

        Map<UUID, Set<String>> templatePerms = new HashMap<>();
        jdbc.query("""
                SELECT rp.role_id, rp.permission_key FROM role_permissions rp
                JOIN platform_role_definitions d ON d.template_role_id = rp.role_id
                """, rs -> {
            templatePerms.computeIfAbsent(rs.getObject("role_id", UUID.class), k -> new TreeSet<>())
                    .add(rs.getString("permission_key"));
        });
        Map<UUID, Set<String>> platformPerms = new HashMap<>();
        jdbc.query("SELECT role_definition_id, capability_key FROM platform_role_permissions", rs -> {
            platformPerms.computeIfAbsent(rs.getObject("role_definition_id", UUID.class), k -> new TreeSet<>())
                    .add(rs.getString("capability_key"));
        });
        Map<UUID, long[]> holderCounts = new HashMap<>();
        jdbc.query("""
                SELECT g.template_role_id, count(DISTINCT g.membership_id) AS users, count(DISTINCT g.org_id) AS orgs
                FROM grants g
                JOIN memberships m ON m.id = g.membership_id AND m.org_id = g.org_id
                WHERE g.template_role_id IS NOT NULL AND m.status = 'ACTIVE'
                  AND (g.expires_at IS NULL OR g.expires_at > now())
                GROUP BY g.template_role_id
                """, rs -> {
            holderCounts.put(rs.getObject("template_role_id", UUID.class),
                    new long[] {rs.getLong("users"), rs.getLong("orgs")});
        });
        long superAdmins = count("SELECT count(*) FROM users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE'");
        long operators = count("SELECT count(*) FROM platform_operators WHERE status = 'ACTIVE'");

        int maxSystemRank = defs.stream().filter(d -> d.rank() != null).mapToInt(Definition::rank).max().orElse(0);
        Map<Integer, Integer> customSeq = new HashMap<>();
        List<SuperAdminRoleDTOs.AdminRoleResponse> out = new ArrayList<>();
        for (Definition d : defs) {
            String rankLabel;
            if (d.rank() != null) {
                rankLabel = "#" + d.rank();
            } else {
                int n = customSeq.merge(d.tier(), 1, Integer::sum);
                if (d.tier() == CUSTOM_TIER) {
                    long earlier = defs.stream().filter(x -> x.tier() == CUSTOM_TIER && x.rank() == null).takeWhile(x -> x != d).count();
                    rankLabel = "#" + (maxSystemRank + earlier + 1);
                } else {
                    int base = defs.stream().filter(x -> x.tier() == d.tier() && x.rank() != null)
                            .mapToInt(Definition::rank).max().orElse(maxSystemRank);
                    rankLabel = "#" + base + "." + n;
                }
            }
            Set<String> perms;
            long users;
            long orgs = 0;
            switch (d.kind()) {
                case KIND_SUPER_ADMIN -> {
                    perms = allKeys;
                    users = superAdmins;
                }
                case KIND_PLATFORM_OPERATOR -> {
                    perms = platformPerms.getOrDefault(d.id(), operatorKeys);
                    users = operators;
                }
                default -> {
                    if (d.templateRoleId() != null) {
                        perms = templatePerms.getOrDefault(d.templateRoleId(), Set.of());
                        long[] counts = holderCounts.getOrDefault(d.templateRoleId(), new long[] {0, 0});
                        users = counts[0];
                        orgs = counts[1];
                    } else {
                        perms = platformPerms.getOrDefault(d.id(), Set.of());
                        users = 0;
                    }
                }
            }
            out.add(response(d, rankLabel, perms, all.size(), users, orgs, operatorKeys));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public SuperAdminRoleDTOs.AdminRoleResponse getRole(String id) {
        UUID roleId = parseId(id);
        return listRoles().stream().filter(r -> r.id().equals(roleId)).findFirst()
                .orElseThrow(ApiException::notFound);
    }

    @Transactional(readOnly = true)
    public SuperAdminRoleDTOs.PermissionCatalogResponse getPermissionsCatalog() {
        Map<String, List<RoleCapabilityCatalog.Capability>> byModule = new LinkedHashMap<>();
        List<RoleCapabilityCatalog.Capability> all = catalog.all();
        for (RoleCapabilityCatalog.Capability c : all) {
            byModule.computeIfAbsent(c.moduleId(), k -> new ArrayList<>()).add(c);
        }
        List<SuperAdminRoleDTOs.CapabilityModuleResponse> modules = new ArrayList<>();
        for (List<RoleCapabilityCatalog.Capability> caps : byModule.values()) {
            RoleCapabilityCatalog.Capability first = caps.get(0);
            modules.add(new SuperAdminRoleDTOs.CapabilityModuleResponse(first.moduleId(), first.moduleName(),
                    first.group(), first.scope(), caps.stream().map(c -> new SuperAdminRoleDTOs.CapabilityResponse(
                            c.key(), c.action(), c.label(), c.description(), c.risk(), c.scope(), c.superAdminOnly()))
                            .toList()));
        }
        return new SuperAdminRoleDTOs.PermissionCatalogResponse(all.size(), modules.size(), modules);
    }

    /** Real holders only: active Super Admin users, active operators, or active members with an unexpired grant. */
    @Transactional(readOnly = true)
    public List<SuperAdminRoleDTOs.RoleHolderResponse> holders(String id) {
        Definition d = find(parseId(id));
        return switch (d.kind()) {
            case KIND_SUPER_ADMIN -> jdbc.query("""
                    SELECT id, name, email FROM users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE'
                    ORDER BY lower(email) LIMIT 200
                    """, (rs, n) -> new SuperAdminRoleDTOs.RoleHolderResponse(rs.getString("id"), rs.getString("name"),
                    rs.getString("email"), null, "Platform Super Admin"));
            case KIND_PLATFORM_OPERATOR -> jdbc.query("""
                    SELECT o.id, o.name, o.email, d.name AS department
                    FROM platform_operators o LEFT JOIN operator_departments d ON d.id = o.department_id
                    WHERE o.status = 'ACTIVE' ORDER BY lower(o.email) LIMIT 200
                    """, (rs, n) -> new SuperAdminRoleDTOs.RoleHolderResponse(rs.getString("id"), rs.getString("name"),
                    rs.getString("email"), null, rs.getString("department")));
            default -> d.templateRoleId() == null ? List.of() : jdbc.query("""
                    SELECT DISTINCT ON (m.id) m.id, u.name, u.email, o.name AS org_name, g.scope
                    FROM grants g
                    JOIN memberships m ON m.id = g.membership_id AND m.org_id = g.org_id
                    JOIN users u ON u.id = m.user_id
                    JOIN organizations o ON o.id = g.org_id
                    WHERE g.template_role_id = ? AND m.status = 'ACTIVE'
                      AND (g.expires_at IS NULL OR g.expires_at > now())
                    ORDER BY m.id, g.scope LIMIT 200
                    """, (rs, n) -> new SuperAdminRoleDTOs.RoleHolderResponse(rs.getString("id"), rs.getString("name"),
                    rs.getString("email"), rs.getString("org_name"),
                    "ORG".equals(rs.getString("scope")) ? "Organization-wide" : "Project-scoped"), d.templateRoleId());
        };
    }

    /** Roles held by people whose name or email contains {@code q} (search box "users"). */
    @Transactional(readOnly = true)
    public List<SuperAdminRoleDTOs.HolderMatchResponse> holderSearch(String q) {
        String term = q == null ? "" : q.trim().toLowerCase(Locale.ROOT);
        if (term.length() < 2) return List.of();
        String like = "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        List<SuperAdminRoleDTOs.HolderMatchResponse> out = new ArrayList<>();
        out.addAll(jdbc.query("""
                SELECT name, email FROM users WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE'
                  AND (lower(email) LIKE ? OR lower(coalesce(name, '')) LIKE ?) LIMIT 50
                """, (rs, n) -> new SuperAdminRoleDTOs.HolderMatchResponse(SystemRoleBaseline.SUPER_ADMIN_DEFINITION_ID,
                rs.getString("name"), rs.getString("email"), null), like, like));
        out.addAll(jdbc.query("""
                SELECT name, email FROM platform_operators WHERE status = 'ACTIVE'
                  AND (lower(email) LIKE ? OR lower(name) LIKE ?) LIMIT 50
                """, (rs, n) -> new SuperAdminRoleDTOs.HolderMatchResponse(
                SystemRoleBaseline.PLATFORM_OPERATOR_DEFINITION_ID, rs.getString("name"), rs.getString("email"), null),
                like, like));
        out.addAll(jdbc.query("""
                SELECT DISTINCT d.id AS role_id, u.name, u.email, o.name AS org_name
                FROM grants g
                JOIN platform_role_definitions d ON d.template_role_id = g.template_role_id
                JOIN memberships m ON m.id = g.membership_id AND m.org_id = g.org_id
                JOIN users u ON u.id = m.user_id
                JOIN organizations o ON o.id = g.org_id
                WHERE m.status = 'ACTIVE' AND (g.expires_at IS NULL OR g.expires_at > now())
                  AND (lower(u.email) LIKE ? OR lower(coalesce(u.name, '')) LIKE ?)
                LIMIT 200
                """, (rs, n) -> new SuperAdminRoleDTOs.HolderMatchResponse(rs.getObject("role_id", UUID.class),
                rs.getString("name"), rs.getString("email"), rs.getString("org_name")), like, like));
        return out;
    }

    @Transactional(readOnly = true)
    public List<SuperAdminRoleDTOs.RoleHistoryEntry> history(String id) {
        Definition d = find(parseId(id));
        return jdbc.query("""
                SELECT id, action, summary, actor_email, target_label, severity, timestamp FROM admin_audit_logs
                WHERE category = ? AND target_label = ? ORDER BY timestamp DESC LIMIT 500
                """, (rs, n) -> historyEntry(rs), AUDIT_CATEGORY, d.slug());
    }

    /** Every role and permission change (page "Audit Log"). */
    @Transactional(readOnly = true)
    public List<SuperAdminRoleDTOs.RoleHistoryEntry> auditLog() {
        return jdbc.query("""
                SELECT id, action, summary, actor_email, target_label, severity, timestamp FROM admin_audit_logs
                WHERE category = ? ORDER BY timestamp DESC LIMIT 1000
                """, (rs, n) -> historyEntry(rs), AUDIT_CATEGORY);
    }

    @Transactional(readOnly = true)
    public SuperAdminRoleDTOs.CompareResponse compare(List<String> ids) {
        List<UUID> wanted = new ArrayList<>(new LinkedHashSet<>(ids == null ? List.<UUID>of()
                : ids.stream().flatMap(s -> java.util.Arrays.stream(s.split(","))).map(String::trim)
                        .filter(s -> !s.isEmpty()).map(SuperAdminRoleService::parseId).toList()));
        if (wanted.size() < 2 || wanted.size() > 3) {
            throw invalid("ids", "Pick two or three roles to compare.");
        }
        Map<UUID, SuperAdminRoleDTOs.AdminRoleResponse> byId = new HashMap<>();
        for (SuperAdminRoleDTOs.AdminRoleResponse r : listRoles()) byId.put(r.id(), r);
        List<SuperAdminRoleDTOs.AdminRoleResponse> roles = new ArrayList<>();
        for (UUID id : wanted) {
            SuperAdminRoleDTOs.AdminRoleResponse r = byId.get(id);
            if (r == null) throw ApiException.notFound();
            roles.add(r);
        }
        List<SuperAdminRoleDTOs.CompareRow> rows = new ArrayList<>();
        for (RoleCapabilityCatalog.Capability c : catalog.all()) {
            List<Boolean> held = roles.stream().map(r -> r.permissions().contains(c.key())).toList();
            if (!held.contains(Boolean.TRUE)) continue;
            rows.add(new SuperAdminRoleDTOs.CompareRow(c.key(), c.label(), c.moduleName(), held, held.contains(Boolean.FALSE)));
        }
        return new SuperAdminRoleDTOs.CompareResponse(roles, rows);
    }

    /* ------------------------------------------------------------------ mutations */

    @Transactional
    public SuperAdminRoleDTOs.AdminRoleResponse createRole(SuperAdminRoleDTOs.CreateRoleRequest req, String actor) {
        String name = validName(req.name());
        String slug = validSlug(req.slug() == null || req.slug().isBlank() ? slugify(req.name()) : req.slug());
        String scope = validScope(req.scope());
        int tier = validTier(req.tier() == null ? CUSTOM_TIER : req.tier(), scope);
        Set<String> keys;
        String basedOn = null;
        if (req.permissions() != null && !req.permissions().isEmpty()) {
            keys = new TreeSet<>(req.permissions());
        } else if (req.baseRoleId() != null) {
            Definition base = find(req.baseRoleId());
            if (KIND_SUPER_ADMIN.equals(base.kind())) throw superAdminProtected();
            if (!base.scope().equals(scope)) {
                throw invalid("base_role_id", "Base the role on a role with the same scope.");
            }
            keys = new TreeSet<>(permissionsOf(base));
            basedOn = base.name();
        } else {
            throw invalid("permissions", "Choose at least one capability or a role to base it on.");
        }
        validateKeys(scope, keys);
        UUID id = insertCustom(slug, name, trimOrNull(req.subtitle(), 120, "subtitle"),
                trimOrNull(req.description(), 1000, "description"), scope, tier, validColor(req.color()),
                validIcon(req.icon()), keys, actor);
        audit.logActivity(AUDIT_CATEGORY, "ROLE_CREATED",
                "Created custom role " + name + " (" + slug + ", " + scope.toLowerCase(Locale.ROOT) + " scope, tier "
                        + tier + ") with " + keys.size() + " capabilities"
                        + (basedOn == null ? "" : " copied from " + basedOn) + ": " + String.join(", ", keys),
                ACTOR_NAME, actor, slug, "INFO");
        return getRole(id.toString());
    }

    @Transactional
    public SuperAdminRoleDTOs.AdminRoleResponse cloneRole(String id, SuperAdminRoleDTOs.CloneRoleRequest req, String actor) {
        Definition source = find(parseId(id));
        if (KIND_SUPER_ADMIN.equals(source.kind())) throw superAdminProtected();
        String name = validName(req.newName());
        String slug = validSlug(req.newSlug() == null || req.newSlug().isBlank() ? slugify(req.newName()) : req.newSlug());
        int tier = validTier(req.tier() == null ? source.tier() : req.tier(), source.scope());
        Set<String> keys = new TreeSet<>(permissionsOf(source));
        validateKeys(source.scope(), keys);
        String description = req.description() == null || req.description().isBlank()
                ? "Copy of " + source.name() : trimOrNull(req.description(), 1000, "description");
        UUID newId = insertCustom(slug, name, source.subtitle(), description, source.scope(), tier, source.color(),
                source.icon(), keys, actor);
        audit.logActivity(AUDIT_CATEGORY, "ROLE_CLONED",
                "Cloned " + source.name() + " into custom role " + name + " (" + slug + ") with " + keys.size()
                        + " capabilities", ACTOR_NAME, actor, slug, "INFO");
        return getRole(newId.toString());
    }

    @Transactional
    public SuperAdminRoleDTOs.AdminRoleResponse updateRole(String id, SuperAdminRoleDTOs.UpdateRoleRequest req, String actor) {
        Definition d = find(parseId(id));
        if (d.isSystem() && req.tier() != null && req.tier() != d.tier()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "SYSTEM_ROLE_PROTECTED",
                    "System roles keep their slug, tier and rank; name, description, color and icon can change.");
        }
        long expected = ExpectedVersion.required(req.expectedVersion());
        ExpectedVersion.check(d.version(), expected);
        String name = req.name() == null ? d.name() : validName(req.name());
        String subtitle = req.subtitle() == null ? d.subtitle() : trimOrNull(req.subtitle(), 120, "subtitle");
        String description = req.description() == null ? d.description() : trimOrNull(req.description(), 1000, "description");
        int tier = req.tier() == null ? d.tier() : validTier(req.tier(), d.scope());
        String color = req.color() == null ? d.color() : validColor(req.color());
        String icon = req.icon() == null ? d.icon() : validIcon(req.icon());
        if (!name.equalsIgnoreCase(d.name())) requireUniqueName(name);
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE platform_role_definitions
                SET name = ?, subtitle = ?, description = ?, tier = ?, color = ?, icon = ?,
                    version = version + 1, updated_at = now()
                WHERE id = ? AND version = ?
                """, name, subtitle, description, tier, color, icon, d.id(), expected));
        List<String> changes = new ArrayList<>();
        if (!name.equals(d.name())) changes.add("name '" + d.name() + "' -> '" + name + "'");
        if (!java.util.Objects.equals(subtitle, d.subtitle())) changes.add("subtitle");
        if (!java.util.Objects.equals(description, d.description())) changes.add("description");
        if (tier != d.tier()) changes.add("tier " + d.tier() + " -> " + tier);
        if (!color.equals(d.color())) changes.add("color " + d.color() + " -> " + color);
        if (!icon.equals(d.icon())) changes.add("icon " + d.icon() + " -> " + icon);
        audit.logActivity(AUDIT_CATEGORY, "ROLE_UPDATED", "Updated details of " + (d.isSystem() ? "system role " : "") + name
                + (changes.isEmpty() ? " (no field changed)" : ": " + String.join(", ", changes)),
                ACTOR_NAME, actor, d.slug(), "INFO");
        return getRole(d.id().toString());
    }

    @Transactional
    public SuperAdminRoleDTOs.AdminRoleResponse updatePermissions(String id,
            SuperAdminRoleDTOs.UpdatePermissionsRequest req, String actor) {
        Definition d = find(parseId(id));
        long expected = ExpectedVersion.required(req.expectedVersion());
        if (req.permissions() == null || req.permissions().isEmpty()) {
            throw invalid("permissions", "A role needs at least one capability.");
        }
        Set<String> next = new TreeSet<>(req.permissions());
        if (KIND_SUPER_ADMIN.equals(d.kind())) {
            // Super Admin holds every capability; it can never lose one.
            if (!next.containsAll(catalog.keysOf(catalog.all()))) throw superAdminProtected();
            ExpectedVersion.check(d.version(), expected);
            return getRole(d.id().toString());
        }
        ExpectedVersion.check(d.version(), expected);
        validateKeys(d.scope(), next);
        requireOwnerKeys(d, next);
        Set<String> current = new TreeSet<>(permissionsOf(d));
        if (current.equals(next)) return getRole(d.id().toString());
        applyPermissions(d, next, expected);
        auditPermissionChange(d, current, next, "ROLE_PERMISSIONS_CHANGED", "Changed capabilities of ", actor);
        return getRole(d.id().toString());
    }

    @Transactional
    public SuperAdminRoleDTOs.AdminRoleResponse resetToBaseline(String id, Long expectedVersion, String actor) {
        Definition d = find(parseId(id));
        requireBaseline(d);
        long expected = ExpectedVersion.required(expectedVersion);
        ExpectedVersion.check(d.version(), expected);
        resetOne(d, expected, "Reset to baseline: ", actor);
        return getRole(d.id().toString());
    }

    /**
     * Restores every organization system role to the version-controlled baseline. The body lists each of those
     * roles with the version the client read; one stale or missing entry refuses the whole re-sync.
     */
    @Transactional
    public SuperAdminRoleDTOs.ResyncResponse resyncSystemRoles(AdminRequests.BulkVersionedRequest req, String actor) {
        Map<UUID, Long> versions = new HashMap<>();
        if (req != null && req.items() != null) {
            for (AdminRequests.VersionedId item : req.items()) {
                UUID id;
                try {
                    id = UUID.fromString(item.id());
                } catch (IllegalArgumentException e) {
                    continue;
                }
                versions.put(id, item.expectedVersion());
            }
        }
        List<Definition> systemTemplates = jdbc.query("""
                SELECT d.*, r.name AS template_name
                FROM platform_role_definitions d LEFT JOIN roles r ON r.id = d.template_role_id
                WHERE d.kind IN (?, ?) ORDER BY d.rank FOR UPDATE OF d
                """, (rs, n) -> definition(rs), KIND_TEMPLATE, KIND_PLATFORM_OPERATOR);
        for (Definition d : systemTemplates) {
            Long expected = versions.get(d.id());
            if (expected == null) {
                throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED",
                        "Send the version you last read for every system role.",
                        List.of(new ApiError.FieldError("items", "missing " + d.slug())));
            }
            ExpectedVersion.check(d.version(), expected);
        }
        List<String> changed = new ArrayList<>();
        for (Definition d : systemTemplates) {
            if (resetOne(d, d.version(), "Re-synced to baseline: ", actor)) changed.add(d.slug());
        }
        audit.logActivity(AUDIT_CATEGORY, "SYSTEM_ROLES_RESYNCED", changed.isEmpty()
                ? "Re-synced system roles: all " + systemTemplates.size() + " already matched the baseline"
                : "Re-synced system roles to the baseline: " + String.join(", ", changed),
                ACTOR_NAME, actor, "system-roles", changed.isEmpty() ? "INFO" : "WARNING");
        return new SuperAdminRoleDTOs.ResyncResponse(changed, listRoles());
    }

    @Transactional
    public SuperAdminRoleDTOs.AdminRoleResponse toggleActive(String id, Long expectedVersion, String actor) {
        Definition d = find(parseId(id));
        requireCustom(d);
        long expected = ExpectedVersion.required(expectedVersion);
        ExpectedVersion.check(d.version(), expected);
        boolean next = !d.isActive();
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE platform_role_definitions SET is_active = ?, version = version + 1, updated_at = now()
                WHERE id = ? AND version = ?
                """, next, d.id(), expected));
        if (d.templateRoleId() != null) {
            jdbc.update("UPDATE roles SET is_active = ?, version = version + 1, updated_at = now() WHERE id = ?",
                    next, d.templateRoleId());
        }
        audit.logActivity(AUDIT_CATEGORY, next ? "ROLE_ACTIVATED" : "ROLE_DEACTIVATED",
                (next ? "Activated" : "Deactivated") + " custom role " + d.name()
                        + (d.templateRoleId() != null && !next
                                ? " (hidden from organizations; existing grants give no permissions)" : ""),
                ACTOR_NAME, actor, d.slug(), next ? "INFO" : "WARNING");
        return getRole(d.id().toString());
    }

    @Transactional
    public void deleteRole(String id, Long expectedVersion, String actor) {
        Definition d = find(parseId(id));
        requireCustom(d);
        long expected = ExpectedVersion.required(expectedVersion);
        ExpectedVersion.check(d.version(), expected);
        if (d.templateRoleId() != null) {
            long used = count("SELECT count(*) FROM grants WHERE template_role_id = ?", d.templateRoleId())
                    + count("SELECT count(*) FROM invitations WHERE template_role_id = ?", d.templateRoleId())
                    + count("SELECT count(*) FROM memberships WHERE role_template = ?", d.templateName());
            if (used > 0) {
                throw new ApiException(HttpStatus.CONFLICT, "ROLE_IN_USE",
                        "Organizations still grant or invite with this role. Deactivate it instead, or revoke those grants first.");
            }
        }
        Set<String> keys = permissionsOf(d);
        ExpectedVersion.requireUpdated(jdbc.update(
                "DELETE FROM platform_role_definitions WHERE id = ? AND version = ? AND NOT is_system", d.id(), expected));
        if (d.templateRoleId() != null) {
            jdbc.update("DELETE FROM role_permissions WHERE role_id = ?", d.templateRoleId());
            jdbc.update("DELETE FROM role_templates WHERE role_id = ?", d.templateRoleId());
            jdbc.update("DELETE FROM roles WHERE id = ? AND is_template", d.templateRoleId());
        }
        audit.logActivity(AUDIT_CATEGORY, "ROLE_DELETED", "Deleted custom role " + d.name() + " (" + keys.size()
                + " capabilities: " + String.join(", ", new TreeSet<>(keys)) + ")", ACTOR_NAME, actor, d.slug(), "WARNING");
    }

    /* ------------------------------------------------------------------ helpers */

    private UUID insertCustom(String slug, String name, String subtitle, String description, String scope, int tier,
            String color, String icon, Set<String> keys, String actor) {
        if (count("SELECT count(*) FROM platform_role_definitions WHERE lower(slug) = lower(?)", slug) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_ROLE", "A role with that slug already exists.",
                    List.of(new ApiError.FieldError("slug", "already in use")));
        }
        requireUniqueName(name);
        UUID id = UUID.randomUUID();
        UUID templateId = null;
        if (RoleCapabilityCatalog.SCOPE_ORGANIZATION.equals(scope)) {
            String templateName = templateName(slug);
            if (count("SELECT count(*) FROM roles WHERE is_template AND name = ?", templateName) > 0) {
                throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_ROLE", "A role with that slug already exists.",
                        List.of(new ApiError.FieldError("slug", "already in use")));
            }
            templateId = UUID.randomUUID();
            jdbc.update("INSERT INTO roles (id, org_id, name, is_template) VALUES (?, NULL, ?, TRUE)", templateId, templateName);
            jdbc.update("INSERT INTO role_templates (role_id) VALUES (?)", templateId);
            for (String key : keys) {
                jdbc.update("INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)", templateId, key);
            }
        }
        jdbc.update("""
                INSERT INTO platform_role_definitions
                    (id, slug, name, subtitle, description, kind, scope, tier, rank, is_system, is_active, color, icon,
                     template_role_id, created_by)
                VALUES (?, ?, ?, ?, ?, 'CUSTOM', ?, ?, NULL, FALSE, TRUE, ?, ?, ?, ?)
                """, id, slug, name, subtitle, description, scope, tier, color, icon, templateId, actor);
        if (templateId == null) {
            for (String key : keys) {
                jdbc.update("INSERT INTO platform_role_permissions (role_definition_id, capability_key) VALUES (?, ?)",
                        id, key);
            }
        }
        return id;
    }

    private void applyPermissions(Definition d, Set<String> next, long expected) {
        ExpectedVersion.requireUpdated(jdbc.update("""
                UPDATE platform_role_definitions SET version = version + 1, updated_at = now()
                WHERE id = ? AND version = ?
                """, d.id(), expected));
        if (d.templateRoleId() != null) {
            jdbc.update("DELETE FROM role_permissions WHERE role_id = ?", d.templateRoleId());
            for (String key : next) {
                jdbc.update("INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)", d.templateRoleId(), key);
            }
            jdbc.update("UPDATE roles SET version = version + 1, updated_at = now() WHERE id = ?", d.templateRoleId());
        } else {
            jdbc.update("DELETE FROM platform_role_permissions WHERE role_definition_id = ?", d.id());
            for (String key : next) {
                jdbc.update("INSERT INTO platform_role_permissions (role_definition_id, capability_key) VALUES (?, ?)",
                        d.id(), key);
            }
        }
    }

    private void auditPermissionChange(Definition d, Set<String> current, Set<String> next, String action,
            String prefix, String actor) {
        List<String> added = next.stream().filter(k -> !current.contains(k)).sorted().toList();
        List<String> removed = current.stream().filter(k -> !next.contains(k)).sorted().toList();
        String reach = "";
        if (d.templateRoleId() != null) {
            long users = count("""
                    SELECT count(DISTINCT g.membership_id) FROM grants g
                    JOIN memberships m ON m.id = g.membership_id AND m.org_id = g.org_id
                    WHERE g.template_role_id = ? AND m.status = 'ACTIVE'
                    """, d.templateRoleId());
            reach = "; applies to " + users + " active member" + (users == 1 ? "" : "s") + " holding it";
        }
        audit.logActivity(AUDIT_CATEGORY, action, prefix + d.name()
                + " (added: " + (added.isEmpty() ? "none" : String.join(", ", added))
                + "; removed: " + (removed.isEmpty() ? "none" : String.join(", ", removed)) + ")" + reach,
                ACTOR_NAME, actor, d.slug(), d.isSystem() || !removed.isEmpty() ? "WARNING" : "INFO");
    }

    private Set<String> permissionsOf(Definition d) {
        return switch (d.kind()) {
            case KIND_SUPER_ADMIN -> catalog.keysOf(catalog.all());
            case KIND_PLATFORM_OPERATOR -> {
                Set<String> stored = new TreeSet<>(jdbc.queryForList(
                        "SELECT capability_key FROM platform_role_permissions WHERE role_definition_id = ?",
                        String.class, d.id()));
                yield stored.isEmpty() ? catalog.platformOperatorKeys() : stored;
            }
            default -> d.templateRoleId() != null
                    ? new TreeSet<>(jdbc.queryForList("SELECT permission_key FROM role_permissions WHERE role_id = ?",
                            String.class, d.templateRoleId()))
                    : new TreeSet<>(jdbc.queryForList(
                            "SELECT capability_key FROM platform_role_permissions WHERE role_definition_id = ?",
                            String.class, d.id()));
        };
    }

    /** Organization roles take PermissionKey values; platform custom roles take operator keys; nobody gets root keys. */
    private void validateKeys(String scope, Set<String> keys) {
        Set<String> root = catalog.keysOf(catalog.platformRoot());
        if (keys.stream().anyMatch(root::contains)) throw superAdminProtected();
        Set<String> allowed = RoleCapabilityCatalog.SCOPE_ORGANIZATION.equals(scope)
                ? new HashSet<>(java.util.Arrays.stream(PermissionKey.values()).map(PermissionKey::value).toList())
                : new HashSet<>(catalog.keysOf(catalog.operator()));
        List<String> unknown = keys.stream().filter(k -> !allowed.contains(k)).sorted().toList();
        if (!unknown.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_PERMISSION",
                    "These capabilities do not exist for " + scope.toLowerCase(Locale.ROOT) + " roles: "
                            + String.join(", ", unknown),
                    List.of(new ApiError.FieldError("permissions", "unknown capability")));
        }
    }

    private static void requireOwnerKeys(Definition d, Set<String> next) {
        if (!SystemRoleBaseline.OWNER_TEMPLATE_ID.equals(d.templateRoleId())) return;
        List<String> missing = SystemRoleBaseline.OWNER_REQUIRED_KEYS.stream().filter(k -> !next.contains(k)).sorted().toList();
        if (!missing.isEmpty()) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "OWNER_KEYS_REQUIRED",
                    "The Organization Owner must keep " + String.join(" and ", missing)
                            + ", otherwise no organization could govern itself.",
                    List.of(new ApiError.FieldError("permissions", "owner keys required")));
        }
    }

    private static void requireCustom(Definition d) {
        if (KIND_SUPER_ADMIN.equals(d.kind())) throw superAdminProtected();
        if (d.isSystem()) {
            throw new ApiException(HttpStatus.FORBIDDEN, "SYSTEM_ROLE_PROTECTED",
                    "System roles are always active and cannot be deleted; edit or reset them instead.");
        }
    }

    private static void requireBaseline(Definition d) {
        if (KIND_SUPER_ADMIN.equals(d.kind())) {
            throw new ApiException(HttpStatus.CONFLICT, "NO_BASELINE",
                    "Super Admin always holds every capability; there is nothing to reset.");
        }
        if (!d.isSystem()) {
            throw new ApiException(HttpStatus.CONFLICT, "NO_BASELINE", "Only system roles have a baseline.");
        }
    }

    /**
     * Restores one system role: organization templates get the V3/V20 set; the Platform Operator drops its documented
     * set and shows the live department-derived set again. Returns whether anything changed.
     */
    private boolean resetOne(Definition d, long expected, String prefix, String actor) {
        Set<String> current = new TreeSet<>(permissionsOf(d));
        if (KIND_PLATFORM_OPERATOR.equals(d.kind())) {
            if (count("SELECT count(*) FROM platform_role_permissions WHERE role_definition_id = ?", d.id()) == 0) {
                return false;
            }
            ExpectedVersion.requireUpdated(jdbc.update("""
                    UPDATE platform_role_definitions SET version = version + 1, updated_at = now()
                    WHERE id = ? AND version = ?
                    """, d.id(), expected));
            jdbc.update("DELETE FROM platform_role_permissions WHERE role_definition_id = ?", d.id());
            auditPermissionChange(d, current, catalog.platformOperatorKeys(), "ROLE_RESET_TO_BASELINE", prefix, actor);
            return true;
        }
        Set<String> baseline = SystemRoleBaseline.ORGANIZATION_TEMPLATES.get(d.templateRoleId());
        if (baseline == null || current.equals(baseline)) return false;
        applyPermissions(d, baseline, expected);
        auditPermissionChange(d, current, baseline, "ROLE_RESET_TO_BASELINE", prefix, actor);
        return true;
    }

    private static ApiException superAdminProtected() {
        return new ApiException(HttpStatus.FORBIDDEN, "SUPER_ADMIN_PROTECTED",
                "Super Admin authority is protected: it cannot lose capabilities, be deactivated, deleted, copied or given to another role.");
    }

    private Definition find(UUID id) {
        List<Definition> rows = jdbc.query("""
                SELECT d.*, r.name AS template_name
                FROM platform_role_definitions d LEFT JOIN roles r ON r.id = d.template_role_id
                WHERE d.id = ?
                """, (rs, n) -> definition(rs), id);
        if (rows.isEmpty()) throw ApiException.notFound();
        return rows.get(0);
    }

    private void requireUniqueName(String name) {
        if (count("SELECT count(*) FROM platform_role_definitions WHERE lower(name) = lower(?)", name) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_ROLE", "A role with that name already exists.",
                    List.of(new ApiError.FieldError("name", "already in use")));
        }
    }

    private long count(String sql, Object... args) {
        Long value = jdbc.queryForObject(sql, Long.class, args);
        return value == null ? 0 : value;
    }

    static UUID parseId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw ApiException.notFound();
        }
    }

    static String templateName(String slug) {
        return "CUSTOM_" + slug.toUpperCase(Locale.ROOT).replace('-', '_');
    }

    static String slugify(String name) {
        if (name == null) return "";
        String s = name.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        return s.length() > 40 ? s.substring(0, 40).replaceAll("-+$", "") : s;
    }

    private static String validName(String name) {
        if (name == null || name.trim().length() < 3 || name.trim().length() > 100) {
            throw invalid("name", "Role name must be 3 to 100 characters.");
        }
        return name.trim();
    }

    private static String validSlug(String slug) {
        String s = slug == null ? "" : slug.trim().toLowerCase(Locale.ROOT);
        if (s.length() < 3 || s.length() > 40 || !SLUG.matcher(s).matches()) {
            throw invalid("slug", "Slug must be 3 to 40 lowercase letters, digits or single dashes.");
        }
        return s;
    }

    private static String validScope(String scope) {
        if (scope == null || scope.isBlank()) return RoleCapabilityCatalog.SCOPE_ORGANIZATION;
        String s = scope.trim().toUpperCase(Locale.ROOT);
        if (!s.equals(RoleCapabilityCatalog.SCOPE_ORGANIZATION) && !s.equals(RoleCapabilityCatalog.SCOPE_PLATFORM)) {
            throw invalid("scope", "Scope must be PLATFORM or ORGANIZATION.");
        }
        return s;
    }

    /** Tier 1 is platform scope, tiers 2-5 organization scope, tier 6 (Custom Roles) either. */
    private static int validTier(int tier, String scope) {
        if (tier < 1 || tier > 6) throw invalid("tier", "Tier must be 1 to 6.");
        boolean platform = RoleCapabilityCatalog.SCOPE_PLATFORM.equals(scope);
        if (tier == 1 && !platform) throw invalid("tier", "Tier 1 (Platform Governance) holds platform-scope roles only.");
        if (tier >= 2 && tier <= 5 && platform) {
            throw invalid("tier", "Tiers 2 to 5 hold organization-scope roles only.");
        }
        return tier;
    }

    private static String validColor(String color) {
        if (color == null || color.isBlank()) return "blue";
        String c = color.trim().toLowerCase(Locale.ROOT);
        if (!COLORS.contains(c)) throw invalid("color", "Unknown color.");
        return c;
    }

    private static String validIcon(String icon) {
        if (icon == null || icon.isBlank()) return "Shield";
        if (!ICON.matcher(icon.trim()).matches()) throw invalid("icon", "Unknown icon.");
        return icon.trim();
    }

    private static String trimOrNull(String value, int max, String field) {
        if (value == null || value.isBlank()) return null;
        String t = value.trim();
        if (t.length() > max) throw invalid(field, "At most " + max + " characters.");
        return t;
    }

    private static ApiException invalid(String field, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED", message,
                List.of(new ApiError.FieldError(field, message)));
    }

    private SuperAdminRoleDTOs.AdminRoleResponse response(Definition d, String rankLabel, Set<String> perms,
            int catalogSize, long users, long orgs, Set<String> operatorBaseline) {
        boolean org = d.templateRoleId() != null;
        String enforcement;
        String note;
        switch (d.kind()) {
            case KIND_SUPER_ADMIN -> {
                enforcement = ENFORCEMENT_PLATFORM;
                note = "Enforced by the platform: the PLATFORM_SUPER_ADMIN authority covers every capability. Name, description, color and icon can change; it can never lose a capability, be deactivated, deleted, copied or assigned here.";
            }
            case KIND_PLATFORM_OPERATOR -> {
                enforcement = ENFORCEMENT_OPERATOR;
                note = "Enforced at operator sign-in from department permissions: Main Platform Operators receive every department permission, Department Operators their department's set plus overrides (Operators page). The set edited here documents the intended operator capabilities and does not change operator sign-in.";
            }
            case KIND_TEMPLATE -> {
                enforcement = ENFORCEMENT_TEMPLATE;
                note = "Enforced for every organization: changes apply immediately to all members who hold this role through a grant, in every tenant.";
            }
            default -> {
                enforcement = org ? ENFORCEMENT_TEMPLATE : ENFORCEMENT_DEFINITION;
                note = org
                        ? (d.isActive()
                                ? "Available to every organization: admins who hold all of its capabilities can grant it; changes apply immediately to every grant."
                                : "Inactive: hidden from organizations, not grantable, and existing grants give no permissions.")
                        : "Definition only: platform staff access is enforced by operator departments and per-operator overrides. This role cannot be assigned yet.";
            }
        }
        Set<String> baseline = KIND_PLATFORM_OPERATOR.equals(d.kind()) ? operatorBaseline
                : d.templateRoleId() == null || !d.isSystem()
                        ? null : SystemRoleBaseline.ORGANIZATION_TEMPLATES.get(d.templateRoleId());
        return new SuperAdminRoleDTOs.AdminRoleResponse(
                d.id(), d.slug(), d.name(), d.subtitle(), d.description(), d.kind(), d.scope(), d.tier(),
                TIER_NAMES.get(d.tier()), d.rank(), rankLabel, d.isSystem(), d.isActive(),
                KIND_SUPER_ADMIN.equals(d.kind()),
                !KIND_SUPER_ADMIN.equals(d.kind()),
                org && d.isActive() && !SystemRoleBaseline.OWNER_TEMPLATE_ID.equals(d.templateRoleId()),
                enforcement, note, d.color(), d.icon(), d.templateName(),
                new ArrayList<>(new TreeSet<>(perms)), perms.size(), catalogSize, users, orgs,
                baseline == null ? null : !baseline.equals(new TreeSet<>(perms)),
                baseline == null ? null : new ArrayList<>(baseline),
                d.createdBy(), d.createdAt(), d.updatedAt(), d.version());
    }

    private static SuperAdminRoleDTOs.RoleHistoryEntry historyEntry(ResultSet rs) throws SQLException {
        Timestamp ts = rs.getTimestamp("timestamp");
        return new SuperAdminRoleDTOs.RoleHistoryEntry(rs.getObject("id", UUID.class), rs.getString("action"),
                rs.getString("summary"), rs.getString("actor_email"), rs.getString("target_label"),
                rs.getString("severity"), ts == null ? null : ts.toInstant());
    }

    private static Definition definition(ResultSet rs) throws SQLException {
        int rank = rs.getInt("rank");
        Integer rankValue = rs.wasNull() ? null : rank;
        return new Definition(rs.getObject("id", UUID.class), rs.getString("slug"), rs.getString("name"),
                rs.getString("subtitle"), rs.getString("description"), rs.getString("kind"), rs.getString("scope"),
                rs.getInt("tier"), rankValue, rs.getBoolean("is_system"), rs.getBoolean("is_active"),
                rs.getString("color"), rs.getString("icon"), rs.getObject("template_role_id", UUID.class),
                rs.getString("template_name"), rs.getString("created_by"),
                rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("updated_at").toInstant(),
                rs.getLong("version"));
    }

    record Definition(UUID id, String slug, String name, String subtitle, String description, String kind,
            String scope, int tier, Integer rank, boolean isSystem, boolean isActive, String color, String icon,
            UUID templateRoleId, String templateName, String createdBy, Instant createdAt, Instant updatedAt,
            long version) {}
}
