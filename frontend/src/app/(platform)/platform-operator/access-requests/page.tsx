"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  KeyRound,
  LayoutGrid,
  List,
  Plus,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { OpsAccessRequest } from "@/types/admin-operations";
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
  readyValue,
  rowsOf,
  useOperatorMutation,
  useOperatorResource,
} from "../_components/OperatorLive";
import {
  BulkSelectionBar,
  ConfirmModal,
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
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type AccessSortField = "orgName" | "ticketRef" | "durationHours" | "status" | "requestedAt";

const STATUS_OPTIONS = [
  { label: "Pending Approval", value: "PENDING_APPROVAL" },
  { label: "Approved", value: "APPROVED" },
  { label: "Denied", value: "REJECTED" },
  { label: "Expired", value: "EXPIRED" },
  { label: "Revoked", value: "REVOKED" },
];

const statusOf = (r: OpsAccessRequest) => (r.status || "").toUpperCase();
const statusLabel = (r: OpsAccessRequest) => (statusOf(r) === "REJECTED" ? "Denied" : humanizeCode(r.status));
const orgOf = (r: OpsAccessRequest) => r.org_id || "—";
const ticketOf = (r: OpsAccessRequest) => r.ticket_id || "—";

/** Window length in hours, only when the server has both the approval and the expiry instants. */
function windowHours(r: OpsAccessRequest): number | null {
  if (!r.approved_at || !r.expires_at) return null;
  const ms = new Date(r.expires_at).getTime() - new Date(r.approved_at).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 36e5) : null;
}

