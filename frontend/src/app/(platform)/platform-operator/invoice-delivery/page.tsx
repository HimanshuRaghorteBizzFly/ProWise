"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, MailWarning, RefreshCw, RotateCcw } from "lucide-react";
import { useDebounced } from "@/components/super-admin/admin-resource";
import type { OperatorInvoiceDeliveryItem } from "@/types/operator-console";
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

type InvSortField = "invoiceNumber" | "orgName" | "amountUsd" | "deliveryStatus" | "lastSentAt";

/** Delivery filter labels kept from the original screen, mapped to the server's email delivery statuses. */
const DELIVERY_FILTERS = [
  { label: "All Statuses", value: "ALL" },
  { label: "Delivered", value: "SMTP_ACCEPTED" },
  { label: "Bounced", value: "FAILED" },
  { label: "Pending", value: "NOT_SENT" },
  { label: "Resend Requested", value: "RETRY_PENDING" },
];

const INVOICE_STATUS_FILTERS = [
  { label: "All Invoice States", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "Overdue", value: "OVERDUE" },
  { label: "Paid", value: "PAID" },
  { label: "Void", value: "VOID" },
  { label: "Draft", value: "DRAFT" },
];

function deliveryLabel(status: string): string {
  if (status === "SMTP_ACCEPTED") return "Delivered (SMTP accepted)";
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

/** A local date (YYYY-MM-DD) shown as-is: due dates are calendar days, never shifted through a time zone. */
function localDate(value: string | null): string {
  return value ?? "-";
}

/**
 * Real invoice email delivery (GET /v1/operator/invoices/delivery): the latest delivery log per invoice. Nothing is
 * sent from this console, so resend controls stay visible but disabled ("Not available yet").
 */
export default function OperatorInvoiceDeliveryPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [invoiceStatus, setInvoiceStatus] = useState("ALL");
  const [sortField, setSortField] = useState<InvSortField>("lastSentAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [resendTarget, setResendTarget] = useState<OperatorInvoiceDeliveryItem | null>(null);

  const debouncedSearch = useDebounced(search);
  const query = {
    delivery_status: statusFilter,
    invoice_status: invoiceStatus,
    search: debouncedSearch.trim() || undefined,
    ...toServerPaging(page, pageSize),
  };
  const { state, reload } = useOperatorResource(
    () => operatorApi.invoiceDelivery(query),
    `invoice-delivery:${JSON.stringify(query)}`,
  );
  /** Real totals for the KPI tiles: every invoice, and those the SMTP server accepted. */
  const allRes = useOperatorResource(() => operatorApi.invoiceDelivery({ size: 1 }), "invoice-delivery-total");
  const acceptedRes = useOperatorResource(
    () => operatorApi.invoiceDelivery({ delivery_status: "SMTP_ACCEPTED", size: 1 }),
    "invoice-delivery-accepted",
  );
  const countsReady = allRes.state.status === "ready" && acceptedRes.state.status === "ready";
  const deliveredCount = pageTotalOf(acceptedRes.state);
  const attentionCount = Math.max(0, pageTotalOf(allRes.state) - deliveredCount);

  const rows = useMemo(() => pageItemsOf(state), [state]);
  const total = pageTotalOf(state);

  const reloadAll = () => {
    void reload();
    void allRes.reload();
    void acceptedRes.reload();
  };

  const handleSort = (field: InvSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "amountUsd" || field === "lastSentAt" ? "desc" : "asc");
    }
  };

  /** Sorting applies to the page the server returned. */
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortField === "invoiceNumber") cmp = (a.invoice_number ?? "").localeCompare(b.invoice_number ?? "");
      else if (sortField === "orgName") cmp = (a.org_name ?? "").localeCompare(b.org_name ?? "");
      else if (sortField === "amountUsd") cmp = Number(a.total ?? 0) - Number(b.total ?? 0);
      else if (sortField === "deliveryStatus") cmp = a.delivery_status.localeCompare(b.delivery_status);
      else cmp = new Date(a.last_sent_at ?? 0).getTime() - new Date(b.last_sent_at ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, invoiceStatus, pageSize]);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    sorted.map((i) => i.invoice_id),
    sorted.map((i) => i.invoice_id)
  );

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-invoice-delivery-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Invoice #", "Organization", "Recipient Email", "Total", "Invoice Status", "Delivery Status", "Attempts", "Last Sent", "Last Error"],
      sorted.map((i, idx) => [
        (page - 1) * pageSize + idx + 1,
        i.invoice_number ?? i.invoice_id,
        i.org_name ?? i.org_id ?? "-",
        i.recipient_email ?? "",
        i.total ?? "",
        i.invoice_status ?? "",
        i.delivery_status,
        i.delivery_attempts,
        i.last_sent_at ?? "",
        i.last_error_code ?? "",
      ])
    );
    toast.success(`Exported ${sorted.length} invoice delivery record(s).`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Delivery"
        badge={countsReady ? `${attentionCount} Attention Needed` : undefined}
        liveData
        description="Track customer invoice email delivery status, spot bounced receipts, and trigger safe invoice PDF resends."
        actions={
          <OpButton variant="outline" size="sm" isLoading={state.status === "loading"} onClick={reloadAll}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Delegated Invoice Delivery"
        description="Resend actions trigger simulated email dispatches locally. Creating, voiding, or refunding invoices remains in Super Admin."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Delivered Cleanly"
          value={countsReady ? deliveredCount : "-"}
          sublabel="Accepted by the SMTP server (not proof of inbox delivery)"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Bounced / Pending"
          value={countsReady ? attentionCount : "-"}
          sublabel="Not sent, failed or still retrying"
          icon={MailWarning}
          tone={attentionCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Operator Resends Sent"
          value={NOT_AVAILABLE}
          sublabel="Not available yet: invoices cannot be re-sent from the console"
          icon={CreditCard}
          tone="teal"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search invoice #, organization, or email..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL" || invoiceStatus !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            setInvoiceStatus("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={sorted.length === 0}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-44">
                <OpSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter delivery status"
                  options={DELIVERY_FILTERS}
                />
              </div>
              <div className="w-44">
                <OpSelect
                  value={invoiceStatus}
                  onChange={(e) => setInvoiceStatus(e.target.value)}
                  aria-label="Filter invoice status"
                  options={INVOICE_STATUS_FILTERS}
                />
              </div>
            </div>
          }
        />

        {state.status !== "ready" || sorted.length === 0 ? (
          <OperatorResourceStatus
            state={state.status === "ready" ? { status: "ready", data: sorted } : state}
            isEmpty={(data) => data.length === 0}
            onRetry={() => void reload()}
            emptyIcon={CreditCard}
            emptyTitle="No invoice delivery records found"
            emptyDescription="Adjust your search or status filter."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={sorted.length}
              onSelectAllMatching={() => setSelectedIds(sorted.map((i) => i.invoice_id))}
              onClear={() => setSelectedIds([])}
              actions={
                <NotAvailableButton variant="primary" size="xs" reason="invoices cannot be re-sent from the console">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Resend Selected ({selectedIds.length})
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
                        aria-label="Select all invoices on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Invoice #" active={sortField === "invoiceNumber"} direction={sortDir} onSort={() => handleSort("invoiceNumber")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Organization & Recipient" active={sortField === "orgName"} direction={sortDir} onSort={() => handleSort("orgName")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Amount" active={sortField === "amountUsd"} direction={sortDir} onSort={() => handleSort("amountUsd")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Delivery Status" active={sortField === "deliveryStatus"} direction={sortDir} onSort={() => handleSort("deliveryStatus")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Last Sent" active={sortField === "lastSentAt"} direction={sortDir} onSort={() => handleSort("lastSentAt")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {sorted.map((inv, idx) => {
                    const srNo = (page - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(inv.invoice_id);
                    const orgName = inv.org_name ?? inv.org_id ?? "-";
                    return (
                      <tr key={inv.invoice_id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(inv.invoice_id)}
                            aria-label={`Select ${inv.invoice_number ?? inv.invoice_id}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 font-semibold whitespace-nowrap">
                          {inv.invoice_number ?? inv.invoice_id.slice(0, 8)}
                          <span className="block text-[10px] font-normal text-[var(--color-text-muted)]">
                            Resends: <NotAvailableText reason="no resend endpoint" />
                          </span>
                          <span className="block text-[10px] font-normal text-[var(--color-text-muted)]">
                            {inv.delivery_attempts} delivery attempt{inv.delivery_attempts === 1 ? "" : "s"}
                            {inv.invoice_status ? ` · ${inv.invoice_status.toLowerCase()}` : ""}
                          </span>
                          {inv.due_date && (
                            <span className="block text-[10px] font-normal text-[var(--color-text-muted)]">
                              Due {localDate(inv.due_date)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 min-w-[230px]">
                          <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-teal-500/15 text-[10px] font-bold text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                              {getOrgInitials(orgName)}
                            </span>
                            <div>
                              <p className="font-semibold text-[var(--color-text-primary)]">{orgName}</p>
                              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{inv.recipient_email ?? "-"}</p>
                              {inv.last_error_code && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">{inv.last_error_code}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-semibold tabular-nums">
                          {formatMoney(inv.total)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={deliveryLabel(inv.delivery_status)} tone={getStatusTone(inv.delivery_status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {inv.last_sent_at
                            ? formatDateTime(inv.last_sent_at)
                            : inv.last_attempt_at
                              ? `attempted ${formatDateTime(inv.last_attempt_at)}`
                              : "not sent"}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <NotAvailableButton
                            variant={inv.delivery_status === "SMTP_ACCEPTED" ? "outline" : "primary"}
                            size="xs"
                            reason="invoices cannot be re-sent from the console"
                            wrapperClassName="items-end"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Resend Copy
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

      {/* Kept for the resend flow; it cannot open while there is no resend endpoint. */}
      <ConfirmModal
        isOpen={Boolean(resendTarget)}
        onClose={() => setResendTarget(null)}
        title="Resend Invoice Copy?"
        description={
          resendTarget
            ? `Send a fresh invoice email copy of ${resendTarget.invoice_number ?? resendTarget.invoice_id} to ${resendTarget.recipient_email ?? "-"}?`
            : ""
        }
        confirmLabel="Resend Invoice"
        variant="primary"
        onConfirm={() => setResendTarget(null)}
      />
    </div>
  );
}
