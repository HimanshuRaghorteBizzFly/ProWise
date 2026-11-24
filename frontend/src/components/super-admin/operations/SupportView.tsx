"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Eye, Headset, Inbox, Siren } from "lucide-react";
import type { OpsOperator, OpsSupportTicket, TicketPriority, TicketStatus, UpdateTicketBody } from "@/types/admin-operations";
import {
  AdminButton,
  AdminSelect,
  AdminTextarea,
  FilterBar,
  PageHeader,
  PaginationBar,
  SlideOverDrawer,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { AdminTable, ResourceStatus, cellClass, formatInstant, humanize, mutedCellClass, type ResourceState } from "../admin-resource";
import {
  CountKpi,
  MutationNotice,
  departmentLabel,
  matchesSearch,
  operatorOptions,
  paginate,
  severityTone,
  type MutationNoticeState,
} from "./shared";

export const TICKET_STATUS_OPTIONS: { label: string; value: TicketStatus }[] = [
  { label: "Open", value: "OPEN" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Waiting on Customer", value: "WAITING_CUSTOMER" },
  { label: "Resolved", value: "RESOLVED" },
  { label: "Closed", value: "CLOSED" },
];

export const TICKET_PRIORITY_OPTIONS: { label: string; value: TicketPriority }[] = [
  { label: "Low", value: "LOW" },
  { label: "Medium", value: "MEDIUM" },
  { label: "High", value: "HIGH" },
  { label: "Urgent", value: "URGENT" },
];

const isOpen = (t: OpsSupportTicket) => t.status !== "RESOLVED" && t.status !== "CLOSED";

export interface SupportViewProps {
  tickets: ResourceState<OpsSupportTicket[]>;
  operators: ResourceState<OpsOperator[]>;
  onRetry: () => void;
  busy: string | null;
  notice: MutationNoticeState | null;
  onReload: () => void;
  onDismissNotice: () => void;
  onUpdate: (ticket: OpsSupportTicket, body: UpdateTicketBody) => Promise<boolean>;
  onAssign: (ticket: OpsSupportTicket, operatorId: string, notes: string) => Promise<boolean>;
  onSelect?: () => void;
}

export function SupportView(props: SupportViewProps) {
  const { tickets, onRetry, notice, onReload, onDismissNotice } = props;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => (tickets.status === "ready" ? tickets.data : []), [tickets]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (t) =>
          matchesSearch(search, t.id, t.subject, t.customer_name, t.customer_email, t.assigned_operator_name) &&
          (statusFilter === "ALL" || t.status === statusFilter) &&
          (priorityFilter === "ALL" || t.priority === priorityFilter),
      ),
    [rows, search, statusFilter, priorityFilter],
  );
  const pageData = paginate(filtered, page, pageSize);
  const selected = rows.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Oversight"
        badge="Multi-Tenant Resolution Desk"
        description="Customer support tickets handled by Platform Operators: triage state, priority and operator accountability."
      />

      {!selectedId && <MutationNotice notice={notice} onReload={onReload} onDismiss={onDismissNotice} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CountKpi state={tickets} count={(d) => d.filter((t) => t.status === "OPEN").length} label="Open Tickets" sublabel="Awaiting operator triage" icon={Inbox} tone="blue" />
        <CountKpi state={tickets} count={(d) => d.filter((t) => isOpen(t) && t.priority === "URGENT").length} label="Urgent Priority" sublabel="Unresolved, highest priority" icon={Siren} tone="rose" />
        <CountKpi state={tickets} count={(d) => d.filter((t) => t.status === "WAITING_CUSTOMER").length} label="Waiting on Customer" sublabel="Paused for customer reply" icon={Clock} tone="amber" />
        <CountKpi state={tickets} count={(d) => d.filter((t) => !isOpen(t)).length} label="Resolved / Closed" sublabel="Completed tickets" icon={CheckCircle2} tone="emerald" />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder="Search ticket, subject, customer, or operator..."
            hasActiveFilters={Boolean(search || statusFilter !== "ALL" || priorityFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setStatusFilter("ALL");
              setPriorityFilter("ALL");
              setPage(1);
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-44">
                  <AdminSelect
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Filter by status"
                    options={[{ label: "All Statuses", value: "ALL" }, ...TICKET_STATUS_OPTIONS]}
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
                    options={[{ label: "All Priorities", value: "ALL" }, ...TICKET_PRIORITY_OPTIONS]}
                  />
                </div>
              </div>
            }
          />
        </div>

        <ResourceStatus
          state={tickets}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={Headset}
          emptyTitle="No support tickets"
          emptyDescription="No customer support tickets have been recorded yet."
        />

        {tickets.status === "ready" && tickets.data.length > 0 && (
          <>
            {pageData.rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--color-text-secondary)]">No tickets match your filters.</p>
            ) : (
              <AdminTable label="Support tickets" headers={["Ticket", "Customer", "Priority", "Status", "Department", "Operator", "Updated", ""]}>
                {pageData.rows.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--color-elevated)]/50">
                    <td className={cellClass}>
                      <p className="font-semibold">{t.subject}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{t.id}</p>
                    </td>
                    <td className={mutedCellClass}>
                      <p>{t.customer_name || "-"}</p>
                      <p className="text-[11px]">{t.customer_email || ""}</p>
                    </td>
                    <td className={cellClass}>
                      <StatusBadge label={humanize(t.priority)} tone={severityTone(t.priority)} />
                    </td>
                    <td className={cellClass}>
                      <StatusBadge label={humanize(t.status)} tone={getStatusTone(t.status)} dot />
                    </td>
                    <td className={mutedCellClass}>{t.department_name || departmentLabel(t.department_id)}</td>
                    <td className={mutedCellClass}>{t.assigned_operator_id ? t.assigned_operator_name || t.assigned_operator_id : "Unassigned"}</td>
                    <td className={mutedCellClass}>{formatInstant(t.updated_at)}</td>
                    <td className={cellClass}>
                      <AdminButton
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          setSelectedId(t.id);
                          props.onSelect?.();
                        }}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Manage
                      </AdminButton>
                    </td>
                  </tr>
                ))}
              </AdminTable>
            )}
            <PaginationBar
              currentPage={pageData.page}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </>
        )}
      </SurfaceCard>

      <TicketDrawer
        ticket={selected}
        onClose={() => {
          setSelectedId(null);
          onDismissNotice();
        }}
        {...props}
      />
    </div>
  );
}

