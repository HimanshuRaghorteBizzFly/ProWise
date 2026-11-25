"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  LayoutGrid,
  List,
  ShieldAlert,
} from "lucide-react";
import type { OpsAlert } from "@/types/admin-operations";
import { useOperatorPermissions } from "../_services/operator-access";
import { operatorApi } from "../_services/operator-api";
import { formatDateTime } from "../_services/operator-service";
import {
  MutationNotice,
  NotAvailableButton,
  OperatorResourceStatus,
  humanizeCode,
  rowsOf,
  useOperatorMutation,
  useOperatorResource,
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

type AlertSortField = "title" | "category" | "severity" | "status" | "triggeredAt";

/** One alert as the page shows it, read from GET /v1/operator/monitoring/alerts. */
interface AlertRow {
  id: string;
  title: string;
  /** source_module from the server. */
  category: string;
  /** "Critical" | "Warning" | "Info" (server severity, title-cased). */
  severity: string;
  /** The server only knows acknowledged / not acknowledged; there is no resolved state yet. */
  status: "Active" | "Acknowledged" | "Resolved";
  /** The alert message (the server stores no separate threshold rule). */
  thresholdSummary: string;
  /** Owning department (the server stores no other target). */
  affectedTarget: string;
  triggeredAt: string;
  acknowledgedBy?: string;
  /** The server does not link alerts to incidents yet. */
  linkedIncidentId?: string;
}

function toAlertRow(a: OpsAlert): AlertRow {
  return {
    id: a.id,
    title: a.title,
    category: humanizeCode(a.source_module),
    severity: humanizeCode(a.severity),
    status: a.acknowledged ? "Acknowledged" : "Active",
    thresholdSummary: a.message ?? "—",
    affectedTarget: a.department_id ? humanizeCode(a.department_id) : "All departments",
    triggeredAt: a.created_at ?? "",
    acknowledgedBy: a.acknowledged_by ?? undefined,
  };
}

export default function OperatorAlertsPage() {
  const { state: alertsState, reload } = useOperatorResource(() => operatorApi.alerts.list(), "alerts");
  const alerts = useMemo(() => rowsOf(alertsState).map(toAlertRow), [alertsState]);
  const { busy, notice, clearNotice, run } = useOperatorMutation(reload);
  const acknowledgeAlert = (alertId: string) =>
    void run(`ack:${alertId}`, () => operatorApi.alerts.acknowledge(alertId), "Alert acknowledged.");
  const isReady = alertsState.status === "ready";
  const { can } = useOperatorPermissions();
  const canManage = can("system.manage");

  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<AlertSortField>("triggeredAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const activeCount = useMemo(() => alerts.filter((a) => a.status === "Active").length, [alerts]);
  const acknowledgedCount = useMemo(() => alerts.filter((a) => a.status === "Acknowledged").length, [alerts]);

  const handleSort = (field: AlertSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "triggeredAt" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sevRank: Record<string, number> = { Critical: 0, Warning: 1, Info: 2 };
    const list = alerts.filter((a) => {
      const matchesQ =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.thresholdSummary.toLowerCase().includes(q) ||
        a.affectedTarget.toLowerCase().includes(q);
      const matchesSev = severityFilter === "ALL" || a.severity === severityFilter;
      const matchesStatus = statusFilter === "ALL" || a.status === statusFilter;
      return matchesQ && matchesSev && matchesStatus;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "title") cmp = a.title.localeCompare(b.title);
      else if (sortField === "category") cmp = a.category.localeCompare(b.category);
      else if (sortField === "severity") cmp = (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else cmp = new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [alerts, search, severityFilter, statusFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, severityFilter, statusFilter, pageSize]);

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
    filtered.map((a) => a.id),
    paginated.map((a) => a.id)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts & Notifications"
        badge={isReady ? `${activeCount} Unacknowledged` : undefined}
        liveData
        description="Respond to threshold alerts, acknowledge incoming warnings, and promote active issues into formal incidents."
        actions={
          <Link href="/platform-operator/incidents">
            <OpButton variant="outline" size="sm">
              <AlertTriangle className="w-3.5 h-3.5" />
              Incident Console
            </OpButton>
          </Link>
        }
      />

      <DemoDataBanner
        title="Alert -> Incident -> Ticket Workflow"
        description="Promoted alerts automatically create a linked incident in Incident Management and track resolution back to the original alert."
      />

      <MutationNotice notice={notice} onReload={reload} onDismiss={clearNotice} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Active Alerts"
          value={isReady ? activeCount : "-"}
          sublabel="Awaiting operator acknowledgement"
          icon={Bell}
          tone={activeCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Acknowledged & In Progress"
          value={isReady ? acknowledgedCount : "-"}
          sublabel="Assigned or linked to incident"
          icon={ShieldAlert}
          tone="blue"
        />
        <KpiCard
          label="Resolved Alerts"
          value="—"
          sublabel="Not available yet: alerts have no resolved state on the server"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search alert rule, threshold, or target..."
          hasActiveFilters={Boolean(search || severityFilter !== "ALL" || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setSeverityFilter("ALL");
            setStatusFilter("ALL");
          }}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <OpSelect
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  aria-label="Filter severity"
                  options={[
                    { label: "All Severities", value: "ALL" },
                    { label: "Critical", value: "Critical" },
                    { label: "Warning", value: "Warning" },
                    { label: "Info", value: "Info" },
                  ]}
                />
              </div>
              <div className="w-40">
                <OpSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter status"
                  options={[
                    { label: "All Statuses", value: "ALL" },
                    { label: "Active", value: "Active" },
                    { label: "Acknowledged", value: "Acknowledged" },
                    { label: "Resolved", value: "Resolved" },
                  ]}
                />
              </div>
            </div>
          }
          rightActions={
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs">
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
            </div>
          }
        />

        {!isReady || alerts.length === 0 ? (
          <OperatorResourceStatus
            state={alertsState}
            isEmpty={(d) => d.length === 0}
            onRetry={reload}
            emptyIcon={CheckCircle2}
            emptyTitle="No alerts"
            emptyDescription="The server has no operational alerts right now."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No alerts match your filter"
            description="Reset your search or status filter."
          />
        ) : viewMode === "TABLE" ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((a) => a.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <>
                  <NotAvailableButton variant="outline" size="xs" hideLabel reason="no bulk acknowledge endpoint">
                    Acknowledge ({selectedIds.length})
                  </NotAvailableButton>
                  <NotAvailableButton variant="primary" size="xs" hideLabel reason="alerts cannot be resolved on the server">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Resolve ({selectedIds.length})
                  </NotAvailableButton>
                </>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[840px]">
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
                        aria-label="Select all alerts on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Alert & Target" active={sortField === "title"} direction={sortDir} onSort={() => handleSort("title")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Severity" active={sortField === "severity"} direction={sortDir} onSort={() => handleSort("severity")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Triggered" active={sortField === "triggeredAt"} direction={sortDir} onSort={() => handleSort("triggeredAt")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((alert, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(alert.id);
                    return (
                      <tr key={alert.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(alert.id)}
                            aria-label={`Select ${alert.title}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 min-w-[260px]">
                          <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                            <StatusBadge label={alert.category} tone="neutral" />
                            {alert.linkedIncidentId && (
                              <StatusBadge label="Linked Incident" tone="violet" />
                            )}
                          </div>
                          <p className="font-semibold text-[var(--color-text-primary)]">{alert.title}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {alert.affectedTarget} · Rule: {alert.thresholdSummary}
                          </p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={alert.severity} tone={getStatusTone(alert.severity)} />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={alert.status} tone={getStatusTone(alert.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatDateTime(alert.triggeredAt)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {alert.status === "Active" && (
                              <OpButton
                                variant="outline"
                                size="xs"
                                disabled={!canManage || busy !== null}
                                isLoading={busy === `ack:${alert.id}`}
                                onClick={() => acknowledgeAlert(alert.id)}
                              >
                                Acknowledge
                              </OpButton>
                            )}
                            {!alert.linkedIncidentId && alert.status !== "Resolved" && (
                              <NotAvailableButton
                                variant="subtle"
                                size="xs"
                                hideLabel
                                reason="alerts cannot be linked to incidents on the server"
                              >
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Incident
                              </NotAvailableButton>
                            )}
                            {alert.status !== "Resolved" && (
                              <NotAvailableButton
                                variant="primary"
                                size="xs"
                                hideLabel
                                reason="alerts cannot be resolved on the server"
                              >
                                Resolve
                              </NotAvailableButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {paginated.map((alert, idx) => {
              const srNo = (safePage - 1) * pageSize + idx + 1;
              return (
                <div
                  key={alert.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
                        #{srNo}
                      </span>
                      <StatusBadge label={alert.severity} tone={getStatusTone(alert.severity)} />
                      <StatusBadge label={alert.status} tone={getStatusTone(alert.status)} dot />
                      <StatusBadge label={alert.category} tone="neutral" />
                      {alert.linkedIncidentId && <StatusBadge label="Linked to Incident" tone="violet" />}
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{alert.title}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">Rule: {alert.thresholdSummary}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Target: {alert.affectedTarget} · Triggered {formatDateTime(alert.triggeredAt)}
                      {alert.acknowledgedBy ? ` · Acknowledged by ${alert.acknowledgedBy}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {alert.status === "Active" && (
                      <OpButton
                        variant="outline"
                        size="xs"
                        disabled={!canManage || busy !== null}
                        isLoading={busy === `ack:${alert.id}`}
                        onClick={() => acknowledgeAlert(alert.id)}
                      >
                        Acknowledge
                      </OpButton>
                    )}
                    {!alert.linkedIncidentId && alert.status !== "Resolved" && (
                      <NotAvailableButton
                        variant="subtle"
                        size="xs"
                        reason="alerts cannot be linked to incidents on the server"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Create Incident
                      </NotAvailableButton>
                    )}
                    {alert.status !== "Resolved" && (
                      <NotAvailableButton
                        variant="primary"
                        size="xs"
                        reason="alerts cannot be resolved on the server"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Resolve
                      </NotAvailableButton>
                    )}
                  </div>
                </div>
              );
            })}
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
