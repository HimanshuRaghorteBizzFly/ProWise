"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, AlertTriangle, Bell, Clock, RefreshCw, ServerCrash } from "lucide-react";
import { useDebounced } from "@/components/super-admin/admin-resource";
import { operatorApi } from "../_services/operator-api";
import { useOperatorPermissions } from "../_services/operator-access";
import { formatDateTime } from "../_services/operator-service";
import {
  MutationNotice,
  NOT_AVAILABLE,
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  pageItemsOf,
  pageTotalOf,
  toServerPaging,
  useOperatorMutation,
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
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";
import { QueueBarChart } from "../_components/OperatorCharts";

type ApiSortField = "endpointLabel" | "status" | "requestsPerMin" | "errorRatePct" | "avgLatencyMs";

/** One endpoint row built from the server's error summary (`by_path`). */
interface EndpointErrorRow {
  id: string;
  method: string;
  path: string;
  count: number;
  serverErrors: number;
  /** Degraded = at least one 5xx in the window; Elevated = client errors only. */
  status: "Degraded" | "Elevated";
}

/** `datetime-local` value (viewer's local time) as a UTC instant for the API. */
function localToInstant(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Real API error monitoring: the server's error summary for the last 24 hours (GET /v1/operator/api-errors/summary)
 * and the raw error log (GET /v1/operator/api-errors). The server records refused requests only, so request volume,
 * error rate and latency are "Not available yet".
 */
export default function OperatorApiErrorMonitoringPage() {
  const { can } = useOperatorPermissions();
  const canOpenIncident = can("incidents.manage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<ApiSortField>("errorRatePct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  /* raw log filters (server side) */
  const [logClass, setLogClass] = useState("ALL");
  const [logStatus, setLogStatus] = useState("");
  const [logPath, setLogPath] = useState("");
  const [logCode, setLogCode] = useState("");
  const [logFrom, setLogFrom] = useState("");
  const [logTo, setLogTo] = useState("");
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);

  const summary = useOperatorResource(() => operatorApi.apiErrors.summary(), "api-errors-summary");
  const debouncedPath = useDebounced(logPath);
  const debouncedCode = useDebounced(logCode);
  const debouncedStatus = useDebounced(logStatus);
  const logQuery = {
    status_class: logClass,
    status: debouncedStatus.trim() || undefined,
    path: debouncedPath.trim() || undefined,
    code: debouncedCode.trim() || undefined,
    from: localToInstant(logFrom),
    to: localToInstant(logTo),
    ...toServerPaging(logPage, logPageSize),
  };
  const log = useOperatorResource(() => operatorApi.apiErrors.list(logQuery), `api-errors:${JSON.stringify(logQuery)}`);
  const logRows = useMemo(() => pageItemsOf(log.state), [log.state]);
  const logTotal = pageTotalOf(log.state);

  const reloadAll = () => {
    void summary.reload();
    void log.reload();
  };
  const incidentMutation = useOperatorMutation(reloadAll);

  const summaryData = summary.state.status === "ready" ? summary.state.data : null;

  const endpoints: EndpointErrorRow[] = useMemo(
    () =>
      (summaryData?.by_path ?? []).map((p) => ({
        id: `${p.method} ${p.path}`,
        method: p.method,
        path: p.path,
        count: p.count,
        serverErrors: p.server_errors,
        status: p.server_errors > 0 ? "Degraded" : "Elevated",
      })),
    [summaryData]
  );
  const elevatedCount = endpoints.length;

  const handleSort = (field: ApiSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "endpointLabel" || field === "status" ? "asc" : "desc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = endpoints.filter((ep) => {
      const matchesQ = !q || ep.path.toLowerCase().includes(q) || ep.method.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || ep.status === statusFilter;
      return matchesQ && matchesStatus;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "endpointLabel") cmp = a.path.localeCompare(b.path);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else if (sortField === "errorRatePct" || sortField === "requestsPerMin") cmp = a.count - b.count;
      else cmp = a.serverErrors - b.serverErrors;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [endpoints, search, statusFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);
  useEffect(() => {
    setLogPage(1);
  }, [logClass, debouncedStatus, debouncedPath, debouncedCode, logFrom, logTo, logPageSize]);

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
    filtered.map((e) => e.id),
    paginated.map((e) => e.id)
  );

  /** Declares a real incident (POST /v1/operator/incidents) describing the endpoint's errors. */
  const openIncident = (rows: EndpointErrorRow[]) => {
    if (rows.length === 0) return;
    void incidentMutation.run(
      `incident-${rows.map((r) => r.id).join(",")}`,
      async () => {
        for (const ep of rows) {
          await operatorApi.incidents.create({
            title: `API errors on ${ep.method} ${ep.path}`,
            severity: ep.serverErrors > 0 ? "SEV_2" : "SEV_3",
            description: `${ep.count} refused request(s) in the last 24 hours, ${ep.serverErrors} of them server errors (5xx).`,
          });
        }
      },
      rows.length === 1 ? `Opened incident for ${rows[0].id}.` : `Opened incidents for ${rows.length} endpoint(s).`
    );
  };

  const chartData = useMemo(
    () =>
      endpoints.slice(0, 10).map((ep) => ({
        label: `${ep.method} ${ep.path}`,
        errors: ep.count,
        serverErrors: ep.serverErrors,
      })),
    [endpoints]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Error Monitoring"
        badge={summaryData ? `${elevatedCount} Elevated` : undefined}
        liveData
        description="Track traffic volume, failure rates, and slow endpoints in plain business terms and open incidents when error spikes occur."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/platform-operator/alerts">
              <OpButton variant="outline" size="sm">
                <Bell className="w-3.5 h-3.5" />
                View Alerts
              </OpButton>
            </Link>
            <OpButton
              variant="primary"
              size="sm"
              isLoading={summary.state.status === "loading"}
              onClick={() => {
                reloadAll();
                toast.success("Refreshed API error metrics.");
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Metrics
            </OpButton>
          </div>
        }
      />

      <DemoDataBanner
        title="Non-Technical Endpoint Labels & Connected Triage"
        description="API routes are grouped by customer feature area. Operators can declare incidents directly from any degraded endpoint."
      />

      <MutationNotice notice={incidentMutation.notice} onReload={reloadAll} onDismiss={incidentMutation.clearNotice} />

      {summary.state.status === "error" && (
        <OperatorResourceStatus
          state={summary.state}
          isEmpty={() => false}
          onRetry={() => void summary.reload()}
          emptyTitle=""
          emptyDescription=""
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Requests / Minute"
          value={NOT_AVAILABLE}
          sublabel="Not available yet: the server records refused requests only"
          icon={Activity}
          tone="teal"
        />
        <KpiCard
          label="Average Error Rate"
          value={NOT_AVAILABLE}
          sublabel="Not available yet: total request volume is not measured"
          icon={AlertTriangle}
          tone={elevatedCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Average Response Time"
          value={NOT_AVAILABLE}
          sublabel="Not available yet: latency is not measured"
          icon={Clock}
          tone="blue"
        />
        <KpiCard
          label="Elevated Endpoints"
          value={summaryData ? elevatedCount : "-"}
          sublabel="Endpoints with refused requests in the last 24h"
          icon={AlertTriangle}
          tone={elevatedCount > 0 ? "amber" : "emerald"}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="API Errors (24h)"
          value={summaryData ? summaryData.total : "-"}
          sublabel="Every 4xx and 5xx answer the server recorded"
          icon={Activity}
          tone="teal"
        />
        <KpiCard
          label="Client Errors (4xx)"
          value={summaryData ? summaryData.client_errors : "-"}
          sublabel="Validation, permission and not-found refusals"
          icon={AlertTriangle}
          tone="amber"
        />
        <KpiCard
          label="Server Errors (5xx)"
          value={summaryData ? summaryData.server_errors : "-"}
          sublabel="Failures on the server side"
          icon={ServerCrash}
          tone={summaryData && summaryData.server_errors > 0 ? "rose" : "emerald"}
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Average vs. Peak (p95) Latency by Feature Area
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Highlights which areas experience occasional slow requests during peak load.
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center">
          <NotAvailableText reason="the server does not measure request latency" />
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <SurfaceCard className="p-4 sm:p-5 space-y-3 lg:col-span-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Errors by Endpoint (last 24h)</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">All refused requests vs. server errors, top endpoints.</p>
          </div>
          {summaryData && chartData.length > 0 ? (
            <QueueBarChart
              data={chartData}
              primaryKey="errors"
              primaryLabel="All errors"
              secondaryKey="serverErrors"
              secondaryLabel="Server errors (5xx)"
              height={230}
            />
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              {summaryData ? "No API errors recorded in this window." : "Loading..."}
            </p>
          )}
        </SurfaceCard>
        <SurfaceCard className="p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">By Status & Error Code</h3>
          <div className="space-y-1.5 text-xs">
            {(summaryData?.by_status ?? []).map((s) => (
              <div key={`status-${s.status}`} className="flex items-center justify-between">
                <StatusBadge label={String(s.status)} tone={s.status >= 500 ? "danger" : "warning"} />
                <span className="font-semibold tabular-nums">{s.count}</span>
              </div>
            ))}
            {(summaryData?.by_code ?? []).map((c) => (
              <div key={`code-${c.error_code ?? "none"}`} className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)] break-all">{c.error_code ?? "(no code)"}</span>
                <span className="font-semibold tabular-nums">{c.count}</span>
              </div>
            ))}
            {summaryData && summaryData.by_status.length === 0 && summaryData.by_code.length === 0 && (
              <p className="text-[var(--color-text-muted)]">No errors recorded.</p>
            )}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search feature area or issue summary..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
          filters={
            <div className="w-40">
              <OpSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter status"
                options={[
                  { label: "All States", value: "ALL" },
                  { label: "Normal", value: "Normal" },
                  { label: "Elevated", value: "Elevated" },
                  { label: "Degraded", value: "Degraded" },
                ]}
              />
            </div>
          }
        />

        {summary.state.status !== "ready" || paginated.length === 0 ? (
          <OperatorResourceStatus
            state={summary.state.status === "ready" ? { status: "ready", data: paginated } : summary.state}
            isEmpty={(data) => data.length === 0}
            onRetry={() => void summary.reload()}
            emptyIcon={Activity}
            emptyTitle="No matching endpoints"
            emptyDescription="No endpoint refused requests in the last 24 hours, or nothing matches your filter."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((e) => e.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="subtle"
                  size="xs"
                  disabled={!canOpenIncident || incidentMutation.busy !== null}
                  onClick={() => {
                    openIncident(endpoints.filter((e) => selectedSet.has(e.id)));
                    setSelectedIds([]);
                  }}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Open Incident ({selectedIds.length})
                </OpButton>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[860px]">
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
                        aria-label="Select all endpoints on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Feature Area" active={sortField === "endpointLabel"} direction={sortDir} onSort={() => handleSort("endpointLabel")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Traffic" active={sortField === "requestsPerMin"} direction={sortDir} onSort={() => handleSort("requestsPerMin")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Error Rate" active={sortField === "errorRatePct"} direction={sortDir} onSort={() => handleSort("errorRatePct")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Avg / Peak" active={sortField === "avgLatencyMs"} direction={sortDir} onSort={() => handleSort("avgLatencyMs")} />
                    </th>
                    <th className="py-2.5 px-3.5">Observation</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((ep, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(ep.id);
                    return (
                      <tr key={ep.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(ep.id)}
                            aria-label={`Select ${ep.id}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5">
                          <p className="font-semibold text-[var(--color-text-primary)] break-all">{ep.path}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">{ep.method}</p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={ep.status} tone={getStatusTone(ep.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-medium tabular-nums">
                          <NotAvailableText reason="request volume is not measured" />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-semibold tabular-nums">
                          <NotAvailableText reason="request volume is not measured" />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)] tabular-nums">
                          <NotAvailableText reason="latency is not measured" />
                        </td>
                        <td className="py-3 px-3.5 text-[var(--color-text-secondary)] min-w-[200px]">
                          {ep.count} refused request{ep.count === 1 ? "" : "s"} in 24h
                          {ep.serverErrors > 0 ? `, ${ep.serverErrors} server error${ep.serverErrors === 1 ? "" : "s"} (5xx)` : ", client errors only"}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <OpButton
                            variant="outline"
                            size="xs"
                            disabled={!canOpenIncident || incidentMutation.busy !== null}
                            title={canOpenIncident ? undefined : "You do not have permission for this."}
                            onClick={() => openIncident([ep])}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Incident
                          </OpButton>
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

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recent API Errors</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Every refused request the server recorded. Request bodies are never stored.
            </p>
          </div>
          <NotAvailableButton variant="outline" size="xs" reason="no API error export endpoint">
            Export Log
          </NotAvailableButton>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-32">
            <OpSelect
              value={logClass}
              onChange={(e) => setLogClass(e.target.value)}
              aria-label="Filter status class"
              options={[
                { label: "4xx and 5xx", value: "ALL" },
                { label: "4xx only", value: "4xx" },
                { label: "5xx only", value: "5xx" },
              ]}
            />
          </div>
          <div className="w-24">
            <OpInput value={logStatus} onChange={(e) => setLogStatus(e.target.value)} placeholder="Status" aria-label="Filter HTTP status" inputMode="numeric" />
          </div>
          <div className="w-48">
            <OpInput value={logPath} onChange={(e) => setLogPath(e.target.value)} placeholder="Path contains" aria-label="Filter path" />
          </div>
          <div className="w-44">
            <OpInput value={logCode} onChange={(e) => setLogCode(e.target.value)} placeholder="Error code" aria-label="Filter error code" />
          </div>
          <div className="w-48">
            <OpInput type="datetime-local" value={logFrom} onChange={(e) => setLogFrom(e.target.value)} aria-label="From" />
          </div>
          <div className="w-48">
            <OpInput type="datetime-local" value={logTo} onChange={(e) => setLogTo(e.target.value)} aria-label="To" />
          </div>
        </div>

        {log.state.status !== "ready" || logRows.length === 0 ? (
          <OperatorResourceStatus
            state={log.state.status === "ready" ? { status: "ready", data: logRows } : log.state}
            isEmpty={(data) => data.length === 0}
            onRetry={() => void log.reload()}
            emptyIcon={Activity}
            emptyTitle="No API errors match these filters"
            emptyDescription="Widen the time window or clear a filter."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left border-collapse min-w-[820px] text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-elevated)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  <th className="py-2.5 px-3.5">Time</th>
                  <th className="py-2.5 px-3.5">Request</th>
                  <th className="py-2.5 px-3.5">Status</th>
                  <th className="py-2.5 px-3.5">Error Code</th>
                  <th className="py-2.5 px-3.5">Actor</th>
                  <th className="py-2.5 px-3.5">Request ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {logRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--color-hover)]/50">
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                      {formatDateTime(row.occurred_at)}
                    </td>
                    <td className="py-2.5 px-3.5 break-all">
                      <span className="font-semibold">{row.method}</span> {row.path}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">
                      <StatusBadge label={String(row.status)} tone={row.status >= 500 ? "danger" : "warning"} dot />
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap">{row.error_code ?? "-"}</td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                      {row.actor_type ? row.actor_type.toLowerCase() : "anonymous"}
                    </td>
                    <td className="py-2.5 px-3.5 whitespace-nowrap font-mono text-[10px] text-[var(--color-text-muted)]">
                      {row.request_id ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar
          currentPage={logPage}
          totalItems={logTotal}
          pageSize={logPageSize}
          onPageChange={setLogPage}
          onPageSizeChange={(n) => {
            setLogPageSize(n);
            setLogPage(1);
          }}
        />
      </SurfaceCard>
    </div>
  );
}
