package com.prowise.authz;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import com.prowise.common.api.ApiException;
import com.prowise.identity.AuthPrincipal;

@Service("permissionService")
public class PermissionService {

    private final JdbcTemplate jdbc;

    public PermissionService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public boolean can(Authentication authentication, UUID organizationId, String permissionKey) {
        return can(authentication, organizationId, permissionKey, null);
    }

    public boolean can(
            Authentication authentication,
            UUID organizationId,
            String permissionKey,
            AuthorizationResource resource) {
        Object principalValue = authentication == null ? null : authentication.getPrincipal();
        if (!(principalValue instanceof AuthPrincipal principal)) {
            return false;
        }
        if (!PermissionKey.isValid(permissionKey) || organizationId == null) {
            return false;
        }
        if (principal.organizationId() != null && !organizationId.equals(principal.organizationId())) {
            return false;
        }
        if (!hasActiveMembership(principal.userId(), organizationId)) {
            return false;
        }
        if (resource != null && !organizationId.equals(resource.organizationId())) {
            return false;
        }
        UUID projectId = resource == null ? null : resource.projectId();
        return jdbc.queryForObject("""
                SELECT count(*)
                FROM grants g
                JOIN role_permissions rp
                  ON rp.role_id = COALESCE(g.template_role_id, g.org_role_id)
                WHERE g.org_id = ?
                  AND g.membership_id = (
                      SELECT m.id FROM memberships m
                      WHERE m.id = g.membership_id AND m.org_id = ?
                        AND m.user_id = ? AND m.status = 'ACTIVE'
                  )
                  AND rp.permission_key = ?
                  AND (g.expires_at IS NULL OR g.expires_at > now())
                  AND (g.scope = 'ORG' OR (g.scope = 'PROJECT' AND g.scope_id = ?))
                """, Integer.class, organizationId, organizationId, principal.userId(), permissionKey, projectId) > 0;
    }

    public void require(Authentication authentication, UUID organizationId, String permissionKey) {
        if (!can(authentication, organizationId, permissionKey)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "The requested action is not permitted.");
        }
    }

    public UUID requireMembership(Authentication authentication, UUID organizationId) {
        AuthPrincipal principal = principal(authentication);
        if (principal.organizationId() != null && !organizationId.equals(principal.organizationId())) {
            throw notFound();
        }
        UUID membershipId = jdbc.query("""
                SELECT id FROM memberships
                WHERE org_id = ? AND user_id = ? AND status = 'ACTIVE'
                """, rs -> rs.next() ? rs.getObject("id", UUID.class) : null,
                organizationId, principal.userId());
        if (membershipId == null) {
            throw notFound();
        }
        return membershipId;
    }

    public AuthPrincipal principal(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthPrincipal principal)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication is required.");
        }
        return principal;
    }

    public List<String> permissions(Authentication authentication, UUID organizationId) {
        UUID membershipId = requireMembership(authentication, organizationId);
        return jdbc.query("""
                SELECT DISTINCT rp.permission_key
                FROM grants g
                JOIN role_permissions rp ON rp.role_id = COALESCE(g.template_role_id, g.org_role_id)
                WHERE g.org_id = ? AND g.membership_id = ?
                  AND (g.expires_at IS NULL OR g.expires_at > now())
                ORDER BY rp.permission_key
                """, (rs, rowNum) -> rs.getString("permission_key"), organizationId, membershipId);
    }

    public boolean hasActiveMembership(UUID userId, UUID organizationId) {
        Integer count = jdbc.queryForObject("""
                SELECT count(*) FROM memberships
                WHERE user_id = ? AND org_id = ? AND status = 'ACTIVE'
                """, Integer.class, userId, organizationId);
        return count != null && count == 1;
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "The requested resource was not found.");
    }
}
