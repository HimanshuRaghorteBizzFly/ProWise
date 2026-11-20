"use client";

import React from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, GitBranch, Pause, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { AdminButton, Avatar, NotFoundState, PageFrame, Panel, StatPill, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { GroupedBarChart } from "@/components/delivery/DeliveryCharts";
import { OrgGate, SyncStatusBadge, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function AdminRepositoryPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const href = useOrgHref("admin");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const repo = useOrgConsoleStore((s) => s.repositories.find((r) => r.id === repoId));
  const sync = useOrgConsoleStore((s) => s.syncRepo);
  const setPaused = useOrgConsoleStore((s) => s.setRepoPaused);
  const back = { href: href("integrations"), label: "Back to sync status" };
  const crumbs = [{ label: "Admin", href: href() }, { label: "Integrations & sync", href: href("integrations") }, { label: repo?.fullName ?? "Repository" }];

  if (status === "ready" && !repo) {
    return <OrgGate family="admin"><PageFrame crumbs={crumbs} back={back} title="Repository"><NotFoundState what="Repository" back={back} /></PageFrame></OrgGate>;
  }
  const activity = repo ? ["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => ({ label: d, primary: Math.max(0, Math.round(repo.commits7d / 5 + ((i * 7) % 5) - 2)), secondary: Math.round(repo.openPullRequests / 2) })) : [];

  return (
    <OrgGate family="admin" need="repo.connect">
      <PageFrame crumbs={crumbs} back={back} title={repo?.fullName ?? "Repository"} description={repo ? `${lk.project(repo.projectId)?.name ?? "Not linked"} · branch ${repo.defaultBranch}` : undefined} status={status} onRetry={retry} skeleton="detail">
        {repo && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill label="Status" value={<SyncStatusBadge status={repo.status} />} />
              <StatPill label="Last sync" value={timeAgo(repo.lastSyncAt)} />
              <StatPill label="Connected (UTC)" value={formatDateTime(repo.connectedAt)} />
              <StatPill label="Visibility" value={repo.visibility} />
            </div>
            {repo.error && <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-200"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{repo.error}</span></div>}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel className="xl:col-span-2" title="Evidence activity" description="Commits vs open pull requests (evidence only)" icon={GitBranch} iconTone="cyan">
                <GroupedBarChart data={activity} primaryLabel="Commits" secondaryLabel="Open PRs" primaryColor="#06B6D4" secondaryColor="#8B5CF6" height={210} />
              </Panel>
              <Panel title="Sync controls" icon={RefreshCw} iconTone="blue" className="self-start">
                <div className="space-y-2">
                  <AdminButton className="w-full" onClick={() => { sync("admin", repo.id); toast.success("Re-sync completed"); }}><RefreshCw className="w-3.5 h-3.5" /> Re-sync now</AdminButton>
                  {repo.status === "PAUSED" ? (
                    <AdminButton className="w-full" variant="outline" onClick={() => { setPaused("admin", repo.id, false); toast.success("Sync resumed"); }}><Play className="w-3.5 h-3.5" /> Resume</AdminButton>
                  ) : (
                    <AdminButton className="w-full" variant="outline" onClick={() => { setPaused("admin", repo.id, true); toast.success("Sync paused"); }}><Pause className="w-3.5 h-3.5" /> Pause</AdminButton>
                  )}
                  <div className="pt-3 border-t border-[var(--color-border)] flex items-center gap-2 text-[11px] text-[var(--color-text-muted)]"><Avatar person={lk.member(repo.connectedById)} size="sm" />Connected by {lk.member(repo.connectedById)?.name}</div>
                </div>
              </Panel>
            </div>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
