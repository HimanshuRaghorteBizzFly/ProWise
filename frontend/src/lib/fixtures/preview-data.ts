/**
 * Sample data for role preview and an unreachable backend, outside production only (see classifyFailure).
 * Screens that show it are marked "Sample data" and stay read-only; nothing here is ever sent to the API.
 * Shapes match the real wire types so the same components render both.
 */
import type { CodeReviewDto, InvitationDto, MemberDto, PendingReviewDto, ProgressSummaryDto, ProjectDto, TeamDto } from "@/types/api";
import type {
  DependencyViewDto,
  FeedbackViewDto,
  ReviewHistoryDto,
  StructuredProgressDto,
  WorkBlockerDto,
  WorkItemDto,
} from "@/types/work";
import type {
  DeveloperBug,
  DeveloperCalendarEvent,
  DeveloperCodeReview,
  DeveloperDashboardSummary,
  DeveloperDiscussion,
  DeveloperDiscussionMessage,
  DeveloperFile,
  DeveloperGitHubEvent,
  DeveloperNotification,
  DeveloperPreferences,
  DeveloperProject,
} from "@/lib/developer-api";

const NOW = "2026-11-20T10:30:00Z";
const DEV = { user_id: "preview-dev", email: "developer@preview.test" };
const QA = { user_id: "preview-qa", email: "reviewer@preview.test" };
const LEAD_EMAIL = "lead@preview.test";

function isoDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ structured work */

function workItem(extra: Partial<WorkItemDto> & Pick<WorkItemDto, "id" | "key" | "title">): WorkItemDto {
  return {
    project_id: "preview-structured", parent_id: "preview-root", type: "TASK", description: null, state: "TODO",
    plan_status: "ACTIVE", blocked: false, criticality: null, criteria: "Meets the acceptance criteria agreed with the PM.",
    criteria_version: 1, weight: 5, weight_unit: "POINTS", due_on: isoDay(5), revision: 1, submitted_revision: null,
    accepted_revision: null, review_required: true, primary_assignee: DEV, reviewer: QA, collaborators: [], depth: 1,
    child_count: 0, dependency_flag: null, retired_reason: null, version: 1, created_at: NOW, updated_at: NOW,
    ...extra,
  };
}

export const PREVIEW_WORK_ITEMS: WorkItemDto[] = [
  workItem({ id: "preview-w1", key: "CDS-1", title: "Patient lookup API", state: "DONE", accepted_revision: 1, due_on: isoDay(-6) }),
  workItem({ id: "preview-w2", key: "CDS-2", title: "Rule evaluation engine", state: "IN_PROGRESS", weight: 8, due_on: isoDay(2) }),
  workItem({ id: "preview-w3", key: "CDS-3", title: "Alert delivery to EHR", state: "IN_REVIEW", submitted_revision: 1, due_on: isoDay(4) }),
  workItem({ id: "preview-w4", key: "CDS-4", title: "Audit trail export", state: "TODO", blocked: true, weight: 3, due_on: isoDay(-1) }),
];

export function previewWorkItem(id: string): WorkItemDto {
  return PREVIEW_WORK_ITEMS.find((w) => w.id === id) ?? PREVIEW_WORK_ITEMS[1];
}

export const PREVIEW_BLOCKERS: WorkBlockerDto[] = [
  {
    id: "preview-b1", work_item_id: "preview-w4", work_item_key: "CDS-4", work_item_title: "Audit trail export",
    reason: "Waiting for the retention policy from compliance.", severity: "CRITICAL", owner: DEV, opened_by: DEV.user_id,
    resolved: false, resolution: null, opened_at: NOW, resolved_at: null, age_hours: 26,
  },
];

