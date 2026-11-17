"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Clock,
  Search,
  Filter,
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  FolderGit2,
  ExternalLink,
  Layers,
  Sparkles,
  GitCommit,
  User,
  ShieldCheck,
  Download,
} from "lucide-react";
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
} from "../_components/ViewerPrimitives";
import { useViewerStore } from "../_store/useViewerStore";
import { getViewerActivity, getViewerProjects } from "../_services/viewer-service";

export default function ViewerActivityPage() {
  const params = useParams();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const { exportProgressReport } = useViewerStore();

  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const projects = getViewerProjects(orgId);
  const rawActivity = getViewerActivity(orgId, projectFilter, typeFilter);

  const filteredActivity = useMemo(() => {
    if (!search) return rawActivity;
    const q = search.toLowerCase();
    return rawActivity.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.actorName.toLowerCase().includes(q) ||
        a.projectName.toLowerCase().includes(q)
    );
  }, [rawActivity, search]);

  const paginatedActivity = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredActivity.slice(start, start + pageSize);
  }, [filteredActivity, currentPage, pageSize]);

  const commitCount = rawActivity.filter((a) => a.actionType === "COMMIT").length;
  const checkinCount = rawActivity.filter((a) => a.actionType === "CHECKIN" || a.actionType === "DELIVERY").length;
  const reviewCount = rawActivity.filter((a) => a.actionType === "REVIEW").length;

  const getTypeBadgeTone = (type: string) => {
    switch (type) {
      case "COMMIT":
        return "info";
      case "CHECKIN":
        return "success";
      case "DELIVERY":
        return "violet";
      case "REVIEW":
        return "warning";
      default:
        return "neutral";
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Verified Project Activity Stream"
        description="Audit-backed chronological stream of engineering commits, check-in reviews, security scans, and milestone lifecycle transitions."
        badge={`${rawActivity.length} Audit Events`}
        simulationLabel="Reactive Demo Data"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewerButton
              variant="outline"
              size="sm"
              onClick={exportProgressReport}
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export Audit Trail (CSV)</span>
            </ViewerButton>
          </div>
        }
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Total Audit Events"
          value={rawActivity.length}
          sublabel="Logged across authorized projects"
          icon={Clock}
          tone="blue"
        />
        <ViewerKpiCard
          label="Git Commits Logged"
          value={commitCount}
          sublabel="SHA-verified repository commits"
          icon={GitCommit}
          tone="emerald"
        />
        <ViewerKpiCard
          label="Developer Check-ins"
          value={checkinCount}
          sublabel="Individual progress submissions"
          icon={CheckCircle2}
          tone="violet"
        />
        <ViewerKpiCard
          label="Code Reviews & QA"
          value={reviewCount}
          sublabel="Peer reviews & test evidence"
          icon={ShieldCheck}
          tone="amber"
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
            searchPlaceholder="Search events, summaries, actors, or projects..."
            hasActiveFilters={Boolean(search || projectFilter !== "ALL" || typeFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setProjectFilter("ALL");
              setTypeFilter("ALL");
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
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Event Type"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Event Types</option>
                  <option value="COMMIT">Git Commits</option>
                  <option value="CHECKIN">Developer Check-ins</option>
                  <option value="REVIEW">Code Reviews</option>
                  <option value="MILESTONE">Milestone Updates</option>
                  <option value="DELIVERY">Deliveries</option>
                </select>
              </div>
            }
          />
        </div>

        {/* Table Format with Numbering */}
        {filteredActivity.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No activity events match your filter"
            description="Clear or adjust your search parameters to view audit trail."
            actionText="Reset Filters"
            onAction={() => {
              setSearch("");
              setProjectFilter("ALL");
              setTypeFilter("ALL");
              setCurrentPage(1);
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                <tr>
                  <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3 whitespace-nowrap">Timestamp</th>
                  <th className="px-4 py-3">Actor / Engineer</th>
                  <th className="px-4 py-3 whitespace-nowrap">Event Type</th>
                  <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">Project</th>
                  <th className="px-4 py-3">Audit Summary & Scope</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap font-mono">Verification Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
                {paginatedActivity.map((act, idx) => {
                  const serialNum = (currentPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={act.id}
                      className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)]"
                    >
                      {/* 1. Sr. No. (Modern SaaS interactive badge without hash) */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <ViewerSerialBadge num={serialNum} />
                      </td>

                      {/* 2. Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[var(--color-text-muted,#80868B)]">
                        {act.timestamp}
                      </td>

                      {/* 3. Actor */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-[var(--color-text-primary,#202124)]">
                          {act.actorName}
                        </div>
                        <div className="text-[10px] text-[var(--color-text-muted,#80868B)]">
                          {act.actorRole}
                        </div>
                      </td>

                      {/* 4. Event Type */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ViewerStatusBadge
                          label={act.actionType}
                          tone={getTypeBadgeTone(act.actionType)}
                          dot
                        />
                      </td>

                      {/* 5. Project */}
                      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap font-mono font-bold text-blue-600 dark:text-blue-400">
                        {act.projectName}
                      </td>

                      {/* 6. Summary */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--color-text-primary,#202124)]">
                          {act.title}
                        </div>
                        <div className="text-[11px] text-[var(--color-text-secondary,#5F6368)] line-clamp-1 max-w-md">
                          {act.summary}
                        </div>
                      </td>

                      {/* 7. Verification Ref */}
                      <td className="px-4 py-3 text-right whitespace-nowrap font-mono text-[11px]">
                        {act.commitHash ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                            {act.commitHash.slice(0, 7)}
                          </span>
                        ) : (
                          <span className="text-[var(--color-text-muted,#80868B)]">SYS-LOG</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <ViewerPaginationBar
          currentPage={currentPage}
          totalItems={filteredActivity.length}
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
