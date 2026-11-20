"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { GitBranch, Plus, RefreshCw } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import type { SyncStatus } from "@/mocks/org-console";
import { ButtonLink, EmptyStateView, KpiGrid, KpiTile, PageFrame, SegmentTabs, StatusBadge, SurfaceCard, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { OrgGate, SYNC_COLOR, SyncStatusBadge, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

type F = "ALL" | SyncStatus;

export default function AdminIntegrationsPage() {
  const href = useOrgHref("admin");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const github = useOrgConsoleStore((s) => s.github);
  const all = useOrgConsoleStore((s) => s.repositories);
  const [filter, setFilter] = useState<F>("ALL");
  const repos = useMemo(() => (forceEmpty ? [] : all), [all, forceEmpty]);
  const rows = repos.filter((r) => filter === "ALL" || r.status === filter);
  const count = (s: SyncStatus) => repos.filter((r) => r.status === s).length;

  return (
    <OrgGate family="admin" need="repo.connect">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Integrations & sync" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Integrations & sync status"
        description={`GitHub app @${github.account} · ${github.status === "CONNECTED" ? "connected" : "degraded"}. Repository activity is evidence only.`}
        status={status}
        onRetry={retry}
        skeleton="list"
        actions={<ButtonLink href={href("integrations/connect")}><Plus className="w-3.5 h-3.5" /> Connect repository</ButtonLink>}
      >
        <KpiGrid>
          <KpiTile label="Healthy" value={count("HEALTHY")} icon={GitBranch} tone="emerald" footer="Syncing cleanly" href={href("integrations")} />
          <KpiTile label="Syncing" value={count("SYNCING")} icon={RefreshCw} tone="blue" footer="In progress" href={href("integrations")} />
          <KpiTile label="Failed" value={count("FAILED")} icon={GitBranch} tone="rose" chip={{ label: "Action", tone: "danger" }} footer="Fix credentials" href={href("integrations")} />
          <KpiTile label="Paused" value={count("PAUSED")} icon={GitBranch} tone="amber" footer="Resume when ready" href={href("integrations")} />
        </KpiGrid>
        <SegmentTabs<F> value={filter} onChange={setFilter} options={[{ value: "ALL", label: "All", count: repos.length }, { value: "FAILED", label: "Failed", count: count("FAILED") }, { value: "PAUSED", label: "Paused", count: count("PAUSED") }, { value: "SYNCING", label: "Syncing" }, { value: "HEALTHY", label: "Healthy" }]} />
        {rows.length === 0 ? (
          <SurfaceCard><EmptyStateView icon={GitBranch} title="No repositories here" description="Connect a repository to start syncing evidence." /></SurfaceCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-4">
            {rows.map((r) => (
              <Link key={r.id} href={href(`integrations/${r.id}`)} className="block rounded-xl">
                <SurfaceCard className="h-full p-4 space-y-2.5 border-t-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg" style={{ borderTopColor: SYNC_COLOR[r.status] }}>
                  <div className="flex items-start justify-between gap-2"><p className="text-xs font-mono font-semibold break-all">{r.fullName}</p><SyncStatusBadge status={r.status} /></div>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{lk.project(r.projectId)?.name ?? "Not linked to a project"}</p>
                  {r.error && <p className="text-[11px] text-rose-600 dark:text-rose-400 line-clamp-2">{r.error}</p>}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--color-border)]">
                    <StatusBadge label={`synced ${timeAgo(r.lastSyncAt)}`} tone="neutral" />
                    <StatusBadge label={`${r.openPullRequests} PRs`} tone="info" />
                    <StatusBadge label={`${r.commits7d} commits/7d`} tone="violet" />
                  </div>
                </SurfaceCard>
              </Link>
            ))}
          </div>
        )}
      </PageFrame>
    </OrgGate>
  );
}