export const PREVIEW_FEEDBACK: FeedbackViewDto[] = [
  {
    id: "preview-f1", work_item_id: "preview-w2", key: "CDS-2", title: "Rule evaluation engine", project_id: "preview-structured",
    state: "IN_PROGRESS", decision: "CHANGES_REQUESTED", reason: "Handle rules with no matching patient context.", revision: 1,
    decided_at: NOW, reviewer_email: QA.email,
  },
  {
    id: "preview-f2", work_item_id: "preview-w1", key: "CDS-1", title: "Patient lookup API", project_id: "preview-structured",
    state: "DONE", decision: "APPROVED", reason: null, revision: 1, decided_at: NOW, reviewer_email: QA.email,
  },
];

export const PREVIEW_REVIEW_HISTORY: ReviewHistoryDto = {
  submissions: [{
    id: "preview-s1", revision: 1, criteria_version: 1, note: "Ready for a first look.", status: "REVIEWED", submitted_at: NOW,
    submitted_by: DEV.user_id, submitted_by_email: DEV.email,
    evidence: [{ type: "PULL_REQUEST", ref: "https://github.com/example/cds/pull/42", label: "PR 42" }],
  }],
  reviews: [{
    id: "preview-r1", decision: "CHANGES_REQUESTED", reason: "Handle rules with no matching patient context.", evidence_ref: null,
    revision: 1, decided_at: NOW, reviewer_id: QA.user_id, reviewer_email: QA.email,
  }],
  checks: [{ key: "unit-tests", label: "Unit tests pass", satisfied: true, satisfied_at: NOW }],
  reopen_events: [],
};

export const PREVIEW_DEPENDENCIES: DependencyViewDto = { blocked_by: [], blocks: [], affected: [] };

export const PREVIEW_STRUCTURED_PROGRESS: StructuredProgressDto = {
  project_id: "preview-structured", mode: "STRUCTURED", method: "accepted_work", numerator: 5, denominator: 21, percent: 24,
  label: "Accepted work", explanation: "5 of 21 points accepted against baseline v1.", accepted_leaves: 1, total_leaves: 4,
  baseline: { id: "preview-baseline", version_no: 1, unit: "POINTS", approved_at: NOW },
  leaves: PREVIEW_WORK_ITEMS.map((w) => ({
    work_item_id: w.id, key: w.key, title: w.title, weight: w.weight, cancelled: false, state: w.state,
    accepted: w.state === "DONE", suspended: false,
  })),
  snapshots: [{
    id: "preview-snap", taken_at: NOW, method: "accepted_work", numerator: 5, denominator: 21, percent: 24, missing_label: null,
    baseline_id: "preview-baseline", baseline_version: 1, accepted_leaves: 1, total_leaves: 4, cause: "WorkAccepted",
    transition_marker: false,
  }],
};

/* ------------------------------------------------------------------ developer workspace */

export const PREVIEW_DEV_PROJECTS: DeveloperProject[] = [
  {
    id: "preview-individual", name: "FHIR Patient Intake Service", code: "SOLO-10", mode: "INDIVIDUAL", status: "ACTIVE",
    completionPercent: 45, blockedTasksCount: 0, overdueTasksCount: 0,
  },
  {
    id: "preview-structured", name: "Clinical Decision Support API", code: "CDS", mode: "STRUCTURED", status: "ACTIVE",
    completionPercent: 24, totalWeight: 21, completedWeight: 5, blockedTasksCount: 1, overdueTasksCount: 1,
  },
];

export const PREVIEW_DEV_DASHBOARD: DeveloperDashboardSummary = {
  assignedProjectsCount: 2, activeProjectsCount: 2, assignedTasksCount: 4, completedTasksCount: 1, pendingTasksCount: 3,
  overdueTasksCount: 1, openBugsCount: 1, pendingReviewsCount: 1, unreadNotificationsCount: 2,
  todayTasks: [], priorityTasks: [], blockedTasks: [], upcomingDeadlines: [], recentGitEvents: [],
};

export const PREVIEW_BUGS: DeveloperBug[] = [{
  id: "preview-bug1", projectId: "preview-structured", title: "Alert shown twice after reconnect",
  description: "After the EHR socket reconnects, the last alert is delivered again.", severity: "HIGH", status: "OPEN",
  createdAt: NOW,
}];

