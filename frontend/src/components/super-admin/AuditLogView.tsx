"use client";

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, Download, FileText, RefreshCw, ShieldAlert, Users } from "lucide-react";
import type { AdminAuditLog } from "@/types/admin";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  type StatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { ResourceStatus, formatInstant, humanize, type ResourceState } from "./admin-resource";
import { downloadRowsCsv, todayStamp } from "./platform-shared";

export interface AuditFilters {
  category: string;
  severity: string;
  search: string;
  /** yyyy-mm-dd from a date input, interpreted as a UTC day boundary. */
  from: string;
  to: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = { category: "ALL", severity: "ALL", search: "", from: "", to: "" };

export const AUDIT_SEVERITIES = ["INFO", "SUCCESS", "WARNING", "CRITICAL"];

/** Converts the filter form into the backend query (fromDate / toDate are ISO instants, inclusive UTC days). */
export function auditQueryFromFilters(filters: AuditFilters) {
  return {
    category: filters.category,
    severity: filters.severity,
    search: filters.search.trim() || undefined,
    fromDate: filters.from ? `${filters.from}T00:00:00Z` : undefined,
    toDate: filters.to ? `${filters.to}T23:59:59Z` : undefined,
  };
}

export const AUDIT_CSV_HEADERS = ["Timestamp (UTC)", "Category", "Severity", "Action", "Summary", "Actor", "Actor Email", "Target"];

/** CSV rows for exactly the events currently loaded from the server (there is no server-side audit export). */
export function auditCsvRows(rows: AdminAuditLog[]): (string | null)[][] {
  return rows.map((l) => [
    l.timestamp,
    l.category,
    l.severity,
    l.action,
    l.summary,
    l.actor_name,
    l.actor_email,
    l.target_label,
  ]);
}

/** Counts shown in the KPI cards; computed only from loaded rows, never estimated. */
export function auditCounts(rows: AdminAuditLog[]) {
  let warning = 0;
  let critical = 0;
  const actors = new Set<string>();
  for (const r of rows) {
    if (r.severity === "WARNING") warning++;
    if (r.severity === "CRITICAL") critical++;
    const actor = r.actor_email || r.actor_name;
    if (actor) actors.add(actor);
  }
  return { total: rows.length, warning, critical, actors: actors.size };
}

function severityTone(severity: string): StatusTone {
  if (severity === "CRITICAL") return "danger";
  if (severity === "WARNING") return "warning";
  if (severity === "SUCCESS") return "success";
  return "info";
}

export interface AuditLogViewProps {
  state: ResourceState<AdminAuditLog[]>;
  filters: AuditFilters;
  categories: string[];
  onFiltersChange: (next: AuditFilters) => void;
  onRetry: () => void;
}

export function AuditLogView({ state, filters, categories, onFiltersChange, onRetry }: AuditLogViewProps) {
  const rows = useMemo(() => (state.status === "ready" ? state.data : []), [state]);
  const ready = state.status === "ready";
  const counts = auditCounts(rows);
  const set = (patch: Partial<AuditFilters>) => onFiltersChange({ ...filters, ...patch });
  const filtered =
    filters.category !== "ALL" ||
    filters.severity !== "ALL" ||
    filters.search.trim() !== "" ||
    filters.from !== "" ||
    filters.to !== "";

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  useEffect(() => setPage(1), [rows]);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const exportLoaded = () =>
    downloadRowsCsv(`prowise-audit-log-${todayStamp()}.csv`, AUDIT_CSV_HEADERS, auditCsvRows(rows));

  const kpi = (n: number) => (ready ? n : "-");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit & Compliance"
        description="Platform-level administrative events recorded by the server. Filter high-risk actions and export the loaded results."
        badge={ready ? `${rows.length} events` : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              onClick={exportLoaded}
              disabled={!ready || rows.length === 0}
              title="Downloads the events currently loaded on this page"
            >
              <Download className="w-3.5 h-3.5" />
              Export loaded rows (CSV)
            </AdminButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Events in results"
          value={kpi(counts.total)}
          sublabel={filtered ? "Matching the current filters" : "All recorded events"}
          icon={ClipboardCheck}
          tone="blue"
        />
        <KpiCard
          label="Warning / Critical"
          value={kpi(counts.warning + counts.critical)}
          sublabel={ready ? `${counts.critical} critical` : undefined}
          icon={AlertTriangle}
          tone={counts.critical > 0 ? "rose" : counts.warning > 0 ? "amber" : "emerald"}
        />
        <KpiCard label="Critical events" value={kpi(counts.critical)} sublabel="In current results" icon={ShieldAlert} tone="rose" />
        <KpiCard label="Distinct actors" value={kpi(counts.actors)} sublabel="In current results" icon={Users} tone="violet" />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={filters.search}
          onSearchChange={(v) => set({ search: v })}
          searchPlaceholder="Search action, summary, actor..."
          hasActiveFilters={filtered}
          onResetFilters={() => onFiltersChange(EMPTY_AUDIT_FILTERS)}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-44">
                <AdminSelect
                  aria-label="Filter by category"
                  value={filters.category}
                  onChange={(e) => set({ category: e.target.value })}
                  options={[{ label: "All categories", value: "ALL" }, ...categories.map((c) => ({ label: humanize(c), value: c }))]}
                />
              </div>
              <div className="w-40">
                <AdminSelect
                  aria-label="Filter by severity"
                  value={filters.severity}
                  onChange={(e) => set({ severity: e.target.value })}
                  options={[{ label: "All severities", value: "ALL" }, ...AUDIT_SEVERITIES.map((s) => ({ label: humanize(s), value: s }))]}
                />
              </div>
              <div className="w-40">
                <AdminInput type="date" aria-label="From (UTC)" title="From (UTC)" value={filters.from} onChange={(e) => set({ from: e.target.value })} />
              </div>
              <div className="w-40">
                <AdminInput type="date" aria-label="To (UTC)" title="To (UTC)" value={filters.to} onChange={(e) => set({ to: e.target.value })} />
              </div>
            </div>
          }
        />

        <ResourceStatus
          state={state}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={FileText}
          emptyTitle={filtered ? "No events match these filters" : "No audit events yet"}
          emptyDescription={
            filtered
              ? "Change or clear the filters to see more events."
              : "Administrative actions will appear here once they are recorded by the server."
          }
        />

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[760px] text-xs" aria-label="Audit events">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                    <th className="py-3 px-4 w-16 whitespace-nowrap">Sr. No.</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Area</th>
                    <th className="py-3 px-4">Action &amp; Details</th>
                    <th className="py-3 px-4">Performed By</th>
                    <th className="py-3 px-4">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {pageRows.map((log, idx) => (
                    <tr key={log.id} className="hover:bg-[var(--color-hover)] transition-colors">
                      <td className="py-3 px-4 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {(safePage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-[var(--color-text-secondary)]">{formatInstant(log.timestamp)}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                          {humanize(log.category)}
                        </span>
                      </td>
                      <td className="py-3 px-4 min-w-[260px]">
                        <p className="font-semibold font-mono text-[11px] text-[var(--color-text-primary)]">{log.action}</p>
                        <p className="text-[var(--color-text-secondary)] mt-0.5">{log.summary}</p>
                        {log.target_label && (
                          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">Target: {log.target_label}</p>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full border border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {getOrgInitials(log.actor_name || log.actor_email || "?")}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--color-text-primary)]">{log.actor_name || "-"}</p>
                            {log.actor_email && <p className="text-[11px] text-[var(--color-text-muted)]">{log.actor_email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge label={humanize(log.severity)} tone={severityTone(log.severity)} dot />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar
              currentPage={safePage}
              totalItems={rows.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
