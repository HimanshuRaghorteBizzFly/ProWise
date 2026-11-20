"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, FolderKanban, GitBranch, Search } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import type { Health } from "@/mocks/org-console";
import {
  Avatar,
  EmptyStateView,
  FilterBar,
  HealthBadge,
  PageFrame,
  ProgressBar,
  SegmentTabs,
  StatusBadge,
  SurfaceCard,
  dueLabel,
  useDemoLoad,
} from "@/components/delivery/DeliveryUI";
import { OrgGate, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

type F = "ALL" | Health;
const STATUS_LABEL = { PLANNING: "Planning", ACTIVE: "Active", ON_HOLD: "On hold", COMPLETED: "Completed" } as const;

export default function OwnerProjectsPage() {
  const href = useOrgHref("owner");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const all = useOrgConsoleStore((s) => s.projects);
  const [search, setSearch] = useState("");
  const [health, setHealth] = useState<F>("ALL");
  const projects = useMemo(() => (forceEmpty ? [] : all), [all, forceEmpty]);
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => (health === "ALL" || p.health === health) && (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)));
  }, [projects, search, health]);
  const count = (h: Health) => projects.filter((p) => p.health === h).length;

  return (
    <OrgGate family="owner" need="project.read">
      <PageFrame
        crumbs={[{ label: "Owner", href: href() }, { label: "Projects portfolio" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Projects portfolio"
        description="Every project in the organization, with health, progress and ownership."
        status={status}
        onRetry={retry}
        skeleton="list"
      >
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search project or code"
          filters={<SegmentTabs<F> value={health} onChange={setHealth} options={[{ value: "ALL", label: "All", count: projects.length }, { value: "ON_TRACK", label: "On track", count: count("ON_TRACK") }, { value: "AT_RISK", label: "At risk", count: count("AT_RISK") }, { value: "OFF_TRACK", label: "Off track", count: count("OFF_TRACK") }]} />}
          hasActiveFilters={Boolean(search) || health !== "ALL"}
          onResetFilters={() => { setSearch(""); setHealth("ALL"); }}
        />
        {rows.length === 0 ? (
          <SurfaceCard><EmptyStateView icon={projects.length ? Search : FolderKanban} title={projects.length ? "No projects match" : "No projects yet"} description={projects.length ? "Try a different search or filter." : "Project managers create projects; they will appear here."} /></SurfaceCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 min-[1800px]:grid-cols-4 gap-4">
            {rows.map((p) => {
              const due = dueLabel(p.dueDate, p.status === "COMPLETED");
              return (
                <Link key={p.id} href={href(`projects/${p.id}`)} className="group block rounded-xl">
                  <SurfaceCard className="relative h-full overflow-hidden p-4 space-y-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-blue-500/40">
                    <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: p.color }} />
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="h-10 w-10 rounded-xl text-xs font-bold text-white flex items-center justify-center shrink-0" style={{ backgroundColor: p.color }}>{p.code}</span>
                        <div className="min-w-0"><p className="text-sm font-semibold truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">{p.name}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{lk.team(p.teamId)?.name} · {STATUS_LABEL[p.status]}</p></div>
                      </div>
                      <HealthBadge health={p.health} />
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2">{p.summary}</p>
                    <ProgressBar value={p.progress} planned={p.plannedProgress} color={p.color} showLabel />
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)] text-[11px]">
                      <span className="flex items-center gap-1.5 min-w-0"><Avatar person={lk.member(p.managerId)} size="sm" /><span className="truncate">{lk.member(p.managerId)?.name}</span></span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]"><GitBranch className="w-3 h-3" />{p.repoIds.length}</span>
                        <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)]"><CalendarDays className="w-3 h-3" /></span>
                        <StatusBadge label={due.label} tone={due.tone} />
                      </span>
                    </div>
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>
        )}
      </PageFrame>
    </OrgGate>
  );
}
