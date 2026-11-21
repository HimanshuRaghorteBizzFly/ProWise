"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  BellRing,
  MessageSquareText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  User,
  GitCommit,
  ExternalLink,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminButton,
  DataTable,
  PageFrame,
  Panel,
  ProgressBar,
  SegmentTabs,
  StatusBadge,
  SurfaceCard,
  formatDateTime,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { apiClient, ApiError } from "@/lib/api";
import type { PendingReviewDto, CheckInDto } from "@/types/api";
import { VerificationReviewModal } from "@/features/projects/VerificationReviewModal";
import { Button } from "@/components/ui/button";

type Filter = "PENDING" | "ALL";

export default function TeamLeadCheckInsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  const href = useRoleHref("lead");

  const [pendingReviews, setPendingReviews] = useState<PendingReviewDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [selectedReview, setSelectedReview] = useState<PendingReviewDto | null>(null);

  const fetchPendingReviews = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    try {
      const list = await apiClient.pendingReviews(orgId);
      setPendingReviews(list);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to load pending reviews.";
      toast.error("Could not fetch reviews", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchPendingReviews();
  }, [fetchPendingReviews]);

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "My team" }, { label: "Check-in Reviews" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Team Lead Progress Verification"
      description="Review developer code progress submissions against GitHub evidence. Approving updates the project baseline while preserving the Developer Reported method."
    >
      <div className="space-y-4">
        {/* Metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SurfaceCard className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-[var(--color-text-secondary)]">Pending Verifications</span>
              <div className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
                {pendingReviews.length}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-[var(--color-text-secondary)]">Verification Method</span>
              <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-1">
                Developer Reported
              </div>
              <span className="text-[10px] text-[var(--color-text-muted)]">Preserved on approval</span>
            </div>
            <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-[var(--color-text-secondary)]">Queue Actions</span>
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={fetchPendingReviews} disabled={isLoading}>
                  <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? "animate-spin" : ""}`} /> Refresh Queue
                </Button>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </SurfaceCard>
        </div>

        {/* Reviews Table */}
        <SurfaceCard className="overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border)] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Developer Submissions Awaiting Verification
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Review code commits and verify submitted progress before it appears on the project tracker.
              </p>
            </div>
            <span className="text-xs font-mono text-[var(--color-text-muted)]">
              {pendingReviews.length} pending
            </span>
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            {pendingReviews.length === 0 ? (
              <div className="p-12 text-center">
                <ShieldCheck className="w-10 h-10 text-[var(--color-text-muted)] mx-auto mb-2 opacity-40" />
                <h4 className="text-sm font-medium text-[var(--color-text-primary)]">
                  All Caught Up!
                </h4>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-sm mx-auto">
                  No pending developer submissions require verification at this time.
                </p>
              </div>
            ) : (
              pendingReviews.map((item) => (
                <div
                  key={item.checkin.id}
                  className="p-4 hover:bg-[var(--color-hover)]/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                        {item.project_key}
                      </span>
                      <h4 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
                        {item.project_name}
                      </h4>
                      <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-[var(--color-text-muted)] px-1.5 py-0.5 rounded">
                        Mode {item.mode}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)] flex-wrap">
                      <span className="flex items-center gap-1 font-medium text-[var(--color-text-primary)]">
                        <User className="w-3.5 h-3.5 text-primary-600" />
                        {item.author_name}
                      </span>
                      <span>
                        Submitted: {new Date(item.submitted_at).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-1 italic">
                      Accomplished: &quot;{item.checkin.accomplished}&quot;
                    </p>

                    {item.checkin.evidence_items && item.checkin.evidence_items.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400">
                        <GitCommit className="w-3 h-3" />
                        <span>{item.checkin.evidence_items.length} commit/PR evidence attached</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-xs text-[var(--color-text-secondary)]">Submitted Progress</div>
                      <div className="text-lg font-mono font-bold text-primary-600 dark:text-primary-400">
                        {item.checkin.percent}%
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">
                        Baseline: {item.current_project_percent}%
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => setSelectedReview(item)}
                      className="bg-primary-600 hover:bg-primary-700 text-white"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                      Review &amp; Verify
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </SurfaceCard>
      </div>

      {/* Verification Review Modal */}
      {selectedReview && (
        <VerificationReviewModal
          isOpen={Boolean(selectedReview)}
          onClose={() => setSelectedReview(null)}
          checkin={selectedReview.checkin}
          currentProjectPercent={selectedReview.current_project_percent}
          onDecided={() => {
            setSelectedReview(null);
            fetchPendingReviews();
          }}
        />
      )}
    </PageFrame>
  );
}
