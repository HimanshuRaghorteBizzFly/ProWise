"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import type {
  CheckInDecisionDto,
  CheckInDto,
  CheckInRequestDto,
  PendingReviewDto,
  ProgressSummaryDto,
} from "@/types/api";
import { toState, type LoadState } from "@/components/org-console/useRoleApi";

/** Task 2.2: Individual check-ins and Team Lead approval on the real API (no sample fallback). */

const QUERY = { retry: false } as const;

export function useProgressSummary(projectId: string): LoadState<ProgressSummaryDto> {
  return toState(useQuery({
    queryKey: ["progress-summary", projectId],
    queryFn: () => apiClient.progressSummary(projectId),
    enabled: Boolean(projectId),
    ...QUERY,
  }));
}

export function usePendingReviews(orgId: string): LoadState<PendingReviewDto[]> {
  return toState(useQuery({
    queryKey: ["pending-reviews", orgId],
    queryFn: () => apiClient.pendingReviews(orgId),
    enabled: Boolean(orgId),
    ...QUERY,
  }));
}

/** Refreshes every view that shows a project's figure, pending entry or the approval queue. */
export function useReloadProgress() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      ["progress-summary", "pending-reviews", "project", "projects"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })),
    );
}

export function useSubmitCheckIn(projectId: string) {
  const reload = useReloadProgress();
  return useMutation<CheckInDto, unknown, { body: CheckInRequestDto; idempotencyKey: string }>({
    mutationFn: ({ body, idempotencyKey }) => apiClient.submitCheckIn(projectId, body, idempotencyKey),
    onSuccess: () => void reload(),
  });
}

export function useDecideCheckIn() {
  const reload = useReloadProgress();
  return useMutation<CheckInDto, unknown, { checkinId: string; body: CheckInDecisionDto }>({
    mutationFn: ({ checkinId, body }) => apiClient.decideCheckIn(checkinId, body),
    onSuccess: () => void reload(),
  });
}
