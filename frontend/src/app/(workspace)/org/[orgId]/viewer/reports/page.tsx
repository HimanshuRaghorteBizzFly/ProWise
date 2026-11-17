"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  FileText,
  Download,
  Lock,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  Printer,
  Sparkles,
  FileSpreadsheet,
  FileCode,
  Eye,
  Check,
} from "lucide-react";
import { HealthBadge } from "@/components/ui/health-badge";
import { ProgressBar } from "@/components/ui/progress";
import {
  ViewerPageHeader,
  ViewerSurfaceCard,
  ViewerKpiCard,
  ViewerPaginationBar,
  ViewerStatusBadge,
  ViewerButton,
  ViewerSerialBadge,
  SimulatedMetricBadge,
  ReadOnlyBadge,
} from "../_components/ViewerPrimitives";
import { useViewerStore } from "../_store/useViewerStore";
import { getViewerProjects, getViewerMilestones } from "../_services/viewer-service";

export default function ViewerReportsPage() {
  const params = useParams();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const { exportProgressReport, exportMilestoneAudit } = useViewerStore();
  const projects = getViewerProjects(orgId);
  const milestones = getViewerMilestones(orgId);

  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const [filterMode, setFilterMode] = useState<string>("ALL");

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (filterMode !== "ALL" && p.mode !== filterMode) return false;
      return true;
    });
  }, [projects, filterMode]);

  const paginatedProjects = useMemo(() => {
    const start = (previewPage - 1) * previewPageSize;
    return filteredProjects.slice(start, start + previewPageSize);
  }, [filteredProjects, previewPage, previewPageSize]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Available regulatory and delivery report catalogs
  const reportCatalog = [
    {
      id: "REP-01",
      code: "PROG-CSV",
      title: "Portfolio Delivery & Progress Summary",
      category: "Delivery & Velocity",
      formats: ["CSV"],
      classification: "Authorized Read-Only",
      records: projects.length,
      owaspDefended: true,
      onDownload: exportProgressReport,
    },
    {
      id: "REP-02",
      code: "MLST-JSON",
      title: "Structured Milestones & Baseline Audit",
      category: "Milestone Compliance",
      formats: ["JSON"],
      classification: "Authorized Read-Only",
      records: milestones.length,
      owaspDefended: true,
      onDownload: exportMilestoneAudit,
    },
    {
      id: "REP-03",
      code: "AUDIT-CSV",
      title: "Engineering Change & Check-in Ledger",
      category: "Audit & Governance",
      formats: ["CSV"],
      classification: "Internal Read-Only",
      records: 24,
      owaspDefended: true,
      onDownload: exportProgressReport,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Authorized Delivery & Compliance Reports"
        description="Generate, inspect, and export authorized organization progress summaries and milestone compliance audits in permitted formats."
        badge="FR-043 Export Cleared"
        simulationLabel="Reactive Demo Data"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewerButton
              variant="outline"
              size="sm"
              onClick={handlePrint}
              title="Print report or save to PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Page</span>
            </ViewerButton>
            <ViewerButton
              variant="outline"
              size="sm"
              onClick={exportProgressReport}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
              <span>Export CSV</span>
            </ViewerButton>
            <ViewerButton
              variant="primary"
              size="sm"
              onClick={exportMilestoneAudit}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </ViewerButton>
          </div>
        }
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Permitted Reports"
          value={reportCatalog.length}
          sublabel="Cleared under Viewer RBAC"
          icon={FileText}
          tone="blue"
        />
        <ViewerKpiCard
          label="Supported Export Formats"
          value="CSV / JSON"
          sublabel="Sanitized tabular and JSON payloads"
          icon={Layers}
          tone="violet"
        />
        <ViewerKpiCard
          label="OWASP Formula Defense"
          value="Enforced"
          sublabel="Prefixed escape on dangerous formulas"
          icon={ShieldCheck}
          tone="emerald"
        />
        <ViewerKpiCard
          label="Audit Record Count"
          value={projects.length + milestones.length}
          sublabel="Active initiative & milestone data"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      {/* 3. TABLE 1: Available Compliance Reports Catalog (Table Page Format with Numbers) */}
      <ViewerSurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border,#E2E8F0)] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary,#202124)]">
              Authorized Report Catalog
            </h3>
            <p className="text-xs text-[var(--color-text-muted,#80868B)] mt-0.5">
              Available governance, audit, and delivery reports cleared for export.
            </p>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            Export Privilege: Authorized
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
              <tr>
                <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                <th className="px-4 py-3 w-28 whitespace-nowrap">Code</th>
                <th className="px-4 py-3">Report Title & Scope</th>
                <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">Category</th>
                <th className="px-4 py-3 whitespace-nowrap">Formats</th>
                <th className="px-4 py-3 hidden md:table-cell whitespace-nowrap">Classification</th>
                <th className="px-4 py-3 text-center whitespace-nowrap">Records</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
              {reportCatalog.map((rep, idx) => (
                <tr
                  key={rep.id}
                  className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)]"
                >
                  {/* 1. Sr. No. (Modern SaaS interactive badge without hash) */}
                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <ViewerSerialBadge num={idx + 1} />
                  </td>

                  {/* 2. Code */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                      {rep.code}
                    </span>
                  </td>

                  {/* 3. Title */}
                  <td className="px-4 py-3 font-semibold text-[var(--color-text-primary,#202124)]">
                    {rep.title}
                  </td>

                  {/* 4. Category */}
                  <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                    {rep.category}
                  </td>

                  {/* 5. Formats */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      {rep.formats.map((f) => (
                        <span
                          key={f}
                          className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>

                  {/* 6. Classification */}
                  <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                    <ViewerStatusBadge label={rep.classification} tone="success" dot />
                  </td>

                  {/* 7. Records */}
                  <td className="px-4 py-3 text-center font-mono text-[11px] font-bold">
                    {rep.records}
                  </td>

                  {/* 8. Action */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <ViewerButton
                      variant="outline"
                      size="xs"
                      onClick={rep.onDownload}
                      className="gap-1"
                    >
                      <Download className="w-3 h-3 text-blue-600" />
                      <span>Download</span>
                    </ViewerButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ViewerSurfaceCard>

      {/* 4. TABLE 2: Live Export Preview Data Table (Numbered Table Page Format) */}
      <ViewerSurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border,#E2E8F0)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary,#202124)]">
              Live Progress Dataset Preview
            </h3>
            <p className="text-xs text-[var(--color-text-muted,#80868B)] mt-0.5">
              Inspecting tabular data payload ready for CSV / JSON compliance export.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterMode}
              onChange={(e) => {
                setFilterMode(e.target.value);
                setPreviewPage(1);
              }}
              aria-label="Filter Mode"
              className="h-8 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
            >
              <option value="ALL">All Delivery Modes</option>
              <option value="STRUCTURED">Structured Baseline</option>
              <option value="INDIVIDUAL">Individual Mode</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
              <tr>
                <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                <th className="px-4 py-3 w-28 whitespace-nowrap">Project Code</th>
                <th className="px-4 py-3">Initiative Name</th>
                <th className="px-4 py-3 hidden md:table-cell whitespace-nowrap">Mode</th>
                <th className="px-4 py-3 whitespace-nowrap">Lifecycle</th>
                <th className="px-4 py-3 whitespace-nowrap">Health</th>
                <th className="px-4 py-3 w-32 whitespace-nowrap">Progress</th>
                <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">Accountable Lead</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell whitespace-nowrap">Target Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
              {paginatedProjects.map((p, idx) => {
                const serialNum = (previewPage - 1) * previewPageSize + idx + 1;
                return (
                  <tr
                    key={p.id}
                    className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)]"
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

                    {/* 3. Name */}
                    <td className="px-4 py-3 font-semibold text-[var(--color-text-primary,#202124)]">
                      {p.name}
                    </td>

                    {/* 4. Mode */}
                    <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap font-mono text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                      {p.mode}
                    </td>

                    {/* 5. Lifecycle */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <ViewerStatusBadge label={p.lifecycle} tone={p.lifecycle === "ACTIVE" ? "info" : "success"} dot />
                    </td>

                    {/* 6. Health */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <HealthBadge health={p.health} />
                    </td>

                    {/* 7. Progress */}
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

                    {/* 8. Lead */}
                    <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                      {p.accountableOwnerName}
                    </td>

                    {/* 9. Target Date */}
                    <td className="px-4 py-3 text-right hidden sm:table-cell whitespace-nowrap font-mono text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                      {p.targetDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <ViewerPaginationBar
          currentPage={previewPage}
          totalItems={filteredProjects.length}
          pageSize={previewPageSize}
          onPageChange={setPreviewPage}
          onPageSizeChange={setPreviewPageSize}
        />
      </ViewerSurfaceCard>
    </div>
  );
}
