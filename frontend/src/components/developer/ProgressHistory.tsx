"use client";

import React from "react";
import { IndividualCheckIn, ProgressSnapshot } from "@/types";
import { Clock, TrendingUp, TrendingDown, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";

interface ProgressHistoryProps {
  checkIns?: IndividualCheckIn[];
  snapshots?: ProgressSnapshot[];
}

export function ProgressHistory({ checkIns = [], snapshots = [] }: ProgressHistoryProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--color-border)]">
        <h4 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          Audit Trail & Revision History
        </h4>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {checkIns.length} recorded entries
        </span>
      </div>

      <div className="space-y-3">
        {checkIns.length === 0 ? (
          <p className="text-xs text-[var(--color-text-secondary)] py-4 text-center">
            No check-in history available for this project yet.
          </p>
        ) : (
          checkIns
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((item, idx) => {
              const isDownward = Boolean(item.downwardRevisionReason);
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-[var(--color-border)] p-3 text-xs bg-[var(--color-sidebar)]/30 hover:bg-[var(--color-hover)] transition-colors"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[var(--color-text-primary)]">
                        {item.percent}%
                      </span>
                      {isDownward ? (
                        <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-semibold">
                          <TrendingDown className="w-3 h-3" /> Downward
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 rounded bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300 px-1.5 py-0.5 text-[10px] font-semibold">
                          <TrendingUp className="w-3 h-3" /> Progressed
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--color-text-muted)]">v{item.version}</span>
                    </div>
                    <span className="text-[11px] text-[var(--color-text-secondary)]">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <p className="text-[var(--color-text-secondary)] mb-1">
                    <strong className="text-[var(--color-text-primary)]">Accomplished:</strong> {item.accomplished}
                  </p>
                  <p className="text-[var(--color-text-secondary)] mb-1">
                    <strong className="text-[var(--color-text-primary)]">Next Steps:</strong> {item.nextSteps}
                  </p>

                  {isDownward && (
                    <div className="mt-1.5 rounded bg-amber-50 dark:bg-amber-950/30 p-2 text-amber-800 dark:text-amber-300 text-[11px] border border-amber-200 dark:border-amber-900">
                      <strong>Reason for downward revision:</strong> {item.downwardRevisionReason}
                    </div>
                  )}

                  {item.optionalEvidence && (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-primary-600 dark:text-primary-400">
                      <ExternalLink className="w-3 h-3" />
                      <a href={item.optionalEvidence} target="_blank" rel="noreferrer" className="hover:underline">
                        Artifact / Evidence: {item.optionalEvidence}
                      </a>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

