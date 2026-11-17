export type MaintenanceStatus =
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type MaintenanceScope = "PLATFORM_WIDE" | "ORGANIZATION_SPECIFIC";

export type MaintenanceImpactLevel = "No Downtime" | "Brief Slowdown" | "Planned Downtime";

export type MaintenanceServiceArea =
  | "Core Web API"
  | "Database & Storage"
  | "Webhook Delivery & Ingestion"
  | "GitHub Repository Sync"
  | "Authentication & Single Sign-On"
  | "Email Relay & Notifications"
  | "Billing & Payment Gateway"
  | "Background Worker Queues"
  | "Reporting & Telemetry";

export interface MaintenanceChecklistStep {
  id: string;
  label: string;
  completed: boolean;
  checkedAt?: string;
  checkedBy?: string;
}

export interface MaintenanceExecutionNote {
  id: string;
  author: string;
  role: "Platform Operator" | "Super Administrator" | "System";
  note: string;
  timestamp: string;
}

export interface MaintenanceAuditLog {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details?: string;
}

export interface MaintenanceWindowItem {
  id: string;
  trackingCode: string;
  title: string;
  reason: string;
  scope: MaintenanceScope;
  targetOrgId?: string;
  targetOrgName?: string;
  impactLevel: MaintenanceImpactLevel;
  affectedServices: MaintenanceServiceArea[];

  // Timing & Schedule
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  timezone: string;
  actualStart?: string;
  actualEnd?: string;

  // Status & Approvals
  status: MaintenanceStatus;
  isEmergency: boolean;
  emergencyOverrideBy?: string;

  // Requester & Approver
  requestedBy: string;
  requestedByEmail?: string;
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  cancellationReason?: string;

  // Customer Facing Notice & Restorations
  customerNoticeMessage: string;
  estimatedRestorationTime: string;
  notifyCustomers: boolean;
  bannerActive: boolean;

  // Execution & Progress
  progressPct: number;
  serviceRestorationChecks: MaintenanceChecklistStep[];
  executionNotes: MaintenanceExecutionNote[];
  completionReport?: {
    summary: string;
    verifiedBy: string;
    actualDowntimeMinutes: number;
    completedAt: string;
  };

  // Audit history
  auditLogs: MaintenanceAuditLog[];

  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceCustomerBanner {
  enabled: boolean;
  trackingCode: string;
  title: string;
  message: string;
  estimatedRestorationTime: string;
  scope: MaintenanceScope;
  targetOrgId?: string;
  targetOrgName?: string;
  affectedServices: MaintenanceServiceArea[];
  impactLevel: MaintenanceImpactLevel;
  isEmergency: boolean;
}