export const PREVIEW_CODE_REVIEWS: DeveloperCodeReview[] = [{
  id: "preview-cr1", projectId: "preview-structured", workItemId: "preview-w3", title: "Alert delivery to EHR", prNumber: 42,
  prUrl: "https://github.com/example/cds/pull/42", repositoryName: "example/cds", branch: "feature/alerts",
  authorId: DEV.user_id, reviewerId: QA.user_id, status: "PENDING", createdAt: NOW, updatedAt: NOW,
}];

export const PREVIEW_FILES: DeveloperFile[] = [{
  id: "preview-file1", projectId: "preview-structured", fileName: "Alert routing design.pdf", fileSize: 0, fileType: "application/pdf",
  storagePath: "https://example.com/alert-routing-design.pdf", fileUrl: "https://example.com/alert-routing-design.pdf",
  uploadedBy: DEV.user_id, createdAt: NOW,
}];

export const PREVIEW_GITHUB: DeveloperGitHubEvent[] = [{
  id: "preview-gh1", repositoryName: "example/cds", eventType: "PULL_REQUEST", actor: "preview-dev",
  title: "Alert delivery to EHR (#42)", url: "https://github.com/example/cds/pull/42", createdAt: NOW, occurredAt: NOW,
}];

export const PREVIEW_CALENDAR: DeveloperCalendarEvent[] = [{
  id: "preview-cal1", userId: DEV.user_id, projectId: "preview-structured", title: "Sprint review", eventType: "REVIEW",
  startTime: `${isoDay(3)}T15:00:00Z`, allDay: false, createdAt: NOW,
}];

export const PREVIEW_DISCUSSIONS: DeveloperDiscussion[] = [{
  id: "preview-d1", projectId: "preview-structured", title: "Rule engine edge cases", category: "TECHNICAL",
  authorId: DEV.user_id, createdAt: NOW, updatedAt: NOW,
}];

export const PREVIEW_MESSAGES: DeveloperDiscussionMessage[] = [{
  id: "preview-m1", discussionId: "preview-d1", authorId: QA.user_id, authorName: "Reviewer",
  content: "What should happen when no patient context matches?", message: "What should happen when no patient context matches?",
  createdAt: NOW,
}];

export const PREVIEW_NOTIFICATIONS: DeveloperNotification[] = [
  { id: "preview-n1", userId: DEV.user_id, category: "REVIEW", title: "Changes requested on CDS-2",
    message: "Handle rules with no matching patient context.", read: false, createdAt: NOW },
  { id: "preview-n2", userId: DEV.user_id, category: "BLOCKER", title: "Critical blocker on CDS-4",
    message: "Waiting for the retention policy from compliance.", read: false, createdAt: NOW },
];

export const PREVIEW_PREFERENCES: DeveloperPreferences = {
  userId: DEV.user_id, emailNotifications: true, slackNotifications: false, theme: "system", timezone: "America/New_York",
};

export const PREVIEW_ME = { id: DEV.user_id, email: DEV.email, memberships: [] };

/* ------------------------------------------------------------------ check-ins (Individual) */

function previewCheckIn(projectId: string, percent: number, status: "PENDING" | "APPROVED") {
  return {
    id: `preview-ci-${projectId}-${status}`, project_id: projectId, revision_seq: status === "APPROVED" ? 1 : 2, revision_of: null,
    percent, accomplished: "Intake form validation and FHIR mapping.", next_steps: "Consent capture.", blockers: null,
    projected_finish: isoDay(20), evidence: null, downward_reason: null, status, method: "developer_reported" as const,
    label: "Developer reported", author: DEV, submitted_at: NOW, decided_by: status === "APPROVED" ? { user_id: "preview-lead", email: LEAD_EMAIL } : null,
    decided_at: status === "APPROVED" ? NOW : null, decision_reason: null, version: 0,
  };
}

