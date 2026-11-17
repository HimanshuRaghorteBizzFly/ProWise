"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  CheckSquare,
  Search,
  Filter,
  Layers,
  Calendar,
  AlertTriangle,
  Lock,
  List,
  Columns,
  User,
  ShieldCheck,
  Eye,
  CheckCircle2,
  Clock,
  ArrowUpDown,
  Download,
} from "lucide-react";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerKpiCard,
  ViewerFilterBar,
  ViewerPaginationBar,
  ViewerStatusBadge,
  ViewerSerialBadge,
  ViewerButton,
  EmptyState,
} from "../_components/ViewerPrimitives";
import { useViewerStore } from "../_store/useViewerStore";
import { getViewerTasks, getViewerProjects } from "../_services/viewer-service";
import { ViewerTask } from "../_types";
import { toast } from "sonner";

export default function ViewerTasksPage() {
  const params = useParams();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const { setSelectedTask, exportProgressReport } = useViewerStore();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [viewLayout, setViewLayout] = useState<"table" | "grouped">("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const projects = getViewerProjects(orgId);
  const allTasks = getViewerTasks(orgId, projectFilter, stateFilter, priorityFilter, search);

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allTasks.slice(start, start + pageSize);
  }, [allTasks, currentPage, pageSize]);

  const inProgressCount = allTasks.filter((t) => t.state === "IN_PROGRESS").length;
  const inReviewCount = allTasks.filter((t) => t.state === "IN_REVIEW").length;
  const doneCount = allTasks.filter((t) => t.state === "DONE").length;
  const blockedCount = allTasks.filter((t) => t.state === "BLOCKED").length;

  const getPriorityBadgeTone = (priority: string) => {
    switch (priority) {
      case "CRITICAL":
      case "URGENT":
        return "danger";
      case "HIGH":
        return "warning";
      case "MEDIUM":
        return "info";
      default:
        return "neutral";
    }
  };

  const getStateBadgeTone = (state: string) => {
    switch (state) {
      case "DONE":
        return "success";
      case "IN_REVIEW":
        return "violet";
      case "IN_PROGRESS":
        return "info";
      case "BLOCKED":
        return "danger";
      default:
        return "neutral";
    }
  };

  const handleInspectTask = (t: ViewerTask) => {
    setSelectedTask(t);
    toast.info(`Inspecting work item ${t.key}`);
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Tasks & Work Items Registry"
        description="Read-only work item tracker: inspect sprint deliverables, assignees, weighted point baselines, acceptance criteria, and review stages."
        badge={`${allTasks.length} Work Items`}
        simulationLabel="Reactive Demo Data"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewerButton
              variant="outline"
              size="sm"
              onClick={exportProgressReport}
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Tasks (CSV)</span>
            </ViewerButton>
          </div>
        }
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Total Assigned Tasks"
          value={allTasks.length}
          sublabel="Across accessible projects"
          icon={CheckSquare}
          tone="blue"
        />
        <ViewerKpiCard
          label="In Active Development"
          value={inProgressCount}
          sublabel="Engineers actively coding"
          icon={Clock}
          tone="emerald"
        />
        <ViewerKpiCard
          label="Pending Code Review"
          value={inReviewCount}
          sublabel="Awaiting PR approval"
          icon={ShieldCheck}
          tone="violet"
        />
        <ViewerKpiCard
          label="Completed / Shipped"
          value={doneCount}
          sublabel={`${blockedCount} items blocked`}
          trend={{ value: `${Math.round((doneCount / Math.max(1, allTasks.length)) * 100)}% done`, positive: true }}
          icon={CheckCircle2}
          tone={blockedCount > 0 ? "amber" : "emerald"}
        />
      </div>

      {/* 3. Surface Card with Table Page Format */}
      <ViewerSurfaceCard className="overflow-hidden">
        {/* FilterBar */}
        <div className="p-4 border-b border-[var(--color-border,#E2E8F0)]">
          <ViewerFilterBar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search task key, title, or assignee..."
            hasActiveFilters={Boolean(search || projectFilter !== "ALL" || stateFilter !== "ALL" || priorityFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setProjectFilter("ALL");
              setStateFilter("ALL");
              setPriorityFilter("ALL");
              setCurrentPage(1);
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={projectFilter}
                  onChange={(e) => {
                    setProjectFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Project"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Projects</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.key} - {p.name}
                    </option>
                  ))}
                </select>

                <select
                  value={stateFilter}
                  onChange={(e) => {
                    setStateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by State"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Workflow States</option>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="DONE">Done</option>
                  <option value="BLOCKED">Blocked</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Priority"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Priorities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>

                {/* View Mode Toggle */}
                <div className="flex items-center rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] p-0.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setViewLayout("table")}
                    aria-label="Table view"
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      viewLayout === "table"
                        ? "bg-[var(--color-surface,#FFFFFF)] text-blue-600 shadow-xs"
                        : "text-[var(--color-text-muted,#80868B)] hover:text-[var(--color-text-primary,#202124)]"
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewLayout("grouped")}
                    aria-label="Grouped Kanban view"
                    className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                      viewLayout === "grouped"
                        ? "bg-[var(--color-surface,#FFFFFF)] text-blue-600 shadow-xs"
                        : "text-[var(--color-text-muted,#80868B)] hover:text-[var(--color-text-primary,#202124)]"
                    }`}
                  >
                    <Columns className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            }
          />
        </div>

        {/* Primary View: Table Page Format */}
        {allTasks.length === 0 ? (
          <EmptyState
            icon={CheckSquare}
            title="No tasks match your filter criteria"
            description="Clear or adjust your search parameters to view work items."
            actionText="Reset Filters"
            onAction={() => {
              setSearch("");
              setProjectFilter("ALL");
              setStateFilter("ALL");
              setPriorityFilter("ALL");
              setCurrentPage(1);
            }}
          />
        ) : viewLayout === "table" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                <tr>
                  <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3 w-28 whitespace-nowrap">Task Key</th>
                  <th className="px-4 py-3">Title & Deliverable Scope</th>
                  <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">Project</th>
                  <th className="px-4 py-3 hidden md:table-cell">Assignee</th>
                  <th className="px-4 py-3 whitespace-nowrap">Priority</th>
                  <th className="px-4 py-3 whitespace-nowrap">Weight</th>
                  <th className="px-4 py-3 whitespace-nowrap">Workflow State</th>
                  <th className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">Due Date</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
                {paginatedTasks.map((t, idx) => {
                  const serialNum = (currentPage - 1) * pageSize + idx + 1;
                  const assigneeName = t.primaryAssignee?.name || "Unassigned";
                  const assigneeInitials = (t.primaryAssignee?.name || "UN")
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <tr
                      key={t.id}
                      onClick={() => handleInspectTask(t)}
                      className="group border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)] cursor-pointer"
                    >
                      {/* 1. Sr. No. (Modern SaaS interactive badge without hash) */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <ViewerSerialBadge num={serialNum} />
                      </td>

                      {/* 2. Key */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 group-hover:underline">
                          {t.key}
                        </span>
                      </td>

                      {/* 3. Title */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--color-text-primary,#202124)] line-clamp-1">
                          {t.title}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-muted,#80868B)] line-clamp-1 max-w-sm">
                          {t.description}
                        </div>
                      </td>

                      {/* 4. Project */}
                      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2 py-0.5 text-[11px] font-mono text-[var(--color-text-secondary,#5F6368)]">
                          {t.projectName || t.projectKey}
                        </span>
                      </td>

                      {/* 5. Assignee */}
                      <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {assigneeInitials}
                          </div>
                          <div>
                            <div className="text-[11px] font-medium text-[var(--color-text-primary,#202124)]">
                              {assigneeName}
                            </div>
                            <div className="text-[10px] text-[var(--color-text-muted,#80868B)]">
                              {t.reviewer?.name ? `Reviewer: ${t.reviewer.name}` : "Core Contributor"}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 6. Priority */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ViewerStatusBadge
                          label={t.priority}
                          tone={getPriorityBadgeTone(t.priority)}
                        />
                      </td>

                      {/* 7. Weight Points */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-mono font-medium text-[11px] text-[var(--color-text-primary,#202124)]">
                          {t.weight} {t.weightUnit || "pts"}
                        </span>
                      </td>

                      {/* 8. State */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ViewerStatusBadge
                          label={t.state.replace("_", " ")}
                          tone={getStateBadgeTone(t.state)}
                          dot
                        />
                      </td>

                      {/* 9. Due Date */}
                      <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap font-mono text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                        {t.dueDate}
                      </td>

                      {/* 10. Action */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInspectTask(t);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-primary,#202124)] transition-colors cursor-pointer"
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
          /* Grouped Kanban View Mode */
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {(["OPEN", "IN_PROGRESS", "IN_REVIEW", "DONE", "BLOCKED"] as const).map((columnState) => {
              const stateTasks = allTasks.filter((t) => t.state === columnState);
              return (
                <div
                  key={columnState}
                  className="rounded-xl border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] p-3 space-y-2.5 flex flex-col"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--color-text-primary,#202124)]">
                      {columnState.replace("_", " ")}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--color-elevated,#FFFFFF)] border border-[var(--color-border,#E2E8F0)]">
                      {stateTasks.length}
                    </span>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto max-h-[500px]">
                    {stateTasks.map((t, idx) => (
                      <div
                        key={t.id}
                        onClick={() => handleInspectTask(t)}
                        className="rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] p-2.5 hover:border-blue-500/40 cursor-pointer transition-all space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono font-bold text-blue-600">
                            {idx + 1}. {t.key}
                          </span>
                          <span className="font-mono text-[var(--color-text-muted,#80868B)]">
                            {t.weight} pts
                          </span>
                        </div>
                        <div className="text-xs font-semibold text-[var(--color-text-primary,#202124)] line-clamp-1">
                          {t.title}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted,#80868B)] pt-1 border-t border-[var(--color-border,#E2E8F0)]">
                          <span>{t.primaryAssignee?.name || "Unassigned"}</span>
                          <span>{t.dueDate}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        <ViewerPaginationBar
          currentPage={currentPage}
          totalItems={allTasks.length}
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
