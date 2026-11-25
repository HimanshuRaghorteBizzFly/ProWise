import { apiClient } from "@/lib/api";
export interface DeveloperDashboardSummary {
  assignedProjectsCount: number;
  activeProjectsCount: number;
  assignedTasksCount: number;
  completedTasksCount: number;
  pendingTasksCount: number;
  overdueTasksCount: number;
  openBugsCount: number;
  pendingReviewsCount: number;
  unreadNotificationsCount: number;
  todayTasks: any[];
  priorityTasks: any[];
  blockedTasks: any[];
  upcomingDeadlines: any[];
  recentGitEvents: any[];
}

export interface DeveloperProject {
  id: string;
  orgId?: string;
  name: string;
  code: string;
  description?: string;
  mode: "INDIVIDUAL" | "STRUCTURED";
  status: string;
  /** Last approved / calculated figure; null means "Not reported" (Individual) or "Not measurable" (Structured). */
  completionPercent: number | null;
  targetCompletionDate?: string;
  accountableOwnerId?: string;
  memberIds?: string;
  totalWeight?: number;
  completedWeight?: number;
  blockedTasksCount: number;
  overdueTasksCount: number;
  latestCheckIn?: any;
}

export interface DeveloperWorkItem {
  id: string;
  projectId: string;
  orgId?: string;
  parentId?: string;
  type: string;
  key: string;
  title: string;
  description?: string;
  primaryAssigneeId?: string;
  reviewerId?: string;
  /** Blocked is the separate `blocked` flag (T21), never a state. */
  state: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
  blocked: boolean;
  weight: number;
  weightUnit?: string;
  criteria?: string;
  currentRevision: number;
  submittedRevision?: number;
  dueDate?: string;
  startDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  sprintId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeveloperSprint {
  id: string;
  projectId: string;
  name: string;
  goal?: string;
  status: "PLANNED" | "ACTIVE" | "COMPLETED";
  startDate?: string;
  endDate?: string;
  tasks: DeveloperWorkItem[];
}

export interface DeveloperGitHubEvent {
  id: string;
  repositoryName?: string;
  repository?: string;
  repo?: string;
  eventType?: string;
  type?: string;
  actor?: string;
  title?: string;
  payloadSummary?: string;
  message?: string;
  url?: string;
  createdAt?: string;
  occurredAt?: string;
}

export interface DeveloperBug {
  id: string;
  projectId: string;
  title: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priority?: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REOPENED";
  assignedDeveloperId?: string;
  assignedTo?: string;
  reportedBy?: string;
  reproductionSteps?: string;
  environment?: string;
  fixNotes?: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface DeveloperCodeReview {
  id: string;
  projectId: string;
  workItemId?: string;
  title: string;
  prNumber?: number;
  prUrl?: string;
  repositoryName?: string;
  branch?: string;
  authorId: string;
  reviewerId?: string;
  status: "PENDING" | "APPROVED" | "CHANGES_REQUESTED" | "MERGED";
  createdAt: string;
  updatedAt: string;
}

export interface DeveloperCalendarEvent {
  id: string;
  userId: string;
  projectId?: string;
  title: string;
  description?: string;
  eventType: "DEADLINE" | "MILESTONE" | "SPRINT" | "REVIEW" | "PERSONAL" | "TASK_DUE";
  startTime: string;
  endTime?: string;
  allDay: boolean;
  url?: string;
  createdAt: string;
}

export interface DeveloperDiscussion {
  id: string;
  projectId: string;
  title: string;
  category: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeveloperDiscussionMessage {
  id: string;
  discussionId: string;
  authorId: string;
  authorName: string;
  content: string;
  message?: string;
  createdAt: string;
}

export interface DeveloperFile {
  id: string;
  projectId?: string;
  workItemId?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  fileUrl?: string;
  uploadedBy: string;
  createdAt: string;
}

export interface DeveloperNotification {
  id: string;
  userId: string;
  category: string;
  title: string;
  message: string;
  targetUrl?: string;
  read: boolean;
  createdAt: string;
}

export interface DeveloperReportsSummary {
  totalAssignedTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  inReviewTasks: number;
  blockedTasks: number;
  totalActualHours: number;
  totalEstimatedHours: number;
  openBugs: number;
  resolvedBugs: number;
  codeReviewsSubmitted: number;
  codeReviewsCompleted: number;
  projectContributions: {
    projectId: string;
    projectName: string;
    projectCode: string;
    mode: string;
    tasksCount: number;
    completedTasksCount: number;
    progressPercent: number;
  }[];
}

export interface DeveloperPreferences {
  userId: string;
  emailNotifications: boolean;
  slackNotifications: boolean;
  theme: string;
  githubUsername?: string;
  timezone: string;
}

/** Browser path "/api/v1/..." -> client path "/v1/..." (the client adds the "/api" base). */
function clientPath(url: string): string {
  return url.startsWith("/api/") ? url.slice("/api".length) : url;
}

/**
 * Safe JSON call through the session-aware client: Bearer token from memory, one refresh on 401, then the retry.
 * Returns null instead of throwing (these panels fall back to empty states).
 */
async function fetchJson<T>(url: string, options: { method?: string; body?: string } = {}): Promise<T | null> {
  try {
    return await apiClient.call<T>(clientPath(url), {
      method: options.method,
      body: options.body === undefined ? undefined : JSON.parse(options.body),
    });
  } catch {
    return null;
  }
}

/*
 * Transport. Every call goes through the authenticated apiClient (bearer token, refresh, X-Request-Id,
 * Idempotency-Key on writes) and throws ApiError on failure: pages show an error state with Retry, never fake data.
 * The backend serializes snake_case; this module converts at the boundary so the page types stay camelCase.
 */
function camelKey(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

function snakeKey(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
}

export function camelizeKeys<T>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => camelizeKeys(v)) as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [camelKey(k), camelizeKeys(v)])) as T;
  }
  return value as T;
}

