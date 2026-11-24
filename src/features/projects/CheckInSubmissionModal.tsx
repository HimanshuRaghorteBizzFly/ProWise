"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { apiClient, ApiError } from "@/lib/api";
import type { GitHubActivityDto } from "@/types/api";
import {
  TrendingDown,
  GitCommit,
  GitPullRequest,
  AlertTriangle,
  Info,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

interface CheckInSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  projectKey: string;
  currentPercent: number | null;
  gitHubActivity?: GitHubActivityDto[];
  onSubmitted?: () => void;
}

export function CheckInSubmissionModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  projectKey,
  currentPercent,
  gitHubActivity = [],
  onSubmitted,
}: CheckInSubmissionModalProps) {
  const [percent, setPercent] = useState<number>(currentPercent ?? 0);
  const [accomplished, setAccomplished] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [blockers, setBlockers] = useState("");
  const [projectedFinish, setProjectedFinish] = useState("");
  const [downwardReason, setDownwardReason] = useState("");
  const [selectedCommitShas, setSelectedCommitShas] = useState<string[]>([]);
  const [customEvidenceUrl, setCustomEvidenceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDownward = currentPercent !== null && percent < currentPercent;

  const toggleCommitSelection = (sha: string) => {
    setSelectedCommitShas((prev) =>
      prev.includes(sha) ? prev.filter((s) => s !== sha) : [...prev, sha]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (percent < 0 || percent > 100) {
      toast.error("Progress percentage must be between 0 and 100.");
      return;
    }

    if (isDownward && (!downwardReason || downwardReason.trim().length === 0)) {
      toast.error("A reason is required when reducing progress (Domain Rule 9).");
      return;
    }

    if (!accomplished.trim()) {
      toast.error("Please describe what was accomplished.");
      return;
    }

    if (!nextSteps.trim()) {
      toast.error("Please describe next steps.");
      return;
    }

    const evidence = [
      ...selectedCommitShas.flatMap((sha) => {
        const activity = gitHubActivity.find((item) => item.sha === sha);
        return activity ? [`${activity.repository_name} ${sha}: ${activity.title}`] : [];
      }),
      ...(customEvidenceUrl.trim() ? [customEvidenceUrl.trim()] : []),
    ].join("\n");

    setIsSubmitting(true);
    try {
      const idempotencyKey = "chk-sub-" + crypto.randomUUID();
      const res = await apiClient.submitCheckIn(
        projectId,
        {
          percent: Number(percent),
          accomplished: accomplished.trim(),
          next_steps: nextSteps.trim(),
          blockers: blockers.trim() ? blockers.trim() : undefined,
          projected_finish: projectedFinish ? projectedFinish : undefined,
          downward_reason: isDownward ? downwardReason.trim() : undefined,
          evidence: evidence || undefined,
        },
        idempotencyKey
      );

      toast.success("Progress check-in recorded successfully", {
        description: `Submitted ${res.percent}% progress (${
          res.status === "PENDING" ? "Pending Team Lead review" : res.status.toLowerCase()
        }).`,
      });

      onClose();
      if (onSubmitted) onSubmitted();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to submit check-in.";
      toast.error("Submission failed", { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Submit Progress Check-In — [${projectKey}]`}
      description={`Report verified progress and evidence for ${projectName}.`}
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {/* Progress Value Header */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-sidebar)]/30 p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xs text-[var(--color-text-secondary)]">Current Approved Progress:</span>
              <span className="ml-2 font-mono font-bold text-sm text-[var(--color-text-primary)]">
                {currentPercent === null ? "Not reported" : `${currentPercent.toFixed(1)}%`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-[var(--color-text-secondary)]">New Progress:</span>
              <span className="ml-2 font-mono font-extrabold text-base text-primary-600 dark:text-primary-400">
                {percent.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={percent}
              onChange={(e) => setPercent(parseFloat(e.target.value) || 0)}
              className="w-full accent-primary-600 cursor-pointer h-2 bg-[var(--color-border)] rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] font-mono">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Downward revision warning and mandatory reason */}
        {isDownward && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs space-y-2 animate-in fade-in">
            <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
              <TrendingDown className="w-4 h-4 text-amber-600" />
              <span>Downward Progress Correction ({currentPercent}% → {percent}%)</span>
            </div>
            <p className="text-amber-800 dark:text-amber-300">
              A downward revision requires a mandatory explanatory reason per Domain Rule 9. History remains immutable and prior check-ins are preserved.
            </p>
            <div>
              <label className="block font-medium text-amber-900 dark:text-amber-200 mb-1">
                Reason for Downward Revision <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Discovered missing index bottleneck or race condition during load test..."
                value={downwardReason}
                onChange={(e) => setDownwardReason(e.target.value)}
                required={isDownward}
                className="bg-white dark:bg-black/40 border-amber-300 dark:border-amber-700 text-xs"
              />
            </div>
          </div>
        )}

        {/* 100% Notice */}
        {percent === 100 && (
          <div className="rounded-lg border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3 text-xs flex items-center gap-2 text-blue-800 dark:text-blue-300">
            <Info className="w-4 h-4 flex-shrink-0 text-blue-600" />
            <span>
              <strong>Note:</strong> Submitting 100% progress does <em>not</em> automatically mark the project Delivered or Closed. Delivery remains Active until formal sign-off.
            </span>
          </div>
        )}

        {/* Verification mode note */}
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] px-1">
          <ShieldCheck className="w-4 h-4 text-primary-600" />
          <span>Every check-in starts pending and updates official progress only after Team Lead approval.</span>
        </div>

        {/* Accomplishments */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
            Accomplishments <span className="text-red-500">*</span>
          </label>
          <Textarea
            rows={3}
            placeholder="What core work or milestones did you complete?"
            value={accomplished}
            onChange={(e) => setAccomplished(e.target.value)}
            required
            className="text-xs"
          />
        </div>

        {/* Next Steps */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
            Next Steps <span className="text-red-500">*</span>
          </label>
          <Textarea
            rows={2}
            placeholder="What will you tackle next?"
            value={nextSteps}
            onChange={(e) => setNextSteps(e.target.value)}
            required
            className="text-xs"
          />
        </div>

        {/* Blockers & Projected Finish */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
              Blockers (Optional)
            </label>
            <Input
              placeholder="Any impediments or waiting on third-parties?"
              value={blockers}
              onChange={(e) => setBlockers(e.target.value)}
              className="text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
              Projected Finish Date
            </label>
            <Input
              type="date"
              value={projectedFinish}
              onChange={(e) => setProjectedFinish(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        {/* GitHub Code Evidence Section */}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <GitCommit className="w-3.5 h-3.5 text-primary-600" />
              Attach GitHub Evidence (Optional)
            </h4>
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {selectedCommitShas.length} commit(s) selected
            </span>
          </div>

          {gitHubActivity.length > 0 ? (
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {gitHubActivity.slice(0, 10).map((act) => {
                const isSelected = act.sha ? selectedCommitShas.includes(act.sha) : false;
                return (
                  <div
                    key={act.id}
                    onClick={() => act.sha && toggleCommitSelection(act.sha)}
                    className={`flex items-center justify-between p-2 rounded text-xs cursor-pointer border transition-colors ${
                      isSelected
                        ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30"
                        : "border-[var(--color-border)] hover:bg-[var(--color-hover)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}} // Handled by div click
                        className="rounded accent-primary-600 cursor-pointer"
                      />
                      <span className="font-mono text-[10px] text-[var(--color-text-muted)]">
                        {act.sha ? act.sha.substring(0, 7) : "commit"}
                      </span>
                      <span className="font-medium text-[var(--color-text-primary)] truncate">
                        {act.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0 ml-2">
                      {new Date(act.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-[var(--color-text-muted)] italic">
              No recent GitHub commits found for this project. You can link a commit or PR URL below.
            </p>
          )}

          <div>
            <label className="block text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">
              External Commit or Pull Request URL
            </label>
            <Input
              placeholder="https://github.com/org/repo/pull/123 or commit URL"
              value={customEvidenceUrl}
              onChange={(e) => setCustomEvidenceUrl(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Progress Check-In"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
