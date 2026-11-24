import { useState, useCallback, useEffect } from "react";
import { apiClient, ApiError } from "@/lib/api";
import type {
  CheckInDto,
  ProgressSummaryDto,
  CheckInRequestDto,
  CheckInDecisionDto,
  GitHubActivityDto,
} from "@/types/api";
import { toast } from "sonner";

export function useProgressApi(projectId: string, _orgId?: string) {
  const [summary, setSummary] = useState<ProgressSummaryDto | null>(null);
  const [checkIns, setCheckIns] = useState<CheckInDto[]>([]);
  const [gitHubActivity, setGitHubActivity] = useState<GitHubActivityDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [sum, chks, gh] = await Promise.all([
        apiClient.progressSummary(projectId),
        apiClient.progressHistory(projectId),
        apiClient.projectGitHubActivity(projectId),
      ]);
      setSummary(sum);
      setCheckIns(chks);
      setGitHubActivity(gh);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load progress details.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const submitCheckIn = async (
    body: CheckInRequestDto,
    idempotencyKey?: string,
  ): Promise<CheckInDto> => {
    try {
      const result = await apiClient.submitCheckIn(projectId, body, idempotencyKey);
      toast.success("Progress check-in submitted", {
        description: `Recorded ${result.percent}% progress (${result.status === "PENDING" ? "Pending Team Lead review" : result.status.toLowerCase()}).`,
      });
      await fetchProgress();
      return result;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to submit check-in.";
      toast.error("Submission failed", { description: msg });
      throw err;
    }
  };

  const verifyCheckIn = async (
    checkinId: string,
    decision: CheckInDecisionDto,
  ): Promise<CheckInDto> => {
    try {
      const result = await apiClient.decideCheckIn(checkinId, decision);
      const action = decision.decision === "APPROVE" ? "approved" : "rejected";
      toast.success("Verification decision submitted", {
        description: `Check-in submission has been ${action}.`,
      });
      await fetchProgress();
      return result;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to verify check-in.";
      toast.error("Verification failed", { description: msg });
      throw err;
    }
  };

  return {
    summary,
    checkIns,
    gitHubActivity,
    isLoading,
    error,
    refresh: fetchProgress,
    submitCheckIn,
    verifyCheckIn,
  };
}
