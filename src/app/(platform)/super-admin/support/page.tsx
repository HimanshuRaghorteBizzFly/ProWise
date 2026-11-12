"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Headphones,
  Plus,
} from "lucide-react";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { SupportEscalationTicket } from "../_types";
import { exportRowsToCsv, formatDateTime, isValidEmail } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  BulkSelectionBar,
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
  getStatusTone,
  useTableSelection,
} from "../_components/SuperAdminPrimitives";

export default function SupportOversightPage() {
  const supportTickets = useSuperAdminStore((s) => s.supportTickets);
  const organizations = useSuperAdminStore((s) => s.organizations);
  const operators = useSuperAdminStore((s) => s.operators);
  const createSupportTicket = useSuperAdminStore((s) => s.createSupportTicket);
  const updateSupportTicket = useSuperAdminStore((s) => s.updateSupportTicket);

  const { can } = useAdminPermissions();
  const canManageSupport = can("support.manage");
  const canExport = can("system.export");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [slaFilter, setSlaFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Create Ticket Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<SupportEscalationTicket["priority"]>("High");
  const [assignedOperatorId, setAssignedOperatorId] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Ticket Drawer
  const [selectedTicket, setSelectedTicket] = useState<SupportEscalationTicket | null>(null);
  const [editStatus, setEditStatus] = useState<SupportEscalationTicket["status"]>("Open");
  const [editPriority, setEditPriority] = useState<SupportEscalationTicket["priority"]>("High");
  const [editOperatorId, setEditOperatorId] = useState("");
  const [editSlaState, setEditSlaState] = useState<SupportEscalationTicket["slaState"]>("On Track");
  const [editNotes, setEditNotes] = useState("");

  const openOrEscalatedCount = useMemo(
    () => supportTickets.filter((t) => t.status !== "Resolved").length,
    [supportTickets]
  );
  const escalatedCount = useMemo(
    () => supportTickets.filter((t) => t.status === "Escalated").length,
    [supportTickets]
  );
  const slaRiskCount = useMemo(
    () => supportTickets.filter((t) => t.status !== "Resolved" && t.slaState !== "On Track").length,
    [supportTickets]
  );
  const resolvedCount = useMemo(
    () => supportTickets.filter((t) => t.status === "Resolved").length,
    [supportTickets]
  );

  const getOperatorName = (id: string) =>
    operators.find((o) => o.id === id)?.name || "Unassigned";

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return supportTickets.filter((ticket) => {
      const opName = getOperatorName(ticket.assignedOperatorId).toLowerCase();
      const matchesQ =
        !q ||
        ticket.ticketNumber.toLowerCase().includes(q) ||
        ticket.subject.toLowerCase().includes(q) ||
        ticket.orgName.toLowerCase().includes(q) ||
        ticket.requesterEmail.toLowerCase().includes(q) ||
        opName.includes(q);
      const matchesStatus = statusFilter === "ALL" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "ALL" || ticket.priority === priorityFilter;
      const matchesSla = slaFilter === "ALL" || ticket.slaState === slaFilter;
      return matchesQ && matchesStatus && matchesPriority && matchesSla;
    });
  }, [supportTickets, operators, search, statusFilter, priorityFilter, slaFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedTickets = filteredTickets.slice((safePage - 1) * pageSize, safePage * pageSize);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    filteredTickets.map((t) => t.id),
    paginatedTickets.map((t) => t.id)
  );

  const openCreateModal = () => {
    const firstOrg = organizations[0];
    const activeOps = operators.filter((o) => o.status === "ACTIVE");
    setOrgId(firstOrg?.id || "");
    setRequesterEmail(firstOrg?.ownerEmail || "");
    setSubject("");
    setDescription("");
    setPriority("High");
    setAssignedOperatorId(activeOps[0]?.id || "");
    setFormError(null);
    setCreateOpen(true);
  };

  const handleOrgChange = (nextOrgId: string) => {
    setOrgId(nextOrgId);
    const matched = organizations.find((o) => o.id === nextOrgId);
    if (matched) {
      setRequesterEmail(matched.ownerEmail);
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) {
      setFormError("Please choose the customer organization.");
      return;
    }
    if (subject.trim().length < 5) {
      setFormError("Please provide a descriptive ticket subject.");
      return;
    }
    if (description.trim().length < 10) {
      setFormError("Please describe the customer issue clearly.");
      return;
    }
    if (!isValidEmail(requesterEmail)) {
      setFormError("Please enter a valid customer contact email.");
      return;
    }
    if (!assignedOperatorId) {
      setFormError("Please assign a Platform Operator owner.");
      return;
    }

    createSupportTicket({
      orgId,
      subject: subject.trim(),
      description: description.trim(),
      priority,
      assignedOperatorId,
      requesterEmail: requesterEmail.trim(),
    });
    toast.success("Support escalation logged and assigned.");
    setCreateOpen(false);
  };

  const openTicketDrawer = (ticket: SupportEscalationTicket) => {
    setSelectedTicket(ticket);
    setEditStatus(ticket.status);
    setEditPriority(ticket.priority);
    setEditOperatorId(ticket.assignedOperatorId);
    setEditSlaState(ticket.slaState);
    setEditNotes(ticket.resolutionNotes || "");
  };

  const handleSaveTicket = () => {
    if (!selectedTicket) return;
    if (!canManageSupport) {
      toast.error("Your role does not permit updating support tickets.");
      return;
    }
    updateSupportTicket(selectedTicket.id, {
      status: editStatus,
      priority: editPriority,
      assignedOperatorId: editOperatorId,
      slaState: editStatus === "Resolved" ? "On Track" : editSlaState,
      resolutionNotes: editNotes.trim() || undefined,
    });
    toast.success(`Ticket ${selectedTicket.ticketNumber} updated.`);
    setSelectedTicket(null);
  };

  const handleExportCsv = () => {
    if (!canExport) {
      toast.error("Your role does not permit exporting support reports.");
      return;
    }
    exportRowsToCsv(
      `prowise-support-oversight-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Ticket #", "Organization", "Subject", "Priority", "Status", "Assigned Operator", "SLA State", "Updated"],
      filteredTickets.map((t) => [
        t.ticketNumber,
        t.orgName,
        t.subject,
        t.priority,
        t.status,
        getOperatorName(t.assignedOperatorId),
        t.slaState,
        t.updatedAt,
      ])
    );
    toast.success(`Exported ${filteredTickets.length} support ticket(s) to CSV.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Oversight"
        badge="SLA Tracking"
        simulationLabel="Governance Desk"
        description="Oversee escalated customer tickets, balance Platform Operator assignments, and prevent SLA breaches."
        actions={
          <AdminButton
            variant="primary"
            size="sm"
            permissionLocked={!canManageSupport}
            onClick={openCreateModal}
          >
            <Plus className="w-4 h-4" />
            Log Escalation
          </AdminButton>
        }
      />

      <SimulationNotice
        title="Support Leadership View"
        description="Assigns ticket accountability and tracks response targets locally until Zendesk, Jira, or Spring Boot support APIs are connected."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Active Tickets"
          value={openOrEscalatedCount}
          sublabel="Open, in progress, or escalated"
          icon={Headphones}
          tone="blue"
        />
        <KpiCard
          label="Escalated Cases"
          value={escalatedCount}
          sublabel="Flagged for executive attention"
          icon={AlertCircle}
          tone={escalatedCount > 0 ? "rose" : "emerald"}
        />
        <KpiCard
          label="SLA At Risk / Breached"
          value={slaRiskCount}
          sublabel="Requires immediate operator follow-up"
          icon={Clock}
          tone={slaRiskCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Resolved Tickets"
          value={resolvedCount}
          sublabel="Closed with customer confirmation"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search ticket #, organization, subject, or owner..."
          hasActiveFilters={Boolean(
            search || statusFilter !== "ALL" || priorityFilter !== "ALL" || slaFilter !== "ALL"
          )}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            setPriorityFilter("ALL");
            setSlaFilter("ALL");
            setPage(1);
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={!canExport || filteredTickets.length === 0}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <AdminSelect
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by status"
                  options={[
                    { label: "All Statuses", value: "ALL" },
                    { label: "Open", value: "Open" },
                    { label: "In Progress", value: "In Progress" },
                    { label: "Escalated", value: "Escalated" },
                    { label: "Resolved", value: "Resolved" },
                  ]}
                />
              </div>
              <div className="w-36">
                <AdminSelect
                  value={priorityFilter}
                  onChange={(e) => {
                    setPriorityFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by priority"
                  options={[
                    { label: "All Priorities", value: "ALL" },
                    { label: "Critical", value: "Critical" },
                    { label: "High", value: "High" },
                    { label: "Medium", value: "Medium" },
                    { label: "Low", value: "Low" },
                  ]}
                />
              </div>
              <div className="w-36">
                <AdminSelect
                  value={slaFilter}
                  onChange={(e) => {
                    setSlaFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by SLA state"
                  options={[
                    { label: "All SLAs", value: "ALL" },
                    { label: "On Track", value: "On Track" },
                    { label: "At Risk", value: "At Risk" },
                    { label: "Breached", value: "Breached" },
                  ]}
                />
              </div>
            </div>
          }
        />

        <BulkSelectionBar
          selectedCount={selectedIds.length}
          totalFilteredCount={filteredTickets.length}
          onSelectAllMatching={() => setSelectedIds(filteredTickets.map((t) => t.id))}
          onClear={() => setSelectedIds([])}
          actions={
            <>
              <AdminButton
                variant="subtle"
                size="xs"
                permissionLocked={!canManageSupport}
                onClick={() => {
                  let count = 0;
                  for (const id of selectedIds) {
                    const t = supportTickets.find((item) => item.id === id);
                    if (t && t.status !== "Resolved") {
                      updateSupportTicket(id, { status: "Resolved" });
                      count++;
                    }
                  }
                  if (count === 0) toast.info("Selected tickets are already resolved.");
                  else {
                    toast.success(`Resolved ${count} support ticket${count === 1 ? "" : "s"}`);
                    setSelectedIds([]);
                  }
                }}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark Resolved
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canManageSupport}
                onClick={() => {
                  let count = 0;
                  for (const id of selectedIds) {
                    const t = supportTickets.find((item) => item.id === id);
                    if (t && t.status !== "Escalated") {
                      updateSupportTicket(id, { status: "Escalated" });
                      count++;
                    }
                  }
                  if (count === 0) toast.info("Selected tickets are already escalated.");
                  else {
                    toast.warning(`Escalated ${count} support ticket${count === 1 ? "" : "s"}`);
                    setSelectedIds([]);
                  }
                }}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Escalate
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canExport}
                onClick={() => {
                  const targets = filteredTickets.filter((t) => selectedSet.has(t.id));
                  exportRowsToCsv(
                    "prowise-support-tickets-selected.csv",
                    ["Sr. No.", "Ticket #", "Organization", "Subject", "Priority", "Status", "SLA", "Assigned To"],
                    targets.map((t, idx) => [
                      idx + 1,
                      t.ticketNumber,
                      t.orgName,
                      t.subject,
                      t.priority,
                      t.status,
                      t.slaState,
                      getOperatorName(t.assignedOperatorId),
                    ])
                  );
                  toast.success(`Exported ${targets.length} ticket${targets.length === 1 ? "" : "s"} CSV`);
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </AdminButton>
            </>
          }
        />

        {paginatedTickets.length === 0 ? (
          <EmptyStateView
            icon={Headphones}
            title="No support tickets found"
            description="No customer escalations match your current search or filter settings."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left border-collapse min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <th className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected;
                      }}
                      onChange={toggleSelectPage}
                      aria-label="Select all support tickets on this page"
                      className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="py-3 px-4 w-16 whitespace-nowrap">Sr. No.</th>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Organization &amp; Subject</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">SLA Target</th>
                  <th className="py-3 px-4">Assigned Operator</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-xs">
                {paginatedTickets.map((ticket, idx) => {
                  const serialNumber = (safePage - 1) * pageSize + idx + 1;
                  const isSelected = selectedSet.has(ticket.id);
                  return (
                    <tr
                      key={ticket.id}
                      className={`hover:bg-[var(--color-hover)] transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(ticket.id)}
                          aria-label={`Select ticket ${ticket.ticketNumber}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-blue-700 dark:text-blue-300">
                          {ticket.ticketNumber}
                        </span>
                        <span className="block text-[11px] text-[var(--color-text-muted)] mt-1">
                          {formatDateTime(ticket.updatedAt)}
                        </span>
                      </td>
                      <td className="py-3 px-4 min-w-[240px]">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {getOrgInitials(ticket.orgName)}
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--color-text-primary)]">{ticket.subject}</p>
                            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                              {ticket.orgName} · {ticket.requesterEmail}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge
                          label={ticket.priority}
                          tone={
                            ticket.priority === "Critical"
                              ? "danger"
                              : ticket.priority === "High"
                              ? "warning"
                              : "info"
                          }
                        />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge label={ticket.status} tone={getStatusTone(ticket.status)} dot />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge
                          label={`${ticket.slaState} (${ticket.slaTargetMinutes}m)`}
                          tone={
                            ticket.slaState === "Breached"
                              ? "danger"
                              : ticket.slaState === "At Risk"
                              ? "warning"
                              : "success"
                          }
                        />
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-[var(--color-text-primary)]">
                        {getOperatorName(ticket.assignedOperatorId)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        <AdminButton variant="outline" size="xs" onClick={() => openTicketDrawer(ticket)}>
                          <Eye className="w-3.5 h-3.5" />
                          Manage
                        </AdminButton>
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
          totalItems={filteredTickets.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </SurfaceCard>

      {/* Log Escalation Modal */}
      <AdminModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Log Customer Support Escalation"
        description="Create a tracked ticket and assign SLA ownership to a Platform Operator."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminSelect
              label="Customer Organization"
              value={orgId}
              onChange={(e) => handleOrgChange(e.target.value)}
              options={organizations.map((o) => ({ label: o.name, value: o.id }))}
            />
            <AdminInput
              label="Customer Contact Email"
              type="email"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              placeholder="owner@company.com"
            />
          </div>

          <AdminInput
            label="Ticket Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Workspace SSO login redirecting to expired session page"
          />

          <AdminTextarea
            label="Issue Details"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Summarize the customer impact and what has been verified so far..."
            rows={3}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminSelect
              label="Priority & SLA Target"
              value={priority}
              onChange={(e) => setPriority(e.target.value as SupportEscalationTicket["priority"])}
              options={[
                { label: "Critical (1 hour SLA)", value: "Critical" },
                { label: "High (2 hour SLA)", value: "High" },
                { label: "Medium (4 hour SLA)", value: "Medium" },
                { label: "Low (24 hour SLA)", value: "Low" },
              ]}
            />
            <AdminSelect
              label="Assign Platform Operator"
              value={assignedOperatorId}
              onChange={(e) => setAssignedOperatorId(e.target.value)}
              options={operators
                .filter((o) => o.status === "ACTIVE")
                .map((op) => ({ label: `${op.name} (${op.department})`, value: op.id }))}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary" size="sm">
              Create Escalation
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Ticket Oversight Drawer */}
      <SlideOverDrawer
        isOpen={Boolean(selectedTicket)}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket ? `${selectedTicket.ticketNumber} — Oversight` : "Ticket Oversight"}
        subtitle={selectedTicket ? `${selectedTicket.orgName} · ${selectedTicket.requesterEmail}` : undefined}
      >
        {selectedTicket && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs space-y-1.5">
              <p className="font-semibold text-[var(--color-text-primary)]">{selectedTicket.subject}</p>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">
                {selectedTicket.description}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Opened {formatDateTime(selectedTicket.createdAt)} · SLA target:{" "}
                {selectedTicket.slaTargetMinutes} minutes
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdminSelect
                label="Workflow Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value as SupportEscalationTicket["status"])}
                options={[
                  { label: "Open", value: "Open" },
                  { label: "In Progress", value: "In Progress" },
                  { label: "Escalated", value: "Escalated" },
                  { label: "Resolved", value: "Resolved" },
                ]}
              />
              <AdminSelect
                label="Priority"
                value={editPriority}
                onChange={(e) => setEditPriority(e.target.value as SupportEscalationTicket["priority"])}
                options={[
                  { label: "Critical", value: "Critical" },
                  { label: "High", value: "High" },
                  { label: "Medium", value: "Medium" },
                  { label: "Low", value: "Low" },
                ]}
              />
              <AdminSelect
                label="Assigned Operator"
                value={editOperatorId}
                onChange={(e) => setEditOperatorId(e.target.value)}
                options={operators.map((op) => ({ label: `${op.name} (${op.department})`, value: op.id }))}
              />
              <AdminSelect
                label="SLA Health"
                value={editSlaState}
                onChange={(e) => setEditSlaState(e.target.value as SupportEscalationTicket["slaState"])}
                options={[
                  { label: "On Track", value: "On Track" },
                  { label: "At Risk", value: "At Risk" },
                  { label: "Breached", value: "Breached" },
                ]}
              />
            </div>

            <AdminTextarea
              label="Escalation & Resolution Summary"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Record escalation instructions, handoff context, or customer resolution outcome..."
              rows={4}
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton variant="outline" size="sm" onClick={() => setSelectedTicket(null)}>
                Cancel
              </AdminButton>
              <AdminButton
                variant="primary"
                size="sm"
                permissionLocked={!canManageSupport}
                onClick={handleSaveTicket}
              >
                Save Ticket Update
              </AdminButton>
            </div>
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}
