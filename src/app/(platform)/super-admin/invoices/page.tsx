"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  Ban,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileSearch,
  FileText,
  Mail,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Invoice, InvoiceStatus } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import {
  downloadInvoicePdf,
  exportRowsToCsv,
  formatCurrencyExact,
  formatShortDate,
  printInvoicePdf,
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
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getPlanBadgeTheme,
  getStatusTone,
} from "../_components/SuperAdminPrimitives";
import { InvoiceModal, InvoiceModalView } from "../_components/InvoiceModal";

interface DraftLineItem {
  description: string;
  quantity: string;
  unitPrice: string;
}

export default function SuperAdminInvoicesPage() {
  const invoices = useSuperAdminStore((s) => s.invoices);
  const organizations = useSuperAdminStore((s) => s.organizations);
  const plans = useSuperAdminStore((s) => s.plans);
  const subscriptions = useSuperAdminStore((s) => s.subscriptions);

  const generateInvoice = useSuperAdminStore((s) => s.generateInvoice);
  const updateInvoice = useSuperAdminStore((s) => s.updateInvoice);
  const deleteInvoice = useSuperAdminStore((s) => s.deleteInvoice);
  const markInvoicePaid = useSuperAdminStore((s) => s.markInvoicePaid);
  const voidInvoice = useSuperAdminStore((s) => s.voidInvoice);
  const sendInvoiceReminder = useSuperAdminStore((s) => s.sendInvoiceReminder);

  const { can } = useAdminPermissions();
  const canManage = can("invoices.manage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | InvoiceStatus>("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"issueDate" | "total">("issueDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [invoiceModalView, setInvoiceModalView] = useState<InvoiceModalView>("details");
  const [formOpen, setFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  // Unified Create / Edit Invoice form state
  const [orgId, setOrgId] = useState(organizations[0]?.id || "");
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]
  );
  const [taxRate, setTaxRate] = useState("0");
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>("OPEN");
  const [notes, setNotes] = useState("");
  const [markPaid, setMarkPaid] = useState(false);
  const [lineItems, setLineItems] = useState<DraftLineItem[]>([
    { description: "Enterprise Platform License", quantity: "1", unitPrice: "1299" },
  ]);

  const closeAllModals = () => {
    setSelectedInvoiceId(null);
    setFormOpen(false);
    setEditingInvoice(null);
    setDeleteTarget(null);
    setBulkDeleteOpen(false);
  };

  const openInvoiceModal = (id: string, view: InvoiceModalView = "details") => {
    closeAllModals();
    setInvoiceModalView(view);
    setSelectedInvoiceId(id);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setSearch(q);
  }, []);

  const stats = useMemo(() => {
    const paidTotal = invoices
      .filter((i) => i.status === "PAID")
      .reduce((s, i) => s + i.total, 0);
    const openInvoices = invoices.filter((i) => i.status === "OPEN");
    const overdueInvoices = invoices.filter((i) => i.status === "OVERDUE");
    const overdueTotal = overdueInvoices.reduce((s, i) => s + i.total, 0);
    const openTotal = openInvoices.reduce((s, i) => s + i.total, 0);
    return {
      paidTotal,
      paidCount: invoices.filter((i) => i.status === "PAID").length,
      openCount: openInvoices.length,
      openTotal,
      overdueCount: overdueInvoices.length,
      overdueTotal,
    };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((inv) => {
        const org = organizations.find((o) => o.id === inv.orgId);
        if (statusFilter !== "ALL" && inv.status !== statusFilter) return false;
        if (orgFilter !== "ALL" && inv.orgId !== orgFilter) return false;
        if (q) {
          const hit =
            inv.invoiceNumber.toLowerCase().includes(q) ||
            (org?.name || "").toLowerCase().includes(q) ||
            inv.lineItems.some((l) => l.description.toLowerCase().includes(q));
          if (!hit) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortBy === "total") return (a.total - b.total) * dir;
        return a.issueDate.localeCompare(b.issueDate) * dir;
      });
  }, [invoices, organizations, search, statusFilter, orgFilter, sortBy, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, orgFilter, sortBy, sortDir, pageSize]);

  useEffect(() => {
    const valid = new Set(invoices.map((i) => i.id));
    setSelectedIds((prev) => prev.filter((id) => valid.has(id)));
  }, [invoices]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allPageSelected =
    paginated.length > 0 && paginated.every((i) => selectedSet.has(i.id));
  const somePageSelected =
    paginated.some((i) => selectedSet.has(i.id)) && !allPageSelected;

  const toggleSelectPage = () => {
    const pageIds = paginated.map((i) => i.id);
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

  const draftSubtotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
    0
  );
  const draftTax = (draftSubtotal * (Number(taxRate) || 0)) / 100;
  const draftTotal = draftSubtotal + draftTax;

  const openCreateModal = () => {
    closeAllModals();
    setEditingInvoice(null);
    setOrgId(organizations[0]?.id || "");
    setDueDate(new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0]);
    setLineItems([{ description: "Platform Subscription & Seat Add-On", quantity: "1", unitPrice: "1299" }]);
    setTaxRate("0");
    setInvoiceStatus("OPEN");
    setNotes("");
    setMarkPaid(false);
    setFormOpen(true);
  };

  const openEditModal = (inv: Invoice) => {
    closeAllModals();
    setEditingInvoice(inv);
    setOrgId(inv.orgId);
    setDueDate(inv.dueDate);
    setTaxRate(String(inv.taxRate));
    setInvoiceStatus(inv.status);
    setNotes(inv.notes || "");
    setMarkPaid(inv.status === "PAID");
    setLineItems(
      inv.lineItems.map((li) => ({
        description: li.description,
        quantity: String(li.quantity),
        unitPrice: String(li.unitPrice),
      }))
    );
    setFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = lineItems.filter(
      (li) => li.description.trim() && Number(li.quantity) > 0 && Number(li.unitPrice) >= 0
    );
    if (validItems.length === 0) {
      toast.error("Add at least one valid line item with description and quantity > 0.");
      return;
    }

    const mappedItems = validItems.map((li) => ({
      description: li.description.trim(),
      quantity: Number(li.quantity),
      unitPrice: Number(li.unitPrice),
    }));

    if (editingInvoice) {
      updateInvoice(editingInvoice.id, {
        orgId,
        dueDate,
        taxRate: Math.max(0, Number(taxRate) || 0),
        status: invoiceStatus,
        notes: notes.trim() || undefined,
        lineItems: mappedItems,
      });
      toast.success(`Updated invoice ${editingInvoice.invoiceNumber}`);
      setFormOpen(false);
    } else {
      const sub = subscriptions.find((s) => s.orgId === orgId);
      const created = generateInvoice({
        orgId,
        subscriptionId: sub?.id,
        dueDate,
        taxRate: Math.max(0, Number(taxRate) || 0),
        lineItems: mappedItems,
        notes: notes.trim() || undefined,
        markPaidImmediately: markPaid,
      });
      toast.success(`Generated invoice ${created.invoiceNumber}`);
      setFormOpen(false);
      setSelectedInvoiceId(created.id);
    }
  };

  const handleBulkMarkPaid = () => {
    if (!canManage) {
      toast.error("Missing invoices.manage permission");
      return;
    }
    let count = 0;
    for (const id of selectedIds) {
      const inv = invoices.find((i) => i.id === id);
      if (inv && (inv.status === "OPEN" || inv.status === "OVERDUE")) {
        markInvoicePaid(id, "CARD");
        count++;
      }
    }
    if (count === 0) toast.info("No open or overdue invoices in selection.");
    else {
      toast.success(`Marked ${count} invoice${count === 1 ? "" : "s"} as PAID`);
      setSelectedIds([]);
    }
  };

  const handleBulkSendReminders = () => {
    if (!canManage) {
      toast.error("Missing invoices.manage permission");
      return;
    }
    let sent = 0;
    for (const id of selectedIds) {
      const inv = invoices.find((i) => i.id === id);
      if (inv && (inv.status === "OPEN" || inv.status === "OVERDUE")) {
        const res = sendInvoiceReminder(id);
        if (res.ok) sent++;
      }
    }
    if (sent === 0) toast.info("No open or overdue invoices selected for reminders.");
    else {
      toast.success(`Sent ${sent} simulated invoice reminder${sent === 1 ? "" : "s"}`);
      setSelectedIds([]);
    }
  };

  const handleBulkVoid = () => {
    if (!canManage) {
      toast.error("Missing invoices.manage permission");
      return;
    }
    let count = 0;
    for (const id of selectedIds) {
      const inv = invoices.find((i) => i.id === id);
      if (inv && inv.status !== "VOID") {
        voidInvoice(id);
        count++;
      }
    }
    if (count === 0) toast.info("Selected invoices are already void.");
    else {
      toast.warning(`Voided ${count} invoice${count === 1 ? "" : "s"}`);
      setSelectedIds([]);
    }
  };

  const handleBulkExport = () => {
    if (!can("system.export")) {
      toast.error("Missing system.export permission");
      return;
    }
    const targets = invoices.filter((i) => selectedSet.has(i.id));
    exportRowsToCsv(
      "prowise-invoices-selected.csv",
      ["Sr. No.", "Invoice #", "Organization", "Issue Date", "Due Date", "Subtotal", "Tax", "Total", "Status"],
      targets.map((inv, idx) => [
        idx + 1,
        inv.invoiceNumber,
        organizations.find((o) => o.id === inv.orgId)?.name || inv.orgId,
        inv.issueDate,
        inv.dueDate,
        inv.subtotal,
        inv.taxAmount,
        inv.total,
        inv.status,
      ])
    );
    toast.success(`Exported ${targets.length} selected invoice${targets.length === 1 ? "" : "s"}`);
  };

  const handleConfirmBulkDelete = () => {
    const count = selectedIds.length;
    for (const id of selectedIds) {
      deleteInvoice(id);
    }
    toast.success(`Deleted ${count} invoice${count === 1 ? "" : "s"}`);
    setSelectedIds([]);
    setBulkDeleteOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Invoices"
        description="Generate and edit itemized commercial invoices, track payment settlement, send SMTP reminders, and download PDF receipts."
        simulationLabel="Client-Side PDF Generator"
        actions={
          <AdminButton
            variant="primary"
            size="sm"
            permissionLocked={!canManage}
            onClick={openCreateModal}
          >
            <Plus className="w-3.5 h-3.5" />
            Generate Invoice
          </AdminButton>
        }
      />

      <SimulationNotice
        title="Client-Side PDF & Simulated Reminders"
        description="Clicking PDF generates a valid downloadable .pdf invoice binary directly in the browser. Reminders log to the simulated SMTP dispatch log."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Total Paid" value={formatCurrencyExact(stats.paidTotal)} sublabel={`${stats.paidCount} settled invoices`} icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Open Invoices" value={formatCurrencyExact(stats.openTotal)} sublabel={`${stats.openCount} awaiting payment`} icon={FileText} tone="blue" />
        <KpiCard label="Overdue Balance" value={formatCurrencyExact(stats.overdueTotal)} sublabel={`${stats.overdueCount} past due date`} icon={AlertCircle} tone={stats.overdueCount > 0 ? "rose" : "slate"} />
        <KpiCard label="Total Ledger" value={invoices.length} sublabel="Linked to subscriptions & payments" icon={Download} tone="violet" />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search invoice #, org, or line item..."
            hasActiveFilters={Boolean(search || statusFilter !== "ALL" || orgFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setStatusFilter("ALL");
              setOrgFilter("ALL");
            }}
            onExportCsv={() => {
              if (!can("system.export")) {
                toast.error("Missing system.export permission");
                return;
              }
              exportRowsToCsv(
                "prowise-invoices.csv",
                ["Sr. No.", "Invoice #", "Organization", "Issue Date", "Due Date", "Subtotal", "Tax", "Total", "Status"],
                filtered.map((inv, idx) => [
                  idx + 1,
                  inv.invoiceNumber,
                  organizations.find((o) => o.id === inv.orgId)?.name || inv.orgId,
                  inv.issueDate,
                  inv.dueDate,
                  inv.subtotal,
                  inv.taxAmount,
                  inv.total,
                  inv.status,
                ])
              );
              toast.success("Exported invoices CSV");
            }}
            exportDisabled={!can("system.export") || filtered.length === 0}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "ALL" | InvoiceStatus)}
                  aria-label="Filter invoice status"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PAID">Paid</option>
                  <option value="OPEN">Open</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="REFUNDED">Refunded</option>
                  <option value="VOID">Void</option>
                </select>
                <select
                  value={orgFilter}
                  onChange={(e) => setOrgFilter(e.target.value)}
                  aria-label="Filter by organization"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Organizations</option>
                  {organizations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        </div>

        <BulkSelectionBar
          selectedCount={selectedIds.length}
          totalFilteredCount={filtered.length}
          onSelectAllMatching={() => setSelectedIds(filtered.map((i) => i.id))}
          onClear={() => setSelectedIds([])}
          actions={
            <>
              <AdminButton
                variant="subtle"
                size="xs"
                permissionLocked={!canManage}
                onClick={handleBulkMarkPaid}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark Paid
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canManage}
                onClick={handleBulkSendReminders}
              >
                <Mail className="w-3.5 h-3.5" />
                Send Reminders
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canManage}
                onClick={handleBulkVoid}
              >
                <Ban className="w-3.5 h-3.5" />
                Void
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
            icon={FileText}
            title="No matching invoices"
            description="Adjust filters or generate a new invoice for an organization."
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
                      aria-label="Select all invoices on this page"
                      className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 w-16 whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3 hidden md:table-cell">
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("issueDate");
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      }}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Issued / Due <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSortBy("total");
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      }}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)]"
                    >
                      Total <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {paginated.map((inv, idx) => {
                  const org = organizations.find((o) => o.id === inv.orgId);
                  const plan = org ? plans.find((p) => p.id === org.planId) : undefined;
                  const planTheme = getPlanBadgeTheme(plan);
                  const serialNumber = (safePage - 1) * pageSize + idx + 1;
                  const isSelected = selectedSet.has(inv.id);

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-[var(--color-hover)] transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(inv.id)}
                          aria-label={`Select invoice ${inv.invoiceNumber}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 transition-colors"
                        >
                          {inv.invoiceNumber}
                        </button>
                        <div className="text-[11px] text-[var(--color-text-muted)] mt-1">
                          {inv.lineItems.length} line item{inv.lineItems.length > 1 ? "s" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-8 w-8 rounded-full border flex items-center justify-center font-bold text-[11px] shrink-0 ${planTheme.avatar}`}
                          >
                            {getOrgInitials(org?.name || inv.orgId)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--color-text-primary)] truncate">
                              {org?.name || inv.orgId}
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
                      <td className="px-4 py-3 hidden md:table-cell text-[var(--color-text-secondary)]">
                        <div>Issued {formatShortDate(inv.issueDate)}</div>
                        <div
                          className={`text-[10px] ${
                            inv.status === "OVERDUE"
                              ? "font-semibold text-rose-600 dark:text-rose-400"
                              : "text-[var(--color-text-muted)]"
                          }`}
                        >
                          Due {formatShortDate(inv.dueDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-bold tabular-nums ${
                            inv.status === "PAID"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : inv.status === "OVERDUE"
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-[var(--color-text-primary)]"
                          }`}
                        >
                          {formatCurrencyExact(inv.total)}
                        </span>
                        {inv.taxRate > 0 && (
                          <span className="block text-[10px] text-[var(--color-text-muted)]">
                            incl. {inv.taxRate}% tax
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={inv.status} tone={getStatusTone(inv.status)} dot />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
                          {/* 1. Inspect Invoice Details */}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            onClick={() => openInvoiceModal(inv.id, "details")}
                            title="Inspect invoice details"
                            aria-label="Inspect invoice"
                            className="h-7 w-7 p-0 text-[var(--color-text-muted)] hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </AdminButton>

                          {/* 2. Preview PDF */}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            onClick={() => openInvoiceModal(inv.id, "preview")}
                            title="Preview PDF"
                            aria-label="Preview PDF"
                            className="h-7 w-7 p-0 text-[var(--color-text-muted)] hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-500/10"
                          >
                            <FileSearch className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          </AdminButton>

                          {/* 3. Print Invoice */}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              printInvoicePdf(inv, org, plan?.name);
                              toast.info(`Opened Print / Save as PDF for ${inv.invoiceNumber}`);
                            }}
                            title="Print in PDF"
                            aria-label="Print invoice"
                            className="h-7 w-7 p-0 text-[var(--color-text-muted)] hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-500/10"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </AdminButton>

                          {/* 4. Edit Invoice */}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canManage}
                            onClick={() => openEditModal(inv)}
                            title={canManage ? "Edit invoice" : "Permission required to edit"}
                            aria-label="Edit invoice"
                            className="h-7 w-7 p-0 text-[var(--color-text-muted)] hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </AdminButton>

                          {/* 5. Download PDF */}
                          <AdminButton
                            variant="outline"
                            size="xs"
                            onClick={() => {
                              downloadInvoicePdf(inv, org, plan?.name);
                              toast.success(`Downloaded ${inv.invoiceNumber}.pdf`);
                            }}
                            title="Download PDF"
                            aria-label="Download PDF"
                            className="h-7 px-2 font-medium border-[var(--color-border)] hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/5 transition-colors gap-1 text-[11px]"
                          >
                            <Download className="w-3 h-3 text-[var(--color-text-muted)]" />
                            <span>PDF</span>
                          </AdminButton>

                          {/* 6. Send Reminder Email (Active when OPEN/OVERDUE, muted placeholder when PAID) */}
                          {inv.status === "OPEN" || inv.status === "OVERDUE" ? (
                            <AdminButton
                              variant="ghost"
                              size="xs"
                              permissionLocked={!canManage}
                              onClick={() => {
                                const res = sendInvoiceReminder(inv.id);
                                if (res.ok) toast.success(`Sent simulated reminder to ${org?.ownerEmail}`);
                                else toast.error(res.error);
                              }}
                              title="Send reminder email"
                              aria-label="Send reminder email"
                              className="h-7 w-7 p-0 text-[var(--color-text-muted)] hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-500/10"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </AdminButton>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="Invoice already paid — reminder disabled"
                              aria-label="Reminder disabled (paid)"
                              className="h-7 w-7 p-0 inline-flex items-center justify-center rounded-md text-[var(--color-text-muted)]/30 cursor-not-allowed select-none"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* 7. Mark Paid / Status Badge (Exact same w-[84px] width across all rows to prevent shifting) */}
                          {inv.status === "OPEN" || inv.status === "OVERDUE" ? (
                            <AdminButton
                              variant="subtle"
                              size="xs"
                              permissionLocked={!canManage}
                              onClick={() => {
                                markInvoicePaid(inv.id, "CARD");
                                toast.success(`Marked ${inv.invoiceNumber} as PAID`);
                              }}
                              title="Mark invoice as paid"
                              aria-label="Mark invoice as paid"
                              className="h-7 w-[84px] px-2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 justify-center transition-colors"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600 dark:text-emerald-400" />
                              <span>Mark Paid</span>
                            </AdminButton>
                          ) : (
                            <span
                              title={inv.status === "PAID" ? "Invoice already settled" : `Status: ${inv.status}`}
                              className="inline-flex items-center justify-center h-7 w-[84px] px-2 text-[11px] font-semibold text-emerald-600/80 dark:text-emerald-400/80 bg-emerald-500/10 border border-emerald-500/20 rounded-md select-none"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-500" />
                              <span>Paid</span>
                            </span>
                          )}

                          {/* 8. Delete Invoice */}
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canManage}
                            className="h-7 w-7 p-0 text-rose-600/80 dark:text-rose-400/80 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            onClick={() => {
                              closeAllModals();
                              setDeleteTarget(inv);
                            }}
                            title={canManage ? "Delete invoice" : "Permission required to delete"}
                            aria-label="Delete invoice"
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

      {/* Generate / Edit Invoice Modal */}
      <AdminModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          editingInvoice
            ? `Edit Invoice — ${editingInvoice.invoiceNumber}`
            : "Generate Commercial Invoice"
        }
        description={
          editingInvoice
            ? "Modify line items, due date, tax rate, billing status, or notes."
            : "Creates an itemized invoice linked to an organization and optional simulated settlement."
        }
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveForm} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AdminSelect
              label="Organization"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              options={organizations.map((o) => ({ label: o.name, value: o.id }))}
            />
            <AdminInput
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
            <AdminInput
              label="Tax Rate (%)"
              type="number"
              min="0"
              max="40"
              step="0.5"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </div>

          {editingInvoice && (
            <AdminSelect
              label="Invoice Status"
              value={invoiceStatus}
              onChange={(e) => setInvoiceStatus(e.target.value as InvoiceStatus)}
              options={[
                { label: "Open", value: "OPEN" },
                { label: "Paid", value: "PAID" },
                { label: "Overdue", value: "OVERDUE" },
                { label: "Refunded", value: "REFUNDED" },
                { label: "Void", value: "VOID" },
              ]}
            />
          )}

          {/* Line Items Builder */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">Line Items</span>
              <AdminButton
                type="button"
                variant="outline"
                size="xs"
                onClick={() =>
                  setLineItems([...lineItems, { description: "", quantity: "1", unitPrice: "250" }])
                }
              >
                <Plus className="w-3 h-3" /> Add Line
              </AdminButton>
            </div>
            <div className="space-y-2">
              {lineItems.map((li, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-6">
                    <AdminInput
                      placeholder="Item description"
                      value={li.description}
                      onChange={(e) =>
                        setLineItems(
                          lineItems.map((item, i) =>
                            i === idx ? { ...item, description: e.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <AdminInput
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={li.quantity}
                      onChange={(e) =>
                        setLineItems(
                          lineItems.map((item, i) =>
                            i === idx ? { ...item, quantity: e.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <AdminInput
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Unit Price"
                      value={li.unitPrice}
                      onChange={(e) =>
                        setLineItems(
                          lineItems.map((item, i) =>
                            i === idx ? { ...item, unitPrice: e.target.value } : item
                          )
                        )
                      }
                    />
                  </div>
                  <div className="sm:col-span-1 flex justify-end">
                    <button
                      type="button"
                      disabled={lineItems.length <= 1}
                      onClick={() => setLineItems(lineItems.filter((_, i) => i !== idx))}
                      className="rounded-lg p-2 text-[var(--color-text-muted)] hover:text-rose-500 disabled:opacity-30"
                      aria-label="Remove line item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-end text-xs pt-2 border-t border-[var(--color-border)] space-y-1">
              <span className="text-[var(--color-text-secondary)]">
                Subtotal: <strong>{formatCurrencyExact(draftSubtotal)}</strong>
              </span>
              <span className="text-[var(--color-text-secondary)]">
                Tax: <strong>{formatCurrencyExact(draftTax)}</strong>
              </span>
              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                Total: {formatCurrencyExact(draftTotal)} USD
              </span>
            </div>
          </div>

          <AdminTextarea
            label="Invoice Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="PO reference, wire instructions, or tax exemption note..."
          />

          {!editingInvoice && (
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-primary)] cursor-pointer">
              <input
                type="checkbox"
                checked={markPaid}
                onChange={(e) => setMarkPaid(e.target.checked)}
                className="accent-blue-600"
              />
              Record simulated payment immediately (marks invoice PAID)
            </label>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary">
              {editingInvoice ? "Save Invoice Changes" : "Generate Invoice"}
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Single & Bulk Delete Modals */}
      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete invoice ${deleteTarget?.invoiceNumber || ""}?`}
        description="Removes this invoice record from the local billing ledger."
        confirmLabel="Delete Invoice"
        variant="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteInvoice(deleteTarget.id);
          toast.success(`Deleted invoice ${deleteTarget.invoiceNumber}`);
        }}
      />

      <ConfirmActionModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.length} selected invoice${selectedIds.length === 1 ? "" : "s"}?`}
        description="Selected invoices will be permanently removed from the local console."
        confirmLabel="Delete Selected"
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
      />

      <InvoiceModal
        invoiceId={selectedInvoiceId}
        initialView={invoiceModalView}
        onClose={() => setSelectedInvoiceId(null)}
      />
    </div>
  );
}
