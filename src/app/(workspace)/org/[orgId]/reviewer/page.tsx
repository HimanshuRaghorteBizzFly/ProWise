"use client";

import { CheckCircle2, GitPullRequestArrow, RotateCcw } from "lucide-react";
import { useParams } from "next/navigation";

import {
  KpiGrid,
  KpiTile,
  PageFrame,
  Panel,
  StatusBadge,
  formatDateTime,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { useLiveDashboardData, summarizeQaDashboard } from "@/lib/live-dashboard-data";
import { useAuthStore } from "@/store/auth-store";

function reviewTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "APPROVED" || status === "MERGED") return "success";
  if (status === "PENDING") return "warning";
  if (status === "CHANGES_REQUESTED") return "danger";
  return "neutral";
}

export default function ReviewerDashboardPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const href = useRoleHref("reviewer");
  const activeOrgId = useAuthStore((state) => state.currentOrg.id);
  const requestOrgId = activeOrgId === orgId ? orgId : "";
  const { status, data, errorMessage, retry } = useLiveDashboardData("reviewer", requestOrgId);
  const codeReviews = data?.kind === "reviewer" ? data.codeReviews : [];
  const metrics = summarizeQaDashboard(codeReviews);

  return (
    <PageFrame
      crumbs={[{ label: "QA", href: href() }, { label: "Dashboard" }]}
      title="Review desk"
      description="Assigned code reviews read from the authenticated organization."
      badge="QA Reviewer"
      status={status}
      errorMessage={errorMessage}
      onRetry={retry}
    >
      <KpiGrid>
        <KpiTile
          label="Pending reviews"
          value={metrics.pending}
          icon={GitPullRequestArrow}
          tone="blue"
          chip={{ label: "Assigned", tone: "info" }}
          footer="Assigned to you"
        />
        <KpiTile
          label="Approved reviews"
          value={metrics.approved}
          icon={CheckCircle2}
          tone="emerald"
          footer="Assigned to you"
        />
        <KpiTile
          label="Changes requested"
          value={metrics.changesRequested}
          icon={RotateCcw}
          tone="rose"
          footer="Assigned to you"
        />
      </KpiGrid>

      <Panel title="Assigned reviews" description="Review status and pull-request details are persisted records; Git activity does not set project completion." icon={GitPullRequestArrow}>
        <div className="space-y-0.5">
          {codeReviews.length === 0 && (
            <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No assigned code reviews were returned.</p>
          )}
          {codeReviews.map((review) => (
            <div key={review.id} className="flex items-center gap-3 border-b border-[var(--color-border)] py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{review.title}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {review.repository_name ?? "Repository not recorded"}
                  {review.pr_number === null ? "" : ` · PR #${review.pr_number}`}
                  {` · ${formatDateTime(review.created_at)}`}
                </p>
              </div>
              {review.pr_url && (
                <a
                  href={review.pr_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Open PR
                </a>
              )}
              <StatusBadge label={review.status.replace(/_/g, " ").toLowerCase()} tone={reviewTone(review.status)} />
            </div>
          ))}
        </div>
      </Panel>
    </PageFrame>
  );
}
