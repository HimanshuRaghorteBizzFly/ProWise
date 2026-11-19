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
  completionPercent: number;
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
  state: "TODO" | "IN_PROGRESS" | "BLOCKED" | "IN_REVIEW" | "DONE";
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

// Helper to make safe fetch calls with timeout and fallback
async function fetchJson<T>(url: string, options: RequestInit = {}): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export const developerApi = {
  async getDashboard(orgId?: string): Promise<DeveloperDashboardSummary | null> {
    const query = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
    return fetchJson<DeveloperDashboardSummary>(`/api/v1/developer/dashboard${query}`);
  },

  async getProjects(orgId?: string): Promise<DeveloperProject[] | null> {
    const query = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
    return fetchJson<DeveloperProject[]>(`/api/v1/developer/projects${query}`);
  },

  async getProject(projectId: string): Promise<DeveloperProject | null> {
    return fetchJson<DeveloperProject>(`/api/v1/developer/projects/${encodeURIComponent(projectId)}`);
  },

  async getTasks(params?: { status?: string; priority?: string; projectId?: string }): Promise<DeveloperWorkItem[] | null> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set("status", params.status);
    if (params?.priority) searchParams.set("priority", params.priority);
    if (params?.projectId) searchParams.set("projectId", params.projectId);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return fetchJson<DeveloperWorkItem[]>(`/api/v1/developer/tasks${qs}`);
  },

  async updateTaskStatus(taskId: string, state: string, note?: string): Promise<DeveloperWorkItem | null> {
    return fetchJson<DeveloperWorkItem>(`/api/v1/developer/tasks/${encodeURIComponent(taskId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ state, note }),
    });
  },

  async submitBlocker(taskId: string, reason: string, severity?: string): Promise<any | null> {
    return fetchJson<any>(`/api/v1/developer/tasks/${encodeURIComponent(taskId)}/blockers`, {
      method: "POST",
      body: JSON.stringify({ reason, severity: severity || "HIGH" }),
    });
  },

  async resolveBlocker(blockerId: string): Promise<any | null> {
    return fetchJson<any>(`/api/v1/developer/blockers/${encodeURIComponent(blockerId)}/resolve`, {
      method: "POST",
    });
  },

  async submitCheckIn(payload: {
    projectId: string;
    percent: number;
    accomplished: string;
    nextSteps: string;
    blockers?: string;
    risks?: string;
  }): Promise<any | null> {
    return fetchJson<any>(`/api/v1/developer/check-ins`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getCheckIns(projectId: string): Promise<any[] | null> {
    return fetchJson<any[]>(`/api/v1/developer/projects/${encodeURIComponent(projectId)}/check-ins`);
  },

  async getSprints(projectId?: string): Promise<DeveloperSprint[] | null> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return fetchJson<DeveloperSprint[]>(`/api/v1/developer/sprints${query}`);
  },

  async getBugs(projectId?: string): Promise<DeveloperBug[] | null> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return fetchJson<DeveloperBug[]>(`/api/v1/developer/bugs${query}`);
  },

  async createBug(payload: {
    projectId: string;
    title: string;
    description: string;
    severity?: string;
    reproductionSteps?: string;
    environment?: string;
    assignedTo?: string;
  }): Promise<DeveloperBug | null> {
    return fetchJson<DeveloperBug>(`/api/v1/developer/bugs`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async updateBugStatus(bugId: string, status: string, resolution?: string): Promise<DeveloperBug | null> {
    return fetchJson<DeveloperBug>(`/api/v1/developer/bugs/${encodeURIComponent(bugId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, resolution }),
    });
  },

  async getReviews(type?: "assigned" | "authored"): Promise<DeveloperCodeReview[] | null> {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    return fetchJson<DeveloperCodeReview[]>(`/api/v1/developer/reviews${query}`);
  },

  async submitReviewDecision(reviewId: string, decision: string, feedback?: string): Promise<DeveloperCodeReview | null> {
    return fetchJson<DeveloperCodeReview>(`/api/v1/developer/reviews/${encodeURIComponent(reviewId)}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision, feedback }),
    });
  },

  async getGitHubActivity(repo?: string, actor?: string): Promise<any[] | null> {
    const searchParams = new URLSearchParams();
    if (repo) searchParams.set("repo", repo);
    if (actor) searchParams.set("actor", actor);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return fetchJson<any[]>(`/api/v1/developer/github/activity${qs}`);
  },

  async getCalendarEvents(): Promise<DeveloperCalendarEvent[] | null> {
    return fetchJson<DeveloperCalendarEvent[]>(`/api/v1/developer/calendar`);
  },

  async createCalendarEvent(payload: {
    projectId?: string;
    title: string;
    description?: string;
    eventType?: string;
    startTime: string;
    endTime?: string;
    allDay?: boolean;
    url?: string;
  }): Promise<DeveloperCalendarEvent | null> {
    return fetchJson<DeveloperCalendarEvent>(`/api/v1/developer/calendar`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getDiscussions(projectId?: string): Promise<DeveloperDiscussion[] | null> {
    const query = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
    return fetchJson<DeveloperDiscussion[]>(`/api/v1/developer/discussions${query}`);
  },

  async createDiscussion(payload: {
    projectId: string;
    title: string;
    category?: string;
    initialMessage?: string;
  }): Promise<DeveloperDiscussion | null> {
    return fetchJson<DeveloperDiscussion>(`/api/v1/developer/discussions`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getDiscussionMessages(discussionId: string): Promise<DeveloperDiscussionMessage[] | null> {
    return fetchJson<DeveloperDiscussionMessage[]>(`/api/v1/developer/discussions/${encodeURIComponent(discussionId)}/messages`);
  },

  async sendDiscussionMessage(discussionId: string, message: string): Promise<DeveloperDiscussionMessage | null> {
    return fetchJson<DeveloperDiscussionMessage>(`/api/v1/developer/discussions/${encodeURIComponent(discussionId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  },

  async getFiles(projectId?: string, workItemId?: string): Promise<DeveloperFile[] | null> {
    const searchParams = new URLSearchParams();
    if (projectId) searchParams.set("projectId", projectId);
    if (workItemId) searchParams.set("workItemId", workItemId);
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
    return fetchJson<DeveloperFile[]>(`/api/v1/developer/files${qs}`);
  },

  async saveFileRecord(payload: {
    projectId?: string;
    workItemId?: string;
    fileName: string;
    fileUrl: string;
    fileSize?: number;
    contentType?: string;
  }): Promise<DeveloperFile | null> {
    return fetchJson<DeveloperFile>(`/api/v1/developer/files`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async getNotifications(unreadOnly?: boolean): Promise<DeveloperNotification[] | null> {
    const query = unreadOnly ? `?unreadOnly=true` : "";
    return fetchJson<DeveloperNotification[]>(`/api/v1/developer/notifications${query}`);
  },

  async markNotificationRead(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/developer/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
      return res.ok;
    } catch {
      return false;
    }
  },

  async markAllNotificationsRead(): Promise<boolean> {
    try {
      const res = await fetch(`/api/v1/developer/notifications/read-all`, { method: "POST" });
      return res.ok;
    } catch {
      return false;
    }
  },

  async getReportsSummary(orgId?: string): Promise<DeveloperReportsSummary | null> {
    const query = orgId ? `?orgId=${encodeURIComponent(orgId)}` : "";
    return fetchJson<DeveloperReportsSummary>(`/api/v1/developer/reports/summary${query}`);
  },

  async getPreferences(): Promise<DeveloperPreferences | null> {
    return fetchJson<DeveloperPreferences>(`/api/v1/developer/preferences`);
  },

  async updatePreferences(payload: {
    emailNotifications: boolean;
    slackNotifications: boolean;
    theme?: string;
    githubUsername?: string;
    timezone?: string;
  }): Promise<DeveloperPreferences | null> {
    return fetchJson<DeveloperPreferences>(`/api/v1/developer/preferences`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  },
};
