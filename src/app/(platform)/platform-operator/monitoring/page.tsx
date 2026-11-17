"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { formatDateTime } from "../_services/operator-service";
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

type MonitorSortField = "serviceName" | "cpuPct" | "memoryPct" | "latencyMs" | "queueDepth" | "status";

export default function SystemMonitoringPage() {
  const systemMetrics = usePlatformOperatorStore((s) => s.systemMetrics);
  const lastTelemetryTickAt = usePlatformOperatorStore((s) => s.lastTelemetryTickAt);
  const tickLiveDemoMetrics = usePlatformOperatorStore((s) => s.tickLiveDemoMetrics);
  const createIncidentFromService = usePlatformOperatorStore((s) => s.createIncidentFromService);
  const { can } = useOperatorPermissions();
  const canOpenIncident = can("incidents.manage");

  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sortField, setSortField] = useState<MonitorSortField>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      tickLiveDemoMetrics();
    }, 10000);
    return () => clearInterval(id);
  }, [autoRefresh, tickLiveDemoMetrics]);

  const avgCpu = useMemo(() => {
    if (systemMetrics.length === 0) return 0;
    return Math.round(systemMetrics.reduce((s, m) => s + m.cpuPct, 0) / systemMetrics.length);
  }, [systemMetrics]);

  const avgMemory = useMemo(() => {
    if (systemMetrics.length === 0) return 0;
    return Math.round(systemMetrics.reduce((s, m) => s + m.memoryPct, 0) / systemMetrics.length);
  }, [systemMetrics]);

  const dbPool = useMemo(() => {
    const db = systemMetrics.find((m) => m.dbConnectionsPct !== undefined);
    return db?.dbConnectionsPct || 52;
  }, [systemMetrics]);

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
      else if (sortField === "cpuPct") cmp = a.cpuPct - b.cpuPct;
      else if (sortField === "memoryPct") cmp = a.memoryPct - b.memoryPct;
      else if (sortField === "latencyMs") cmp = a.latencyMs - b.latencyMs;
      else if (sortField === "queueDepth") cmp = a.queueDepth - b.queueDepth;
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

  const chartData = useMemo(
    () =>
      systemMetrics.map((m) => ({
        label: m.serviceName.split(" ")[0],
        cpu: m.cpuPct,
        memory: m.memoryPct,
      })),
    [systemMetrics]
  );

  const handleOpenIncident = (svcId: string) => {
    const inc = createIncidentFromService(svcId);
    if (inc) toast.success(`Opened incident ${inc.code} for ${inc.affectedService}.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Monitoring"
        badge={autoRefresh ? "Auto-Refresh 10s" : `${systemMetrics.length} Core Services`}
        demoLabel="Demo Data (Simulated)"
        description="Track compute load, memory usage, database capacity, queue depth, and open incidents directly from degraded services."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OpButton variant="outline" size="sm" onClick={() => setAutoRefresh((v) => !v)}>
              <Activity className="w-3.5 h-3.5" />
              {autoRefresh ? "Pause Stream" : "Resume Stream"}
            </OpButton>
            <OpButton
              variant="primary"
              size="sm"
              onClick={() => {
                tickLiveDemoMetrics();
                toast.success("Refreshed simulated infrastructure telemetry.");
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Telemetry
            </OpButton>
          </div>
        }
      />

      <DemoDataBanner
        title="Simulated Infrastructure Metrics"
        description={`Values reflect live simulated telemetry (updated ${formatDateTime(
          lastTelemetryTickAt
        )}). Connect Spring Boot Actuator or cloud telemetry to monitor production clusters.`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Average Cluster CPU"
          value={`${avgCpu}%`}
          sublabel="Across API, database & workers"
          icon={Cpu}
          tone={avgCpu > 75 ? "amber" : "teal"}
        />
        <KpiCard
          label="Average Memory Usage"
          value={`${avgMemory}%`}
          sublabel="Within healthy operating limits"
          icon={HardDrive}
          tone="blue"
        />
        <KpiCard
          label="Database Connection Pool"
          value={`${dbPool}%`}
          sublabel="Primary & read-replica capacity"
          icon={Database}
          tone="emerald"
        />
        <KpiCard
          label="Elevated Services"
          value={elevatedCount}
          sublabel="Services under higher than normal load"
          icon={Server}
          tone={elevatedCount > 0 ? "amber" : "emerald"}
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            CPU vs. Memory Utilization by Service (Demo Data)
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Compares active compute load and allocated memory percentages across core components.
          </p>
        </div>
        <QueueBarChart
          data={chartData}
          primaryKey="cpu"
          primaryLabel="CPU %"
          secondaryKey="memory"
          secondaryLabel="Memory %"
          unit="%"
          height={230}
        />
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

        {paginated.length === 0 ? (
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
                  <OpButton
                    variant="subtle"
                    size="xs"
                    disabled={!canOpenIncident}
                    onClick={() => {
                      selectedIds.forEach((id) => createIncidentFromService(id));
                      toast.success(`Opened incidents for ${selectedIds.length} selected service(s).`);
                      setSelectedIds([]);
                    }}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Open Incident ({selectedIds.length})
                  </OpButton>
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
                          <strong className="text-[var(--color-text-primary)]">{svc.cpuPct}%</strong>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              svc.cpuPct > 80 ? "bg-rose-500" : svc.cpuPct > 65 ? "bg-amber-500" : "bg-teal-500"
                            }`}
                            style={{ width: `${svc.cpuPct}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="text-[var(--color-text-secondary)]">Memory Usage</span>
                          <strong className="text-[var(--color-text-primary)]">{svc.memoryPct}%</strong>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${svc.memoryPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--color-border)] text-[11px]">
                      <div>
                        <span className="text-[var(--color-text-muted)] block">Response</span>
                        <strong className="text-[var(--color-text-primary)]">{svc.latencyMs} ms</strong>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-muted)] block">Queue</span>
                        <strong className="text-[var(--color-text-primary)]">{svc.queueDepth} jobs</strong>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-muted)] block">30d Uptime</span>
                        <strong className="text-emerald-600 dark:text-emerald-400">{svc.uptime30d}</strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <p className="text-[11px] text-[var(--color-text-secondary)] line-clamp-2 flex-1">
                        {svc.note}
                      </p>
                      <OpButton
                        variant="outline"
                        size="xs"
                        disabled={!canOpenIncident}
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
                <OpButton
                  variant="subtle"
                  size="xs"
                  disabled={!canOpenIncident}
                  onClick={() => {
                    selectedIds.forEach((id) => createIncidentFromService(id));
                    toast.success(`Opened incidents for ${selectedIds.length} selected service(s).`);
                    setSelectedIds([]);
                  }}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Open Incident ({selectedIds.length})
                </OpButton>
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
                        <td className="py-3 px-3.5 tabular-nums font-medium">{svc.cpuPct}%</td>
                        <td className="py-3 px-3.5 tabular-nums font-medium">{svc.memoryPct}%</td>
                        <td className="py-3 px-3.5 tabular-nums">{svc.latencyMs} ms</td>
                        <td className="py-3 px-3.5 tabular-nums">{svc.queueDepth}</td>
                        <td className="py-3 px-3.5">
                          <StatusBadge label={svc.status} tone={getStatusTone(svc.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 text-right">
                          <OpButton
                            variant="outline"
                            size="xs"
                            disabled={!canOpenIncident}
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
