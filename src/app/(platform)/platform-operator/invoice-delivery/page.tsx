"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, CreditCard, MailWarning, RotateCcw } from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { InvoiceDeliveryItem } from "../_types";
import { exportRowsToCsv, formatCurrency, formatDateTime } from "../_services/operator-service";
import {
  BulkSelectionBar,
  ConfirmModal,
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
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type InvSortField = "invoiceNumber" | "orgName" | "amountUsd" | "deliveryStatus" | "lastSentAt";

export default function OperatorInvoiceDeliveryPage() {
  const invoiceDeliveries = usePlatformOperatorStore((s) => s.invoiceDeliveries);
  const requestInvoiceResend = usePlatformOperatorStore((s) => s.requestInvoiceResend);
  const bulkResendInvoices = usePlatformOperatorStore((s) => s.bulkResendInvoices);
  const { can } = useOperatorPermissions();
  const canTriage = can("billing.triage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<InvSortField>("lastSentAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [resendTarget, setResendTarget] = useState<InvoiceDeliveryItem | null>(null);

  const deliveredCount = useMemo(
    () => invoiceDeliveries.filter((i) => i.deliveryStatus === "Delivered").length,
    [invoiceDeliveries]
  );
  const attentionCount = useMemo(
    () => invoiceDeliveries.filter((i) => i.deliveryStatus !== "Delivered").length,
    [invoiceDeliveries]
  );
  const totalResends = useMemo(
    () => invoiceDeliveries.reduce((sum, i) => sum + i.resendCount, 0),
    [invoiceDeliveries]
  );

  const handleSort = (field: InvSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "amountUsd" || field === "lastSentAt" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = invoiceDeliveries.filter((inv) => {
      const matchesQ =
        !q ||
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.orgName.toLowerCase().includes(q) ||
        inv.recipientEmail.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || inv.deliveryStatus === statusFilter;
      return matchesQ && matchesStatus;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "invoiceNumber") cmp = a.invoiceNumber.localeCompare(b.invoiceNumber);
      else if (sortField === "orgName") cmp = a.orgName.localeCompare(b.orgName);
      else if (sortField === "amountUsd") cmp = a.amountUsd - b.amountUsd;
      else if (sortField === "deliveryStatus") cmp = a.deliveryStatus.localeCompare(b.deliveryStatus);
      else cmp = new Date(a.lastSentAt).getTime() - new Date(b.lastSentAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [invoiceDeliveries, search, statusFilter, sortField, sortDir]);

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
    filtered.map((i) => i.id),
    paginated.map((i) => i.id)
  );

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-invoice-delivery-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Invoice #", "Organization", "Recipient Email", "Amount USD", "Status", "Resends", "Last Sent"],
      filtered.map((i, idx) => [
        idx + 1,
        i.invoiceNumber,
        i.orgName,
        i.recipientEmail,
        i.amountUsd,
        i.deliveryStatus,
        i.resendCount,
        i.lastSentAt,
      ])
    );
    toast.success(`Exported ${filtered.length} invoice delivery record(s).`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice Delivery"
        badge={`${attentionCount} Attention Needed`}
        demoLabel="Simulated Resend Delivery"
        description="Track customer invoice email delivery status, spot bounced receipts, and trigger safe invoice PDF resends."
      />

      <DemoDataBanner
        title="Delegated Invoice Delivery"
        description="Resend actions trigger simulated email dispatches locally. Creating, voiding, or refunding invoices remains in Super Admin."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Delivered Cleanly"
          value={deliveredCount}
          sublabel="Confirmed by customer mail server"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Bounced / Pending"
          value={attentionCount}
          sublabel="Ready for operator resend"
          icon={MailWarning}
          tone={attentionCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Operator Resends Sent"
          value={totalResends}
          sublabel="Re-dispatched during session"
          icon={CreditCard}
          tone="teal"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search invoice #, organization, or email..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={filtered.length === 0}
          filters={
            <div className="w-44">
              <OpSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter delivery status"
                options={[
                  { label: "All Statuses", value: "ALL" },
                  { label: "Delivered", value: "Delivered" },
                  { label: "Bounced", value: "Bounced" },
                  { label: "Pending", value: "Pending" },
                  { label: "Resend Requested", value: "Resend Requested" },
                ]}
              />
            </div>
          }
        />

        {paginated.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No invoice delivery records found"
            description="Adjust your search or status filter."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((i) => i.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="primary"
                  size="xs"
                  disabled={!canTriage}
                  onClick={() => {
                    const count = bulkResendInvoices(selectedIds);
                    toast.success(`Requested simulated resend for ${count} invoice(s).`);
                    setSelectedIds([]);
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Resend Selected ({selectedIds.length})
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
                  {paginated.map((inv, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(inv.id);
                    return (
                      <tr key={inv.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(inv.id)}
                            aria-label={`Select ${inv.invoiceNumber}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 font-semibold whitespace-nowrap">
                          {inv.invoiceNumber}
                          <span className="block text-[10px] font-normal text-[var(--color-text-muted)]">
                            Resends: {inv.resendCount}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 min-w-[230px]">
                          <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-teal-500/15 text-[10px] font-bold text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                              {getOrgInitials(inv.orgName)}
                            </span>
                            <div>
                              <p className="font-semibold text-[var(--color-text-primary)]">{inv.orgName}</p>
                              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{inv.recipientEmail}</p>
                              {inv.failureNote && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">{inv.failureNote}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-semibold tabular-nums">
                          {formatCurrency(inv.amountUsd)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={inv.deliveryStatus} tone={getStatusTone(inv.deliveryStatus)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatDateTime(inv.lastSentAt)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <OpButton
                            variant={inv.deliveryStatus === "Delivered" ? "outline" : "primary"}
                            size="xs"
                            disabled={!canTriage}
                            onClick={() => setResendTarget(inv)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Resend Copy
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

      <ConfirmModal
        isOpen={Boolean(resendTarget)}
        onClose={() => setResendTarget(null)}
        title="Resend Invoice Copy?"
        description={
          resendTarget
            ? `Send a fresh invoice email copy of ${resendTarget.invoiceNumber} to ${resendTarget.recipientEmail} (simulated)?`
            : ""
        }
        confirmLabel="Resend Invoice"
        variant="primary"
        onConfirm={() => {
          if (resendTarget) {
            requestInvoiceResend(resendTarget.id);
            toast.success(
              `Invoice ${resendTarget.invoiceNumber} re-dispatched to ${resendTarget.recipientEmail} (simulated).`
            );
          }
        }}
      />
    </div>
  );
}
