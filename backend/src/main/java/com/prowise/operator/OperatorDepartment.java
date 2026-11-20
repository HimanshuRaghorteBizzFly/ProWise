package com.prowise.operator;

import java.util.Arrays;
import java.util.List;

public enum OperatorDepartment {
    PLATFORM_OPERATIONS("platform-operations", "Platform Operations", List.of(
            "operations.dashboard",
            "operations.org_status",
            "operations.monitoring",
            "incidents.management",
            "system.alerts",
            "system.maintenance",
            "audit.activity_logs"
    )),
    SITE_RELIABILITY("site-reliability", "Site Reliability", List.of(
            "operations.monitoring",
            "integrations.health",
            "integrations.github",
            "integrations.webhooks",
            "integrations.failed_events",
            "integrations.sync_jobs",
            "integrations.api_errors",
            "system.backups",
            "incidents.management",
            "system.alerts"
    )),
    LIFECYCLE_MESSAGING("lifecycle-messaging", "Lifecycle Messaging", List.of(
            "communications.email_delivery",
            "communications.email_drafts",
            "communications.announcements",
            "system.alerts"
    )),
    CUSTOMER_COMMUNICATIONS("customer-communications", "Customer Communications", List.of(
            "support.tickets",
            "support.access_requests",
            "communications.announcements",
            "communications.email_delivery",
            "audit.activity_logs"
    )),
    FINANCE_TAX("finance-tax", "Finance & Tax", List.of(
            "billing.subscriptions",
            "billing.payment_failures",
            "billing.invoices",
            "incidents.management",
            "operations.dashboard"
    )),
    REVENUE_OPERATIONS("revenue-operations", "Revenue Operations", List.of(
            "billing.subscriptions",
            "billing.payment_failures",
            "billing.invoices",
            "operations.dashboard",
            "incidents.management"
    )),
    TRUST_COMPLIANCE("trust-compliance", "Trust & Compliance", List.of(
            "audit.activity_logs",
            "support.access_requests",
            "operations.monitoring",
            "system.alerts",
            "incidents.management"
    ));

    private final String id;
    private final String displayName;
    private final List<String> authorizedModules;

    OperatorDepartment(String id, String displayName, List<String> authorizedModules) {
        this.id = id;
        this.displayName = displayName;
        this.authorizedModules = authorizedModules;
    }

    public String getId() {
        return id;
    }

    public String getDisplayName() {
        return displayName;
    }

    public List<String> getAuthorizedModules() {
        return authorizedModules;
    }

    public static OperatorDepartment fromId(String id) {
        if (id == null) return PLATFORM_OPERATIONS;
        return Arrays.stream(values())
                .filter(d -> d.id.equalsIgnoreCase(id) || d.displayName.equalsIgnoreCase(id))
                .findFirst()
                .orElse(PLATFORM_OPERATIONS);
    }
}
