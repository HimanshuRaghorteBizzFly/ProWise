"use client";

import { PermissionOverrideItem, PlatformOperator } from "../../super-admin/_types";

export type OperatorDepartmentName =
  | "Platform Operations"
  | "Site Reliability"
  | "Lifecycle Messaging"
  | "Customer Communications"
  | "Finance & Tax"
  | "Revenue Operations"
  | "Trust & Compliance";

export const OPERATOR_DEPARTMENTS: OperatorDepartmentName[] = [
  "Platform Operations",
  "Site Reliability",
  "Lifecycle Messaging",
  "Customer Communications",
  "Finance & Tax",
  "Revenue Operations",
  "Trust & Compliance",
];

export interface ModulePermissionDef {
  key: string;
  name: string;
  category:
    | "Operations"
    | "Incidents & Support"
    | "Integrations"
    | "Communications"
    | "Billing Operations"
    | "System Operations"
    | "Account & Audit";
  route: string;
  actions: ("view" | "create" | "edit" | "delete" | "execute")[];
  description: string;
}

export const OPERATOR_MODULE_CATALOG: ModulePermissionDef[] = [
  // 1. Operations
  {
    key: "operations.dashboard",
    name: "Operations Dashboard",
    category: "Operations",
    route: "/platform-operator/dashboard",
    actions: ["view", "execute"],
    description: "Main operational telemetry and health overview",
  },
  {
    key: "operations.org_status",
    name: "Organization Service Status",
    category: "Operations",
    route: "/platform-operator/organization-status",
    actions: ["view", "edit"],
    description: "Multi-tenant workspace availability and status tracking",
  },
  {
    key: "operations.monitoring",
    name: "System Monitoring",
    category: "Operations",
    route: "/platform-operator/monitoring",
    actions: ["view", "execute"],
    description: "Cluster latency, resource utilization, and worker queue depths",
  },

  // 2. Incidents & Support
  {
    key: "incidents.management",
    name: "Incident Management",
    category: "Incidents & Support",
    route: "/platform-operator/incidents",
    actions: ["view", "create", "edit", "execute"],
    description: "Track Sev-1 through Sev-4 operational platform incidents",
  },
  {
    key: "support.tickets",
    name: "Support Tickets",
    category: "Incidents & Support",
    route: "/platform-operator/support-tickets",
    actions: ["view", "create", "edit", "execute"],
    description: "Escalated customer support tickets and SLA timers",
  },
  {
    key: "support.access_requests",
    name: "Support Access Requests",
    category: "Incidents & Support",
    route: "/platform-operator/access-requests",
    actions: ["view", "create", "edit", "execute"],
    description: "Temporary break-glass tenant support access authorizations",
  },

  // 3. Integrations
  {
    key: "integrations.health",
    name: "Integration Health",
    category: "Integrations",
    route: "/platform-operator/integration-health",
    actions: ["view", "execute"],
    description: "Live connectivity for GitHub, Stripe, and SMTP gateways",
  },
  {
    key: "integrations.github",
    name: "GitHub App Monitoring",
    category: "Integrations",
    route: "/platform-operator/github-monitoring",
    actions: ["view", "execute"],
    description: "Installed GitHub Apps, OAuth tokens, and rate limits",
  },
  {
    key: "integrations.webhooks",
    name: "Webhook Delivery Logs",
    category: "Integrations",
    route: "/platform-operator/webhook-logs",
    actions: ["view", "execute"],
    description: "Delivery attempts, HTTP payloads, and signature logs",
  },
  {
    key: "integrations.failed_events",
    name: "Failed Events & Retries",
    category: "Integrations",
    route: "/platform-operator/failed-events",
    actions: ["view", "execute"],
    description: "Dead-letter queues and automated idempotent retries",
  },
  {
    key: "integrations.sync_jobs",
    name: "Sync Jobs & Queues",
    category: "Integrations",
    route: "/platform-operator/sync-jobs",
    actions: ["view", "execute"],
    description: "Background worker queues and scheduled ingestion jobs",
  },
  {
    key: "integrations.api_errors",
    name: "API Error Monitoring",
    category: "Integrations",
    route: "/platform-operator/api-errors",
    actions: ["view", "execute"],
    description: "Endpoint 4xx/5xx burst monitors and latency percentiles",
  },

  // 4. Communications
  {
    key: "communications.email_delivery",
    name: "Email Delivery & SMTP Health",
    category: "Communications",
    route: "/platform-operator/email-delivery",
    actions: ["view", "execute"],
    description: "SendGrid & SES outbound transactional email monitoring",
  },
  {
    key: "communications.email_drafts",
    name: "Email Template Drafts",
    category: "Communications",
    route: "/platform-operator/email-drafts",
    actions: ["view", "create", "edit", "delete", "execute"],
    description: "Drafting and testing system notification templates",
  },
  {
    key: "communications.announcements",
    name: "Announcement Drafts",
    category: "Communications",
    route: "/platform-operator/announcement-drafts",
    actions: ["view", "create", "edit", "delete"],
    description: "Authoring platform broadcasts and maintenance notices",
  },

  // 5. Billing Operations
  {
    key: "billing.subscriptions",
    name: "Subscription Status",
    category: "Billing Operations",
    route: "/platform-operator/subscription-status",
    actions: ["view", "edit"],
    description: "Active tenant tiers, renewals, and grace periods",
  },
  {
    key: "billing.payment_failures",
    name: "Payment Failures",
    category: "Billing Operations",
    route: "/platform-operator/payment-failures",
    actions: ["view", "execute"],
    description: "Dunning queues, declined charges, and smart retry triggers",
  },
  {
    key: "billing.invoices",
    name: "Invoice Delivery",
    category: "Billing Operations",
    route: "/platform-operator/invoice-delivery",
    actions: ["view", "execute"],
    description: "Monthly PDF invoice delivery confirmation and receipts",
  },

  // 6. System Operations
  {
    key: "system.backups",
    name: "Backup Monitoring",
    category: "System Operations",
    route: "/platform-operator/backups",
    actions: ["view", "execute"],
    description: "PostgreSQL WAL archiving, daily snapshots, and RTO checks",
  },
  {
    key: "system.maintenance",
    name: "Maintenance Operations",
    category: "System Operations",
    route: "/platform-operator/maintenance",
    actions: ["view", "create", "edit", "execute"],
    description: "Live downtime banner coordination and window execution",
  },
  {
    key: "system.alerts",
    name: "Alerts & Notifications",
    category: "System Operations",
    route: "/platform-operator/alerts",
    actions: ["view", "edit", "execute"],
    description: "Operational metric alarm thresholds and notification routes",
  },

  // 7. Account & Audit
  {
    key: "audit.activity_logs",
    name: "Operational Activity Logs",
    category: "Account & Audit",
    route: "/platform-operator/activity-logs",
    actions: ["view"],
    description: "Chronological audit logs of operator interventions",
  },
  {
    key: "audit.security_monitoring",
    name: "Security Monitoring",
    category: "Account & Audit",
    route: "/platform-operator/monitoring",
    actions: ["view"],
    description: "MFA enforcement state and unauthorized sign-in attempts",
  },
  {
    key: "account.settings",
    name: "Operator Settings",
    category: "Account & Audit",
    route: "/platform-operator/settings",
    actions: ["view", "edit"],
    description: "Personal notification frequencies and session preferences",
  },
];

