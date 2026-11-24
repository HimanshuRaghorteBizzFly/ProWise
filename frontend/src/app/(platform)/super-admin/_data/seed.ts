import {
  AccessApprovalRequest,
  AdminCalendarEvent,
  AdminRole,
  Announcement,
  ApiAlertRule,
  BillingPlan,
  EmailDeliveryLog,
  EmailTemplate,
  GitHubInstallation,
  IncidentGovernanceItem,
  Invoice,
  PaymentTransaction,
  PermissionDefinition,
  PermissionKey,
  PlatformBrandingPreferences,
  PlatformIntegration,
  PlatformOperator,
  PlatformPolicySettings,
  SecurityAlert,
  SecurityPolicy,
  SmtpConfig,
  Subscription,
  SuperAdminAccountProfile,
  SuperAdminActivity,
  SupportEscalationTicket,
  TenantOrganization,
  WebhookEventRecord,
} from "../_types";

import { DEFAULT_NINE_ROLES } from "../_services/permission-matrix";

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  {
    key: "orgs.view",
    label: "View Organizations",
    description: "Inspect tenant directories, usage limits, and account status.",
    category: "Organizations",
    riskLevel: "LOW",
  },
  {
    key: "orgs.create",
    label: "Provision Organizations",
    description: "Create new isolated tenant workspaces and initial owners.",
    category: "Organizations",
    riskLevel: "MEDIUM",
  },
  {
    key: "orgs.edit",
    label: "Edit Organizations",
    description: "Update tenant domain, timezone, seat limits, and notes.",
    category: "Organizations",
    riskLevel: "MEDIUM",
  },
  {
    key: "orgs.suspend",
    label: "Suspend / Reactivate Orgs",
    description: "Freeze or restore workspace access for compliance or billing.",
    category: "Organizations",
    riskLevel: "HIGH",
  },
  {
    key: "orgs.delete",
    label: "Delete Organizations",
    description: "Permanently decommission tenant records and subscriptions.",
    category: "Organizations",
    riskLevel: "HIGH",
  },
  {
    key: "operators.view",
    label: "View Platform Operators",
    description: "Read operator roster, MFA status, and on-call schedule.",
    category: "Operators & Access",
    riskLevel: "LOW",
  },
  {
    key: "operators.manage",
    label: "Manage Platform Operators",
    description: "Invite, edit, assign roles, activate, or deactivate operators.",
    category: "Operators & Access",
    riskLevel: "HIGH",
  },
  {
    key: "roles.manage",
    label: "Manage Roles & Permissions",
    description: "Create custom admin roles and customize access rules.",
    category: "Operators & Access",
    riskLevel: "HIGH",
  },
  {
    key: "plans.manage",
    label: "Manage Billing Plans",
    description: "Create, modify, archive, or delete commercial pricing tiers.",
    category: "Billing & Revenue",
    riskLevel: "HIGH",
  },
  {
    key: "subscriptions.manage",
    label: "Manage Subscriptions",
    description: "Assign plans, process upgrades/downgrades, renew, or cancel.",
    category: "Billing & Revenue",
    riskLevel: "MEDIUM",
  },
  {
    key: "payments.view",
    label: "View Transactions & Revenue",
    description: "Inspect payment logs, failure reasons, and revenue analytics.",
    category: "Billing & Revenue",
    riskLevel: "LOW",
  },
  {
    key: "payments.refund",
    label: "Issue Refunds & Retry Charges",
    description: "Execute simulated refunds and payment retry operations.",
    category: "Billing & Revenue",
    riskLevel: "HIGH",
  },
  {
    key: "invoices.manage",
    label: "Generate & Manage Invoices",
    description: "Create invoices, download PDFs, mark paid, or void receipts.",
    category: "Billing & Revenue",
    riskLevel: "MEDIUM",
  },
  {
    key: "integrations.manage",
    label: "Manage Integrations & API",
    description: "Govern GitHub App connections, webhook retries, and API alerts.",
    category: "Integrations & Security",
    riskLevel: "HIGH",
  },
  {
    key: "security.manage",
    label: "Security & Access Approvals",
    description: "Approve break-glass access, govern incidents, and revoke sessions.",
    category: "Integrations & Security",
    riskLevel: "HIGH",
  },
  {
    key: "smtp.configure",
    label: "Configure Email Gateway",
    description: "Manage outbound mail server settings, sender domains, and limits.",
    category: "Communication",
    riskLevel: "HIGH",
  },
  {
    key: "templates.manage",
    label: "Manage Email Templates",
    description: "Create, edit, preview, and test transactional templates.",
    category: "Communication",
    riskLevel: "MEDIUM",
  },
  {
    key: "announcements.manage",
    label: "Manage Announcements",
    description: "Schedule, publish, and unpublish platform-wide broadcasts.",
    category: "Communication",
    riskLevel: "MEDIUM",
  },
  {
    key: "config.manage",
    label: "Platform Configuration & Branding",
    description: "Update global feature flags, system limits, and branding.",
    category: "Platform & Audit",
    riskLevel: "HIGH",
  },
  {
    key: "support.manage",
    label: "Support Escalation Oversight",
    description: "Assign escalated tickets, track SLAs, and resolve issues.",
    category: "Platform & Audit",
    riskLevel: "MEDIUM",
  },
  {
    key: "audit.view",
    label: "View Audit Trail",
    description: "Inspect administrative activity and security governance logs.",
    category: "Platform & Audit",
    riskLevel: "LOW",
  },
  {
    key: "system.export",
    label: "Export Platform Reports",
    description: "Download CSV datasets and PDF financial receipts.",
    category: "Platform & Audit",
    riskLevel: "LOW",
  },
];

