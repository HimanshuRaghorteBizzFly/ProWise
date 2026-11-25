package com.prowise.operator.console;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import com.prowise.common.api.ApiException;
import com.prowise.common.api.ErrorCodes;
import com.prowise.identity.AuthPrincipal;

/**
 * Server-side permission check for the operator console endpoints, using the department model of V5:
 * an individual DENY override wins, then an individual GRANT, then Main Platform Operator (all modules),
 * then the department default rows in {@code operator_department_permissions}. A Super Admin user session
 * is always allowed. The operator row is read fresh on every call, so a changed department, access level
 * or override applies to the next request (the token's department claim is not trusted for this).
 */
@Component
public class OperatorPermissionGuard {

    private final JdbcTemplate jdbc;

    public OperatorPermissionGuard(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Throws 403 FORBIDDEN unless the caller holds {@code moduleKey:action}. */
    public void require(AuthPrincipal principal, String moduleKey, String action) {
        if (!allows(principal, moduleKey, action)) {
            throw new ApiException(HttpStatus.FORBIDDEN, ErrorCodes.FORBIDDEN,
                    "You do not have the " + moduleKey + ":" + action + " permission.");
        }
    }

    public boolean allows(AuthPrincipal principal, String moduleKey, String action) {
        if (principal == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED, "Authentication is required.");
        }
        if (!principal.isOperator()) {
            return isSuperAdmin(principal);
        }
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT o.access_level,
                       (SELECT ov.override_type FROM operator_permission_overrides ov
                         WHERE ov.operator_id = o.id AND ov.module_key = ? AND ov.permission_action = ?) AS override_type,
                       EXISTS (SELECT 1 FROM operator_department_permissions dp
                                WHERE dp.department_id = o.department_id AND dp.module_key = ? AND dp.permission_action = ?)
                           AS department_default
                  FROM platform_operators o
                 WHERE o.id = ? AND o.status = 'ACTIVE'
                """, moduleKey, action, moduleKey, action, principal.operatorId());
        if (rows.isEmpty()) {
            return false;
        }
        Map<String, Object> row = rows.get(0);
        String override = (String) row.get("override_type");
        if ("DENY".equalsIgnoreCase(override)) {
            return false;
        }
        if ("GRANT".equalsIgnoreCase(override)) {
            return true;
        }
        if ("MAIN_PLATFORM_OPERATOR".equalsIgnoreCase((String) row.get("access_level"))) {
            return true;
        }
        return Boolean.TRUE.equals(row.get("department_default"));
    }

    /** A Super Admin user session (never an operator token). */
    public static boolean isSuperAdmin(AuthPrincipal principal) {
        return principal != null && !principal.isOperator() && principal.role() != null
                && "SUPER_ADMIN".equalsIgnoreCase(principal.role().trim().replace('-', '_'));
    }

    /** Main Platform Operator by the stored access level (not the token claim). */
    public boolean isMainOperator(AuthPrincipal principal) {
        if (principal == null || !principal.isOperator()) {
            return false;
        }
        List<String> levels = jdbc.queryForList("SELECT access_level FROM platform_operators WHERE id = ?",
                String.class, principal.operatorId());
        return !levels.isEmpty() && "MAIN_PLATFORM_OPERATOR".equalsIgnoreCase(levels.get(0));
    }

    /** Stable actor id for audit rows: the operator id, or "super-admin:&lt;user id&gt;". */
    public static String actorId(AuthPrincipal principal) {
        if (principal.isOperator()) {
            return principal.operatorId();
        }
        return "super-admin:" + principal.userId();
    }

    public static String actorType(AuthPrincipal principal) {
        return principal.isOperator() ? "OPERATOR" : "SUPER_ADMIN";
    }
}
