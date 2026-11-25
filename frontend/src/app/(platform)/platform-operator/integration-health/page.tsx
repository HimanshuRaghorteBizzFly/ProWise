"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  CheckCircle2,
  GitBranch,
  LayoutGrid,
  List,
  PauseCircle,
  PlayCircle,
  Plug,
  RefreshCw,
} from "lucide-react";
import type { OpsIntegration } from "@/types/operator-console";
import { useOperatorPermissions } from "../_services/operator-access";
import { operatorApi } from "../_services/operator-api";
import { formatDateTime } from "../_services/operator-service";
import {
  BulkSelectionBar,
  ConfirmModal,
  DemoDataBanner,
  EmptyState,
  FilterBar,
  KpiCard,
  OpButton,
  OpSelect,
  PageHeader,
  PaginationBar,
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";
import {
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  humanizeCode,
  readyValue,
  rowsOf,
  useOperatorResource,
} from "../_components/OperatorLive";

type IntegSortField = "name" | "category" | "status" | "errorRatePct" | "avgLatencyMs" | "failureCount24h";

const DIAGNOSTIC_REASON = "there is no diagnostic endpoint for integrations";
const PAUSE_REASON = "there is no pause or resume endpoint for integrations";

/**
 * One installation as the page shows it (GET /v1/operator/integrations). `config_json` is returned by the server but
 * never read here: it can carry provider configuration. Error rate and latency are not measured by the server.
 */
interface IntegrationRow {
  id: string;
  name: string;
  category: string;
  status: string;
  connection: string;
  errorCount: number;
  lastDiagnosticSummary: string;
  lastCheckAt: string;
}

function toRow(i: OpsIntegration): IntegrationRow {
  return {
    id: i.id,
    name: i.name,
    category: humanizeCode(i.type),
    status: humanizeCode(i.health),
    connection: humanizeCode(i.status),
    errorCount: i.error_count,
    lastDiagnosticSummary: `Connection: ${humanizeCode(i.status)} · Health: ${humanizeCode(i.health)}`,
    lastCheckAt: i.last_synced_at ?? "",
  };
}

export default function OperatorIntegrationHealthPage() {
  const { state, reload } = useOperatorResource(() => operatorApi.integrations(), "integrations");
  const integrations = useMemo(() => rowsOf(state).map(toRow), [state]);
  const categoryOptions = useMemo(
    () => Array.from(new Set(integrations.map((i) => i.category))).sort(),
    [integrations]
  );
  const { can } = useOperatorPermissions();
  const canManage = can("integrations.manage");

  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortField, setSortField] = useState<IntegSortField>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  // Pause / Resume has no endpoint: the confirmation stays in place but nothing opens it yet.
  const [pauseTarget, setPauseTarget] = useState<IntegrationRow | null>(null);

  const healthyCount = useMemo(
    () => integrations.filter((i) => i.status === "Healthy").length,
    [integrations]
  );
  const totalErrors = useMemo(
    () => integrations.reduce((sum, i) => sum + i.errorCount, 0),
    [integrations]
  );

  const handleSort = (field: IntegSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "name" || field === "category" ? "asc" : "desc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = integrations.filter((i) => {
      const matchesCat = categoryFilter === "ALL" || i.category === categoryFilter;
      const matchesQ =
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.lastDiagnosticSummary.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "category") cmp = a.category.localeCompare(b.category);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else if (sortField === "errorRatePct" || sortField === "avgLatencyMs") cmp = 0;
      else cmp = a.errorCount - b.errorCount;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [integrations, categoryFilter, search, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    filtered.map((i) => i.id),
    paginated.map((i) => i.id)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Health"
        badge={state.status === "ready" ? `${healthyCount}/${integrations.length} Healthy` : "- Healthy"}
        liveData
        description="Check connected external services, run guided connection diagnostics, and pause non-critical background sync when needed."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OpButton variant="outline" size="sm" onClick={() => void reload()}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </OpButton>
            <Link href="/platform-operator/github-monitoring">
              <OpButton variant="outline" size="sm">
                <GitBranch className="w-3.5 h-3.5" />
                GitHub App
              </OpButton>
            </Link>
            <Link href="/platform-operator/failed-events">
              <OpButton variant="primary" size="sm">
                Failed Events
              </OpButton>
            </Link>
          </div>
        }
      />

      <DemoDataBanner
        title="Delegated Integration Operations"
        description="Platform Operators monitor connectivity, run diagnostics, and retry deliveries. API credentials and global enable/disable policies are managed in Super Admin."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Healthy Connectors"
          value={readyValue(state, () => `${healthyCount} / ${integrations.length}`)}
          sublabel="Connected platform services"
          icon={CheckCircle2}
          tone={healthyCount === integrations.length ? "emerald" : "amber"}
        />
        <KpiCard
          label="Connector Errors"
          value={readyValue(state, () => totalErrors)}
          sublabel="Error count reported by the server"
          icon={Activity}
          tone={totalErrors > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Average Response Speed"
          value="—"
          sublabel="Not available yet"
          icon={Plug}
          tone="teal"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search integration name or diagnostic..."
          hasActiveFilters={Boolean(search || categoryFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setCategoryFilter("ALL");
          }}
          filters={
            <div className="w-full sm:w-52">
              <OpSelect
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter category"
                options={[
                  { label: "All Categories", value: "ALL" },
                  ...categoryOptions.map((c) => ({ label: c, value: c })),
                ]}
              />
            </div>
          }
          rightActions={
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("CARDS")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "CARDS"
                    ? "bg-[#0D9488] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("TABLE")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "TABLE"
                    ? "bg-[#0D9488] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
            </div>
          }
        />

        {state.status !== "ready" || state.data.length === 0 ? (
          <OperatorResourceStatus
            state={state}
            isEmpty={(d) => d.length === 0}
            onRetry={() => void reload()}
            emptyIcon={Plug}
            emptyTitle="No integrations installed"
            emptyDescription="The server has no external service integrations to show."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={Plug}
            title="No integrations match your filter"
            description="Reset your search or category filter to inspect service connectors."
          />
        ) : viewMode === "CARDS" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)]/40 overflow-hidden">
              <div className="px-4 py-2 flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected;
                    }}
                    onChange={toggleSelectPage}
                    aria-label="Select all integrations on this page"
                    className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                  />
                  <span>Select all on page ({paginated.length})</span>
                </label>
              </div>
              <BulkSelectionBar
                selectedCount={selectedIds.length}
                totalFilteredCount={filtered.length}
                onSelectAllMatching={() => setSelectedIds(filtered.map((i) => i.id))}
                onClear={() => setSelectedIds([])}
                actions={
                  <NotAvailableButton variant="primary" size="xs" reason={DIAGNOSTIC_REASON} hideLabel>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Run Diagnostics ({selectedIds.length})
                  </NotAvailableButton>
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginated.map((item, idx) => {
                const srNo = (safePage - 1) * pageSize + idx + 1;
                const isSelected = selectedSet.has(item.id);
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border bg-[var(--color-app-bg)] p-4 flex flex-col justify-between gap-4 ${
                      isSelected ? "border-teal-500 ring-1 ring-teal-500" : "border-[var(--color-border)]"
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(item.id)}
                            aria-label={`Select ${item.name}`}
                            className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] accent-teal-600 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
                                #{srNo}
                              </span>
                              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.name}</p>
                            </div>
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{item.category}</p>
                          </div>
                        </div>
                        <StatusBadge label={item.status} tone={getStatusTone(item.status)} dot />
                      </div>

                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                        {item.lastDiagnosticSummary}
                      </p>

                      <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border)] text-xs">
                        <div>
                          <span className="text-[11px] text-[var(--color-text-muted)] block">Error Rate</span>
                          <NotAvailableText reason="the server does not measure an error rate" />
                        </div>
                        <div>
                          <span className="text-[11px] text-[var(--color-text-muted)] block">Latency</span>
                          <NotAvailableText reason="the server does not measure latency" />
                        </div>
                        <div>
                          <span className="text-[11px] text-[var(--color-text-muted)] block">Errors</span>
                          <strong className="text-[var(--color-text-primary)]">{item.errorCount}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        Last synced {formatDateTime(item.lastCheckAt)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <NotAvailableButton variant="outline" size="xs" reason={DIAGNOSTIC_REASON}>
                          <RefreshCw className="w-3.5 h-3.5" />
                          Run Diagnostic
                        </NotAvailableButton>
                        <NotAvailableButton variant="subtle" size="xs" reason={PAUSE_REASON}>
                          {item.status === "Paused" ? (
                            <>
                              <PlayCircle className="w-3.5 h-3.5" />
                              Resume
                            </>
                          ) : (
                            <>
                              <PauseCircle className="w-3.5 h-3.5" />
                              Pause Sync
                            </>
                          )}
                        </NotAvailableButton>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((i) => i.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <NotAvailableButton variant="primary" size="xs" reason={DIAGNOSTIC_REASON} hideLabel>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Run Diagnostics ({selectedIds.length})
                </NotAvailableButton>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-elevated)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    <th className="py-2.5 px-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = somePageSelected;
                        }}
                        onChange={toggleSelectPage}
                        aria-label="Select all integrations on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Connector" active={sortField === "name"} direction={sortDir} onSort={() => handleSort("name")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Category" active={sortField === "category"} direction={sortDir} onSort={() => handleSort("category")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Error %" active={sortField === "errorRatePct"} direction={sortDir} onSort={() => handleSort("errorRatePct")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Latency" active={sortField === "avgLatencyMs"} direction={sortDir} onSort={() => handleSort("avgLatencyMs")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((item, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(item.id);
                    return (
                      <tr key={item.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(item.id)}
                            aria-label={`Select ${item.name}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 font-semibold text-[var(--color-text-primary)]">{item.name}</td>
                        <td className="py-3 px-3.5">{item.category}</td>
                        <td className="py-3 px-3.5">
                          <StatusBadge label={item.status} tone={getStatusTone(item.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 tabular-nums">
                          <NotAvailableText reason="the server does not measure an error rate" />
                        </td>
                        <td className="py-3 px-3.5 tabular-nums">
                          <NotAvailableText reason="the server does not measure latency" />
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <NotAvailableButton variant="outline" size="xs" reason={DIAGNOSTIC_REASON} hideLabel>
                              Diagnostic
                            </NotAvailableButton>
                            <NotAvailableButton variant="subtle" size="xs" reason={PAUSE_REASON} hideLabel>
                              {item.status === "Paused" ? "Resume" : "Pause"}
                            </NotAvailableButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
        {!canManage && <span className="sr-only">Your role cannot manage integrations.</span>}
      </SurfaceCard>

      <ConfirmModal
        isOpen={Boolean(pauseTarget)}
        onClose={() => setPauseTarget(null)}
        title={
          pauseTarget?.status === "Paused"
            ? `Resume "${pauseTarget.name}"?`
            : `Pause "${pauseTarget?.name}" Sync?`
        }
        description={
          pauseTarget?.status === "Paused"
            ? "Resuming restarts normal background monitoring and event delivery for this integration."
            : "Pausing temporarily holds non-critical background sync while troubleshooting connection errors."
        }
        confirmLabel={pauseTarget?.status === "Paused" ? "Resume Sync" : "Pause Sync"}
        variant={pauseTarget?.status === "Paused" ? "primary" : "danger"}
        onConfirm={() => {
          // No pause/resume endpoint exists; nothing is changed locally either.
          setPauseTarget(null);
        }}
      />
    </div>
  );
}
