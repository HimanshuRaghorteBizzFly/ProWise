"use client";

import React, { useMemo } from "react";
import { GitBranch, Github, Webhook } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { SYNC_EVENTS } from "@/mocks/org-console";
import { DataTable, PageFrame, Panel, StatPill, StatusBadge, SurfaceCard, formatDate, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { GaugeRing, GroupedBarChart } from "@/components/delivery/DeliveryCharts";
import { OrgGate, SyncStatusBadge, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function OwnerIntegrationsPage() {
  const href = useOrgHref("owner");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const github = useOrgConsoleStore((s) => s.github);
  const all = useOrgConsoleStore((s) => s.repositories);
  const repos = useMemo(() => (forceEmpty ? [] : all), [all, forceEmpty]);

  return (
    <OrgGate family="owner" need="repo.read">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Integrations (GitHub)" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Integrations (GitHub)"
        description="GitHub is evidence only — commits and pull requests never set project progress."
        status={status}
        onRetry={retry}
      >
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <Panel title="GitHub app" description={github.installation} icon={Github} iconTone="blue">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={github.status === "CONNECTED" ? "Connected" : github.status === "DEGRADED" ? "Degraded" : "Disconnected"} tone={github.status === "CONNECTED" ? "success" : github.status === "DEGRADED" ? "warning" : "danger"} dot />
                <span className="text-[11px] text-[var(--color-text-muted)]">@{github.account} · since {formatDate(github.connectedAt, true)} by {lk.member(github.connectedById)?.name}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">{github.scopes.map((sc) => <span key={sc} className="rounded-md border border-[var(--color-border)] bg-[var(--color-app-bg)] px-1.5 py-0.5 font-mono text-[10px]">{sc}</span>)}</div>
              <div className="grid grid-cols-2 gap-2">
                <StatPill label="Repositories" value={repos.length} />
                <StatPill label="API rate used" value={`${github.rateLimitUsed}%`} />
              </div>
              <p className="text-[11px] text-[var(--color-text-muted)]">Only the owner can re-authorize or remove the GitHub app. Admins connect repositories.</p>
            </div>
          </Panel>
          <SurfaceCard className="p-5 flex flex-col items-center justify-center gap-2">
            <GaugeRing value={github.webhookHealth} color={github.webhookHealth >= 98 ? "#10B981" : "#F59E0B"} label="webhook success" size={140} />
            <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1"><Webhook className="w-3.5 h-3.5" />Last 7 days</p>
          </SurfaceCard>
          <Panel title="Sync events" description="Deliveries vs failures" icon={GitBranch} iconTone="cyan">
            <GroupedBarChart data={SYNC_EVENTS} primaryLabel="Delivered" secondaryLabel="Failed" primaryColor="#06B6D4" secondaryColor="#F43F5E" height={200} />
          </Panel>
        </div>
        <Panel title="Connected repositories" description="Open a repository to see its sync detail" icon={GitBranch} bodyClassName="p-0">
          <DataTable
            rows={repos}
            rowHref={(r) => href(`integrations/${r.id}`)}
            empty={{ icon: GitBranch, title: "No repositories", description: "Admins can connect repositories to projects." }}
            columns={[
              { key: "n", header: "Repository", className: "w-[55%] md:w-[36%]", render: (r) => <div className="min-w-0"><p className="font-semibold truncate font-mono text-[11px]">{r.fullName}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{lk.project(r.projectId)?.name ?? "Not linked"}</p></div> },
              { key: "s", header: "Sync", render: (r) => <SyncStatusBadge status={r.status} /> },
              { key: "l", header: "Last sync", hideBelow: "md", render: (r) => timeAgo(r.lastSyncAt) },
              { key: "p", header: "Open PRs", hideBelow: "lg", render: (r) => r.openPullRequests },
              { key: "c", header: "Commits 7d", hideBelow: "xl", render: (r) => r.commits7d },
            ]}
          />
        </Panel>
      </PageFrame>
    </OrgGate>
  );
}
