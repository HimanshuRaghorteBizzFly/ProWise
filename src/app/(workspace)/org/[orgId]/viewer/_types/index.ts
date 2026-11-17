import { ProjectMode, ProjectLifecycle, ProjectHealth, Priority, WorkItemState } from "@/types";

export interface ViewerProject {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string;
  mode: ProjectMode;
  lifecycle: ProjectLifecycle;
  priority: Priority;
  projectManagerId: string;
  projectManagerName: string;
  accountableOwnerId: string;
  accountableOwnerName: string;
  teamIds: string[];
  teamNames: string[];
  memberCount: number;
  startDate: string;
  targetDate: string;
  timezone: string;
  cadence: "WEEKLY" | "BI_WEEKLY" | "MONTHLY";
  lastProgressPercent: number;
  lastProgressMethod: string;
  lastReportedAt: string;
  health: ProjectHealth;
  healthReasons: string[];
  repositoryIds: string[];
  repositoryNames: string[];
  activeMilestoneTitle?: string;
  activeBaselineTotalWeight?: number;
  acceptedWeight?: number;
  archived: boolean;
}

export interface ViewerTask {
  id: string;
  orgId: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  parentId?: string;
  parentTitle?: string;
  type: "TASK" | "MILESTONE" | "DELIVERABLE";
  key: string;
  title: string;
  description: string;
  primaryAssignee: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  reviewer?: {
    id: string;
    name: string;
    email: string;
  };
  state: WorkItemState;
  priority: Priority;
  weight: number;
  weightUnit: string;
  criteria: string;
  dueDate: string;
  dependencies: {
    id: string;
    key: string;
    title: string;
    state: WorkItemState;
  }[];
  blockers: string[];
  isBlocked: boolean;
  completionPercent: number;
  currentRevision: number;
  updatedAt: string;
}

export interface ViewerMilestone {
  id: string;
  orgId: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  key: string;
  title: string;
  description: string;
  state: WorkItemState;
  dueDate: string;
  totalPoints: number;
  completedPoints: number;
  tasksCount: number;
  completedTasksCount: number;
  criteria: string;
}

export interface ViewerMember {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  teamId?: string;
  teamName: string;
  directLeadName?: string;
  avatar: string;
  assignedProjects: {
    id: string;
    key: string;
    name: string;
  }[];
  status: "ACTIVE" | "INVITED" | "SUSPENDED";
  joinedAt: string;
}

export interface ViewerCalendarEvent {
  id: string;
  orgId: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  title: string;
  description: string;
  date: string;
  type: "MILESTONE" | "DEADLINE" | "SPRINT_CUTOFF" | "REVIEW_WINDOW" | "HOLIDAY";
  status: "UPCOMING" | "PAST_DUE" | "COMPLETED";
  daysRemaining: number;
}

export interface ViewerFileItem {
  id: string;
  orgId: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  name: string;
  description: string;
  category: "SPEC" | "EVIDENCE" | "CODE_CONTRACT" | "CHECKLIST" | "AUDIT_REPORT";
  format: "markdown" | "json" | "pdf" | "diff";
  size: string;
  updatedAt: string;
  author: string;
  isRestricted: boolean;
  permittedDownload: boolean;
  previewContent: string;
  externalUrl?: string;
}

export interface ViewerActivityItem {
  id: string;
  orgId: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  type: "COMMIT" | "CHECKIN" | "REVIEW" | "MILESTONE" | "DELIVERY" | "SCOPE_CHANGE";
  title: string;
  summary: string;
  actor: string;
  actorEmail?: string;
  timestamp: string;
  commitHash?: string;
  referenceUrl?: string;
  badgeText?: string;
}

export interface ViewerNotificationItem {
  id: string;
  orgId: string;
  title: string;
  message: string;
  category: "MILESTONE" | "HEALTH_ALERT" | "DIGEST" | "DELIVERY" | "GOVERNANCE";
  read: boolean;
  timestamp: string;
  link?: string;
}

export interface ViewerUserSettings {
  displayName: string;
  email: string;
  timezone: string;
  dateFormat: string;
  emailDigests: "DAILY" | "WEEKLY" | "OFF";
  notifyOnMilestones: boolean;
  notifyOnHealthChange: boolean;
  notifyOnReports: boolean;
  theme: "light" | "dark" | "system";
}

export interface ViewerFilterState {
  search: string;
  projectId: string;
  status: string;
  priority: string;
  mode: string;
}
