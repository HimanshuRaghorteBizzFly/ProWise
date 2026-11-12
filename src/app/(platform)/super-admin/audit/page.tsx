"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  ShieldCheck,
} from "lucide-react";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { exportRowsToCsv, formatDateTime } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  BulkSelectionBar,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/SuperAdminPrimitives";

export default function AuditCompliancePage() {
  const activities = useSuperAdminStore((s) => s.activities);
  const securityPolicies = useSuperAdminStore((s) => s.securityPolicies);
  const policySettings = useSuperAdminStore((s) => s.policySettings);

  const { can } = useAdminPermissions();
  const canExport = can("system.export");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const criticalCount = useMemo(
    () => activities.filter((a) => a.severity === "CRITICAL").length,
    [activities]
  );
  const warningCount = useMemo(
    () => activities.filter((a) => a.severity === "WARNING").length,
    [activities]
  );
  const enforcedPoliciesCount = useMemo(
    () => securityPolicies.filter((p) => p.enabled).length,
    [securityPolicies]
  );

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;

    return activities.filter((log) => {
      const matchesQ =
        !q ||
        log.action.toLowerCase().includes(q) ||
        log.summary.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q) ||
        (log.targetLabel || "").toLowerCase().includes(q);
      const matchesCat = categoryFilter === "ALL" || log.category === categoryFilter;
      const matchesSev = severityFilter === "ALL" || log.severity === severityFilter;
      const matchesDate = !fromMs || new Date(log.timestamp).getTime() >= fromMs;
      return matchesQ && matchesCat && matchesSev && matchesDate;
    });
  }, [activities, search, categoryFilter, severityFilter, dateFrom]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedLogs = filteredLogs.slice((safePage - 1) * pageSize, safePage * pageSize);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    filteredLogs.map((l) => l.id),
    paginatedLogs.map((l) => l.id)
  );

  const handleExportAuditCsv = () => {
    if (!canExport) {
      toast.error("Your role does not permit exporting compliance logs.");
      return;
    }
    exportRowsToCsv(
      `prowise-audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Timestamp", "Category", "Severity", "Action", "Summary", "Actor", "Actor Email", "Target"],
      filteredLogs.map((l) => [
        l.timestamp,
        l.category,
        l.severity,
        l.action,
        l.summary,
        l.actorName,
        l.actorEmail,
        l.targetLabel || "—",
      ])
    );
    toast.success(`Exported ${filteredLogs.length} audit record(s) to CSV.`);
  };

  const handleExportCompliancePack = () => {
    if (!canExport) {
      toast.error("Your role does not permit exporting compliance reports.");
      return;
    }
    exportRowsToCsv(
      `prowise-compliance-attestation-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Control Name", "Level", "Status", "Retention Window (Days)", "Last Reviewed"],
      securityPolicies.map((p) => [
        p.title,
        p.level,
        p.enabled ? "Enabled" : "Disabled",
        policySettings.auditRetentionDays,
        p.updatedAt,
      ])
    );
    toast.success("Downloaded compliance control summary CSV.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit & Compliance"
        badge={`${activities.length} Events`}
        simulationLabel="Client-Side Export"
        description="Search the tamper-evident governance activity history, filter high-risk actions, and download compliance reports."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              variant="outline"
              size="sm"
              permissionLocked={!canExport}
              onClick={handleExportCompliancePack}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Compliance Summary CSV
            </AdminButton>
            <AdminButton
              variant="primary"
              size="sm"
              permissionLocked={!canExport}
              onClick={handleExportAuditCsv}
            >
              <Download className="w-3.5 h-3.5" />
              Export Filtered Log
            </AdminButton>
          </div>
        }
      />

      <SimulationNotice
        title="Immutable Local Audit Feed"
        description="Every administrative change across organizations, billing, roles, security, integrations, and configuration appends directly to this ledger."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Recorded Audit Events"
          value={activities.length}
          sublabel={`Retention target: ${policySettings.auditRetentionDays} days`}
          icon={ClipboardCheck}
          tone="blue"
        />
        <KpiCard
          label="Warning / Critical Actions"
          value={warningCount + criticalCount}
          sublabel={`${criticalCount} critical sensitivity`}
          icon={ShieldCheck}
          tone={criticalCount > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Compliance Controls Active"
          value={`${enforcedPoliciesCount} / ${securityPolicies.length}`}
          sublabel="Enforced platform safeguards"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Operator MFA Policy"
          value={policySettings.enforceMfaForOperators ? "Mandatory" : "Optional"}
          sublabel="Configured in Platform Configuration"
          icon={ShieldCheck}
          tone={policySettings.enforceMfaForOperators ? "emerald" : "amber"}
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search action, person, organization, or summary..."
          hasActiveFilters={Boolean(
            search || categoryFilter !== "ALL" || severityFilter !== "ALL" || dateFrom
          )}
          onResetFilters={() => {
            setSearch("");
            setCategoryFilter("ALL");
            setSeverityFilter("ALL");
            setDateFrom("");
            setPage(1);
          }}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <AdminSelect
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by category"
                  options={[
                    { label: "All Categories", value: "ALL" },
                    { label: "Organizations", value: "ORGANIZATION" },
                    { label: "Operators", value: "OPERATOR" },
                    { label: "Roles", value: "ROLE" },
                    { label: "Billing & Plans", value: "PLAN" },
                    { label: "Subscriptions", value: "SUBSCRIPTION" },
                    { label: "Payments", value: "PAYMENT" },
                    { label: "Invoices", value: "INVOICE" },
                    { label: "Integrations", value: "INTEGRATION" },
                    { label: "Security", value: "SECURITY" },
                    { label: "Communication", value: "COMMUNICATION" },
                    { label: "Platform", value: "PLATFORM" },
                  ]}
                />
              </div>
              <div className="w-36">
                <AdminSelect
                  value={severityFilter}
                  onChange={(e) => {
                    setSeverityFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by severity"
                  options={[
                    { label: "All Levels", value: "ALL" },
                    { label: "Info", value: "INFO" },
                    { label: "Warning", value: "WARNING" },
                    { label: "Critical", value: "CRITICAL" },
                  ]}
                />
              </div>
              <div className="w-40">
                <AdminInput
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPage(1);
                  }}
                  aria-label="From date"
                />
              </div>
            </div>
          }
        />

        <BulkSelectionBar
          selectedCount={selectedIds.length}
          totalFilteredCount={filteredLogs.length}
          onSelectAllMatching={() => setSelectedIds(filteredLogs.map((l) => l.id))}
          onClear={() => setSelectedIds([])}
          actions={
            <AdminButton
              variant="outline"
              size="xs"
              permissionLocked={!canExport}
              onClick={() => {
                const targets = filteredLogs.filter((l) => selectedSet.has(l.id));
                exportRowsToCsv(
                  `prowise-audit-selected-${new Date().toISOString().slice(0, 10)}.csv`,
                  ["Sr. No.", "Timestamp", "Category", "Severity", "Action", "Summary", "Actor", "Actor Email", "Target"],
                  targets.map((l, idx) => [
                    idx + 1,
                    l.timestamp,
                    l.category,
                    l.severity,
                    l.action,
                    l.summary,
                    l.actorName,
                    l.actorEmail,
                    l.targetLabel || "—",
                  ])
                );
                toast.success(`Exported ${targets.length} selected audit record(s) to CSV.`);
              }}
            >
              <Download className="w-3.5 h-3.5" />
              Export Selected CSV
            </AdminButton>
          }
        />

        {paginatedLogs.length === 0 ? (
          <EmptyStateView
            icon={ClipboardCheck}
            title="No audit events match your filters"
            description="Adjust the category, severity, date, or search terms to view logged administrative actions."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left border-collapse min-w-[720px] text-xs">
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
                      aria-label="Select all audit events on this page"
                      className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="py-3 px-4 w-16 whitespace-nowrap">Sr. No.</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Area</th>
                  <th className="py-3 px-4">Action &amp; Details</th>
                  <th className="py-3 px-4">Performed By</th>
                  <th className="py-3 px-4">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-xs">
                {paginatedLogs.map((log, idx) => {
                  const serialNumber = (safePage - 1) * pageSize + idx + 1;
                  const isSelected = selectedSet.has(log.id);
                  return (
                    <tr
                      key={log.id}
                      className={`hover:bg-[var(--color-hover)] transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(log.id)}
                          aria-label={`Select audit event ${log.action}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="py-3 px-4 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-[var(--color-text-secondary)]">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                          {log.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 min-w-[260px]">
                        <p className="font-semibold text-[var(--color-text-primary)]">{log.action}</p>
                        <p className="text-[var(--color-text-secondary)] mt-0.5">{log.summary}</p>
                        {log.targetLabel && (
                          <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                            Target: {log.targetLabel}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full border border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {getOrgInitials(log.actorName)}
                          </div>
                          <div>
                            <p className="font-medium text-[var(--color-text-primary)]">{log.actorName}</p>
                            <p className="text-[11px] text-[var(--color-text-muted)]">{log.actorEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge
                          label={log.severity}
                          tone={
                            log.severity === "CRITICAL"
                              ? "danger"
                              : log.severity === "WARNING"
                              ? "warning"
                              : getStatusTone("INFO")
                          }
                          dot
                        />
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
          totalItems={filteredLogs.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </SurfaceCard>
    </div>
  );
}