/**
 * Standard default module assignments for the 7 Operator Departments
 * as defined in Section 2 of requirements.
 */
export const DEPARTMENT_DEFAULT_MODULES: Record<OperatorDepartmentName, string[]> = {
  "Platform Operations": [
    "operations.dashboard",
    "operations.org_status",
    "operations.monitoring",
    "incidents.management",
    "system.alerts",
    "system.maintenance",
    "audit.activity_logs",
    "account.settings",
  ],
  "Site Reliability": [
    "operations.monitoring",
    "integrations.health",
    "integrations.github",
    "integrations.webhooks",
    "integrations.failed_events",
    "integrations.sync_jobs",
    "integrations.api_errors",
    "system.backups",
    "incidents.management",
    "system.alerts",
    "account.settings",
  ],
  "Lifecycle Messaging": [
    "communications.email_delivery",
    "communications.email_drafts",
    "communications.announcements",
    "system.alerts",
    "account.settings",
  ],
  "Customer Communications": [
    "support.tickets",
    "support.access_requests",
    "communications.announcements",
    "communications.email_delivery",
    "audit.activity_logs",
    "account.settings",
  ],
  "Finance & Tax": [
    "billing.subscriptions",
    "billing.payment_failures",
    "billing.invoices",
    "incidents.management",
    "operations.dashboard",
    "account.settings",
  ],
  "Revenue Operations": [
    "billing.subscriptions",
    "billing.payment_failures",
    "billing.invoices",
    "operations.dashboard",
    "incidents.management",
    "account.settings",
  ],
  "Trust & Compliance": [
    "audit.activity_logs",
    "support.access_requests",
    "audit.security_monitoring",
    "system.alerts",
    "incidents.management",
    "account.settings",
  ],
};

