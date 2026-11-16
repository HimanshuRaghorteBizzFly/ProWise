"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  Building2,
  CheckCircle2,
  Eye,
  KeyRound,
  LifeBuoy,
  RefreshCw,
} from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { OrgServiceHealth } from "../_types";
import { exportRowsToCsv, formatDateTime } from "../_services/operator-service";
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
  SlideOverDrawer,
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type OrgSortField = "status" | "orgName" | "uptimePct" | "avgResponseMs" | "webhookDeliveryPct";

export default function OrganizationServiceStatusPage() {
  const orgHealth = usePlatformOperatorStore((s) => s.orgHealth);
  const runOrgHealthProbe = usePlatformOperatorStore((s) => s.runOrgHealthProbe);
  const bulkRunOrgHealthProbes = usePlatformOperatorStore((s) => s.bulkRunOrgHealthProbes);
  const { can } = useOperatorPermissions();
  const canProbe = can("integrations.manage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [sortField, setSortField] = useState<OrgSortField>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selectedOrg, setSelectedOrg] = useState<OrgServiceHealth | null>(null);

  const operationalCount = useMemo(
    () => orgHealth.filter((o) => o.status === "Operational").length,
    [orgHealth]
  );
  const degradedCount = useMemo(
    () => orgHealth.filter((o) => o.status !== "Operational").length,
    [orgHealth]
  );
  const avgUptime = useMemo(() => {
    if (orgHealth.length === 0) return "100.00%";
    const avg = orgHealth.reduce((sum, o) => sum + o.uptimePct, 0) / orgHealth.length;
    return `${avg.toFixed(2)}%`;
  }, [orgHealth]);

  const regions = useMemo(
    () => Array.from(new Set(orgHealth.map((o) => o.region))),
    [orgHealth]
  );

  const handleSort = (field: OrgSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "uptimePct" || field === "webhookDeliveryPct" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = orgHealth.filter((org) => {
      const matchesQ =
        !q ||
        org.orgName.toLowerCase().includes(q) ||
        org.region.toLowerCase().includes(q) ||
        org.planName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || org.status === statusFilter;
      const matchesRegion = regionFilter === "ALL" || org.region === regionFilter;
      return matchesQ && matchesStatus && matchesRegion;
    });

    const rank: Record<string, number> = { Outage: 0, Degraded: 1, Elevated: 2, Operational: 3 };
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "orgName") cmp = a.orgName.localeCompare(b.orgName);
      else if (sortField === "uptimePct") cmp = a.uptimePct - b.uptimePct;
      else if (sortField === "avgResponseMs") cmp = a.avgResponseMs - b.avgResponseMs;
      else if (sortField === "webhookDeliveryPct") cmp = a.webhookDeliveryPct - b.webhookDeliveryPct;
      else cmp = (rank[a.status] ?? 9) - (rank[b.status] ?? 9);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [orgHealth, search, statusFilter, regionFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, regionFilter, pageSize]);

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
    filtered.map((o) => o.id),
    paginated.map((o) => o.id)
  );

  const handleProbe = (org: OrgServiceHealth) => {
    runOrgHealthProbe(org.id);
    toast.success(`Health probe completed for ${org.orgName} (simulated).`);
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-org-service-status-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Organization", "Region", "Plan", "Health Status", "30d Uptime %", "Avg Latency (ms)", "Webhook %", "Open Tickets"],
      filtered.map((o, i) => [
        i + 1,
        o.orgName,
        o.region,
        o.planName,
        o.status,
        o.uptimePct.toFixed(2),
        o.avgResponseMs,
        o.webhookDeliveryPct.toFixed(1),
        o.openTickets,
      ])
    );
    toast.success(`Exported ${filtered.length} organization health record(s).`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Service Status"
        badge={`${orgHealth.length} Workspaces`}
        demoLabel="Demo Data (Simulated Health)"
        description="Monitor tenant workspace availability, webhook delivery success, and run read-only diagnostics probes."
      />

      <DemoDataBanner
        title="Read-Only Tenant Isolation"
        description="Service health shows aggregated response and availability indicators without exposing private customer workspace data."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Operational Organizations"
          value={operationalCount}
          sublabel="Within normal response thresholds"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Elevated / Degraded"
          value={degradedCount}
          sublabel="Requires monitoring or follow-up"
          icon={Activity}
          tone={degradedCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Fleet 30-Day Availability"
          value={avgUptime}
          sublabel="Simulated rolling SLA average"
          icon={Building2}
          tone="teal"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search organization, plan, or region..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL" || regionFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            setRegionFilter("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={filtered.length === 0}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <OpSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by health status"
                  options={[
                    { label: "All Health States", value: "ALL" },
                    { label: "Operational", value: "Operational" },
                    { label: "Elevated", value: "Elevated" },
                    { label: "Degraded", value: "Degraded" },
                    { label: "Outage", value: "Outage" },
                  ]}
                />
              </div>
              <div className="w-36">
                <OpSelect
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  aria-label="Filter by region"
                  options={[
                    { label: "All Regions", value: "ALL" },
                    ...regions.map((r) => ({ label: r, value: r })),
                  ]}
                />
              </div>
            </div>
          }
        />

        {paginated.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No organizations match your filter"
            description="Reset the search or status filters to view all tenant service records."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((o) => o.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="primary"
                  size="xs"
                  disabled={!canProbe}
                  onClick={() => {
                    const count = bulkRunOrgHealthProbes(selectedIds);
                    toast.success(`Completed health probes for ${count} organization(s).`);
                    setSelectedIds([]);
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Run Probe ({selectedIds.length})
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
                        aria-label="Select all organizations on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16 whitespace-nowrap">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader
                        label="Organization"
                        active={sortField === "orgName"}
                        direction={sortDir}
                        onSort={() => handleSort("orgName")}
                      />
                    </th>
                    <th className="py-2.5 px-3.5">Region & Plan</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader
                        label="Service Health"
                        active={sortField === "status"}
                        direction={sortDir}
                        onSort={() => handleSort("status")}
                      />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader
                        label="30d Uptime"
                        active={sortField === "uptimePct"}
                        direction={sortDir}
                        onSort={() => handleSort("uptimePct")}
                      />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader
                        label="Avg Latency"
                        active={sortField === "avgResponseMs"}
                        direction={sortDir}
                        onSort={() => handleSort("avgResponseMs")}
                      />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader
                        label="Webhook Rate"
                        active={sortField === "webhookDeliveryPct"}
                        direction={sortDir}
                        onSort={() => handleSort("webhookDeliveryPct")}
                      />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((org, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(org.id);
                    return (
                      <tr
                        key={org.id}
                        className={`hover:bg-[var(--color-hover)]/50 transition-colors ${
                          isSelected ? "bg-teal-500/5" : ""
                        }`}
                      >
                        <td className="py-3 px-3.5 w-10">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(org.id)}
                            aria-label={`Select ${org.orgName}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-[10px] font-bold text-teal-700 dark:text-teal-300 shrink-0">
                              {getOrgInitials(org.orgName)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[var(--color-text-primary)]">{org.orgName}</p>
                              {org.lastIncidentSummary && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5 line-clamp-1">
                                  {org.lastIncidentSummary}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <p className="text-[var(--color-text-primary)]">{org.region}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">{org.planName}</p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={org.status} tone={getStatusTone(org.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-semibold text-[var(--color-text-primary)] tabular-nums">
                          {org.uptimePct.toFixed(2)}%
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)] tabular-nums">
                          {org.avgResponseMs} ms
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)] tabular-nums">
                          {org.webhookDeliveryPct.toFixed(1)}%
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <OpButton variant="outline" size="xs" onClick={() => setSelectedOrg(org)}>
                              <Eye className="w-3.5 h-3.5" />
                              Inspect
                            </OpButton>
                            <OpButton
                              variant="subtle"
                              size="xs"
                              disabled={!canProbe}
                              onClick={() => handleProbe(org)}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Check
                            </OpButton>
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
      </SurfaceCard>

      <SlideOverDrawer
        isOpen={Boolean(selectedOrg)}
        onClose={() => setSelectedOrg(null)}
        title={selectedOrg?.orgName || "Workspace Health"}
        subtitle={selectedOrg ? `${selectedOrg.region} · ${selectedOrg.planName}` : undefined}
      >
        {selectedOrg && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge label={selectedOrg.status} tone={getStatusTone(selectedOrg.status)} dot />
              <span className="text-xs text-[var(--color-text-muted)]">
                Checked {formatDateTime(selectedOrg.lastCheckedAt)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">30-Day Uptime</span>
                <strong className="text-base text-[var(--color-text-primary)]">
                  {selectedOrg.uptimePct.toFixed(2)}%
                </strong>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">Average Response</span>
                <strong className="text-base text-[var(--color-text-primary)]">
                  {selectedOrg.avgResponseMs} ms
                </strong>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">Webhook Delivery Rate</span>
                <strong className="text-base text-[var(--color-text-primary)]">
                  {selectedOrg.webhookDeliveryPct.toFixed(1)}%
                </strong>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">Open Support Tickets</span>
                <strong className="text-base text-[var(--color-text-primary)]">
                  {selectedOrg.openTickets}
                </strong>
              </div>
            </div>

            {selectedOrg.lastIncidentSummary && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
                <p className="font-semibold mb-1">Active Operational Note</p>
                <p>{selectedOrg.lastIncidentSummary}</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-border)]">
              <OpButton
                variant="primary"
                size="sm"
                disabled={!canProbe}
                onClick={() => {
                  handleProbe(selectedOrg);
                  setSelectedOrg(null);
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Run Health Probe
              </OpButton>
              <Link href="/platform-operator/support-tickets">
                <OpButton variant="outline" size="sm">
                  <LifeBuoy className="w-3.5 h-3.5" />
                  Support Tickets
                </OpButton>
              </Link>
              <Link href="/platform-operator/access-requests">
                <OpButton variant="outline" size="sm">
                  <KeyRound className="w-3.5 h-3.5" />
                  Request Diagnostics Access
                </OpButton>
              </Link>
            </div>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}
