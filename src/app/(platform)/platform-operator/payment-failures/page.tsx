"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CheckCircle2,
  FileWarning,
  RotateCcw,
} from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { PaymentFailureItem } from "../_types";
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

type PaySortField = "refCode" | "orgName" | "amountUsd" | "retryCount" | "retryStatus" | "failedAt";

export default function OperatorPaymentFailuresPage() {
  const paymentFailures = usePlatformOperatorStore((s) => s.paymentFailures);
  const retryPaymentFailure = usePlatformOperatorStore((s) => s.retryPaymentFailure);
  const escalatePaymentFailure = usePlatformOperatorStore((s) => s.escalatePaymentFailure);
  const bulkRetryPaymentFailures = usePlatformOperatorStore((s) => s.bulkRetryPaymentFailures);
  const { can } = useOperatorPermissions();
  const canTriage = can("billing.triage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<PaySortField>("failedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [escalateTarget, setEscalateTarget] = useState<PaymentFailureItem | null>(null);

  const unresolvedCount = useMemo(
    () =>
      paymentFailures.filter(
        (p) => p.retryStatus === "Scheduled" || p.retryStatus === "Retried — Failed"
      ).length,
    [paymentFailures]
  );
  const escalatedCount = useMemo(
    () => paymentFailures.filter((p) => p.retryStatus === "Escalated to Super Admin").length,
    [paymentFailures]
  );
  const recoveredCount = useMemo(
    () => paymentFailures.filter((p) => p.retryStatus === "Retried — Succeeded").length,
    [paymentFailures]
  );

  const handleSort = (field: PaySortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "amountUsd" || field === "failedAt" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = paymentFailures.filter((p) => {
      const matchesQ =
        !q ||
        p.refCode.toLowerCase().includes(q) ||
        p.orgName.toLowerCase().includes(q) ||
        p.failureReason.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || p.retryStatus === statusFilter;
      return matchesQ && matchesStatus;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "refCode") cmp = a.refCode.localeCompare(b.refCode);
      else if (sortField === "orgName") cmp = a.orgName.localeCompare(b.orgName);
      else if (sortField === "amountUsd") cmp = a.amountUsd - b.amountUsd;
      else if (sortField === "retryCount") cmp = a.retryCount - b.retryCount;
      else if (sortField === "retryStatus") cmp = a.retryStatus.localeCompare(b.retryStatus);
      else cmp = new Date(a.failedAt).getTime() - new Date(b.failedAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [paymentFailures, search, statusFilter, sortField, sortDir]);

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
    filtered.map((p) => p.id),
    paginated.map((p) => p.id)
  );

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-payment-failures-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Reference", "Organization", "Amount USD", "Method", "Reason", "Attempts", "Status", "Failed At"],
      filtered.map((p, i) => [
        i + 1,
        p.refCode,
        p.orgName,
        p.amountUsd,
        p.methodSummary,
        p.failureReason,
        p.retryCount,
        p.retryStatus,
        p.failedAt,
      ])
    );
    toast.success(`Exported ${filtered.length} payment failure record(s).`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Failures"
        badge={`${unresolvedCount} Unresolved`}
        demoLabel="Simulated Payment Retries"
        description="Monitor failed subscription renewals, trigger safe gateway retries, and escalate repeated declines to Super Admin."
      />

      <DemoDataBanner
        title="Payment Failure -> Escalation"
        description="Payment retries are simulated locally without charging live cards. Unresolved declines can be escalated directly to Super Admin for grace-period or suspension review."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Awaiting Retry / Failed"
          value={unresolvedCount}
          sublabel="Requires follow-up or retry"
          icon={FileWarning}
          tone={unresolvedCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Escalated to Super Admin"
          value={escalatedCount}
          sublabel="Handed off for governance review"
          icon={ArrowUpRight}
          tone="rose"
        />
        <KpiCard
          label="Settled via Retry"
          value={recoveredCount}
          sublabel="Simulated successful retries"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search payment code, organization, or decline reason..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={filtered.length === 0}
          filters={
            <div className="w-52">
              <OpSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter retry status"
                options={[
                  { label: "All Failure States", value: "ALL" },
                  { label: "Scheduled", value: "Scheduled" },
                  { label: "Retried — Failed", value: "Retried — Failed" },
                  { label: "Escalated to Super Admin", value: "Escalated to Super Admin" },
                  { label: "Retried — Succeeded", value: "Retried — Succeeded" },
                ]}
              />
            </div>
          }
        />

        {paginated.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No payment failures match your filter"
            description="Adjust your search or status filter."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((p) => p.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="primary"
                  size="xs"
                  disabled={!canTriage}
                  onClick={() => {
                    const count = bulkRetryPaymentFailures(selectedIds);
                    if (count > 0) toast.success(`Simulated retry succeeded for ${count} payment(s).`);
                    else toast.info("Selected payments are already settled.");
                    setSelectedIds([]);
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Selected ({selectedIds.length})
                </OpButton>
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
                  {paginated.map((item, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(item.id);
                    return (
                      <tr key={item.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(item.id)}
                            aria-label={`Select ${item.refCode}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2 py-0.5 text-[11px] font-semibold">
                            {item.refCode}
                          </span>
                          <span className="block text-[10px] text-[var(--color-text-muted)] mt-1">
                            {item.retryCount} attempt(s)
                          </span>
                        </td>
                        <td className="py-3 px-3.5 min-w-[230px]">
                          <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-rose-500/15 text-[10px] font-bold text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
                              {getOrgInitials(item.orgName)}
                            </span>
                            <div>
                              <p className="font-semibold text-[var(--color-text-primary)]">
                                {item.orgName} — {item.methodSummary}
                              </p>
                              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                                {item.failureReason}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-bold tabular-nums">
                          {formatCurrency(item.amountUsd)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={item.retryStatus} tone={getStatusTone(item.retryStatus)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatDateTime(item.failedAt)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {item.retryStatus !== "Retried — Succeeded" && (
                              <OpButton
                                variant="primary"
                                size="xs"
                                disabled={!canTriage}
                                onClick={() => {
                                  retryPaymentFailure(item.id, true);
                                  toast.success(`Simulated retry succeeded for ${item.refCode} (${item.orgName}).`);
                                }}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Retry Charge (Sim)
                              </OpButton>
                            )}
                            {item.retryStatus !== "Escalated to Super Admin" &&
                              item.retryStatus !== "Retried — Succeeded" && (
                                <OpButton
                                  variant="danger"
                                  size="xs"
                                  disabled={!canTriage}
                                  onClick={() => setEscalateTarget(item)}
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                  Escalate
                                </OpButton>
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
        isOpen={Boolean(escalateTarget)}
        onClose={() => setEscalateTarget(null)}
        title="Escalate Payment Failure to Super Admin?"
        description={
          escalateTarget
            ? `Escalate ${escalateTarget.refCode} (${formatCurrency(escalateTarget.amountUsd)} for ${escalateTarget.orgName}) to Super Admin billing governance?`
            : ""
        }
        confirmLabel="Escalate Payment"
        variant="danger"
        onConfirm={() => {
          if (escalateTarget) {
            escalatePaymentFailure(escalateTarget.id);
            toast.success(`Escalated ${escalateTarget.refCode} to Super Admin.`);
          }
        }}
      />
    </div>
  );
}
