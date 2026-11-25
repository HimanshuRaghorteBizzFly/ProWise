"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, FolderKanban, OctagonAlert } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { AdminSelect, EmptyStateView, PageFrame, Panel, StatusBadge } from "@/components/delivery/DeliveryUI";
import { DevGate, SectionGate, dateTimeText } from "@/components/developer/DevUI";
import { toState } from "@/components/org-console/useRoleApi";
import { usePortfolio } from "@/components/projects/useProjectApi";
import { apiClient } from "@/lib/api";
import type { ProjectDto } from "@/types/api";
import { ProjectTasksPanel } from "./ProjectFlowPanels";
import { flowKeys } from "./useFlowApi";

/** Project Manager pages on real data: every Team project's tasks, and the open blockers across them. */

function useTeamProjects(orgId: string) {
  return usePortfolio(orgId, { mode: "STRUCTURED" });
}

export function AllWorkView({ orgId }: { orgId: string }) {
  const home = `/org/${orgId}/manager`;
  const portfolio = useTeamProjects(orgId);
  const [projectId, setProjectId] = useState("");
  return (
    <PageFrame crumbs={[{ label: "Manager", href: home }, { label: "All Work" }]} title="All Work"
      description="Tasks of your Team projects by status: Created, In progress, In review, Completed.">
      <DevGate state={portfolio.state} what="Projects" back={{ href: home, label: "Back to dashboard" }}>
        {(projects: ProjectDto[]) => {
          const active = projects.filter((p) => !p.archived);
          if (active.length === 0) {
            return <EmptyStateView icon={FolderKanban} title="No Team projects" description="Create a Structured project to plan tasks." />;
          }
          const selected = active.find((p) => p.id === projectId) ?? active[0];
          return (
            <div className="space-y-4">
              <AdminSelect label="Project" value={selected.id} onChange={(e) => setProjectId(e.target.value)} className="sm:max-w-sm">
                {active.map((p) => <option key={p.id} value={p.id}>{p.key} · {p.name}</option>)}
              </AdminSelect>
              <ProjectTasksPanel projectId={selected.id} />
              <Link href={`${home}/projects/${selected.id}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Open project</Link>
            </div>
          );
        }}
      </DevGate>
    </PageFrame>
  );
}

export function BlockersView({ orgId }: { orgId: string }) {
  const home = `/org/${orgId}/manager`;
  const portfolio = useTeamProjects(orgId);
  return (
    <PageFrame crumbs={[{ label: "Manager", href: home }, { label: "Blockers" }]} title="Blockers"
      description="Open blockers raised by developers on tasks. Blockers are separate from the task status and stay until resolved.">
      <DevGate state={portfolio.state} what="Projects" back={{ href: home, label: "Back to dashboard" }}>
        {(projects: ProjectDto[]) => {
          const active = projects.filter((p) => !p.archived);
          if (active.length === 0) {
            return <EmptyStateView icon={CheckCircle2} title="No Team projects" description="Blockers are raised on Team project tasks." />;
          }
          return <div className="space-y-4">{active.map((p) => <ProjectBlockers key={p.id} project={p} />)}</div>;
        }}
      </DevGate>
    </PageFrame>
  );
}

function ProjectBlockers({ project }: { project: ProjectDto }) {
  const query = useQuery({
    queryKey: [...flowKeys.all, "project-blockers", project.id],
    queryFn: () => apiClient.work.projectBlockers(project.id),
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  return (
    <Panel title={`${project.key} · ${project.name}`} icon={OctagonAlert} iconTone="rose">
      <SectionGate state={toState(query)} what="blockers">
        {(rows) => {
          const open = rows.filter((b) => !b.resolved);
          return open.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No open blockers.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {open.map((b) => (
                <li key={b.id} className="py-2 text-xs space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-blue-600 dark:text-blue-400">{b.work_item_key}</span>
                    <span className="font-medium">{b.work_item_title}</span>
                    <StatusBadge label={b.severity === "CRITICAL" ? "Critical" : "Open"} tone={b.severity === "CRITICAL" ? "danger" : "warning"} />
                  </div>
                  <p>{b.reason}</p>
                  <p className="text-[10px] text-[var(--color-text-muted)]">{b.owner?.email ?? "—"} · {dateTimeText(b.opened_at)} · {b.age_hours}h open</p>
                </li>
              ))}
            </ul>
          );
        }}
      </SectionGate>
    </Panel>
  );
}