/**
 * Resolves effective permission for a specific module and action.
 * Precedence rule:
 * 1. Individual DENY -> Denied (overrides department defaults & role grants).
 * 2. Individual GRANT -> Allowed.
 * 3. Department Default -> Allowed.
 * 4. Otherwise -> Denied.
 */
export function resolveEffectivePermission(
  department: string,
  moduleKey: string,
  action: "view" | "create" | "edit" | "delete" | "execute",
  overrides: PermissionOverrideItem[] = []
): {
  allowed: boolean;
  state: "DEPARTMENT_DEFAULT" | "INDIVIDUAL_GRANT" | "INDIVIDUAL_DENY" | "NOT_ASSIGNED";
} {
  const normDept = normalizeDepartmentName(department);
  const deptModules = DEPARTMENT_DEFAULT_MODULES[normDept] || [];
  const isDeptDefault = deptModules.includes(moduleKey);

  const override = overrides.find(
    (o) => o.moduleKey === moduleKey && o.action === action
  );

  if (override?.type === "DENY") {
    return { allowed: false, state: "INDIVIDUAL_DENY" };
  }
  if (override?.type === "GRANT") {
    return { allowed: true, state: "INDIVIDUAL_GRANT" };
  }
  if (isDeptDefault) {
    return { allowed: true, state: "DEPARTMENT_DEFAULT" };
  }
  return { allowed: false, state: "NOT_ASSIGNED" };
}

/**
 * Checks whether an operator is permitted to navigate to a given route.
 */
export function isRouteAuthorized(
  operator: Partial<PlatformOperator> | null | undefined,
  pathname: string
): boolean {
  if (!operator) return false;
  // Super Admin and Main Platform Operator have global operational access across all 7 departments
  if (
    operator.roleId === "role-super-admin" ||
    operator.department === "Platform Governance" ||
    operator.accessLevel === "MAIN_PLATFORM_OPERATOR"
  ) {
    return true;
  }

  const cleanPath = pathname.split("?")[0].replace(/\/$/, "");

  // Dashboard root is accessible to anyone whose department permits dashboard, or SRE default
  if (cleanPath === "/platform-operator" || cleanPath === "/platform-operator/dashboard") {
    const res = resolveEffectivePermission(
      operator.department || "Site Reliability",
      "operations.dashboard",
      "view",
      operator.permissionOverrides || []
    );
    // If not explicitly granted, check if any modules in their department exist
    if (res.allowed) return true;
    // Every operator has access to their personalized dashboard view
    return true;
  }

  // Find module matching route
  const targetModule = OPERATOR_MODULE_CATALOG.find((m) => {
    const modRoute = m.route.replace(/\/$/, "");
    return cleanPath === modRoute || cleanPath.startsWith(modRoute + "/");
  });

  if (!targetModule) {
    // Unmapped routes default to settings or activity logs
    return true;
  }

  const perm = resolveEffectivePermission(
    operator.department || "Site Reliability",
    targetModule.key,
    "view",
    operator.permissionOverrides || []
  );

  return perm.allowed;
}

export function normalizeDepartmentName(dept?: string): OperatorDepartmentName {
  if (!dept) return "Site Reliability";
  const lower = dept.toLowerCase().trim();
  if (lower.includes("site") || lower.includes("reliability") || lower.includes("sre")) {
    return "Site Reliability";
  }
  if (lower.includes("message") || lower.includes("messaging") || lower.includes("lifecycle")) {
    return "Lifecycle Messaging";
  }
  if (lower.includes("customer") || lower.includes("support") || lower.includes("communication")) {
    return "Customer Communications";
  }
  if (lower.includes("finance") || lower.includes("tax")) {
    return "Finance & Tax";
  }
  if (lower.includes("revenue") || lower.includes("revops")) {
    return "Revenue Operations";
  }
  if (lower.includes("trust") || lower.includes("compliance") || lower.includes("governance")) {
    return "Trust & Compliance";
  }
  return "Platform Operations";
}
