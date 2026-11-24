"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { classifyFailure } from "@/lib/permissions";
import type {
  CreateProjectDto,
  ProjectDateChangeDto,
  ProjectDto,
  ProjectListQuery,
  ProjectOptionsDto,
  UpdateProjectDto,
} from "@/types/api";
import { toState, type LoadState } from "@/components/org-console/useRoleApi";

/** Task 2.1: project records on the real API (no sample fallback: these screens create and edit). */

const QUERY = { retry: false } as const;
const PAGE_SIZE = 25;

export type PortfolioFilters = Omit<ProjectListQuery, "cursor" | "limit">;

export interface PortfolioState {
  state: LoadState<ProjectDto[]>;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
}

/** The permitted portfolio, paged with the server cursor (deterministic name + id order). */
export function usePortfolio(orgId: string, filters: PortfolioFilters): PortfolioState {
  const query = useInfiniteQuery({
    queryKey: ["projects", orgId, filters],
    queryFn: ({ pageParam }) => apiClient.projects(orgId, { ...filters, cursor: pageParam, limit: PAGE_SIZE }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : undefined),
    ...QUERY,
  });
  let state: LoadState<ProjectDto[]>;
  if (query.isPending) state = { kind: "loading" };
  else if (query.error) {
    const kind = classifyFailure(query.error);
    state = kind === "forbidden" ? { kind: "forbidden" }
      : kind === "not-found" ? { kind: "access-lost" }
        : kind === "unauthenticated" ? { kind: "unauthenticated" }
          : { kind: "error", retry: () => void query.refetch() };
  } else {
    state = { kind: "ready", data: (query.data?.pages ?? []).flatMap((page) => page.items) };
  }
  return {
    state,
    hasMore: Boolean(query.hasNextPage),
    loadingMore: query.isFetchingNextPage,
    loadMore: () => void query.fetchNextPage(),
  };
}

export function useProject(orgId: string, projectId: string): LoadState<ProjectDto> {
  return toState(useQuery({
    queryKey: ["project", orgId, projectId],
    queryFn: () => apiClient.project(orgId, projectId),
    enabled: Boolean(projectId),
    ...QUERY,
  }));
}

export function useProjectOptions(orgId: string): LoadState<ProjectOptionsDto> {
  return toState(useQuery({ queryKey: ["project-options", orgId], queryFn: () => apiClient.projectOptions(orgId), ...QUERY }));
}

export function useProjectDateHistory(orgId: string, projectId: string): LoadState<ProjectDateChangeDto[]> {
  return toState(useQuery({
    queryKey: ["project-date-history", orgId, projectId],
    queryFn: () => apiClient.projectDateHistory(orgId, projectId),
    ...QUERY,
  }));
}

export function useReloadProjects(orgId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["projects", "project", "project-date-history"].map((key) => queryClient.invalidateQueries({ queryKey: [key, orgId] })),
    );
}

export function useProjectMutations(orgId: string) {
  const onSuccess = useReloadProjects(orgId);
  return {
    createProject: useMutation({ mutationFn: (body: CreateProjectDto) => apiClient.createProject(orgId, body), onSuccess }),
    updateProject: useMutation({
      mutationFn: (input: { id: string; body: UpdateProjectDto }) => apiClient.updateProject(orgId, input.id, input.body),
      onSuccess,
    }),
  };
}
