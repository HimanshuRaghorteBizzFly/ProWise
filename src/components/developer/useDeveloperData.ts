"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { developerApi } from "@/lib/developer-api";
import { toState, type LoadState } from "@/components/org-console/useRoleApi";
import type * as W from "@/types/work";

/**
 * Developer workspace data. Every query is scoped by the signed-in token's organization on the server; nothing here
 * sends an org id. A real API failure becomes an error / access state with Retry; there is no sample-data fallback.
 */

const QUERY = { retry: false } as const;

function useDevQuery<T>(queryKey: QueryKey, call: () => Promise<T>, enabled = true): LoadState<T> {
  return toState<T>(useQuery({ queryKey, queryFn: call, enabled, ...QUERY }));
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
export const useMe = () => useDevQuery(devKeys.me, () => apiClient.me());
export const useDevDashboard = () => useDevQuery(devKeys.dashboard, () => developerApi.getDashboard());
export const useDevProjects = () => useDevQuery(devKeys.projects, () => developerApi.getProjects());
export const useDevProject = (id: string) =>
  useDevQuery(devKeys.project(id), () => developerApi.getProject(id), !!id);
export const useMyWorkItems = () => useDevQuery(devKeys.myWork, () => apiClient.work.mine());
export const useMyBlockers = () => useDevQuery(devKeys.myBlockers, () => apiClient.work.myBlockers());
export const useMyFeedback = () => useDevQuery(devKeys.myFeedback, () => apiClient.work.myFeedback());
export const useWorkItem = (id: string) => useDevQuery(devKeys.item(id), () => apiClient.work.get(id), !!id);
export const useReviewHistory = (id: string) =>
  useDevQuery(devKeys.itemHistory(id), () => apiClient.work.reviewHistory(id), !!id);
export const useDependencies = (id: string) =>
  useDevQuery(devKeys.itemDeps(id), () => apiClient.work.dependencies(id), !!id);
export const useItemBlockers = (id: string) =>
  useDevQuery(devKeys.itemBlockers(id), () => apiClient.work.blockers(id), !!id);
export const useProjectWorkItems = (id: string) =>
  useDevQuery(devKeys.projectItems(id), () => apiClient.work.projectItems(id), !!id);
export const useStructuredProgress = (id: string) =>
  useDevQuery(devKeys.structured(id), () => apiClient.work.structuredProgress(id), !!id);
export const useProjectBlockers = (id: string) =>
  useDevQuery(["developer", "project", id, "work-item-blockers"], () => apiClient.work.projectBlockers(id), !!id);
export const useDevBugs = () => useDevQuery(devKeys.bugs, () => developerApi.getBugs());
export const useDevReviews = (type: "assigned" | "authored") =>
  useDevQuery(devKeys.reviews(type), () => developerApi.getReviews(type));
export const useDevFiles = () => useDevQuery(devKeys.files, () => developerApi.getFiles());
export const useDevGitHub = () => useDevQuery(devKeys.github, () => developerApi.getGitHubActivity());
export const useDevCalendar = () => useDevQuery(devKeys.calendar, () => developerApi.getCalendarEvents());
export const useDevDiscussions = () => useDevQuery(devKeys.discussions, () => developerApi.getDiscussions());
export const useDiscussionMessages = (id: string) =>
  useDevQuery(devKeys.messages(id), () => developerApi.getDiscussionMessages(id), !!id);
export const useDevNotifications = () =>
  useDevQuery(devKeys.notifications, () => developerApi.getNotifications());
export const useDevPreferences = () => useDevQuery(devKeys.preferences, () => developerApi.getPreferences());

/* ---------------------------------------------------------------- writes */

/** Runs a change and refreshes every developer query (lists, counts and the item itself), since one change moves many. */
export function useDevMutation<A, R>(fn: (args: A) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
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
