// ==========================================
// PROWISE SAAS — DOMAIN TYPE DEFINITIONS
// Blueprint V1.1 (2 November 2026)
// ==========================================

export * from "./auth";
export * from "./organization";
export * from "./project";
export * from "./work-item";
export * from "./delivery";
export * from "./permission";
export * from "./api";

// ------------------------------------------
// Repositories & Engineering Activity (GitHub)
// ------------------------------------------
export interface Repository {
  id: string;
  orgId: string;
  name: string;
  owner: string;
  providerRepoId: string;
  installationId: string;
  defaultBranch: string;
  syncStatus: "SYNCED" | "SYNCING" | "FAILED" | "DISCONNECTED";
  lastSuccessfulSync?: string;
  lastFailureReason?: string;
  linkedProjectIds: string[];
}

export interface GitEvent {
  id: string;
  repositoryId: string;
  repoName: string;
  type: "PUSH" | "PULL_REQUEST" | "REVIEW" | "CHECK_RUN" | "DEPLOYMENT";
  actor: string;
  title: string;
  detail: string;
  sha?: string;
  prNumber?: number;
  branch?: string;
  status?: "SUCCESS" | "FAILURE" | "PENDING" | "MERGED" | "OPEN";
  linkedTaskKey?: string;
  timestamp: string;
}

// ------------------------------------------
// Notifications
// ------------------------------------------
export type NotificationCategory =
  | "ASSIGNMENT"
  | "CHECK_IN_DUE"
  | "REVIEW_REQUEST"
  | "REVIEW_DECISION"
  | "BLOCKER"
  | "HEALTH_CHANGE"
  | "DEADLINE_CHANGE"
  | "DELIVERY_ACCEPTANCE"
  | "SYSTEM";

export interface Notification {
  id: string;
  orgId: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  message: string;
  targetUrl: string;
  read: boolean;
  createdAt: string;
}

// ------------------------------------------
// Support & Platform Operations
// ------------------------------------------
export interface SupportTicket {
  id: string;
  orgId: string;
  orgName: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "IN_PROGRESS" | "WAITING" | "RESOLVED" | "CLOSED";
  assignedOperatorId?: string;
  creatorEmail: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformIncident {
  id: string;
  title: string;
  status: "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";
  severity: "MINOR" | "MAJOR" | "CRITICAL";
  affectedServices: string[];
  summary: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface WebhookLog {
  id: string;
  deliveryId: string;
  source: "GITHUB" | "STRIPE" | "SENDGRID";
  event: string;
  status: "DELIVERED" | "FAILED" | "RETRYING" | "QUARANTINED";
  statusCode: number;
  payloadSummary: string;
  receivedAt: string;
  attemptCount: number;
}

export interface AuditLogEntry {
  id: string;
  orgId?: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  timestamp: string;
}
