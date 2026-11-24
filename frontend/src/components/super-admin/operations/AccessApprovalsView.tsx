"use client";

import React, { useMemo, useState } from "react";
import { Check, Clock, KeyRound, ShieldCheck, ShieldX, X } from "lucide-react";
import type { OpsAccessRequest } from "@/types/admin-operations";
import {
  AdminButton,
  AdminSelect,
  ConfirmActionModal,
  FilterBar,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { AdminTable, ResourceStatus, cellClass, formatInstant, humanize, mutedCellClass, type ResourceState } from "../admin-resource";
import { CountKpi, MutationNotice, matchesSearch, paginate, type MutationNoticeState } from "./shared";

const STATUS_OPTIONS = [
  { label: "All Statuses", value: "ALL" },
  { label: "Pending Approval", value: "PENDING_APPROVAL" },
  { label: "Approved", value: "APPROVED" },
  { label: "Rejected", value: "REJECTED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Revoked", value: "REVOKED" },
];

/** Approved and not yet past the server's expiry. */
export function isActiveGrant(r: OpsAccessRequest, now: number = Date.now()): boolean {
  return r.status === "APPROVED" && (!r.expires_at || new Date(r.expires_at).getTime() > now);
}

export interface AccessApprovalsViewProps {
  requests: ResourceState<OpsAccessRequest[]>;
  orgName: (id: string) => string;
  onRetry: () => void;
  busy: string | null;
  notice: MutationNoticeState | null;
  onReload: () => void;
  onDismissNotice: () => void;
  onApprove: (r: OpsAccessRequest) => void;
  onReject: (r: OpsAccessRequest) => void;
}

export function AccessApprovalsView(props: AccessApprovalsViewProps) {
  const { requests, orgName, onRetry, busy, notice, onReload, onDismissNotice } = props;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [confirm, setConfirm] = useState<{ kind: "approve" | "reject"; request: OpsAccessRequest } | null>(null);

  const rows = useMemo(() => (requests.status === "ready" ? requests.data : []), [requests]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          matchesSearch(search, r.id, r.ticket_id, r.requester_email, r.reason, r.org_id ? orgName(r.org_id) : "") &&
          (statusFilter === "ALL" || r.status === statusFilter),
      ),
    [rows, search, statusFilter, orgName],
  );
  const pageData = paginate(filtered, page, pageSize);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Access Approvals"
        badge="Least Privilege"
        description="Approve or deny requests from Platform Operators for temporary diagnostic access to a customer workspace."
      />

      <MutationNotice notice={notice} onReload={onReload} onDismiss={onDismissNotice} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <CountKpi state={requests} count={(d) => d.filter((r) => r.status === "PENDING_APPROVAL").length} label="Pending Review" sublabel="Awaiting Super Admin sign-off" icon={Clock} tone="amber" />
        <CountKpi state={requests} count={(d) => d.filter((r) => isActiveGrant(r)).length} label="Active Approved Windows" sublabel="Approved and not yet expired" icon={ShieldCheck} tone="emerald" />
        <CountKpi
          state={requests}
          count={(d) => d.filter((r) => ["REJECTED", "REVOKED", "EXPIRED"].includes(r.status)).length}
          label="Denied / Revoked / Expired"
          sublabel="Closed requests"
          icon={ShieldX}
          tone="rose"
        />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder="Search requester, ticket, organization, or reason..."
            hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setStatusFilter("ALL");
              setPage(1);
            }}
            filters={
              <div className="w-44">
                <AdminSelect
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by approval status"
                  options={STATUS_OPTIONS}
                />
              </div>
            }
          />
        </div>

        <ResourceStatus
          state={requests}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={KeyRound}
          emptyTitle="No access requests"
          emptyDescription="No Platform Operator has requested support access to a customer workspace."
        />

        {requests.status === "ready" && requests.data.length > 0 && (
          <>
            {pageData.rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--color-text-secondary)]">No requests match your filters.</p>
            ) : (
              <AdminTable label="Support access requests" headers={["Requester", "Organization", "Ticket", "Reason", "Status", "Requested", "Expires", ""]}>
                {pageData.rows.map((r) => (
                  <tr key={r.id} className="hover:bg-[var(--color-elevated)]/50">
                    <td className={cellClass}>
                      <p className="font-semibold">{r.requester_email || "-"}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{r.id}</p>
                    </td>
                    <td className={mutedCellClass}>{r.org_id ? orgName(r.org_id) : "-"}</td>
                    <td className={mutedCellClass}>{r.ticket_id || "-"}</td>
                    <td className={`${mutedCellClass} max-w-xs`}>{r.reason || "-"}</td>
                    <td className={cellClass}>
                      <StatusBadge label={humanize(r.status)} tone={getStatusTone(r.status === "PENDING_APPROVAL" ? "PENDING" : r.status)} dot />
                      {r.status === "APPROVED" && r.approved_by && (
                        <p className="text-[11px] text-[var(--color-text-muted)] mt-1">by {r.approved_by}</p>
                      )}
                    </td>
                    <td className={mutedCellClass}>{formatInstant(r.created_at)}</td>
                    <td className={mutedCellClass}>{formatInstant(r.expires_at)}</td>
                    <td className={cellClass}>
                      {r.status === "PENDING_APPROVAL" && (
                        <div className="flex items-center gap-1.5">
                          <AdminButton size="xs" variant="primary" isLoading={busy === `approve:${r.id}`} disabled={Boolean(busy)} onClick={() => setConfirm({ kind: "approve", request: r })}>
                            <Check className="w-3.5 h-3.5" />
                            Approve
                          </AdminButton>
                          <AdminButton size="xs" variant="outline" isLoading={busy === `reject:${r.id}`} disabled={Boolean(busy)} onClick={() => setConfirm({ kind: "reject", request: r })}>
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </AdminButton>
                        </div>
                      )}
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

      <ConfirmActionModal
        isOpen={confirm?.kind === "approve"}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && props.onApprove(confirm.request)}
        title="Approve Temporary Support Access"
        description={
          confirm
            ? `Grant ${confirm.request.requester_email ?? "this operator"} time-limited access to ${confirm.request.org_id ? orgName(confirm.request.org_id) : "the organization"}. The server sets the expiry and records the approval in the audit trail.`
            : ""
        }
        confirmLabel="Approve Access"
        variant="primary"
      />
      <ConfirmActionModal
        isOpen={confirm?.kind === "reject"}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && props.onReject(confirm.request)}
        title="Reject Access Request?"
        description={confirm ? `The request from ${confirm.request.requester_email ?? "this operator"} will be closed without granting access.` : ""}
        confirmLabel="Reject Request"
      />
    </div>
  );
}