export const PREVIEW_PENDING_REVIEWS: PendingReviewDto[] = [{
  project_id: "preview-individual", project_key: "SOLO-10", project_name: "FHIR Patient Intake Service",
  current: { percent: 45, label: "Developer reported", method: "developer_reported", reported_at: NOW, approved_at: NOW, checkin_id: "preview-ci-approved" },
  checkin: previewCheckIn("preview-individual", 60, "PENDING"),
}];

export function previewProgressSummary(projectId: string): ProgressSummaryDto {
  return {
    project_id: projectId, project_key: "SOLO-10", project_name: "FHIR Patient Intake Service", mode: "INDIVIDUAL",
    lifecycle: "ACTIVE", archived: false,
    current: { percent: 45, label: "Developer reported", method: "developer_reported", reported_at: NOW, approved_at: NOW, checkin_id: "preview-ci-approved" },
    pending: previewCheckIn(projectId, 60, "PENDING"),
    approver: { user_id: "preview-lead", email: LEAD_EMAIL },
    approver_note: null,
    can_submit: false,
    can_decide: false,
    history: [previewCheckIn(projectId, 45, "APPROVED")],
  };
}

/* ------------------------------------------------------------------ organization dashboards */

function project(extra: Partial<ProjectDto> & Pick<ProjectDto, "id" | "key" | "name" | "mode">): ProjectDto {
  return {
    description: null, lifecycle: "ACTIVE", archived: false, priority: "MEDIUM",
    project_manager: { membership_id: "preview-pm", email: "pm@preview.test" },
    accountable: { membership_id: "preview-dev-m", email: DEV.email }, members: [], team_id: "preview-team",
    team_name: "Platform Squad", start_on: isoDay(-30), target_on: isoDay(45), timezone: "America/New_York",
    active_baseline_id: null, task_count: 0, progress: { percent: null, label: "Not reported", reported_at: null },
    can_edit: false, version: 1, created_at: NOW, updated_at: NOW,
    ...extra,
  };
}

export const PREVIEW_PROJECTS: ProjectDto[] = [
  project({ id: "preview-individual", key: "SOLO-10", name: "FHIR Patient Intake Service", mode: "INDIVIDUAL",
    progress: { percent: 45, label: "Developer reported", reported_at: NOW } }),
  project({ id: "preview-structured", key: "CDS", name: "Clinical Decision Support API", mode: "STRUCTURED", task_count: 4,
    active_baseline_id: "preview-baseline", progress: { percent: 24, label: "Accepted work", reported_at: NOW } }),
];

export const PREVIEW_MEMBERS: MemberDto[] = [
  { id: "preview-owner-m", display_name: "Preview Owner", email: "owner@preview.test", status: "ACTIVE", role_template: "ORGANIZATION_OWNER" },
  { id: "preview-lead-m", display_name: "Preview Lead", email: LEAD_EMAIL, status: "ACTIVE", role_template: "TEAM_LEAD" },
  { id: "preview-dev-m", display_name: "Preview Developer", email: DEV.email, status: "ACTIVE", role_template: "DEVELOPER" },
];

export const PREVIEW_TEAMS: TeamDto[] = [{
  id: "preview-team", name: "Platform Squad", description: null, status: "ACTIVE", lead_membership_id: "preview-lead-m",
  lead_email: LEAD_EMAIL, members: [], version: 1, created_at: NOW, updated_at: NOW,
}];

export const PREVIEW_INVITATIONS: InvitationDto[] = [];

export const PREVIEW_QA_REVIEWS: CodeReviewDto[] = [{
  id: "preview-cr1", project_id: "preview-structured", work_item_id: "preview-w3", title: "Alert delivery to EHR", pr_number: 42,
  pr_url: "https://github.com/example/cds/pull/42", repository_name: "example/cds", branch: "feature/alerts",
  author_id: DEV.user_id, reviewer_id: QA.user_id, status: "PENDING", inspected_revision: 1, comments_count: 0,
  created_at: NOW, updated_at: NOW,
}];
