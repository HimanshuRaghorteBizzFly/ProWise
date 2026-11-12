"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpDown,
  Ban,
  CheckCircle2,
  CreditCard,
  Download,
  Edit3,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { BillingCycle, Subscription, SubscriptionStatus } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import {
  exportRowsToCsv,
  formatCurrency,
  formatShortDate,
} from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  BulkSelectionBar,
  ConfirmActionModal,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getCycleBadgeClass,
  getOrgInitials,
  getPlanBadgeTheme,
  getStatusTone,
} from "../_components/SuperAdminPrimitives";

type SubSortKey = "org" | "amount" | "currentPeriodEnd" | "status";

export default function SuperAdminSubscriptionsPage() {
  const subscriptions = useSuperAdminStore((s) => s.subscriptions);
  const organizations = useSuperAdminStore((s) => s.organizations);
  const plans = useSuperAdminStore((s) => s.plans);

  const assignSubscription = useSuperAdminStore((s) => s.assignSubscription);
  const updateSubscription = useSuperAdminStore((s) => s.updateSubscription);
  const deleteSubscription = useSuperAdminStore((s) => s.deleteSubscription);
  const changeSubscriptionPlan = useSuperAdminStore((s) => s.changeSubscriptionPlan);
  const renewSubscription = useSuperAdminStore((s) => s.renewSubscription);
  const toggleAutoRenew = useSuperAdminStore((s) => s.toggleAutoRenew);
  const cancelSubscription = useSuperAdminStore((s) => s.cancelSubscription);
  const reactivateSubscription = useSuperAdminStore((s) => s.reactivateSubscription);

  const { can } = useAdminPermissions();
  const canManage = can("subscriptions.manage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SubscriptionStatus>("ALL");
  const [cycleFilter, setCycleFilter] = useState<"ALL" | BillingCycle>("ALL");
  const [sortBy, setSortBy] = useState<SubSortKey>("currentPeriodEnd");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Assign modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignOrgId, setAssignOrgId] = useState(organizations[0]?.id || "");
  const [assignPlanId, setAssignPlanId] = useState(
    plans.find((p) => p.code === "PROFESSIONAL")?.id || plans[0]?.id || ""
  );
  const [assignCycle, setAssignCycle] = useState<BillingCycle>("MONTHLY");
  const [assignSeats, setAssignSeats] = useState("50");
  const [assignAutoRenew, setAssignAutoRenew] = useState(true);
  const [assignMethod, setAssignMethod] = useState("Stripe Visa •••• 4242");

  // Full Edit modal
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [editPlanId, setEditPlanId] = useState("");
  const [editCycle, setEditCycle] = useState<BillingCycle>("MONTHLY");
  const [editAmount, setEditAmount] = useState("0");
  const [editSeats, setEditSeats] = useState("10");
  const [editStatus, setEditStatus] = useState<SubscriptionStatus>("ACTIVE");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editMethod, setEditMethod] = useState("");
  const [editAutoRenew, setEditAutoRenew] = useState(true);
  const [editCancelAtEnd, setEditCancelAtEnd] = useState(false);

  // Upgrade / Downgrade modal
  const [changeSub, setChangeSub] = useState<Subscription | null>(null);
  const [nextPlanId, setNextPlanId] = useState("");
  const [nextCycle, setNextCycle] = useState<BillingCycle>("MONTHLY");

  // Cancel & Delete modals
  const [cancelTarget, setCancelTarget] = useState<Subscription | null>(null);
  const [cancelImmediate, setCancelImmediate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Subscription | null>(null);

  const closeAllModals = () => {
    setAssignModalOpen(false);
    setEditingSub(null);
    setChangeSub(null);
    setCancelTarget(null);
    setDeleteTarget(null);
    setBulkDeleteOpen(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscriptions
      .filter((sub) => {
        const org = organizations.find((o) => o.id === sub.orgId);
        const plan = plans.find((p) => p.id === sub.planId);
        if (statusFilter !== "ALL" && sub.status !== statusFilter) return false;
        if (cycleFilter !== "ALL" && sub.billingCycle !== cycleFilter) return false;
        if (q) {
          const hit =
            (org?.name || "").toLowerCase().includes(q) ||
            (org?.slug || "").toLowerCase().includes(q) ||
            (plan?.name || "").toLowerCase().includes(q) ||
            sub.paymentMethodLabel.toLowerCase().includes(q);
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortBy === "amount") return (a.amount - b.amount) * dir;
        if (sortBy === "status") return a.status.localeCompare(b.status) * dir;
        if (sortBy === "org") {
          const nameA = organizations.find((o) => o.id === a.orgId)?.name || a.orgId;
          const nameB = organizations.find((o) => o.id === b.orgId)?.name || b.orgId;
          return nameA.localeCompare(nameB) * dir;
        }
        return a.currentPeriodEnd.localeCompare(b.currentPeriodEnd) * dir;
      });
  }, [subscriptions, organizations, plans, search, statusFilter, cycleFilter, sortBy, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, cycleFilter, sortBy, sortDir, pageSize]);

  useEffect(() => {
    const valid = new Set(subscriptions.map((s) => s.id));
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)));
  }, [subscriptions]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allPageSelected =
    paginated.length > 0 && paginated.every((item) => selectedSet.has(item.id));
  const somePageSelected =
    paginated.some((item) => selectedSet.has(item.id)) && !allPageSelected;

  const toggleSelectPage = () => {
    const pageIds = paginated.map((s) => s.id);
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSort = (key: SubSortKey) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir(key === "amount" ? "desc" : "asc");
    }
  };

  const openChangePlan = (sub: Subscription) => {
    closeAllModals();
    setChangeSub(sub);
    setNextPlanId(sub.planId);
    setNextCycle(sub.billingCycle);
  };

  const openEditModal = (sub: Subscription) => {
    closeAllModals();
    setEditingSub(sub);
    setEditPlanId(sub.planId);
    setEditCycle(sub.billingCycle);
    setEditAmount(String(sub.amount));
    setEditSeats(String(sub.seats));
    setEditStatus(sub.status);
    setEditStart(sub.currentPeriodStart);
    setEditEnd(sub.currentPeriodEnd);
    setEditMethod(sub.paymentMethodLabel);
    setEditAutoRenew(sub.autoRenew);
    setEditCancelAtEnd(sub.cancelAtPeriodEnd);
  };

  const handleEditPlanOrCycleSync = (planIdValue: string, cycleValue: BillingCycle) => {
    const matchedPlan = plans.find((p) => p.id === planIdValue);
    if (matchedPlan) {
      const rate = cycleValue === "ANNUAL" ? matchedPlan.annualPrice : matchedPlan.monthlyPrice;
      setEditAmount(String(rate));
      setEditSeats(String(matchedPlan.limits.maxSeats));
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSub) return;
    const amt = Math.max(0, Number(editAmount) || 0);
    const seats = Math.max(1, Number(editSeats) || 1);
    updateSubscription(editingSub.id, {
      planId: editPlanId,
      billingCycle: editCycle,
      amount: amt,
      seats,
      status: editStatus,
      currentPeriodStart: editStart,
      currentPeriodEnd: editEnd,
      paymentMethodLabel: editMethod.trim() || "Stripe Card (Simulated)",
      autoRenew: editAutoRenew,
      cancelAtPeriodEnd: editCancelAtEnd,
    });
    const orgName = organizations.find((o) => o.id === editingSub.orgId)?.name || "organization";
    toast.success(`Saved subscription changes for ${orgName}`);
    setEditingSub(null);
  };

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = assignSubscription({
      orgId: assignOrgId,
      planId: assignPlanId,
      billingCycle: assignCycle,
      seats: Math.max(1, Number(assignSeats) || 1),
      autoRenew: assignAutoRenew,
      paymentMethodLabel: assignMethod.trim() || "Stripe Card (Simulated)",
    });
    if (!res.ok) {
      toast.error(res.error || "Failed to assign subscription");
      return;
    }
    toast.success("Subscription assigned & synced with organization and billing ledger");
    setAssignModalOpen(false);
  };

  const handleBulkActivate = () => {
    if (!canManage) {
      toast.error("Missing subscriptions.manage permission");
      return;
    }
    let count = 0;
    for (const id of selectedIds) {
      const sub = subscriptions.find((s) => s.id === id);
      if (sub && sub.status !== "ACTIVE") {
        reactivateSubscription(id);
        count++;
      }
    }
    if (count === 0) toast.info("Selected subscriptions are already active.");
    else {
      toast.success(`Activated ${count} subscription${count === 1 ? "" : "s"}`);
      setSelectedIds([]);
    }
  };

  const handleBulkRenew = () => {
    if (!canManage) {
      toast.error("Missing subscriptions.manage permission");
      return;
    }
    for (const id of selectedIds) {
      renewSubscription(id);
    }
    toast.success(`Renewed ${selectedIds.length} subscription${selectedIds.length === 1 ? "" : "s"}`);
    setSelectedIds([]);
  };

  const handleBulkExport = () => {
    if (!can("system.export")) {
      toast.error("Missing system.export permission");
      return;
    }
    const targets = subscriptions.filter((s) => selectedSet.has(s.id));
    exportRowsToCsv(
      "prowise-subscriptions-selected.csv",
      ["Sr. No.", "Organization", "Plan", "Cycle", "Amount", "Seats", "Status", "Auto-Renew", "Period End"],
      targets.map((s, idx) => [
        idx + 1,
        organizations.find((o) => o.id === s.orgId)?.name || s.orgId,
        plans.find((p) => p.id === s.planId)?.name || s.planId,
        s.billingCycle,
        s.amount,
        s.seats,
        s.status,
        s.autoRenew ? "Yes" : "No",
        s.currentPeriodEnd,
      ])
    );
    toast.success(`Exported ${targets.length} selected subscription${targets.length === 1 ? "" : "s"}`);
  };

  const handleConfirmBulkDelete = () => {
    const count = selectedIds.length;
    for (const id of selectedIds) {
      deleteSubscription(id);
    }
    toast.success(`Deleted ${count} subscription${count === 1 ? "" : "s"}`);
    setSelectedIds([]);
    setBulkDeleteOpen(false);
  };

  const activeCount = subscriptions.filter((s) => s.status === "ACTIVE").length;
  const pastDueCount = subscriptions.filter((s) => s.status === "PAST_DUE").length;
  const trialCount = subscriptions.filter((s) => s.status === "TRIALING").length;
  const annualContracts = subscriptions.filter(
    (s) => s.billingCycle === "ANNUAL" && s.status === "ACTIVE"
  ).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Subscriptions"
        description="Assign plans, edit billing schedules and seat allocations, process upgrades or renewals, and manage contracts."
        simulationLabel="Simulated Subscription Engine"
        actions={
          <AdminButton
            variant="primary"
            size="sm"
            permissionLocked={!canManage}
            onClick={() => {
              closeAllModals();
              setAssignOrgId(organizations[0]?.id || "");
              setAssignPlanId(plans.find((p) => p.status === "ACTIVE")?.id || "");
              setAssignModalOpen(true);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Assign Subscription
          </AdminButton>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Active Contracts" value={activeCount} sublabel={`${annualContracts} annual commitments`} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Trialing" value={trialCount} sublabel="Evaluating ProWise tiers" icon={CreditCard} tone="blue" />
        <KpiCard label="Past Due" value={pastDueCount} sublabel="Dunning / retry pending" icon={Ban} tone="rose" />
        <KpiCard label="Total Subscriptions" value={subscriptions.length} sublabel="Synced with Organizations" icon={RefreshCw} tone="violet" />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search organization, plan, or payment method..."
            hasActiveFilters={Boolean(search || statusFilter !== "ALL" || cycleFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setStatusFilter("ALL");
              setCycleFilter("ALL");
            }}
            onExportCsv={() => {
              if (!can("system.export")) {
                toast.error("Missing system.export permission");
                return;
              }
              exportRowsToCsv(
                "prowise-subscriptions.csv",
                ["Sr. No.", "Organization", "Plan", "Cycle", "Amount", "Seats", "Status", "Auto-Renew", "Period End"],
                filtered.map((s, idx) => [
                  idx + 1,
                  organizations.find((o) => o.id === s.orgId)?.name || s.orgId,
                  plans.find((p) => p.id === s.planId)?.name || s.planId,
                  s.billingCycle,
                  s.amount,
                  s.seats,
                  s.status,
                  s.autoRenew ? "Yes" : "No",
                  s.currentPeriodEnd,
                ])
              );
              toast.success("Exported subscriptions CSV");
            }}
            exportDisabled={!can("system.export") || filtered.length === 0}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "ALL" | SubscriptionStatus)}
                  aria-label="Filter subscription status"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="TRIALING">Trialing</option>
                  <option value="PAST_DUE">Past Due</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
                <select
                  value={cycleFilter}
                  onChange={(e) => setCycleFilter(e.target.value as "ALL" | BillingCycle)}
                  aria-label="Filter billing cycle"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Cycles</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </div>
            }
          />
        </div>

        <BulkSelectionBar
          selectedCount={selectedIds.length}
          totalFilteredCount={filtered.length}
          onSelectAllMatching={() => setSelectedIds(filtered.map((s) => s.id))}
          onClear={() => setSelectedIds([])}
          actions={
            <>
              <AdminButton
                variant="subtle"
                size="xs"
                permissionLocked={!canManage}
                onClick={handleBulkActivate}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Activate
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canManage}
                onClick={handleBulkRenew}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Renew Selected
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
                permissionLocked={!canManage}
                onClick={() => {
                  closeAllModals();
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
            title="No subscriptions found"
            description="Assign a plan to a tenant organization or adjust filters."
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
                      aria-label="Select all subscriptions on this page"
                      className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 w-16 whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("org")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Organization <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">Plan &amp; Cycle</th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("amount")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Contract Amount <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden md:table-cell">
                    <button
                      type="button"
                      onClick={() => toggleSort("currentPeriodEnd")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Period End <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Status <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3 hidden lg:table-cell">Auto-Renew</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {paginated.map((sub, idx) => {
                  const org = organizations.find((o) => o.id === sub.orgId);
                  const plan = plans.find((p) => p.id === sub.planId);
                  const planTheme = getPlanBadgeTheme(plan);
                  const serialNumber = (safePage - 1) * pageSize + idx + 1;
                  const isSelected = selectedSet.has(sub.id);

                  return (
                    <tr
                      key={sub.id}
                      className={`hover:bg-[var(--color-hover)] transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(sub.id)}
                          aria-label={`Select subscription for ${org?.name || sub.orgId}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-[11px] shrink-0 ${planTheme.avatar}`}
                          >
                            {getOrgInitials(org?.name || sub.orgId)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--color-text-primary)] truncate">
                              {org?.name || sub.orgId}
                            </div>
                            <div className="text-[11px] text-[var(--color-text-muted)] truncate">
                              {sub.seats} seats • {sub.paymentMethodLabel}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${planTheme.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${planTheme.dot}`} />
                            {plan?.name || sub.planId}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${getCycleBadgeClass(
                              sub.billingCycle
                            )}`}
                          >
                            {sub.billingCycle}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-bold tabular-nums ${
                            sub.amount > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          {formatCurrency(sub.amount)}
                        </span>
                        <span className="block text-[10px] text-[var(--color-text-muted)]">
                          /{sub.billingCycle === "ANNUAL" ? "year" : "mo"}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-[var(--color-text-secondary)]">
                        {formatShortDate(sub.currentPeriodEnd)}
                        {sub.cancelAtPeriodEnd && (
                          <span className="block text-[10px] text-amber-600 dark:text-amber-300 font-medium">
                            Cancels at renewal
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={sub.status} tone={getStatusTone(sub.status)} dot />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <button
                          type="button"
                          disabled={!canManage || sub.status === "CANCELLED"}
                          onClick={() => {
                            toggleAutoRenew(sub.id);
                            toast.info(`Updated auto-renew for ${org?.name}`);
                          }}
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                            sub.autoRenew
                              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                              : "border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-muted)]"
                          }`}
                        >
                          {sub.autoRenew ? "Enabled" : "Off"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canManage}
                            onClick={() => openEditModal(sub)}
                            title="Edit subscription"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span className="hidden xl:inline">Edit</span>
                          </AdminButton>
                          <AdminButton
                            variant="outline"
                            size="xs"
                            permissionLocked={!canManage}
                            onClick={() => openChangePlan(sub)}
                            title="Upgrade or downgrade plan"
                          >
                            <ArrowLeftRight className="w-3 h-3" />
                            <span className="hidden xl:inline">Plan</span>
                          </AdminButton>
                          {sub.status === "CANCELLED" ? (
                            <AdminButton
                              variant="subtle"
                              size="xs"
                              permissionLocked={!canManage}
                              onClick={() => {
                                reactivateSubscription(sub.id);
                                toast.success(`Reactivated subscription for ${org?.name}`);
                              }}
                            >
                              <RotateCcw className="w-3 h-3" />
                              Reactivate
                            </AdminButton>
                          ) : (
                            <>
                              <AdminButton
                                variant="ghost"
                                size="xs"
                                permissionLocked={!canManage}
                                onClick={() => {
                                  renewSubscription(sub.id);
                                  toast.success(`Renewed subscription for ${org?.name} & generated invoice`);
                                }}
                                title="Renew subscription now"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </AdminButton>
                              <AdminButton
                                variant="ghost"
                                size="xs"
                                permissionLocked={!canManage}
                                className="text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                                onClick={() => {
                                  closeAllModals();
                                  setCancelTarget(sub);
                                  setCancelImmediate(false);
                                }}
                                title="Cancel subscription"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </AdminButton>
                            </>
                          )}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canManage}
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            onClick={() => {
                              closeAllModals();
                              setDeleteTarget(sub);
                            }}
                            title="Delete subscription"
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

      {/* Edit Subscription Modal */}
      <AdminModal
        isOpen={Boolean(editingSub)}
        onClose={() => setEditingSub(null)}
        title={`Edit Subscription — ${
          editingSub ? organizations.find((o) => o.id === editingSub.orgId)?.name || editingSub.orgId : ""
        }`}
        description="Update contracted plan tier, billing cycle, custom rate, seats, renewal dates, and status."
        maxWidth="xl"
      >
        {editingSub && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdminSelect
                label="Assigned Plan Tier"
                value={editPlanId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setEditPlanId(nextId);
                  handleEditPlanOrCycleSync(nextId, editCycle);
                }}
                options={plans.map((p) => ({
                  label: `${p.name} ($${p.monthlyPrice}/mo | $${p.annualPrice}/yr)`,
                  value: p.id,
                }))}
              />
              <AdminSelect
                label="Billing Cycle"
                value={editCycle}
                onChange={(e) => {
                  const next = e.target.value as BillingCycle;
                  setEditCycle(next);
                  handleEditPlanOrCycleSync(editPlanId, next);
                }}
                options={[
                  { label: "Monthly", value: "MONTHLY" },
                  { label: "Annual", value: "ANNUAL" },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <AdminInput
                label="Contract Amount (USD)"
                type="number"
                min={0}
                step="0.01"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
              />
              <AdminInput
                label="Contracted Seats"
                type="number"
                min={1}
                value={editSeats}
                onChange={(e) => setEditSeats(e.target.value)}
              />
              <AdminSelect
                label="Subscription Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as SubscriptionStatus)}
                options={[
                  { label: "Active", value: "ACTIVE" },
                  { label: "Trialing", value: "TRIALING" },
                  { label: "Past Due", value: "PAST_DUE" },
                  { label: "Cancelled", value: "CANCELLED" },
                ]}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdminInput
                label="Current Period Start"
                type="date"
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
              />
              <AdminInput
                label="Current Period End"
                type="date"
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
              />
            </div>

            <AdminInput
              label="Payment Method Label"
              value={editMethod}
              onChange={(e) => setEditMethod(e.target.value)}
              placeholder="Stripe Visa •••• 4242"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs text-[var(--color-text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editAutoRenew}
                  onChange={(e) => setEditAutoRenew(e.target.checked)}
                  className="accent-blue-600"
                />
                Enable Automatic Renewal
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 text-xs text-[var(--color-text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={editCancelAtEnd}
                  onChange={(e) => setEditCancelAtEnd(e.target.checked)}
                  className="accent-amber-600"
                />
                Scheduled Cancel at Renewal
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton type="button" variant="outline" onClick={() => setEditingSub(null)}>
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="primary">
                Save Subscription Changes
              </AdminButton>
            </div>
          </form>
        )}
      </AdminModal>

      {/* Assign Subscription Modal */}
      <AdminModal
        isOpen={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Commercial Plan"
        description="Assigns or replaces an organization's subscription, updates seat limits, and generates a billing invoice."
        maxWidth="md"
      >
        <form onSubmit={handleAssignSubmit} className="space-y-4">
          <AdminSelect
            label="Target Organization"
            value={assignOrgId}
            onChange={(e) => setAssignOrgId(e.target.value)}
            options={organizations.map((o) => ({
              label: `${o.name} (${o.status})`,
              value: o.id,
            }))}
          />
          <AdminSelect
            label="Plan Tier"
            value={assignPlanId}
            onChange={(e) => setAssignPlanId(e.target.value)}
            options={plans
              .filter((p) => p.status === "ACTIVE")
              .map((p) => ({
                label: `${p.name} ($${p.monthlyPrice}/mo | $${p.annualPrice}/yr)`,
                value: p.id,
              }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <AdminSelect
              label="Billing Cycle"
              value={assignCycle}
              onChange={(e) => setAssignCycle(e.target.value as BillingCycle)}
              options={[
                { label: "Monthly", value: "MONTHLY" },
                { label: "Annual", value: "ANNUAL" },
              ]}
            />
            <AdminInput
              label="Contracted Seats"
              type="number"
              min={1}
              value={assignSeats}
              onChange={(e) => setAssignSeats(e.target.value)}
            />
          </div>
          <AdminInput
            label="Payment Method Label"
            value={assignMethod}
            onChange={(e) => setAssignMethod(e.target.value)}
          />
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={assignAutoRenew}
              onChange={(e) => setAssignAutoRenew(e.target.checked)}
              className="accent-blue-600"
            />
            Enable automatic renewal at cycle end
          </label>
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" onClick={() => setAssignModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary">
              Assign Plan
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Upgrade / Downgrade Modal */}
      <AdminModal
        isOpen={Boolean(changeSub)}
        onClose={() => setChangeSub(null)}
        title="Upgrade or Downgrade Subscription"
        description={
          changeSub
            ? `Adjusting plan for ${organizations.find((o) => o.id === changeSub.orgId)?.name || changeSub.orgId}`
            : undefined
        }
        maxWidth="md"
      >
        {changeSub && (() => {
          const currentPlan = plans.find((p) => p.id === changeSub.planId);
          const candidatePlan = plans.find((p) => p.id === nextPlanId);
          const newPrice = candidatePlan
            ? nextCycle === "ANNUAL"
              ? candidatePlan.annualPrice
              : candidatePlan.monthlyPrice
            : 0;
          const delta = newPrice - changeSub.amount;

          return (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs">
                <span className="text-[var(--color-text-muted)]">Current Tier: </span>
                <strong className="text-[var(--color-text-primary)]">
                  {currentPlan?.name} ({changeSub.billingCycle}) — {formatCurrency(changeSub.amount)}
                </strong>
              </div>

              <AdminSelect
                label="New Plan Tier"
                value={nextPlanId}
                onChange={(e) => setNextPlanId(e.target.value)}
                options={plans
                  .filter((p) => p.status === "ACTIVE")
                  .map((p) => ({
                    label: `${p.name} ($${p.monthlyPrice}/mo | $${p.annualPrice}/yr)`,
                    value: p.id,
                  }))}
              />

              <AdminSelect
                label="Billing Cycle"
                value={nextCycle}
                onChange={(e) => setNextCycle(e.target.value as BillingCycle)}
                options={[
                  { label: "Monthly", value: "MONTHLY" },
                  { label: "Annual", value: "ANNUAL" },
                ]}
              />

              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">New Cycle Rate</span>
                  <strong className="text-[var(--color-text-primary)]">{formatCurrency(newPrice)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">Immediate Difference</span>
                  <strong className={delta >= 0 ? "text-emerald-500" : "text-amber-500"}>
                    {delta >= 0 ? `+${formatCurrency(delta)} (proration invoice)` : `${formatCurrency(delta)} (credit at renewal)`}
                  </strong>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
                <AdminButton variant="outline" onClick={() => setChangeSub(null)}>
                  Cancel
                </AdminButton>
                <AdminButton
                  variant="primary"
                  onClick={() => {
                    changeSubscriptionPlan(changeSub.id, nextPlanId, nextCycle);
                    toast.success("Updated subscription tier and synced organization limits");
                    setChangeSub(null);
                  }}
                >
                  Apply Plan Change
                </AdminButton>
              </div>
            </div>
          );
        })()}
      </AdminModal>

      {/* Cancel Subscription Modal */}
      <AdminModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancel Subscription"
        description={
          cancelTarget
            ? `Choose cancellation timing for ${organizations.find((o) => o.id === cancelTarget.orgId)?.name}`
            : undefined
        }
        maxWidth="sm"
      >
        {cancelTarget && (
          <div className="space-y-4 text-xs">
            <label className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 cursor-pointer">
              <input
                type="radio"
                checked={!cancelImmediate}
                onChange={() => setCancelImmediate(false)}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <span className="font-semibold text-[var(--color-text-primary)] block">
                  Cancel at Period End ({formatShortDate(cancelTarget.currentPeriodEnd)})
                </span>
                <span className="text-[var(--color-text-secondary)]">
                  Disables auto-renewal while preserving workspace access until cycle completion.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 cursor-pointer">
              <input
                type="radio"
                checked={cancelImmediate}
                onChange={() => setCancelImmediate(true)}
                className="mt-0.5 accent-rose-600"
              />
              <div>
                <span className="font-semibold text-rose-700 dark:text-rose-300 block">
                  Cancel Immediately
                </span>
                <span className="text-rose-600 dark:text-rose-300/90">
                  Marks contract CANCELLED immediately and zeroes active MRR contribution.
                </span>
              </div>
            </label>

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <AdminButton variant="outline" size="sm" onClick={() => setCancelTarget(null)}>
                Keep Active
              </AdminButton>
              <AdminButton
                variant="danger"
                size="sm"
                onClick={() => {
                  cancelSubscription(cancelTarget.id, cancelImmediate);
                  toast.warning(
                    cancelImmediate
                      ? "Subscription cancelled immediately"
                      : "Subscription scheduled for end-of-period cancellation"
                  );
                  setCancelTarget(null);
                }}
              >
                Confirm Cancellation
              </AdminButton>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Single & Bulk Delete Modals */}
      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete subscription for ${
          deleteTarget ? organizations.find((o) => o.id === deleteTarget.orgId)?.name || deleteTarget.orgId : ""
        }?`}
        description="Removes this subscription record from the local billing ledger."
        confirmLabel="Delete Subscription"
        variant="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteSubscription(deleteTarget.id);
          toast.success("Deleted subscription record");
        }}
      />

      <ConfirmActionModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.length} selected subscription${selectedIds.length === 1 ? "" : "s"}?`}
        description="Selected subscription records will be permanently removed from the local console."
        confirmLabel="Delete Selected"
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
      />
    </div>
  );
}
