package com.prowise.operator.console;

import java.util.UUID;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.identity.AuthPrincipal;
import com.prowise.superadmin.audit.AuditService;

/**
 * Audit rows for operator console changes, written inside the caller's transaction (MANDATORY): the operator
 * activity log (shown on the Activity Logs page) and the platform admin audit log (shown to the Super Admin).
 * These records are platform-level, not tenant data, so there is no organization outbox event
 * ({@code outbox_event.org_id} is required); nothing consumes these changes asynchronously.
 */
@Component
public class ConsoleAudit {

    private final JdbcTemplate jdbc;
    private final AuditService auditService;

    public ConsoleAudit(JdbcTemplate jdbc, AuditService auditService) {
        this.jdbc = jdbc;
        this.auditService = auditService;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(AuthPrincipal actor, String category, String action, String resourceType, String resourceId, String summary,
            String ipAddress) {
        String department = actor.isOperator() ? actor.departmentId() : null;
        jdbc.update("""
                INSERT INTO operator_activity_logs (id, operator_id, department_id, action, resource_type, resource_id,
                                                    details, ip_address, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, now())
                """, UUID.randomUUID(), truncate(OperatorPermissionGuard.actorId(actor), 64), truncate(department, 64),
                truncate(action, 100), truncate(resourceType, 60), truncate(resourceId, 100), summary, truncate(ipAddress, 45));
        String actorName = actor.isOperator() ? "Platform Operator" : "Super Admin";
        auditService.logActivity(category, action, summary, actorName,
                actor.email() == null ? OperatorPermissionGuard.actorId(actor) : actor.email(), truncate(resourceId, 200), "INFO");
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
