export type ProjectMode = "INDIVIDUAL" | "STRUCTURED";

export type ProjectLifecycle =
  | "PLANNED"
  | "ACTIVE"
  | "ON_HOLD"
  | "DELIVERED"
  | "CLOSED"
  | "CANCELLED";

export type ProjectHealth = "ON_TRACK" | "AT_RISK" | "DELAYED" | "UNKNOWN";

export type ReportingCadence = "DAILY" | "WEEKLY" | "FORTNIGHTLY";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Project {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string;
  mode: ProjectMode;
  lifecycle: ProjectLifecycle;
  archived: boolean;
  priority: Priority;
  projectManagerId: string;
  accountableOwnerId: string;
  teamIds: string[];
  memberIds: string[];
  startDate: string;
  targetDate: string;
  timezone: string;
  cadence: ReportingCadence;
  graceWorkingDays: number;
  version: number;
  activeBaselineId?: string;
  lastProgressPercent: number;
  lastProgressMethod: "DEVELOPER_REPORTED" | "CALCULATED_BASELINE" | "NOT_REPORTED";
  lastReportedAt?: string;
  health: ProjectHealth;
  healthReasons: string[];
  temporaryHealthOverride?: {
    health: ProjectHealth;
    reason: string;
    authorId: string;
    expiresAt: string;
  };
  repositoryIds: string[];
  deliveryReviewRequested?: boolean;
  deliveryReviewRequestedAt?: string;
  deliveryAcceptedAt?: string;
  deliveryAcceptedBy?: string;
  closedAt?: string;
  closedBy?: string;
  closureReason?: string;
  createdAt: string;
}

export interface ScopeLeaf {
  workItemId: string;
  title: string;
  weight: number;
  isEligible: boolean;
  isDone: boolean;
}

export interface ScopeBaseline {
  id: string;
  projectId: string;
  version: number;
  reason: string;
  unit: string;
  approvedBy: string;
  approvedAt: string;
  totalWeight: number;
  leaves: ScopeLeaf[];
  supersededAt?: string;
}

export interface ProgressSnapshot {
  id: string;
  projectId: string;
  instant: string;
  method: "DEVELOPER_REPORTED" | "CALCULATED_BASELINE";
  value: number;
  isNotMeasurable?: boolean;
  isNotReported?: boolean;
  numerator?: number;
  denominator?: number;
  baselineId?: string;
  baselineVersion?: number;
  cause: string;
  isModeTransitionMarker?: boolean;
  transitionNote?: string;
}

export interface ModeTransition {
  id: string;
  projectId: string;
  actorId: string;
  fromMode: ProjectMode;
  toMode: ProjectMode;
  reason: string;
  approvedBaselineId?: string;
  timestamp: string;
}

