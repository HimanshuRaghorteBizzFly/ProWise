"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  CheckCircle2,
  Eye,
  KeyRound,
  Laptop,
  Lock,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { SecurityAlert, SecurityPolicy } from "../_types";
import { formatDateTime } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminSelect,
  ConfirmActionModal,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  SimulationNotice,
  SlideOverDrawer,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "../_components/SuperAdminPrimitives";

export default function SecurityCenterPage() {
  const securityAlerts = useSuperAdminStore((s) => s.securityAlerts);
  const securityPolicies = useSuperAdminStore((s) => s.securityPolicies);
  const accountProfile = useSuperAdminStore((s) => s.accountProfile);
  const accessApprovals = useSuperAdminStore((s) => s.accessApprovals);
  const operators = useSuperAdminStore((s) => s.operators);
  const updateSecurityAlertStatus = useSuperAdminStore((s) => s.updateSecurityAlertStatus);
  const toggleSecurityPolicy = useSuperAdminStore((s) => s.toggleSecurityPolicy);
  const revokeAdminSession = useSuperAdminStore((s) => s.revokeAdminSession);

  const { can } = useAdminPermissions();
  const canManageSecurity = can("security.manage");

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const [inspectAlert, setInspectAlert] = useState<SecurityAlert | null>(null);
  const [pendingPolicy, setPendingPolicy] = useState<SecurityPolicy | null>(null);
  const [pendingRevokeSessionId, setPendingRevokeSessionId] = useState<string | null>(null);

  const openAlerts = useMemo(
    () => securityAlerts.filter((a) => a.status !== "Resolved"),
    [securityAlerts]
  );
  const mfaEnabledOperators = useMemo(
    () => operators.filter((o) => o.status === "ACTIVE" && o.mfaEnabled).length,
    [operators]
  );
  const activeOperatorsCount = useMemo(
    () => operators.filter((o) => o.status === "ACTIVE").length,
    [operators]
  );
  const pendingApprovalsCount = useMemo(
    () => accessApprovals.filter((a) => a.status === "PENDING").length,
    [accessApprovals]
  );
  const activePoliciesCount = useMemo(
    () => securityPolicies.filter((p) => p.enabled).length,
    [securityPolicies]
  );

  const filteredAlerts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return securityAlerts.filter((alert) => {
      const matchesQ =
        !q ||
        alert.title.toLowerCase().includes(q) ||
        alert.description.toLowerCase().includes(q) ||
        alert.affectedTarget.toLowerCase().includes(q) ||
        alert.category.toLowerCase().includes(q);
      const matchesSev = severityFilter === "ALL" || alert.severity === severityFilter;
      const matchesStatus = statusFilter === "ALL" || alert.status === statusFilter;
      return matchesQ && matchesSev && matchesStatus;
    });
  }, [securityAlerts, search, severityFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedAlerts = filteredAlerts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleAlertStatus = (alert: SecurityAlert, nextStatus: SecurityAlert["status"]) => {
    if (!canManageSecurity) {
      toast.error("Your role does not allow updating security alerts.");
      return;
    }
    updateSecurityAlertStatus(alert.id, nextStatus);
    if (inspectAlert?.id === alert.id) {
      setInspectAlert({ ...alert, status: nextStatus });
    }
    toast.success(`Alert marked as ${nextStatus}.`);
  };

  const sessionToRevoke = accountProfile.sessions.find((s) => s.id === pendingRevokeSessionId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Center"
        badge="Governance"
        simulationLabel="Simulated Threat Telemetry"
        description="Monitor platform security alerts, enforce protection policies, review active admin sessions, and oversee access posture."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/super-admin/access-approvals">
              <AdminButton variant="outline" size="sm">
                <UserCheck className="w-3.5 h-3.5" />
                Access Approvals ({pendingApprovalsCount})
              </AdminButton>
            </Link>
            <Link href="/super-admin/audit">
              <AdminButton variant="primary" size="sm">
                <Activity className="w-3.5 h-3.5" />
                View Audit Log
              </AdminButton>
            </Link>
          </div>
        }
      />

      <SimulationNotice
        title="Governance Mode"
        description="Security alerts, session telemetry, and policy switches are backed by local governance state until Spring Boot identity and SIEM integrations are connected."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Open Security Alerts"
          value={openAlerts.length}
          sublabel={`${securityAlerts.filter((a) => a.severity === "High" && a.status !== "Resolved").length} high priority`}
          icon={ShieldAlert}
          tone={openAlerts.length > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Active Policies Enforced"
          value={`${activePoliciesCount} / ${securityPolicies.length}`}
          sublabel="Platform-wide protection rules"
          icon={ShieldCheck}
          tone="blue"
        />
        <KpiCard
          label="Operator MFA Coverage"
          value={`${mfaEnabledOperators} / ${activeOperatorsCount}`}
          sublabel="Active staff protected with 2FA"
          icon={KeyRound}
          tone={mfaEnabledOperators === activeOperatorsCount ? "emerald" : "amber"}
        />
        <KpiCard
          label="Signed-In Admin Sessions"
          value={accountProfile.sessions.length}
          sublabel={`${pendingApprovalsCount} access requests awaiting review`}
          icon={Laptop}
          tone="violet"
        />
      </div>

      {/* Security Alerts */}
      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Security Alerts & Unusual Activity
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Triage automated platform alerts across authentication, billing safeguards, and access reviews.
            </p>
          </div>
        </div>

        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search alerts or affected organization..."
          hasActiveFilters={Boolean(search || severityFilter !== "ALL" || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setSeverityFilter("ALL");
            setStatusFilter("ALL");
            setPage(1);
          }}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <AdminSelect
                  value={severityFilter}
                  onChange={(e) => {
                    setSeverityFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by severity"
                  options={[
                    { label: "All Priorities", value: "ALL" },
                    { label: "High", value: "High" },
                    { label: "Medium", value: "Medium" },
                    { label: "Low", value: "Low" },
                  ]}
                />
              </div>
              <div className="w-40">
                <AdminSelect
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by alert status"
                  options={[
                    { label: "All Statuses", value: "ALL" },
                    { label: "Open", value: "Open" },
                    { label: "Investigating", value: "Investigating" },
                    { label: "Resolved", value: "Resolved" },
                  ]}
                />
              </div>
            </div>
          }
        />

        {paginatedAlerts.length === 0 ? (
          <EmptyStateView
            icon={ShieldCheck}
            title="No security alerts match your filter"
            description="Adjust your search or status filter to view other security events."
          />
        ) : (
          <div className="space-y-2.5">
            {paginatedAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      label={`${alert.severity} Priority`}
                      tone={alert.severity === "High" ? "danger" : alert.severity === "Medium" ? "warning" : "info"}
                    />
                    <StatusBadge label={alert.status} tone={getStatusTone(alert.status)} dot />
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
                      {alert.category}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{alert.title}</p>
                  <p className="text-xs text-[var(--color-text-secondary)]">{alert.description}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Affected: <strong className="text-[var(--color-text-secondary)]">{alert.affectedTarget}</strong> · Detected{" "}
                    {formatDateTime(alert.detectedAt)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <AdminButton variant="outline" size="xs" onClick={() => setInspectAlert(alert)}>
                    <Eye className="w-3.5 h-3.5" />
                    Inspect
                  </AdminButton>
                  {alert.status === "Open" && (
                    <AdminButton
                      variant="subtle"
                      size="xs"
                      permissionLocked={!canManageSecurity}
                      onClick={() => handleAlertStatus(alert, "Investigating")}
                    >
                      Mark Investigating
                    </AdminButton>
                  )}
                  {alert.status !== "Resolved" && (
                    <AdminButton
                      variant="primary"
                      size="xs"
                      permissionLocked={!canManageSecurity}
                      onClick={() => handleAlertStatus(alert, "Resolved")}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resolve
                    </AdminButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={filteredAlerts.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </SurfaceCard>

      {/* Enforced Security Policies & Active Admin Sessions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SurfaceCard className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Platform Security Policies
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Control organization sign-in safeguards and temporary access limits. Changing a policy records an audit event.
              </p>
            </div>
            <Lock className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
          </div>

          <div className="space-y-2.5">
            {securityPolicies.map((policy) => (
              <div
                key={policy.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)]">
                      {policy.title}
                    </span>
                    <StatusBadge
                      label={policy.level}
                      tone={policy.level === "Enforced" ? "info" : "neutral"}
                    />
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                    {policy.description}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Updated {formatDateTime(policy.updatedAt)}
                  </p>
                </div>

                <AdminButton
                  variant={policy.enabled ? "primary" : "outline"}
                  size="xs"
                  permissionLocked={!canManageSecurity}
                  onClick={() => setPendingPolicy(policy)}
                >
                  {policy.enabled ? "Enabled" : "Disabled"}
                </AdminButton>
              </div>
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Active Super Admin Sessions
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Review trusted devices currently signed in and revoke unfamiliar sessions immediately.
              </p>
            </div>
            <Link href="/super-admin/account">
              <AdminButton variant="ghost" size="xs">
                Manage Account
              </AdminButton>
            </Link>
          </div>

          <div className="space-y-2.5">
            {accountProfile.sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)]">
                      {session.device}
                    </span>
                    {session.isCurrent && <StatusBadge label="Current Session" tone="success" dot />}
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {session.browser} · {session.location} ({session.ipMasked})
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    Last seen {formatDateTime(session.lastActiveAt)}
                  </p>
                </div>

                {!session.isCurrent && (
                  <AdminButton
                    variant="outline"
                    size="xs"
                    permissionLocked={!canManageSecurity}
                    onClick={() => setPendingRevokeSessionId(session.id)}
                  >
                    Revoke Access
                  </AdminButton>
                )}
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* Inspect Alert Drawer */}
      <SlideOverDrawer
        isOpen={Boolean(inspectAlert)}
        onClose={() => setInspectAlert(null)}
        title={inspectAlert?.title || "Alert Details"}
        subtitle={inspectAlert ? `${inspectAlert.category} · ${inspectAlert.severity} Priority` : undefined}
      >
        {inspectAlert && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={inspectAlert.status} tone={getStatusTone(inspectAlert.status)} dot />
              <StatusBadge
                label={`${inspectAlert.severity} Severity`}
                tone={inspectAlert.severity === "High" ? "danger" : inspectAlert.severity === "Medium" ? "warning" : "info"}
              />
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-2 text-xs">
              <p className="font-semibold text-[var(--color-text-primary)]">What happened</p>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">{inspectAlert.description}</p>
              <div className="pt-2 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <span className="text-[var(--color-text-muted)] block">Affected Target</span>
                  <span className="font-medium text-[var(--color-text-primary)]">{inspectAlert.affectedTarget}</span>
                </div>
                <div>
                  <span className="text-[var(--color-text-muted)] block">Detected At</span>
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {formatDateTime(inspectAlert.detectedAt)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)] p-4 space-y-2 text-xs">
              <p className="font-semibold text-[var(--color-text-primary)]">Recommended Governance Actions</p>
              <ul className="list-disc pl-4 space-y-1 text-[var(--color-text-secondary)]">
                <li>Verify whether an authorized Platform Operator triggered this activity under an active ticket.</li>
                <li>Check the Audit & Compliance log for matching sign-in or access approval entries.</li>
                <li>Mark the alert Resolved once the risk is verified or mitigated.</li>
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2">
              {inspectAlert.status !== "Investigating" && inspectAlert.status !== "Resolved" && (
                <AdminButton
                  variant="subtle"
                  size="sm"
                  permissionLocked={!canManageSecurity}
                  onClick={() => handleAlertStatus(inspectAlert, "Investigating")}
                >
                  Mark Investigating
                </AdminButton>
              )}
              {inspectAlert.status !== "Resolved" && (
                <AdminButton
                  variant="primary"
                  size="sm"
                  permissionLocked={!canManageSecurity}
                  onClick={() => handleAlertStatus(inspectAlert, "Resolved")}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Resolved
                </AdminButton>
              )}
            </div>
          </div>
        )}
      </SlideOverDrawer>

      {/* Policy Toggle Confirmation */}
      <ConfirmActionModal
        isOpen={Boolean(pendingPolicy)}
        onClose={() => setPendingPolicy(null)}
        title={pendingPolicy?.enabled ? "Disable Security Policy?" : "Enable Security Policy?"}
        description={
          pendingPolicy
            ? `${pendingPolicy.enabled ? "Disabling" : "Enabling"} "${pendingPolicy.title}" applies immediately across platform governance checks and writes an entry to the compliance log.`
            : ""
        }
        confirmLabel={pendingPolicy?.enabled ? "Disable Policy" : "Enable Policy"}
        variant={pendingPolicy?.enabled ? "danger" : "primary"}
        onConfirm={() => {
          if (pendingPolicy) {
            toggleSecurityPolicy(pendingPolicy.id);
            toast.success(
              `Policy "${pendingPolicy.title}" ${pendingPolicy.enabled ? "disabled" : "enabled"}.`
            );
          }
        }}
      />

      {/* Revoke Session Confirmation */}
      <ConfirmActionModal
        isOpen={Boolean(sessionToRevoke)}
        onClose={() => setPendingRevokeSessionId(null)}
        title="Revoke Admin Session?"
        description={
          sessionToRevoke
            ? `This will immediately sign out ${sessionToRevoke.device} (${sessionToRevoke.browser} · ${sessionToRevoke.location}).`
            : ""
        }
        confirmLabel="Revoke Session"
        variant="danger"
        onConfirm={() => {
          if (sessionToRevoke) {
            revokeAdminSession(sessionToRevoke.id);
            toast.success(`Session on ${sessionToRevoke.device} revoked.`);
          }
        }}
      />
    </div>
  );
}
