"use client";

import React, { useState } from "react";
import type { CheckInDto } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VerificationReviewModal } from "./VerificationReviewModal";
import {
  Clock,
  TrendingDown,
  TrendingUp,
  GitCommit,
  GitPullRequest,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  ExternalLink,
  ShieldCheck,
  User,
  MessageSquare,
} from "lucide-react";

interface CheckInAuditTrailProps {
  checkIns: CheckInDto[];
  currentProjectPercent?: number;
  canReview?: boolean;
  onRefresh?: () => void;
}

export function CheckInAuditTrail({
  checkIns = [],
  currentProjectPercent = 0,
  canReview = false,
  onRefresh,
}: CheckInAuditTrailProps) {
  const [selectedForReview, setSelectedForReview] = useState<CheckInDto | null>(null);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "ACCEPTED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Verified & Accepted
          </span>
        );
      case "PENDING_VERIFICATION":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Verification
          </span>
        );
      case "CHANGES_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/50 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800">
            <AlertCircle className="w-3 h-3 text-orange-600" />
            Changes Requested
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
            <XCircle className="w-3 h-3 text-red-600" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-text-secondary)] bg-[var(--color-sidebar)] px-2 py-0.5 rounded border border-[var(--color-border)]">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            Progress Audit Trail & Check-In History
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Immutable append-only records with code evidence and Team Lead verification decisions.
          </p>
        </div>
        <span className="text-xs text-[var(--color-text-muted)] font-mono">
          {checkIns.length} recorded {checkIns.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {checkIns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-8 text-center bg-[var(--color-surface)]">
          <Clock className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2 opacity-50" />
          <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
            No Progress Check-Ins Yet
          </h4>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-sm mx-auto">
            Developer has not submitted any check-ins for this project. Once code is pushed and progress reported, entries will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {checkIns.map((item) => {
            const isDownward = Boolean(item.downward_reason);
            const isPending = item.status === "PENDING_VERIFICATION";

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 transition-colors ${
                  isPending
                    ? "border-amber-300/80 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-hover)]/30"
                }`}
              >
                {/* Header row: Percent, Method, Status, Date */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-[var(--color-border)]">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-lg font-bold text-[var(--color-text-primary)]">
                      {item.percent}%
                    </span>

                    {/* Blueprint T28: "Developer reported" label */}
                    <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                      Developer reported
                    </span>

                    {isDownward ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                        <TrendingDown className="w-3 h-3" /> Downward
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">
                        <TrendingUp className="w-3 h-3" /> v{item.revision_seq}
                      </span>
                    )}

                    {renderStatusBadge(item.status)}
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="block text-[11px] text-[var(--color-text-secondary)]">
                        {new Date(item.captured_at || item.created_at).toLocaleString()}
                      </span>
                      <span className="block text-[10px] text-[var(--color-text-muted)]">
                        by {item.author_name}
                      </span>
                    </div>

                    {/* Review Button for Team Lead if pending */}
                    {canReview && isPending && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedForReview(item)}
                        className="bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900 dark:text-amber-200 border-amber-300"
                      >
                        <ShieldCheck className="w-3 h-3 mr-1" /> Review
                      </Button>
                    )}
                  </div>
                </div>

                {/* Downward Reason Notice if present */}
                {isDownward && (
                  <div className="rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/30 p-2.5 mb-3 text-xs text-amber-900 dark:text-amber-200">
                    <strong>Reason for downward revision:</strong> {item.downward_reason}
                  </div>
                )}

                {/* Accomplished and Next Steps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[var(--color-text-secondary)] mb-3">
                  <div>
                    <span className="block font-semibold text-[var(--color-text-primary)] mb-0.5">
                      Accomplished
                    </span>
                    <p className="whitespace-pre-wrap">{item.accomplished}</p>
                  </div>
                  <div>
                    <span className="block font-semibold text-[var(--color-text-primary)] mb-0.5">
                      Next Steps
                    </span>
                    <p className="whitespace-pre-wrap">{item.next_steps}</p>
                  </div>
                </div>

                {/* Blockers & Projected Finish if present */}
                {(item.blockers || item.projected_finish) && (
                  <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-secondary)] mb-3 pt-2 border-t border-[var(--color-border)]/50">
                    {item.blockers && (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Blockers: {item.blockers}</span>
                      </div>
                    )}
                    {item.projected_finish && (
                      <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                        <span>Projected finish: <strong>{item.projected_finish}</strong></span>
                      </div>
                    )}
                  </div>
                )}

                {/* Code Evidence Links */}
                {item.evidence_items && item.evidence_items.length > 0 && (
                  <div className="pt-2 border-t border-[var(--color-border)]/50 space-y-1">
                    <span className="block text-[11px] font-semibold text-[var(--color-text-primary)] mb-1">
                      Code Evidence:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {item.evidence_items.map((ev, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded bg-[var(--color-sidebar)] px-2 py-1 text-[11px] border border-[var(--color-border)]"
                        >
                          {ev.type === "COMMIT" ? (
                            <GitCommit className="w-3 h-3 text-blue-500" />
                          ) : (
                            <GitPullRequest className="w-3 h-3 text-purple-500" />
                          )}
                          {ev.sha && <span className="font-mono text-[10px]">{ev.sha.substring(0, 7)}</span>}
                          <span className="truncate max-w-[200px]">{ev.title || "Evidence"}</span>
                          {ev.url && (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary-600 hover:underline inline-flex items-center"
                            >
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verification Decision Comments */}
                {item.reviewed_at && (
                  <div className="mt-3 pt-2.5 border-t border-[var(--color-border)] text-xs bg-[var(--color-sidebar)]/40 p-2.5 rounded-lg">
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] mb-1">
                      <span className="font-medium flex items-center gap-1 text-[var(--color-text-primary)]">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary-600" />
                        Verified by {item.verified_by_name || item.verified_by || "Team Lead"}
                      </span>
                      <span>{new Date(item.reviewed_at).toLocaleString()}</span>
                    </div>
                    {item.review_comment && (
                      <p className="text-[var(--color-text-secondary)] italic">
                        &quot;{item.review_comment}&quot;
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {selectedForReview && (
        <VerificationReviewModal
          isOpen={Boolean(selectedForReview)}
          onClose={() => setSelectedForReview(null)}
          checkin={selectedForReview}
          currentProjectPercent={currentProjectPercent}
          onDecided={() => {
            setSelectedForReview(null);
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
