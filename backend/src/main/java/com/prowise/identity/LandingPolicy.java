package com.prowise.identity;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/**
 * Where a signed-in user lands, decided only from server data (pure Java, no Spring).
 *
 * <ul>
 *   <li>Platform dashboards only for real platform accounts ({@code users.role} SUPER_ADMIN or PLATFORM_OPERATOR).
 *       They are never a fallback.</li>
 *   <li>Everyone else lands by their ACTIVE memberships: none = "no workspace yet"; one = that workspace's dashboard
 *       for the membership's role template; several = the workspace picker (unless the session is already bound to
 *       one of them).</li>
 *   <li>The role template only picks the dashboard. Access on every page is still decided by the scoped permissions
 *       of the active membership (task 1.3); a role name grants nothing by itself.</li>
 * </ul>
 */
public final class LandingPolicy {

    public static final String NO_WORKSPACE = "/no-workspace";
    public static final String SELECT_WORKSPACE = "/select-workspace";
    public static final String CHANGE_PASSWORD = "/change-password";
    private static final Set<String> PLATFORM_ROLES = Set.of("SUPER_ADMIN", "PLATFORM_OPERATOR");

    private LandingPolicy() {}

    public enum Kind { PLATFORM, WORKSPACE, SELECT_WORKSPACE, NO_WORKSPACE }

    public record Membership(UUID orgId, String roleTemplate) {}

    /** organizationId is the one the session must be bound to (null for platform, picker and no-workspace). */
    public record Landing(Kind kind, UUID organizationId, String role, String targetUrl) {}

    public static boolean isPlatformRole(String userRole) {
        return userRole != null && PLATFORM_ROLES.contains(userRole.trim().toUpperCase(Locale.ROOT));
    }

    /**
     * @param userRole   the global users.role column (only SUPER_ADMIN / PLATFORM_OPERATOR mean anything here)
     * @param active     the user's ACTIVE memberships
     * @param boundOrgId the organization the session is already bound to, if any (signup, workspace switch)
     */
    public static Landing resolve(String userRole, List<Membership> active, UUID boundOrgId) {
        if (isPlatformRole(userRole)) {
            String role = userRole.trim().toUpperCase(Locale.ROOT);
            return new Landing(Kind.PLATFORM, null, role,
                    "SUPER_ADMIN".equals(role) ? "/super-admin/dashboard" : "/platform-operator/dashboard");
        }
        if (active == null || active.isEmpty()) {
            return new Landing(Kind.NO_WORKSPACE, null, null, NO_WORKSPACE);
        }
        if (boundOrgId != null) {
            for (Membership membership : active) {
                if (boundOrgId.equals(membership.orgId())) return workspace(membership);
            }
        }
        if (active.size() == 1) {
            return workspace(active.get(0));
        }
        return new Landing(Kind.SELECT_WORKSPACE, null, null, SELECT_WORKSPACE);
    }

    private static Landing workspace(Membership membership) {
        String template = membership.roleTemplate() == null ? "VIEWER" : membership.roleTemplate().trim().toUpperCase(Locale.ROOT);
        return new Landing(Kind.WORKSPACE, membership.orgId(), template, dashboardFor(template, membership.orgId()));
    }

    /** Tenant dashboard for a role template; unknown or custom templates use the read-only viewer dashboard. */
    public static String dashboardFor(String roleTemplate, UUID orgId) {
        String segment = switch (roleTemplate == null ? "" : roleTemplate.trim().toUpperCase(Locale.ROOT)) {
            case "ORGANIZATION_OWNER" -> "owner";
            case "ORGANIZATION_ADMIN" -> "admin";
            case "PROJECT_MANAGER" -> "manager";
            case "TEAM_LEAD" -> "lead";
            case "DEVELOPER" -> "developer";
            case "QA_REVIEWER" -> "reviewer";
            default -> "viewer";
        };
        return "/org/" + orgId + "/" + segment + "/dashboard";
    }
}
