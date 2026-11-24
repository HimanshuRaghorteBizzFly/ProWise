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
import { toState, withFixture, type LoadState } from "@/components/org-console/useRoleApi";
import { PREVIEW_PENDING_REVIEWS, previewProgressSummary } from "@/lib/fixtures/preview-data";

/**
 * Task 2.2: Individual check-ins and Team Lead approval on the real API. Outside production, an unreachable API or
 * role preview shows labelled read-only sample data instead of an error (same rule as the other consoles).
 */

const QUERY = { retry: false } as const;

export function useProgressSummary(projectId: string): LoadState<ProgressSummaryDto> {
  return toState(useQuery({
    queryKey: ["progress-summary", projectId],
    queryFn: () => withFixture(() => apiClient.progressSummary(projectId), () => previewProgressSummary(projectId)),
    enabled: Boolean(projectId),
    ...QUERY,
  }));
}

export function usePendingReviews(orgId: string): LoadState<PendingReviewDto[]> {
  return toState(useQuery({
    queryKey: ["pending-reviews", orgId],
    queryFn: () => withFixture(() => apiClient.pendingReviews(orgId), () => PREVIEW_PENDING_REVIEWS),
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
