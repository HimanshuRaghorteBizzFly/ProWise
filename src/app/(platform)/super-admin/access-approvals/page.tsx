"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  Plus,
  ShieldAlert,
  UserCheck,
  XCircle,
} from "lucide-react";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { AccessApprovalRequest } from "../_types";
import { formatDateTime, isValidEmail } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  ConfirmActionModal,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "../_components/SuperAdminPrimitives";

export default function AccessApprovalsPage() {
  const accessApprovals = useSuperAdminStore((s) => s.accessApprovals);
  const organizations = useSuperAdminStore((s) => s.organizations);
  const operators = useSuperAdminStore((s) => s.operators);
  const requestSupportAccess = useSuperAdminStore((s) => s.requestSupportAccess);
  const decideAccessApproval = useSuperAdminStore((s) => s.decideAccessApproval);
  const revokeAccessApproval = useSuperAdminStore((s) => s.revokeAccessApproval);

  const { can } = useAdminPermissions();
  const canManageSecurity = can("security.manage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Guided Request Modal
  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [customOperatorName, setCustomOperatorName] = useState("");
  const [customOperatorEmail, setCustomOperatorEmail] = useState("");
  const [targetOrgId, setTargetOrgId] = useState("");
  const [ticketRef, setTicketRef] = useState("");
  const [reason, setReason] = useState("");
  const [expiresInHours, setExpiresInHours] = useState<number>(4);
  const [formError, setFormError] = useState<string | null>(null);

  // Approve Duration Modal
  const [approveTarget, setApproveTarget] = useState<AccessApprovalRequest | null>(null);
  const [approveHours, setApproveHours] = useState<number>(4);

  // Deny / Revoke Confirmations
  const [denyTarget, setDenyTarget] = useState<AccessApprovalRequest | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AccessApprovalRequest | null>(null);

  const pendingCount = useMemo(
    () => accessApprovals.filter((r) => r.status === "PENDING").length,
    [accessApprovals]
  );
  const approvedCount = useMemo(
    () => accessApprovals.filter((r) => r.status === "APPROVED").length,
    [accessApprovals]
  );
  const revokedOrDeniedCount = useMemo(
    () => accessApprovals.filter((r) => r.status === "REVOKED" || r.status === "DENIED").length,
    [accessApprovals]
  );

  const filteredRequests = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accessApprovals.filter((req) => {
      const matchesQ =
        !q ||
        req.operatorName.toLowerCase().includes(q) ||
        req.operatorEmail.toLowerCase().includes(q) ||
        req.targetOrgName.toLowerCase().includes(q) ||
        req.ticketRef.toLowerCase().includes(q) ||
        req.reason.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || req.status === statusFilter;
      return matchesQ && matchesStatus;
    });
  }, [accessApprovals, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRequests = filteredRequests.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openNewRequestModal = () => {
    const activeOps = operators.filter((o) => o.status === "ACTIVE");
    setSelectedOperatorId(activeOps[0]?.id || "CUSTOM");
    setCustomOperatorName("");
    setCustomOperatorEmail("");
    setTargetOrgId(organizations[0]?.id || "");
    setTicketRef("");
    setReason("");
    setExpiresInHours(4);
    setFormError(null);
    setRequestOpen(true);
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const chosenOp = operators.find((o) => o.id === selectedOperatorId);
    const operatorName = chosenOp ? chosenOp.name : customOperatorName.trim();
    const operatorEmail = chosenOp ? chosenOp.email : customOperatorEmail.trim();

    if (!operatorName) {
      setFormError("Please select an operator or enter an operator name.");
      return;
    }
    if (!isValidEmail(operatorEmail)) {
      setFormError("Please provide a valid operator email address.");
      return;
    }
    if (!targetOrgId) {
      setFormError("Please select the customer organization requiring access.");
      return;
    }
    if (!ticketRef.trim()) {
      setFormError("Please enter a support ticket or incident reference (e.g. SUP-4180).");
      return;
    }
    if (reason.trim().length < 10) {
      setFormError("Please explain why temporary access is needed (at least 10 characters).");
      return;
    }

    requestSupportAccess({
      operatorName,
      operatorEmail,
      targetOrgId,
      ticketRef: ticketRef.trim(),
      reason: reason.trim(),
      expiresInHours,
    });
    toast.success("Temporary support access request logged for Super Admin review.");
    setRequestOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Access Approvals"
        badge="Least Privilege"
        simulationLabel="Governance Workflow"
        description="Approve, time-box, deny, or immediately revoke temporary Platform Operator access into customer workspaces."
        actions={
          <AdminButton
            variant="primary"
            size="sm"
            permissionLocked={!canManageSecurity}
            onClick={openNewRequestModal}
          >
            <Plus className="w-4 h-4" />
            Log Access Request
          </AdminButton>
        }
      />

      <SimulationNotice
        title="Zero-Standing-Access Policy"
        description="Every approval grants a time-limited window linked to a support ticket and automatically appends to the compliance audit trail."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Pending Review"
          value={pendingCount}
          sublabel="Requests awaiting Super Admin sign-off"
          icon={Clock}
          tone={pendingCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Active Approved Windows"
          value={approvedCount}
          sublabel="Time-boxed support access grants"
          icon={UserCheck}
          tone="blue"
        />
        <KpiCard
          label="Denied / Revoked"
          value={revokedOrDeniedCount}
          sublabel="Closed or terminated early"
          icon={FileCheck2}
          tone="slate"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search operator, organization, or ticket..."
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
                options={[
                  { label: "All Requests", value: "ALL" },
                  { label: "Pending Review", value: "PENDING" },
                  { label: "Approved", value: "APPROVED" },
                  { label: "Denied", value: "DENIED" },
                  { label: "Revoked", value: "REVOKED" },
                ]}
              />
            </div>
          }
        />

        {paginatedRequests.length === 0 ? (
          <EmptyStateView
            icon={ShieldAlert}
            title="No access approval requests found"
            description="No support access requests match the current search or filter."
            actionLabel="Log Access Request"
            onAction={canManageSecurity ? openNewRequestModal : undefined}
          />
        ) : (
          <div className="space-y-3">
            {paginatedRequests.map((req) => (
              <div
                key={req.id}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={req.status} tone={getStatusTone(req.status)} dot />
                    <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-primary)]">
                      {req.ticketRef}
                    </span>
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                      Duration: {req.expiresInHours}h window
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {req.operatorName} <span className="font-normal text-[var(--color-text-secondary)]">requested access to</span>{" "}
                      {req.targetOrgName}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{req.reason}</p>
                  </div>

                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Operator: {req.operatorEmail} · Requested {formatDateTime(req.requestedAt)}
                    {req.reviewedBy && req.reviewedAt
                      ? ` · Reviewed by ${req.reviewedBy} on ${formatDateTime(req.reviewedAt)}`
                      : ""}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {req.status === "PENDING" && (
                    <>
                      <AdminButton
                        variant="primary"
                        size="xs"
                        permissionLocked={!canManageSecurity}
                        onClick={() => {
                          setApproveTarget(req);
                          setApproveHours(req.expiresInHours);
                        }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approve Access
                      </AdminButton>
                      <AdminButton
                        variant="outline"
                        size="xs"
                        permissionLocked={!canManageSecurity}
                        onClick={() => setDenyTarget(req)}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Deny
                      </AdminButton>
                    </>
                  )}
                  {req.status === "APPROVED" && (
                    <AdminButton
                      variant="danger"
                      size="xs"
                      permissionLocked={!canManageSecurity}
                      onClick={() => setRevokeTarget(req)}
                    >
                      Revoke Immediately
                    </AdminButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={filteredRequests.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </SurfaceCard>

      {/* Log New Access Request Modal */}
      <AdminModal
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Log Support Access Request"
        description="Record a guided request for temporary customer workspace diagnostics."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitRequest} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminSelect
              label="Platform Operator"
              value={selectedOperatorId}
              onChange={(e) => setSelectedOperatorId(e.target.value)}
              options={[
                ...operators
                  .filter((o) => o.status === "ACTIVE")
                  .map((op) => ({ label: `${op.name} (${op.department})`, value: op.id })),
                { label: "Other Operator (Enter manually)", value: "CUSTOM" },
              ]}
            />
            <AdminSelect
              label="Target Customer Organization"
              value={targetOrgId}
              onChange={(e) => setTargetOrgId(e.target.value)}
              options={organizations.map((org) => ({ label: org.name, value: org.id }))}
            />
          </div>

          {selectedOperatorId === "CUSTOM" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdminInput
                label="Operator Full Name"
                value={customOperatorName}
                onChange={(e) => setCustomOperatorName(e.target.value)}
                placeholder="e.g. Jordan Hayes"
              />
              <AdminInput
                label="Operator Work Email"
                type="email"
                value={customOperatorEmail}
                onChange={(e) => setCustomOperatorEmail(e.target.value)}
                placeholder="jordan@prowise.io"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdminInput
              label="Ticket / Case Reference"
              value={ticketRef}
              onChange={(e) => setTicketRef(e.target.value)}
              placeholder="e.g. SUP-4180"
              helperText="Links access to an approved support or incident ticket."
            />
            <AdminSelect
              label="Requested Access Window"
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
              options={[
                { label: "1 hour (Quick check)", value: 1 },
                { label: "2 hours (Standard)", value: 2 },
                { label: "4 hours (Extended diagnostics)", value: 4 },
                { label: "8 hours (Shift duration)", value: 8 },
              ]}
            />
          </div>

          <AdminTextarea
            label="Business Justification"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe what the operator needs to inspect and why standard tools are not sufficient..."
            rows={3}
          />

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setRequestOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary" size="sm">
              Submit Request
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Approve Access Window Modal */}
      <AdminModal
        isOpen={Boolean(approveTarget)}
        onClose={() => setApproveTarget(null)}
        title="Approve Temporary Support Access"
        description={
          approveTarget
            ? `Grant ${approveTarget.operatorName} time-limited access to ${approveTarget.targetOrgName}.`
            : undefined
        }
        maxWidth="sm"
      >
        {approveTarget && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs space-y-1">
              <p className="font-semibold text-[var(--color-text-primary)]">
                Ticket: {approveTarget.ticketRef}
              </p>
              <p className="text-[var(--color-text-secondary)]">{approveTarget.reason}</p>
            </div>

            <AdminSelect
              label="Approved Expiry Duration"
              value={approveHours}
              onChange={(e) => setApproveHours(Number(e.target.value))}
              options={[
                { label: "1 hour (Recommended for simple checks)", value: 1 },
                { label: "2 hours", value: 2 },
                { label: "4 hours", value: 4 },
                { label: "8 hours (Maximum single grant)", value: 8 },
              ]}
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton variant="outline" size="sm" onClick={() => setApproveTarget(null)}>
                Cancel
              </AdminButton>
              <AdminButton
                variant="primary"
                size="sm"
                onClick={() => {
                  decideAccessApproval(approveTarget.id, "APPROVED", approveHours);
                  toast.success(
                    `Approved ${approveHours}h access for ${approveTarget.operatorName}.`
                  );
                  setApproveTarget(null);
                }}
              >
                Confirm Approval
              </AdminButton>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Deny Access Confirmation */}
      <ConfirmActionModal
        isOpen={Boolean(denyTarget)}
        onClose={() => setDenyTarget(null)}
        title="Deny Access Request?"
        description={
          denyTarget
            ? `Deny ${denyTarget.operatorName}'s request for ${denyTarget.targetOrgName} (${denyTarget.ticketRef})?`
            : ""
        }
        confirmLabel="Deny Request"
        variant="danger"
        onConfirm={() => {
          if (denyTarget) {
            decideAccessApproval(denyTarget.id, "DENIED");
            toast.success(`Denied access request ${denyTarget.ticketRef}.`);
          }
        }}
      />

      {/* Revoke Active Access Confirmation */}
      <ConfirmActionModal
        isOpen={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Active Support Access?"
        description={
          revokeTarget
            ? `This will immediately terminate ${revokeTarget.operatorName}'s access window to ${revokeTarget.targetOrgName} and record the revocation.`
            : ""
        }
        confirmLabel="Revoke Immediately"
        variant="danger"
        onConfirm={() => {
          if (revokeTarget) {
            revokeAccessApproval(revokeTarget.id);
            toast.success(`Revoked access for ${revokeTarget.operatorName}.`);
          }
        }}
      />
    </div>
  );
}
