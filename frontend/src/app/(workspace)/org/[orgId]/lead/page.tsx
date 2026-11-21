"use client";

import { MessageSquareText, FolderKanban } from "lucide-react";
import { useParams } from "next/navigation";

import {
  ButtonLink,
  KpiGrid,
  KpiTile,
  LinkRow,
  PageFrame,
  Panel,
  formatDateTime,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { useLiveDashboardData, summarizeLeadDashboard } from "@/lib/live-dashboard-data";

export default function TeamLeadDashboardPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const href = useRoleHref("lead");
  const { status, data, errorMessage, retry } = useLiveDashboardData("lead", orgId);
  const pendingReviews = data?.kind === "lead" ? data.pendingReviews : [];
  const metrics = summarizeLeadDashboard(pendingReviews);

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "Dashboard" }]}
      title="Progress approvals"
      description="Pending developer check-ins assigned to your team-lead approval queue."
      badge="Team Lead"
      status={status}
      errorMessage={errorMessage}
      onRetry={retry}
      actions={<ButtonLink href={href("check-ins")}><MessageSquareText className="w-3.5 h-3.5" /> Check-ins</ButtonLink>}
    >
      <KpiGrid>
        <KpiTile
          label="Pending approvals"
          value={metrics.pendingApprovals}
          icon={MessageSquareText}
          tone="amber"
          chip={{ label: "Awaiting review", tone: "warning" }}
          footer="Check-ins"
          href={href("check-ins")}
        />
        <KpiTile
          label="Projects needing approval"
          value={metrics.projectsNeedingApproval}
          icon={FolderKanban}
          tone="blue"
          footer="Check-ins"
          href={href("check-ins")}
        />
      </KpiGrid>

      <Panel title="Pending check-ins" description="Approval queue returned for the authenticated team lead." icon={MessageSquareText} action={{ label: "All check-ins", href: href("check-ins") }}>
        <div className="space-y-0.5">
          {pendingReviews.length === 0 && (
            <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No check-ins are awaiting your approval.</p>
          )}
          {pendingReviews.map(({ checkin, project_key, project_name }) => (
            <LinkRow key={checkin.id} href={href("check-ins")}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{project_key} · {project_name}</p>
                <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                  {checkin.author.email} · submitted {formatDateTime(checkin.submitted_at)}
                </p>
              </div>
              <span className="text-sm font-semibold tabular-nums">{checkin.percent}%</span>
            </LinkRow>
          ))}
        </div>
      </Panel>
    </PageFrame>
  );
}
