"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  FileWarning,
  ShieldCheck,
} from "lucide-react";
import { useDebounced } from "@/components/super-admin/admin-resource";
import type { OperatorSubscriptionItem } from "@/types/operator-console";
import { operatorApi } from "../_services/operator-api";
import { exportRowsToCsv, formatShortDate } from "../_services/operator-service";
import {
  NotAvailableButton,
  OperatorResourceStatus,
  formatMoney,
  humanizeCode,
  pageItemsOf,
  pageTotalOf,
  toServerPaging,
  useOperatorResource,
  type ResourceState,
} from "../_components/OperatorLive";
import {
  BulkSelectionBar,
  DemoDataBanner,
  FilterBar,
  KpiCard,
  OpButton,
  OpModal,
  OpSelect,
  OpTextarea,
  PageHeader,
  PaginationBar,
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type SubSortField = "orgName" | "planName" | "status" | "seatsUsed" | "renewalDate";

const NOTE_REASON = "support notes have no server endpoint yet";

/** Server status code -> the label the page has always used ("PAST_DUE" -> "Past Due", "TRIALING" -> "Trial"). */
function statusLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === "TRIALING" || s === "TRIAL") return "Trial";
  if (s === "CANCELED") return "Cancelled";
  return humanizeCode(s);
}

const totalOf = (state: ResourceState<{ total: number }>) => (state.status === "ready" ? state.data.total : null);

/**
 * Read-only subscription status from GET /v1/operator/subscriptions (billing.subscriptions:view). Billing is dormant
 * in V1: plan changes and suspensions belong to Super Admin, and support notes have no endpoint yet, so "Edit Note"
 * stays visible but disabled.
 */
export default function OperatorSubscriptionStatusPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<SubSortField>("orgName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const [noteTarget, setNoteTarget] = useState<OperatorSubscriptionItem | null>(null);
  const [noteText, setNoteText] = useState("");

  const debouncedSearch = useDebounced(search);
  const paging = toServerPaging(page, pageSize);
  const { state, reload } = useOperatorResource(
    () => operatorApi.subscriptions({ search: debouncedSearch, status: statusFilter, ...paging }),
    `subscriptions:${debouncedSearch}:${statusFilter}:${paging.page}:${paging.size}`,
  );
  // KPI counts: the server's totals per status (one-row reads; nothing is counted from a single page).
  const allRes = useOperatorResource(() => operatorApi.subscriptions({ size: 1 }), "subscriptions-total");
  const activeRes = useOperatorResource(() => operatorApi.subscriptions({ status: "ACTIVE", size: 1 }), "subscriptions-active");
  const trialRes = useOperatorResource(() => operatorApi.subscriptions({ status: "TRIALING", size: 1 }), "subscriptions-trialing");
  const pastDueRes = useOperatorResource(() => operatorApi.subscriptions({ status: "PAST_DUE", size: 1 }), "subscriptions-past-due");
  const suspendedRes = useOperatorResource(
    () => operatorApi.subscriptions({ status: "SUSPENDED", size: 1 }),
    "subscriptions-suspended",
  );

  const subscriptions = useMemo(() => pageItemsOf(state), [state]);
  const total = pageTotalOf(state);
  const activeTotal = totalOf(activeRes.state);
  const trialTotal = totalOf(trialRes.state);
  const pastDueTotal = totalOf(pastDueRes.state);
  const suspendedTotal = totalOf(suspendedRes.state);
  const activeCount = activeTotal === null || trialTotal === null ? null : activeTotal + trialTotal;
  const pastDueOrSuspended = pastDueTotal === null || suspendedTotal === null ? null : pastDueTotal + suspendedTotal;
  const monitoredTotal = totalOf(allRes.state);

  const handleSort = (field: SubSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "seatsUsed" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    return [...subscriptions].sort((a, b) => {
      let cmp = 0;
      if (sortField === "orgName") cmp = (a.org_name ?? "").localeCompare(b.org_name ?? "");
      else if (sortField === "planName") cmp = (a.plan_name ?? "").localeCompare(b.plan_name ?? "");
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else if (sortField === "seatsUsed") cmp = a.seats_used - b.seats_used;
      else cmp = new Date(a.current_period_end ?? 0).getTime() - new Date(b.current_period_end ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [subscriptions, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, pageSize]);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    sorted.map((s) => s.id),
    sorted.map((s) => s.id)
  );

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    // Support notes have no server endpoint: nothing is saved locally either.
    setNoteTarget(null);
  };

  const csvRow = (s: OperatorSubscriptionItem) => [
    s.org_name ?? s.org_id,
    s.plan_name ?? s.plan_code ?? "—",
    humanizeCode(s.billing_cycle),
    statusLabel(s.status),
    s.seats_used,
    s.seats,
    s.current_period_end ?? "",
    formatMoney(s.amount, s.currency),
  ];

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-subscription-status-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Organization", "Plan", "Cycle", "Status", "Seats Used", "Seats Limit", "Renewal Date", "Amount"],
      sorted.map((s, i) => [i + 1, ...csvRow(s)])
    );
    toast.success(`Exported ${sorted.length} subscription record(s).`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscription Status"
        badge="Read-Only + Support Notes"
        liveData
        description="Monitor organization subscription health, license seat headroom, and upcoming renewals to assist customers proactively."
        actions={
          <Link href="/platform-operator/payment-failures">
            <OpButton variant="outline" size="sm">
              <FileWarning className="w-3.5 h-3.5" />
              Payment Failures
            </OpButton>
          </Link>
        }
      />

      <DemoDataBanner
        title="Role Boundary"
        description="Plan upgrades, pricing changes, refunds, and suspensions are governed exclusively by Super Admin. Platform Operators monitor status and add support coordination notes."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Active & Trial Accounts"
          value={activeCount ?? "-"}
          sublabel="Operating in good standing"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Past Due / Suspended"
          value={pastDueOrSuspended ?? "-"}
          sublabel="Requires customer payment follow-up"
          icon={AlertTriangle}
          tone={pastDueOrSuspended ? "amber" : "emerald"}
        />
        <KpiCard
          label="Total Monitored Subscriptions"
          value={monitoredTotal ?? "-"}
          sublabel="Across Starter, Growth, and Enterprise"
          icon={ShieldCheck}
          tone="teal"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search organization, plan, or coordination note..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={sorted.length === 0}
          filters={
            <div className="w-44">
              <OpSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter subscription status"
                options={[
                  { label: "All Statuses", value: "ALL" },
                  { label: "Active", value: "ACTIVE" },
                  { label: "Trial", value: "TRIALING" },
                  { label: "Past Due", value: "PAST_DUE" },
                  { label: "Suspended", value: "SUSPENDED" },
                  { label: "Cancelled", value: "CANCELLED" },
                ]}
              />
            </div>
          }
        />

        {state.status !== "ready" || sorted.length === 0 ? (
          <OperatorResourceStatus
            state={state.status === "ready" ? { status: "ready", data: sorted } : state}
            isEmpty={(data) => data.length === 0}
            onRetry={() => void reload()}
            emptyIcon={ShieldCheck}
            emptyTitle="No subscriptions found"
            emptyDescription="No subscription records match your current search or filter."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={sorted.length}
              onSelectAllMatching={() => setSelectedIds(sorted.map((s) => s.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    const selectedList = sorted.filter((s) => selectedSet.has(s.id));
                    exportRowsToCsv(
                      `prowise-selected-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Organization", "Plan", "Cycle", "Status", "Seats Used", "Seats Limit", "Renewal Date", "Amount"],
                      selectedList.map(csvRow)
                    );
                    toast.success(`Exported ${selectedList.length} selected subscription(s).`);
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
                        aria-label="Select all subscriptions on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Organization" active={sortField === "orgName"} direction={sortDir} onSort={() => handleSort("orgName")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Plan & Billing" active={sortField === "planName"} direction={sortDir} onSort={() => handleSort("planName")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Seat Utilization" active={sortField === "seatsUsed"} direction={sortDir} onSort={() => handleSort("seatsUsed")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Renewal Date" active={sortField === "renewalDate"} direction={sortDir} onSort={() => handleSort("renewalDate")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Support Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {sorted.map((sub, idx) => {
                    const srNo = (page - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(sub.id);
                    const pct = sub.seats > 0 ? Math.min(100, Math.round((sub.seats_used / sub.seats) * 100)) : 0;
                    const orgName = sub.org_name ?? sub.org_id;
                    return (
                      <tr key={sub.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(sub.id)}
                            aria-label={`Select ${orgName}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 min-w-[220px]">
                          <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-teal-500/15 text-[10px] font-bold text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                              {getOrgInitials(orgName)}
                            </span>
                            <div>
                              <p className="font-semibold text-[var(--color-text-primary)]">{orgName}</p>
                              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                                {sub.org_slug ?? ""}
                                {sub.cancel_at_period_end ? " · cancels at period end" : sub.auto_renew ? " · auto-renews" : " · no auto-renew"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <p className="font-medium text-[var(--color-text-primary)]">{sub.plan_name ?? sub.plan_code ?? "—"}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">
                            {humanizeCode(sub.billing_cycle)} · {formatMoney(sub.amount, sub.currency)}
                          </p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={statusLabel(sub.status)} tone={getStatusTone(statusLabel(sub.status))} dot />
                        </td>
                        <td className="py-3 px-3.5 min-w-[140px]">
                          <div className="flex justify-between text-[11px] text-[var(--color-text-secondary)] mb-1">
                            <span>
                              {sub.seats_used} / {sub.seats} seats
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                            <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatShortDate(sub.current_period_end ?? "")}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <NotAvailableButton variant="outline" size="xs" reason={NOTE_REASON} wrapperClassName="items-end">
                            <Edit3 className="w-3.5 h-3.5" />
                            Edit Note
                          </NotAvailableButton>
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

      <OpModal
        isOpen={Boolean(noteTarget)}
        onClose={() => setNoteTarget(null)}
        title={noteTarget ? `Support Note — ${noteTarget.org_name ?? noteTarget.org_id}` : "Support Note"}
        description="Share billing coordination context with fellow operators and Super Admin."
        maxWidth="md"
      >
        <form onSubmit={handleSaveNote} className="space-y-4">
          <OpTextarea
            label="Operator Coordination Note"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="e.g. Customer confirmed corporate card replacement is scheduled for Friday..."
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setNoteTarget(null)}>
              Cancel
            </OpButton>
            <NotAvailableButton variant="primary" size="sm" reason={NOTE_REASON}>
              Save Note
            </NotAvailableButton>
          </div>
        </form>
      </OpModal>
    </div>
  );
}
