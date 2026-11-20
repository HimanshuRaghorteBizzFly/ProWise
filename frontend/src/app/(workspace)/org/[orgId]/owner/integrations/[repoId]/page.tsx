"use client";

import React from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, GitBranch, Pause, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { AdminButton, Avatar, LinkRow, NotFoundState, PageFrame, Panel, StatPill, formatDateTime, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { HealthBadge } from "@/components/delivery/DeliveryUI";
import { OrgGate, SyncStatusBadge, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function OwnerRepositoryPage() {
  const { repoId } = useParams<{ repoId: string }>();
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const repo = useOrgConsoleStore((s) => s.repositories.find((r) => r.id === repoId));
  const sync = useOrgConsoleStore((s) => s.syncRepo);
  const setPaused = useOrgConsoleStore((s) => s.setRepoPaused);
  const back = { href: href("integrations"), label: "Back to integrations" };
  const crumbs = [{ label: "Owner", href: href() }, { label: "Integrations", href: href("integrations") }, { label: repo?.fullName ?? "Repository" }];

  if (status === "ready" && !repo) {
    return <OrgGate family="owner"><PageFrame crumbs={crumbs} back={back} title="Repository"><NotFoundState what="Repository" back={back} /></PageFrame></OrgGate>;
  }
  const project = lk.project(repo?.projectId);

  return (
    <OrgGate family="owner" need="repo.read">
      <PageFrame crumbs={crumbs} back={back} title={repo?.fullName ?? "Repository"} description={repo ? `Default branch ${repo.defaultBranch} · ${repo.visibility}` : undefined} status={status} onRetry={retry} skeleton="detail">
        {repo && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill label="Sync" value={<SyncStatusBadge status={repo.status} />} />
              <StatPill label="Last sync" value={timeAgo(repo.lastSyncAt)} />
              <StatPill label="Open PRs" value={repo.openPullRequests} />
              <StatPill label="Commits (7d)" value={repo.commits7d} />
            </div>
            {repo.error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-200">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span>{repo.error}</span>
              </div>
            )}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel className="xl:col-span-2" title="Details" icon={GitBranch} iconTone="cyan">
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div><dt className="text-[var(--color-text-muted)]">Connected (UTC)</dt><dd className="mt-1 font-semibold">{formatDateTime(repo.connectedAt)}</dd></div>
                  <div><dt className="text-[var(--color-text-muted)]">Connected by</dt><dd className="mt-1 flex items-center gap-2"><Avatar person={lk.member(repo.connectedById)} size="sm" /><span className="font-semibold">{lk.member(repo.connectedById)?.name}</span></dd></div>
                </dl>
                {project && (
                  <div className="mt-4">
                    <LinkRow href={href(`projects/${project.id}`)} className="border border-[var(--color-border)] bg-[var(--color-app-bg)] mx-0">
                      <span className="h-7 w-7 rounded-lg text-[9px] font-bold text-white flex items-center justify-center shrink-0" style={{ backgroundColor: project.color }}>{project.code}</span>
                      <span className="text-xs font-semibold truncate flex-1">{project.name}</span>
                      <HealthBadge health={project.health} />
                    </LinkRow>
                  </div>
                )}
              </Panel>
              <Panel title="Actions" icon={RefreshCw} iconTone="blue" className="self-start">
                <div className="space-y-2">
                  <AdminButton className="w-full" onClick={() => { sync("owner", repo.id); toast.success("Sync completed"); }}><RefreshCw className="w-3.5 h-3.5" /> Sync now</AdminButton>
                  {repo.status === "PAUSED" ? (
                    <AdminButton className="w-full" variant="outline" onClick={() => { setPaused("owner", repo.id, false); toast.success("Sync resumed"); }}><Play className="w-3.5 h-3.5" /> Resume sync</AdminButton>
                  ) : (
                    <AdminButton className="w-full" variant="outline" onClick={() => { setPaused("owner", repo.id, true); toast.success("Sync paused"); }}><Pause className="w-3.5 h-3.5" /> Pause sync</AdminButton>
                  )}
                </div>
              </Panel>
            </div>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
