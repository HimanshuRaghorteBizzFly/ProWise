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
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { SupportAccessRequestItem } from "../_types";
import { exportRowsToCsv, formatDateTime } from "../_services/operator-service";
import {
  BulkSelectionBar,
  ConfirmModal,
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
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type AccessSortField = "orgName" | "ticketRef" | "durationHours" | "status" | "requestedAt";

export default function OperatorAccessRequestsPage() {
  const accessRequests = usePlatformOperatorStore((s) => s.accessRequests);
  const orgHealth = usePlatformOperatorStore((s) => s.orgHealth);
  const submitAccessRequest = usePlatformOperatorStore((s) => s.submitAccessRequest);
  const revokeAccessRequest = usePlatformOperatorStore((s) => s.revokeAccessRequest);
  const bulkRevokeAccessRequests = usePlatformOperatorStore((s) => s.bulkRevokeAccessRequests);
  const { can } = useOperatorPermissions();
  const canRequest = can("access.request");

  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<AccessSortField>("requestedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Request Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [orgId, setOrgId] = useState("");
  const [ticketRef, setTicketRef] = useState("");
  const [scope, setScope] = useState<SupportAccessRequestItem["scope"]>("Read-Only Diagnostics");
  const [durationHours, setDurationHours] = useState(2);
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Revoke Confirm
  const [revokeTarget, setRevokeTarget] = useState<SupportAccessRequestItem | null>(null);

  const closeOverlays = () => {
    setCreateOpen(false);
    setRevokeTarget(null);
  };

  const pendingCount = useMemo(
    () => accessRequests.filter((r) => r.status === "Pending Approval").length,
    [accessRequests]
  );
  const activeCount = useMemo(
    () => accessRequests.filter((r) => r.status === "Approved").length,
    [accessRequests]
  );
  const closedCount = useMemo(
    () =>
      accessRequests.filter(
        (r) => r.status === "Expired" || r.status === "Revoked" || r.status === "Denied"
      ).length,
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
        r.orgName.toLowerCase().includes(q) ||
        r.ticketRef.toLowerCase().includes(q) ||
        r.scope.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || r.status === statusFilter;
      return matchesQ && matchesStatus;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "orgName") cmp = a.orgName.localeCompare(b.orgName);
      else if (sortField === "ticketRef") cmp = a.ticketRef.localeCompare(b.ticketRef);
      else if (sortField === "durationHours") cmp = a.durationHours - b.durationHours;
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else cmp = new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
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

  const openModal = () => {
    closeOverlays();
    setOrgId(orgHealth[0]?.id || "org-acme");
    setTicketRef("");
    setScope("Read-Only Diagnostics");
    setDurationHours(2);
    setReason("");
    setFormError(null);
    setCreateOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenOrg = orgHealth.find((o) => o.id === orgId);
    if (!chosenOrg) {
      setFormError("Please select the target organization.");
      return;
    }
    if (!ticketRef.trim()) {
      setFormError("Please link a valid support ticket reference (e.g. SUP-5104).");
      return;
    }
    if (reason.trim().length < 10) {
      setFormError("Please explain why temporary access is required (at least 10 characters).");
      return;
    }
    submitAccessRequest({
      orgId: chosenOrg.id,
      orgName: chosenOrg.orgName,
      ticketRef: ticketRef.trim(),
      scope,
      reason: reason.trim(),
      durationHours,
    });
    toast.success("Access request submitted to Super Admin for approval.");
    setCreateOpen(false);
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-access-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Ticket Ref", "Organization", "Scope", "Duration (h)", "Status", "Requested At", "Reason"],
      filtered.map((r, i) => [
        i + 1,
        r.ticketRef,
        r.orgName,
        r.scope,
        r.durationHours,
        r.status,
        r.requestedAt,
        r.reason,
      ])
    );
    toast.success(`Exported ${filtered.length} access request(s).`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Access Requests"
        badge="Zero Standing Access"
        demoLabel="Super Admin Approval Required"
        description="Submit justified requests for temporary customer workspace troubleshooting, track expiry, and end sessions early."
        actions={
          <OpButton variant="primary" size="sm" disabled={!canRequest} onClick={openModal}>
            <Plus className="w-4 h-4" />
            Request Access
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Governance Boundary"
        description="Platform Operators can request and revoke their own active temporary access sessions. Final approval decisions belong exclusively to Super Admin."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Awaiting Super Admin Approval"
          value={pendingCount}
          sublabel="Queued in Super Admin Approvals"
          icon={Clock}
          tone={pendingCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Active Approved Windows"
          value={activeCount}
          sublabel="Time-limited troubleshooting sessions"
          icon={ShieldCheck}
          tone="teal"
        />
        <KpiCard
          label="Expired / Ended"
          value={closedCount}
          sublabel="Automatically expired or revoked early"
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
                options={[
                  { label: "All Requests", value: "ALL" },
                  { label: "Pending Approval", value: "Pending Approval" },
                  { label: "Approved", value: "Approved" },
                  { label: "Denied", value: "Denied" },
                  { label: "Expired", value: "Expired" },
                  { label: "Revoked", value: "Revoked" },
                ]}
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

        {paginated.length === 0 ? (
          <EmptyState
            icon={KeyRound}
            title="No access requests found"
            description="No support access requests match your search or filter."
            actionLabel={canRequest ? "Request Access" : undefined}
            onAction={canRequest ? openModal : undefined}
          />
        ) : viewMode === "TABLE" ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((r) => r.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="danger"
                  size="xs"
                  disabled={!canRequest}
                  onClick={() => {
                    const count = bulkRevokeAccessRequests(selectedIds);
                    toast.success(`Revoked ${count} selected access window(s).`);
                    setSelectedIds([]);
                  }}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Revoke Selected ({selectedIds.length})
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
                    return (
                      <tr key={req.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(req.id)}
                            aria-label={`Select ${req.ticketRef}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 max-w-[260px]">
                          <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-teal-500/15 border border-teal-500/25 flex items-center justify-center text-[10px] font-bold text-teal-700 dark:text-teal-300 shrink-0 mt-0.5">
                              {getOrgInitials(req.orgName)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[var(--color-text-primary)] truncate">{req.orgName}</p>
                              <p className="text-[11px] text-[var(--color-text-muted)] truncate">{req.reason}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="space-y-1">
                            <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-1.5 py-0.5 text-[10px] font-bold">
                              {req.ticketRef}
                            </span>
                            <p className="text-[11px] text-[var(--color-text-secondary)]">{req.scope}</p>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap font-medium">{req.durationHours}h</td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={req.status} tone={getStatusTone(req.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatDateTime(req.requestedAt)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          {req.status === "Pending Approval" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Super Admin Review
                            </span>
                          ) : req.status === "Approved" ? (
                            <OpButton
                              variant="danger"
                              size="xs"
                              disabled={!canRequest}
                              onClick={() => {
                                closeOverlays();
                                setRevokeTarget(req);
                              }}
                            >
                              Revoke Early
                            </OpButton>
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
                      <StatusBadge label={req.status} tone={getStatusTone(req.status)} dot />
                      <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold">
                        {req.ticketRef}
                      </span>
                      <StatusBadge label={req.scope} tone="info" />
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {req.durationHours}h window
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {req.orgName}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{req.reason}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Requested {formatDateTime(req.requestedAt)}
                      {req.reviewedBy ? ` · Approved by ${req.reviewedBy}` : ""}
                      {req.expiresAt ? ` · Expires ${formatDateTime(req.expiresAt)}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {req.status === "Pending Approval" && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Waiting for Super Admin
                      </span>
                    )}
                    {req.status === "Approved" && (
                      <OpButton
                        variant="danger"
                        size="xs"
                        disabled={!canRequest}
                        onClick={() => {
                          closeOverlays();
                          setRevokeTarget(req);
                        }}
                      >
                        Revoke Session Early
                      </OpButton>
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
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OpSelect
              label="Target Organization"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              options={orgHealth.map((o) => ({ label: o.orgName, value: o.id }))}
            />
            <OpInput
              label="Support Ticket Reference"
              value={ticketRef}
              onChange={(e) => setTicketRef(e.target.value)}
              placeholder="e.g. SUP-5104"
            />
            <OpSelect
              label="Access Scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as SupportAccessRequestItem["scope"])}
              options={[
                { label: "Read-Only Diagnostics", value: "Read-Only Diagnostics" },
                { label: "Billing & Sync Check", value: "Billing & Sync Check" },
                { label: "Workspace Troubleshooting", value: "Workspace Troubleshooting" },
              ]}
            />
            <OpSelect
              label="Requested Duration"
              value={durationHours}
              onChange={(e) => setDurationHours(Number(e.target.value))}
              options={[
                { label: "1 hour", value: 1 },
                { label: "2 hours", value: 2 },
                { label: "4 hours", value: 4 },
              ]}
            />
          </div>

          <OpTextarea
            label="Reason & Troubleshooting Plan"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why temporary access is required to resolve the customer's ticket..."
            rows={3}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
              Cancel
            </OpButton>
            <OpButton type="submit" variant="primary" size="sm">
              Submit Request
            </OpButton>
          </div>
        </form>
      </OpModal>

      <ConfirmModal
        isOpen={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="End Temporary Support Access?"
        description={
          revokeTarget
            ? `End your approved troubleshooting session for ${revokeTarget.orgName} (${revokeTarget.ticketRef}) now?`
            : ""
        }
        confirmLabel="Revoke Access"
        variant="danger"
        onConfirm={() => {
          if (revokeTarget) {
            revokeAccessRequest(revokeTarget.id);
            toast.success(`Access window for ${revokeTarget.orgName} ended.`);
          }
        }}
      />
    </div>
  );
}
