import {
  SEEDED_VIEWER_PROJECTS,
  SEEDED_VIEWER_TASKS,
  SEEDED_VIEWER_MILESTONES,
  SEEDED_VIEWER_MEMBERS,
  SEEDED_VIEWER_CALENDAR_EVENTS,
  SEEDED_VIEWER_FILES,
  SEEDED_VIEWER_ACTIVITY,
  SEEDED_VIEWER_NOTIFICATIONS,
} from "../_data/seed";
import {
  ViewerProject,
  ViewerTask,
  ViewerMilestone,
  ViewerMember,
  ViewerCalendarEvent,
  ViewerFileItem,
  ViewerActivityItem,
  ViewerNotificationItem,
} from "../_types";

/**
 * Normalizes organization ID, falling back to 'org-acme' if empty or invalid.
 */
export function normalizeOrgId(orgId?: string): string {
  if (!orgId || orgId === "viewer" || orgId.trim() === "") {
    return "org-acme";
  }
  return orgId;
}

/**
 * Enforce Viewer Read-Only RBAC constraint.
 * Front-end and service layer rejection for any unauthorized mutation attempt.
 */
export function assertReadOnly(actionDescription: string): never {
  throw new Error(
    `[403 FORBIDDEN] Viewers possess strictly READ-ONLY authority. The action "${actionDescription}" was rejected.`
  );
}

/**
 * Filter projects by tenant organization.
 * Prevents cross-tenant data leakage.
 */
export function getViewerProjects(orgId?: string): ViewerProject[] {
  const safeId = normalizeOrgId(orgId);
  return SEEDED_VIEWER_PROJECTS.filter((p) => p.orgId === safeId);
}

export function getViewerProjectById(orgId?: string, projectId?: string): ViewerProject | undefined {
  const safeId = normalizeOrgId(orgId);
  return SEEDED_VIEWER_PROJECTS.find((p) => p.orgId === safeId && p.id === projectId);
}

/**
 * Filter tasks by tenant and optional project / criteria.
 */
export function getViewerTasks(
  orgId?: string,
  projectId?: string,
  stateFilter?: string,
  priorityFilter?: string,
  search?: string
): ViewerTask[] {
  const safeId = normalizeOrgId(orgId);
  return SEEDED_VIEWER_TASKS.filter((t) => {
    if (t.orgId !== safeId) return false;
    if (projectId && projectId !== "ALL" && t.projectId !== projectId) return false;
    if (stateFilter === "OPEN" && t.state !== "TODO") return false;
    if (stateFilter === "BLOCKED" && !t.isBlocked) return false;
    if (
      stateFilter &&
      stateFilter !== "ALL" &&
      stateFilter !== "OPEN" &&
      stateFilter !== "BLOCKED" &&
      t.state !== stateFilter
    ) return false;
    if (priorityFilter && priorityFilter !== "ALL" && t.priority !== priorityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        t.primaryAssignee.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

export function getViewerTaskById(orgId?: string, taskId?: string): ViewerTask | undefined {
  const safeId = normalizeOrgId(orgId);
  return SEEDED_VIEWER_TASKS.find((t) => t.orgId === safeId && t.id === taskId);
}

/**
 * Milestones for authorized initiatives.
 */
export function getViewerMilestones(orgId?: string, projectId?: string): ViewerMilestone[] {
  const safeId = normalizeOrgId(orgId);
  return SEEDED_VIEWER_MILESTONES.filter((m) => {
    if (m.orgId !== safeId) return false;
    if (projectId && projectId !== "ALL" && m.projectId !== projectId) return false;
    return true;
  });
}

/**
 * Team directory for authorized organization.
 */
export function getViewerMembers(orgId?: string, search?: string, teamId?: string): ViewerMember[] {
  const safeId = normalizeOrgId(orgId);
  return SEEDED_VIEWER_MEMBERS.filter((m) => {
    if (m.orgId !== safeId) return false;
    if (teamId && teamId !== "ALL" && m.teamId !== teamId) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.roleLabel.toLowerCase().includes(q) ||
        m.teamName.toLowerCase().includes(q)
      );
    }
    return true;
  });
}

/**
 * Calendar deadlines and milestones.
 */
export function getViewerCalendarEvents(
  orgId?: string,
  year?: number,
  month?: number
): ViewerCalendarEvent[] {
  const safeId = normalizeOrgId(orgId);
  return SEEDED_VIEWER_CALENDAR_EVENTS.filter((e) => {
    if (e.orgId !== safeId) return false;
    if (year !== undefined && month !== undefined) {
      const d = new Date(e.date);
      if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month) return false;
    }
    return true;
  });
}

/**
 * Authorized documents, specifications, and evidence.
 * Restricted files are filtered or flagged.
 */
export function getViewerFiles(orgId?: string, projectId?: string): ViewerFileItem[] {
  const safeId = normalizeOrgId(orgId);
  return SEEDED_VIEWER_FILES.filter((f) => {
    if (f.orgId !== safeId) return false;
    if (projectId && projectId !== "ALL" && f.projectId !== projectId) return false;
    return true;
  });
}

export function getViewerFileById(orgId?: string, fileId?: string): ViewerFileItem | undefined {
  const safeId = normalizeOrgId(orgId);
  return SEEDED_VIEWER_FILES.find((f) => f.orgId === safeId && f.id === fileId);
}

/**
 * Activity timeline entries.
 */
export function getViewerActivity(
  orgId?: string,
  projectId?: string,
  typeFilter?: string
): ViewerActivityItem[] {
  const safeId = normalizeOrgId(orgId);
  return SEEDED_VIEWER_ACTIVITY.filter((a) => {
    if (a.orgId !== safeId) return false;
    if (projectId && projectId !== "ALL" && a.projectId !== projectId) return false;
    if (typeFilter && typeFilter !== "ALL" && a.type !== typeFilter) return false;
    return true;
  });
}

/**
 * Notifications feed.
 */
export function getViewerNotifications(orgId?: string): ViewerNotificationItem[] {
  const safeId = normalizeOrgId(orgId);
  return SEEDED_VIEWER_NOTIFICATIONS.filter((n) => n.orgId === safeId);
}

/**
 * Generate CSV export of authorized progress data.
 */
export function generateProgressCsv(orgId?: string): string {
  const safeId = normalizeOrgId(orgId);
  const projects = getViewerProjects(safeId);
  const headers = [
    "Project Key",
    "Project Name",
    "Delivery Mode",
    "Lifecycle",
    "Health Status",
    "Progress Percent",
    "Calculation Method",
    "Accountable Owner",
    "Project Manager",
    "Approved Target Date",
    "Last Reported UTC",
  ];

  const rows = projects.map((p) => [
    `"${p.key}"`,
    `"${p.name.replace(/"/g, '""')}"`,
    `"${p.mode}"`,
    `"${p.lifecycle}"`,
    `"${p.health}"`,
    `"${p.lastProgressPercent}%"`,
    `"${p.lastProgressMethod}"`,
    `"${p.accountableOwnerName}"`,
    `"${p.projectManagerName}"`,
    `"${p.targetDate}"`,
    `"${p.lastReportedAt}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

/**
 * Generate JSON export of milestone compliance.
 */
export function generateMilestonesJson(orgId?: string): string {
  const safeId = normalizeOrgId(orgId);
  const milestones = getViewerMilestones(safeId);
  return JSON.stringify(
    {
      exportType: "MILESTONE_COMPLIANCE_AUDIT",
      generatedAt: new Date().toISOString(),
      organizationId: safeId,
      governanceScope: "READ_ONLY_VIEWER",
      milestones,
    },
    null,
    2
  );
}
