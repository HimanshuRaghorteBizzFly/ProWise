"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FolderGit2,
  Calendar,
  Clock,
  ArrowRight,
  Download,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Layers,
  ShieldCheck,
  Sparkles,
  Eye,
  CheckSquare,
  Activity,
  FileText,
} from "lucide-react";
import { HealthBadge } from "@/components/ui/health-badge";
import { ProgressBar } from "@/components/ui/progress";
import {
  PortfolioHealthDonut,
  MilestoneProgressBarChart,
  TaskStateBreakdownChart,
  ProgressTrajectoryChart,
} from "./_components/ViewerCharts";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerKpiCard,
  ViewerFilterBar,
  ViewerPaginationBar,
  ViewerStatusBadge,
  ViewerButton,
  ViewerSerialBadge,
  SimulatedMetricBadge,
  ReadOnlyBadge,
} from "./_components/ViewerPrimitives";
import { useViewerStore } from "./_store/useViewerStore";
import {
  getViewerProjects,
  getViewerTasks,
  getViewerMilestones,
  getViewerActivity,
  getViewerCalendarEvents,
} from "./_services/viewer-service";
import { ViewerProject } from "./_types";

export default function ViewerDashboard() {
  const params = useParams();
  const router = useRouter();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const {
    setSelectedProject,
    setSelectedTask,
    setSelectedEvent,
    exportProgressReport,
  } = useViewerStore();

  const [projectSearch, setProjectSearch] = useState("");
  const [healthFilter, setHealthFilter] = useState<string>("ALL");
  const [projectPage, setProjectPage] = useState(1);
  const [projectPageSize, setProjectPageSize] = useState(10);

  const projects = getViewerProjects(orgId);
  const tasks = getViewerTasks(orgId);
  const milestones = getViewerMilestones(orgId);
  const activities = getViewerActivity(orgId);
  const calendarEvents = getViewerCalendarEvents(orgId);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !projectSearch ||
        p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.key.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.accountableOwnerName.toLowerCase().includes(projectSearch.toLowerCase());

      if (!matchSearch) return false;
      if (healthFilter === "ON_TRACK") return p.health === "ON_TRACK" && p.lifecycle !== "DELIVERED";
      if (healthFilter === "AT_RISK") return p.health === "AT_RISK";
      if (healthFilter === "DELAYED") return p.health === "DELAYED";
      if (healthFilter === "DELIVERED") return p.lifecycle === "DELIVERED";
      return true;
    });
  }, [projects, projectSearch, healthFilter]);

  const paginatedProjects = useMemo(() => {
    const start = (projectPage - 1) * projectPageSize;
    return filteredProjects.slice(start, start + projectPageSize);
  }, [filteredProjects, projectPage, projectPageSize]);

  const onTrackCount = projects.filter((p) => p.health === "ON_TRACK" && p.lifecycle !== "DELIVERED").length;
  const atRiskCount = projects.filter((p) => p.health === "AT_RISK").length;
  const delayedCount = projects.filter((p) => p.health === "DELAYED").length;
  const deliveredCount = projects.filter((p) => p.lifecycle === "DELIVERED").length;

  const activeProjects = projects.filter((p) => p.lifecycle === "ACTIVE");
  const avgProgress =
    activeProjects.length > 0
      ? Math.round(
          activeProjects.reduce((sum, p) => sum + p.lastProgressPercent, 0) / activeProjects.length
        )
      : 0;

  // Upcoming deadlines sorted
  const upcomingDeadlines = useMemo(() => {
    return [...calendarEvents]
      .filter((e) => e.status !== "COMPLETED")
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 5);
  }, [calendarEvents]);

  // Recent activity sorted
  const recentActivities = useMemo(() => {
    return [...activities].slice(0, 5);
  }, [activities]);

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header (Super Admin Pattern) */}
      <ViewerPageHeader
        title="Portfolio Delivery & Health Overview"
        description="Comprehensive read-only mission control: initiative progress, milestone baselines, delivery velocity, and governance audit records."
        badge={`Org: ${orgId}`}
        simulationLabel="Reactive Demo Data"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewerButton
              variant="outline"
              size="sm"
              onClick={exportProgressReport}
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Progress (CSV)</span>
            </ViewerButton>
            <ViewerButton
              variant="primary"
              size="sm"
              onClick={() => router.push(`/org/${orgId}/viewer/projects`)}
            >
              <span>Explore All Projects</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </ViewerButton>
          </div>
        }
      />

      {/* 2. Top Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Total Initiatives"
          value={projects.length}
          sublabel={`${activeProjects.length} active in current sprint`}
          icon={FolderGit2}
          tone="blue"
        />
        <ViewerKpiCard
          label="On-Track Projects"
          value={onTrackCount}
          sublabel="Meeting target delivery dates"
          trend={{ value: `${Math.round((onTrackCount / Math.max(1, projects.length)) * 100)}%`, positive: true }}
          icon={CheckCircle2}
          tone="emerald"
        />
        <ViewerKpiCard
          label="Attention Required"
          value={delayedCount + atRiskCount}
          sublabel={`${delayedCount} delayed, ${atRiskCount} at risk`}
          trend={{ value: `${delayedCount + atRiskCount} alerts`, positive: false }}
          icon={AlertTriangle}
          tone={delayedCount > 0 ? "rose" : "amber"}
        />
        <ViewerKpiCard
          label="Average Delivery Progress"
          value={`${avgProgress}%`}
          sublabel={`${deliveredCount} projects fully delivered`}
          icon={TrendingUp}
          tone="violet"
        />
      </div>

      {/* 3. Interactive Charts Grid (2x2 Super Admin Spaced) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Chart 1: Portfolio Health */}
        <ViewerSurfaceCard className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                Portfolio Health Breakdown
              </h3>
              <p className="text-xs text-[var(--color-text-muted,#80868B)] mt-0.5">
                Current status distribution across authorized initiatives
              </p>
            </div>
            <SimulatedMetricBadge />
          </div>
          <PortfolioHealthDonut projects={projects} />
        </ViewerSurfaceCard>

        {/* Chart 2: Milestone Completion */}
        <ViewerSurfaceCard className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                Milestone Phase Progress
              </h3>
              <p className="text-xs text-[var(--color-text-muted,#80868B)] mt-0.5">
                Structured baseline deliverables completed vs remaining
              </p>
            </div>
            <SimulatedMetricBadge />
          </div>
          <MilestoneProgressBarChart milestones={milestones} />
        </ViewerSurfaceCard>

        {/* Chart 3: Task States */}
        <ViewerSurfaceCard className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                Work Item State Breakdown
              </h3>
              <p className="text-xs text-[var(--color-text-muted,#80868B)] mt-0.5">
                Distribution of authorized tasks across engineering workflow
              </p>
            </div>
            <SimulatedMetricBadge />
          </div>
          <TaskStateBreakdownChart tasks={tasks} />
        </ViewerSurfaceCard>

        {/* Chart 4: Trajectory */}
        <ViewerSurfaceCard className="p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                Weekly Velocity Trajectory
              </h3>
              <p className="text-xs text-[var(--color-text-muted,#80868B)] mt-0.5">
                Individual vs Structured delivery pace over past 6 weeks
              </p>
            </div>
            <SimulatedMetricBadge />
          </div>
          <ProgressTrajectoryChart />
        </ViewerSurfaceCard>
      </div>

      {/* 4. MAIN DATA TABLE: Initiative Status & Delivery Registry (Table Page Format with Row Numbers) */}
      <ViewerSurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border,#E2E8F0)]">
          <ViewerFilterBar
            search={projectSearch}
            onSearchChange={setProjectSearch}
            searchPlaceholder="Search project code, name, or lead..."
            hasActiveFilters={Boolean(projectSearch || healthFilter !== "ALL")}
            onResetFilters={() => {
              setProjectSearch("");
              setHealthFilter("ALL");
              setProjectPage(1);
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={healthFilter}
                  onChange={(e) => {
                    setHealthFilter(e.target.value);
                    setProjectPage(1);
                  }}
                  aria-label="Filter by project health"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Health Signals</option>
                  <option value="ON_TRACK">On Track</option>
                  <option value="AT_RISK">At Risk</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="DELIVERED">Delivered</option>
                </select>
              </div>
            }
          />
        </div>

        {/* Table Format with Numbering */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
              <tr>
                <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                <th className="px-4 py-3 w-28 whitespace-nowrap">Code</th>
                <th className="px-4 py-3">Initiative Name & Objective</th>
                <th className="px-4 py-3 hidden md:table-cell">Mode</th>
                <th className="px-4 py-3">Lifecycle</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3 w-36">Delivery Progress</th>
                <th className="px-4 py-3 hidden sm:table-cell">Target Date</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
              {paginatedProjects.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-xs text-[var(--color-text-muted,#80868B)]">
                    No initiatives match your filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedProjects.map((p, idx) => {
                  const serialNum = (projectPage - 1) * projectPageSize + idx + 1;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedProject(p)}
                      className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)] cursor-pointer"
                    >
                      {/* 1. Sr. No. (Modern SaaS interactive badge without hash) */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <ViewerSerialBadge num={serialNum} />
                      </td>

                      {/* 2. Code */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                          {p.key}
                        </span>
                      </td>

                      {/* 3. Name & Description */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--color-text-primary,#202124)]">
                          {p.name}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted,#80868B)] line-clamp-1 max-w-md">
                          {p.description}
                        </div>
                      </td>

                      {/* 4. Progress Mode */}
                      <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2 py-0.5 text-[11px] font-mono text-[var(--color-text-secondary,#5F6368)]">
                          {p.mode}
                        </span>
                      </td>

                      {/* 5. Lifecycle */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ViewerStatusBadge
                          label={p.lifecycle}
                          tone={p.lifecycle === "ACTIVE" ? "info" : p.lifecycle === "DELIVERED" ? "success" : "neutral"}
                          dot
                        />
                      </td>

                      {/* 6. Health Signal */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <HealthBadge health={p.health} />
                      </td>

                      {/* 7. Delivery Progress */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <ProgressBar value={p.lastProgressPercent} size="sm" />
                          </div>
                          <span className="font-mono font-bold text-[11px] text-[var(--color-text-primary,#202124)]">
                            {p.lastProgressPercent}%
                          </span>
                        </div>
                      </td>

                      {/* 8. Target Date */}
                      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap text-[11px] text-[var(--color-text-secondary,#5F6368)] font-mono">
                        {p.targetDate}
                      </td>

                      {/* 9. Action */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProject(p);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-primary,#202124)] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <ViewerPaginationBar
          currentPage={projectPage}
          totalItems={filteredProjects.length}
          pageSize={projectPageSize}
          onPageChange={setProjectPage}
          onPageSizeChange={setProjectPageSize}
        />
      </ViewerSurfaceCard>

      {/* 5. SECONDARY DATA TABLES: Upcoming Deadlines & Recent Activity (Numbered Table Formats) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Table 2: Upcoming Deadlines Table */}
        <ViewerSurfaceCard className="overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border,#E2E8F0)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary,#202124)]">
                Upcoming Deadlines & Milestones
              </h3>
            </div>
            <button
              onClick={() => router.push(`/org/${orgId}/viewer/calendar`)}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Full Calendar →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                <tr>
                  <th className="px-3 py-2.5 w-16 text-center whitespace-nowrap">Sr. No.</th>
                  <th className="px-3 py-2.5">Milestone / Deliverable</th>
                  <th className="px-3 py-2.5 hidden sm:table-cell">Target Date</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
                {upcomingDeadlines.map((evt, idx) => (
                  <tr
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)] cursor-pointer"
                  >
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <ViewerSerialBadge num={idx + 1} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-[var(--color-text-primary,#202124)]">
                        {evt.title}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted,#80868B)] font-mono">
                        {evt.projectName}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell font-mono text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                      {evt.date}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`text-[11px] font-bold ${
                          evt.daysRemaining < 0
                            ? "text-red-600"
                            : evt.daysRemaining <= 3
                            ? "text-amber-600"
                            : "text-emerald-600"
                        }`}
                      >
                        {evt.daysRemaining < 0
                          ? `${Math.abs(evt.daysRemaining)}d Overdue`
                          : `${evt.daysRemaining}d Left`}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(evt);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border border-[var(--color-border,#E2E8F0)] hover:bg-[var(--color-surface,#FFFFFF)] text-[var(--color-text-primary,#202124)]"
                      >
                        <Eye className="w-3 h-3 text-blue-500" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ViewerSurfaceCard>

        {/* Table 3: Recent Activity Table */}
        <ViewerSurfaceCard className="overflow-hidden">
          <div className="p-4 border-b border-[var(--color-border,#E2E8F0)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary,#202124)]">
                Recent Verified Audit Stream
              </h3>
            </div>
            <button
              onClick={() => router.push(`/org/${orgId}/viewer/activity`)}
              className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
            >
              Full Ledger →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                <tr>
                  <th className="px-3 py-2.5 w-16 text-center whitespace-nowrap">Sr. No.</th>
                  <th className="px-3 py-2.5">Event Details</th>
                  <th className="px-3 py-2.5 hidden sm:table-cell">Actor</th>
                  <th className="px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5 text-right font-mono">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
                {recentActivities.map((act, idx) => (
                  <tr
                    key={act.id}
                    className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)]"
                  >
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <ViewerSerialBadge num={idx + 1} />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-[var(--color-text-primary,#202124)] line-clamp-1">
                        {act.summary}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted,#80868B)] font-mono">
                        {act.projectName} • {act.type}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                      {act.actor}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-[var(--color-text-muted,#80868B)] whitespace-nowrap font-mono">
                      {act.timestamp.split(" ")[0]}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[10px] text-blue-600 dark:text-blue-400">
                      {act.commitHash ? act.commitHash.slice(0, 7) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ViewerSurfaceCard>
      </div>
    </div>
  );
}
