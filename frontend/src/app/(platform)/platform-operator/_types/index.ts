export type ServiceHealthLevel = "Operational" | "Elevated" | "Degraded" | "Outage";

export interface OrgServiceHealth {
  id: string;
  orgName: string;
  slug: string;
  region: string;
  planName: string;
  status: ServiceHealthLevel;
  uptimePct: number;
  avgResponseMs: number;
  webhookDeliveryPct: number;
  openTickets: number;
  lastIncidentSummary?: string;
  lastCheckedAt: string;
}

export interface SystemServiceMetric {
  id: string;
  serviceName: string;
  category: "API & Compute" | "Database & Cache" | "Background Workers" | "Integrations";
  status: "Operational" | "Elevated" | "Degraded";
  cpuPct: number;
  memoryPct: number;
  latencyMs: number;
  uptime30d: string;
  queueDepth: number;
  dbConnectionsPct?: number;
  note: string;
  updatedAt: string;
}

export interface IncidentTimelineEntry {
  id: string;
  at: string;
  actor: string;
  note: string;
}

export interface OperatorIncident {
  id: string;
  code: string;
  title: string;
  summary: string;
  severity: "Minor" | "Major" | "Critical";
  priority: "Low" | "Medium" | "High" | "Urgent";
  status: "Open" | "Investigating" | "Identified" | "Monitoring" | "Resolved";
  assignedTo: string;
  affectedService: string;
  escalatedToSuperAdmin: boolean;
  linkedAlertId?: string;
  linkedTicketId?: string;
  resolutionNotes?: string;
  timeline: IncidentTimelineEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketComment {
  id: string;
  author: string;
  roleLabel: string;
  message: string;
  createdAt: string;
}

export interface OperatorTicket {
  id: string;
  ticketNumber: string;
  orgId: string;
  orgName: string;
  subject: string;
  description: string;
  category: "Integration" | "Workspace Access" | "Billing & Invoices" | "Performance" | "General";
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Open" | "In Progress" | "Waiting on Customer" | "Escalated" | "Resolved";
  assignee: string;
  requesterEmail: string;
  slaMinutesRemaining: number;
  slaState: "On Track" | "At Risk" | "Breached";
  linkedIncidentId?: string;
  comments: TicketComment[];
  createdAt: string;
  updatedAt: string;
}

export interface SupportAccessRequestItem {
  id: string;
  orgId: string;
  orgName: string;
  ticketRef: string;
  scope: "Read-Only Diagnostics" | "Billing & Sync Check" | "Workspace Troubleshooting";
  reason: string;
  durationHours: number;
  status: "Pending Approval" | "Approved" | "Denied" | "Expired" | "Revoked";
  requestedAt: string;
  reviewedBy?: string;
  expiresAt?: string;
}

export interface OperatorIntegrationItem {
  id: string;
  name: string;
  category: "Source Control" | "Billing & Payments" | "Email Relay" | "Identity SSO";
  status: "Healthy" | "Attention Needed" | "Paused";
  errorRatePct: number;
  avgLatencyMs: number;
  failureCount24h: number;
  lastDiagnosticSummary: string;
  lastCheckAt: string;
}

export interface GitHubAppInstallation {
  id: string;
  orgName: string;
  githubAccount: string;
  reposCount: number;
  syncState: "Synced" | "Delayed" | "Attention Needed" | "Paused";
  webhookHealth: "Healthy" | "Retrying" | "Degraded";
  rateLimitUsed: number;
  rateLimitMax: number;
  lastSyncedAt: string;
  lastErrorSummary?: string;
}

export interface WebhookDeliveryItem {
  id: string;
  referenceId: string;
  source: "GitHub" | "Billing" | "Email Relay";
  eventTitle: string;
  orgName: string;
  status: "Delivered" | "Retrying" | "Failed";
  httpStatus: number;
  attempts: number;
  latencyMs: number;
  friendlyReason: string;
  timestamp: string;
  syncedJobCode?: string;
}

export interface SyncJobItem {
  id: string;
  jobCode: string;
  name: string;
  queue: "Webhook Ingestion" | "GitHub Repo Sync" | "Invoice & Email Queue" | "Metrics Rollup";
  orgName: string;
  status: "Running" | "Queued" | "Completed" | "Paused" | "Failed";
  processedCount: number;
  totalCount: number;
  retries: number;
  lastRunAt: string;
  note: string;
}

export interface ApiEndpointMetric {
  id: string;
  endpointLabel: string;
  serviceArea: "Workspaces" | "GitHub Sync" | "Billing" | "Authentication" | "Reporting";
  requestsPerMin: number;
  errorRatePct: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  status: "Normal" | "Elevated" | "Degraded";
  topIssueSummary: string;
}

export interface EmailDeliveryRecord {
  id: string;
  messageRef: string;
  recipient: string;
  subject: string;
  channel: "Transactional" | "Billing Receipt" | "Alert Notice";
  status: "Delivered" | "Bounced" | "Deferred" | "Failed";
  bounceReason?: string;
  timestamp: string;
}

export interface SmtpHealthStatus {
  providerLabel: string;
  connectionState: "Healthy" | "Degraded";
  inboxPlacementPct: number;
  bounceRatePct: number;
  dailySent: number;
  dailyQuota: number;
  lastCheckedAt: string;
  checks: { label: string; passed: boolean; detail: string }[];
}

export interface EmailTemplateDraft {
  id: string;
  name: string;
  category: "Billing" | "Onboarding" | "Incident Notice" | "Reminders";
  subject: string;
  headline: string;
  bodyText: string;
  ctaLabel: string;
  status: "Draft" | "Submitted for Approval" | "Approved" | "Changes Requested";
  reviewerNote?: string;
  updatedAt: string;
}

export interface AnnouncementDraft {
  id: string;
  title: string;
  audience: "All Organizations" | "Enterprise Plans" | "Selected Tenants";
  type: "Maintenance" | "Product Update" | "Service Notice";
  message: string;
  proposedScheduleAt: string;
  status: "Draft" | "Submitted for Approval" | "Approved" | "Changes Requested";
  reviewerNote?: string;
  updatedAt: string;
}

export interface SubscriptionRecord {
  id: string;
  orgName: string;
  planName: string;
  billingCycle: "Monthly" | "Annual";
  status: "Active" | "Trial" | "Past Due" | "Suspended" | "Cancelled";
  renewalDate: string;
  seatsUsed: number;
  seatsLimit: number;
  supportNote: string;
}

export interface PaymentFailureItem {
  id: string;
  refCode: string;
  orgName: string;
  amountUsd: number;
  methodSummary: string;
  failureReason: string;
  retryCount: number;
  retryStatus:
    | "Scheduled"
    | "Retried — Succeeded"
    | "Retried — Failed"
    | "Escalated to Super Admin";
  escalatedAt?: string;
  failedAt: string;
}

export interface InvoiceDeliveryItem {
  id: string;
  invoiceNumber: string;
  orgName: string;
  recipientEmail: string;
  amountUsd: number;
  deliveryStatus: "Delivered" | "Pending" | "Bounced" | "Resend Requested";
  lastSentAt: string;
  failureNote?: string;
  resendCount: number;
}

export interface BackupSnapshot {
  id: string;
  snapshotCode: string;
  scope: "Primary Database" | "Workspace Attachments" | "Audit Archive";
  sizeGb: number;
  status: "Verified" | "In Progress" | "Failed";
  durationSec: number;
  region: string;
  retentionDays: number;
  restoreStatus: "None" | "Restore Requested";
  createdAt: string;
  note?: string;
}

export interface MaintenanceWindow {
  id: string;
  title: string;
  affectedArea: string;
  impactLevel: "No Downtime" | "Brief Slowdown" | "Planned Downtime";
  scheduledStart: string;
  durationMinutes: number;
  status: "Scheduled" | "In Progress" | "Completed" | "Cancelled";
  notifyCustomers: boolean;
  notes?: string;
}

export interface OperationalAlertRule {
  id: string;
  title: string;
  category: "System" | "API & Errors" | "Webhooks" | "Billing";
  severity: "Info" | "Warning" | "Critical";
  status: "Active" | "Acknowledged" | "Resolved";
  thresholdSummary: string;
  affectedTarget: string;
  triggeredAt: string;
  acknowledgedBy?: string;
  linkedIncidentId?: string;
}

export type OperatorLogCategory =
  | "Incident"
  | "Support"
  | "Integration"
  | "Communication"
  | "Billing"
  | "System"
  | "Account";

export interface OperatorActivityLog {
  id: string;
  category: OperatorLogCategory;
  action: string;
  summary: string;
  actorName: string;
  target?: string;
  severity: "Info" | "Warning" | "Critical";
  timestamp: string;
}

export interface OperatorAccountSettings {
  name: string;
  roleTitle: string;
  email: string;
  timezone: string;
  autoRefreshSeconds: 0 | 10 | 30 | 60;
  mfaEnabled: boolean;
  mfaMethod: "Authenticator App" | "Security Key";
  passwordUpdatedAt: string;
  compactTables: boolean;
  notifications: {
    criticalAlerts: boolean;
    incidentAssignments: boolean;
    webhookFailures: boolean;
    slaWarnings: boolean;
    approvalDecisions: boolean;
  };
}

