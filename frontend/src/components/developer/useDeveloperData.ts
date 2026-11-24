"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { ApiError, apiClient } from "@/lib/api";
import { developerApi } from "@/lib/developer-api";
import * as F from "@/lib/fixtures/preview-data";
import { mocksRequested, readPermissionEnv } from "@/lib/permissions";
import { toState, withFixture, type LoadState } from "@/components/org-console/useRoleApi";
import { useAuthStore } from "@/store/auth-store";
import type * as W from "@/types/work";

/**
 * Developer workspace data. Every query is scoped by the signed-in token's organization on the server; nothing here
 * sends an org id. A real API failure becomes an error / access state with Retry. Only outside production, when the
 * API is unreachable or the session is in role preview (where API calls are blocked by design), the screens show
 * labelled read-only sample data instead of an error.
 */

const QUERY = { retry: false } as const;

function useDevQuery<T>(queryKey: QueryKey, call: () => Promise<T>, fixture: () => T, enabled = true): LoadState<T> {
  return toState<T>(useQuery({ queryKey, queryFn: () => withFixture(call, fixture), enabled, ...QUERY }));
}

export const devKeys = {
  all: ["developer"] as const,
  me: ["developer", "me"] as const,
  dashboard: ["developer", "dashboard"] as const,
  projects: ["developer", "projects"] as const,
  project: (id: string) => ["developer", "project", id] as const,
  tasks: ["developer", "tasks"] as const,
  myWork: ["developer", "me", "work-items"] as const,
  myBlockers: ["developer", "me", "blockers"] as const,
  myFeedback: ["developer", "me", "feedback"] as const,
  item: (id: string) => ["developer", "work-item", id] as const,
  itemHistory: (id: string) => ["developer", "work-item", id, "reviews"] as const,
  itemDeps: (id: string) => ["developer", "work-item", id, "dependencies"] as const,
  itemBlockers: (id: string) => ["developer", "work-item", id, "blockers"] as const,
  projectItems: (id: string) => ["developer", "project", id, "work-items"] as const,
  structured: (id: string) => ["developer", "project", id, "structured-progress"] as const,
  bugs: ["developer", "bugs"] as const,
  reviews: (type: string) => ["developer", "reviews", type] as const,
  files: ["developer", "files"] as const,
  github: ["developer", "github"] as const,
  calendar: ["developer", "calendar"] as const,
  discussions: ["developer", "discussions"] as const,
  messages: (id: string) => ["developer", "discussions", id, "messages"] as const,
  notifications: ["developer", "notifications"] as const,
  preferences: ["developer", "preferences"] as const,
};

/* ---------------------------------------------------------------- reads */

/** The signed-in user (server identity), used only to decide which actions to offer; the server still enforces them. */
export const useMe = () => useDevQuery(devKeys.me, () => apiClient.me(), () => F.PREVIEW_ME as Awaited<ReturnType<typeof apiClient.me>>);
export const useDevDashboard = () => useDevQuery(devKeys.dashboard, () => developerApi.getDashboard(), () => F.PREVIEW_DEV_DASHBOARD);
export const useDevProjects = () => useDevQuery(devKeys.projects, () => developerApi.getProjects(), () => F.PREVIEW_DEV_PROJECTS);
export const useDevProject = (id: string) =>
  useDevQuery(devKeys.project(id), () => developerApi.getProject(id),
    () => F.PREVIEW_DEV_PROJECTS.find((p) => p.id === id) ?? F.PREVIEW_DEV_PROJECTS[0], !!id);
export const useMyWorkItems = () => useDevQuery(devKeys.myWork, () => apiClient.work.mine(), () => F.PREVIEW_WORK_ITEMS);
export const useMyBlockers = () => useDevQuery(devKeys.myBlockers, () => apiClient.work.myBlockers(), () => F.PREVIEW_BLOCKERS);
export const useMyFeedback = () => useDevQuery(devKeys.myFeedback, () => apiClient.work.myFeedback(), () => F.PREVIEW_FEEDBACK);
export const useWorkItem = (id: string) => useDevQuery(devKeys.item(id), () => apiClient.work.get(id), () => F.previewWorkItem(id), !!id);
export const useReviewHistory = (id: string) =>
  useDevQuery(devKeys.itemHistory(id), () => apiClient.work.reviewHistory(id), () => F.PREVIEW_REVIEW_HISTORY, !!id);
