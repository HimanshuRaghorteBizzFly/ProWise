"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, History } from "lucide-react";
import { useDebounced } from "@/components/super-admin/admin-resource";
import type { OperatorActivityLogItem } from "@/types/operator-console";
import { operatorApi } from "../_services/operator-api";
import { exportRowsToCsv, formatDateTime } from "../_services/operator-service";
import {
  NOT_AVAILABLE,
  NotAvailableText,
  OperatorResourceStatus,
  humanizeCode,
  pageItemsOf,
  pageTotalOf,
  toServerPaging,
  useOperatorResource,
} from "../_components/OperatorLive";
import {
  BulkSelectionBar,
  DemoDataBanner,
  FilterBar,
  KpiCard,
  OpButton,
  OpInput,
  OpSelect,
  PageHeader,
  PaginationBar,
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type LogSortField = "timestamp" | "category" | "action" | "actorName" | "severity";

const SEVERITY_REASON = "the server records no severity for operator actions";
const CATEGORY_REASON = "the server has no category for log entries; filter by source instead";

/** "Category" of a server entry: its module (or resource type), never an invented label. */
function categoryOf(log: OperatorActivityLogItem): string {
  return humanizeCode(log.module_key ?? log.resource_type ?? log.source);
}

function targetOf(log: OperatorActivityLogItem): string | null {
  if (!log.resource_type && !log.resource_id) return null;
  return [humanizeCode(log.resource_type), log.resource_id].filter((v) => v && v !== "-").join(" ");
}

/** A `date` input (viewer's local day) as the UTC instant of that local midnight. */
function localDateToInstant(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Operator activity and audit trail from GET /v1/operator/activity-logs (audit.activity_logs:view). Server-side
 * search, source and date filters with 0-based paging; sorting reorders the page that was loaded. The server records
 * no severity or category, so those filters stay visible but disabled.
 */
export default function OperatorActivityLogsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [sortField, setSortField] = useState<LogSortField>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const debouncedSearch = useDebounced(search);
  const from = localDateToInstant(dateFrom);
  const paging = toServerPaging(page, pageSize);
  const filters = { search: debouncedSearch, source: sourceFilter, from, ...paging };

  const { state, reload } = useOperatorResource(
    () => operatorApi.activityLogs(filters),
    `activity-logs:${debouncedSearch}:${sourceFilter}:${from ?? ""}:${paging.page}:${paging.size}`,
  );
  const isReady = state.status === "ready";
  const logs = useMemo(() => pageItemsOf(state), [state]);
  const total = pageTotalOf(state);

  const handleSort = (field: LogSortField) => {
    if (field === "severity") return;
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "timestamp" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    return [...logs].sort((a, b) => {
      let cmp = 0;
      if (sortField === "category") cmp = categoryOf(a).localeCompare(categoryOf(b));
      else if (sortField === "action") cmp = a.action.localeCompare(b.action);
      else if (sortField === "actorName") cmp = (a.operator_name ?? "").localeCompare(b.operator_name ?? "");
      else cmp = new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [logs, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sourceFilter, dateFrom, pageSize]);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    sorted.map((l) => l.id),
    sorted.map((l) => l.id)
  );

  const csvRow = (l: OperatorActivityLogItem, i?: number) => {
    const base = [
      formatDateTime(l.occurred_at),
      l.source,
      categoryOf(l),
      l.action,
      l.details ?? "",
      l.operator_name ?? l.operator_id ?? "—",
      targetOf(l) ?? "—",
    ];
    return i === undefined ? base : [i + 1, ...base];
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-operator-activity-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Timestamp", "Source", "Category", "Action", "Summary", "Operator", "Target"],
      sorted.map((l, i) => csvRow(l, i))
    );
    toast.success(`Exported ${sorted.length} operational log record(s) to CSV.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Activity Logs"
        badge={isReady ? `${total} Events` : undefined}
        liveData
        description="Searchable operational history recording incident actions, retries, ticket replies, backups, and escalations."
      />

      <DemoDataBanner
        title="Automatic Operational Traceability"
        description="Every retry, escalation, draft submission, and access request performed in the Platform Operator panel appends an entry here."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Recorded Operator Actions"
          value={isReady ? total : "-"}
          sublabel="Matching entries recorded on the server"
          icon={History}
          tone="teal"
        />
        <KpiCard
          label="Warning / Critical Actions"
          value="—"
          sublabel={`${NOT_AVAILABLE}: ${SEVERITY_REASON}`}
          icon={AlertTriangle}
          tone="slate"
        />
        <KpiCard
          label="Routine Operations"
          value="—"
          sublabel={`${NOT_AVAILABLE}: ${SEVERITY_REASON}`}
          icon={CheckCircle2}
          tone="slate"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search action, operator, target, or summary..."
          hasActiveFilters={Boolean(search || sourceFilter !== "ALL" || dateFrom)}
          onResetFilters={() => {
            setSearch("");
            setCategoryFilter("ALL");
            setSeverityFilter("ALL");
            setSourceFilter("ALL");
            setDateFrom("");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={sorted.length === 0}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <OpSelect
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  aria-label="Filter log source"
                  options={[
                    { label: "All Sources", value: "ALL" },
                    { label: "Activity", value: "ACTIVITY" },
                    { label: "Audit", value: "AUDIT" },
                  ]}
                />
              </div>
              <div className="w-40" title={`${NOT_AVAILABLE}: ${CATEGORY_REASON}`} data-not-available="true">
                <OpSelect
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter log category"
                  disabled
                  title={`${NOT_AVAILABLE}: ${CATEGORY_REASON}`}
                  options={[
                    { label: "All Categories", value: "ALL" },
                    { label: "Incident", value: "Incident" },
                    { label: "Support", value: "Support" },
                    { label: "Integration", value: "Integration" },
                    { label: "Communication", value: "Communication" },
                    { label: "Billing", value: "Billing" },
                    { label: "System", value: "System" },
                    { label: "Account", value: "Account" },
                  ]}
                />
                <span className="text-[10px] leading-none text-[var(--color-text-muted)]">{NOT_AVAILABLE}</span>
              </div>
              <div className="w-36" title={`${NOT_AVAILABLE}: ${SEVERITY_REASON}`} data-not-available="true">
                <OpSelect
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  aria-label="Filter log severity"
                  disabled
                  title={`${NOT_AVAILABLE}: ${SEVERITY_REASON}`}
                  options={[
                    { label: "All Levels", value: "ALL" },
                    { label: "Info", value: "Info" },
                    { label: "Warning", value: "Warning" },
                    { label: "Critical", value: "Critical" },
                  ]}
                />
                <span className="text-[10px] leading-none text-[var(--color-text-muted)]">{NOT_AVAILABLE}</span>
              </div>
              <div className="w-40">
                <OpInput
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  aria-label="From date"
                />
              </div>
            </div>
          }
        />

        {state.status !== "ready" || sorted.length === 0 ? (
          <OperatorResourceStatus
            state={state.status === "ready" ? { status: "ready", data: sorted } : state}
            isEmpty={(data) => data.length === 0}
            onRetry={() => void reload()}
            emptyIcon={History}
            emptyTitle="No operational logs match your filter"
            emptyDescription="Adjust source, date, or search terms to view logged actions."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={sorted.length}
              onSelectAllMatching={() => setSelectedIds(sorted.map((l) => l.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    const chosen = sorted.filter((l) => selectedSet.has(l.id));
                    exportRowsToCsv(
                      `prowise-selected-logs-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Timestamp", "Source", "Category", "Action", "Summary", "Operator", "Target"],
                      chosen.map((l) => csvRow(l))
                    );
                    toast.success(`Exported ${chosen.length} selected log entry(ies).`);
                  }}
                >
                  Export Selected ({selectedIds.length})
                </OpButton>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[820px]">
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
                        aria-label="Select all activity logs on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Timestamp" active={sortField === "timestamp"} direction={sortDir} onSort={() => handleSort("timestamp")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Category" active={sortField === "category"} direction={sortDir} onSort={() => handleSort("category")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Action & Summary" active={sortField === "action"} direction={sortDir} onSort={() => handleSort("action")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Operator" active={sortField === "actorName"} direction={sortDir} onSort={() => handleSort("actorName")} />
                    </th>
                    <th className="py-2.5 px-3.5" title={`${NOT_AVAILABLE}: ${SEVERITY_REASON}`}>
                      <SortableHeader label="Severity" active={false} direction={sortDir} onSort={() => handleSort("severity")} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {sorted.map((log, idx) => {
                    const srNo = (page - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(log.id);
                    const cellPy = "py-3";
                    const target = targetOf(log);
                    return (
                      <tr key={log.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className={`${cellPy} px-3.5`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(log.id)}
                            aria-label={`Select log ${log.action}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className={`${cellPy} px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums`}>
                          {srNo}
                        </td>
                        <td className={`${cellPy} px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]`}>
                          {formatDateTime(log.occurred_at)}
                        </td>
                        <td className={`${cellPy} px-3.5 whitespace-nowrap`}>
                          <StatusBadge label={categoryOf(log)} tone="neutral" />
                          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{humanizeCode(log.source)}</div>
                        </td>
                        <td className={`${cellPy} px-3.5 min-w-[260px]`}>
                          <p className="font-semibold text-[var(--color-text-primary)]">{log.action}</p>
                          {log.details && <p className="text-[var(--color-text-secondary)] mt-0.5 break-words">{log.details}</p>}
                          {target && (
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                              Target: {target}
                            </p>
                          )}
                        </td>
                        <td className={`${cellPy} px-3.5 whitespace-nowrap font-medium text-[var(--color-text-primary)]`}>
                          {log.operator_name ?? log.operator_id ?? "—"}
                          {log.ip_address && (
                            <div className="text-[10px] font-normal text-[var(--color-text-muted)]">{log.ip_address}</div>
                          )}
                        </td>
                        <td className={`${cellPy} px-3.5 whitespace-nowrap`}>
                          <NotAvailableText reason={SEVERITY_REASON} />
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
          currentPage={page}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </SurfaceCard>
    </div>
  );
}
