"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Layers, Calendar, CheckCircle2, ArrowRight, Eye } from "lucide-react";
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
} from "../_components/ViewerPrimitives";
import { getViewerMilestones } from "../_services/viewer-service";

export default function ViewerMilestonesPage() {
  const params = useParams();
  const router = useRouter();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const milestones = getViewerMilestones(orgId);

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredMilestones = useMemo(() => {
    if (!search) return milestones;
    const q = search.toLowerCase();
    return milestones.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.projectName.toLowerCase().includes(q) ||
        m.key.toLowerCase().includes(q)
    );
  }, [milestones, search]);

  const paginatedMilestones = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMilestones.slice(start, start + pageSize);
  }, [filteredMilestones, currentPage, pageSize]);

  const completedCount = milestones.filter((m) => m.state === "DONE").length;
  const totalWeight = milestones.reduce((sum, m) => sum + m.totalPoints, 0);

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Roadmap Milestones Registry"
        description="High-level roadmap milestones, deliverable weights, and verified completion states across structured initiatives."
        badge={`${milestones.length} Milestones`}
        simulationLabel="Reactive Demo Data"
        actions={
          <ViewerButton
            variant="primary"
            size="sm"
            onClick={() => router.push(`/org/${orgId}/viewer/calendar`)}
          >
            <span>View on Calendar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </ViewerButton>
        }
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Total Deliverables"
          value={milestones.length}
          sublabel="Across active initiatives"
          icon={Layers}
          tone="blue"
        />
        <ViewerKpiCard
          label="Completed Milestones"
          value={completedCount}
          sublabel="Verified and shipped"
          trend={{ value: `${Math.round((completedCount / Math.max(1, milestones.length)) * 100)}% complete`, positive: true }}
          icon={CheckCircle2}
          tone="emerald"
        />
        <ViewerKpiCard
          label="Assigned Baseline Points"
          value={`${totalWeight} pts`}
          sublabel="Weighted mathematically"
          icon={Calendar}
          tone="violet"
        />
        <ViewerKpiCard
          label="Active Phases"
          value="4 Phases"
          sublabel="Discovery, MVP, Testing, Release"
          icon={CheckCircle2}
          tone="amber"
        />
      </div>

      {/* 3. Surface Card with Table Page Format */}
      <ViewerSurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border,#E2E8F0)]">
          <ViewerFilterBar
            search={search}
            onSearchChange={(val) => {
              setSearch(val);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search milestones or projects..."
            hasActiveFilters={Boolean(search)}
            onResetFilters={() => {
              setSearch("");
              setCurrentPage(1);
            }}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
              <tr>
                <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                <th className="px-4 py-3">Milestone Deliverable</th>
                <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">Project</th>
                <th className="px-4 py-3 hidden md:table-cell whitespace-nowrap">Phase</th>
                <th className="px-4 py-3 whitespace-nowrap">Baseline Weight</th>
                <th className="px-4 py-3 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 w-32 whitespace-nowrap">Completion</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell whitespace-nowrap">Target Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
              {paginatedMilestones.map((m, idx) => {
                const serialNum = (currentPage - 1) * pageSize + idx + 1;
                return (
                  <tr
                    key={m.id}
                    className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)]"
                  >
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <ViewerSerialBadge num={serialNum} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[var(--color-text-primary,#202124)]">
                        {m.title}
                      </div>
                      <div className="text-[11px] text-[var(--color-text-muted,#80868B)] line-clamp-1 max-w-sm">
                        {m.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap font-mono font-bold text-blue-600">
                      {m.projectName}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                      {m.key}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono font-bold">
                      {m.totalPoints} pts
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ViewerStatusBadge
                        label={m.state}
                        tone={m.state === "DONE" ? "success" : m.state === "IN_PROGRESS" || m.state === "IN_REVIEW" ? "info" : "neutral"}
                        dot
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <ProgressBar value={m.totalPoints > 0 ? Math.round((m.completedPoints / m.totalPoints) * 100) : 0} size="sm" />
                        </div>
                        <span className="font-mono font-bold text-[11px]">
                          {m.totalPoints > 0 ? Math.round((m.completedPoints / m.totalPoints) * 100) : 0}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell whitespace-nowrap font-mono text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                      {m.dueDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <ViewerPaginationBar
          currentPage={currentPage}
          totalItems={filteredMilestones.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </ViewerSurfaceCard>
    </div>
  );
}