export const useDependencies = (id: string) =>
  useDevQuery(devKeys.itemDeps(id), () => apiClient.work.dependencies(id), () => F.PREVIEW_DEPENDENCIES, !!id);
export const useItemBlockers = (id: string) =>
  useDevQuery(devKeys.itemBlockers(id), () => apiClient.work.blockers(id),
    () => F.PREVIEW_BLOCKERS.filter((b) => b.work_item_id === id), !!id);
export const useProjectWorkItems = (id: string) =>
  useDevQuery(devKeys.projectItems(id), () => apiClient.work.projectItems(id), () => F.PREVIEW_WORK_ITEMS, !!id);
export const useStructuredProgress = (id: string) =>
  useDevQuery(devKeys.structured(id), () => apiClient.work.structuredProgress(id), () => F.PREVIEW_STRUCTURED_PROGRESS, !!id);
export const useProjectBlockers = (id: string) =>
  useDevQuery(["developer", "project", id, "work-item-blockers"], () => apiClient.work.projectBlockers(id), () => F.PREVIEW_BLOCKERS, !!id);
export const useDevBugs = () => useDevQuery(devKeys.bugs, () => developerApi.getBugs(), () => F.PREVIEW_BUGS);
export const useDevReviews = (type: "assigned" | "authored") =>
  useDevQuery(devKeys.reviews(type), () => developerApi.getReviews(type), () => (type === "authored" ? F.PREVIEW_CODE_REVIEWS : []));
export const useDevFiles = () => useDevQuery(devKeys.files, () => developerApi.getFiles(), () => F.PREVIEW_FILES);
export const useDevGitHub = () => useDevQuery(devKeys.github, () => developerApi.getGitHubActivity(), () => F.PREVIEW_GITHUB);
export const useDevCalendar = () => useDevQuery(devKeys.calendar, () => developerApi.getCalendarEvents(), () => F.PREVIEW_CALENDAR);
export const useDevDiscussions = () => useDevQuery(devKeys.discussions, () => developerApi.getDiscussions(), () => F.PREVIEW_DISCUSSIONS);
export const useDiscussionMessages = (id: string) =>
  useDevQuery(devKeys.messages(id), () => developerApi.getDiscussionMessages(id), () => F.PREVIEW_MESSAGES, !!id);
export const useDevNotifications = () =>
  useDevQuery(devKeys.notifications, () => developerApi.getNotifications(), () => F.PREVIEW_NOTIFICATIONS);
export const useDevPreferences = () => useDevQuery(devKeys.preferences, () => developerApi.getPreferences(), () => F.PREVIEW_PREFERENCES);

/* ---------------------------------------------------------------- writes */

/** True while a role preview is active outside production: changes are not sent (sample data is read-only). */
export function usePreviewReadOnly(): boolean {
  const preview = useAuthStore((s) => s.isRolePreview);
  return mocksRequested(readPermissionEnv(), preview) && preview;
}

const PREVIEW_REFUSAL = () =>
  new ApiError(0, "ROLE_PREVIEW", "Role preview shows sample data and cannot save changes. Sign in with a real account to make changes.", "");

/** Runs a change and refreshes every developer query (lists, counts and the item itself), since one change moves many. */
export function useDevMutation<A, R>(fn: (args: A) => Promise<R>) {
  const client = useQueryClient();
  const readOnly = usePreviewReadOnly();
  return useMutation({
    mutationFn: (args: A) => (readOnly ? Promise.reject(PREVIEW_REFUSAL()) : fn(args)),
    onSettled: () => client.invalidateQueries({ queryKey: devKeys.all }),
  });
}

export function useWorkflowActions(item: W.WorkItemDto | null) {
  const start = useDevMutation((v: number) => apiClient.work.start(item!.id, v));
  const submit = useDevMutation((body: { expected_version: number; note?: string; evidence: W.EvidenceItemDto[] }) =>
    apiClient.work.submit(item!.id, body));
  const raiseBlocker = useDevMutation((body: { reason: string; severity: "NORMAL" | "CRITICAL" }) =>
    apiClient.work.raiseBlocker(item!.id, body));
  const resolveBlocker = useDevMutation((args: { id: string; resolution?: string }) =>
    apiClient.work.resolveBlocker(args.id, args.resolution));
  const markCheck = useDevMutation((args: { key: string; satisfied: boolean }) =>
    apiClient.work.markCheck(item!.id, args.key, args.satisfied));
  return { start, submit, raiseBlocker, resolveBlocker, markCheck };
}

export type { LoadState };
