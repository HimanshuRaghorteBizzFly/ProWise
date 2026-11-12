"use client";

import React, { useMemo, useState } from "react";
import { Activity, Bell, Cpu, Download, Gauge, Plus, Server, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ApiAlertRule } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { exportRowsToCsv, isValidEmail } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  BulkSelectionBar,
  ConfirmActionModal,
  KpiCard,
  PageHeader,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
  useTableSelection,
} from "../_components/SuperAdminPrimitives";
import { ComparisonBarChart } from "../_components/SuperAdminCharts";

export default function SuperAdminApiMonitoringPage() {
  const organizations = useSuperAdminStore((s) => s.organizations);
  const plans = useSuperAdminStore((s) => s.plans);
  const apiAlertRules = useSuperAdminStore((s) => s.apiAlertRules);
  const createApiAlertRule = useSuperAdminStore((s) => s.createApiAlertRule);
  const toggleApiAlertRule = useSuperAdminStore((s) => s.toggleApiAlertRule);
  const deleteApiAlertRule = useSuperAdminStore((s) => s.deleteApiAlertRule);

  const { can } = useAdminPermissions();
  const canManage = can("integrations.manage");

  const [windowRange, setWindowRange] = useState<"24H" | "7D">("24H");
  const [modalOpen, setModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [metric, setMetric] = useState<ApiAlertRule["metric"]>("p99 Latency (ms)");
  const [threshold, setThreshold] = useState("150");
  const [notifyEmail, setNotifyEmail] = useState("ops-alerts@prowise.io");
  const [error, setError] = useState("");
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    apiAlertRules.map((r) => r.id),
    apiAlertRules.map((r) => r.id)
  );

  const latencySeries = useMemo(
    () =>
      windowRange === "24H"
        ? [
            { label: "00:00", primary: 38, secondary: 420 },
            { label: "04:00", primary: 34, secondary: 380 },
            { label: "08:00", primary: 46, secondary: 710 },
            { label: "12:00", primary: 52, secondary: 940 },
            { label: "16:00", primary: 44, secondary: 842 },
            { label: "20:00", primary: 41, secondary: 620 },
          ]
        : [
            { label: "Mon", primary: 44, secondary: 810 },
            { label: "Tue", primary: 48, secondary: 890 },
            { label: "Wed", primary: 42, secondary: 845 },
            { label: "Thu", primary: 55, secondary: 970 },
            { label: "Fri", primary: 46, secondary: 880 },
            { label: "Sat", primary: 35, secondary: 410 },
            { label: "Sun", primary: 33, secondary: 360 },
          ],
    [windowRange]
  );

  const orgUsageRows = useMemo(() => {
    return organizations.slice(0, 6).map((org, idx) => {
      const plan = plans.find((p) => p.id === org.planId);
      const limit = plan?.limits.apiRateLimitPerMin || 600;
      const estimatedUsage = Math.min(limit, Math.round(limit * (0.18 + (idx % 4) * 0.17)));
      return {
        id: org.id,
        name: org.name,
        planName: plan?.name || "Standard",
        used: estimatedUsage,
        limit,
        pct: Math.round((estimatedUsage / limit) * 100),
      };
    });
  }, [organizations, plans]);

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) {
      setError("Enter an alert rule name.");
      return;
    }
    if (!isValidEmail(notifyEmail)) {
      setError("Enter a valid notification email.");
      return;
    }
    createApiAlertRule({
      name: ruleName.trim(),
      metric,
      threshold: Math.max(1, Number(threshold) || 100),
      enabled: true,
      notifyEmail: notifyEmail.trim(),
    });
    toast.success(`Created API threshold rule "${ruleName.trim()}"`);
    setRuleName("");
    setError("");
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="API Monitoring"
        description="Track platform API throughput, response speed, tenant usage quotas, and threshold alert rules."
        simulationLabel="Simulated Telemetry Metrics"
        actions={
          <>
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-xs">
              {(["24H", "7D"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWindowRange(w)}
                  className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                    windowRange === w
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
            <AdminButton
              variant="primary"
              size="sm"
              permissionLocked={!canManage}
              onClick={() => setModalOpen(true)}
            >
              <Plus className="w-3.5 h-3.5" />
              New Alert Rule
            </AdminButton>
          </>
        }
      />

      <SimulationNotice
        title="Simulated Telemetry Stream"
        description="Gateway request volume and latency figures represent simulated platform telemetry until connected to live APM collectors."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Requests / sec" value="842" sublabel="Peak 970 req/s" icon={Activity} tone="blue" />
        <KpiCard label="Response Speed (p99)" value="42 ms" sublabel="Target under 150 ms" icon={Gauge} tone="emerald" />
        <KpiCard label="Error Rate" value="0.02%" sublabel="99.98% successful responses" icon={Server} tone="emerald" />
        <KpiCard
          label="Active Alert Rules"
          value={apiAlertRules.filter((r) => r.enabled).length}
          sublabel={`${apiAlertRules.filter((r) => r.status === "Triggered").length} alert triggered`}
          icon={Cpu}
          tone="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        <SurfaceCard className="lg:col-span-7 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
            Response Latency &amp; Request Volume ({windowRange})
          </h3>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">
            Average p99 response time (ms) alongside request throughput
          </p>
          <ComparisonBarChart
            data={latencySeries}
            primaryLabel="p99 Latency (ms)"
            secondaryLabel="Requests / sec"
            primaryColor="#3B82F6"
            secondaryColor="#10B981"
            height={235}
          />
        </SurfaceCard>

        <SurfaceCard className="lg:col-span-5 p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Organization API Usage vs Plan Limit
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Requests per minute compared against each tenant&apos;s plan quota
            </p>
          </div>
          <div className="space-y-3">
            {orgUsageRows.map((row) => (
              <div key={row.id} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--color-text-primary)] truncate">
                    {row.name}{" "}
                    <span className="text-[10px] text-[var(--color-text-muted)]">({row.planName})</span>
                  </span>
                  <span className="text-[11px] text-[var(--color-text-secondary)] shrink-0">
                    {row.used.toLocaleString()} / {row.limit.toLocaleString()} rpm
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-elevated)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${row.pct > 75 ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* Alert Rules */}
      <SurfaceCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 sm:px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-500" />
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                API Threshold Alert Rules
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Automated notifications when gateway usage or error rates exceed safe limits
              </p>
            </div>
          </div>
        </div>

        <BulkSelectionBar
          selectedCount={selectedIds.length}
          totalFilteredCount={apiAlertRules.length}
          onSelectAllMatching={() => setSelectedIds(apiAlertRules.map((r) => r.id))}
          onClear={() => setSelectedIds([])}
          actions={
            <>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canManage}
                onClick={() => {
                  let count = 0;
                  for (const id of selectedIds) {
                    const r = apiAlertRules.find((item) => item.id === id);
                    if (r && !r.enabled) {
                      toggleApiAlertRule(id);
                      count++;
                    }
                  }
                  if (count === 0) toast.info("Selected rules are already enabled.");
                  else {
                    toast.success(`Enabled ${count} alert rule${count === 1 ? "" : "s"}`);
                    setSelectedIds([]);
                  }
                }}
              >
                Enable Selected
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canManage}
                onClick={() => {
                  let count = 0;
                  for (const id of selectedIds) {
                    const r = apiAlertRules.find((item) => item.id === id);
                    if (r && r.enabled) {
                      toggleApiAlertRule(id);
                      count++;
                    }
                  }
                  if (count === 0) toast.info("Selected rules are already paused.");
                  else {
                    toast.warning(`Paused ${count} alert rule${count === 1 ? "" : "s"}`);
                    setSelectedIds([]);
                  }
                }}
              >
                Pause Selected
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!can("system.export")}
                onClick={() => {
                  const targets = apiAlertRules.filter((r) => selectedSet.has(r.id));
                  exportRowsToCsv(
                    "prowise-api-alert-rules.csv",
                    ["Sr. No.", "Rule Name", "Metric", "Threshold", "Notify Email", "Status"],
                    targets.map((r, idx) => [
                      idx + 1,
                      r.name,
                      r.metric,
                      r.threshold,
                      r.notifyEmail,
                      r.enabled ? r.status : "Paused",
                    ])
                  );
                  toast.success(`Exported ${targets.length} alert rule${targets.length === 1 ? "" : "s"}`);
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </AdminButton>
              <AdminButton
                variant="danger"
                size="xs"
                permissionLocked={!canManage}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete Selected
              </AdminButton>
            </>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected;
                    }}
                    onChange={toggleSelectPage}
                    aria-label="Select all API alert rules"
                    className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                </th>
                <th className="px-4 py-3 w-16 whitespace-nowrap">Sr. No.</th>
                <th className="px-4 py-3">Rule Name</th>
                <th className="px-4 py-3">Metric &amp; Threshold</th>
                <th className="px-4 py-3 hidden md:table-cell">Notify Email</th>
                <th className="px-4 py-3">Condition</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {apiAlertRules.map((rule, idx) => {
                const isSelected = selectedSet.has(rule.id);
                return (
                  <tr
                    key={rule.id}
                    className={`hover:bg-[var(--color-hover)] transition-colors ${
                      isSelected ? "bg-blue-500/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(rule.id)}
                        aria-label={`Select rule ${rule.name}`}
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--color-text-primary)]">{rule.name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                        {rule.metric} &gt; <strong className="ml-1">{rule.threshold}</strong>
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-[var(--color-text-secondary)]">
                      {rule.notifyEmail}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        label={rule.enabled ? rule.status : "Paused"}
                        tone={!rule.enabled ? "neutral" : rule.status === "Triggered" ? "warning" : "success"}
                        dot
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <AdminButton
                          variant="outline"
                          size="xs"
                          permissionLocked={!canManage}
                          onClick={() => {
                            toggleApiAlertRule(rule.id);
                            toast.info(`${rule.enabled ? "Paused" : "Enabled"} "${rule.name}"`);
                          }}
                        >
                          {rule.enabled ? "Pause" : "Enable"}
                        </AdminButton>
                        <AdminButton
                          variant="ghost"
                          size="xs"
                          permissionLocked={!canManage}
                          className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                          onClick={() => {
                            deleteApiAlertRule(rule.id);
                            toast.success(`Removed alert rule "${rule.name}"`);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </AdminButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <ConfirmActionModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.length} selected alert rule${selectedIds.length === 1 ? "" : "s"}?`}
        description="Selected threshold monitoring rules will be removed."
        confirmLabel="Delete Selected"
        variant="danger"
        onConfirm={() => {
          const count = selectedIds.length;
          for (const id of selectedIds) deleteApiAlertRule(id);
          toast.success(`Removed ${count} alert rule${count === 1 ? "" : "s"}`);
          setSelectedIds([]);
        }}
      />

      <AdminModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create API Alert Rule"
        maxWidth="md"
      >
        <form onSubmit={handleCreateRule} className="space-y-4">
          <AdminInput
            label="Alert Name"
            value={ruleName}
            onChange={(e) => setRuleName(e.target.value)}
            placeholder="e.g. Elevated Latency Warning"
            error={error}
          />
          <div className="grid grid-cols-2 gap-3">
            <AdminSelect
              label="Monitored Metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value as ApiAlertRule["metric"])}
              options={[
                { label: "p99 Latency (ms)", value: "p99 Latency (ms)" },
                { label: "Error Rate (%)", value: "Error Rate (%)" },
                { label: "Requests per Minute", value: "Requests per Minute" },
              ]}
            />
            <AdminInput
              label="Alert Threshold"
              type="number"
              min="1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
          <AdminInput
            label="Notification Email"
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary">
              Create Alert Rule
            </AdminButton>
          </div>
        </form>
      </AdminModal>
    </div>
  );
}