export default function OperatorAccessRequestsPage() {
  const { can } = useOperatorPermissions();
  const canRequest = can("access.request");
  /** Final approval decisions belong to Super Admin; operators see the buttons disabled. */
  const canApprove = can("governance.super_admin_only");

  const resource = useOperatorResource(() => operatorApi.accessRequests.list(), "access-requests");
  const accessRequests = rowsOf(resource.state);
  const reload = () => void resource.reload();
  const mutation = useOperatorMutation(reload);

  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<AccessSortField>("requestedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Request Modal: kept, never opened (no create endpoint yet).
  const [createOpen, setCreateOpen] = useState(false);

  // Revoke Confirm: kept, never opened (no revoke endpoint yet).
  const [revokeTarget, setRevokeTarget] = useState<OpsAccessRequest | null>(null);

  const pendingCount = useMemo(() => accessRequests.filter((r) => statusOf(r) === "PENDING_APPROVAL").length, [accessRequests]);
  const activeCount = useMemo(() => accessRequests.filter((r) => statusOf(r) === "APPROVED").length, [accessRequests]);
  const closedCount = useMemo(
    () => accessRequests.filter((r) => ["EXPIRED", "REVOKED", "REJECTED"].includes(statusOf(r))).length,
    [accessRequests]
  );

  const handleSort = (field: AccessSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "requestedAt" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = accessRequests.filter((r) => {
      const matchesQ =
        !q ||
        orgOf(r).toLowerCase().includes(q) ||
        ticketOf(r).toLowerCase().includes(q) ||
        (r.requester_email || "").toLowerCase().includes(q) ||
        (r.reason || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || statusOf(r) === statusFilter;
      return matchesQ && matchesStatus;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "orgName") cmp = orgOf(a).localeCompare(orgOf(b));
      else if (sortField === "ticketRef") cmp = ticketOf(a).localeCompare(ticketOf(b));
      else if (sortField === "durationHours") cmp = (windowHours(a) ?? -1) - (windowHours(b) ?? -1);
      else if (sortField === "status") cmp = statusOf(a).localeCompare(statusOf(b));
      else cmp = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [accessRequests, search, statusFilter, sortField, sortDir]);

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
    filtered.map((r) => r.id),
    paginated.map((r) => r.id)
  );

  const approve = (r: OpsAccessRequest) =>
    void mutation.run(`approve:${r.id}`, () => operatorApi.accessRequests.approve(r.id, r.version), "Access request approved.");
  const reject = (r: OpsAccessRequest) =>
    void mutation.run(`reject:${r.id}`, () => operatorApi.accessRequests.reject(r.id, r.version), "Access request denied.");

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-access-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Ticket Ref", "Organization", "Scope", "Duration (h)", "Status", "Requested At", "Reason"],
      filtered.map((r, i) => [
        i + 1,
        r.ticket_id ?? "",
        r.org_id ?? "",
        "",
        windowHours(r) ?? "",
        statusLabel(r),
        r.created_at ?? "",
        r.reason ?? "",
      ])
    );
    toast.success(`Exported ${filtered.length} access request(s).`);
  };

  /** Approve / Deny for a pending request (real endpoints, expected_version from the row). */
  const decisionButtons = (r: OpsAccessRequest) => {
    const tip = canApprove ? undefined : "Final approval decisions belong to Super Admin.";
    return (
      <span className="inline-flex items-center gap-1.5" title={tip}>
        <OpButton
          variant="primary"
          size="xs"
          disabled={!canApprove || mutation.busy !== null}
          isLoading={mutation.busy === `approve:${r.id}`}
          onClick={() => approve(r)}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Approve
        </OpButton>
        <OpButton
          variant="outline"
          size="xs"
          disabled={!canApprove || mutation.busy !== null}
          isLoading={mutation.busy === `reject:${r.id}`}
          onClick={() => reject(r)}
        >
          <XCircle className="w-3.5 h-3.5" />
          Deny
        </OpButton>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Access Requests"
        badge="Zero Standing Access"
        liveData
        description="Submit justified requests for temporary customer workspace troubleshooting, track expiry, and end sessions early."
        actions={
          <NotAvailableButton variant="primary" size="sm" reason="no access request create endpoint">
            <Plus className="w-4 h-4" />
            Request Access
          </NotAvailableButton>
        }
      />

      <DemoDataBanner
        title="Governance Boundary"
        description="Platform Operators can request and revoke their own active temporary access sessions. Final approval decisions belong exclusively to Super Admin."
      />

      <MutationNotice
        notice={mutation.notice}
        onReload={() => {
          mutation.clearNotice();
          reload();
        }}
        onDismiss={mutation.clearNotice}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Awaiting Super Admin Approval"
          value={readyValue(resource.state, () => pendingCount)}
          sublabel="Queued in Super Admin Approvals"
          icon={Clock}
          tone={pendingCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Active Approved Windows"
          value={readyValue(resource.state, () => activeCount)}
          sublabel="Time-limited troubleshooting sessions"
          icon={ShieldCheck}
          tone="teal"
        />
        <KpiCard
          label="Expired / Ended"
          value={readyValue(resource.state, () => closedCount)}
          sublabel="Expired, revoked or denied"
          icon={CheckCircle2}
          tone="slate"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search organization, ticket #, or scope..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={filtered.length === 0}
          filters={
            <div className="w-48">
              <OpSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by request status"
                options={[{ label: "All Requests", value: "ALL" }, ...STATUS_OPTIONS]}
              />
            </div>
          }
          rightActions={
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("TABLE")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "TABLE"
                    ? "bg-[#0D9488] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("CARDS")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "CARDS"
                    ? "bg-[#0D9488] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards
              </button>
            </div>
          }
        />

        {resource.state.status !== "ready" || paginated.length === 0 ? (
          <div className="space-y-3">
            <OperatorResourceStatus
              state={resource.state.status === "ready" ? { status: "ready", data: paginated } : resource.state}
              isEmpty={(rows) => rows.length === 0}
              onRetry={reload}
              emptyIcon={KeyRound}
              emptyTitle="No access requests found"
              emptyDescription={
                accessRequests.length === 0
                  ? "No support access requests are recorded on the server."
                  : "No support access requests match your search or filter."
              }
            />
            {resource.state.status === "ready" && canRequest && (
              <div className="flex justify-center">
                <NotAvailableButton size="sm" reason="no access request create endpoint">
                  Request Access
                </NotAvailableButton>
              </div>
            )}
          </div>
        ) : viewMode === "TABLE" ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((r) => r.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <NotAvailableButton variant="danger" size="xs" reason="no revoke endpoint">
                  <XCircle className="w-3.5 h-3.5" />
                  Revoke Selected ({selectedIds.length})
                </NotAvailableButton>
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
                        aria-label="Select all access requests on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Organization" active={sortField === "orgName"} direction={sortDir} onSort={() => handleSort("orgName")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Ticket & Scope" active={sortField === "ticketRef"} direction={sortDir} onSort={() => handleSort("ticketRef")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Window" active={sortField === "durationHours"} direction={sortDir} onSort={() => handleSort("durationHours")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Requested" active={sortField === "requestedAt"} direction={sortDir} onSort={() => handleSort("requestedAt")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((req, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(req.id);
                    const hours = windowHours(req);
                    return (
                      <tr key={req.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(req.id)}
                            aria-label={`Select ${ticketOf(req)}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 max-w-[260px]">
                          <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-[10px] font-bold text-teal-700 dark:text-teal-300 shrink-0 mt-0.5">
                              {getOrgInitials(req.requester_email || orgOf(req))}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[var(--color-text-primary)] truncate" title={orgOf(req)}>
                                {orgOf(req)}
                              </p>
                              <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                                {req.reason || "—"}
                                {req.requester_email ? ` · ${req.requester_email}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="space-y-1">
                            <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-1.5 py-0.5 text-[10px] font-bold">
                              {ticketOf(req)}
                            </span>
                            <p className="text-[11px] text-[var(--color-text-secondary)]">
                              <NotAvailableText className="text-[11px]" reason="access scope is not stored" />
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-medium">{hours !== null ? `${hours}h` : "—"}</td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={statusLabel(req)} tone={getStatusTone(statusLabel(req))} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatDateTime(req.created_at ?? "")}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          {statusOf(req) === "PENDING_APPROVAL" ? (
                            <div className="inline-flex flex-col items-end gap-1">
                              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                                <ShieldAlert className="w-3.5 h-3.5" />
                                Super Admin Review
                              </span>
                              {decisionButtons(req)}
                            </div>
                          ) : statusOf(req) === "APPROVED" ? (
                            <NotAvailableButton variant="danger" size="xs" reason="no revoke endpoint">
                              Revoke Early
                            </NotAvailableButton>
                          ) : (
                            <span className="text-[11px] text-[var(--color-text-muted)]">Closed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {paginated.map((req, idx) => {
              const srNo = (safePage - 1) * pageSize + idx + 1;
              const hours = windowHours(req);
              return (
                <div
                  key={req.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
                        #{srNo}
                      </span>
                      <StatusBadge label={statusLabel(req)} tone={getStatusTone(statusLabel(req))} dot />
                      <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold">
                        {ticketOf(req)}
                      </span>
                      <StatusBadge label={`Scope: ${NOT_AVAILABLE}`} tone="info" />
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {hours !== null ? `${hours}h window` : "— window"}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{orgOf(req)}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{req.reason || "—"}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Requested {formatDateTime(req.created_at ?? "")}
                      {req.requester_email ? ` by ${req.requester_email}` : ""}
                      {req.approved_by ? ` · Approved by ${req.approved_by}` : ""}
                      {req.expires_at ? ` · Expires ${formatDateTime(req.expires_at)}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {statusOf(req) === "PENDING_APPROVAL" && (
                      <>
                        <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Waiting for Super Admin
                        </span>
                        {decisionButtons(req)}
                      </>
                    )}
                    {statusOf(req) === "APPROVED" && (
                      <NotAvailableButton variant="danger" size="xs" reason="no revoke endpoint">
                        Revoke Session Early
                      </NotAvailableButton>
                    )}
                  </div>
                </div>
              );
            })}
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

      <OpModal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Request Temporary Support Access"
        description="Submit a time-boxed access request routed to Super Admin for authorization."
        maxWidth="lg"
      >
        <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OpSelect label="Target Organization" value="" disabled onChange={() => undefined} options={[]} />
            <OpInput label="Support Ticket Reference" disabled placeholder="e.g. SUP-5104" />
            <OpSelect
              label="Access Scope"
              value="Read-Only Diagnostics"
              disabled
              onChange={() => undefined}
              options={[
                { label: "Read-Only Diagnostics", value: "Read-Only Diagnostics" },
                { label: "Billing & Sync Check", value: "Billing & Sync Check" },
                { label: "Workspace Troubleshooting", value: "Workspace Troubleshooting" },
              ]}
            />
            <OpSelect
              label="Requested Duration"
              value={2}
              disabled
              onChange={() => undefined}
              options={[
                { label: "1 hour", value: 1 },
                { label: "2 hours", value: 2 },
                { label: "4 hours", value: 4 },
              ]}
            />
          </div>

          <OpTextarea
            label="Reason & Troubleshooting Plan"
            disabled
            placeholder="Explain why temporary access is required to resolve the customer's ticket..."
            rows={3}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </OpButton>
            <NotAvailableButton variant="primary" size="sm" reason="no access request create endpoint">
              Submit Request
            </NotAvailableButton>
          </div>
        </form>
      </OpModal>

      <ConfirmModal
        isOpen={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="End Temporary Support Access?"
        description={
          revokeTarget
            ? `End your approved troubleshooting session for ${orgOf(revokeTarget)} (${ticketOf(revokeTarget)}) now?`
            : ""
        }
        confirmLabel="Revoke Access"
        variant="danger"
        onConfirm={() => setRevokeTarget(null)}
      />
    </div>
  );
}
