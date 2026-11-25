"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  LifeBuoy,
  MessageSquare,
  Plus,
  Send,
} from "lucide-react";
import type { OpsSupportTicket, TicketPriority, TicketStatus } from "@/types/admin-operations";
import { useOperatorPermissions } from "../_services/operator-access";
import { operatorApi } from "../_services/operator-api";
import { exportRowsToCsv, formatDateTime } from "../_services/operator-service";
import {
  MutationNotice,
  NOT_AVAILABLE,
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  humanizeCode,
  operatorChoices,
  readyValue,
  rowsOf,
  useOperatorDirectory,
  useOperatorMutation,
  useOperatorResource,
} from "../_components/OperatorLive";
import {
  BulkSelectionBar,
  DemoDataBanner,
  FilterBar,
  KpiCard,
  OpButton,
  OpInput,
  OpModal,
  OpSelect,
  OpTextarea,
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

type TicketSortField = "ticketNumber" | "orgName" | "priority" | "status" | "slaMinutesRemaining" | "updatedAt";

const STATUS_OPTIONS: { label: string; value: TicketStatus }[] = [
  { label: "Open", value: "OPEN" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Waiting on Customer", value: "WAITING_CUSTOMER" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Closed", value: "CLOSED" },
];

const PRIORITY_OPTIONS: { label: string; value: TicketPriority }[] = [
  { label: "Urgent", value: "URGENT" },
  { label: "High", value: "HIGH" },
  { label: "Medium", value: "MEDIUM" },
  { label: "Low", value: "LOW" },
];

/** Category is not stored by the server; kept for the (disabled) create form. */
const CATEGORY_OPTIONS = [
  { label: "Integration", value: "Integration" },
  { label: "Workspace Access", value: "Workspace Access" },
  { label: "Billing & Invoices", value: "Billing & Invoices" },
  { label: "Performance", value: "Performance" },
  { label: "General", value: "General" },
];

const isClosed = (t: OpsSupportTicket) => ["RESOLVED", "CLOSED"].includes((t.status || "").toUpperCase());
const orgOf = (t: OpsSupportTicket) => t.customer_name || "—";
const ownerOf = (t: OpsSupportTicket) => t.assigned_operator_name || "Unassigned";
const updatedOf = (t: OpsSupportTicket) => t.updated_at ?? t.created_at ?? "";

function priorityTone(priority: string): "danger" | "warning" | "info" {
  const p = (priority || "").toUpperCase();
  if (p === "URGENT") return "danger";
  if (p === "HIGH") return "warning";
  return "info";
}

export default function OperatorSupportTicketsPage() {
  const { can } = useOperatorPermissions();
  const canManage = can("tickets.manage");

  const ticketsResource = useOperatorResource(() => operatorApi.tickets.list(), "tickets");
  const tickets = rowsOf(ticketsResource.state);
  const directory = useOperatorDirectory();
  const operatorOptions = operatorChoices(directory.state);
  const reload = () => void ticketsResource.reload();
  const mutation = useOperatorMutation(reload);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [sortField, setSortField] = useState<TicketSortField>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Create Modal: kept on the page; there is no create endpoint so it never opens.
  const [createOpen, setCreateOpen] = useState(false);

  // Inspect Drawer (record re-read from the latest list so its version is current)
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const closeOverlays = () => {
    setCreateOpen(false);
    setSelectedId(null);
  };

  const selectedTicket = useMemo(() => tickets.find((t) => t.id === selectedId) || null, [tickets, selectedId]);

  const activeTickets = useMemo(() => tickets.filter((t) => !isClosed(t)), [tickets]);
  const resolvedCount = useMemo(() => tickets.filter(isClosed).length, [tickets]);

  const handleSort = (field: TicketSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "updatedAt" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const priRank: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const list = tickets.filter((t) => {
      const matchesQ =
        !q ||
        t.id.toLowerCase().includes(q) ||
        (t.customer_name || "").toLowerCase().includes(q) ||
        (t.subject || "").toLowerCase().includes(q) ||
        ownerOf(t).toLowerCase().includes(q) ||
        (t.customer_email || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      const matchesPriority = priorityFilter === "ALL" || t.priority === priorityFilter;
      return matchesQ && matchesStatus && matchesPriority;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "ticketNumber") cmp = a.id.localeCompare(b.id);
      else if (sortField === "orgName") cmp = orgOf(a).localeCompare(orgOf(b));
      else if (sortField === "priority") cmp = (priRank[a.priority] ?? 9) - (priRank[b.priority] ?? 9);
      else if (sortField === "status") cmp = (a.status || "").localeCompare(b.status || "");
      else if (sortField === "slaMinutesRemaining") cmp = 0; // SLA is not tracked by the server
      else cmp = new Date(updatedOf(a)).getTime() - new Date(updatedOf(b)).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tickets, search, statusFilter, priorityFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter, pageSize]);

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
    filtered.map((t) => t.id),
    paginated.map((t) => t.id)
  );

  const openTicketDrawer = (id: string) => {
    closeOverlays();
    setSelectedId(id);
  };

  const changeStatus = (t: OpsSupportTicket, status: string) =>
    void mutation.run(
      "status",
      () => operatorApi.tickets.update(t.id, { status: status as TicketStatus }, t.version),
      `Ticket status changed to ${humanizeCode(status)}.`
    );

  const changePriority = (t: OpsSupportTicket, priority: string) =>
    void mutation.run(
      "priority",
      () => operatorApi.tickets.update(t.id, { priority: priority as TicketPriority }, t.version),
      "Ticket priority updated."
    );

  const changeAssignee = (t: OpsSupportTicket, operatorId: string) => {
    if (!operatorId) return;
    const name = operatorOptions.find((o) => o.value === operatorId)?.label ?? operatorId;
    void mutation.run(
      "assign",
      () => operatorApi.tickets.assign(t.id, operatorId, "", t.version),
      `Assigned to ${name}.`
    );
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-operator-tickets-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Ticket #", "Organization", "Category", "Priority", "Status", "Assignee", "SLA State", "Updated"],
      filtered.map((t, i) => [
        i + 1,
        t.id,
        t.customer_name ?? "",
        "",
        humanizeCode(t.priority),
        humanizeCode(t.status),
        ownerOf(t),
        "",
        updatedOf(t),
      ])
    );
    toast.success(`Exported ${filtered.length} support ticket(s) to CSV.`);
  };

  const busy = mutation.busy !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Tickets"
        badge={`${readyValue(ticketsResource.state, () => activeTickets.length)} Open`}
        liveData
        description="Triage customer support tickets, coordinate responses, track SLA targets, and escalate service issues directly into Incidents."
        actions={
          <NotAvailableButton variant="primary" size="sm" reason="no ticket create endpoint">
            <Plus className="w-4 h-4" />
            New Ticket
          </NotAvailableButton>
        }
      />

      <DemoDataBanner
        title="Connected Support Triage"
        description="Updates, replies, SLA state, and one-click escalation to Incidents synchronize directly with Incident Management and Activity Logs."
      />

      <MutationNotice
        notice={mutation.notice}
        onReload={() => {
          mutation.clearNotice();
          reload();
        }}
        onDismiss={mutation.clearNotice}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Open Queue"
          value={readyValue(ticketsResource.state, () => activeTickets.length)}
          sublabel="Waiting on operator or customer"
          icon={LifeBuoy}
          tone={activeTickets.length > 0 ? "teal" : "emerald"}
        />
        <KpiCard label="SLA At Risk / Breached" value="—" sublabel={NOT_AVAILABLE} icon={Clock} tone="slate" />
        <KpiCard label="Escalated Tickets" value="—" sublabel={NOT_AVAILABLE} icon={AlertTriangle} tone="slate" />
        <KpiCard
          label="Resolved"
          value={readyValue(ticketsResource.state, () => resolvedCount)}
          sublabel="Resolved or closed tickets"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search ticket #, organization, subject, or requester..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL" || priorityFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            setPriorityFilter("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={filtered.length === 0}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <OpSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter status"
                  options={[{ label: "All Statuses", value: "ALL" }, ...STATUS_OPTIONS]}
                />
              </div>
              <div className="w-32">
                <OpSelect
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  aria-label="Filter priority"
                  options={[{ label: "All Priority", value: "ALL" }, ...PRIORITY_OPTIONS]}
                />
              </div>
              <div className="w-32" title={`${NOT_AVAILABLE}: SLA is not tracked by the server`}>
                <OpSelect
                  value="ALL"
                  disabled
                  onChange={() => undefined}
                  aria-label="Filter SLA"
                  options={[
                    { label: "All SLA", value: "ALL" },
                    { label: "On Track", value: "On Track" },
                    { label: "At Risk", value: "At Risk" },
                    { label: "Breached", value: "Breached" },
                  ]}
                />
              </div>
            </div>
          }
        />

        {ticketsResource.state.status !== "ready" || tickets.length === 0 ? (
          <OperatorResourceStatus
            state={ticketsResource.state}
            isEmpty={(rows) => rows.length === 0}
            onRetry={reload}
            emptyIcon={MessageSquare}
            emptyTitle="No support tickets yet"
            emptyDescription="No customer support tickets are recorded on the server."
          />
        ) : paginated.length === 0 ? (
          <OperatorResourceStatus
            state={{ status: "ready", data: [] as OpsSupportTicket[] }}
            isEmpty={() => true}
            onRetry={reload}
            emptyIcon={MessageSquare}
            emptyTitle="No tickets match your filter"
            emptyDescription="Reset your filters or create a support ticket on behalf of an organization."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((t) => t.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <NotAvailableButton variant="primary" size="xs" reason="no bulk resolve endpoint">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Resolved ({selectedIds.length})
                </NotAvailableButton>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
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
                        aria-label="Select all tickets on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Ticket & Organization" active={sortField === "orgName"} direction={sortDir} onSort={() => handleSort("orgName")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Priority" active={sortField === "priority"} direction={sortDir} onSort={() => handleSort("priority")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="SLA Health" active={sortField === "slaMinutesRemaining"} direction={sortDir} onSort={() => handleSort("slaMinutesRemaining")} />
                    </th>
                    <th className="py-2.5 px-3.5">Assignee</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((t, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(t.id);
                    return (
                      <tr key={t.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(t.id)}
                            aria-label={`Select ${t.id}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 max-w-[300px]">
                          <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-[10px] font-bold text-teal-700 dark:text-teal-300 shrink-0 mt-0.5">
                              {getOrgInitials(t.customer_name || "?")}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-1.5 py-0.5 text-[10px] font-bold">
                                  {t.id}
                                </span>
                                <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400">
                                  <NotAvailableText className="text-[11px]" reason="ticket category is not stored" />
                                </span>
                              </div>
                              <p className="font-semibold text-[var(--color-text-primary)] truncate mt-0.5">
                                {t.subject}
                              </p>
                              <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                                {orgOf(t)} · {t.customer_email || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={humanizeCode(t.priority)} tone={priorityTone(t.priority)} />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={humanizeCode(t.status)} tone={getStatusTone(humanizeCode(t.status))} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <NotAvailableText reason="SLA is not tracked by the server" />
                            <p className="text-[10px] text-[var(--color-text-muted)]">{isClosed(t) ? "Closed" : "—"}</p>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-medium text-[var(--color-text-primary)]">
                          {ownerOf(t)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <OpButton variant="outline" size="xs" onClick={() => openTicketDrawer(t.id)}>
                              <Eye className="w-3.5 h-3.5" />
                              Inspect
                            </OpButton>
                            {!isClosed(t) && (
                              <NotAvailableButton variant="subtle" size="xs" hideLabel reason="no ticket-to-incident endpoint">
                                <AlertTriangle className="w-3 h-3" />
                                Incident
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

      {/* Create Ticket Modal (no create endpoint yet: kept, never opened, submit disabled) */}
      <OpModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Log New Customer Support Ticket"
        description="Record a customer request for operator triage and SLA tracking."
        maxWidth="lg"
      >
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OpSelect label="Organization *" value="" disabled onChange={() => undefined} options={[]} />
            <OpInput label="Requester Contact Email *" type="email" disabled placeholder="admin@company.com" />
          </div>

          <OpInput
            label="Ticket Subject *"
            disabled
            placeholder="e.g. Need assistance verifying GitHub repository sync"
          />

          <OpTextarea
            label="Issue Description *"
            disabled
            placeholder="Summarize the customer issue and steps requested..."
            rows={3}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <OpSelect label="Category" value="Integration" disabled onChange={() => undefined} options={CATEGORY_OPTIONS} />
            <OpSelect label="Priority" value="HIGH" disabled onChange={() => undefined} options={PRIORITY_OPTIONS} />
            <OpSelect label="Assign To" value="" disabled onChange={() => undefined} options={operatorOptions} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </OpButton>
            <NotAvailableButton variant="primary" size="sm" reason="no ticket create endpoint">
              Create Ticket
            </NotAvailableButton>
          </div>
        </form>
      </OpModal>

      {/* Ticket Conversation & Status Drawer */}
      <SlideOverDrawer
        isOpen={Boolean(selectedTicket)}
        onClose={() => setSelectedId(null)}
        title={selectedTicket ? `${selectedTicket.id} — ${orgOf(selectedTicket)}` : "Ticket"}
        subtitle={selectedTicket?.subject}
      >
        {selectedTicket && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs space-y-1">
              <p className="font-semibold text-[var(--color-text-primary)]">Customer Description</p>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">{selectedTicket.description || "—"}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] pt-1">
                Contact: {selectedTicket.customer_email || "—"} · Opened {formatDateTime(selectedTicket.created_at ?? "")}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <OpSelect
                label="Status"
                value={selectedTicket.status}
                disabled={!canManage || busy}
                onChange={(e) => changeStatus(selectedTicket, e.target.value)}
                options={STATUS_OPTIONS}
              />
              <OpSelect
                label="Priority"
                value={selectedTicket.priority}
                disabled={!canManage || busy}
                onChange={(e) => changePriority(selectedTicket, e.target.value)}
                options={PRIORITY_OPTIONS}
              />
              <OpSelect
                label="Assignee"
                value={selectedTicket.assigned_operator_id || ""}
                disabled={!canManage || busy}
                onChange={(e) => changeAssignee(selectedTicket, e.target.value)}
                options={[
                  ...(selectedTicket.assigned_operator_id ? [] : [{ label: "Unassigned", value: "" }]),
                  ...operatorOptions,
                  ...(selectedTicket.assigned_operator_id &&
                  !operatorOptions.some((o) => o.value === selectedTicket.assigned_operator_id)
                    ? [{ label: ownerOf(selectedTicket), value: selectedTicket.assigned_operator_id }]
                    : []),
                ]}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isClosed(selectedTicket) && (
                <NotAvailableButton variant="subtle" size="xs" reason="no ticket-to-incident endpoint">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Escalate to Incident
                </NotAvailableButton>
              )}
              <NotAvailableButton variant="outline" size="xs" reason="tickets are not linked to incidents yet">
                View Linked Incident
              </NotAvailableButton>
              <Link href="/platform-operator/access-requests">
                <OpButton variant="outline" size="xs">
                  Request Scoped Access
                </OpButton>
              </Link>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">Updates & Comments (—)</p>
              <div className="max-h-52 overflow-y-auto space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs">
                <p className="text-[var(--color-text-muted)] text-center py-4">
                  No updates recorded yet. <NotAvailableText reason="the ticket message thread has no endpoint" />
                </p>
              </div>

              <form onSubmit={(e) => e.preventDefault()} className="space-y-2 pt-1">
                <OpTextarea
                  label="Post Operator Update / Reply"
                  disabled
                  helperText={`${NOT_AVAILABLE}: the ticket message thread has no endpoint.`}
                  placeholder="Write a clear, helpful update for the customer or fellow operators..."
                  rows={2}
                />
                <div className="flex justify-end">
                  <NotAvailableButton variant="primary" size="xs" reason="the ticket message thread has no endpoint">
                    <Send className="w-3 h-3" />
                    Add Comment
                  </NotAvailableButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}
