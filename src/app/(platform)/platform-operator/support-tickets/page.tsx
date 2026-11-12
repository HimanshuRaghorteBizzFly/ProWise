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
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { OperatorTicket } from "../_types";
import { exportRowsToCsv, formatDateTime, isValidEmail } from "../_services/operator-service";
import {
  BulkSelectionBar,
  DemoDataBanner,
  EmptyState,
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

const OPERATORS = ["Alex Rivera", "Priya Nair", "Marcus Chen", "Elena Brooks"];
type TicketSortField = "ticketNumber" | "orgName" | "priority" | "status" | "slaMinutesRemaining" | "updatedAt";

export default function OperatorSupportTicketsPage() {
  const tickets = usePlatformOperatorStore((s) => s.tickets);
  const orgHealth = usePlatformOperatorStore((s) => s.orgHealth);
  const createTicket = usePlatformOperatorStore((s) => s.createTicket);
  const updateTicket = usePlatformOperatorStore((s) => s.updateTicket);
  const addTicketComment = usePlatformOperatorStore((s) => s.addTicketComment);
  const bulkResolveTickets = usePlatformOperatorStore((s) => s.bulkResolveTickets);
  const escalateTicketToIncident = usePlatformOperatorStore((s) => s.escalateTicketToIncident);
  const { can } = useOperatorPermissions();
  const canManage = can("tickets.manage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [slaFilter, setSlaFilter] = useState("ALL");
  const [sortField, setSortField] = useState<TicketSortField>("slaMinutesRemaining");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Create Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<OperatorTicket["category"]>("Integration");
  const [priority, setPriority] = useState<OperatorTicket["priority"]>("High");
  const [assignee, setAssignee] = useState(OPERATORS[0]);
  const [formError, setFormError] = useState<string | null>(null);

  // Inspect Drawer
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const closeOverlays = () => {
    setCreateOpen(false);
    setSelectedId(null);
  };

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedId) || null,
    [tickets, selectedId]
  );

  const activeTickets = useMemo(
    () => tickets.filter((t) => t.status !== "Resolved"),
    [tickets]
  );
  const slaRiskCount = useMemo(
    () => activeTickets.filter((t) => t.slaState !== "On Track").length,
    [activeTickets]
  );
  const escalatedCount = useMemo(
    () => activeTickets.filter((t) => t.status === "Escalated").length,
    [activeTickets]
  );
  const resolvedCount = useMemo(
    () => tickets.filter((t) => t.status === "Resolved").length,
    [tickets]
  );

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
    const priRank: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    const list = tickets.filter((t) => {
      const matchesQ =
        !q ||
        t.ticketNumber.toLowerCase().includes(q) ||
        t.orgName.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.assignee.toLowerCase().includes(q) ||
        t.requesterEmail.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      const matchesPriority = priorityFilter === "ALL" || t.priority === priorityFilter;
      const matchesSla = slaFilter === "ALL" || t.slaState === slaFilter;
      return matchesQ && matchesStatus && matchesPriority && matchesSla;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "ticketNumber") cmp = a.ticketNumber.localeCompare(b.ticketNumber);
      else if (sortField === "orgName") cmp = a.orgName.localeCompare(b.orgName);
      else if (sortField === "priority") cmp = (priRank[a.priority] ?? 9) - (priRank[b.priority] ?? 9);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else if (sortField === "slaMinutesRemaining") cmp = a.slaMinutesRemaining - b.slaMinutesRemaining;
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [tickets, search, statusFilter, priorityFilter, slaFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, priorityFilter, slaFilter, pageSize]);

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

  const openCreateModal = () => {
    closeOverlays();
    const firstOrg = orgHealth[0];
    setOrgId(firstOrg?.id || "org-acme");
    setRequesterEmail("");
    setSubject("");
    setDescription("");
    setCategory("Integration");
    setPriority("High");
    setAssignee(OPERATORS[0]);
    setFormError(null);
    setCreateOpen(true);
  };

  const openTicketDrawer = (id: string) => {
    closeOverlays();
    setSelectedId(id);
    setReplyText("");
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenOrg = orgHealth.find((o) => o.id === orgId);
    if (!chosenOrg) {
      setFormError("Please select an organization.");
      return;
    }
    if (!isValidEmail(requesterEmail)) {
      setFormError("Please enter a valid customer contact email address.");
      return;
    }
    if (subject.trim().length < 5) {
      setFormError("Please provide a descriptive ticket subject.");
      return;
    }
    if (description.trim().length < 10) {
      setFormError("Please explain the issue details (at least 10 characters).");
      return;
    }

    const created = createTicket({
      orgId: chosenOrg.id,
      orgName: chosenOrg.orgName,
      subject: subject.trim(),
      description: description.trim(),
      category,
      priority,
      assignee,
      requesterEmail: requesterEmail.trim(),
    });
    toast.success(`Support ticket ${created.ticketNumber} created.`);
    setCreateOpen(false);
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    addTicketComment(selectedTicket.id, replyText.trim());
    setReplyText("");
    toast.success("Comment added to ticket conversation (simulated).");
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-operator-tickets-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Ticket #", "Organization", "Category", "Priority", "Status", "Assignee", "SLA State", "Updated"],
      filtered.map((t, i) => [
        i + 1,
        t.ticketNumber,
        t.orgName,
        t.category,
        t.priority,
        t.status,
        t.assignee,
        t.slaState,
        t.updatedAt,
      ])
    );
    toast.success(`Exported ${filtered.length} support ticket(s) to CSV.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Tickets"
        badge={`${activeTickets.length} Open`}
        demoLabel="Demo SLA Queue"
        description="Triage customer support tickets, coordinate responses, track SLA targets, and escalate service issues directly into Incidents."
        actions={
          <OpButton variant="primary" size="sm" disabled={!canManage} onClick={openCreateModal}>
            <Plus className="w-4 h-4" />
            New Ticket
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Connected Support Triage"
        description="Updates, replies, SLA state, and one-click escalation to Incidents synchronize directly with Incident Management and Activity Logs."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Open Queue"
          value={activeTickets.length}
          sublabel="Waiting on operator or customer"
          icon={LifeBuoy}
          tone={activeTickets.length > 0 ? "teal" : "emerald"}
        />
        <KpiCard
          label="SLA At Risk / Breached"
          value={slaRiskCount}
          sublabel="Requires rapid operator attention"
          icon={Clock}
          tone={slaRiskCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Escalated Tickets"
          value={escalatedCount}
          sublabel="Linked to active incidents or Super Admin"
          icon={AlertTriangle}
          tone={escalatedCount > 0 ? "rose" : "slate"}
        />
        <KpiCard
          label="Resolved"
          value={resolvedCount}
          sublabel="Completed during session"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search ticket #, organization, subject, or requester..."
          hasActiveFilters={Boolean(
            search || statusFilter !== "ALL" || priorityFilter !== "ALL" || slaFilter !== "ALL"
          )}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            setPriorityFilter("ALL");
            setSlaFilter("ALL");
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
                  options={[
                    { label: "All Statuses", value: "ALL" },
                    { label: "Open", value: "Open" },
                    { label: "In Progress", value: "In Progress" },
                    { label: "Waiting on Customer", value: "Waiting on Customer" },
                    { label: "Escalated", value: "Escalated" },
                    { label: "Resolved", value: "Resolved" },
                  ]}
                />
              </div>
              <div className="w-32">
                <OpSelect
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  aria-label="Filter priority"
                  options={[
                    { label: "All Priority", value: "ALL" },
                    { label: "Critical", value: "Critical" },
                    { label: "High", value: "High" },
                    { label: "Medium", value: "Medium" },
                    { label: "Low", value: "Low" },
                  ]}
                />
              </div>
              <div className="w-32">
                <OpSelect
                  value={slaFilter}
                  onChange={(e) => setSlaFilter(e.target.value)}
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

        {paginated.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No tickets match your filter"
            description="Reset your filters or create a support ticket on behalf of an organization."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((t) => t.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="primary"
                  size="xs"
                  disabled={!canManage}
                  onClick={() => {
                    const count = bulkResolveTickets(selectedIds);
                    toast.success(`Resolved ${count} selected support ticket(s).`);
                    setSelectedIds([]);
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Resolved ({selectedIds.length})
                </OpButton>
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
                            aria-label={`Select ${t.ticketNumber}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 max-w-[300px]">
                          <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-[10px] font-bold text-teal-700 dark:text-teal-300 shrink-0 mt-0.5">
                              {getOrgInitials(t.orgName)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-1.5 py-0.5 text-[10px] font-bold">
                                  {t.ticketNumber}
                                </span>
                                <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400">
                                  {t.category}
                                </span>
                              </div>
                              <p className="font-semibold text-[var(--color-text-primary)] truncate mt-0.5">
                                {t.subject}
                              </p>
                              <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                                {t.orgName} · {t.requesterEmail}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge
                            label={t.priority}
                            tone={t.priority === "Critical" ? "danger" : t.priority === "High" ? "warning" : "info"}
                          />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={t.status} tone={getStatusTone(t.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <StatusBadge label={t.slaState} tone={getStatusTone(t.slaState)} />
                            <p className="text-[10px] text-[var(--color-text-muted)]">
                              {t.status === "Resolved"
                                ? "Closed"
                                : t.slaMinutesRemaining <= 0
                                ? "Target passed"
                                : `${t.slaMinutesRemaining}m remaining`}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-medium text-[var(--color-text-primary)]">
                          {t.assignee}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <OpButton variant="outline" size="xs" onClick={() => openTicketDrawer(t.id)}>
                              <Eye className="w-3.5 h-3.5" />
                              Inspect
                            </OpButton>
                            {!t.linkedIncidentId && t.status !== "Resolved" && (
                              <OpButton
                                variant="subtle"
                                size="xs"
                                disabled={!canManage}
                                onClick={() => {
                                  const inc = escalateTicketToIncident(t.id);
                                  if (inc) toast.success(`Escalated to incident ${inc.code}.`);
                                }}
                              >
                                <AlertTriangle className="w-3 h-3" />
                                Incident
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

      {/* Create Ticket Modal */}
      <OpModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Log New Customer Support Ticket"
        description="Record a customer request for operator triage and SLA tracking."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OpSelect
              label="Organization *"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              options={orgHealth.map((o) => ({ label: o.orgName, value: o.id }))}
            />
            <OpInput
              label="Requester Contact Email *"
              type="email"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              placeholder="admin@company.com"
            />
          </div>

          <OpInput
            label="Ticket Subject *"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Need assistance verifying GitHub repository sync"
          />

          <OpTextarea
            label="Issue Description *"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Summarize the customer issue and steps requested..."
            rows={3}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <OpSelect
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as OperatorTicket["category"])}
              options={[
                { label: "Integration", value: "Integration" },
                { label: "Workspace Access", value: "Workspace Access" },
                { label: "Billing & Invoices", value: "Billing & Invoices" },
                { label: "Performance", value: "Performance" },
                { label: "General", value: "General" },
              ]}
            />
            <OpSelect
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as OperatorTicket["priority"])}
              options={[
                { label: "Critical", value: "Critical" },
                { label: "High", value: "High" },
                { label: "Medium", value: "Medium" },
                { label: "Low", value: "Low" },
              ]}
            />
            <OpSelect
              label="Assign To"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              options={OPERATORS.map((n) => ({ label: n, value: n }))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </OpButton>
            <OpButton type="submit" variant="primary" size="sm">
              Create Ticket
            </OpButton>
          </div>
        </form>
      </OpModal>

      {/* Ticket Conversation & Status Drawer */}
      <SlideOverDrawer
        isOpen={Boolean(selectedTicket)}
        onClose={() => setSelectedId(null)}
        title={selectedTicket ? `${selectedTicket.ticketNumber} — ${selectedTicket.orgName}` : "Ticket"}
        subtitle={selectedTicket?.subject}
      >
        {selectedTicket && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs space-y-1">
              <p className="font-semibold text-[var(--color-text-primary)]">Customer Description</p>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                {selectedTicket.description}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)] pt-1">
                Contact: {selectedTicket.requesterEmail} · Opened {formatDateTime(selectedTicket.createdAt)}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <OpSelect
                label="Status"
                value={selectedTicket.status}
                disabled={!canManage}
                onChange={(e) => {
                  updateTicket(selectedTicket.id, {
                    status: e.target.value as OperatorTicket["status"],
                  });
                  toast.success(`Ticket status changed to ${e.target.value}.`);
                }}
                options={[
                  { label: "Open", value: "Open" },
                  { label: "In Progress", value: "In Progress" },
                  { label: "Waiting on Customer", value: "Waiting on Customer" },
                  { label: "Escalated", value: "Escalated" },
                  { label: "Resolved", value: "Resolved" },
                ]}
              />
              <OpSelect
                label="Priority"
                value={selectedTicket.priority}
                disabled={!canManage}
                onChange={(e) => {
                  updateTicket(selectedTicket.id, {
                    priority: e.target.value as OperatorTicket["priority"],
                  });
                  toast.success("Ticket priority updated.");
                }}
                options={[
                  { label: "Critical", value: "Critical" },
                  { label: "High", value: "High" },
                  { label: "Medium", value: "Medium" },
                  { label: "Low", value: "Low" },
                ]}
              />
              <OpSelect
                label="Assignee"
                value={selectedTicket.assignee}
                disabled={!canManage}
                onChange={(e) => {
                  updateTicket(selectedTicket.id, { assignee: e.target.value });
                  toast.success(`Assigned to ${e.target.value}.`);
                }}
                options={OPERATORS.map((n) => ({ label: n, value: n }))}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!selectedTicket.linkedIncidentId && selectedTicket.status !== "Resolved" ? (
                <OpButton
                  variant="subtle"
                  size="xs"
                  disabled={!canManage}
                  onClick={() => {
                    const inc = escalateTicketToIncident(selectedTicket.id);
                    if (inc) toast.success(`Escalated ticket to incident ${inc.code}.`);
                  }}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Escalate to Incident
                </OpButton>
              ) : selectedTicket.linkedIncidentId ? (
                <Link href="/platform-operator/incidents">
                  <OpButton variant="outline" size="xs">
                    View Linked Incident
                  </OpButton>
                </Link>
              ) : null}
              <Link href="/platform-operator/access-requests">
                <OpButton variant="outline" size="xs">
                  Request Scoped Access
                </OpButton>
              </Link>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                Updates & Comments ({selectedTicket.comments.length})
              </p>
              <div className="max-h-52 overflow-y-auto space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs">
                {selectedTicket.comments.length === 0 ? (
                  <p className="text-[var(--color-text-muted)] text-center py-4">
                    No updates recorded yet.
                  </p>
                ) : (
                  selectedTicket.comments.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 space-y-1"
                    >
                      <div className="flex justify-between gap-2 text-[11px] text-[var(--color-text-muted)]">
                        <strong className="text-[var(--color-text-primary)]">
                          {c.author} ({c.roleLabel})
                        </strong>
                        <span>{formatDateTime(c.createdAt)}</span>
                      </div>
                      <p className="text-[var(--color-text-secondary)]">{c.message}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendReply} className="space-y-2 pt-1">
                <OpTextarea
                  label="Post Operator Update / Reply"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write a clear, helpful update for the customer or fellow operators..."
                  rows={2}
                />
                <div className="flex justify-end">
                  <OpButton type="submit" variant="primary" size="xs" disabled={!canManage || !replyText.trim()}>
                    <Send className="w-3 h-3" />
                    Add Comment
                  </OpButton>
                </div>
              </form>
            </div>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}
