"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Download,
  Edit3,
  Eye,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PaymentMethodType, PaymentStatus, PaymentTransaction } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import {
  exportRowsToCsv,
  formatCurrencyExact,
  formatDateTime,
} from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  BulkSelectionBar,
  ConfirmActionModal,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  SimulationNotice,
  SlideOverDrawer,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getPaymentMethodBadgeClass,
  getPlanBadgeTheme,
  getStatusTone,
} from "../_components/SuperAdminPrimitives";
import { ComparisonBarChart } from "../_components/SuperAdminCharts";
import { InvoiceModal } from "../_components/InvoiceModal";

export default function SuperAdminPaymentsPage() {
  const payments = useSuperAdminStore((s) => s.payments);
  const organizations = useSuperAdminStore((s) => s.organizations);
  const plans = useSuperAdminStore((s) => s.plans);
  const subscriptions = useSuperAdminStore((s) => s.subscriptions);

  const recordSimulatedPayment = useSuperAdminStore((s) => s.recordSimulatedPayment);
  const updatePayment = useSuperAdminStore((s) => s.updatePayment);
  const deletePayment = useSuperAdminStore((s) => s.deletePayment);
  const retryFailedPayment = useSuperAdminStore((s) => s.retryFailedPayment);
  const refundPayment = useSuperAdminStore((s) => s.refundPayment);

  const { can } = useAdminPermissions();
  const canRefund = can("payments.refund");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | PaymentStatus>("ALL");
  const [methodFilter, setMethodFilter] = useState<"ALL" | PaymentMethodType>("ALL");
  const [sortBy, setSortBy] = useState<"createdAt" | "amount">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Record Charge modal
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeOrgId, setChargeOrgId] = useState(organizations[0]?.id || "");
  const [chargeAmount, setChargeAmount] = useState("1299");
  const [chargeMethod, setChargeMethod] = useState<PaymentMethodType>("CARD");
  const [chargeLast4, setChargeLast4] = useState("4242");
  const [chargeDesc, setChargeDesc] = useState("Manual Enterprise Add-on Settlement");

  // Edit Transaction modal
  const [editingPayment, setEditingPayment] = useState<PaymentTransaction | null>(null);
  const [editOrgId, setEditOrgId] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editMethod, setEditMethod] = useState<PaymentMethodType>("CARD");
  const [editLast4, setEditLast4] = useState("");
  const [editStatus, setEditStatus] = useState<PaymentStatus>("SUCCEEDED");
  const [editGateway, setEditGateway] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editFailureReason, setEditFailureReason] = useState("");

  // Refund, Inspect & Delete states
  const [refundTarget, setRefundTarget] = useState<PaymentTransaction | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundError, setRefundError] = useState("");
  const [inspectPayment, setInspectPayment] = useState<PaymentTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentTransaction | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const closeAllPanels = () => {
    setChargeOpen(false);
    setEditingPayment(null);
    setRefundTarget(null);
    setInspectPayment(null);
    setDeleteTarget(null);
    setBulkDeleteOpen(false);
    setSelectedInvoiceId(null);
  };

  const analytics = useMemo(() => {
    const grossSucceeded = payments
      .filter((p) => p.status !== "FAILED" && p.status !== "PENDING")
      .reduce((s, p) => s + p.amount, 0);
    const totalRefunded = payments.reduce((s, p) => s + p.refundedAmount, 0);
    const netRevenue = grossSucceeded - totalRefunded;
    const failedCount = payments.filter((p) => p.status === "FAILED").length;
    const successRate =
      payments.length > 0
        ? (((payments.length - failedCount) / payments.length) * 100).toFixed(1)
        : "100.0";

    const byMethod: Record<PaymentMethodType, number> = { CARD: 0, ACH: 0, WIRE: 0 };
    payments.forEach((p) => {
      if (p.status !== "FAILED") byMethod[p.method] += p.amount - p.refundedAmount;
    });

    const monthlySeries = [
      { label: "Jul", primary: 14200, secondary: 0 },
      { label: "Aug", primary: 19800, secondary: 0 },
      { label: "Sep", primary: 26400, secondary: 499 },
      { label: "Oct", primary: 56288, secondary: 450 },
      {
        label: "Nov",
        primary: Math.max(
          12000,
          payments
            .filter((p) => p.createdAt.startsWith("2026-11") && p.status !== "FAILED")
            .reduce((s, p) => s + p.amount, 0)
        ),
        secondary: payments
          .filter((p) => p.createdAt.startsWith("2026-11"))
          .reduce((s, p) => s + p.refundedAmount, 0),
      },
    ];

    return { grossSucceeded, totalRefunded, netRevenue, failedCount, successRate, byMethod, monthlySeries };
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments
      .filter((p) => {
        const org = organizations.find((o) => o.id === p.orgId);
        if (statusFilter !== "ALL" && p.status !== statusFilter) return false;
        if (methodFilter !== "ALL" && p.method !== methodFilter) return false;
        if (q) {
          const hit =
            p.transactionRef.toLowerCase().includes(q) ||
            (org?.name || "").toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortBy === "amount") return (a.amount - b.amount) * dir;
        return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      });
  }, [payments, organizations, search, statusFilter, methodFilter, sortBy, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, methodFilter, sortBy, sortDir, pageSize]);

  useEffect(() => {
    const valid = new Set(payments.map((p) => p.id));
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)));
  }, [payments]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allPageSelected =
    paginated.length > 0 && paginated.every((p) => selectedSet.has(p.id));
  const somePageSelected =
    paginated.some((p) => selectedSet.has(p.id)) && !allPageSelected;

  const toggleSelectPage = () => {
    const pageIds = paginated.map((p) => p.id);
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleRecordCharge = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(chargeAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid charge amount greater than $0.");
      return;
    }
    const sub = subscriptions.find((s) => s.orgId === chargeOrgId);
    const txn = recordSimulatedPayment({
      orgId: chargeOrgId,
      subscriptionId: sub?.id,
      amount: amt,
      method: chargeMethod,
      methodLast4: chargeLast4.slice(0, 4) || "4242",
      description: chargeDesc.trim() || "Manual Simulated Charge",
    });
    toast.success(`Recorded simulated payment ${txn.transactionRef}`);
    setChargeOpen(false);
  };

  const openEditModal = (p: PaymentTransaction) => {
    closeAllPanels();
    setEditingPayment(p);
    setEditOrgId(p.orgId);
    setEditAmount(String(p.amount));
    setEditMethod(p.method);
    setEditLast4(p.methodLast4);
    setEditStatus(p.status);
    setEditGateway(p.gatewayLabel);
    setEditDesc(p.description);
    setEditFailureReason(p.failureReason || "");
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    const amt = Number(editAmount);
    if (Number.isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid transaction amount greater than $0.");
      return;
    }
    updatePayment(editingPayment.id, {
      orgId: editOrgId,
      amount: amt,
      method: editMethod,
      methodLast4: editLast4.slice(0, 4) || "4242",
      status: editStatus,
      gatewayLabel: editGateway.trim() || editingPayment.gatewayLabel,
      description: editDesc.trim() || editingPayment.description,
      failureReason: editStatus === "FAILED" ? editFailureReason.trim() || undefined : undefined,
    });
    toast.success(`Saved changes to ${editingPayment.transactionRef}`);
    setEditingPayment(null);
  };

  const openRefundModal = (p: PaymentTransaction) => {
    closeAllPanels();
    const remaining = Number((p.amount - p.refundedAmount).toFixed(2));
    setRefundTarget(p);
    setRefundAmount(String(remaining));
    setRefundReason("");
    setRefundError("");
  };

  const handleRefundSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTarget) return;
    const amt = Number(refundAmount);
    if (!refundReason.trim() || refundReason.trim().length < 4) {
      setRefundError("Please provide a brief reason for audit compliance.");
      return;
    }
    const res = refundPayment(refundTarget.id, amt, refundReason.trim());
    if (!res.ok) {
      setRefundError(res.error || "Invalid refund");
      return;
    }
    toast.warning(`Issued simulated $${amt.toFixed(2)} refund on ${refundTarget.transactionRef}`);
    setRefundTarget(null);
  };

  const handleBulkRetry = () => {
    if (!canRefund) {
      toast.error("Missing payments.refund permission");
      return;
    }
    let retried = 0;
    for (const id of selectedIds) {
      const p = payments.find((item) => item.id === id);
      if (p && p.status === "FAILED") {
        const res = retryFailedPayment(id);
        if (res.ok) retried++;
      }
    }
    if (retried === 0) toast.info("No failed charges found in your selection.");
    else {
      toast.success(`Retried and settled ${retried} transaction${retried === 1 ? "" : "s"}`);
      setSelectedIds([]);
    }
  };

  const handleBulkMarkSucceeded = () => {
    if (!canRefund) {
      toast.error("Missing payments.refund permission");
      return;
    }
    let updated = 0;
    for (const id of selectedIds) {
      const p = payments.find((item) => item.id === id);
      if (p && (p.status === "PENDING" || p.status === "FAILED")) {
        updatePayment(id, { status: "SUCCEEDED", failureReason: undefined });
        updated++;
      }
    }
    if (updated === 0) toast.info("Selected transactions are already settled.");
    else {
      toast.success(`Marked ${updated} transaction${updated === 1 ? "" : "s"} as SUCCEEDED`);
      setSelectedIds([]);
    }
  };

  const handleBulkExport = () => {
    if (!can("system.export")) {
      toast.error("Missing system.export permission");
      return;
    }
    const targets = payments.filter((p) => selectedSet.has(p.id));
    exportRowsToCsv(
      "prowise-payments-selected.csv",
      ["Sr. No.", "Reference", "Organization", "Amount", "Refunded", "Method", "Status", "Date"],
      targets.map((p, idx) => [
        idx + 1,
        p.transactionRef,
        organizations.find((o) => o.id === p.orgId)?.name || p.orgId,
        p.amount,
        p.refundedAmount,
        `${p.method} •••• ${p.methodLast4}`,
        p.status,
        p.createdAt,
      ])
    );
    toast.success(`Exported ${targets.length} selected transaction${targets.length === 1 ? "" : "s"}`);
  };

  const handleConfirmBulkDelete = () => {
    const count = selectedIds.length;
    for (const id of selectedIds) {
      deletePayment(id);
    }
    toast.success(`Deleted ${count} transaction${count === 1 ? "" : "s"}`);
    setSelectedIds([]);
    setBulkDeleteOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Billing & Payments"
        description="Monitor simulated card, ACH, and wire settlements, edit transaction records, retry failed charges, issue refunds, and inspect analytics."
        simulationLabel="Simulated Payment Gateway"
        actions={
          <AdminButton
            variant="primary"
            size="sm"
            permissionLocked={!canRefund}
            onClick={() => {
              closeAllPanels();
              setChargeOrgId(organizations[0]?.id || "");
              setChargeOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Record Charge
          </AdminButton>
        }
      />

      <SimulationNotice
        title="Simulated Payment Processing"
        description="Charges, edits, retries, and refunds update local ledger state and linked invoices without calling live Stripe or banking APIs."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Net Collected" value={formatCurrencyExact(analytics.netRevenue)} sublabel="Gross minus refunds" icon={DollarSign} tone="emerald" />
        <KpiCard label="Total Refunded" value={formatCurrencyExact(analytics.totalRefunded)} sublabel="Full & partial refunds" icon={RotateCcw} tone="amber" />
        <KpiCard label="Auth Success Rate" value={`${analytics.successRate}%`} sublabel={`${payments.length} processed txns`} icon={CheckCircle2} tone="blue" />
        <KpiCard label="Failed Charges" value={analytics.failedCount} sublabel="Ready for retry" icon={AlertTriangle} tone={analytics.failedCount > 0 ? "rose" : "slate"} />
      </div>

      {/* Revenue Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        <SurfaceCard className="lg:col-span-8 p-4 sm:p-5">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Collected Volume vs Refunds
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Monthly settlement throughput across all payment rails
            </p>
          </div>
          <ComparisonBarChart
            data={analytics.monthlySeries}
            primaryLabel="Gross Collected"
            secondaryLabel="Refunded"
            primaryColor="#10B981"
            secondaryColor="#F43F5E"
            isCurrency
            height={225}
          />
        </SurfaceCard>

        <SurfaceCard className="lg:col-span-4 p-4 sm:p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Settlement Mix by Method
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Net collected revenue per payment rail
            </p>
          </div>
          <div className="space-y-3">
            {(
              [
                { label: "Credit / Corporate Card", key: "CARD", color: "bg-blue-500" },
                { label: "ACH Bank Direct", key: "ACH", color: "bg-emerald-500" },
                { label: "Enterprise Wire", key: "WIRE", color: "bg-violet-500" },
              ] as const
            ).map((item) => {
              const val = analytics.byMethod[item.key];
              const pct = analytics.netRevenue > 0 ? Math.round((val / analytics.netRevenue) * 100) : 0;
              return (
                <div key={item.key} className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--color-text-primary)]">{item.label}</span>
                    <span className="text-[var(--color-text-secondary)]">
                      {formatCurrencyExact(val)} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--color-elevated)] overflow-hidden">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      </div>

      {/* Transactions Table */}
      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search transaction ref, organization, or memo..."
            hasActiveFilters={Boolean(search || statusFilter !== "ALL" || methodFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setStatusFilter("ALL");
              setMethodFilter("ALL");
            }}
            onExportCsv={() => {
              if (!can("system.export")) {
                toast.error("Missing system.export permission");
                return;
              }
              exportRowsToCsv(
                "prowise-payments.csv",
                ["Sr. No.", "Reference", "Organization", "Amount", "Refunded", "Method", "Status", "Date"],
                filtered.map((p, idx) => [
                  idx + 1,
                  p.transactionRef,
                  organizations.find((o) => o.id === p.orgId)?.name || p.orgId,
                  p.amount,
                  p.refundedAmount,
                  `${p.method} •••• ${p.methodLast4}`,
                  p.status,
                  p.createdAt,
                ])
              );
              toast.success("Exported payment transactions CSV");
            }}
            exportDisabled={!can("system.export") || filtered.length === 0}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "ALL" | PaymentStatus)}
                  aria-label="Filter payment status"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SUCCEEDED">Succeeded</option>
                  <option value="FAILED">Failed</option>
                  <option value="PARTIALLY_REFUNDED">Partially Refunded</option>
                  <option value="REFUNDED">Refunded</option>
                  <option value="PENDING">Pending</option>
                </select>
                <select
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value as "ALL" | PaymentMethodType)}
                  aria-label="Filter payment method"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Methods</option>
                  <option value="CARD">Card</option>
                  <option value="ACH">ACH</option>
                  <option value="WIRE">Wire</option>
                </select>
              </div>
            }
          />
        </div>

        <BulkSelectionBar
          selectedCount={selectedIds.length}
          totalFilteredCount={filtered.length}
          onSelectAllMatching={() => setSelectedIds(filtered.map((p) => p.id))}
          onClear={() => setSelectedIds([])}
          actions={
            <>
              <AdminButton
                variant="subtle"
                size="xs"
                permissionLocked={!canRefund}
                onClick={handleBulkRetry}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Failed
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canRefund}
                onClick={handleBulkMarkSucceeded}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark Succeeded
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!can("system.export")}
                onClick={handleBulkExport}
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </AdminButton>
              <AdminButton
                variant="danger"
                size="xs"
                permissionLocked={!canRefund}
                onClick={() => {
                  closeAllPanels();
                  setBulkDeleteOpen(true);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </AdminButton>
            </>
          }
        />

        {paginated.length === 0 ? (
          <EmptyStateView
            icon={CreditCard}
            title="No payment transactions match"
            description="Adjust filters or record a simulated charge."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected;
                      }}
                      onChange={toggleSelectPage}
                      aria-label="Select all transactions on this page"
                      className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 w-16 whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3">Transaction</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("amount");
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      }}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Amount <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden md:table-cell">Method</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 hidden lg:table-cell">
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("createdAt");
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      }}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Timestamp <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {paginated.map((p, idx) => {
                  const org = organizations.find((o) => o.id === p.orgId);
                  const plan = org ? plans.find((pl) => pl.id === org.planId) : undefined;
                  const planTheme = getPlanBadgeTheme(plan);
                  const serialNumber = (safePage - 1) * pageSize + idx + 1;
                  const isSelected = selectedSet.has(p.id);
                  const canIssueRefund =
                    (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED") &&
                    p.amount - p.refundedAmount > 0;

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[var(--color-hover)] transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(p.id)}
                          aria-label={`Select transaction ${p.transactionRef}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            closeAllPanels();
                            setInspectPayment(p);
                          }}
                          className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                        >
                          {p.transactionRef}
                        </button>
                        <div className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[200px] mt-1">
                          {p.description}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-[11px] shrink-0 ${planTheme.avatar}`}
                          >
                            {getOrgInitials(org?.name || p.orgId)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--color-text-primary)] truncate">
                              {org?.name || p.orgId}
                            </div>
                            {plan && (
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.2 text-[10px] font-semibold mt-0.5 ${planTheme.badge}`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${planTheme.dot}`} />
                                {plan.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className={`font-bold tabular-nums ${
                            p.status === "FAILED"
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {formatCurrencyExact(p.amount)}
                        </div>
                        {p.refundedAmount > 0 && (
                          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-300">
                            -{formatCurrencyExact(p.refundedAmount)} refunded
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${getPaymentMethodBadgeClass(
                            p.method
                          )}`}
                        >
                          {p.method} •••• {p.methodLast4}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={p.status.replace("_", " ")} tone={getStatusTone(p.status)} dot />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-text-muted)] whitespace-nowrap">
                        {formatDateTime(p.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              closeAllPanels();
                              setInspectPayment(p);
                            }}
                            title="View transaction receipt"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </AdminButton>
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canRefund}
                            onClick={() => openEditModal(p)}
                            title="Edit transaction"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </AdminButton>
                          {p.status === "FAILED" && (
                            <AdminButton
                              variant="subtle"
                              size="xs"
                              permissionLocked={!canRefund}
                              onClick={() => {
                                const res = retryFailedPayment(p.id);
                                if (res.ok) toast.success(res.message);
                                else toast.error(res.message);
                              }}
                            >
                              <RefreshCw className="w-3 h-3" />
                              Retry
                            </AdminButton>
                          )}
                          {canIssueRefund && (
                            <AdminButton
                              variant="outline"
                              size="xs"
                              permissionLocked={!canRefund}
                              onClick={() => openRefundModal(p)}
                            >
                              <RotateCcw className="w-3 h-3" />
                              Refund
                            </AdminButton>
                          )}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canRefund}
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            onClick={() => {
                              closeAllPanels();
                              setDeleteTarget(p);
                            }}
                            title="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </AdminButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </SurfaceCard>

      {/* Edit Payment Modal */}
      <AdminModal
        isOpen={Boolean(editingPayment)}
        onClose={() => setEditingPayment(null)}
        title={`Edit Transaction — ${editingPayment?.transactionRef || ""}`}
        description="Modify payment method, settlement amount, ledger status, memo, or gateway reference."
        maxWidth="lg"
      >
        {editingPayment && (
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdminSelect
                label="Organization"
                value={editOrgId}
                onChange={(e) => setEditOrgId(e.target.value)}
                options={organizations.map((o) => ({ label: o.name, value: o.id }))}
              />
              <AdminSelect
                label="Settlement Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as PaymentStatus)}
                options={[
                  { label: "Succeeded", value: "SUCCEEDED" },
                  { label: "Pending", value: "PENDING" },
                  { label: "Failed", value: "FAILED" },
                  { label: "Partially Refunded", value: "PARTIALLY_REFUNDED" },
                  { label: "Refunded", value: "REFUNDED" },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <AdminInput
                label="Amount (USD)"
                type="number"
                step="0.01"
                min="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
              <AdminSelect
                label="Method"
                value={editMethod}
                onChange={(e) => setEditMethod(e.target.value as PaymentMethodType)}
                options={[
                  { label: "Card", value: "CARD" },
                  { label: "ACH", value: "ACH" },
                  { label: "Wire", value: "WIRE" },
                ]}
              />
              <AdminInput
                label="Last 4 Digits"
                maxLength={4}
                value={editLast4}
                onChange={(e) => setEditLast4(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdminInput
                label="Gateway Label"
                value={editGateway}
                onChange={(e) => setEditGateway(e.target.value)}
              />
              <AdminInput
                label="Memo / Description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
              />
            </div>

            {editStatus === "FAILED" && (
              <AdminInput
                label="Failure Reason"
                value={editFailureReason}
                onChange={(e) => setEditFailureReason(e.target.value)}
                placeholder="e.g. Insufficient funds or expired card..."
              />
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton type="button" variant="outline" onClick={() => setEditingPayment(null)}>
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="primary">
                Save Transaction Changes
              </AdminButton>
            </div>
          </form>
        )}
      </AdminModal>

      {/* Record Charge Modal */}
      <AdminModal
        isOpen={chargeOpen}
        onClose={() => setChargeOpen(false)}
        title="Record Simulated Charge"
        description="Simulates a payment transaction in the platform ledger."
        maxWidth="md"
      >
        <form onSubmit={handleRecordCharge} className="space-y-4">
          <AdminSelect
            label="Organization"
            value={chargeOrgId}
            onChange={(e) => setChargeOrgId(e.target.value)}
            options={organizations.map((o) => ({ label: o.name, value: o.id }))}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AdminInput
              label="Amount (USD)"
              type="number"
              step="0.01"
              min="0.50"
              value={chargeAmount}
              onChange={(e) => setChargeAmount(e.target.value)}
            />
            <AdminSelect
              label="Method"
              value={chargeMethod}
              onChange={(e) => setChargeMethod(e.target.value as PaymentMethodType)}
              options={[
                { label: "Card", value: "CARD" },
                { label: "ACH", value: "ACH" },
                { label: "Wire", value: "WIRE" },
              ]}
            />
            <AdminInput
              label="Last 4 Digits"
              maxLength={4}
              value={chargeLast4}
              onChange={(e) => setChargeLast4(e.target.value)}
            />
          </div>
          <AdminInput
            label="Description"
            value={chargeDesc}
            onChange={(e) => setChargeDesc(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" onClick={() => setChargeOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary">
              Record Simulated Payment
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Refund Modal */}
      <AdminModal
        isOpen={Boolean(refundTarget)}
        onClose={() => setRefundTarget(null)}
        title={`Issue Refund — ${refundTarget?.transactionRef || ""}`}
        description="Supports full or partial refunds. Linked invoice updates automatically on full refund."
        maxWidth="sm"
      >
        {refundTarget && (
          <form onSubmit={handleRefundSubmit} className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Original Charge</span>
                <strong>{formatCurrencyExact(refundTarget.amount)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">Max Refundable</span>
                <strong className="text-emerald-500">
                  {formatCurrencyExact(refundTarget.amount - refundTarget.refundedAmount)}
                </strong>
              </div>
            </div>
            <AdminInput
              label="Refund Amount (USD)"
              type="number"
              step="0.01"
              min="0.01"
              max={refundTarget.amount - refundTarget.refundedAmount}
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
            />
            <AdminTextarea
              label="Refund Reason (Required)"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="e.g. Prorated credit for duplicate seat upgrade..."
              error={refundError}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <AdminButton type="button" variant="outline" onClick={() => setRefundTarget(null)}>
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="danger">
                Issue Simulated Refund
              </AdminButton>
            </div>
          </form>
        )}
      </AdminModal>

      {/* Receipt Drawer */}
      <SlideOverDrawer
        isOpen={Boolean(inspectPayment)}
        onClose={() => setInspectPayment(null)}
        title={inspectPayment?.transactionRef || ""}
        subtitle={inspectPayment?.gatewayLabel}
      >
        {inspectPayment && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrencyExact(inspectPayment.amount)}
                </span>
                <StatusBadge
                  label={inspectPayment.status}
                  tone={getStatusTone(inspectPayment.status)}
                  dot
                />
              </div>
              <p className="text-[var(--color-text-secondary)]">{inspectPayment.description}</p>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--color-border)]">
                <div>
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Organization</span>
                  <p className="font-semibold text-[var(--color-text-primary)] mt-0.5">
                    {organizations.find((o) => o.id === inspectPayment.orgId)?.name}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Method</span>
                  <p className="font-semibold text-[var(--color-text-primary)] mt-0.5">
                    {inspectPayment.method} •••• {inspectPayment.methodLast4}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Refunded</span>
                  <p className="font-semibold text-[var(--color-text-primary)] mt-0.5">
                    {formatCurrencyExact(inspectPayment.refundedAmount)}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Timestamp</span>
                  <p className="font-semibold text-[var(--color-text-primary)] mt-0.5">
                    {formatDateTime(inspectPayment.createdAt)}
                  </p>
                </div>
              </div>
              {inspectPayment.failureReason && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-rose-700 dark:text-rose-300">
                  <strong>Failure Reason: </strong>
                  {inspectPayment.failureReason}
                </div>
              )}
              {inspectPayment.refundReason && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-800 dark:text-amber-200">
                  <strong>Refund Note: </strong>
                  {inspectPayment.refundReason}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <AdminButton
                variant="primary"
                size="sm"
                className="w-full"
                permissionLocked={!canRefund}
                onClick={() => openEditModal(inspectPayment)}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Transaction Details
              </AdminButton>
              {inspectPayment.invoiceId && (
                <AdminButton
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    const invId = inspectPayment.invoiceId!;
                    setInspectPayment(null);
                    setSelectedInvoiceId(invId);
                  }}
                >
                  View Linked Invoice
                </AdminButton>
              )}
            </div>
          </div>
        )}
      </SlideOverDrawer>

      {/* Single & Bulk Delete Confirmation */}
      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete transaction ${deleteTarget?.transactionRef || ""}?`}
        description="Removes this simulated transaction entry from the local payment ledger."
        confirmLabel="Delete Transaction"
        variant="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          deletePayment(deleteTarget.id);
          toast.success(`Deleted transaction ${deleteTarget.transactionRef}`);
        }}
      />

      <ConfirmActionModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.length} selected transaction${selectedIds.length === 1 ? "" : "s"}?`}
        description="Selected transactions will be permanently deleted from the local ledger."
        confirmLabel="Delete Selected"
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
      />

      <InvoiceModal invoiceId={selectedInvoiceId} onClose={() => setSelectedInvoiceId(null)} />
    </div>
  );
}
