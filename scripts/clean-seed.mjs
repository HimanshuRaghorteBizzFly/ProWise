import fs from "fs";
import path from "path";

const seedPath = path.resolve("C:/BizzFly_Project/ProWise/frontend/src/app/(platform)/super-admin/_data/seed.ts");
let content = fs.readFileSync(seedPath, "utf8");

// 1. Clear SEED_OPERATORS
content = content.replace(
  /export const SEED_OPERATORS: PlatformOperator\[\] = \[[\s\S]*?\n\];\n/,
  "export const SEED_OPERATORS: PlatformOperator[] = [];\n"
);

// 2. Clear SEED_ORGANIZATIONS, SEED_SUBSCRIPTIONS, SEED_PAYMENTS, SEED_INVOICES
content = content.replace(
  /export const SEED_ORGANIZATIONS: TenantOrganization\[\] = \[[\s\S]*?\nexport const SEED_SMTP_CONFIG/,
  `export const SEED_ORGANIZATIONS: TenantOrganization[] = [];
export const SEED_SUBSCRIPTIONS: Subscription[] = [];
export const SEED_PAYMENTS: PaymentTransaction[] = [];
export const SEED_INVOICES: Invoice[] = [];

export const SEED_SMTP_CONFIG`
);

// 3. Clear SEED_EMAIL_LOGS
content = content.replace(
  /export const SEED_EMAIL_LOGS: EmailDeliveryLog\[\] = \[[\s\S]*?\n\];\n/,
  "export const SEED_EMAIL_LOGS: EmailDeliveryLog[] = [];\n"
);

// 4. Clear SEED_ANNOUNCEMENTS and INITIAL_ACTIVITIES
content = content.replace(
  /export const SEED_ANNOUNCEMENTS: Announcement\[\] = \[[\s\S]*?\nexport const SEED_INTEGRATIONS/,
  `export const SEED_ANNOUNCEMENTS: Announcement[] = [];
export const INITIAL_ACTIVITIES: SuperAdminActivity[] = [];

export const SEED_INTEGRATIONS`
);

// 5. Clear SEED_GITHUB_INSTALLATIONS, SEED_WEBHOOK_EVENTS, SEED_API_ALERTS, SEED_SECURITY_ALERTS
content = content.replace(
  /export const SEED_GITHUB_INSTALLATIONS: GitHubInstallation\[\] = \[[\s\S]*?\nexport const SEED_SECURITY_POLICIES/,
  `export const SEED_GITHUB_INSTALLATIONS: GitHubInstallation[] = [];
export const SEED_WEBHOOK_EVENTS: WebhookEventRecord[] = [];
export const SEED_API_ALERTS: ApiAlertRule[] = [];
export const SEED_SECURITY_ALERTS: SecurityAlert[] = [];

export const SEED_SECURITY_POLICIES`
);

// 6. Clear SEED_ACCESS_APPROVALS and SEED_INCIDENTS
content = content.replace(
  /export const SEED_ACCESS_APPROVALS: AccessApprovalRequest\[\] = \[[\s\S]*?\nexport const SEED_POLICY_SETTINGS/,
  `export const SEED_ACCESS_APPROVALS: AccessApprovalRequest[] = [];
export const SEED_INCIDENTS: IncidentGovernanceItem[] = [];

export const SEED_POLICY_SETTINGS`
);

// 7. Clear SEED_SUPPORT_TICKETS
content = content.replace(
  /export const SEED_SUPPORT_TICKETS: SupportEscalationTicket\[\] = \[[\s\S]*?\n\/\/ Section 7: Super Admin Account Profile/,
  `export const SEED_SUPPORT_TICKETS: SupportEscalationTicket[] = [];

// Section 7: Super Admin Account Profile`
);

// 8. Update SEED_ACCOUNT_PROFILE and SEED_MANUAL_CALENDAR_EVENTS
content = content.replace(
  /export const SEED_ACCOUNT_PROFILE: SuperAdminAccountProfile = \{[\s\S]*$/,
  `export const SEED_ACCOUNT_PROFILE: SuperAdminAccountProfile = {
  name: "Super Admin",
  title: "Principal Super Administrator",
  email: "superadmin@prowise.com",
  timezone: "UTC",
  mfaEnabled: true,
  mfaMethod: "Authenticator App",
  passwordLastChangedAt: "2026-01-01T00:00:00Z",
  sessions: [
    {
      id: "sess-1",
      device: "Admin Console Workstation",
      browser: "Chrome",
      location: "Active Console",
      ipMasked: "127.0.0.1",
      lastActiveAt: new Date().toISOString(),
      isCurrent: true,
    },
  ],
  notifications: {
    securityAlerts: true,
    paymentFailures: true,
    accessApprovals: true,
    incidentEscalations: true,
    weeklyDigest: false,
  },
};

export const SEED_MANUAL_CALENDAR_EVENTS: AdminCalendarEvent[] = [];
`
);

fs.writeFileSync(seedPath, content, "utf8");
console.log("Successfully cleaned seed.ts without demo data.");
