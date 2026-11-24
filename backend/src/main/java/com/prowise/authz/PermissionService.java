package com.prowise.authz;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import com.prowise.common.api.ApiException;
import com.prowise.identity.AuthPrincipal;

/**
 * Single permission decision point for every tenant access path (REST, search, jobs, downloads).
 *
 * Permission = authenticated identity + org-bound token for THIS organization + ACTIVE membership
 * + unexpired grant (ORG, or PROJECT matching the object's project) whose role holds the key.
 * Role names grant nothing: only role_permissions rows reached through a grant count.
 */
@Service("permissionService")
public class PermissionService {

    private final JdbcTemplate jdbc;
    private final SecurityEvidenceService evidence;

    public PermissionService(JdbcTemplate jdbc, SecurityEvidenceService evidence) {
        this.jdbc = jdbc;
        this.evidence = evidence;
    }

    /* ------------------------------------------------------------------
     * Entry points used by @PreAuthorize
     * ------------------------------------------------------------------ */

    /**
     * Path-organization check for {@code @PreAuthorize}. A foreign, unknown or not-selected organization
     * throws 404 (no metadata, evidence recorded); a member without the key gets {@code false} (403).
     */
    public boolean authorize(Authentication authentication, UUID organizationId, String permissionKey) {
        requireMembership(authentication, organizationId);
        return can(authentication, organizationId, permissionKey);
    }

    /** Membership-only check for {@code @PreAuthorize} on routes whose objects are checked in the service. */
    public boolean member(Authentication authentication, UUID organizationId) {
        requireMembership(authentication, organizationId);
        return true;
    }

    /** For routes without an org in the path: the token must be bound to an organization the caller is active in. */
    public boolean tokenOrgMember(Authentication authentication) {
        requireTokenOrganization(authentication);
        return true;
    }

    /* ------------------------------------------------------------------
     * Decisions
     * ------------------------------------------------------------------ */

    public boolean can(Authentication authentication, UUID organizationId, String permissionKey) {
        return can(authentication, organizationId, permissionKey, null);
    }

    public boolean can(
            Authentication authentication,
            UUID organizationId,
            String permissionKey,
            AuthorizationResource resource) {
        if (resource != null && organizationId != null && !organizationId.equals(resource.organizationId())) {
            return false;
        }
        String projectRef = resource == null || resource.projectId() == null ? null : resource.projectId().toString();
        return canOnProject(authentication, organizationId, projectRef, permissionKey);
    }

    /**
     * Project-aware decision. {@code projectRef} is the project's id as stored (UUID or legacy text id);
     * a PROJECT-scoped grant applies only when its scope id equals that project.
     */
    public boolean canOnProject(Authentication authentication, UUID organizationId, String projectRef, String permissionKey) {
        AuthPrincipal principal = principalOrNull(authentication);
        if (principal == null || principal.isOperator()) return false;
        if (!PermissionKey.isValid(permissionKey) || organizationId == null) return false;
        if (!organizationId.equals(principal.organizationId())) return false;
        Integer count = jdbc.queryForObject("""
                SELECT count(*)
                FROM grants g
                JOIN memberships m
                  ON m.id = g.membership_id AND m.org_id = g.org_id
                JOIN role_permissions rp
                  ON rp.role_id = COALESCE(g.template_role_id, g.org_role_id)
                JOIN roles r ON r.id = rp.role_id AND r.is_active
                WHERE g.org_id = ?
                  AND m.user_id = ?
                  AND m.status = 'ACTIVE'
                  AND rp.permission_key = ?
                  AND (g.expires_at IS NULL OR g.expires_at > now())
                  AND (g.scope = 'ORG' OR (g.scope = 'PROJECT' AND CAST(g.scope_id AS text) = ?))
                """, Integer.class, organizationId, principal.userId(), permissionKey, projectRef);
        return count != null && count > 0;
    }

    public void require(Authentication authentication, UUID organizationId, String permissionKey) {
        if (!can(authentication, organizationId, permissionKey)) {
            throw forbidden();
        }
    }

    /**
     * The caller must hold an org-bound token for {@code organizationId} and an ACTIVE membership there.
     * Anything else is indistinguishable from an unknown organization (404).
     */
    public UUID requireMembership(Authentication authentication, UUID organizationId) {
        AuthPrincipal principal = principal(authentication);
        if (principal.isOperator() || organizationId == null || !organizationId.equals(principal.organizationId())) {
            evidence.recordDenied(principal, SecurityEvidenceService.ACCESS_DENIED, "ORGANIZATION",
                    organizationId == null ? null : organizationId.toString(), "Organization is not the selected workspace");
            throw notFound();
        }
        UUID membershipId = activeMembershipId(principal.userId(), organizationId);
        if (membershipId == null) {
            throw notFound();
        }
        return membershipId;
    }

    /** Organization the token is bound to, after re-checking the membership. */
    public UUID requireTokenOrganization(Authentication authentication) {
        AuthPrincipal principal = principal(authentication);
        if (principal.isOperator() || principal.organizationId() == null) {
            throw notFound();
        }
        requireMembership(authentication, principal.organizationId());
        return principal.organizationId();
    }

    public AuthPrincipal principal(Authentication authentication) {
        AuthPrincipal principal = principalOrNull(authentication);
        if (principal == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication is required.");
        }
        return principal;
    }

    /* ------------------------------------------------------------------
     * Effective permissions (GET /v1/me/permissions)
     * ------------------------------------------------------------------ */

    public List<String> permissions(Authentication authentication, UUID organizationId) {
        return grants(authentication, organizationId).stream()
                .filter(grant -> "ORG".equals(grant.scope()))
                .map(EffectiveGrant::key)
                .distinct()
                .sorted()
                .toList();
    }

    public List<EffectiveGrant> grants(Authentication authentication, UUID organizationId) {
        UUID membershipId = requireMembership(authentication, organizationId);
        return jdbc.query("""
                SELECT DISTINCT rp.permission_key, g.scope, g.scope_id
                FROM grants g
                JOIN role_permissions rp ON rp.role_id = COALESCE(g.template_role_id, g.org_role_id)
                JOIN roles r ON r.id = rp.role_id AND r.is_active
                WHERE g.org_id = ? AND g.membership_id = ?
                  AND (g.expires_at IS NULL OR g.expires_at > now())
                ORDER BY rp.permission_key, g.scope, g.scope_id
                """, (rs, rowNum) -> new EffectiveGrant(
                        rs.getString("permission_key"), rs.getString("scope"), rs.getObject("scope_id", UUID.class)),
                organizationId, membershipId);
    }

    public boolean hasActiveMembership(UUID userId, UUID organizationId) {
        return activeMembershipId(userId, organizationId) != null;
    }

    private UUID activeMembershipId(UUID userId, UUID organizationId) {
        return jdbc.query("""
                SELECT id FROM memberships
                WHERE org_id = ? AND user_id = ? AND status = 'ACTIVE'
                """, rs -> rs.next() ? rs.getObject("id", UUID.class) : null, organizationId, userId);
    }

    private static AuthPrincipal principalOrNull(Authentication authentication) {
        return authentication != null && authentication.getPrincipal() instanceof AuthPrincipal principal ? principal : null;
    }

    public static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", "The requested resource was not found.");
    }

    public static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", "The requested action is not permitted.");
    }

    public record EffectiveGrant(String key, String scope, UUID scopeId) {}
}
