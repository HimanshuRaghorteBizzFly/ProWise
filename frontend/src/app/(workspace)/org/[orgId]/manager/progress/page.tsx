"use client";

import { previewEnabled } from "@/lib/permissions";
import { ProgressListView, ProjectProgressPageView } from "@/components/work/ReviewViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";
import { useParams } from "next/navigation";

import React, { useMemo } from "react";
import { BarChart3, FolderKanban, TrendingUp } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS } from "@/mocks/delivery-dashboards";
import {
  DataTable,
  HealthBadge,
  PageFrame,
  Panel,
  ProgressBar,
  StatPill,
  StatusBadge,
  SurfaceCard,
  formatDate,
  useDemoLoad,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { GaugeRing, GroupedBarChart } from "@/components/delivery/DeliveryCharts";

function PreviewManagerProgressPage() {
  const href = useRoleHref("manager");
  const { status, retry, forceEmpty } = useDemoLoad();
  const allProjects = useDeliveryStore((s) => s.projects);
  const projects = useMemo(
    () => (forceEmpty ? [] : allProjects.filter((p) => p.managerId === VIEWERS.manager.id)),
    [allProjects, forceEmpty]
  );
  const avg = projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0;
  const ahead = projects.filter((p) => p.progress >= p.plannedProgress).length;
  const worst = [...projects].sort((a, b) => a.progress - a.plannedProgress - (b.progress - b.plannedProgress))[0];

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Overview" }, { label: "Progress" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Progress per project"
      description="Approved progress against plan. Progress is never set from Git activity, time spent or task counts."
      status={status}
      onRetry={retry}
    >
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <SurfaceCard className="p-5 flex flex-col items-center justify-center gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <GaugeRing value={avg} color="#10B981" label="portfolio avg" size={150} />
          <div className="grid grid-cols-2 gap-2 w-full">
            <StatPill label="On / ahead" value={ahead} tone="success" />
            <StatPill label="Behind plan" value={projects.length - ahead} tone={projects.length - ahead ? "warning" : "success"} />
          </div>
          {worst && (
            <p className="text-[11px] text-center text-[var(--color-text-muted)]">
              Largest gap: <span className="font-semibold text-[var(--color-text-primary)]">{worst.name}</span> ({worst.progress - worst.plannedProgress} pts)
            </p>
          )}
        </SurfaceCard>
        <Panel className="xl:col-span-3" title="Actual vs planned" description="Percentage complete today" icon={BarChart3} iconTone="emerald">
          {projects.length ? (
            <GroupedBarChart
              data={projects.map((p) => ({ label: p.code, primary: p.progress, secondary: p.plannedProgress }))}
              primaryLabel="Actual"
              secondaryLabel="Planned"
              primaryColor="#10B981"
              secondaryColor="#CBD5E1"
              unit="%"
              height={250}
            />
          ) : (
            <p className="py-12 text-center text-xs text-[var(--color-text-muted)]">No projects to chart.</p>
          )}
        </Panel>
      </div>

      <Panel title="Project breakdown" description="Click a project to open its plan" icon={TrendingUp} bodyClassName="p-0">
        <DataTable
          rows={projects}
          rowHref={(p) => href(`projects/${p.id}`)}
          empty={{ icon: FolderKanban, title: "No projects", description: "Create a project to track progress." }}
          columns={[
            { key: "name", header: "Project", className: "w-[40%] md:w-[28%]", render: (p) => <div className="min-w-0"><p className="font-semibold truncate">{p.name}</p><p className="text-[11px] text-[var(--color-text-muted)]">{p.code} · due {formatDate(p.dueDate)}</p></div> },
            { key: "bar", header: "Actual vs plan", render: (p) => <ProgressBar value={p.progress} planned={p.plannedProgress} color={p.color} showLabel /> },
            { key: "var", header: "Variance", hideBelow: "sm", render: (p) => { const v = p.progress - p.plannedProgress; return <StatusBadge label={`${v >= 0 ? "+" : ""}${v} pts`} tone={v >= 0 ? "success" : v > -10 ? "warning" : "danger"} />; } },
            { key: "health", header: "Health", hideBelow: "md", render: (p) => <HealthBadge health={p.health} /> },
            { key: "ms", header: "Milestones", hideBelow: "lg", render: (p) => <span className="tabular-nums">{p.milestones.filter((m) => m.status === "DONE").length} / {p.milestones.length} done</span> },
          ]}
        />
      </Panel>
    </PageFrame>
  );
}

/** Task 3.5: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function ManagerProgressPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/manager`;
  if (previewEnabled()) return <PreviewManagerProgressPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <ProgressListView crumbs={[{ label: "Project Manager", href: home }]} back={{ href: home, label: "Back to dashboard" }}
        projectHref={(p) => `${home}/projects/${p.id}`} />
    </RequireAnyKey>
  );
}
