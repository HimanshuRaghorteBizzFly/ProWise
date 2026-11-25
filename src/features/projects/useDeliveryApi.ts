"use client";

import { useCallback, useEffect, useState } from "react";
import { apiClient } from "@/lib/api";
import type {
  AcceptanceDecisionRequestDto,
  AcceptanceRequestDto,
  AcceptanceSubmissionRequestDto,
  CloseProjectRequestDto,
  CreateBlockerRequestDto,
  ProjectBlockerDto,
  ProjectClosureDto,
  ProjectDeliveryStatusDto,
  ProjectLifecycleHistoryDto,
  ReopenProjectRequestDto,
} from "@/types/api";

export function useDeliveryApi(projectId?: string) {
  const [status, setStatus] = useState<ProjectDeliveryStatusDto | null>(null);
  const [requests, setRequests] = useState<AcceptanceRequestDto[]>([]);
  const [blockers, setBlockers] = useState<ProjectBlockerDto[]>([]);
  const [history, setHistory] = useState<ProjectLifecycleHistoryDto[]>([]);
  const [closures, setClosures] = useState<ProjectClosureDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [statusRes, reqsRes, blkRes, histRes, closRes] = await Promise.all([
        apiClient.deliveryStatus(projectId),
        apiClient.acceptanceRequests(projectId),
        apiClient.projectBlockers(projectId),
        apiClient.projectLifecycleHistory(projectId),
        apiClient.projectClosures(projectId),
      ]);
      setStatus(statusRes);
      setRequests(reqsRes);
      setBlockers(blkRes);
      setHistory(histRes);
      setClosures(closRes);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load delivery lifecycle details.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestAcceptance = async (data: AcceptanceSubmissionRequestDto) => {
    if (!projectId) return;
    await apiClient.requestDeliveryAcceptance(projectId, data);
    await refresh();
  };

  const decideAcceptance = async (requestId: string, data: AcceptanceDecisionRequestDto) => {
    await apiClient.decideDeliveryAcceptance(requestId, data);
    await refresh();
  };

  const closeProject = async (data: CloseProjectRequestDto) => {
    if (!projectId) return;
    await apiClient.closeProjectLifecycle(projectId, data);
    await refresh();
  };

  const reopenProject = async (data: ReopenProjectRequestDto) => {
    if (!projectId) return;
    await apiClient.reopenProjectLifecycle(projectId, data);
    await refresh();
  };

  const transitionLifecycle = async (targetLifecycle: "ON_HOLD" | "ACTIVE", reason: string, expectedVersion: number) => {
    if (!projectId) return;
    await apiClient.transitionProjectLifecycle(projectId, {
      target_lifecycle: targetLifecycle,
      reason,
      expected_project_version: expectedVersion,
    });
    await refresh();
  };

  const createBlocker = async (data: CreateBlockerRequestDto) => {
    if (!projectId) return;
    await apiClient.createProjectBlocker(projectId, data);
    await refresh();
  };

  const waiveBlocker = async (blockerId: string, reason: string) => {
    if (!projectId) return;
    await apiClient.waiveProjectBlocker(projectId, blockerId, {
      blocker_ref: blockerId,
      reason,
    });
    await refresh();
  };

  const resolveBlocker = async (blockerId: string) => {
    if (!projectId) return;
    await apiClient.resolveProjectBlocker(projectId, blockerId);
    await refresh();
  };

  return {
    status,
    requests,
    blockers,
    history,
    closures,
    isLoading,
    error,
    refresh,
    requestAcceptance,
    decideAcceptance,
    closeProject,
    reopenProject,
    transitionLifecycle,
    createBlocker,
    waiveBlocker,
    resolveBlocker,
  };
}