export function snakeizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((v) => snakeizeKeys(v));
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [snakeKey(k), snakeizeKeys(v)]));
  }
  return value;
}

async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { apiClient } = await import("@/lib/api");
  const body = init.body === undefined ? undefined : snakeizeKeys(init.body);
  const result = await apiClient.call<unknown>(path, { method: init.method, body });
  return camelizeKeys<T>(result);
}

function query(params: Record<string, string | boolean | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== false) search.set(k, String(v));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

const enc = encodeURIComponent;

export const developerApi = {
  /** The organization comes from the signed-in token; the argument is kept for call-site compatibility. */
  getDashboard: (_orgId?: string) => call<DeveloperDashboardSummary>("/v1/developer/dashboard"),
  getProjects: (_orgId?: string) => call<DeveloperProject[]>("/v1/developer/projects"),
  getProject: (projectId: string) => call<DeveloperProject>(`/v1/developer/projects/${enc(projectId)}`),

  getTasks: (params?: { status?: string; priority?: string; projectId?: string }) =>
    call<DeveloperWorkItem[]>(`/v1/developer/tasks${query({ ...params })}`),
  updateTaskStatus: (taskId: string, state: string, note?: string) =>
    call<DeveloperWorkItem>(`/v1/developer/tasks/${enc(taskId)}/status`, { method: "PATCH", body: { state, note } }),
  submitBlocker: (taskId: string, reason: string, severity: "NORMAL" | "CRITICAL" = "NORMAL") =>
    call<unknown>(`/v1/developer/tasks/${enc(taskId)}/blockers`, { method: "POST", body: { reason, severity } }),
  resolveBlocker: (blockerId: string) =>
    call<unknown>(`/v1/developer/blockers/${enc(blockerId)}/resolve`, { method: "POST" }),

  submitCheckIn: (payload: {
    projectId: string;
    percent: number;
    accomplished: string;
    nextSteps: string;
    blockers?: string;
    risks?: string;
  }) => call<unknown>("/v1/developer/check-ins", { method: "POST", body: payload }),
  getCheckIns: (projectId: string) => call<unknown[]>(`/v1/developer/projects/${enc(projectId)}/check-ins`),

  getSprints: (projectId?: string) => call<DeveloperSprint[]>(`/v1/developer/sprints${query({ projectId })}`),

  getBugs: (projectId?: string) => call<DeveloperBug[]>(`/v1/developer/bugs${query({ projectId })}`),
  createBug: (payload: {
    projectId: string;
    title: string;
    description: string;
    severity?: string;
    reproductionSteps?: string;
    environment?: string;
    assignedTo?: string;
  }) => call<DeveloperBug>("/v1/developer/bugs", { method: "POST", body: payload }),
  updateBugStatus: (bugId: string, status: string, resolution?: string) =>
    call<DeveloperBug>(`/v1/developer/bugs/${enc(bugId)}/status`, { method: "PATCH", body: { status, resolution } }),

  getReviews: (type?: "assigned" | "authored") =>
    call<DeveloperCodeReview[]>(`/v1/developer/reviews${query({ type })}`),
  submitReviewDecision: (reviewId: string, decision: string, feedback?: string) =>
    call<DeveloperCodeReview>(`/v1/developer/reviews/${enc(reviewId)}/decision`, {
      method: "POST",
      body: { decision, feedback },
    }),

  getGitHubActivity: (repo?: string, actor?: string) =>
    call<DeveloperGitHubEvent[]>(`/v1/developer/github/activity${query({ repo, actor })}`),

  getCalendarEvents: () => call<DeveloperCalendarEvent[]>("/v1/developer/calendar"),
  createCalendarEvent: (payload: {
    projectId?: string;
    title: string;
    description?: string;
    eventType?: string;
    startTime: string;
    endTime?: string;
    allDay?: boolean;
    url?: string;
  }) => call<DeveloperCalendarEvent>("/v1/developer/calendar", { method: "POST", body: payload }),

  getDiscussions: (projectId?: string) =>
    call<DeveloperDiscussion[]>(`/v1/developer/discussions${query({ projectId })}`),
  createDiscussion: (payload: { projectId: string; title: string; category?: string; initialMessage?: string }) =>
    call<DeveloperDiscussion>("/v1/developer/discussions", { method: "POST", body: payload }),
  getDiscussionMessages: (discussionId: string) =>
    call<DeveloperDiscussionMessage[]>(`/v1/developer/discussions/${enc(discussionId)}/messages`),
  sendDiscussionMessage: (discussionId: string, message: string) =>
    call<DeveloperDiscussionMessage>(`/v1/developer/discussions/${enc(discussionId)}/messages`, {
      method: "POST",
      body: { message },
    }),

  getFiles: (projectId?: string, workItemId?: string) =>
    call<DeveloperFile[]>(`/v1/developer/files${query({ projectId, workItemId })}`),
  saveFileRecord: (payload: {
    projectId?: string;
    workItemId?: string;
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    contentType?: string;
  }) => call<DeveloperFile>("/v1/developer/files", { method: "POST", body: payload }),

  getNotifications: (unreadOnly?: boolean) =>
    call<DeveloperNotification[]>(`/v1/developer/notifications${query({ unreadOnly })}`),
  markNotificationRead: (notificationId: string) =>
    call<void>(`/v1/developer/notifications/${enc(notificationId)}/read`, { method: "PATCH" }),
  markAllNotificationsRead: () => call<void>("/v1/developer/notifications/read-all", { method: "POST" }),

  async getReportsSummary(orgId?: string): Promise<DeveloperReportsSummary | null> {
    const query = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
    return fetchJson<DeveloperReportsSummary>(`/api/v1/developer/reports/summary${query}`);
  },

  async getPreferences(): Promise<DeveloperPreferences | null> {
    return fetchJson<DeveloperPreferences>(`/api/v1/developer/preferences`);
  },

  updatePreferences: (payload: {
    emailNotifications: boolean;
    slackNotifications: boolean;
    theme?: string;
    githubUsername?: string;
    timezone?: string;
  }) => call<DeveloperPreferences>("/v1/developer/preferences", { method: "PUT", body: payload }),
};