function TicketDrawer({
  ticket,
  onClose,
  operators,
  busy,
  notice,
  onReload,
  onDismissNotice,
  onUpdate,
  onAssign,
}: SupportViewProps & { ticket: OpsSupportTicket | null; onClose: () => void }) {
  const [status, setStatus] = useState<TicketStatus>("OPEN");
  const [priority, setPriority] = useState<TicketPriority>("MEDIUM");
  const [assignee, setAssignee] = useState("");
  const [notes, setNotes] = useState("");

  const key = ticket ? `${ticket.id}:${ticket.version ?? ""}:${ticket.updated_at ?? ""}` : "";
  useEffect(() => {
    if (!ticket) return;
    setStatus(ticket.status as TicketStatus);
    setPriority(ticket.priority as TicketPriority);
    setAssignee("");
    setNotes("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const changed = ticket ? status !== ticket.status || priority !== ticket.priority : false;

  return (
    <SlideOverDrawer isOpen={Boolean(ticket)} onClose={onClose} title={ticket ? ticket.subject : "Support Ticket"} subtitle={ticket?.id}>
      {ticket && (
        <div className="space-y-5">
          <MutationNotice notice={notice} onReload={onReload} onDismiss={onDismissNotice} />

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs space-y-1.5">
            <p className="font-semibold text-[var(--color-text-primary)]">Customer Issue</p>
            <p className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">{ticket.description || "No description recorded."}</p>
            <p className="text-[11px] text-[var(--color-text-muted)] pt-1">
              {ticket.customer_name || "-"} {ticket.customer_email ? `<${ticket.customer_email}>` : ""} · Opened {formatInstant(ticket.created_at)}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              Department: {ticket.department_name || departmentLabel(ticket.department_id)} · Operator:{" "}
              {ticket.assigned_operator_id ? ticket.assigned_operator_name || ticket.assigned_operator_id : "Unassigned"}
            </p>
          </div>

          <section className="space-y-3">
            <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">Triage</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdminSelect label="Status" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus)} options={TICKET_STATUS_OPTIONS} />
              <AdminSelect label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)} options={TICKET_PRIORITY_OPTIONS} />
            </div>
            <div className="flex justify-end">
              <AdminButton
                size="sm"
                disabled={!changed}
                isLoading={busy === `update:${ticket.id}`}
                onClick={() =>
                  void onUpdate(ticket, {
                    ...(status !== ticket.status ? { status } : {}),
                    ...(priority !== ticket.priority ? { priority } : {}),
                  })
                }
              >
                Save Triage
              </AdminButton>
            </div>
          </section>

          <section className="space-y-3 border-t border-[var(--color-border)] pt-4">
            <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">Reassign Operator</h4>
            <AdminSelect
              label="Assign To"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              options={[{ label: operators.status === "error" ? "Operators could not be loaded" : "Select an operator", value: "" }, ...operatorOptions(operators)]}
            />
            <AdminTextarea label="Handover Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            <div className="flex justify-end">
              <AdminButton size="sm" variant="secondary" disabled={!assignee} isLoading={busy === `assign:${ticket.id}`} onClick={() => void onAssign(ticket, assignee, notes.trim())}>
                Assign Operator
              </AdminButton>
            </div>
          </section>
        </div>
      )}
    </SlideOverDrawer>
  );
}
