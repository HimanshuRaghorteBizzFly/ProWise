package com.prowise.authz;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.identity.AuthPrincipal;

/**
 * Roles are templates; only grants make them effective. Least privilege applies to every change:
 * nobody can create, edit, delete, grant or revoke a role holding a key they do not hold themselves
 * at that scope, and self-elevation is refused and recorded.
 *
 * TODO(1.4): Idempotency-Key, audit rows and outbox events for role and grant changes.
 */
@Service
public class RoleService {

    static final UUID OWNER_TEMPLATE_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");
    static final UUID PLATFORM_OPERATOR_TEMPLATE_ID = UUID.fromString("10000000-0000-0000-0000-000000000008");

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;
    private final SecurityEvidenceService evidence;

    public RoleService(JdbcTemplate jdbc, PermissionService permissions, SecurityEvidenceService evidence) {
        this.jdbc = jdbc;
        this.permissions = permissions;
        this.evidence = evidence;
    }

    /* ------------------------------------------------------------------
     * Roles
     * ------------------------------------------------------------------ */

    public List<RoleResponse> list(UUID organizationId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        return jdbc.query("""
                SELECT r.id, r.name, r.is_template, r.version,
                       (SELECT count(*) FROM grants g
                         WHERE g.org_id = ? AND COALESCE(g.template_role_id, g.org_role_id) = r.id) AS grant_count
                FROM roles r
                WHERE (r.is_template AND r.id <> ?) OR r.org_id = ?
                ORDER BY r.is_template DESC, r.name
                """, (rs, rowNum) -> toResponse(
                        rs.getObject("id", UUID.class), rs.getString("name"), rs.getBoolean("is_template"),
                        rs.getLong("version"), rs.getLong("grant_count")),
                organizationId, PLATFORM_OPERATOR_TEMPLATE_ID, organizationId);
    }

    public RoleResponse get(UUID organizationId, UUID roleId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        return find(organizationId, roleId);
    }

