"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CheckCircle2,
  FileWarning,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useDebounced } from "@/components/super-admin/admin-resource";
import type { OperatorPaymentFailureItem } from "@/types/operator-console";
import { operatorApi } from "../_services/operator-api";
import { exportRowsToCsv, formatDateTime } from "../_services/operator-service";
import {
  NOT_AVAILABLE,
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  formatMoney,
  pageItemsOf,
  pageTotalOf,
  toServerPaging,
  useOperatorResource,
} from "../_components/OperatorLive";
import {
  BulkSelectionBar,
  ConfirmModal,
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
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type PaySortField = "refCode" | "orgName" | "amountUsd" | "retryCount" | "retryStatus" | "failedAt";

/** Payment method as "Card •••• 4242" from the server's method / last4 / gateway label. */
function methodSummary(p: OperatorPaymentFailureItem): string {
  const method = p.method ? p.method.replace(/_/g, " ").toLowerCase() : "payment";
  const label = method.charAt(0).toUpperCase() + method.slice(1);
  const last4 = p.method_last4 ? ` •••• ${p.method_last4}` : "";
  return `${label}${last4}${p.gateway_label ? ` (${p.gateway_label})` : ""}`;
}

/** `YYYY-MM-DD` (viewer's local day) as the UTC instant at the start / end of that day. */
function dayStart(value: string): string | undefined {
  return value ? new Date(`${value}T00:00:00`).toISOString() : undefined;
}
function dayEnd(value: string): string | undefined {
  return value ? new Date(`${value}T23:59:59.999`).toISOString() : undefined;
}

/**
 * Real failed payments (GET /v1/operator/payments/failures). Billing is dormant in V1: nothing is charged or retried
 * from here, so retry / escalate controls stay visible but disabled ("Not available yet").
 */
export default function OperatorPaymentFailuresPage() {

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<PaySortField>("failedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [escalateTarget, setEscalateTarget] = useState<OperatorPaymentFailureItem | null>(null);

  const debouncedSearch = useDebounced(search);
  const query = {
    search: debouncedSearch.trim() || undefined,
    from: dayStart(dateFrom),
    to: dayEnd(dateTo),
    ...toServerPaging(page, pageSize),
  };
  const { state, reload } = useOperatorResource(
    () => operatorApi.paymentFailures(query),
    `payment-failures:${JSON.stringify(query)}`,
  );
  const isReady = state.status === "ready";
  const rows = useMemo(() => pageItemsOf(state), [state]);
  const total = pageTotalOf(state);

  const handleSort = (field: PaySortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "amountUsd" || field === "failedAt" ? "desc" : "asc");
    }
  };

  /** Sorting applies to the page the server returned (the server orders by failure time, newest first). */
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortField === "refCode") cmp = (a.transaction_ref ?? "").localeCompare(b.transaction_ref ?? "");
      else if (sortField === "orgName") cmp = (a.org_name ?? "").localeCompare(b.org_name ?? "");
      else if (sortField === "amountUsd") cmp = Number(a.amount ?? 0) - Number(b.amount ?? 0);
      else if (sortField === "retryStatus") cmp = (a.invoice_status ?? "").localeCompare(b.invoice_status ?? "");
      else if (sortField === "failedAt")
        cmp = new Date(a.failed_at ?? 0).getTime() - new Date(b.failed_at ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFrom, dateTo, pageSize]);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    sorted.map((p) => p.id),
    sorted.map((p) => p.id)
  );

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-payment-failures-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Reference", "Organization", "Amount", "Currency", "Method", "Reason", "Invoice", "Invoice Status", "Failed At"],
      sorted.map((p, i) => [
        (page - 1) * pageSize + i + 1,
        p.transaction_ref ?? p.id,
        p.org_name ?? p.org_id ?? "-",
        p.amount ?? "",
        p.currency ?? "",
        methodSummary(p),
        p.failure_reason ?? "",
        p.invoice_number ?? "",
        p.invoice_status ?? "",
        p.failed_at ?? "",
      ])
    );
    toast.success(`Exported ${sorted.length} payment failure record(s).`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Failures"
        badge={isReady ? `${total} Unresolved` : undefined}
        liveData
        description="Monitor failed subscription renewals, trigger safe gateway retries, and escalate repeated declines to Super Admin."
        actions={
          <OpButton variant="outline" size="sm" isLoading={state.status === "loading"} onClick={() => void reload()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Payment Failure -> Escalation"
        description="Payment retries are simulated locally without charging live cards. Unresolved declines can be escalated directly to Super Admin for grace-period or suspension review."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Awaiting Retry / Failed"
          value={isReady ? total : "-"}
          sublabel="Failed payments recorded by the server"
          icon={FileWarning}
          tone={total > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Escalated to Super Admin"
          value={NOT_AVAILABLE}
          sublabel="Not available yet: payment escalation is not recorded on the server"
          icon={ArrowUpRight}
          tone="rose"
        />
        <KpiCard
          label="Settled via Retry"
          value={NOT_AVAILABLE}
          sublabel="Not available yet: billing is dormant, nothing is retried"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search payment code, organization, or decline reason..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL" || dateFrom || dateTo)}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            setDateFrom("");
            setDateTo("");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={sorted.length === 0}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-52" title={`${NOT_AVAILABLE}: payments have no retry state on the server`}>
                <OpSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter retry status"
                  disabled
                  title={`${NOT_AVAILABLE}: payments have no retry state on the server`}
                  options={[
                    { label: "All Failure States", value: "ALL" },
                    { label: "Scheduled", value: "Scheduled" },
                    { label: "Retried — Failed", value: "Retried — Failed" },
                    { label: "Escalated to Super Admin", value: "Escalated to Super Admin" },
                    { label: "Retried — Succeeded", value: "Retried — Succeeded" },
                  ]}
                />
                <span className="text-[10px] text-[var(--color-text-muted)]">{NOT_AVAILABLE}</span>
              </div>
              <div className="w-40">
                <OpInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Failed from" />
              </div>
              <div className="w-40">
                <OpInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Failed to" />
              </div>
            </div>
          }
        />

        {state.status !== "ready" || sorted.length === 0 ? (
          <OperatorResourceStatus
            state={state.status === "ready" ? { status: "ready", data: sorted } : state}
            isEmpty={(data) => data.length === 0}
            onRetry={() => void reload()}
            emptyIcon={CheckCircle2}
            emptyTitle="No payment failures match your filter"
            emptyDescription="Adjust your search or date filter."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={sorted.length}
              onSelectAllMatching={() => setSelectedIds(sorted.map((p) => p.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <NotAvailableButton variant="primary" size="xs" reason="billing is dormant, no payment retry endpoint">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Selected ({selectedIds.length})
                </NotAvailableButton>
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
                        aria-label="Select all payment failures on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Ref Code" active={sortField === "refCode"} direction={sortDir} onSort={() => handleSort("refCode")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Organization & Failure" active={sortField === "orgName"} direction={sortDir} onSort={() => handleSort("orgName")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Amount" active={sortField === "amountUsd"} direction={sortDir} onSort={() => handleSort("amountUsd")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "retryStatus"} direction={sortDir} onSort={() => handleSort("retryStatus")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Failed At" active={sortField === "failedAt"} direction={sortDir} onSort={() => handleSort("failedAt")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {sorted.map((item, idx) => {
                    const srNo = (page - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(item.id);
                    const orgName = item.org_name ?? item.org_id ?? "-";
                    return (
                      <tr key={item.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(item.id)}
                            aria-label={`Select ${item.transaction_ref ?? item.id}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2 py-0.5 text-[11px] font-semibold">
                            {item.transaction_ref ?? item.id.slice(0, 8)}
                          </span>
                          <span className="block text-[10px] text-[var(--color-text-muted)] mt-1">
                            <NotAvailableText reason="retry attempts are not recorded" /> attempt(s)
                          </span>
                          {item.invoice_number && (
                            <span className="block text-[10px] text-[var(--color-text-muted)]">Invoice {item.invoice_number}</span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 min-w-[230px]">
                          <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-rose-500/15 text-[10px] font-bold text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
                              {getOrgInitials(orgName)}
                            </span>
                            <div>
                              <p className="font-semibold text-[var(--color-text-primary)]">
                                {orgName} — {methodSummary(item)}
                              </p>
                              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                                {item.failure_reason ?? item.description ?? "-"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-bold tabular-nums">
                          {formatMoney(item.amount, item.currency)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label="Failed" tone={getStatusTone("Failed")} dot />
                          {item.invoice_status && (
                            <span className="block text-[10px] text-[var(--color-text-muted)] mt-1">
                              Invoice {item.invoice_status.replace(/_/g, " ").toLowerCase()}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {item.failed_at ? formatDateTime(item.failed_at) : "-"}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <NotAvailableButton variant="primary" size="xs" reason="billing is dormant, no payment retry endpoint">
                              <RotateCcw className="w-3.5 h-3.5" />
                              Retry Charge (Sim)
                            </NotAvailableButton>
                            <NotAvailableButton
                              variant="danger"
                              size="xs"
                              reason="no payment escalation endpoint"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                              Escalate
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

      {/* Kept for the escalation flow; it cannot open while escalation has no endpoint. */}
      <ConfirmModal
        isOpen={Boolean(escalateTarget)}
        onClose={() => setEscalateTarget(null)}
        title="Escalate Payment Failure to Super Admin?"
        description={
          escalateTarget
            ? `Escalate ${escalateTarget.transaction_ref ?? escalateTarget.id} (${formatMoney(escalateTarget.amount, escalateTarget.currency)} for ${escalateTarget.org_name ?? "-"}) to Super Admin billing governance?`
            : ""
        }
        confirmLabel="Escalate Payment"
        variant="danger"
        onConfirm={() => setEscalateTarget(null)}
      />
    </div>
  );
}
