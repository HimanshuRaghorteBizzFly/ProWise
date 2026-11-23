"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, CalendarClock, FolderGit2 } from "lucide-react";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { EmptyStateView, PageFrame, ProgressBar, SegmentTabs, StatusBadge } from "@/components/delivery/DeliveryUI";
import { DevGate, dateText } from "@/components/developer/DevUI";
import { useDevProjects } from "@/components/developer/useDeveloperData";
import type { DeveloperProject } from "@/lib/developer-api";

type ModeFilter = "ALL" | "INDIVIDUAL" | "STRUCTURED";

/** The server's figure only: Individual = last approved check-in ("Developer reported"); Structured = accepted work. */
function figure(p: DeveloperProject): { text: string; value: number | null; caption: string } {
  const pct = p.completionPercent === null || p.completionPercent === undefined ? null : Number(p.completionPercent);
  if (p.mode === "INDIVIDUAL") {
    if (pct === null || (pct === 0 && !p.latestCheckIn)) return { text: "Not reported", value: null, caption: "Developer reported" };
    return { text: `${pct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`, value: pct, caption: "Developer reported" };
  }
  if (pct === null) return { text: "Not measurable", value: null, caption: "Accepted work" };
  return { text: `${pct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`, value: pct, caption: "Accepted work" };
}

function ProjectCard({ orgId, project }: { orgId: string; project: DeveloperProject }) {
  const f = figure(project);
  const structured = project.mode === "STRUCTURED";
  const href = `/org/${orgId}/developer/projects/${project.id}/${structured ? "structured" : "individual"}`;
  return (
    <Link
      href={href}
      className="group block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-subtle transition-colors hover:border-blue-500/50 hover:bg-[var(--color-hover)] min-w-0"
      data-testid="developer-project-card"
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <p className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 truncate">{project.code}</p>
          <h3 className="text-sm font-bold text-[var(--color-text-primary)] truncate group-hover:underline">{project.name}</h3>
        </div>
        <StatusBadge label={structured ? "Structured" : "Individual"} tone={structured ? "violet" : "info"} />
      </div>
      {project.description && (
        <p className="mt-2 text-xs text-[var(--color-text-secondary)] line-clamp-2">{project.description}</p>
      )}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--color-text-muted)]">{f.caption}</span>
          <span className="text-sm font-bold tabular-nums text-[var(--color-text-primary)]">{f.text}</span>
        </div>
        {f.value !== null && <ProgressBar value={f.value} size="sm" />}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1">
          <CalendarClock className="w-3 h-3" /> Target {dateText(project.targetCompletionDate)}
        </span>
        {project.status && <span>{project.status}</span>}
        {project.blockedTasksCount > 0 && (
          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-3 h-3" /> {project.blockedTasksCount} blocked
          </span>
        )}
        {project.overdueTasksCount > 0 && (
          <span className="text-amber-600 dark:text-amber-400">{project.overdueTasksCount} overdue</span>
        )}
      </div>
    </Link>
  );
}

export default function DeveloperProjectsPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const projects = useDevProjects();
  const [mode, setMode] = useState<ModeFilter>("ALL");
  const home = `/org/${orgId}/developer/dashboard`;

  return (
    <PanelLayout title="My Projects" breadcrumb={[{ label: "Developer", href: home }, { label: "My Projects" }]}>
      <PageFrame
        crumbs={[{ label: "Developer", href: home }, { label: "My Projects" }]}
        title="My Projects"
        description="Projects you can read in this organization. Individual projects use your check-ins; Structured projects use reviewed work."
      >
        <DevGate state={projects} what="Your projects" back={{ href: home, label: "Back to dashboard" }} skeleton="list">
          {(list) => {
            const count = (m: ModeFilter) => (m === "ALL" ? list.length : list.filter((p) => p.mode === m).length);
            const shown = mode === "ALL" ? list : list.filter((p) => p.mode === mode);
            return (
              <div className="space-y-4">
                <SegmentTabs<ModeFilter>
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "ALL", label: "All", count: count("ALL") },
                    { value: "INDIVIDUAL", label: "Individual", count: count("INDIVIDUAL") },
                    { value: "STRUCTURED", label: "Structured", count: count("STRUCTURED") },
                  ]}
                />
                {shown.length === 0 ? (
                  <EmptyStateView
                    icon={FolderGit2}
                    title={list.length === 0 ? "No projects yet" : "No projects in this mode"}
                    description={
                      list.length === 0
                        ? "You are not a member of any project in this organization. A project manager adds you to a project."
                        : "Choose another mode to see your other projects."
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {shown.map((p) => (
                      <ProjectCard key={p.id} orgId={orgId} project={p} />
                    ))}
                  </div>
                )}
              </div>
            );
          }}
        </DevGate>
      </PageFrame>
    </PanelLayout>
  );
}
