export type PermissionKey =
  | "orgs.view"
  | "orgs.create"
  | "orgs.edit"
  | "orgs.suspend"
  | "orgs.delete"
  | "operators.view"
  | "operators.manage"
  | "roles.manage"
  | "plans.manage"
  | "subscriptions.manage"
  | "payments.view"
  | "payments.refund"
  | "invoices.manage"
  | "integrations.manage"
  | "security.manage"
  | "smtp.configure"
  | "templates.manage"
  | "announcements.manage"
  | "config.manage"
  | "support.manage"
  | "audit.view"
  | "system.export";

export type PermissionCategory =
  | "Organizations"
  | "Operators & Access"
  | "Billing & Revenue"
  | "Integrations & Security"
  | "Communication"
  | "Platform & Audit";

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  category: PermissionCategory;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}

export interface AdminRole {
  id: string;
  name: string;
  slug: string;
  description: string;
  isSystem: boolean;
  color: "blue" | "emerald" | "violet" | "amber" | "slate";
  permissions: PermissionKey[];
  createdAt: string;
  updatedAt: string;
}

export type OrgStatus = "ACTIVE" | "TRIAL" | "SUSPENDED";

export interface TenantOrganization {
  id: string;
  name: string;
  slug: string;
  domain: string;
  industry: string;
  country: string;
  timezone: string;
  ownerName: string;
  ownerEmail: string;
  status: OrgStatus;
  planId: string;
  seatsUsed: number;
  seatsLimit: number;
  projectsCount: number;
  storageUsedGb: number;
  mrr: number;
  createdAt: string;
  lastActivityAt: string;
  suspendedReason?: string;
  notes?: string;
}

export type OperatorStatus = "ACTIVE" | "INACTIVE" | "INVITED";

export interface PlatformOperator {
  id: string;
  name: string;
  email: string;
  roleId: string;
  department: string;
  status: OperatorStatus;
  mfaEnabled: boolean;
  onCall: boolean;
  customPermissions?: PermissionKey[];
  lastActiveAt: string;
  createdAt: string;
}

export interface PlanLimits {
  maxSeats: number;
  maxProjects: number;
  maxWorkspaces: number;
  storageGb: number;
  apiRateLimitPerMin: number;
}

export type PlanBrandColor = "sky" | "blue" | "amber" | "violet" | "emerald" | "rose";

export interface BillingPlan {
  id: string;
  code: string;
  name: string;
  tagline: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: "USD";
  status: "ACTIVE" | "ARCHIVED";
  isPopular: boolean;
  badgeLabel?: string;
  brandColor?: PlanBrandColor;
  aiTokenQuota?: string;
  trialDays: number;
  limits: PlanLimits;
  features: string[];
  createdAt: string;
  updatedAt: string;
}

export type BillingCycle = "MONTHLY" | "ANNUAL";
export type SubscriptionStatus = "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELLED";

export interface Subscription {
  id: string;
  orgId: string;
  planId: string;
  billingCycle: BillingCycle;
  status: SubscriptionStatus;
  seats: number;
  amount: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  paymentMethodLabel: string;
  updatedAt: string;
}

export type PaymentStatus = "SUCCEEDED" | "PENDING" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
export type PaymentMethodType = "CARD" | "ACH" | "WIRE";

export interface PaymentTransaction {
  id: string;
  transactionRef: string;
  orgId: string;
  subscriptionId?: string;
  invoiceId?: string;
  amount: number;
  refundedAmount: number;
  currency: "USD";
  status: PaymentStatus;
  method: PaymentMethodType;
  methodLast4: string;
  gatewayLabel: string;
  description: string;
  failureReason?: string;
  refundReason?: string;
  createdAt: string;
}

export type InvoiceStatus = "PAID" | "OPEN" | "OVERDUE" | "VOID" | "REFUNDED";

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  orgId: string;
  subscriptionId?: string;
  paymentId?: string;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  lineItems: InvoiceLineItem[];
  notes?: string;
  paidAt?: string;
  createdAt: string;
}

