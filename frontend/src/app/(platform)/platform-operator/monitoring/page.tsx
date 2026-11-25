"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Cpu,
  Database,
  HardDrive,
  LayoutGrid,
  List,
  RefreshCw,
  Server,
} from "lucide-react";
import type { OpsDashboardStats, OpsIntegration } from "@/types/admin-operations";
import { useOperatorPermissions } from "../_services/operator-access";
import { operatorApi } from "../_services/operator-api";
import { formatDateTime } from "../_services/operator-service";
import {
  MutationNotice,
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  humanizeCode,
  rowsOf,
  useOperatorMutation,
  useOperatorResource,
  type ResourceState,
} from "../_components/OperatorLive";
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

type MonitorSortField = "serviceName" | "cpuPct" | "memoryPct" | "latencyMs" | "queueDepth" | "status";

/**
 * One monitored service. The only per-service records the server has are integration installations
 * (GET /v1/operator/integrations: name, type, status, health, error count, last sync). CPU, memory, latency, queue
 * depth and uptime have no endpoint, so they are null and shown as "Not available yet".
 */
interface ServiceRow {
  id: string;
  serviceName: string;
  category: "API & Compute" | "Database & Cache" | "Background Workers" | "Integrations";
  status: "Operational" | "Elevated" | "Degraded";
  cpuPct: number | null;
  memoryPct: number | null;
  latencyMs: number | null;
  queueDepth: number | null;
  uptime30d: string | null;
  note: string;
}

function healthToStatus(health: string | null | undefined): ServiceRow["status"] {
  const h = (health ?? "").toUpperCase();
  if (h === "HEALTHY" || h === "OPERATIONAL") return "Operational";
  if (h === "DEGRADED" || h === "DOWN" || h === "OUTAGE" || h === "FAILED") return "Degraded";
  return "Elevated";
}

function toServiceRow(i: OpsIntegration): ServiceRow {
  const parts = [
    `${humanizeCode(i.type)} · ${humanizeCode(i.status)}`,
    `${i.error_count} error(s)`,
    i.last_synced_at ? `last sync ${formatDateTime(i.last_synced_at)}` : "never synced",
  ];
  return {
    id: i.id,
    serviceName: i.name,
    category: "Integrations",
    status: healthToStatus(i.health),
    cpuPct: null,
    memoryPct: null,
    latencyMs: null,
    queueDepth: null,
    uptime30d: null,
    note: parts.join(" · "),
  };
}

const NA_TELEMETRY = "no infrastructure telemetry endpoint";

function MetricValue({ value, suffix = "" }: { value: number | string | null; suffix?: string }) {
  if (value === null) return <NotAvailableText reason={NA_TELEMETRY} />;
  return (
    <>
      {value}
      {suffix}
    </>
  );
}

/** Real operational counters from GET /v1/operator/dashboard/stats (the server's health-score string is never shown). */
function LiveCounters({ state, onRetry }: { state: ResourceState<OpsDashboardStats>; onRetry: () => void }) {
  if (state.status !== "ready") {
    return (
      <OperatorResourceStatus
        state={state}
        isEmpty={() => false}
        onRetry={onRetry}
        emptyTitle=""
        emptyDescription=""
        rows={1}
      />
    );
  }
  const items: { label: string; value: number | undefined }[] = [
    { label: "Open incidents", value: state.data.openIncidents },
    { label: "Open tickets", value: state.data.openTickets },
    { label: "Webhooks retrying", value: state.data.pendingWebhooks },
    { label: "Failed jobs", value: state.data.failedJobs },
    { label: "Unacknowledged alerts", value: state.data.unacknowledgedAlerts },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
          <span className="block text-[11px] text-[var(--color-text-muted)]">{item.label}</span>
          <strong className="text-lg tabular-nums text-[var(--color-text-primary)]">
            {typeof item.value === "number" ? item.value : <NotAvailableText />}
          </strong>
        </div>
      ))}
    </div>
  );
}

