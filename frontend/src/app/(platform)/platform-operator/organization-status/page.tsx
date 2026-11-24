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
import { useDebounced } from "@/components/super-admin/admin-resource";
import type { OperatorOrganizationItem } from "@/types/operator-console";
import { operatorApi } from "../_services/operator-api";
import { exportRowsToCsv, formatDateTime, formatShortDate } from "../_services/operator-service";
import {
  LoadError,
  LoadingRows,
  NOT_AVAILABLE,
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  humanizeCode,
  pageItemsOf,
  pageTotalOf,
  toServerPaging,
  useOperatorDetail,
  useOperatorResource,
} from "../_components/OperatorLive";
import {
  BulkSelectionBar,
  DemoDataBanner,
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

const HEALTH_REASON = "workspace availability, latency and webhook rates are not measured per organization yet";
const PROBE_REASON = "there is no health probe endpoint";
const REGION_REASON = "organizations have no region on the server";

/** Server lifecycle state shown as a badge tone (ACTIVE fine, SUSPENDED warning, ARCHIVED neutral). */
function stateTone(state: string) {
  const s = state.toUpperCase();
  if (s === "ACTIVE") return getStatusTone("Operational");
  if (s === "SUSPENDED") return getStatusTone("Degraded");
  return "neutral" as const;
}

/**
 * Read-only organization status from GET /v1/operator/organizations (operations.org_status:view): lifecycle state,
 * owner, plan and subscription, member and project counts. Suspension is a Super Admin action and health probes have
 * no endpoint, so those controls stay visible but disabled.
 */
export default function OrganizationServiceStatusPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [sortField, setSortField] = useState<OrgSortField>("status");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const debouncedSearch = useDebounced(search);
  const paging = toServerPaging(page, pageSize);
  const { state, reload } = useOperatorResource(
    () => operatorApi.organizations.list({ search: debouncedSearch, state: stateFilter, ...paging }),
    `organizations:${debouncedSearch}:${stateFilter}:${paging.page}:${paging.size}`,
  );
  const stats = useOperatorResource(() => operatorApi.dashboardStats(), "dashboard-stats");
  const detail = useOperatorDetail((orgId: string) => operatorApi.organizations.get(orgId));

  const isReady = state.status === "ready";
  const orgs = useMemo(() => pageItemsOf(state), [state]);
  const total = pageTotalOf(state);
  const byState = stats.state.status === "ready" ? stats.state.data.organizationsByState ?? null : null;
  const selectedOrg = useMemo(() => orgs.find((o) => o.id === detail.openId) ?? null, [orgs, detail.openId]);

  const handleSort = (field: OrgSortField) => {
    if (field !== "orgName" && field !== "status") return;
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sorted = useMemo(() => {
    const rank: Record<string, number> = { SUSPENDED: 0, ACTIVE: 1, ARCHIVED: 2 };
    return [...orgs].sort((a, b) => {
      const cmp =
        sortField === "orgName"
          ? a.name.localeCompare(b.name)
          : (rank[a.state.toUpperCase()] ?? 9) - (rank[b.state.toUpperCase()] ?? 9);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [orgs, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, stateFilter, pageSize]);

  const {
    selectedIds,
    setSelectedIds,
    allPageSelected,
    somePageSelected,
    selectedSet,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    sorted.map((o) => o.id),
    sorted.map((o) => o.id)
  );

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-org-service-status-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Organization", "Slug", "State", "Plan", "Subscription", "Owner", "Members", "Projects", "Created"],
      sorted.map((o: OperatorOrganizationItem, i) => [
        i + 1,
        o.name,
        o.slug,
        o.state,
        o.plan_name ?? "—",
        o.subscription_status ?? "—",
        o.owner_email ?? "—",
        o.member_count,
        o.project_count,
        o.created_at ?? "",
      ])
    );
    toast.success(`Exported ${sorted.length} organization status record(s).`);
  };

  const detailData = detail.state?.status === "ready" ? detail.state.data : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organization Service Status"
        badge={isReady ? `${total} Workspaces` : undefined}
        liveData
        description="Monitor tenant workspace availability, webhook delivery success, and run read-only diagnostics probes."
      />

      <DemoDataBanner
        title="Read-Only Tenant Isolation"
        description="Service health shows aggregated response and availability indicators without exposing private customer workspace data."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Operational Organizations"
          value={byState ? byState.ACTIVE ?? 0 : "-"}
          sublabel={byState ? `Active workspaces · ${byState.SUSPENDED ?? 0} suspended · ${byState.ARCHIVED ?? 0} archived` : "Active workspaces"}
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Elevated / Degraded"
          value="—"
          sublabel={`${NOT_AVAILABLE}: service health is not measured per organization`}
          icon={Activity}
          tone="slate"
        />
        <KpiCard
          label="Fleet 30-Day Availability"
          value="—"
          sublabel={`${NOT_AVAILABLE}: availability is not measured yet`}
          icon={Building2}
          tone="slate"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search organization, plan, or region..."
          hasActiveFilters={Boolean(search || stateFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            setStateFilter("ALL");
            setRegionFilter("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={sorted.length === 0}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <OpSelect
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                  aria-label="Filter by organization state"
                  options={[
                    { label: "All States", value: "ALL" },
                    { label: "Active", value: "ACTIVE" },
                    { label: "Suspended", value: "SUSPENDED" },
                    { label: "Archived", value: "ARCHIVED" },
                  ]}
                />
              </div>
              <div className="w-40" title={`${NOT_AVAILABLE}: ${HEALTH_REASON}`} data-not-available="true">
                <OpSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by health status"
                  disabled
                  title={`${NOT_AVAILABLE}: ${HEALTH_REASON}`}
                  options={[
                    { label: "All Health States", value: "ALL" },
                    { label: "Operational", value: "Operational" },
                    { label: "Elevated", value: "Elevated" },
                    { label: "Degraded", value: "Degraded" },
                    { label: "Outage", value: "Outage" },
                  ]}
                />
                <span className="text-[10px] leading-none text-[var(--color-text-muted)]">{NOT_AVAILABLE}</span>
              </div>
              <div className="w-36" title={`${NOT_AVAILABLE}: ${REGION_REASON}`} data-not-available="true">
                <OpSelect
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  aria-label="Filter by region"
                  disabled
                  title={`${NOT_AVAILABLE}: ${REGION_REASON}`}
                  options={[{ label: "All Regions", value: "ALL" }]}
                />
                <span className="text-[10px] leading-none text-[var(--color-text-muted)]">{NOT_AVAILABLE}</span>
              </div>
            </div>
          }
        />

        {state.status !== "ready" || sorted.length === 0 ? (
          <OperatorResourceStatus
            state={state.status === "ready" ? { status: "ready", data: sorted } : state}
            isEmpty={(data) => data.length === 0}
            onRetry={() => void reload()}
            emptyIcon={Building2}
            emptyTitle="No organizations match your filter"
            emptyDescription="Reset the search or state filters to view all tenant service records."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={sorted.length}
              onSelectAllMatching={() => setSelectedIds(sorted.map((o) => o.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <NotAvailableButton variant="primary" size="xs" reason={PROBE_REASON}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Run Probe ({selectedIds.length})
                </NotAvailableButton>
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
                    <th className="py-2.5 px-3.5" title={`${NOT_AVAILABLE}: ${HEALTH_REASON}`}>
                      <SortableHeader label="30d Uptime" active={false} direction={sortDir} onSort={() => handleSort("uptimePct")} />
                    </th>
                    <th className="py-2.5 px-3.5" title={`${NOT_AVAILABLE}: ${HEALTH_REASON}`}>
                      <SortableHeader label="Avg Latency" active={false} direction={sortDir} onSort={() => handleSort("avgResponseMs")} />
                    </th>
                    <th className="py-2.5 px-3.5" title={`${NOT_AVAILABLE}: ${HEALTH_REASON}`}>
                      <SortableHeader
                        label="Webhook Rate"
                        active={false}
                        direction={sortDir}
                        onSort={() => handleSort("webhookDeliveryPct")}
                      />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {sorted.map((org, idx) => {
                    const srNo = (page - 1) * pageSize + idx + 1;
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
                            aria-label={`Select ${org.name}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-[10px] font-bold text-teal-700 dark:text-teal-300 shrink-0">
                              {getOrgInitials(org.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[var(--color-text-primary)]">{org.name}</p>
                              <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 line-clamp-1">
                                {org.slug} · {org.member_count} member{org.member_count === 1 ? "" : "s"} · {org.project_count} project
                                {org.project_count === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <p className="text-[var(--color-text-primary)]">
                            <NotAvailableText reason={REGION_REASON} />
                          </p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {org.plan_name ?? "No plan"}
                            {org.subscription_status ? ` · ${humanizeCode(org.subscription_status)}` : ""}
                          </p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={humanizeCode(org.state)} tone={stateTone(org.state)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <NotAvailableText reason={HEALTH_REASON} />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <NotAvailableText reason={HEALTH_REASON} />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <NotAvailableText reason={HEALTH_REASON} />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-start gap-1.5">
                            <OpButton variant="outline" size="xs" onClick={() => detail.open(org.id)}>
                              <Eye className="w-3.5 h-3.5" />
                              Inspect
                            </OpButton>
                            <NotAvailableButton variant="subtle" size="xs" reason={PROBE_REASON}>
                              <RefreshCw className="w-3.5 h-3.5" />
                              Check
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

      <SlideOverDrawer
        isOpen={Boolean(detail.openId)}
        onClose={detail.close}
        title={detailData?.name || selectedOrg?.name || "Workspace Health"}
        subtitle={
          detailData
            ? `${detailData.slug} · ${detailData.subscriptions[0]?.plan_name ?? "No plan"}`
            : selectedOrg
              ? `${selectedOrg.slug} · ${selectedOrg.plan_name ?? "No plan"}`
              : undefined
        }
      >
        {detail.state?.status === "loading" && <LoadingRows rows={5} />}
        {detail.state?.status === "error" && <LoadError message={detail.state.message} onRetry={detail.retry} />}
        {detailData && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge label={humanizeCode(detailData.state)} tone={stateTone(detailData.state)} dot />
              <span className="text-xs text-[var(--color-text-muted)]">
                Updated {formatDateTime(detailData.updated_at ?? "")}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">30-Day Uptime</span>
                <NotAvailableText reason={HEALTH_REASON} />
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">Average Response</span>
                <NotAvailableText reason={HEALTH_REASON} />
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">Webhook Delivery Rate</span>
                <NotAvailableText reason={HEALTH_REASON} />
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">Open Support Tickets</span>
                <NotAvailableText reason="support tickets are not linked to an organization yet" />
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">Members</span>
                <strong className="text-base text-[var(--color-text-primary)]">{detailData.member_count}</strong>
                <span className="block text-[10px] text-[var(--color-text-muted)]">
                  {detailData.disabled_member_count} disabled
                </span>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">Projects</span>
                <strong className="text-base text-[var(--color-text-primary)]">{detailData.project_count}</strong>
                <span className="block text-[10px] text-[var(--color-text-muted)]">
                  {Object.entries(detailData.projects_by_lifecycle ?? {})
                    .map(([k, v]) => `${humanizeCode(k)} ${v}`)
                    .join(" · ") || "No projects"}
                </span>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">Failed Payments</span>
                <strong className="text-base text-[var(--color-text-primary)]">{detailData.failed_payment_count}</strong>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <span className="text-[var(--color-text-muted)] block">Open Invoices</span>
                <strong className="text-base text-[var(--color-text-primary)]">{detailData.open_invoice_count}</strong>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs space-y-1">
              <p>
                <span className="text-[var(--color-text-muted)]">Owner: </span>
                {detailData.owner_email ?? "—"}
              </p>
              <p>
                <span className="text-[var(--color-text-muted)]">Time zone: </span>
                {detailData.timezone ?? "—"}
              </p>
              <p>
                <span className="text-[var(--color-text-muted)]">Created: </span>
                {formatShortDate(detailData.created_at ?? "")}
              </p>
              {detailData.subscriptions.length > 0 && (
                <div className="pt-1">
                  <p className="text-[var(--color-text-muted)]">Subscriptions</p>
                  <ul className="mt-1 space-y-0.5">
                    {detailData.subscriptions.map((s) => (
                      <li key={s.id}>
                        {s.plan_name ?? s.plan_id ?? "Plan"} · {humanizeCode(s.status)} · {s.seats} seat{s.seats === 1 ? "" : "s"}
                        {s.current_period_end ? ` · renews ${formatShortDate(s.current_period_end)}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {detailData.suspended_reason && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200">
                <p className="font-semibold mb-1">Active Operational Note</p>
                <p>{detailData.suspended_reason}</p>
              </div>
            )}

            <div className="flex flex-wrap items-start gap-2 pt-2 border-t border-[var(--color-border)]">
              <NotAvailableButton variant="primary" size="sm" reason={PROBE_REASON}>
                <RefreshCw className="w-3.5 h-3.5" />
                Run Health Probe
              </NotAvailableButton>
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
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Read-only view. Suspending or archiving an organization is a Super Admin action.
            </p>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}
