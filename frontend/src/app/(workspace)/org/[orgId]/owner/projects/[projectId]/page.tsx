"use client";

import React from "react";
import { useParams } from "next/navigation";
import { FolderKanban, GitBranch, ShieldAlert, Users } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import {
  Avatar,
  HealthBadge,
  LinkRow,
  NotFoundState,
  PageFrame,
  Panel,
  SeverityBadge,
  StatPill,
  dueLabel,
  formatDate,
  useDemoLoad,
} from "@/components/delivery/DeliveryUI";
import { GaugeRing } from "@/components/delivery/DeliveryCharts";
import { OrgGate, RoleChip, SyncStatusBadge, timeAgo, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function OwnerProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const href = useOrgHref("owner");
  const { status, retry } = useDemoLoad();
  const lk = useOrgLookups();
  const project = useOrgConsoleStore((s) => s.projects.find((p) => p.id === projectId));
  const risks = useOrgConsoleStore((s) => s.risks);
  const repos = useOrgConsoleStore((s) => s.repositories);
  const back = { href: href("projects"), label: "Back to portfolio" };
  const crumbs = [{ label: "Owner", href: href() }, { label: "Projects portfolio", href: href("projects") }, { label: project?.name ?? "Project" }];

  if (status === "ready" && !project) {
    return <OrgGate family="owner"><PageFrame crumbs={crumbs} back={back} title="Project"><NotFoundState what="Project" back={back} /></PageFrame></OrgGate>;
  }

  const team = lk.team(project?.teamId);
  const projectRisks = risks.filter((r) => r.projectId === projectId);
  const projectRepos = repos.filter((r) => r.projectId === projectId);
  const due = project ? dueLabel(project.dueDate, project.status === "COMPLETED") : null;

  return (
    <OrgGate family="owner" need="project.read">
      <PageFrame crumbs={crumbs} back={back} title={project?.name ?? "Project"} description={project ? `${project.code} · ${team?.name} · ${project.mode === "INDIVIDUAL" ? "Individual" : "Structured"} mode` : undefined} status={status} onRetry={retry} skeleton="detail">
        {project && due && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              <StatPill label="Health" value={<HealthBadge health={project.health} />} />
              <StatPill label="Progress" value={`${project.progress}%`} tone={project.progress >= project.plannedProgress ? "success" : "warning"} />
              <StatPill label="Planned" value={`${project.plannedProgress}%`} />
              <StatPill label="Start" value={formatDate(project.startDate, true)} />
              <StatPill label="Delivery" value={due.label} tone={due.tone === "danger" ? "danger" : "neutral"} />
              <StatPill label="Open blockers" value={project.openBlockers} tone={project.openBlockers ? "danger" : "success"} />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <Panel title="Completion" icon={FolderKanban} iconTone="emerald">
                <GaugeRing value={project.progress} color={project.color} label="approved" size={140} />
                <p className="mt-3 text-xs text-center text-[var(--color-text-secondary)]">{project.summary}</p>
              </Panel>
              <Panel title="Ownership" icon={Users} iconTone="violet">
                <div className="space-y-0.5">
                  <LinkRow href={href(`members/${project.managerId}`)}>
                    <Avatar person={lk.member(project.managerId)} size="sm" />
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{lk.member(project.managerId)?.name}</p><p className="text-[11px] text-[var(--color-text-muted)]">Project manager</p></div>
                    <RoleChip role={lk.role(lk.member(project.managerId)?.roleId)} />
                  </LinkRow>
                  {team && (
                    <LinkRow href={href(`teams/${team.id}`)}>
                      <span className="h-6 w-6 rounded-md shrink-0" style={{ backgroundColor: team.color }} />
                      <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{team.name}</p><p className="text-[11px] text-[var(--color-text-muted)]">{team.memberIds.length} members · lead {lk.member(team.leadId)?.name}</p></div>
                    </LinkRow>
                  )}
                </div>
              </Panel>
              <Panel title="Repositories" icon={GitBranch} iconTone="cyan">
                <div className="space-y-0.5">
                  {projectRepos.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No repositories linked.</p>}
                  {projectRepos.map((r) => (
                    <LinkRow key={r.id} href={href(`integrations/${r.id}`)}>
                      <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{r.fullName}</p><p className="text-[11px] text-[var(--color-text-muted)]">synced {timeAgo(r.lastSyncAt)} · {r.openPullRequests} open PRs</p></div>
                      <SyncStatusBadge status={r.status} />
                    </LinkRow>
                  ))}
                </div>
              </Panel>
            </div>
            <Panel title="Risks" icon={ShieldAlert} iconTone="rose">
              {projectRisks.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No open risks.</p>}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {projectRisks.map((r) => (
                  <div key={r.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold">{r.title}</p><SeverityBadge severity={r.severity} /></div>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">{r.mitigation}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Owner {lk.member(r.ownerId)?.name} · raised {formatDate(r.raisedAt)}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </>
        )}
      </PageFrame>
    </OrgGate>
  );
}
