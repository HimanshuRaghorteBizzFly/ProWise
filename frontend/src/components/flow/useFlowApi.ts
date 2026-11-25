"use client";

import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { toState, type LoadState } from "@/components/org-console/useRoleApi";
import { devKeys } from "@/components/developer/useDeveloperData";
import type * as F from "@/types/flow";
import type * as W from "@/types/work";

/**
 * Data for the project delivery flow. Everything goes through the typed client; the organization always comes from
 * the signed-in token on the server. Board, review queue and progress refresh when the window regains focus and after
 * every change, so everyone who can see a project sees the same figure.
 */

const LIVE = { retry: false, refetchOnWindowFocus: true, staleTime: 0 } as const;

export const flowKeys = {
  all: ["flow"] as const,
  setupOptions: (orgId: string) => ["flow", "setup-options", orgId] as const,
  queue: ["flow", "review-queue"] as const,
  activity: (id: string) => ["flow", "activity", id] as const,
  overview: (orgId: string) => ["flow", "progress-overview", orgId] as const,
  approvers: (projectId: string) => ["flow", "approvers", projectId] as const,
  projectFiles: (projectId: string) => ["flow", "project-files", projectId] as const,
  itemFiles: (id: string) => ["flow", "item-files", id] as const,
  github: (projectId: string) => ["flow", "github", projectId] as const,
  taskCommits: (id: string) => ["flow", "task-commits", id] as const,
  projectCommits: (projectId: string) => ["flow", "project-commits", projectId] as const,
  projectItems: (projectId: string) => ["flow", "project-items", projectId] as const,
  structured: (projectId: string) => ["flow", "structured", projectId] as const,
};

function useFlowQuery<T>(queryKey: QueryKey, call: () => Promise<T>, enabled = true): LoadState<T> {
  return toState<T>(useQuery({ queryKey, queryFn: call, enabled, ...LIVE }));
}

export const useSetupOptions = (orgId: string) =>
  useFlowQuery(flowKeys.setupOptions(orgId), () => apiClient.flow.setupOptions(orgId), !!orgId);
export const useReviewQueue = () => useFlowQuery(flowKeys.queue, () => apiClient.flow.reviewQueue());
export const useTaskActivity = (id: string) => useFlowQuery(flowKeys.activity(id), () => apiClient.flow.activity(id), !!id);
export const useProgressOverview = (orgId: string) =>
  useFlowQuery(flowKeys.overview(orgId), () => apiClient.flow.progressOverview(orgId), !!orgId);
export const useApprovers = (projectId: string) =>
  useFlowQuery(flowKeys.approvers(projectId), () => apiClient.flow.approvers(projectId), !!projectId);
export const useProjectFiles = (projectId: string) =>
  useFlowQuery(flowKeys.projectFiles(projectId), () => apiClient.flow.projectFiles(projectId), !!projectId);
export const useItemFiles = (id: string) => useFlowQuery(flowKeys.itemFiles(id), () => apiClient.flow.workItemFiles(id), !!id);
export const useGitHubConnection = (projectId: string) =>
  useFlowQuery(flowKeys.github(projectId), () => apiClient.flow.github(projectId), !!projectId);
/* ---- GitHub App: organization installation, repository / branch choice, activity feed */
export const useGitHubApp = (orgId: string) =>
  useFlowQuery(["flow", "github-app", orgId], () => apiClient.flow.githubApp.status(orgId), !!orgId);
const targetKey = (target: F.GitHubTarget) => ("projectId" in target ? `p:${target.projectId}` : `d:${target.draftId}`);
export const useGitHubRepositories = (target: F.GitHubTarget, installationId: string) =>
  useFlowQuery(["flow", "github-repos", targetKey(target), installationId],
    () => apiClient.flow.githubApp.repositories(target, installationId), !!installationId);
export const useGitHubBranches = (target: F.GitHubTarget, installationId: string, repository: string) =>
  useFlowQuery(["flow", "github-branches", targetKey(target), installationId, repository],
    () => apiClient.flow.githubApp.branches(target, installationId, repository), !!installationId && !!repository);
export const useGitHubFeed = (projectId: string, query: F.GitHubFeedQuery) =>
  useFlowQuery(["flow", "github-feed", projectId, query], () => apiClient.flow.githubApp.activity(projectId, query), !!projectId);
export const useTaskCommits = (id: string) =>
  useFlowQuery(flowKeys.taskCommits(id), () => apiClient.flow.taskCommits(id), !!id);
export const useProjectCommits = (projectId: string) =>
  useFlowQuery(flowKeys.projectCommits(projectId), () => apiClient.flow.projectCommits(projectId), !!projectId);
export const useProjectWorkItems = (projectId: string) =>
  useFlowQuery(flowKeys.projectItems(projectId), () => apiClient.work.projectItems(projectId), !!projectId);
export const useStructuredProgress = (projectId: string) =>
  useFlowQuery(flowKeys.structured(projectId), () => apiClient.work.structuredProgress(projectId), !!projectId);
/** The caller's own tasks, refreshed on focus (the board). */
export const useMyBoardItems = () => useFlowQuery(devKeys.myWork, () => apiClient.work.mine());

/** Runs a change, then refreshes flow and developer data (one change moves lists, counts and progress). */
export function useFlowMutation<A, R>(fn: (args: A) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: flowKeys.all });
      void client.invalidateQueries({ queryKey: devKeys.all });
      for (const key of ["progress-summary", "pending-reviews", "projects", "project"]) {
        void client.invalidateQueries({ queryKey: [key] });
      }
    },
  });
}

/** Board moves: start (Created -> In progress). Submitting needs a note and evidence, so it opens the task page. */
export function useStartTask() {
  return useFlowMutation((item: W.WorkItemDto) => apiClient.work.start(item.id, item.version));
}

export function useReviewDecision() {
  return useFlowMutation((args: { id: string; revision: number; decision: "APPROVED" | "CHANGES_REQUESTED"; reason?: string }) =>
    apiClient.work.review(args.id, { submitted_revision: args.revision, decision: args.decision, reason: args.reason }));
}

export function useUploadFile(orgId: string) {
  return useFlowMutation((args: { file: File; kind: "PROJECT_DOCUMENT" | "SCREENSHOT"; projectId?: string; workItemId?: string }) =>
    apiClient.flow.uploadFile(orgId, args.file, args.kind, { projectId: args.projectId, workItemId: args.workItemId }));
}

export type { LoadState, F };
