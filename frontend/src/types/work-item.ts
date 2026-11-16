import { Priority } from "./project";

export type WorkItemType = "MILESTONE" | "DELIVERABLE" | "TASK" | "SUBTASK";
export type WorkItemState = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

export interface Blocker {
  id: string;
  reason: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  ownerId: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface WorkItem {
  id: string;
  projectId: string;
  orgId: string;
  parentId?: string;
  type: WorkItemType;
  key: string;
  title: string;
  description: string;
  primaryAssigneeId?: string;
  reviewerId?: string;
  collaboratorIds: string[];
  state: WorkItemState;
  isBlocked: boolean;
  blockers: Blocker[];
  weight: number;
  weightUnit: string;
  criteria: string;
  criteriaVersion: number;
  currentRevision: number;
  submittedRevision?: number;
  dueDate?: string;
  criticality: Priority;
  version: number;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Dependency {
  id: string;
  projectId: string;
  predecessorId: string;
  successorId: string;
}

