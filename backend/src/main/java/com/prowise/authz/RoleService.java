package com.prowise.authz;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.common.api.ApiException;
import com.prowise.identity.AuthPrincipal;

@Service
public class RoleService {

    private final JdbcTemplate jdbc;
    private final PermissionService permissions;

    public RoleService(JdbcTemplate jdbc, PermissionService permissions) {
        this.jdbc = jdbc;
        this.permissions = permissions;
    }

    public List<RoleResponse> list(UUID organizationId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        permissions.requireMembership(authentication, organizationId);
        return jdbc.query("""
                SELECT id, name, is_template, version
                FROM roles
                WHERE is_template OR org_id = ?
                ORDER BY is_template DESC, name
                """, (rs, rowNum) -> new RoleResponse(
                        rs.getObject("id", UUID.class),
                        rs.getString("name"),
                        rs.getBoolean("is_template"),
                        rs.getLong("version"),
                        jdbc.query("""
                                SELECT permission_key FROM role_permissions
                                WHERE role_id = ? ORDER BY permission_key
                                """, (permission, permissionRow) -> permission.getString("permission_key"),
                                rs.getObject("id", UUID.class))),
                organizationId);
    }

    @Transactional
    public RoleResponse create(
            UUID organizationId,
            Authentication authentication,
            RoleRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        validatePermissions(authentication, organizationId, request.permissionKeys());
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO roles (id, org_id, name, is_template)
                    VALUES (?, ?, ?, FALSE)
                    """, id, organizationId, request.name().trim());
            insertPermissions(id, request.permissionKeys());
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_ROLE", "That role name is already in use.");
        }
        return find(organizationId, id);
    }

    @Transactional
    public RoleResponse update(
            UUID organizationId,
            UUID roleId,
            Authentication authentication,
            RoleRequest request) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        RoleRow role = customRole(organizationId, roleId);
        if (role.version() != request.expectedVersion()) {
            throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "The role was changed by another request.");
        }
        validatePermissions(authentication, organizationId, request.permissionKeys());
        try {
            jdbc.update("""
                    UPDATE roles SET name = ?, version = version + 1, updated_at = now()
                    WHERE id = ? AND org_id = ? AND version = ?
                    """, request.name().trim(), roleId, organizationId, request.expectedVersion());
            jdbc.update("DELETE FROM role_permissions WHERE role_id = ?", roleId);
            insertPermissions(roleId, request.permissionKeys());
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "DUPLICATE_ROLE", "That role name is already in use.");
        }
        return find(organizationId, roleId);
    }

    @Transactional
    public void delete(UUID organizationId, UUID roleId, Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        customRole(organizationId, roleId);
        Integer used = jdbc.queryForObject("SELECT count(*) FROM grants WHERE org_id = ? AND org_role_id = ?",
                Integer.class, organizationId, roleId);
        if (used != null && used > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "ROLE_IN_USE", "Revoke the role grants before deleting the role.");
        }
        jdbc.update("DELETE FROM role_permissions WHERE role_id = ?", roleId);
        jdbc.update("DELETE FROM roles WHERE id = ? AND org_id = ?", roleId, organizationId);
    }

    public List<MemberResponse> members(UUID organizationId, Authentication authentication, String cursor) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        return jdbc.query("""
                SELECT m.id, u.email, u.email AS display_name, m.status
                FROM memberships m JOIN users u ON u.id = m.user_id
                WHERE m.org_id = ?
                ORDER BY m.id
                LIMIT 51
                """, (rs, rowNum) -> new MemberResponse(
                        rs.getObject("id", UUID.class), rs.getString("display_name"),
                        rs.getString("email"), rs.getString("status")), organizationId);
    }

    @Transactional
    public GrantResponse grant(
            UUID organizationId,
            Authentication authentication,
            GrantRequest request) {
        AuthPrincipal actor = permissions.principal(authentication);
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        UUID membershipId = memberInOrganization(organizationId, request.membershipId());
        List<String> rolePermissions = rolePermissions(organizationId, request.templateRoleId(), request.orgRoleId());
        for (String key : rolePermissions) {
            if (!permissions.can(authentication, organizationId, key)) {
                throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You cannot grant a permission you do not hold.");
            }
        }
        if (actor.userId().equals(jdbc.queryForObject(
                "SELECT user_id FROM memberships WHERE id = ?", UUID.class, membershipId))) {
            // The same least-privilege check above also rejects self-elevation.
        }
        UUID id = UUID.randomUUID();
        try {
            jdbc.update("""
                    INSERT INTO grants
                        (id, org_id, membership_id, template_role_id, org_role_id, scope, scope_id, expires_at, granted_by)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, id, organizationId, membershipId, request.templateRoleId(), request.orgRoleId(),
                    request.scope(), request.scopeId(), request.expiresAt(), actor.userId());
        } catch (DuplicateKeyException exception) {
            throw new ApiException(HttpStatus.CONFLICT, "GRANT_EXISTS", "That grant already exists.");
        }
        return findGrant(organizationId, id);
    }

    @Transactional
    public void revoke(
            UUID organizationId,
            UUID grantId,
            long expectedVersion,
            Authentication authentication) {
        permissions.require(authentication, organizationId, PermissionKey.ROLE_MANAGE.value());
        int updated = jdbc.update("""
                DELETE FROM grants
                WHERE id = ? AND org_id = ? AND version = ?
                """, grantId, organizationId, expectedVersion);
        if (updated == 0) {
            if (grantExists(organizationId, grantId)) {
                throw new ApiException(HttpStatus.CONFLICT, "STALE_VERSION", "The grant was changed by another request.");
            }
            throw notFound();
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

    private void validatePermissions(Authentication authentication, UUID organizationId, List<String> keys) {
        if (keys == null || keys.stream().anyMatch(key -> !PermissionKey.isValid(key))) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_PERMISSION", "The permission key is invalid.");
        }
        if (keys.stream().anyMatch(key -> !permissions.can(authentication, organizationId, key))) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "You cannot grant a permission you do not hold.");
        }
    }

    private void insertPermissions(UUID roleId, List<String> keys) {
        for (String key : keys) {
            jdbc.update("INSERT INTO role_permissions (role_id, permission_key) VALUES (?, ?)", roleId, key);
        }
    }

    private RoleResponse find(UUID organizationId, UUID roleId) {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT id, name, is_template, version FROM roles
                WHERE id = ? AND (is_template OR org_id = ?)
                """, roleId, organizationId);
        return new RoleResponse(
                (UUID) row.get("id"), (String) row.get("name"),
                (Boolean) row.get("is_template"), ((Number) row.get("version")).longValue(),
                rolePermissionsForRole(roleId));
    }

    private RoleRow customRole(UUID organizationId, UUID roleId) {
        List<RoleRow> rows = jdbc.query("""
                SELECT id, version FROM roles
                WHERE id = ? AND org_id = ? AND is_template = FALSE
                """, (rs, rowNum) -> new RoleRow(rs.getObject("id", UUID.class), rs.getLong("version")),
                roleId, organizationId);
        if (rows.isEmpty()) throw notFound();
        return rows.get(0);
    }

    private List<String> rolePermissions(UUID organizationId, UUID templateRoleId, UUID orgRoleId) {
        if ((templateRoleId == null) == (orgRoleId == null)) {
            throw new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "INVALID_ROLE", "Exactly one role reference is required.");
        }
        UUID roleId;
        if (templateRoleId != null) {
            Integer count = jdbc.queryForObject("""
                    SELECT count(*) FROM role_templates WHERE role_id = ?
                    """, Integer.class, templateRoleId);
            if (count == null || count != 1) throw notFound();
            roleId = templateRoleId;
        } else {
            customRole(organizationId, orgRoleId);
            roleId = orgRoleId;
        }
        return rolePermissionsForRole(roleId);
    }

    private List<String> rolePermissionsForRole(UUID roleId) {
        return jdbc.query("SELECT permission_key FROM role_permissions WHERE role_id = ? ORDER BY permission_key",
                (rs, rowNum) -> rs.getString("permission_key"), roleId);
    }

    private UUID memberInOrganization(UUID organizationId, UUID membershipId) {
        List<UUID> members = jdbc.query("""
                SELECT id FROM memberships WHERE org_id = ? AND id = ?
                """, (rs, rowNum) -> rs.getObject("id", UUID.class), organizationId, membershipId);
        if (members.isEmpty()) throw notFound();
        return members.get(0);
    }

    private GrantResponse findGrant(UUID organizationId, UUID grantId) {
        Map<String, Object> row = jdbc.queryForMap("""
                SELECT id, membership_id, template_role_id, org_role_id, scope, scope_id, expires_at, version
                FROM grants WHERE id = ? AND org_id = ?
                """, grantId, organizationId);
        return new GrantResponse(
                (UUID) row.get("id"), (UUID) row.get("membership_id"),
                (UUID) row.get("template_role_id"), (UUID) row.get("org_role_id"),
                (String) row.get("scope"), (UUID) row.get("scope_id"),
                (Instant) row.get("expires_at"), ((Number) row.get("version")).longValue());
    }

    private boolean grantExists(UUID organizationId, UUID grantId) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM grants WHERE id = ? AND org_id = ?",
                Integer.class, grantId, organizationId);
        return count != null && count > 0;
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "The requested resource was not found.");
    }

    private record RoleRow(UUID id, long version) {}

    public record RoleRequest(String name, List<String> permissionKeys, long expectedVersion) {}
    public record RoleResponse(UUID id, String name, boolean template, long version, List<String> permissionKeys) {}
    public record MemberResponse(UUID id, String displayName, String email, String status) {}
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
            String scope,
            UUID scopeId,
            Instant expiresAt,
            long version) {}
}
