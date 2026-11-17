"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, History } from "lucide-react";
import { usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { exportRowsToCsv, formatDateTime } from "../_services/operator-service";
import {
  BulkSelectionBar,
  DemoDataBanner,
  EmptyState,
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
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type LogSortField = "timestamp" | "category" | "action" | "actorName" | "severity";

export default function OperatorActivityLogsPage() {
  const activityLogs = usePlatformOperatorStore((s) => s.activityLogs);
  const compactTables = usePlatformOperatorStore((s) => s.accountSettings.compactTables);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [sortField, setSortField] = useState<LogSortField>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const warningOrCriticalCount = useMemo(
    () => activityLogs.filter((l) => l.severity !== "Info").length,
    [activityLogs]
  );

  const handleSort = (field: LogSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "timestamp" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const sevRank: Record<string, number> = { Critical: 0, Warning: 1, Info: 2 };

    const list = activityLogs.filter((log) => {
      const matchesQ =
        !q ||
        log.action.toLowerCase().includes(q) ||
        log.summary.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q) ||
        (log.target || "").toLowerCase().includes(q);
      const matchesCat = categoryFilter === "ALL" || log.category === categoryFilter;
      const matchesSev = severityFilter === "ALL" || log.severity === severityFilter;
      const matchesDate = !fromMs || new Date(log.timestamp).getTime() >= fromMs;
      return matchesQ && matchesCat && matchesSev && matchesDate;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "category") cmp = a.category.localeCompare(b.category);
      else if (sortField === "action") cmp = a.action.localeCompare(b.action);
      else if (sortField === "actorName") cmp = a.actorName.localeCompare(b.actorName);
      else if (sortField === "severity") cmp = (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9);
      else cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [activityLogs, search, categoryFilter, severityFilter, dateFrom, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, severityFilter, dateFrom, pageSize]);

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
    filtered.map((l) => l.id),
    paginated.map((l) => l.id)
  );

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-operator-activity-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Timestamp", "Category", "Severity", "Action", "Summary", "Operator", "Target"],
      filtered.map((l, i) => [
        i + 1,
        l.timestamp,
        l.category,
        l.severity,
        l.action,
        l.summary,
        l.actorName,
        l.target || "—",
      ])
    );
    toast.success(`Exported ${filtered.length} operational log record(s) to CSV.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational Activity Logs"
        badge={`${activityLogs.length} Events`}
        demoLabel="Local Audit Trail"
        description="Searchable operational history recording incident actions, retries, ticket replies, backups, and escalations."
      />

      <DemoDataBanner
        title="Automatic Operational Traceability"
        description="Every retry, escalation, draft submission, and access request performed in the Platform Operator panel appends an entry here."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Recorded Operator Actions"
          value={activityLogs.length}
          sublabel="Persisted locally for session continuity"
          icon={History}
          tone="teal"
        />
        <KpiCard
          label="Warning / Critical Actions"
          value={warningOrCriticalCount}
          sublabel="Escalations, pauses, and sensitive steps"
          icon={AlertTriangle}
          tone={warningOrCriticalCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Routine Operations"
          value={activityLogs.length - warningOrCriticalCount}
          sublabel="Probes, ticket updates, and deliveries"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search action, operator, target, or summary..."
          hasActiveFilters={Boolean(search || categoryFilter !== "ALL" || severityFilter !== "ALL" || dateFrom)}
          onResetFilters={() => {
            setSearch("");
            setCategoryFilter("ALL");
            setSeverityFilter("ALL");
            setDateFrom("");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={filtered.length === 0}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <OpSelect
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter log category"
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
              </div>
              <div className="w-36">
                <OpSelect
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  aria-label="Filter log severity"
                  options={[
                    { label: "All Levels", value: "ALL" },
                    { label: "Info", value: "Info" },
                    { label: "Warning", value: "Warning" },
                    { label: "Critical", value: "Critical" },
                  ]}
                />
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

        {paginated.length === 0 ? (
          <EmptyState
            icon={History}
            title="No operational logs match your filter"
            description="Adjust category, severity, date, or search terms to view logged actions."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((l) => l.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    const chosen = activityLogs.filter((l) => selectedSet.has(l.id));
                    exportRowsToCsv(
                      `prowise-selected-logs-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Timestamp", "Category", "Severity", "Action", "Summary", "Operator"],
                      chosen.map((l) => [l.timestamp, l.category, l.severity, l.action, l.summary, l.actorName])
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
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Severity" active={sortField === "severity"} direction={sortDir} onSort={() => handleSort("severity")} />
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((log, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(log.id);
                    const cellPy = compactTables ? "py-2" : "py-3";
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
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className={`${cellPy} px-3.5 whitespace-nowrap`}>
                          <StatusBadge label={log.category} tone="neutral" />
                        </td>
                        <td className={`${cellPy} px-3.5 min-w-[260px]`}>
                          <p className="font-semibold text-[var(--color-text-primary)]">{log.action}</p>
                          <p className="text-[var(--color-text-secondary)] mt-0.5">{log.summary}</p>
                          {log.target && (
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                              Target: {log.target}
                            </p>
                          )}
                        </td>
                        <td className={`${cellPy} px-3.5 whitespace-nowrap font-medium text-[var(--color-text-primary)]`}>
                          {log.actorName}
                        </td>
                        <td className={`${cellPy} px-3.5 whitespace-nowrap`}>
                          <StatusBadge label={log.severity} tone={getStatusTone(log.severity)} dot />
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
      </SurfaceCard>
    </div>
  );
}
