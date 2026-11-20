"use client";

import React, { useMemo, useState } from "react";
import { FolderKanban, HeartPulse } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { Avatar, DataTable, FilterBar, HealthBadge, PageFrame, Panel, ProgressBar, StatusBadge, SurfaceCard, formatDate, useDemoLoad } from "@/components/delivery/DeliveryUI";
import { DonutChart } from "@/components/delivery/DeliveryCharts";
import { OrgGate, SyncStatusBadge, useOrgHref, useOrgLookups } from "@/components/org-console/OrgUI";

export default function AdminProjectsPage() {
  const href = useOrgHref("admin");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useOrgLookups();
  const all = useOrgConsoleStore((s) => s.projects);
  const repos = useOrgConsoleStore((s) => s.repositories);
  const [search, setSearch] = useState("");
  const projects = useMemo(() => (forceEmpty ? [] : all), [all, forceEmpty]);
  const rows = projects.filter((p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <OrgGate family="admin" need="project.read">
      <PageFrame
        crumbs={[{ label: "Admin", href: href() }, { label: "Projects overview" }]}
        back={{ href: href(), label: "Back to dashboard" }}
        title="Projects overview"
        description="Read-only view of every project, its team and repository sync. Project managers own the plans."
        status={status}
        onRetry={retry}
        skeleton="list"
      >
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 items-start">
          <Panel title="Health" icon={HeartPulse} iconTone="teal">
            <DonutChart height={160} centerLabel="projects" data={[{ name: "On track", value: projects.filter((p) => p.health === "ON_TRACK").length, color: "#10B981" }, { name: "At risk", value: projects.filter((p) => p.health === "AT_RISK").length, color: "#F59E0B" }, { name: "Off track", value: projects.filter((p) => p.health === "OFF_TRACK").length, color: "#EF4444" }]} />
          </Panel>
          <div className="xl:col-span-3 space-y-3">
            <FilterBar search={search} onSearchChange={setSearch} searchPlaceholder="Search projects" />
            <SurfaceCard className="overflow-hidden">
              <DataTable
                rows={rows}
                rowHref={(p) => href(`projects/${p.id}`)}
                empty={{ icon: FolderKanban, title: "No projects", description: "Nothing matches your search." }}
                columns={[
                  { key: "n", header: "Project", className: "w-[48%] md:w-[30%]", render: (p) => <div className="min-w-0"><p className="font-semibold truncate">{p.name}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{p.code} · {lk.team(p.teamId)?.name}</p></div> },
                  { key: "p", header: "Progress", render: (p) => <ProgressBar value={p.progress} color={p.color} size="sm" showLabel /> },
                  { key: "h", header: "Health", hideBelow: "sm", render: (p) => <HealthBadge health={p.health} /> },
                  { key: "m", header: "Manager", hideBelow: "xl", render: (p) => <span className="flex items-center gap-2 min-w-0"><Avatar person={lk.member(p.managerId)} size="sm" /><span className="truncate">{lk.member(p.managerId)?.name}</span></span> },
                  { key: "r", header: "Repos", hideBelow: "lg", render: (p) => { const rs = repos.filter((r) => r.projectId === p.id); const bad = rs.filter((r) => r.status === "FAILED" || r.status === "PAUSED").length; return rs.length === 0 ? <span className="text-[var(--color-text-muted)]">None</span> : bad ? <StatusBadge label={`${bad} of ${rs.length} need action`} tone="danger" /> : <StatusBadge label={`${rs.length} healthy`} tone="success" />; } },
                  { key: "d", header: "Due", hideBelow: "md", render: (p) => formatDate(p.dueDate, true) },
                ]}
              />
            </SurfaceCard>
          </div>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)] flex items-center gap-1.5"><SyncStatusBadge status="HEALTHY" /> Repository status reflects GitHub sync only, never project progress.</p>
      </PageFrame>
    </OrgGate>
  );
}
