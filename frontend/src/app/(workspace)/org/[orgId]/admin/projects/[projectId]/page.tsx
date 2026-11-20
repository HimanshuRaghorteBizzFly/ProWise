"use client";

import React from "react";
import { useParams } from "next/navigation";
import { GitBranch, Users } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { Avatar, ButtonLink, HealthBadge, LinkRow, NotFoundState, PageFrame, Panel, ProgressBar, StatPill, dueLabel, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { MemberStatusBadge, OrgGate, SyncStatusBadge, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function AdminProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const href = useOrgHref("admin");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const project = useOrgConsoleStore((s) => s.projects.find((p) => p.id === projectId));
  const repos = useOrgConsoleStore((s) => s.repositories);
  const back = { href: href("projects"), label: "Back to projects" };
  const crumbs = [{ label: "Admin", href: href() }, { label: "Projects overview", href: href("projects") }, { label: project?.name ?? "Project" }];

  if (status === "ready" && !project) {
    return <OrgGate family="admin"><PageFrame crumbs={crumbs} back={back} title="Project"><NotFoundState what="Project" back={back} /></PageFrame></OrgGate>;
  }
  const team = lk.team(project?.teamId);
  const linked = repos.filter((r) => r.projectId === projectId);
  const due = project ? dueLabel(project.dueDate, project.status === "COMPLETED") : null;

  return (
    <OrgGate family="admin" need="project.read">
      <PageFrame crumbs={crumbs} back={back} title={project?.name ?? "Project"} description={project?.summary} status={status} onRetry={retry} skeleton="detail" actions={<ButtonLink href={href("integrations/connect")} variant="outline"><GitBranch className="w-3.5 h-3.5" /> Connect repository</ButtonLink>}>
        {project && due && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatPill label="Health" value={<HealthBadge health={project.health} />} />
              <StatPill label="Progress" value={`${project.progress}%`} />
              <StatPill label="Delivery" value={due.label} tone={due.tone === "danger" ? "danger" : "neutral"} />
              <StatPill label="Manager" value={lk.member(project.managerId)?.name ?? "—"} />
            </div>
            <Panel title="Progress" description="Approved progress reported by the project team"><ProgressBar value={project.progress} planned={project.plannedProgress} color={project.color} showLabel /></Panel>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Panel title={team ? `Team · ${team.name}` : "Team"} icon={Users} iconTone="violet" action={team ? { label: "Manage team", href: href(`teams/${team.id}`) } : undefined}>
                <div className="space-y-0.5">
                  {(team?.memberIds ?? []).map((id) => {
                    const m = lk.member(id);
                    return m ? <LinkRow key={id} href={href(`members/${id}`)}><Avatar person={m} size="sm" /><span className="text-xs font-semibold truncate flex-1">{m.name}</span><MemberStatusBadge status={m.status} /></LinkRow> : null;
                  })}
                </div>
              </Panel>
              <Panel title="Repositories" icon={GitBranch} iconTone="cyan">
                <div className="space-y-0.5">
                  {linked.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No repositories linked.</p>}
                  {linked.map((r) => <LinkRow key={r.id} href={href(`integrations/${r.id}`)}><div className="min-w-0 flex-1"><p className="text-xs font-mono font-semibold truncate">{r.fullName}</p><p className="text-[11px] text-[var(--color-text-muted)]">synced {timeAgo(r.lastSyncAt)}</p></div><SyncStatusBadge status={r.status} /></LinkRow>)}
                </div>
              </Panel>
            </div>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
