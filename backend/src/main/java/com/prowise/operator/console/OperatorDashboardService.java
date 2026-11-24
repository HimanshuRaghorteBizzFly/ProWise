package com.prowise.operator.console;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.prowise.identity.AuthPrincipal;
import com.prowise.operator.OperatorDTOs;
import com.prowise.operator.OperatorDepartment;

/**
 * Real operator dashboard numbers, counted from the platform tables at request time. Nothing that cannot be
 * measured is reported: there is no uptime/latency probe, so the health score is always null.
 */
@Service
@Transactional(readOnly = true)
public class OperatorDashboardService {

    private final JdbcTemplate jdbc;

    public OperatorDashboardService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Raw counts (keys in snake_case). */
    public Map<String, Object> counts() {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("open_incidents", count("SELECT count(*) FROM incidents WHERE status <> 'RESOLVED'"));
        c.put("open_tickets", count("SELECT count(*) FROM support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER')"));
        c.put("pending_access_requests", count("SELECT count(*) FROM support_access_requests WHERE status = 'PENDING_APPROVAL'"));
        c.put("unacknowledged_alerts", count("SELECT count(*) FROM operational_alerts WHERE acknowledged = false"));
        c.put("failed_outbox_events", count("SELECT count(*) FROM outbox_event WHERE state = 'FAILED'"));
        c.put("failed_jobs", count("SELECT count(*) FROM background_jobs WHERE status = 'FAILED'"));
        c.put("retrying_webhooks", count("SELECT count(*) FROM webhook_receipts WHERE status = 'RETRYING'"));
        c.put("failed_email_deliveries_24h", count("SELECT count(*) FROM email_delivery_logs WHERE status IN ('FAILED', 'BOUNCED') "
                + "AND created_at > now() - interval '24 hours'"));
        c.put("accepted_email_deliveries_24h", count("SELECT count(*) FROM email_delivery_logs WHERE status = 'SMTP_ACCEPTED' "
                + "AND created_at > now() - interval '24 hours'"));
        c.put("active_maintenance_windows", count("SELECT count(*) FROM maintenance_windows WHERE status = 'IN_PROGRESS' "
                + "OR (status = 'SCHEDULED' AND scheduled_start <= now() AND scheduled_end > now())"));
        c.put("submitted_email_drafts", count("SELECT count(*) FROM operator_email_drafts WHERE status = 'SUBMITTED'"));
        c.put("pending_announcement_drafts", count("SELECT count(*) FROM announcements WHERE status = 'PENDING_REVIEW'"));
        c.put("active_subscriptions", count("SELECT count(*) FROM subscriptions WHERE status = 'ACTIVE'"));
        c.put("failed_payments", count("SELECT count(*) FROM payments WHERE status = 'FAILED'"));
        c.put("open_invoices", count("SELECT count(*) FROM invoices WHERE status IN ('OPEN', 'OVERDUE')"));
        c.put("api_server_errors_24h", count("SELECT count(*) FROM api_error_logs WHERE status >= 500 "
                + "AND occurred_at > now() - interval '24 hours'"));
        Map<String, Long> byState = new LinkedHashMap<>();
        for (String state : List.of("ACTIVE", "SUSPENDED", "ARCHIVED")) byState.put(state, 0L);
        jdbc.query("SELECT state, count(*) AS n FROM organizations GROUP BY state",
                rs -> { byState.put(rs.getString("state"), rs.getLong("n")); });
        c.put("organizations_by_state", byState);
        c.put("health_score", null);
        return c;
    }

    /** /v1/operator/dashboard/stats: existing camelCase keys kept for the console, all values real. */
    public Map<String, Object> stats() {
        Map<String, Object> c = counts();
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("openIncidents", c.get("open_incidents"));
        s.put("openTickets", c.get("open_tickets"));
        s.put("pendingWebhooks", c.get("retrying_webhooks"));
        s.put("failedJobs", c.get("failed_jobs"));
        s.put("unacknowledgedAlerts", c.get("unacknowledged_alerts"));
        s.put("pendingAccessRequests", c.get("pending_access_requests"));
        s.put("failedOutboxEvents", c.get("failed_outbox_events"));
        s.put("failedEmailDeliveries24h", c.get("failed_email_deliveries_24h"));
        s.put("activeMaintenanceWindows", c.get("active_maintenance_windows"));
        s.put("organizationsByState", c.get("organizations_by_state"));
        // Not measurable without an uptime/latency probe: reported as null, never invented.
        s.put("systemHealthScore", null);
        s.put("operationalStatus", null);
        return s;
    }

