"use client";

import React, { useState } from "react";
import { Project, IndividualCheckIn } from "@/types";
import { useProjectStore } from "@/store/project-store";
import { validateCheckInSubmission } from "@/lib/progress";
import { CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

interface CheckInFormProps {
  project: Project;
  onSuccess?: () => void;
}

export function CheckInForm({ project, onSuccess }: CheckInFormProps) {
  const { checkIns, submitCheckIn, requestDeliveryReview } = useProjectStore();
  const projectCheckIns = checkIns.filter((c) => c.projectId === project.id);
  const latestAccepted = projectCheckIns
    .filter((c) => c.verificationStatus === "ACCEPTED")
    .sort((a, b) => b.version - a.version)[0];

  const [percent, setPercent] = useState<number>(project.lastProgressPercent || 0);
  const [accomplished, setAccomplished] = useState("");
  const [nextSteps, setNextSteps] = useState("");
  const [projectedFinish, setProjectedFinish] = useState(project.targetDate);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [newBlocker, setNewBlocker] = useState("");
  const [downwardReason, setDownwardReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isDownward = latestAccepted && percent < latestAccepted.percent;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validateCheckInSubmission({
      newPercent: percent,
      previousAcceptedPercent: latestAccepted?.percent ?? 0,
      downwardRevisionReason: downwardReason,
      accomplishedSummary: accomplished,
      nextStepsSummary: nextSteps,
      targetFinishDate: projectedFinish,
    });

    if (!validation.isValid) {
      setError(validation.errorMessage || "Invalid submission");
      return;
    }

    submitCheckIn(
      project.id,
      project.accountableOwnerId || "usr-developer",
      percent,
      accomplished,
      nextSteps,
      blockers,
      projectedFinish,
      evidence || undefined,
      isDownward ? downwardReason : undefined
    );


    setSubmitted(true);
    if (onSuccess) onSuccess();
  };

  const handleRequestDelivery = () => {
    requestDeliveryReview(project.id, project.accountableOwnerId || "user-dev-1");
  };

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--color-border)]">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Submit Progress Check-In</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Report accomplishments, next steps, and update progress for {project.name}.
          </p>
        </div>
        <div className="text-right">
          <span className="text-xs text-[var(--color-text-secondary)]">Current Baseline:</span>
          <div className="text-sm font-bold text-primary-600 dark:text-primary-400">
            {project.lastProgressPercent}%
          </div>
        </div>
      </div>

      {submitted ? (
        <div className="rounded-lg bg-green-50 dark:bg-green-950/40 p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-green-900 dark:text-green-200">
            Check-In Recorded Successfully!
          </h4>
          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
            New progress stands at {percent}%.
          </p>
          {percent === 100 && (
            <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
              <p className="text-xs text-green-800 dark:text-green-300 mb-2 font-medium">
                Milestone 100% achieved! You can request final delivery acceptance review now.
              </p>
              <button
                onClick={handleRequestDelivery}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm"
              >
                Request Delivery Review <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            onClick={() => setSubmitted(false)}
            className="mt-3 text-xs text-primary-600 hover:underline block mx-auto"
          >
            Submit Another Update
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <div className="flex justify-between text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              <span>Progress Percentage</span>
              <span className="font-bold text-[var(--color-text-primary)]">{percent}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={percent}
              onChange={(e) => setPercent(Number(e.target.value))}
              className="w-full accent-primary-600 cursor-pointer"
            />
          </div>

          {isDownward && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/30 p-3">
              <label className="block text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">
                Downward Revision Explanation (Mandatory)
              </label>
              <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">
                Progress decreased from {latestAccepted?.percent}%. State the scope discovery, test regression, or reason.
              </p>
              <textarea
                value={downwardReason}
                onChange={(e) => setDownwardReason(e.target.value)}
                placeholder="e.g., Uncovered legacy authentication compatibility issues during integration testing..."
                rows={2}
                className="w-full rounded-md border border-amber-300 dark:border-amber-800 bg-[var(--color-surface)] p-2 text-xs text-[var(--color-text-primary)] outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Accomplished (What got done)
            </label>
            <textarea
              value={accomplished}
              onChange={(e) => setAccomplished(e.target.value)}
              placeholder="e.g., Completed API authorization endpoints and connected Stripe webhook listeners..."
              rows={2}
              required
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs text-[var(--color-text-primary)] outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Next Steps (Upcoming targets)
            </label>
            <textarea
              value={nextSteps}
              onChange={(e) => setNextSteps(e.target.value)}
              placeholder="e.g., Implement rate limiting and finish integration tests..."
              rows={2}
              required
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2 text-xs text-[var(--color-text-primary)] outline-none focus:border-primary-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Projected Completion Date
              </label>
              <input
                type="date"
                value={projectedFinish}
                onChange={(e) => setProjectedFinish(e.target.value)}
                required
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
                Verification Artifact / PR Link (Optional)
              </label>
              <input
                type="text"
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                placeholder="https://github.com/org/repo/pull/42"
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1">
              Active Blockers
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newBlocker}
                onChange={(e) => setNewBlocker(e.target.value)}
                placeholder="Add blocker if any..."
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (newBlocker.trim()) {
                    setBlockers([...blockers, newBlocker.trim()]);
                    setNewBlocker("");
                  }
                }}
                className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--color-hover)]"
              >
                Add
              </button>
            </div>
            {blockers.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {blockers.map((b, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-2 py-0.5 text-[11px]"
                  >
                    {b}
                    <button
                      type="button"
                      onClick={() => setBlockers(blockers.filter((_, i) => i !== idx))}
                      className="hover:font-bold"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 text-xs shadow-sm transition-colors"
          >
            Submit Check-In
          </button>
        </form>
      )}
    </div>
  );
}
