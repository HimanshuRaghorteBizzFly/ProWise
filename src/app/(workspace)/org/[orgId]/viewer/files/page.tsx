"use client";

import React, { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  FileText,
  Search,
  Filter,
  Download,
  Eye,
  Lock,
  ShieldCheck,
  ShieldAlert,
  GitBranch,
  Calendar,
  FileCode,
  FileCheck2,
  HardDrive,
  CheckCircle2,
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
import { getViewerFiles, getViewerProjects } from "../_services/viewer-service";
import { ViewerFileItem } from "../_types";

export default function ViewerFilesPage() {
  const params = useParams();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const { setSelectedFile, downloadPermittedFile } = useViewerStore();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const projects = getViewerProjects(orgId);
  const rawFiles = getViewerFiles(orgId, projectFilter);

  const filteredFiles = useMemo(() => {
    return rawFiles.filter((f) => {
      if (categoryFilter !== "ALL" && f.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          f.name.toLowerCase().includes(q) ||
          f.description.toLowerCase().includes(q) ||
          f.author.toLowerCase().includes(q) ||
          f.projectKey.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rawFiles, categoryFilter, search]);

  const paginatedFiles = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredFiles.slice(start, start + pageSize);
  }, [filteredFiles, currentPage, pageSize]);

  const permittedCount = rawFiles.filter((f) => f.securityClearance === "PERMITTED").length;
  const restrictedCount = rawFiles.filter((f) => f.securityClearance === "RESTRICTED").length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "CODE_CONTRACT":
        return <FileCode className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />;
      case "CHECKLIST":
        return <FileCheck2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />;
      case "EVIDENCE":
        return <GitBranch className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case "AUDIT_REPORT":
        return <ShieldCheck className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />;
      default:
        return <FileText className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 max-w-full overflow-x-hidden">
      {/* 1. Page Header */}
      <ViewerPageHeader
        title="Files & Evidence Repository"
        description="Read-only preview and permitted downloads of architectural OpenAPI contracts, QA checklists, git diff evidence, and compliance documentation."
        badge={`${rawFiles.length} Authorized Files`}
        simulationLabel="Reactive Demo Data"
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <ViewerKpiCard
          label="Permitted Documents"
          value={permittedCount}
          sublabel="Available for in-browser inspection"
          icon={FileText}
          tone="blue"
        />
        <ViewerKpiCard
          label="Contracts & Code Evidence"
          value={rawFiles.filter((f) => f.category === "CODE_CONTRACT" || f.category === "EVIDENCE").length}
          sublabel="OpenAPI specifications & diffs"
          icon={FileCode}
          tone="emerald"
        />
        <ViewerKpiCard
          label="Restricted Vault Keys"
          value={restrictedCount}
          sublabel="403 Forbidden guarded server-side"
          trend={{ value: `${restrictedCount} restricted`, positive: false }}
          icon={ShieldAlert}
          tone="rose"
        />
        <ViewerKpiCard
          label="Total Artifact Storage"
          value="4.8 MB"
          sublabel="Across active repository files"
          icon={HardDrive}
          tone="violet"
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
            searchPlaceholder="Search file name, description, author, or project..."
            hasActiveFilters={Boolean(search || categoryFilter !== "ALL" || projectFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setCategoryFilter("ALL");
              setProjectFilter("ALL");
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
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  aria-label="Filter by Category"
                  className="h-9 rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-app-bg,#F8FAFD)] px-2.5 text-xs text-[var(--color-text-primary,#202124)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Document Types</option>
                  <option value="CODE_CONTRACT">OpenAPI & Contracts</option>
                  <option value="CHECKLIST">QA & Security Checklists</option>
                  <option value="EVIDENCE">Diffs & Git Evidence</option>
                  <option value="SPECIFICATION">Design Specs</option>
                  <option value="AUDIT_REPORT">Compliance Audits</option>
                </select>
              </div>
            }
          />
        </div>

        {/* Table Format with Numbering */}
        {filteredFiles.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents match your filter criteria"
            description="Clear or adjust your search parameters to view files."
            actionText="Reset Filters"
            onAction={() => {
              setSearch("");
              setCategoryFilter("ALL");
              setProjectFilter("ALL");
              setCurrentPage(1);
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border,#E2E8F0)] bg-[var(--color-sidebar,#F6F8FC)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary,#5F6368)]">
                <tr>
                  <th className="px-4 py-3 w-16 text-center whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3">Document Name & Scope</th>
                  <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">Project</th>
                  <th className="px-4 py-3 hidden md:table-cell whitespace-nowrap">Category</th>
                  <th className="px-4 py-3 whitespace-nowrap">Size</th>
                  <th className="px-4 py-3 whitespace-nowrap">Clearance Level</th>
                  <th className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">Uploaded By</th>
                  <th className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">Updated</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border,#E2E8F0)]">
                {paginatedFiles.map((file, idx) => {
                  const serialNum = (currentPage - 1) * pageSize + idx + 1;
                  const isRestricted = file.securityClearance === "RESTRICTED";
                  return (
                    <tr
                      key={file.id}
                      onClick={() => setSelectedFile(file)}
                      className="border-b border-[var(--color-border,#E2E8F0)] transition-colors hover:bg-[var(--color-hover,#EEF3FB)] cursor-pointer"
                    >
                      {/* 1. Sr. No. (Modern SaaS interactive badge without hash) */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <ViewerSerialBadge num={serialNum} />
                      </td>

                      {/* 2. File Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(file.category)}
                          <div>
                            <div className="font-semibold text-[var(--color-text-primary,#202124)]">
                              {file.name}
                            </div>
                            <div className="text-[11px] text-[var(--color-text-muted,#80868B)] line-clamp-1 max-w-sm">
                              {file.description}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 3. Project */}
                      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                        <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
                          {file.projectKey}
                        </span>
                      </td>

                      {/* 4. Category */}
                      <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                        {file.category.replace("_", " ")}
                      </td>

                      {/* 5. Size */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                        {file.size}
                      </td>

                      {/* 6. Clearance Level */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ViewerStatusBadge
                          label={isRestricted ? "Restricted Vault" : "Permitted View"}
                          tone={isRestricted ? "danger" : "success"}
                          dot
                        />
                      </td>

                      {/* 7. Uploaded By */}
                      <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap text-[11px] text-[var(--color-text-secondary,#5F6368)]">
                        {file.author}
                      </td>

                      {/* 8. Updated Date */}
                      <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap font-mono text-[11px] text-[var(--color-text-muted,#80868B)]">
                        {file.lastModified}
                      </td>

                      {/* 9. Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedFile(file)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-primary,#202124)] transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Preview</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadPermittedFile(file)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--color-border,#E2E8F0)] bg-[var(--color-surface,#FFFFFF)] hover:bg-[var(--color-hover,#EEF3FB)] text-[var(--color-text-primary,#202124)] transition-colors"
                            title={isRestricted ? "Restricted - 403 Forbidden" : "Download File"}
                          >
                            <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                          </button>
                        </div>
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
          totalItems={filteredFiles.length}
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