export type SmtpProvider = "SMTP_CUSTOM" | "SENDGRID" | "AWS_SES" | "POSTMARK" | "MAILGUN";
export type SmtpEncryption = "TLS" | "SSL" | "NONE";

export interface SmtpConfig {
  provider: SmtpProvider;
  host: string;
  port: number;
  encryption: SmtpEncryption;
  username: string;
  hasPasswordConfigured: boolean;
  passwordLastRotatedAt: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  rateLimitPerMinute: number;
  retryAttempts: number;
  retryBackoffSeconds: number;
  trackOpens: boolean;
  trackClicks: boolean;
  sandboxMode: boolean;
  connectionStatus: "CONNECTED" | "UNTESTED" | "FAILED";
  lastTestedAt?: string;
  lastTestMessage?: string;
  updatedAt: string;
}

export interface EmailDeliveryLog {
  id: string;
  recipient: string;
  subject: string;
  templateKey?: string;
  source: "SMTP_TEST" | "TEMPLATE_TEST" | "INVOICE_REMINDER" | "ANNOUNCEMENT" | "SYSTEM";
  status: "DELIVERED_SIMULATED" | "FAILED_SIMULATED";
  provider: SmtpProvider;
  detail: string;
  sentAt: string;
}

export type EmailTemplateCategory = "AUTH" | "BILLING" | "DELIVERY" | "ALERTS" | "ANNOUNCEMENTS";

export type EmailBannerColor = "indigo" | "emerald" | "violet" | "amber" | "rose" | "sky" | "slate";

export interface EmailTemplate {
  id: string;
  key: string;
  code?: string;
  name: string;
  category: EmailTemplateCategory;
  triggerDescription?: string;
  headerBadge?: string;
  bannerColor?: EmailBannerColor;
  senderBrandName?: string;
  showHighlightBox?: boolean;
  footerNote?: string;
  openRate?: number;
  clickRate?: number;
  subject: string;
  headline: string;
  bodyParagraphs: string;
  ctaLabel: string;
  ctaUrl: string;
  variables: string[];
  status: "ACTIVE" | "DRAFT";
  updatedAt: string;
  updatedBy: string;
}

export type AnnouncementType = "INFO" | "MAINTENANCE" | "RELEASE" | "CRITICAL";
export type AnnouncementAudience = "ALL_ORGS" | "BY_PLAN" | "SPECIFIC_ORGS" | "OPERATORS_ONLY";
export type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: AnnouncementType;
  targetAudience: AnnouncementAudience;
  targetPlans: string[];
  targetOrgIds: string[];
  channels: ("IN_APP_BANNER" | "EMAIL_BROADCAST")[];
  status: AnnouncementStatus;
  scheduledFor?: string;
  expiresAt?: string;
  publishedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityCategory =
  | "ORGANIZATION"
  | "OPERATOR"
  | "ROLE"
  | "PLAN"
  | "SUBSCRIPTION"
  | "PAYMENT"
  | "INVOICE"
  | "INTEGRATION"
  | "SECURITY"
  | "COMMUNICATION"
  | "PLATFORM";

export interface SuperAdminActivity {
  id: string;
  category: ActivityCategory;
  action: string;
  summary: string;
  actorName: string;
  actorEmail: string;
  targetLabel?: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  timestamp: string;
}

// Integrations & API Governance
export interface PlatformIntegration {
  id: string;
  key: string;
  name: string;
  category: "Source Control" | "Billing Gateway" | "Email Delivery" | "Observability" | "Identity SSO";
  description: string;
  enabled: boolean;
  healthStatus: "Healthy" | "Degraded" | "Disabled";
  environment: "Simulated Sandbox" | "Production Ready";
  syncFrequencyMinutes: number;
  alertThresholdMs: number;
  autoRetryEnabled: boolean;
  credentialConfigured: boolean;
  credentialUpdatedAt: string;
  connectedOrgsCount: number;
  lastCheckedAt: string;
  lastTestSummary: string;
}