    /** /v1/operator/dashboard: department KPIs from the same real counts (the department is read from the token). */
    public OperatorDTOs.OperatorDashboardResponse summary(AuthPrincipal principal, boolean mainOperator) {
        Map<String, Object> c = counts();
        boolean global = mainOperator || OperatorPermissionGuard.isSuperAdmin(principal) || principal.departmentId() == null;
        OperatorDepartment dept = OperatorDepartment.fromId(principal.departmentId());
        @SuppressWarnings("unchecked")
        Map<String, Long> orgs = (Map<String, Long>) c.get("organizations_by_state");
        List<OperatorDTOs.DashboardMetric> kpis = new ArrayList<>();
        if (global) {
            kpis.add(metric("Open incidents", c, "open_incidents", "rose"));
            kpis.add(new OperatorDTOs.DashboardMetric("Active organizations", String.valueOf(orgs.get("ACTIVE")),
                    orgs.get("SUSPENDED") + " suspended", "blue"));
            kpis.add(metric("Unacknowledged alerts", c, "unacknowledged_alerts", "amber"));
            kpis.add(metric("Active maintenance windows", c, "active_maintenance_windows", "violet"));
            kpis.add(metric("Failed jobs", c, "failed_jobs", "rose"));
            kpis.add(metric("Failed outbox events", c, "failed_outbox_events", "rose"));
        } else {
            switch (dept) {
                case SITE_RELIABILITY -> {
                    kpis.add(metric("Open incidents", c, "open_incidents", "rose"));
                    kpis.add(metric("Failed jobs", c, "failed_jobs", "rose"));
                    kpis.add(metric("Failed outbox events", c, "failed_outbox_events", "rose"));
                    kpis.add(metric("API server errors (24h)", c, "api_server_errors_24h", "amber"));
                }
                case LIFECYCLE_MESSAGING -> {
                    kpis.add(metric("Failed email deliveries (24h)", c, "failed_email_deliveries_24h", "rose"));
                    kpis.add(metric("Accepted email deliveries (24h)", c, "accepted_email_deliveries_24h", "emerald"));
                    kpis.add(metric("Email drafts awaiting review", c, "submitted_email_drafts", "blue"));
                    kpis.add(metric("Unacknowledged alerts", c, "unacknowledged_alerts", "amber"));
                }
                case CUSTOMER_COMMUNICATIONS -> {
                    kpis.add(metric("Open tickets", c, "open_tickets", "amber"));
                    kpis.add(metric("Pending access requests", c, "pending_access_requests", "violet"));
                    kpis.add(metric("Announcements awaiting review", c, "pending_announcement_drafts", "blue"));
                    kpis.add(metric("Open incidents", c, "open_incidents", "rose"));
                }
                case FINANCE_TAX, REVENUE_OPERATIONS -> {
                    kpis.add(metric("Active subscriptions", c, "active_subscriptions", "blue"));
                    kpis.add(metric("Failed payments", c, "failed_payments", "rose"));
                    kpis.add(metric("Open invoices", c, "open_invoices", "amber"));
                    kpis.add(metric("Open incidents", c, "open_incidents", "rose"));
                }
                case TRUST_COMPLIANCE -> {
                    kpis.add(metric("Pending access requests", c, "pending_access_requests", "violet"));
                    kpis.add(metric("Unacknowledged alerts", c, "unacknowledged_alerts", "amber"));
                    kpis.add(new OperatorDTOs.DashboardMetric("Suspended organizations",
                            String.valueOf(orgs.get("SUSPENDED")), null, orgs.get("SUSPENDED") > 0 ? "amber" : "emerald"));
                    kpis.add(metric("Open incidents", c, "open_incidents", "rose"));
                }
                default -> {
                    kpis.add(metric("Open incidents", c, "open_incidents", "rose"));
                    kpis.add(new OperatorDTOs.DashboardMetric("Active organizations", String.valueOf(orgs.get("ACTIVE")),
                            orgs.get("SUSPENDED") + " suspended", "blue"));
                    kpis.add(metric("Unacknowledged alerts", c, "unacknowledged_alerts", "amber"));
                    kpis.add(metric("Active maintenance windows", c, "active_maintenance_windows", "violet"));
                }
            }
        }
        List<String> modules;
        if (global) {
            java.util.Set<String> all = new java.util.LinkedHashSet<>();
            for (OperatorDepartment d : OperatorDepartment.values()) all.addAll(d.getAuthorizedModules());
            modules = new ArrayList<>(all);
        } else {
            modules = dept.getAuthorizedModules();
        }
        return new OperatorDTOs.OperatorDashboardResponse(global ? "all" : dept.getId(),
                global ? "All Operational Departments" : dept.getDisplayName(), kpis, modules, c);
    }

    private static OperatorDTOs.DashboardMetric metric(String label, Map<String, Object> c, String key, String alertTone) {
        long value = ((Number) c.get(key)).longValue();
        return new OperatorDTOs.DashboardMetric(label, String.valueOf(value), null, value > 0 ? alertTone : "emerald");
    }

    private long count(String sql) {
        Long n = jdbc.queryForObject(sql, Long.class);
        return n == null ? 0 : n;
    }
}
