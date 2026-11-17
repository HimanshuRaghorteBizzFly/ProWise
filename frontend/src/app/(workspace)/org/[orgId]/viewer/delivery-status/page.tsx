"use client";

import React, { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, FolderGit2, Calendar, ArrowRight, Eye, ShieldCheck } from "lucide-react";
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
} from "../_components/ViewerPrimitives";
import { getViewerProjects } from "../_services/viewer-service";
import { useViewerStore } from "../_store/useViewerStore";

export default function ViewerDeliveryStatusPage() {
  const params = useParams();
  const router = useRouter();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const { setSelectedProject } = useViewerStore();
  const projects = getViewerProjects(orgId);

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredProjects = useMemo(() => {
    if (!search) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q) ||
        p.accountableOwnerName.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const paginatedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  const deliveredCount = projects.filter((p) => p.lifecycle === "DELIVERED").length;
  const activeCount = projects.filter((p) => p.lifecycle === "ACTIVE").length;

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Delivery Acceptance Status"
        description="Read-only audit of project delivery readiness, accepted milestones, and final sprint lifecycle signoffs."
        badge={`${projects.length} Initiatives`}
        simulationLabel="Reactive Demo Data"
        actions={
          <ViewerButton
            variant="primary"
            size="sm"
            onClick={() => router.push(`/org/${orgId}/viewer/projects`)}
          >
            <span>Explore Portfolio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </ViewerButton>
        }
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Total Tracked Initiatives"
          value={projects.length}
          sublabel="Subject to acceptance governance"
          icon={FolderGit2}
          tone="blue"
        />
        <ViewerKpiCard
          label="Delivered & Accepted"
          value={deliveredCount}
          sublabel="Lifecycle completed & verified"
          trend={{ value: `${deliveredCount} accepted`, positive: true }}
          icon={CheckCircle2}
          tone="emerald"
        />
        <ViewerKpiCard
          label="In Active Development"
          value={activeCount}
          sublabel="Sprint progress underway"
          icon={Calendar}
          tone="violet"
        />
        <ViewerKpiCard
          label="Acceptance Readiness"
          value="Audit Ready"
          sublabel="All verification gates cleared"
          icon={ShieldCheck}
          tone="emerald"
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
            searchPlaceholder="Search initiative by name or code..."
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
                <th className="px-4 py-3 w-28 whitespace-nowrap">Code</th>
                <th className="px-4 py-3">Initiative Name</th>
                <th className="px-4 py-3 hidden md:table-cell whitespace-nowrap">Mode</th>
                <th className="px-4 py-3 whitespace-nowrap">Lifecycle</th>
                <th className="px-4 py-3 whitespace-nowrap">Health Signal</th>
                <th className="px-4 py-3 w-32 whitespace-nowrap">Delivery</th>
                <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">Accountable Owner</th>
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
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <ViewerSerialBadge num={serialNum} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                        {p.key}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--color-text-primary,#202124)]">
                      {p.name}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap font-mono text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                      {p.mode}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ViewerStatusBadge
                        label={p.lifecycle}
                        tone={p.lifecycle === "DELIVERED" ? "success" : "info"}
                        dot
                      />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <HealthBadge health={p.health} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16">
                          <ProgressBar value={p.lastProgressPercent} size="sm" />
                        </div>
                        <span className="font-mono font-bold text-[11px]">
                          {p.lastProgressPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                      {p.accountableOwnerName}
                    </td>
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

        <ViewerPaginationBar
          currentPage={currentPage}
          totalItems={filteredProjects.length}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </ViewerSurfaceCard>
    </div>
  );
}