export const ALL_PERMISSION_KEYS: PermissionKey[] = PERMISSION_CATALOG.map((p) => p.key);

export const SEED_ROLES: AdminRole[] = DEFAULT_NINE_ROLES;

export const SEED_OPERATORS: PlatformOperator[] = [];

export const SEED_PLANS: BillingPlan[] = [];

export const SEED_ORGANIZATIONS: TenantOrganization[] = [];
export const SEED_SUBSCRIPTIONS: Subscription[] = [];
export const SEED_PAYMENTS: PaymentTransaction[] = [];
export const SEED_INVOICES: Invoice[] = [];

/** Placeholder until the live SMTP settings load from /v1/admin/smtp/settings; claims nothing is configured. */
export const SEED_SMTP_CONFIG: SmtpConfig = {
  provider: "SMTP_CUSTOM",
  host: "",
  port: 587,
  encryption: "TLS",
  username: "",
  hasPasswordConfigured: false,
  passwordLastRotatedAt: "",
  fromName: "",
  fromEmail: "",
  replyToEmail: "",
  rateLimitPerMinute: 0,
  retryAttempts: 0,
  retryBackoffSeconds: 0,
  trackOpens: false,
  trackClicks: false,
  sandboxMode: false,
  connectionStatus: "UNTESTED",
  lastTestedAt: "",
  lastTestMessage: "",
  updatedAt: "",
};

export const SEED_EMAIL_LOGS: EmailDeliveryLog[] = [];

export const SEED_EMAIL_TEMPLATES: EmailTemplate[] = [];

export const SEED_ANNOUNCEMENTS: Announcement[] = [];
export const INITIAL_ACTIVITIES: SuperAdminActivity[] = [];

export const SEED_INTEGRATIONS: PlatformIntegration[] = [];

export const SEED_GITHUB_INSTALLATIONS: GitHubInstallation[] = [];
export const SEED_WEBHOOK_EVENTS: WebhookEventRecord[] = [];
export const SEED_API_ALERTS: ApiAlertRule[] = [];
export const SEED_SECURITY_ALERTS: SecurityAlert[] = [];

export const SEED_SECURITY_POLICIES: SecurityPolicy[] = [];

export const SEED_ACCESS_APPROVALS: AccessApprovalRequest[] = [];
export const SEED_INCIDENTS: IncidentGovernanceItem[] = [];

export const SEED_POLICY_SETTINGS: PlatformPolicySettings = {
  checkinGraceWorkingDays: 1,
  staleWebhookMinutes: 15,
  auditRetentionDays: 365,
  enforceMfaForOperators: true,
  autoSuspendAfterPastDueDays: 30,
  defaultTrialDays: 14,
  maxAttachmentMb: 50,
  maintenanceBannerMode: false,
  featureFlags: [],
  updatedAt: "2026-11-01T00:00:00Z",
};

export const SEED_BRANDING_PREFS: PlatformBrandingPreferences = {
  platformName: "ProWise",
  supportEmail: "",
  statusPageUrl: "",
  defaultTimezone: "UTC",
  defaultLanguage: "English (US)",
  dateFormat: "MMM DD, YYYY",
  currencyDisplay: "USD ($)",
  compactDensity: true,
  updatedAt: "2026-11-01T00:00:00Z",
};

export const SEED_SUPPORT_TICKETS: SupportEscalationTicket[] = [];

/** Empty profile; the account page reads the signed-in identity from /v1/me. */
export const SEED_ACCOUNT_PROFILE: SuperAdminAccountProfile = {
  name: "",
  title: "",
  email: "",
  timezone: "UTC",
  mfaEnabled: false,
  mfaMethod: "Authenticator App",
  passwordLastChangedAt: "",
  sessions: [],
  notifications: {
    securityAlerts: false,
    paymentFailures: false,
    accessApprovals: false,
    incidentEscalations: false,
    weeklyDigest: false,
  },
};

export const SEED_MANUAL_CALENDAR_EVENTS: AdminCalendarEvent[] = [];