export default function SystemMonitoringPage() {
  const integrations = useOperatorResource(() => operatorApi.integrations(), "integrations");
  const stats = useOperatorResource(() => operatorApi.dashboardStats(), "dashboard-stats");
  const systemMetrics = useMemo(() => rowsOf(integrations.state).map(toServiceRow), [integrations.state]);
  const [lastLoadedAt, setLastLoadedAt] = useState<string>("");
  useEffect(() => {
    if (integrations.state.status === "ready") setLastLoadedAt(new Date().toISOString());
  }, [integrations.state]);
  const refreshAll = () => {
    void integrations.reload();
    void stats.reload();
  };
  const { can } = useOperatorPermissions();
  const canOpenIncident = can("incidents.manage");
  const { busy, notice, clearNotice, run } = useOperatorMutation(refreshAll);

  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");
  /* No live telemetry stream exists, so there is nothing to auto-refresh; the toggle stays visible but disabled. */
  const autoRefresh = false;
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortField, setSortField] = useState<MonitorSortField>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const elevatedCount = useMemo(
    () => systemMetrics.filter((m) => m.status !== "Operational").length,
    [systemMetrics]
  );

  const handleSort = (field: MonitorSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "serviceName" ? "asc" : "desc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = systemMetrics.filter((m) => {
      const matchesCat = categoryFilter === "ALL" || m.category === categoryFilter;
      const matchesQ =
        !q ||
        m.serviceName.toLowerCase().includes(q) ||
        m.category.toLowerCase().includes(q) ||
        m.note.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });

    const rank: Record<string, number> = { Degraded: 0, Elevated: 1, Operational: 2 };
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "serviceName") cmp = a.serviceName.localeCompare(b.serviceName);
      else if (sortField === "cpuPct") cmp = (a.cpuPct ?? -1) - (b.cpuPct ?? -1);
      else if (sortField === "memoryPct") cmp = (a.memoryPct ?? -1) - (b.memoryPct ?? -1);
      else if (sortField === "latencyMs") cmp = (a.latencyMs ?? -1) - (b.latencyMs ?? -1);
      else if (sortField === "queueDepth") cmp = (a.queueDepth ?? -1) - (b.queueDepth ?? -1);
      else cmp = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [systemMetrics, categoryFilter, search, sortField, sortDir]);

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
    filtered.map((s) => s.id),
    paginated.map((s) => s.id)
  );

  /** Real create: POST /v1/operator/incidents for the service, then reload. Severity follows the service health. */
  const handleOpenIncident = (svcId: string) => {
    const svc = systemMetrics.find((m) => m.id === svcId);
    if (!svc) return;
    const severity = svc.status === "Degraded" ? "SEV_2" : svc.status === "Elevated" ? "SEV_3" : "SEV_4";
    void run(
      `incident:${svcId}`,
      () =>
        operatorApi.incidents.create({
          title: `${svc.serviceName}: ${svc.status}`,
          severity,
          description: `Opened from System Monitoring. ${svc.note}`,
        }),
      `Opened an incident for ${svc.serviceName}.`,
    );
  };

  const servicesReady = integrations.state.status === "ready";

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Monitoring"
        badge={autoRefresh ? "Auto-Refresh 10s" : servicesReady ? `${systemMetrics.length} Core Services` : undefined}
        liveData
        description="Track compute load, memory usage, database capacity, queue depth, and open incidents directly from degraded services."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <NotAvailableButton variant="outline" size="sm" reason="there is no live telemetry stream">
              <Activity className="w-3.5 h-3.5" />
              {autoRefresh ? "Pause Stream" : "Resume Stream"}
            </NotAvailableButton>
            <OpButton variant="primary" size="sm" onClick={refreshAll}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Telemetry
            </OpButton>
          </div>
        }
      />

      <DemoDataBanner
        title="Simulated Infrastructure Metrics"
        description={`Values reflect live simulated telemetry (updated ${formatDateTime(
          lastLoadedAt
        )}). Connect Spring Boot Actuator or cloud telemetry to monitor production clusters.`}
      />

      <MutationNotice notice={notice} onReload={refreshAll} onDismiss={clearNotice} />

      <SurfaceCard className="p-4 sm:p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Live Operational Counters</h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Counts read from the server{lastLoadedAt ? ` (loaded ${formatDateTime(lastLoadedAt)})` : ""}.
          </p>
        </div>
        <LiveCounters state={stats.state} onRetry={stats.reload} />
      </SurfaceCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Average Cluster CPU"
          value="—"
          sublabel="Not available yet"
          icon={Cpu}
          tone="slate"
        />
        <KpiCard
          label="Average Memory Usage"
          value="—"
          sublabel="Not available yet"
          icon={HardDrive}
          tone="slate"
        />
        <KpiCard
          label="Database Connection Pool"
          value="—"
          sublabel="Not available yet"
          icon={Database}
          tone="slate"
        />
        <KpiCard
          label="Elevated Services"
          value={servicesReady ? elevatedCount : "-"}
          sublabel="Integrations not reporting healthy"
          icon={Server}
          tone={elevatedCount > 0 ? "amber" : "emerald"}
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            CPU vs. Memory Utilization by Service
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Compares active compute load and allocated memory percentages across core components.
          </p>
        </div>
        <div className="flex h-[230px] items-center justify-center rounded-lg border border-dashed border-[var(--color-border)]">
          <NotAvailableText reason={NA_TELEMETRY} className="text-sm" />
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search service name, category, or note..."
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
                aria-label="Filter service category"
                options={[
                  { label: "All Service Groups", value: "ALL" },
                  { label: "API & Compute", value: "API & Compute" },
                  { label: "Database & Cache", value: "Database & Cache" },
                  { label: "Background Workers", value: "Background Workers" },
                  { label: "Integrations", value: "Integrations" },
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

        {!servicesReady || systemMetrics.length === 0 ? (
          <OperatorResourceStatus
            state={integrations.state}
            isEmpty={(d) => d.length === 0}
            onRetry={integrations.reload}
            emptyIcon={Server}
            emptyTitle="No monitored services"
            emptyDescription="The server has no integration installations to report health for."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={Server}
            title="No services match your filter"
            description="Adjust search or category filter to inspect service telemetry."
          />
        ) : viewMode === "CARDS" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)]/40 overflow-hidden">
              <div className="px-4 py-2 flex items-center justify-between gap-2 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected;
                    }}
                    onChange={toggleSelectPage}
                    aria-label="Select all services on this page"
                    className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                  />
                  <span>Select all on page ({paginated.length})</span>
                </label>
              </div>
              <BulkSelectionBar
                selectedCount={selectedIds.length}
                totalFilteredCount={filtered.length}
                onSelectAllMatching={() => setSelectedIds(filtered.map((s) => s.id))}
                onClear={() => setSelectedIds([])}
                actions={
                  <NotAvailableButton variant="subtle" size="xs" hideLabel reason="no bulk incident endpoint">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Open Incident ({selectedIds.length})
                  </NotAvailableButton>
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginated.map((svc, idx) => {
                const srNo = (safePage - 1) * pageSize + idx + 1;
                const isSelected = selectedSet.has(svc.id);
                return (
                  <div
                    key={svc.id}
                    className={`rounded-xl border bg-[var(--color-app-bg)] p-4 space-y-3 transition-colors ${
                      isSelected ? "border-teal-500 ring-1 ring-teal-500" : "border-[var(--color-border)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(svc.id)}
                          aria-label={`Select ${svc.serviceName}`}
                          className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-surface)] accent-teal-600 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
                              #{srNo}
                            </span>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                              {svc.serviceName}
                            </p>
                          </div>
                          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{svc.category}</p>
                        </div>
                      </div>
                      <StatusBadge label={svc.status} tone={getStatusTone(svc.status)} dot />
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[var(--color-text-secondary)]">CPU Usage</span>
                          <strong className="text-[var(--color-text-primary)]"><MetricValue value={svc.cpuPct} suffix="%" /></strong>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              (svc.cpuPct ?? 0) > 80 ? "bg-rose-500" : (svc.cpuPct ?? 0) > 65 ? "bg-amber-500" : "bg-teal-500"
                            }`}
                            style={{ width: `${svc.cpuPct ?? 0}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[var(--color-text-secondary)]">Memory Usage</span>
                          <strong className="text-[var(--color-text-primary)]"><MetricValue value={svc.memoryPct} suffix="%" /></strong>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${svc.memoryPct ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border)] text-[11px]">
                      <div>
                        <span className="text-[var(--color-text-muted)] block">Response</span>
                        <strong className="text-[var(--color-text-primary)]"><MetricValue value={svc.latencyMs} suffix=" ms" /></strong>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-muted)] block">Queue</span>
                        <strong className="text-[var(--color-text-primary)]"><MetricValue value={svc.queueDepth} suffix=" jobs" /></strong>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-muted)] block">30d Uptime</span>
                        <strong className="text-emerald-600 dark:text-emerald-400"><MetricValue value={svc.uptime30d} /></strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 flex-1">
                        {svc.note}
                      </p>
                      <OpButton
                        variant="outline"
                        size="xs"
                        disabled={!canOpenIncident || busy !== null}
                        isLoading={busy === `incident:${svc.id}`}
                        onClick={() => handleOpenIncident(svc.id)}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Open Incident
                      </OpButton>
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
              onSelectAllMatching={() => setSelectedIds(filtered.map((s) => s.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <NotAvailableButton variant="subtle" size="xs" hideLabel reason="no bulk incident endpoint">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Open Incident ({selectedIds.length})
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
                        aria-label="Select all services on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Service" active={sortField === "serviceName"} direction={sortDir} onSort={() => handleSort("serviceName")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="CPU" active={sortField === "cpuPct"} direction={sortDir} onSort={() => handleSort("cpuPct")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Memory" active={sortField === "memoryPct"} direction={sortDir} onSort={() => handleSort("memoryPct")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Latency" active={sortField === "latencyMs"} direction={sortDir} onSort={() => handleSort("latencyMs")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Queue" active={sortField === "queueDepth"} direction={sortDir} onSort={() => handleSort("queueDepth")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((svc, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(svc.id);
                    return (
                      <tr key={svc.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(svc.id)}
                            aria-label={`Select ${svc.serviceName}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5">
                          <p className="font-semibold text-[var(--color-text-primary)]">{svc.serviceName}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">{svc.category}</p>
                        </td>
                        <td className="py-3 px-3.5 tabular-nums font-medium"><MetricValue value={svc.cpuPct} suffix="%" /></td>
                        <td className="py-3 px-3.5 tabular-nums font-medium"><MetricValue value={svc.memoryPct} suffix="%" /></td>
                        <td className="py-3 px-3.5 tabular-nums"><MetricValue value={svc.latencyMs} suffix=" ms" /></td>
                        <td className="py-3 px-3.5 tabular-nums"><MetricValue value={svc.queueDepth} /></td>
                        <td className="py-3 px-3.5">
                          <StatusBadge label={svc.status} tone={getStatusTone(svc.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <OpButton
                            variant="outline"
                            size="xs"
                            disabled={!canOpenIncident || busy !== null}
                            isLoading={busy === `incident:${svc.id}`}
                            onClick={() => handleOpenIncident(svc.id)}
                          >
                            <AlertTriangle className="w-3 h-3" />
                            Open Incident
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
