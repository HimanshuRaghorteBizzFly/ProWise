"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { apiClient, ApiError } from "@/lib/api";
import type { CheckInDto } from "@/types/api";
import { useAuthStore } from "@/store/auth-store";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingDown,
  GitCommit,
  GitPullRequest,
  ExternalLink,
  ShieldAlert,
  User,
  Calendar,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface VerificationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkin: CheckInDto | null;
  currentProjectPercent?: number | null;
  projectKey?: string;
  projectName?: string;
  onDecided?: () => void;
}

export function VerificationReviewModal({
  isOpen,
  onClose,
  checkin,
  currentProjectPercent = null,
  projectKey,
  projectName,
  onDecided,
}: VerificationReviewModalProps) {
  const { currentUser } = useAuthStore();
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!checkin) return null;

  const isSelfCheckin = currentUser?.id === checkin.author.user_id;

  const handleDecision = async (decision: "APPROVE" | "REJECT") => {
    if (isSelfCheckin) {
      toast.error("Separation of duties: You cannot verify your own check-in submission.");
      return;
    }

    if (decision === "REJECT" && !comment.trim()) {
      toast.error("Please provide review feedback explaining your decision.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.decideCheckIn(checkin.id, {
        decision,
        reason: comment.trim() ? comment.trim() : undefined,
        expected_version: checkin.version,
      });

      const label = decision === "APPROVE" ? "approved" : "rejected";

      toast.success(`Check-in submission ${label}`, {
        description:
          decision === "APPROVE"
            ? `Approved progress is now ${checkin.percent}% (developer reported).`
            : "The check-in was rejected with review feedback.",
      });

      onClose();
      if (onDecided) onDecided();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to record review decision.";
      toast.error("Review action failed", { description: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Team Lead Progress Verification"
      description={`Review check-in for [${projectKey ?? checkin.project_id}] ${projectName ?? ""}.`}
      className="max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <div className="space-y-4 pt-2">
        {/* Author & Progress Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-sidebar)]/30">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] mb-1">
              <User className="w-3.5 h-3.5" />
              <span>Submitted by</span>
            </div>
            <p className="font-semibold text-sm text-[var(--color-text-primary)]">
              {checkin.author.email ?? checkin.author.user_id ?? "Unknown"}
            </p>
            <div className="flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] mt-1">
              <Clock className="w-3 h-3" />
              <span>{new Date(checkin.submitted_at).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t md:border-t-0 md:border-l border-[var(--color-border)] pt-2 md:pt-0 md:pl-4">
            <div>
              <span className="text-xs text-[var(--color-text-secondary)] block">Current Baseline:</span>
              <span className="font-mono text-base font-bold text-[var(--color-text-muted)]">
                {currentProjectPercent === null ? "Not reported" : `${currentProjectPercent.toFixed(1)}%`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-[var(--color-text-secondary)] block">Submitted Progress:</span>
              <span className="font-mono text-xl font-extrabold text-primary-600 dark:text-primary-400">
                {checkin.percent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Self-verification guard */}
        {isSelfCheckin && (
          <div className="rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-xs flex items-center gap-2 text-red-800 dark:text-red-300">
            <ShieldAlert className="w-4 h-4 flex-shrink-0 text-red-600" />
            <span>
              <strong>Separation of Duties:</strong> You are the author of this submission. Progress must be verified by an independent Team Lead or Project Reviewer.
            </span>
          </div>
        )}

        {/* Downward Revision Notice if present */}
        {checkin.downward_reason && (
          <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
              <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
              <span>Downward Revision Reason</span>
            </div>
            <p className="text-amber-800 dark:text-amber-300 italic">
              &quot;{checkin.downward_reason}&quot;
            </p>
          </div>
        )}

        {/* Developer Narrative */}
        <div className="space-y-3">
          <div>
            <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
              Accomplished Work
            </h4>
            <div className="rounded border border-[var(--color-border)] p-2.5 text-xs text-[var(--color-text-primary)] bg-[var(--color-surface)] whitespace-pre-wrap">
              {checkin.accomplished}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">
              Next Steps
            </h4>
            <div className="rounded border border-[var(--color-border)] p-2.5 text-xs text-[var(--color-text-primary)] bg-[var(--color-surface)] whitespace-pre-wrap">
              {checkin.next_steps}
            </div>
          </div>

          {checkin.blockers && (
            <div>
              <h4 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-1">
                Identified Blockers
              </h4>
              <div className="rounded border border-amber-200 dark:border-amber-900/60 p-2.5 text-xs text-amber-800 dark:text-amber-300 bg-amber-50/50 dark:bg-amber-950/20 whitespace-pre-wrap">
                {checkin.blockers}
              </div>
            </div>
          )}

          {checkin.projected_finish && (
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
              <Calendar className="w-3.5 h-3.5" />
              <span>Projected Finish: <strong>{checkin.projected_finish}</strong></span>
            </div>
          )}
        </div>

        {/* Code Evidence Section */}
        <div className="rounded-lg border border-[var(--color-border)] p-3 space-y-2">
          <h4 className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
            <GitCommit className="w-3.5 h-3.5 text-primary-600" />
            Submitted Code Evidence
          </h4>

          <p className="whitespace-pre-wrap text-xs text-[var(--color-text-muted)] italic">
            {checkin.evidence || "No specific evidence attached with this submission."}
          </p>
        </div>

        {/* Team Lead Feedback Comments */}
        <div>
          <label className="block text-xs font-semibold text-[var(--color-text-primary)] mb-1">
            Reviewer Feedback / Comments
          </label>
          <Textarea
            rows={2}
            placeholder="Add comments on code quality, test verification, or requested changes..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={isSubmitting || isSelfCheckin}
            className="text-xs"
          />
        </div>

        {/* Review Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-[var(--color-border)]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDecision("REJECT")}
              disabled={isSubmitting || isSelfCheckin}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <XCircle className="w-3.5 h-3.5 mr-1" />
              Reject
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleDecision("APPROVE")}
              disabled={isSubmitting || isSelfCheckin}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Approve Submission
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