    @Transactional
    public RoleResponse create(UUID organizationId, Authentication authentication, RoleRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        String name = validName(request.name());
        Set<String> keys = validKeys(request.permissionKeys());
        requireHoldsAll(authentication, organizationId, null, keys, false, "ROLE", null);
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO roles (id, org_id, name, is_template)
                    VALUES (?, ?, ?, FALSE)
                    """, id, organizationId, name);
            insertPermissions(id, keys);
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_ROLE", "That role name is already in use.");
        }
        return find(organizationId, id);
    }

    @Transactional
    public RoleResponse update(UUID organizationId, UUID roleId, Authentication authentication, RoleRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        RoleRow role = customRole(organizationId, roleId);
        if (role.version() != request.expectedVersion()) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "The role was changed by another request.");
        }
        String name = validName(request.name());
        Set<String> next = validKeys(request.permissionKeys());
        Set<String> current = new HashSet<>(rolePermissionsForRole(roleId));
        Set<String> changed = new HashSet<>(next);
        changed.addAll(current);
        changed.removeIf(key -> next.contains(key) && current.contains(key));
        boolean actorHoldsRole = actorHoldsRole(authentication, organizationId, roleId);
        requireHoldsAll(authentication, organizationId, null, changed, actorHoldsRole, "ROLE", roleId.toString());
        try {
            int updated = jdbc.update("""
                    UPDATE roles SET name = ?, version = version + 1, updated_at = now()
                    WHERE id = ? AND org_id = ? AND version = ?
                    """, name, roleId, organizationId, request.expectedVersion());
            if (updated == 0) {
                throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "The role was changed by another request.");
            }
            jdbc.update("DELETE FROM role_permissions WHERE role_id = ?", roleId);
            insertPermissions(roleId, next);
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_ROLE", "That role name is already in use.");
        }
        return find(organizationId, roleId);
    }

    @Transactional
    public void delete(UUID organizationId, UUID roleId, long expectedVersion, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        RoleRow role = customRole(organizationId, roleId);
        if (role.version() != expectedVersion) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "The role was changed by another request.");
        }
        requireHoldsAll(authentication, organizationId, null, new HashSet<>(rolePermissionsForRole(roleId)),
                false, "ROLE", roleId.toString());
        Integer used = jdbc.queryForObject("SELECT count(*) FROM grants WHERE org_id = ? AND org_role_id = ?",
                Integer.class, organizationId, roleId);
        if (used != null && used > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "ROLE_IN_USE", "Revoke the role grants before deleting the role.");
        }
        jdbc.update("DELETE FROM role_permissions WHERE role_id = ?", roleId);
        jdbc.update("DELETE FROM roles WHERE id = ? AND org_id = ? AND version = ?", roleId, organizationId, expectedVersion);
    }

    /* ------------------------------------------------------------------
     * Members and grants
     * ------------------------------------------------------------------ */

    public List<MemberResponse> members(UUID organizationId, Authentication authentication, String cursor) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        UUID after = parseCursor(cursor);
        return jdbc.query("""
                SELECT m.id, u.email, m.status, m.role_template
                FROM memberships m JOIN users u ON u.id = m.user_id
                WHERE m.org_id = ? AND (CAST(? AS uuid) IS NULL OR m.id > CAST(? AS uuid))
                ORDER BY m.id
                LIMIT 51
                """, (rs, rowNum) -> new MemberResponse(
                        rs.getObject("id", UUID.class), rs.getString("email"), rs.getString("email"),
                        rs.getString("status"), rs.getString("role_template")),
                organizationId, after, after);
    }

    public List<GrantResponse> memberGrants(UUID organizationId, UUID membershipId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        memberInOrganization(organizationId, membershipId);
        return jdbc.query(GRANT_SELECT + " WHERE g.org_id = ? AND g.membership_id = ? ORDER BY r.name, g.id",
                (rs, rowNum) -> grantRow(rs), organizationId, membershipId);
    }

    /** Members holding a role in this organization (role detail screen). */
    public List<RoleHolderResponse> roleHolders(UUID organizationId, UUID roleId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        find(organizationId, roleId);
        return jdbc.query("""
                SELECT g.id, g.membership_id, u.email, m.status, g.scope, g.scope_id, g.expires_at, g.version
                FROM grants g
                JOIN memberships m ON m.id = g.membership_id AND m.org_id = g.org_id
                JOIN users u ON u.id = m.user_id
                WHERE g.org_id = ? AND COALESCE(g.template_role_id, g.org_role_id) = ?
                ORDER BY u.email, g.id
                """, (rs, rowNum) -> {
                    java.sql.Timestamp expires = rs.getTimestamp("expires_at");
                    return new RoleHolderResponse(rs.getObject("id", UUID.class), rs.getObject("membership_id", UUID.class),
                            rs.getString("email"), rs.getString("status"), rs.getString("scope"),
                            rs.getObject("scope_id", UUID.class), expires == null ? null : expires.toInstant(),
                            rs.getLong("version"));
                }, organizationId, roleId);
    }

    @Transactional
    public GrantResponse grant(UUID organizationId, Authentication authentication, GrantRequest request) {
        AuthPrincipal actor = permissions.principal(authentication);
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        MemberRow member = memberInOrganization(organizationId, request.membershipId());
        if (!"ACTIVE".equals(member.status())) {
            throw new ApiException(HttpStatus.CONFLICT, "MEMBER_INACTIVE", "Only active members can receive a role.");
        }
        UUID roleId = resolveGrantableRole(organizationId, request.templateRoleId(), request.orgRoleId());
        String scope = request.scope() == null ? "ORG" : request.scope();
        String projectRef = validateScope(organizationId, scope, request.scopeId());
        if (request.expiresAt() != null && !request.expiresAt().isAfter(Instant.now())) {
            throw validation("expires_at", "Expiry must be in the future.");
        }
        boolean self = actor.userId().equals(member.userId());
        requireHoldsAll(authentication, organizationId, projectRef, new HashSet<>(rolePermissionsForRole(roleId)),
                self, "GRANT", member.id().toString());
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO grants
                        (id, org_id, membership_id, template_role_id, org_role_id, scope, scope_id, expires_at, granted_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, id, organizationId, member.id(), request.templateRoleId(), request.orgRoleId(),
                    scope, request.scopeId(), request.expiresAt(), actor.userId());
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "GRANT_EXISTS", "That grant already exists.");
        }
        return findGrant(organizationId, id);
    }

    @Transactional
    public void revoke(UUID organizationId, UUID grantId, long expectedVersion, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT COALESCE(template_role_id, org_role_id) AS role_id, template_role_id, scope, scope_id
                FROM grants WHERE id = ? AND org_id = ?
                """, grantId, organizationId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        Map<String, Object> row = rows.get(0);
        if (OWNER_TEMPLATE_ID.equals(row.get("template_role_id"))) {
            // TODO(1.2): owner changes go through ownership transfer, which keeps exactly one owner.
            throw new ApiException(HttpStatus.FORBIDDEN, "OWNER_TRANSFER_REQUIRED",
                    "The owner role can only change through ownership transfer.");
        }
        String projectRef = row.get("scope_id") == null ? null : row.get("scope_id").toString();
        requireHoldsAll(authentication, organizationId, projectRef,
                new HashSet<>(rolePermissionsForRole((UUID) row.get("role_id"))), false, "GRANT", grantId.toString());
        int updated = jdbc.update("DELETE FROM grants WHERE id = ? AND org_id = ? AND version = ?",
                grantId, organizationId, expectedVersion);
        if (updated == 0) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "The grant was changed by another request.");
        }
    }

    public List<String> effectivePermissions(UUID organizationId, UUID membershipId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        memberInOrganization(organizationId, membershipId);
        return jdbc.query("""
                SELECT DISTINCT rp.permission_key
                FROM grants g
                JOIN role_permissions rp ON rp.role_id = COALESCE(g.template_role_id, g.org_role_id)
                WHERE g.org_id = ? AND g.membership_id = ?
                  AND (g.expires_at IS NULL OR g.expires_at > now())
                ORDER BY rp.permission_key
                """, (rs, rowNum) -> rs.getString("permission_key"), organizationId, membershipId);
    }

    /* ------------------------------------------------------------------
     * Least privilege
     * ------------------------------------------------------------------ */

    /**
     * The actor must hold every key in {@code keys} at the given scope (ORG when {@code projectRef} is null).
     * Refusals are recorded as security evidence; self-elevation is recorded under its own event type.
     */
    private void requireHoldsAll(
            Authentication authentication,
            UUID organizationId,
            String projectRef,
            Set<String> keys,
            boolean self,
            String targetType,
            String targetRef) {
        List<String> missing = keys.stream()
                .filter(key -> projectRef == null
                        ? !permissions.can(authentication, organizationId, key)
                        : !permissions.canOnProject(authentication, organizationId, projectRef, key))
                .sorted()
                .toList();
        if (missing.isEmpty()) return;
        AuthPrincipal actor = permissions.principal(authentication);
        evidence.recordDenied(actor,
                self ? SecurityEvidenceService.SELF_ELEVATION_DENIED : SecurityEvidenceService.PRIVILEGE_ESCALATION_DENIED,
                targetType, targetRef, "Requested permission beyond the actor's own grants");
        throw new ApiException(HttpStatus.FORBIDDEN, self ? "SELF_ELEVATION_DENIED" : "FORBIDDEN",
                self ? "You cannot give yourself permissions you do not hold."
                        : "You cannot grant or change a permission you do not hold.");
    }

    private boolean actorHoldsRole(Authentication authentication, UUID organizationId, UUID roleId) {
        AuthPrincipal actor = permissions.principal(authentication);
        Integer count = jdbc.queryForObject("""
                SELECT count(*) FROM grants g JOIN memberships m ON m.id = g.membership_id AND m.org_id = g.org_id
                WHERE g.org_id = ? AND g.org_role_id = ? AND m.user_id = ?
                """, Integer.class, organizationId, roleId, actor.userId());
        return count != null && count > 0;
    }

    /* ------------------------------------------------------------------
     * Validation and lookups (always org-scoped)
     * ------------------------------------------------------------------ */

    private UUID resolveGrantableRole(UUID organizationId, UUID templateRoleId, UUID orgRoleId) {
        if ((templateRoleId == null) == (orgRoleId == null)) {
            throw validation("role", "Exactly one role reference is required.");
        }
        if (orgRoleId != null) {
            customRole(organizationId, orgRoleId);
            return orgRoleId;
        }
        Integer count = jdbc.queryForObject("SELECT count(*) FROM role_templates WHERE role_id = ?",
                Integer.class, templateRoleId);
        if (count == null || count != 1 || PLATFORM_OPERATOR_TEMPLATE_ID.equals(templateRoleId)) {
            throw PermissionService.notFound();
        }
        if (OWNER_TEMPLATE_ID.equals(templateRoleId)) {
            // TODO(1.2): a second owner is never created by a grant; use ownership transfer.
            throw new ApiException(HttpStatus.FORBIDDEN, "OWNER_TRANSFER_REQUIRED",
                    "The owner role can only change through ownership transfer.");
        }
        return templateRoleId;
    }

    /** Returns the project reference for a PROJECT grant after checking the project belongs to this org. */
    private String validateScope(UUID organizationId, String scope, UUID scopeId) {
        if ("ORG".equals(scope)) {
            if (scopeId != null) throw validation("scope_id", "ORG grants have no scope id.");
            return null;
        }
        if (!"PROJECT".equals(scope)) throw validation("scope", "Scope must be ORG or PROJECT.");
        if (scopeId == null) throw validation("scope_id", "PROJECT grants need a project id.");
        Integer count = jdbc.queryForObject("SELECT count(*) FROM projects WHERE id = ? AND org_id = ?",
                Integer.class, scopeId.toString(), organizationId);
        if (count == null || count != 1) throw PermissionService.notFound();
        return scopeId.toString();
    }

    private static String validName(String name) {
        if (name == null || name.trim().length() < 3 || name.trim().length() > 100) {
            throw validation("name", "Role name must be 3 to 100 characters.");
        }
        return name.trim();
    }

    private static Set<String> validKeys(List<String> keys) {
        if (keys == null || keys.stream().anyMatch(key -> !PermissionKey.isValid(key))) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_PERMISSION", "The permission key is invalid.");
        }
        return new HashSet<>(keys);
    }

    private void insertPermissions(UUID roleId, Set<String> keys) {
        for (String key : keys.stream().sorted().toList()) {
            jdbc.update("INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)", roleId, key);
        }
    }

    private RoleResponse find(UUID organizationId, UUID roleId) {
        List<RoleResponse> rows = jdbc.query("""
                SELECT r.id, r.name, r.is_template, r.version,
                       (SELECT count(*) FROM grants g
                         WHERE g.org_id = ? AND COALESCE(g.template_role_id, g.org_role_id) = r.id) AS grant_count
                FROM roles r
                WHERE r.id = ? AND ((r.is_template AND r.id <> ?) OR r.org_id = ?)
                """, (rs, rowNum) -> toResponse(rs.getObject("id", UUID.class), rs.getString("name"),
                        rs.getBoolean("is_template"), rs.getLong("version"), rs.getLong("grant_count")),
                organizationId, roleId, PLATFORM_OPERATOR_TEMPLATE_ID, organizationId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        return rows.get(0);
    }

    private RoleResponse toResponse(UUID id, String name, boolean template, long version, long grantCount) {
        return new RoleResponse(id, name, template, OWNER_TEMPLATE_ID.equals(id), version, grantCount,
                rolePermissionsForRole(id));
    }

    private RoleRow customRole(UUID organizationId, UUID roleId) {
        List<RoleRow> rows = jdbc.query("""
                SELECT id, version FROM roles
                WHERE id = ? AND org_id = ? AND is_template = FALSE
                """, (rs, rowNum) -> new RoleRow(rs.getObject("id", UUID.class), rs.getLong("version")),
                roleId, organizationId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        return rows.get(0);
    }

    private List<String> rolePermissionsForRole(UUID roleId) {
        return jdbc.query("SELECT permission_key FROM role_permissions WHERE role_id = ? ORDER BY permission_key",
                (rs, rowNum) -> rs.getString("permission_key"), roleId);
    }

    private MemberRow memberInOrganization(UUID organizationId, UUID membershipId) {
        List<MemberRow> members = jdbc.query("""
                SELECT id, user_id, status FROM memberships WHERE org_id = ? AND id = ?
                """, (rs, rowNum) -> new MemberRow(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
                        rs.getString("status")), organizationId, membershipId);
        if (members.isEmpty()) throw PermissionService.notFound();
        return members.get(0);
    }

    private static final String GRANT_SELECT = """
            SELECT g.id, g.membership_id, g.template_role_id, g.org_role_id, r.name AS role_name,
                   g.scope, g.scope_id, g.expires_at, g.version
            FROM grants g JOIN roles r ON r.id = COALESCE(g.template_role_id, g.org_role_id)
            """;

    private GrantResponse findGrant(UUID organizationId, UUID grantId) {
        List<GrantResponse> rows = jdbc.query(GRANT_SELECT + " WHERE g.id = ? AND g.org_id = ?",
                (rs, rowNum) -> grantRow(rs), grantId, organizationId);
        if (rows.isEmpty()) throw PermissionService.notFound();
        return rows.get(0);
    }

    private static GrantResponse grantRow(java.sql.ResultSet rs) throws java.sql.SQLException {
        java.sql.Timestamp expires = rs.getTimestamp("expires_at");
        return new GrantResponse(
                rs.getObject("id", UUID.class), rs.getObject("membership_id", UUID.class),
                rs.getObject("template_role_id", UUID.class), rs.getObject("org_role_id", UUID.class),
                rs.getString("role_name"), rs.getString("scope"), rs.getObject("scope_id", UUID.class),
                expires == null ? null : expires.toInstant(), rs.getLong("version"));
    }

    private static UUID parseCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) return null;
        try {
            return UUID.fromString(cursor);
        } catch (IllegalArgumentException exception) {
            throw validation("cursor", "The cursor is invalid.");
        }
    }

    private static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED", message);
    }

    private record RoleRow(UUID id, long version) {}
    private record MemberRow(UUID id, UUID userId, String status) {}

    public record RoleRequest(String name, List<String> permissionKeys, long expectedVersion) {}
    public record RoleResponse(
            UUID id, String name, boolean template, boolean ownerOnly, long version, long grantCount,
            List<String> permissionKeys) {}
    public record MemberResponse(UUID id, String displayName, String email, String status, String roleTemplate) {}
    public record RoleHolderResponse(
            UUID grantId, UUID membershipId, String email, String status, String scope, UUID scopeId,
            Instant expiresAt, long version) {}
    public record GrantRequest(
            UUID membershipId,
            UUID templateRoleId,
            UUID orgRoleId,
            String scope,
            UUID scopeId,
            Instant expiresAt) {}
    public record GrantResponse(
            UUID id,
            UUID membershipId,
            UUID templateRoleId,
            UUID orgRoleId,
            String roleName,
            String scope,
            UUID scopeId,
            Instant expiresAt,
            long version) {}
}
