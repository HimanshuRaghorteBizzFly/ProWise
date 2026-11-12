"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Activity, AlertTriangle, Bell, Clock, RefreshCw } from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import {
  BulkSelectionBar,
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
import { QueueBarChart } from "../_components/OperatorCharts";

type ApiSortField = "endpointLabel" | "status" | "requestsPerMin" | "errorRatePct" | "avgLatencyMs";

export default function OperatorApiErrorMonitoringPage() {
  const apiEndpoints = usePlatformOperatorStore((s) => s.apiEndpoints);
  const tickLiveDemoMetrics = usePlatformOperatorStore((s) => s.tickLiveDemoMetrics);
  const createIncidentFromApiError = usePlatformOperatorStore((s) => s.createIncidentFromApiError);
  const { can } = useOperatorPermissions();
  const canOpenIncident = can("incidents.manage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<ApiSortField>("errorRatePct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const totalRpm = useMemo(
    () => apiEndpoints.reduce((sum, e) => sum + e.requestsPerMin, 0),
    [apiEndpoints]
  );
  const avgErrorRate = useMemo(() => {
    if (apiEndpoints.length === 0) return "0.00%";
    const avg = apiEndpoints.reduce((sum, e) => sum + e.errorRatePct, 0) / apiEndpoints.length;
    return `${avg.toFixed(2)}%`;
  }, [apiEndpoints]);
  const avgLatency = useMemo(() => {
    if (apiEndpoints.length === 0) return 0;
    return Math.round(apiEndpoints.reduce((sum, e) => sum + e.avgLatencyMs, 0) / apiEndpoints.length);
  }, [apiEndpoints]);
  const elevatedCount = useMemo(
    () => apiEndpoints.filter((e) => e.status !== "Normal").length,
    [apiEndpoints]
  );

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
    const list = apiEndpoints.filter((ep) => {
      const matchesQ =
        !q ||
        ep.endpointLabel.toLowerCase().includes(q) ||
        ep.serviceArea.toLowerCase().includes(q) ||
        ep.topIssueSummary.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || ep.status === statusFilter;
      return matchesQ && matchesStatus;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "endpointLabel") cmp = a.endpointLabel.localeCompare(b.endpointLabel);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else if (sortField === "requestsPerMin") cmp = a.requestsPerMin - b.requestsPerMin;
      else if (sortField === "errorRatePct") cmp = a.errorRatePct - b.errorRatePct;
      else cmp = a.avgLatencyMs - b.avgLatencyMs;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [apiEndpoints, search, statusFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

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

  const chartData = useMemo(
    () =>
      apiEndpoints.map((ep) => ({
        label: ep.serviceArea,
        avgLatency: ep.avgLatencyMs,
        p95Latency: ep.p95LatencyMs,
      })),
    [apiEndpoints]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Error Monitoring"
        badge={`${elevatedCount} Elevated`}
        demoLabel="Demo Endpoint Telemetry"
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
              onClick={() => {
                tickLiveDemoMetrics();
                toast.success("Refreshed API error and latency metrics.");
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Requests / Minute"
          value={totalRpm.toLocaleString()}
          sublabel="Combined API gateway throughput"
          icon={Activity}
          tone="teal"
        />
        <KpiCard
          label="Average Error Rate"
          value={avgErrorRate}
          sublabel="Across all monitored service areas"
          icon={AlertTriangle}
          tone={elevatedCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Average Response Time"
          value={`${avgLatency} ms`}
          sublabel="Typical request turnaround"
          icon={Clock}
          tone="blue"
        />
        <KpiCard
          label="Elevated Endpoints"
          value={elevatedCount}
          sublabel="Areas showing higher latency or retries"
          icon={AlertTriangle}
          tone={elevatedCount > 0 ? "amber" : "emerald"}
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
        <QueueBarChart
          data={chartData}
          primaryKey="avgLatency"
          primaryLabel="Avg Latency"
          secondaryKey="p95Latency"
          secondaryLabel="95th Percentile"
          unit=" ms"
          height={230}
        />
      </SurfaceCard>

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

        {paginated.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No matching endpoints"
            description="Adjust your search or status filter."
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
                  disabled={!canOpenIncident}
                  onClick={() => {
                    selectedIds.forEach((id) => createIncidentFromApiError(id));
                    toast.success(`Created incidents for ${selectedIds.length} endpoint(s).`);
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
                            aria-label={`Select ${ep.endpointLabel}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5">
                          <p className="font-semibold text-[var(--color-text-primary)]">{ep.endpointLabel}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">{ep.serviceArea}</p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={ep.status} tone={getStatusTone(ep.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-medium tabular-nums">
                          {ep.requestsPerMin} req/min
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-semibold tabular-nums">
                          {ep.errorRatePct}%
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)] tabular-nums">
                          {ep.avgLatencyMs} / {ep.p95LatencyMs} ms
                        </td>
                        <td className="py-3 px-3.5 text-[var(--color-text-secondary)] min-w-[200px]">
                          {ep.topIssueSummary}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <OpButton
                            variant="outline"
                            size="xs"
                            disabled={!canOpenIncident}
                            onClick={() => {
                              const inc = createIncidentFromApiError(ep.id);
                              if (inc) toast.success(`Opened incident ${inc.code} for ${ep.endpointLabel}.`);
                            }}
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
    </div>
  );
}