export interface GitHubInstallation {
  id: string;
  orgId: string;
  orgName: string;
  githubAccount: string;
  reposCount: number;
  syncStatus: "Healthy" | "Attention Needed" | "Paused";
  lastSyncedAt: string;
  rateLimitUsed: number;
  rateLimitMax: number;
  accessScope: string;
}

export interface WebhookEventRecord {
  id: string;
  eventRef: string;
  source: "GitHub" | "Billing" | "Email Relay";
  eventTitle: string;
  orgName: string;
  status: "Delivered" | "Retrying" | "Failed";
  httpCode: number;
  attempts: number;
  latencyMs: number;
  summary: string;
  receivedAt: string;
}

export interface ApiAlertRule {
  id: string;
  name: string;
  metric: "Error Rate (%)" | "p99 Latency (ms)" | "Requests per Minute";
  threshold: number;
  enabled: boolean;
  status: "Normal" | "Triggered";
  notifyEmail: string;
  updatedAt: string;
}

// Security & Governance
export interface SecurityAlert {
  id: string;
  title: string;
  description: string;
  severity: "High" | "Medium" | "Low";
  category: "Access Control" | "Authentication" | "Billing Risk" | "Integration";
  status: "Open" | "Investigating" | "Resolved";
  affectedTarget: string;
  detectedAt: string;
}

export interface SecurityPolicy {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  level: "Enforced" | "Advisory";
  updatedAt: string;
}

export interface AccessApprovalRequest {
  id: string;
  operatorName: string;
  operatorEmail: string;
  targetOrgId: string;
  targetOrgName: string;
  ticketRef: string;
  reason: string;
  requestedAt: string;
  expiresInHours: number;
  status: "PENDING" | "APPROVED" | "DENIED" | "REVOKED";
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface IncidentGovernanceItem {
  id: string;
  incidentCode: string;
  title: string;
  summary: string;
  severity: "Minor" | "Major" | "Critical";
  status: "Investigating" | "Identified" | "Monitoring" | "Resolved";
  ownerOperatorId: string;
  escalationLevel: "Tier 1 — Operator" | "Tier 2 — Engineering" | "Executive Escalation";
  affectedAreas: string[];
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// Platform Management
export interface PlatformFeatureFlag {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  audience: "All Tenants" | "Enterprise Only" | "Internal Operators";
}

export interface PlatformPolicySettings {
  checkinGraceWorkingDays: number;
  staleWebhookMinutes: number;
  auditRetentionDays: number;
  enforceMfaForOperators: boolean;
  autoSuspendAfterPastDueDays: number;
  defaultTrialDays: number;
  maxAttachmentMb: number;
  maintenanceBannerMode: boolean;
  featureFlags: PlatformFeatureFlag[];
  updatedAt: string;
}

export interface PlatformBrandingPreferences {
  platformName: string;
  supportEmail: string;
  statusPageUrl: string;
  defaultTimezone: string;
  defaultLanguage: string;
  dateFormat: "MMM DD, YYYY" | "YYYY-MM-DD" | "DD/MM/YYYY";
  currencyDisplay: "USD ($)" | "EUR (€)" | "GBP (£)";
  compactDensity: boolean;
  updatedAt: string;
}

export interface SupportEscalationTicket {
  id: string;
  ticketNumber: string;
  orgId: string;
  orgName: string;
  subject: string;
  description: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "In Progress" | "Escalated" | "Resolved";
  assignedOperatorId: string;
  slaTargetMinutes: number;
  slaState: "On Track" | "At Risk" | "Breached";
  requesterEmail: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// Super Admin Personal Account & Security
export interface AdminSessionRecord {
  id: string;
  device: string;
  browser: string;
  location: string;
  ipMasked: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface SuperAdminAccountProfile {
  name: string;
  title: string;
  email: string;
  timezone: string;
  mfaEnabled: boolean;
  mfaMethod: "Authenticator App" | "Hardware Security Key";
  passwordLastChangedAt: string;
  sessions: AdminSessionRecord[];
  notifications: {
    securityAlerts: boolean;
    paymentFailures: boolean;
    accessApprovals: boolean;
    incidentEscalations: boolean;
    weeklyDigest: boolean;
  };
}
