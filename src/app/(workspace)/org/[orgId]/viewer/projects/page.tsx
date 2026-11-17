"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  FolderGit2,
  Calendar,
  Layers,
  LayoutGrid,
  List,
  GitBranch,
  ArrowUpDown,
  Download,
  Eye,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Users,
} from "lucide-react";
import { HealthBadge } from "@/components/ui/health-badge";
import { ProgressBar } from "@/components/ui/progress";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerKpiCard,
  ViewerFilterBar,
  ViewerPaginationBar,
  ViewerStatusBadge,
  ViewerButton,
  ViewerSerialBadge,
  EmptyState,
  SimulatedMetricBadge,
} from "../_components/ViewerPrimitives";
import { useViewerStore } from "../_store/useViewerStore";
import { getViewerProjects } from "../_services/viewer-service";

export default function ViewerProjectsPage() {
  const params = useParams();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const { setSelectedProject, exportProgressReport } = useViewerStore();

  const [search, setSearch] = useState("");
  const [modeFilter, setModeFilter] = useState("ALL");
  const [lifecycleFilter, setLifecycleFilter] = useState("ALL");
  const [healthFilter, setHealthFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"key" | "name" | "progress" | "targetDate">("key");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const rawProjects = getViewerProjects(orgId);

  // Filtered and Sorted Projects
  const filteredProjects = useMemo(() => {
    return rawProjects
      .filter((p) => {
        if (modeFilter !== "ALL" && p.mode !== modeFilter) return false;
        if (lifecycleFilter !== "ALL" && p.lifecycle !== lifecycleFilter) return false;
        if (healthFilter !== "ALL" && p.health !== healthFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.key.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q) ||
            p.accountableOwnerName.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortBy];
        let valB: any = b[sortBy];
        if (sortBy === "progress") {
          valA = a.lastProgressPercent;
          valB = b.lastProgressPercent;
        }
        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [rawProjects, modeFilter, lifecycleFilter, healthFilter, search, sortBy, sortOrder]);

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  const onTrackCount = rawProjects.filter((p) => p.health === "ON_TRACK" && p.lifecycle !== "DELIVERED").length;
  const delayedCount = rawProjects.filter((p) => p.health === "DELAYED" || p.health === "AT_RISK").length;
  const activeCount = rawProjects.filter((p) => p.lifecycle === "ACTIVE").length;
  const avgProgress =
    rawProjects.length > 0
      ? Math.round(rawProjects.reduce((sum, p) => sum + p.lastProgressPercent, 0) / rawProjects.length)
      : 0;

  const toggleSort = (field: "key" | "name" | "progress" | "targetDate") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Projects Portfolio Registry"
        description="Comprehensive read-only registry of authorized initiatives, delivery lifecycle status, accountable leadership, and milestone progress."
        badge={`${rawProjects.length} Projects`}
        simulationLabel="Reactive Demo Data"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewerButton
              variant="outline"
              size="sm"
              onClick={exportProgressReport}
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Portfolio (CSV)</span>
            </ViewerButton>
          </div>
        }
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Total Portfolio"
          value={rawProjects.length}
          sublabel={`${activeCount} active engineering streams`}
          icon={FolderGit2}
          tone="blue"
        />
        <ViewerKpiCard
          label="On-Track Initiatives"
          value={onTrackCount}
          sublabel="Meeting target baseline dates"
          trend={{ value: `${Math.round((onTrackCount / Math.max(1, rawProjects.length)) * 100)}%`, positive: true }}
          icon={CheckCircle2}
          tone="emerald"
        />
        <ViewerKpiCard
          label="Delayed / At Risk"
          value={delayedCount}
          sublabel="Milestone slippage detected"
          trend={{ value: `${delayedCount} alerts`, positive: false }}
          icon={AlertTriangle}
          tone="rose"
        />
        <ViewerKpiCard
          label="Portfolio Velocity"
          value={`${avgProgress}%`}
          sublabel="Average completion across initiatives"
          icon={TrendingUp}
          tone="violet"
        />
      </div>

      {/* 3. Surface Card with Table Format */}
      <ViewerSurfaceCard className="overflow-hidden">
        {/* FilterBar */}
        <div className="p-4 border-b border-[var(--color-border,#E2E8F0)]">
          <ViewerFilterBar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search project code, name, lead, or description..."
            hasActiveFilters={Boolean(search || modeFilter !== "ALL" || lifecycleFilter !== "ALL" || healthFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setModeFilter("ALL");
              setLifecycleFilter("ALL");
              setHealthFilter("ALL");
              setCurrentPage(1);
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={healthFilter}
                  onChange={(e) => {
                    setHealthFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Health"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Health Signals</option>
                  <option value="ON_TRACK">On Track</option>
                  <option value="AT_RISK">At Risk</option>
                  <option value="DELAYED">Delayed</option>
                </select>

                <select
                  value={lifecycleFilter}
                  onChange={(e) => {
                    setLifecycleFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Lifecycle"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Lifecycles</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PLANNING">Planning</option>
                  <option value="DELIVERED">Delivered</option>
                </select>

                <select
                  value={modeFilter}
                  onChange={(e) => {
                    setModeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Mode"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Modes</option>
                  <option value="INDIVIDUAL">Individual Mode</option>
                  <option value="STRUCTURED">Structured Mode</option>
                </select>

                {/* Grid / Table View Toggle */}
                <div className="flex items-center rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] p-0.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    aria-label="Table view"
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === "table"
                        ? "bg-[var(--color-surface,#FFFFFF)] text-blue-600 shadow-xs"
                        : "text-[var(--color-text-muted,#80868B)] hover:text-[var(--color-text-primary,#202124)]"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    aria-label="Grid view"
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === "grid"
                        ? "bg-[var(--color-surface,#FFFFFF)] text-blue-600 shadow-xs"
                        : "text-[var(--color-text-muted,#80868B)] hover:text-[var(--color-text-primary,#202124)]"
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            }
          />
        </div>

        {/* Primary View: Table Page Format */}
        {filteredProjects.length === 0 ? (
          <EmptyState
            icon={FolderGit2}
            title="No projects match your filter criteria"
            description="Clear or adjust your search filters to view authorized initiatives."
            actionText="Reset Filters"
            onAction={() => {
              setSearch("");
              setModeFilter("ALL");
              setLifecycleFilter("ALL");
              setHealthFilter("ALL");
              setCurrentPage(1);
            }}
          />
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                <tr>
                  <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3 w-28 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("key")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary,#202124)]"
                    >
                      Code <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("name")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary,#202124)]"
                    >
                      Project Name & Description <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden md:table-cell whitespace-nowrap">Mode</th>
                  <th className="px-4 py-3 whitespace-nowrap">Lifecycle</th>
                  <th className="px-4 py-3 whitespace-nowrap">Health Signal</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Accountable Lead</th>
                  <th className="px-4 py-3 w-36 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("progress")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary,#202124)]"
                    >
                      Progress <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("targetDate")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary,#202124)]"
                    >
                      Target Date <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
                {paginatedProjects.map((p, idx) => {
                  const serialNum = (currentPage - 1) * pageSize + idx + 1;
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
                        <div className="text-[11px] text-[var(--color-text-muted,#80868B)] line-clamp-1 max-w-sm">
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

                      {/* 7. Lead */}
                      <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">
                        <div className="text-[11px] font-medium text-[var(--color-text-primary,#202124)]">
                          {p.accountableOwnerName}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted,#80868B)]">
                          PM: {p.projectManagerName}
                        </div>
                      </td>

                      {/* 8. Progress */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-20">
                            <ProgressBar value={p.lastProgressPercent} size="sm" />
                          </div>
                          <span className="font-mono font-bold text-[11px] text-[var(--color-text-primary,#202124)]">
                            {p.lastProgressPercent}%
                          </span>
                        </div>
                      </td>

                      {/* 9. Target Date */}
                      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap text-[11px] font-mono text-[var(--color-text-secondary,#5F6368)]">
                        {p.targetDate}
                      </td>

                      {/* 10. Action */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProject(p);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-primary,#202124)] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>Inspect</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View Mode */
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedProjects.map((p, idx) => {
              const serialNum = (currentPage - 1) * pageSize + idx + 1;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProject(p)}
                  className="rounded-xl border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] p-4 hover:border-blue-500/40 cursor-pointer transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <ViewerSerialBadge num={serialNum} />
                        <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                          {p.key}
                        </span>
                      </div>
                      <HealthBadge health={p.health} />
                    </div>

                    <h3 className="font-bold text-sm text-[var(--color-text-primary,#202124)] line-clamp-1">
                      {p.name}
                    </h3>

                    <p className="text-xs text-[var(--color-text-secondary,#5F6368)] line-clamp-2">
                      {p.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-border,#E2E8F0)] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[var(--color-text-muted,#80868B)]">Delivery</span>
                      <span className="font-mono font-bold">{p.lastProgressPercent}%</span>
                    </div>
                    <ProgressBar value={p.lastProgressPercent} size="sm" />
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted,#80868B)] font-mono">
                      <span>Owner: {p.accountableOwnerName}</span>
                      <span>{p.targetDate}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        <ViewerPaginationBar
          currentPage={currentPage}
          totalItems={filteredProjects.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
        />
      </ViewerSurfaceCard>
    </div>
  );
}
