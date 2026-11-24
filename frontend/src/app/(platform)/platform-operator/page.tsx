"use client";

import { previewEnabled } from "@/lib/permissions";
import { LiveOperatorDashboard } from "./_components/LiveOperatorDashboard";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FileWarning,
  Flame,
  HelpCircle,
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  MailPlus,
  MailWarning,
  Megaphone,
  Radio,
  RefreshCw,
  RotateCcw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { usePlatformOperatorStore } from "./_store/usePlatformOperatorStore";
import { useSuperAdminStore } from "../super-admin/_store/useSuperAdminStore";
import { formatDateTime } from "./_services/operator-service";
import {
  DEPARTMENT_DEFAULT_MODULES,
  OPERATOR_DEPARTMENTS,
  OPERATOR_MODULE_CATALOG,
  OperatorDepartmentName,
  isRouteAuthorized,
  normalizeDepartmentName,
  resolveEffectivePermission,
} from "./_services/operator-permission-service";
import {
  DemoDataBanner,
  KpiCard,
  OpButton,
  PageHeader,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "./_components/OperatorPrimitives";
import { QueueBarChart, TelemetryAreaChart } from "./_components/OperatorCharts";

function getDepartmentBadgeClass(dept: string): string {
  const key = dept.toLowerCase();
  if (key.includes("operations")) return "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300";
  if (key.includes("site") || key.includes("reliability")) return "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300";
  if (key.includes("message") || key.includes("messaging") || key.includes("lifecycle")) return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (key.includes("customer") || key.includes("support") || key.includes("communication")) return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  if (key.includes("finance") || key.includes("tax")) return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (key.includes("revenue") || key.includes("revops")) return "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300";
  if (key.includes("trust") || key.includes("compliance") || key.includes("security")) return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
  return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
}

function PreviewPlatformOperatorDashboardPage() {
  const orgHealth = usePlatformOperatorStore((s) => s.orgHealth);
  const systemMetrics = usePlatformOperatorStore((s) => s.systemMetrics);
  const incidents = usePlatformOperatorStore((s) => s.incidents);
  const tickets = usePlatformOperatorStore((s) => s.tickets);
  const webhooks = usePlatformOperatorStore((s) => s.webhooks);
  const syncJobs = usePlatformOperatorStore((s) => s.syncJobs);
  const apiEndpoints = usePlatformOperatorStore((s) => s.apiEndpoints);
  const alerts = usePlatformOperatorStore((s) => s.alerts);
  const accessRequests = usePlatformOperatorStore((s) => s.accessRequests);
  const paymentFailures = usePlatformOperatorStore((s) => s.paymentFailures);
  const invoiceDeliveries = usePlatformOperatorStore((s) => s.invoiceDeliveries);
  const emailDeliveries = usePlatformOperatorStore((s) => s.emailDeliveries);
  const emailDrafts = usePlatformOperatorStore((s) => s.emailDrafts);
  const announcementDrafts = usePlatformOperatorStore((s) => s.announcementDrafts);
  const subscriptions = usePlatformOperatorStore((s) => s.subscriptions);
  const backups = usePlatformOperatorStore((s) => s.backups);
  const maintenanceWindows = usePlatformOperatorStore((s) => s.maintenanceWindows);
  const smtpHealth = usePlatformOperatorStore((s) => s.smtpHealth);
  const activityLogs = usePlatformOperatorStore((s) => s.activityLogs);
  const accountSettings = usePlatformOperatorStore((s) => s.accountSettings);
  const setOperatorDepartment = usePlatformOperatorStore((s) => s.setOperatorDepartment);
  const setActiveOperatorProfile = usePlatformOperatorStore((s) => s.setActiveOperatorProfile);
  const lastTelemetryTickAt = usePlatformOperatorStore((s) => s.lastTelemetryTickAt);
  const tickLiveDemoMetrics = usePlatformOperatorStore((s) => s.tickLiveDemoMetrics);
  const acknowledgeAlert = usePlatformOperatorStore((s) => s.acknowledgeAlert);
  const createIncidentFromAlert = usePlatformOperatorStore((s) => s.createIncidentFromAlert);
  const retryWebhookEvent = usePlatformOperatorStore((s) => s.retryWebhookEvent);
  const retryAllFailedWebhooks = usePlatformOperatorStore((s) => s.retryAllFailedWebhooks);
  const retryPaymentFailure = usePlatformOperatorStore((s) => s.retryPaymentFailure);
  const resendEmailDelivery = usePlatformOperatorStore((s) => s.resendEmailDelivery);

  const superAdminOperators = useSuperAdminStore((s) => s.operators);

  const [autoPulseEnabled, setAutoPulseEnabled] = useState(true);
  const [deptPickerOpen, setDeptPickerOpen] = useState(false);

  // Active department and operator resolution
  const activeDepartmentRaw = accountSettings.department || "Site Reliability";
  const activeDepartment = normalizeDepartmentName(activeDepartmentRaw);

  const activeOperator = useMemo(() => {
    const byId = superAdminOperators.find((o) => o.id === accountSettings.activeOperatorId);
    if (byId) return byId;
    const byDept = superAdminOperators.find((o) => o.department === activeDepartment);
    if (byDept) return byDept;
    return {
      id: "op-current",
      name: accountSettings.name,
      email: accountSettings.email,
      department: activeDepartment,
      roleId: "role-platform-operator",
      status: "ACTIVE" as const,
      mfaEnabled: accountSettings.mfaEnabled,
      onCall: true,
      shiftName: accountSettings.shiftName,
      permissionOverrides: [],
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }, [superAdminOperators, accountSettings, activeDepartment]);

  const permissionOverrides = useMemo(
    () => activeOperator.permissionOverrides || [],
    [activeOperator.permissionOverrides]
  );

  // Check if a specific module can be viewed under current department and overrides
  const canViewModule = useCallback(
    (moduleKey: string) => {
      return resolveEffectivePermission(activeDepartment, moduleKey, "view", permissionOverrides).allowed;
    },
    [activeDepartment, permissionOverrides]
  );

  // Count authorized operational modules
  const authorizedModulesCount = useMemo(() => {
    return OPERATOR_MODULE_CATALOG.filter((mod) => canViewModule(mod.key)).length;
  }, [canViewModule]);

  useEffect(() => {
    if (!autoPulseEnabled || accountSettings.autoRefreshSeconds === 0) return;
    const ms = Math.max(5000, accountSettings.autoRefreshSeconds * 1000);
    const id = setInterval(() => {
      tickLiveDemoMetrics();
    }, ms);
    return () => clearInterval(id);
  }, [autoPulseEnabled, accountSettings.autoRefreshSeconds, tickLiveDemoMetrics]);

  // Derived metrics
  const operationalOrgs = useMemo(
    () => orgHealth.filter((o) => o.status === "Operational").length,
    [orgHealth]
  );
  const openIncidents = useMemo(
    () => incidents.filter((i) => i.status !== "Resolved"),
    [incidents]
  );
  const openTickets = useMemo(
    () => tickets.filter((t) => t.status !== "Resolved"),
    [tickets]
  );
  const totalQueueDepth = useMemo(
    () => systemMetrics.reduce((sum, m) => sum + m.queueDepth, 0),
    [systemMetrics]
  );
  const avgApiLatency = useMemo(() => {
    if (apiEndpoints.length === 0) return 0;
    return Math.round(
      apiEndpoints.reduce((sum, e) => sum + e.avgLatencyMs, 0) / apiEndpoints.length
    );
  }, [apiEndpoints]);

  const failedWebhooksCount = useMemo(
    () => webhooks.filter((w) => w.status === "Failed" || w.status === "Retrying").length,
    [webhooks]
  );
  const unresolvedPaymentsCount = useMemo(
    () =>
      paymentFailures.filter(
        (p) => p.retryStatus === "Scheduled" || p.retryStatus === "Retried — Failed"
      ).length,
    [paymentFailures]
  );
  const pendingAccessCount = useMemo(
    () => accessRequests.filter((r) => r.status === "Pending Approval").length,
    [accessRequests]
  );
  const bouncedInvoicesCount = useMemo(
    () => invoiceDeliveries.filter((i) => i.deliveryStatus !== "Delivered").length,
    [invoiceDeliveries]
  );
  const pendingDraftsCount = useMemo(
    () =>
      emailDrafts.filter((d) => d.status === "Submitted for Approval").length +
      announcementDrafts.filter((a) => a.status === "Submitted for Approval").length,
    [emailDrafts, announcementDrafts]
  );

  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.status !== "Resolved"),
    [alerts]
  );

  // Live Chart Series
  const apiTrendSeries = useMemo(() => {
    const baseLatency = Math.max(40, avgApiLatency);
    const baseRpm = apiEndpoints.reduce((sum, e) => sum + e.requestsPerMin, 0);
    return [
      { time: "-50m", latency: Math.max(25, baseLatency - 12), rpm: Math.round(baseRpm * 0.84) },
      { time: "-40m", latency: Math.max(25, baseLatency - 6), rpm: Math.round(baseRpm * 0.89) },
      { time: "-30m", latency: Math.max(25, baseLatency + 9), rpm: Math.round(baseRpm * 0.96) },
      { time: "-20m", latency: Math.max(25, baseLatency + 3), rpm: Math.round(baseRpm * 0.92) },
      { time: "-10m", latency: Math.max(25, baseLatency - 2), rpm: Math.round(baseRpm * 0.98) },
      { time: "Now", latency: baseLatency, rpm: baseRpm },
    ];
  }, [avgApiLatency, apiEndpoints]);

  const queueBarSeries = useMemo(() => {
    return syncJobs.slice(0, 6).map((j) => ({
      label: j.jobCode,
      processed: j.processedCount,
      retries: j.retries,
    }));
  }, [syncJobs]);

  const emailDeliveryBarSeries = useMemo(() => {
    return [
      { label: "Delivered", processed: emailDeliveries.filter((e) => e.status === "Delivered").length * 280 + 940, retries: 0 },
      { label: "Deferred", processed: 18, retries: 4 },
      { label: "Bounced", processed: 6, retries: 6 },
      { label: "In Flight", processed: 42, retries: 0 },
    ];
  }, [emailDeliveries]);

  // Filter activity logs to authorized categories for current department
  const filteredActivityLogs = useMemo(() => {
    switch (activeDepartment) {
      case "Site Reliability":
        return activityLogs.filter(
          (l) => l.category === "System" || l.category === "Integration" || l.category === "Incident"
        );
      case "Lifecycle Messaging":
        return activityLogs.filter(
          (l) => l.category === "Communication" || l.category === "System"
        );
      case "Customer Communications":
        return activityLogs.filter(
          (l) => l.category === "Support" || l.category === "Communication" || l.category === "Account"
        );
      case "Revenue Operations":
      case "Finance & Tax":
        return activityLogs.filter(
          (l) => l.category === "Billing" || l.category === "Incident" || l.category === "Account"
        );
      case "Trust & Compliance":
        return activityLogs.filter(
          (l) => l.category === "Account" || l.category === "System" || l.category === "Incident"
        );
      case "Platform Operations":
      default:
        return activityLogs;
    }
  }, [activeDepartment, activityLogs]);

  const handleSwitchDepartment = (dept: OperatorDepartmentName) => {
    const sampleOp = superAdminOperators.find((o) => o.department === dept);
    if (sampleOp) {
      setActiveOperatorProfile({
        id: sampleOp.id,
        name: sampleOp.name,
        email: sampleOp.email,
        department: sampleOp.department,
        shiftName: sampleOp.shiftName,
        mfaEnabled: sampleOp.mfaEnabled,
      });
    } else {
      setOperatorDepartment(dept);
    }
    setDeptPickerOpen(false);
    toast.success(`Active context switched to ${dept}`);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title={`${activeDepartment} Operations Center`}
        badge={autoPulseEnabled ? "Auto-Refresh On" : "Manual Refresh"}
        demoLabel="Simulated Live Telemetry"
        description={`Personalized operational console for ${activeDepartment}. Scoped by role permissions and Spring Boot deny-by-default access control.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Context Switcher Pill */}
            <div className="relative">
              <button
                onClick={() => setDeptPickerOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${getDepartmentBadgeClass(
                  activeDepartment
                )}`}
              >
                <span>Department: {activeDepartment}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {deptPickerOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)] mb-1">
                    Switch Operator Department
                  </div>
                  {OPERATOR_DEPARTMENTS.map((dept) => {
                    const isSelected = dept === activeDepartment;
                    return (
                      <button
                        key={dept}
                        onClick={() => handleSwitchDepartment(dept)}
                        className={`w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs text-left transition-colors ${
                          isSelected
                            ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 font-semibold"
                            : "hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)]"
                        }`}
                      >
                        <span className="truncate">{dept}</span>
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <OpButton
              variant="outline"
              size="sm"
              onClick={() => setAutoPulseEnabled((v) => !v)}
            >
              <Activity className="w-3.5 h-3.5" />
              {autoPulseEnabled ? "Pause Pulse" : "Resume Pulse"}
            </OpButton>
            <OpButton
              variant="primary"
              size="sm"
              onClick={() => {
                tickLiveDemoMetrics();
                toast.success("Refreshed simulated telemetry.");
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </OpButton>
          </div>
        }
      />

      {/* Operator Department Profile & Scope Banner */}
      <SurfaceCard className="p-4 sm:p-5 border-l-4 border-l-teal-500 bg-[var(--color-elevated)]/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-sm shrink-0 border border-teal-500/30">
              {activeOperator.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm sm:text-base font-semibold text-[var(--color-text-primary)]">
                  {activeOperator.name}
                </span>
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${getDepartmentBadgeClass(activeDepartment)}`}>
                  {activeDepartment}
                </span>
                <StatusBadge
                  label={activeOperator.mfaEnabled ? "MFA Verified" : "MFA Required"}
                  tone={activeOperator.mfaEnabled ? "success" : "warning"}
                />
                {activeOperator.onCall && (
                  <StatusBadge label="On-Call Active" tone="violet" dot />
                )}
              </div>
              <p className="text-xs text-[var(--color-text-secondary)]">
                {activeOperator.email} · Shift:{" "}
                <span className="font-medium text-[var(--color-text-primary)]">
                  {activeOperator.shiftName || "Americas Primary (08:00 - 16:00 EST)"}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 md:justify-end shrink-0">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-right">
              <p className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-text-muted)]">
                Authorized Modules
              </p>
              <p className="text-xs font-bold text-teal-600 dark:text-teal-400">
                {authorizedModulesCount} of {OPERATOR_MODULE_CATALOG.length} Modules Active
              </p>
            </div>

            {permissionOverrides.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-right">
                <p className="text-[10px] uppercase font-bold tracking-wider text-amber-700 dark:text-amber-300">
                  Overrides
                </p>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                  {permissionOverrides.length} Custom Rule(s)
                </p>
              </div>
            )}
          </div>
        </div>
      </SurfaceCard>

      {/* =========================================================================
          DEPARTMENT 1: SITE RELIABILITY
          ========================================================================= */}
      {activeDepartment === "Site Reliability" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="System Health"
              value={`${systemMetrics.filter((s) => s.status === "Operational").length} / ${systemMetrics.length}`}
              sublabel="Services operating at nominal latency"
              icon={Server}
              tone={systemMetrics.every((s) => s.status === "Operational") ? "emerald" : "amber"}
            />
            <KpiCard
              label="Failed Webhooks"
              value={failedWebhooksCount}
              sublabel="Events awaiting retry delivery"
              icon={RotateCcw}
              tone={failedWebhooksCount > 0 ? "amber" : "emerald"}
            />
            <KpiCard
              label="Pending Sync Jobs"
              value={syncJobs.filter((j) => j.status !== "Completed").length}
              sublabel={`${totalQueueDepth} items in background queue`}
              icon={Activity}
              tone="teal"
            />
            <KpiCard
              label="Active Incidents & Backups"
              value={`${openIncidents.length} / ${backups.filter((b) => b.status === "Verified").length}`}
              sublabel={`${backups[0]?.status || "Verified"} backup snapshot`}
              icon={DatabaseBackup}
              tone={openIncidents.length > 0 ? "rose" : "emerald"}
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Failed Webhooks",
                count: failedWebhooksCount,
                href: "/platform-operator/failed-events",
                tone: failedWebhooksCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600",
                icon: RotateCcw,
              },
              {
                label: "Sync Jobs & Queues",
                count: syncJobs.length,
                href: "/platform-operator/sync-jobs",
                tone: "text-teal-600 dark:text-teal-400",
                icon: Activity,
              },
              {
                label: "API Error Monitors",
                count: apiEndpoints.filter((e) => e.status !== "Normal").length,
                href: "/platform-operator/api-errors",
                tone: apiEndpoints.some((e) => e.status !== "Normal") ? "text-amber-600" : "text-emerald-600",
                icon: AlertTriangle,
              },
              {
                label: "Verified Backups",
                count: backups.length,
                href: "/platform-operator/backups",
                tone: "text-blue-600 dark:text-blue-400",
                icon: DatabaseBackup,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    API Response Time Trend
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Simulated average endpoint latency over the past 60 minutes.
                  </p>
                </div>
                <Link href="/platform-operator/api-errors">
                  <OpButton variant="ghost" size="xs">
                    Inspect Latency <ArrowRight className="w-3 h-3" />
                  </OpButton>
                </Link>
              </div>
              <TelemetryAreaChart
                data={apiTrendSeries}
                primaryKey="latency"
                primaryLabel="Avg Latency"
                unit=" ms"
                height={230}
              />
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Background Queue Throughput & Retries
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Processed items vs. retry attempts across worker queues.
                  </p>
                </div>
                <Link href="/platform-operator/sync-jobs">
                  <OpButton variant="ghost" size="xs">
                    View Queues <ArrowRight className="w-3 h-3" />
                  </OpButton>
                </Link>
              </div>
              <QueueBarChart
                data={queueBarSeries}
                primaryKey="processed"
                primaryLabel="Processed"
                secondaryKey="retries"
                secondaryLabel="Retries"
                height={230}
              />
            </SurfaceCard>
          </div>

          {/* Active Incidents & Core Infrastructure Snapshot */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Active Platform Incidents ({openIncidents.length})
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Sev-1 through Sev-3 incidents currently in investigation.
                  </p>
                </div>
                <Link href="/platform-operator/incidents">
                  <OpButton variant="outline" size="xs">
                    Incident Console
                  </OpButton>
                </Link>
              </div>

              {openIncidents.length === 0 ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-6 text-center text-xs text-[var(--color-text-secondary)]">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                  All platform services are operational. No open incidents.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {openIncidents.map((inc) => (
                    <div
                      key={inc.id}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <StatusBadge label={inc.severity} tone={getStatusTone(inc.severity)} />
                          <span className="text-xs font-bold text-[var(--color-text-primary)]">
                            {inc.code}
                          </span>
                        </div>
                        <StatusBadge label={inc.status} tone={getStatusTone(inc.status)} dot />
                      </div>
                      <p className="text-xs font-semibold text-[var(--color-text-primary)]">
                        {inc.title}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-secondary)]">
                        {inc.affectedService} · Assigned to {inc.assignedTo}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Core Infrastructure Snapshot
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Live CPU, memory, and latency metrics across monitored nodes.
                  </p>
                </div>
                <Link href="/platform-operator/monitoring">
                  <OpButton variant="outline" size="xs">
                    System Monitor
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {systemMetrics.slice(0, 4).map((svc) => (
                  <div
                    key={svc.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {svc.serviceName}
                      </span>
                      <StatusBadge label={svc.status} tone={getStatusTone(svc.status)} dot />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-[var(--color-text-secondary)]">
                      <span>CPU: {svc.cpuPct}%</span>
                      <span>Memory: {svc.memoryPct}%</span>
                      <span>Latency: {svc.latencyMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 2: LIFECYCLE MESSAGING
          ========================================================================= */}
      {activeDepartment === "Lifecycle Messaging" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Emails Delivered"
              value={`${emailDeliveries.filter((e) => e.status === "Delivered").length} / ${emailDeliveries.length}`}
              sublabel="99.4% inbox placement rate"
              icon={Mail}
              tone="emerald"
            />
            <KpiCard
              label="Failed & Bounced"
              value={emailDeliveries.filter((e) => e.status === "Bounced" || e.status === "Failed").length}
              sublabel="Outbound bounce exceptions"
              icon={MailWarning}
              tone={
                emailDeliveries.some((e) => e.status === "Bounced" || e.status === "Failed")
                  ? "amber"
                  : "emerald"
              }
            />
            <KpiCard
              label="SMTP Relay Status"
              value={smtpHealth.connectionState}
              sublabel={`${smtpHealth.inboxPlacementPct}% placement on SendGrid/SES`}
              icon={Radio}
              tone="teal"
            />
            <KpiCard
              label="Pending Drafts"
              value={pendingDraftsCount}
              sublabel="Templates & broadcasts awaiting review"
              icon={MailPlus}
              tone="blue"
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Email Delivery & Logs",
                count: emailDeliveries.length,
                href: "/platform-operator/email-delivery",
                tone: "text-blue-600 dark:text-blue-400",
                icon: Mail,
              },
              {
                label: "Email Template Drafts",
                count: emailDrafts.length,
                href: "/platform-operator/email-drafts",
                tone: "text-teal-600 dark:text-teal-400",
                icon: MailPlus,
              },
              {
                label: "Announcement Drafts",
                count: announcementDrafts.length,
                href: "/platform-operator/announcement-drafts",
                tone: "text-violet-600 dark:text-violet-400",
                icon: Megaphone,
              },
              {
                label: "Communication Alerts",
                count: alerts.filter((a) => a.category === "System").length,
                href: "/platform-operator/alerts",
                tone: "text-amber-600 dark:text-amber-400",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Main Grid: SMTP Health & Outbound Delivery Trend */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    SMTP Gateway & Delivery Health
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Live connection pool and sender domain authentication state.
                  </p>
                </div>
                <StatusBadge label={smtpHealth.connectionState} tone="success" dot />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                  <p className="text-[11px] text-[var(--color-text-muted)]">Daily Outbound Sent</p>
                  <p className="text-base font-bold text-[var(--color-text-primary)] mt-1">
                    {smtpHealth.dailySent.toLocaleString()} / {smtpHealth.dailyQuota.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                  <p className="text-[11px] text-[var(--color-text-muted)]">Inbox Placement</p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                    {smtpHealth.inboxPlacementPct}%
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                {smtpHealth.checks.map((check, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5 text-xs"
                  >
                    <span className="text-[var(--color-text-secondary)]">{check.label}</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {check.detail}
                    </span>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Email Dispatch Volume Breakdown
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Deliveries, deferrals, and bounce metrics over recent dispatches.
                  </p>
                </div>
                <Link href="/platform-operator/email-delivery">
                  <OpButton variant="ghost" size="xs">
                    All Dispatches <ArrowRight className="w-3 h-3" />
                  </OpButton>
                </Link>
              </div>
              <QueueBarChart
                data={emailDeliveryBarSeries}
                primaryKey="processed"
                primaryLabel="Volume"
                secondaryKey="retries"
                secondaryLabel="Exceptions"
                height={230}
              />
            </SurfaceCard>
          </div>

          {/* Email Deliveries Table & Drafts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Recent Outbound Deliveries
                </h3>
                <Link href="/platform-operator/email-delivery">
                  <OpButton variant="outline" size="xs">
                    Delivery Log
                  </OpButton>
                </Link>
              </div>
              <div className="space-y-2">
                {emailDeliveries.slice(0, 4).map((eml) => (
                  <div
                    key={eml.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          label={eml.status}
                          tone={
                            eml.status === "Delivered"
                              ? "success"
                              : eml.status === "Bounced"
                              ? "danger"
                              : "warning"
                          }
                          dot
                        />
                        <span className="font-semibold text-[var(--color-text-primary)] truncate">
                          {eml.recipient}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] truncate mt-0.5">
                        {eml.subject}
                      </p>
                    </div>
                    {eml.status !== "Delivered" && (
                      <OpButton
                        variant="subtle"
                        size="xs"
                        onClick={() => {
                          resendEmailDelivery(eml.id);
                          toast.success(`Queued resend for ${eml.recipient}`);
                        }}
                      >
                        Resend
                      </OpButton>
                    )}
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Email & Announcement Drafts
                </h3>
                <Link href="/platform-operator/email-drafts">
                  <OpButton variant="outline" size="xs">
                    Author Draft
                  </OpButton>
                </Link>
              </div>
              <div className="space-y-2">
                {emailDrafts.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-[var(--color-text-primary)] truncate block">
                        {d.name}
                      </span>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5">
                        {d.subject}
                      </p>
                    </div>
                    <StatusBadge
                      label={d.status}
                      tone={d.status === "Submitted for Approval" ? "warning" : "info"}
                    />
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 3: CUSTOMER COMMUNICATIONS
          ========================================================================= */}
      {activeDepartment === "Customer Communications" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Open Support Tickets"
              value={openTickets.length}
              sublabel="Active tenant requests"
              icon={LifeBuoy}
              tone={openTickets.length > 0 ? "amber" : "emerald"}
            />
            <KpiCard
              label="SLA At Risk / Breached"
              value={tickets.filter((t) => t.slaState !== "On Track" && t.status !== "Resolved").length}
              sublabel="Urgent attention required"
              icon={AlertTriangle}
              tone={
                tickets.some((t) => t.slaState !== "On Track" && t.status !== "Resolved")
                  ? "rose"
                  : "emerald"
              }
            />
            <KpiCard
              label="Support Access Requests"
              value={pendingAccessCount}
              sublabel="Pending break-glass approvals"
              icon={KeyRound}
              tone="teal"
            />
            <KpiCard
              label="Announcements Published"
              value={announcementDrafts.length}
              sublabel="Platform broadcasts"
              icon={Megaphone}
              tone="violet"
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Support Tickets Queue",
                count: openTickets.length,
                href: "/platform-operator/support-tickets",
                tone: "text-amber-600 dark:text-amber-400",
                icon: LifeBuoy,
              },
              {
                label: "Break-Glass Access",
                count: pendingAccessCount,
                href: "/platform-operator/access-requests",
                tone: "text-blue-600 dark:text-blue-400",
                icon: KeyRound,
              },
              {
                label: "Customer Announcements",
                count: announcementDrafts.length,
                href: "/platform-operator/announcement-drafts",
                tone: "text-teal-600 dark:text-teal-400",
                icon: Megaphone,
              },
              {
                label: "Email Delivery Status",
                count: emailDeliveries.filter((e) => e.status !== "Delivered").length,
                href: "/platform-operator/email-delivery",
                tone: "text-rose-600 dark:text-rose-400",
                icon: MailWarning,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Support Ticket Queue & Access Requests */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Active Support Tickets ({openTickets.length})
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Tenant inquiries categorized by SLA priority and response window.
                  </p>
                </div>
                <Link href="/platform-operator/support-tickets">
                  <OpButton variant="outline" size="xs">
                    All Tickets
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {openTickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge label={t.priority} tone={getStatusTone(t.priority)} />
                        <span className="text-xs font-bold text-[var(--color-text-primary)]">
                          {t.ticketNumber}
                        </span>
                      </div>
                      <StatusBadge
                        label={t.slaState}
                        tone={t.slaState === "On Track" ? "success" : "danger"}
                        dot
                      />
                    </div>
                    <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                      {t.subject}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">
                      {t.orgName} · {t.requesterEmail} · {t.slaMinutesRemaining}m left
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Tenant Support Access (Break-Glass)
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Temporary scoped tenant access requests awaiting Super Admin authorization.
                  </p>
                </div>
                <Link href="/platform-operator/access-requests">
                  <OpButton variant="outline" size="xs">
                    View Requests
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {accessRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {req.orgName}
                      </span>
                      <StatusBadge label={req.status} tone={getStatusTone(req.status)} dot />
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">{req.reason}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Scope: {req.scope} · Duration: {req.durationHours}h
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 4: REVENUE OPERATIONS
          ========================================================================= */}
      {activeDepartment === "Revenue Operations" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Active Subscriptions"
              value={`${subscriptions.filter((s) => s.status === "Active").length} / ${subscriptions.length}`}
              sublabel="Active revenue-generating tenants"
              icon={ShieldCheck}
              tone="emerald"
            />
            <KpiCard
              label="Payment Failures"
              value={unresolvedPaymentsCount}
              sublabel="In dunning & retry cycles"
              icon={CreditCard}
              tone={unresolvedPaymentsCount > 0 ? "rose" : "emerald"}
            />
            <KpiCard
              label="Bounced Invoices"
              value={bouncedInvoicesCount}
              sublabel="PDF delivery failures"
              icon={FileWarning}
              tone={bouncedInvoicesCount > 0 ? "amber" : "emerald"}
            />
            <KpiCard
              label="Billing Incidents"
              value={incidents.filter((i) => i.affectedService.toLowerCase().includes("billing") || i.affectedService.toLowerCase().includes("payment")).length}
              sublabel="Revenue pipeline alerts"
              icon={AlertTriangle}
              tone="teal"
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Subscription Status",
                count: subscriptions.length,
                href: "/platform-operator/subscription-status",
                tone: "text-teal-600 dark:text-teal-400",
                icon: ShieldCheck,
              },
              {
                label: "Payment Failures Queue",
                count: unresolvedPaymentsCount,
                href: "/platform-operator/payment-failures",
                tone: unresolvedPaymentsCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600",
                icon: CreditCard,
              },
              {
                label: "Invoice Delivery Receipts",
                count: invoiceDeliveries.length,
                href: "/platform-operator/invoice-delivery",
                tone: "text-blue-600 dark:text-blue-400",
                icon: FileCheck2,
              },
              {
                label: "Billing Incidents",
                count: openIncidents.length,
                href: "/platform-operator/incidents",
                tone: "text-amber-600 dark:text-amber-400",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Payment Failures Queue & Subscription Distribution */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Payment Failures & Dunning Triage
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Declined customer charges awaiting automated or manual retry.
                  </p>
                </div>
                <Link href="/platform-operator/payment-failures">
                  <OpButton variant="outline" size="xs">
                    View Dunning
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {paymentFailures.map((pf) => (
                  <div
                    key={pf.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--color-text-primary)]">
                          {pf.orgName}
                        </span>
                        <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                          ${pf.amountUsd}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)]">{pf.failureReason}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {pf.methodSummary} · Retry: {pf.retryStatus} (Attempt {pf.retryCount})
                      </p>
                    </div>
                    {pf.retryStatus === "Scheduled" && (
                      <OpButton
                        variant="subtle"
                        size="xs"
                        onClick={() => {
                          retryPaymentFailure(pf.id, true);
                          toast.success(`Retried charge for ${pf.orgName}`);
                        }}
                      >
                        Retry Charge
                      </OpButton>
                    )}
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Monitored Customer Subscriptions
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Active workspace plan tiers, renewals, and seat allocations.
                  </p>
                </div>
                <Link href="/platform-operator/subscription-status">
                  <OpButton variant="outline" size="xs">
                    All Plans
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {sub.orgName}
                      </span>
                      <StatusBadge
                        label={sub.status}
                        tone={sub.status === "Active" ? "success" : "danger"}
                        dot
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                      <span>{sub.planName} · {sub.billingCycle}</span>
                      <span>Seats: {sub.seatsUsed} / {sub.seatsLimit}</span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Renews: {sub.renewalDate} · {sub.supportNote}
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 5: FINANCE & TAX
          ========================================================================= */}
      {activeDepartment === "Finance & Tax" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Paid Subscriptions"
              value={`${subscriptions.filter((s) => s.status === "Active").length} Active`}
              sublabel="Active revenue contracts"
              icon={ShieldCheck}
              tone="emerald"
            />
            <KpiCard
              label="Failed Gateway Charges"
              value={unresolvedPaymentsCount}
              sublabel="Requires settlement follow-up"
              icon={CreditCard}
              tone={unresolvedPaymentsCount > 0 ? "rose" : "emerald"}
            />
            <KpiCard
              label="Invoice Delivery Exceptions"
              value={bouncedInvoicesCount}
              sublabel="Tax invoices requiring resend"
              icon={MailWarning}
              tone={bouncedInvoicesCount > 0 ? "amber" : "emerald"}
            />
            <KpiCard
              label="Finance Support Tickets"
              value={tickets.filter((t) => t.category === "Billing & Invoices").length}
              sublabel="Billing & invoice inquiries"
              icon={LifeBuoy}
              tone="blue"
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Subscription Status",
                count: subscriptions.length,
                href: "/platform-operator/subscription-status",
                tone: "text-emerald-600 dark:text-emerald-400",
                icon: ShieldCheck,
              },
              {
                label: "Payment Failures",
                count: unresolvedPaymentsCount,
                href: "/platform-operator/payment-failures",
                tone: unresolvedPaymentsCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600",
                icon: CreditCard,
              },
              {
                label: "Invoice Delivery Logs",
                count: invoiceDeliveries.length,
                href: "/platform-operator/invoice-delivery",
                tone: "text-blue-600 dark:text-blue-400",
                icon: FileCheck2,
              },
              {
                label: "Financial Incidents",
                count: openIncidents.length,
                href: "/platform-operator/incidents",
                tone: "text-amber-600 dark:text-amber-400",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Invoices List & Failed Charges */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Tax Invoices & PDF Delivery Status
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Monthly billing statements dispatched to tenant finance teams.
                  </p>
                </div>
                <Link href="/platform-operator/invoice-delivery">
                  <OpButton variant="outline" size="xs">
                    All Invoices
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {invoiceDeliveries.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--color-text-primary)]">
                          {inv.invoiceNumber}
                        </span>
                        <StatusBadge
                          label={inv.deliveryStatus}
                          tone={inv.deliveryStatus === "Delivered" ? "success" : "warning"}
                          dot
                        />
                      </div>
                      <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                        {inv.orgName} · ${inv.amountUsd} · {inv.recipientEmail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Failed Gateway Settlements
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Card and direct debit rejections logged by the payment gateway.
                  </p>
                </div>
                <Link href="/platform-operator/payment-failures">
                  <OpButton variant="outline" size="xs">
                    Triage Queue
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {paymentFailures.map((pf) => (
                  <div
                    key={pf.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {pf.orgName}
                      </span>
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                        ${pf.amountUsd} USD
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">{pf.failureReason}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {pf.methodSummary} · Status: {pf.retryStatus}
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 6: TRUST & COMPLIANCE
          ========================================================================= */}
      {activeDepartment === "Trust & Compliance" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Audit Events Today"
              value={activityLogs.length}
              sublabel="Immutable platform audit trail"
              icon={History}
              tone="teal"
            />
            <KpiCard
              label="Security Alerts"
              value={alerts.filter((a) => a.category === "System" || a.severity === "Critical").length}
              sublabel="Active threat signals"
              icon={ShieldAlert}
              tone="amber"
            />
            <KpiCard
              label="Support Access Requests"
              value={pendingAccessCount}
              sublabel="Pending break-glass reviews"
              icon={KeyRound}
              tone="blue"
            />
            <KpiCard
              label="Operator MFA Compliance"
              value={`${superAdminOperators.filter((o) => o.mfaEnabled).length} / ${superAdminOperators.length}`}
              sublabel="MFA verified operators"
              icon={ShieldCheck}
              tone="emerald"
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Operational Activity Logs",
                count: activityLogs.length,
                href: "/platform-operator/activity-logs",
                tone: "text-teal-600 dark:text-teal-400",
                icon: History,
              },
              {
                label: "Break-Glass Access Reviews",
                count: pendingAccessCount,
                href: "/platform-operator/access-requests",
                tone: "text-blue-600 dark:text-blue-400",
                icon: KeyRound,
              },
              {
                label: "Security Anomaly Signals",
                count: activeAlerts.length,
                href: "/platform-operator/alerts",
                tone: "text-amber-600 dark:text-amber-400",
                icon: ShieldAlert,
              },
              {
                label: "Compliance Incidents",
                count: openIncidents.length,
                href: "/platform-operator/incidents",
                tone: "text-rose-600 dark:text-rose-400",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Audit Log Stream & Operator Security Overview */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Real-Time Security & Compliance Audit Log
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Cryptographic audit trail of all administrative and operator actions.
                  </p>
                </div>
                <Link href="/platform-operator/activity-logs">
                  <OpButton variant="outline" size="xs">
                    Full Ledger
                  </OpButton>
                </Link>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {activityLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="py-2.5 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StatusBadge label={log.category} tone="neutral" />
                        <span className="font-semibold text-[var(--color-text-primary)]">
                          {log.action}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">
                        {formatDateTime(log.timestamp)}
                      </span>
                    </div>
                    <p className="text-[var(--color-text-secondary)]">{log.summary}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Actor: <span className="font-medium text-[var(--color-text-primary)]">{log.actorName}</span>
                    </p>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Break-Glass Support Access Reviews
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Audited customer workspace access authorizations and scopes.
                  </p>
                </div>
                <Link href="/platform-operator/access-requests">
                  <OpButton variant="outline" size="xs">
                    Audit Requests
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {accessRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-[var(--color-text-primary)]">
                        {req.orgName}
                      </span>
                      <StatusBadge label={req.status} tone={getStatusTone(req.status)} dot />
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">{req.reason}</p>
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                      <span>Scope: {req.scope}</span>
                      <span>Reviewer: {req.reviewedBy || "Pending Review"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          DEPARTMENT 7: PLATFORM OPERATIONS
          ========================================================================= */}
      {activeDepartment === "Platform Operations" && (
        <div className="space-y-6">
          {/* Primary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <KpiCard
              label="Workspaces Healthy"
              value={`${operationalOrgs} / ${orgHealth.length}`}
              sublabel="Operating within nominal SLA latency"
              icon={Building2}
              tone={operationalOrgs === orgHealth.length ? "emerald" : "amber"}
            />
            <KpiCard
              label="Open Platform Incidents"
              value={openIncidents.length}
              sublabel="Sev-1 to Sev-4 tracked issues"
              icon={AlertTriangle}
              tone={openIncidents.length > 0 ? "rose" : "emerald"}
            />
            <KpiCard
              label="Average API Response"
              value={`${avgApiLatency} ms`}
              sublabel="Monitored customer endpoints"
              icon={Server}
              tone="blue"
            />
            <KpiCard
              label="Active Maintenance & Alerts"
              value={`${maintenanceWindows.filter((m) => m.status !== "Completed").length} / ${activeAlerts.length}`}
              sublabel="Scheduled maintenance & alarms"
              icon={Wrench}
              tone="teal"
            />
          </div>

          {/* Attention Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Workspace Service Health",
                count: operationalOrgs,
                href: "/platform-operator/organization-status",
                tone: "text-emerald-600 dark:text-emerald-400",
                icon: Building2,
              },
              {
                label: "System Monitoring",
                count: systemMetrics.length,
                href: "/platform-operator/monitoring",
                tone: "text-blue-600 dark:text-blue-400",
                icon: Server,
              },
              {
                label: "Incident Management",
                count: openIncidents.length,
                href: "/platform-operator/incidents",
                tone: openIncidents.length > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600",
                icon: AlertTriangle,
              },
              {
                label: "Operational Alerts",
                count: activeAlerts.length,
                href: "/platform-operator/alerts",
                tone: activeAlerts.length > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600",
                icon: Activity,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href}>
                  <SurfaceCard className="p-3.5 hover:border-teal-500/45 transition-colors flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-[var(--color-text-muted)] truncate">
                        {item.label}
                      </p>
                      <p className={`text-lg font-bold tabular-nums ${item.tone}`}>{item.count}</p>
                    </div>
                    <Icon className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
                  </SurfaceCard>
                </Link>
              );
            })}
          </div>

          {/* Org Service Status & Operational Alerts */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Workspace Availability Grid
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Multi-tenant customer workspace health and latency.
                  </p>
                </div>
                <Link href="/platform-operator/organization-status">
                  <OpButton variant="outline" size="xs">
                    All Workspaces
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {orgHealth.slice(0, 5).map((org) => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--color-text-primary)] truncate">
                          {org.orgName}
                        </span>
                        <StatusBadge label={org.status} tone={getStatusTone(org.status)} dot />
                      </div>
                      <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                        {org.region} · {org.planName} · Uptime: {org.uptimePct}% · {org.avgResponseMs}ms
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                    Active Operational Alerts ({activeAlerts.length})
                  </h3>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Alarms triggered by system metric anomaly thresholds.
                  </p>
                </div>
                <Link href="/platform-operator/alerts">
                  <OpButton variant="outline" size="xs">
                    Alert Policies
                  </OpButton>
                </Link>
              </div>

              <div className="space-y-2.5">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge label={alert.severity} tone={getStatusTone(alert.severity)} />
                        <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                          {alert.title}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        Target: {alert.affectedTarget} · {formatDateTime(alert.triggeredAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {alert.status === "Active" && (
                        <OpButton
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            acknowledgeAlert(alert.id);
                            toast.success("Alert acknowledged.");
                          }}
                        >
                          Acknowledge
                        </OpButton>
                      )}
                      {!alert.linkedIncidentId && (
                        <OpButton
                          variant="subtle"
                          size="xs"
                          onClick={() => {
                            const inc = createIncidentFromAlert(alert.id);
                            if (inc) toast.success(`Opened incident ${inc.code}`);
                          }}
                        >
                          Open Incident
                        </OpButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </SurfaceCard>
          </div>
        </div>
      )}

      {/* =========================================================================
          COMMON FOOTER: QUICK WORKFLOWS & FILTERED RECENT ACTIVITY
          ========================================================================= */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Department-Authorized Quick Workflows */}
        <SurfaceCard className="p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Authorized {activeDepartment} Workflows
          </h3>
          <div className="space-y-2">
            {activeDepartment === "Site Reliability" && [
              {
                label: "Retry Failed Webhook Deliveries",
                desc: `${failedWebhooksCount} event(s) in retry queue`,
                href: "/platform-operator/failed-events",
                icon: RotateCcw,
              },
              {
                label: "Monitor Background Queue Depths",
                desc: `${syncJobs.length} active worker pipelines`,
                href: "/platform-operator/sync-jobs",
                icon: Activity,
              },
              {
                label: "Verify Database Backup Snapshots",
                desc: `${backups.length} verified automated snapshots`,
                href: "/platform-operator/backups",
                icon: DatabaseBackup,
              },
              {
                label: "Investigate API Error Spikes",
                desc: `${apiEndpoints.length} monitored customer endpoints`,
                href: "/platform-operator/api-errors",
                icon: Server,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Lifecycle Messaging" && [
              {
                label: "Draft System Email Template",
                desc: `${emailDrafts.length} template draft(s)`,
                href: "/platform-operator/email-drafts",
                icon: MailPlus,
              },
              {
                label: "Author Broadcast Announcement",
                desc: `${announcementDrafts.length} platform notice(s)`,
                href: "/platform-operator/announcement-drafts",
                icon: Megaphone,
              },
              {
                label: "Inspect SMTP Gateway Health",
                desc: `${smtpHealth.connectionState} · ${smtpHealth.dailySent} sent today`,
                href: "/platform-operator/email-delivery",
                icon: Radio,
              },
              {
                label: "Resend Bounced Notifications",
                desc: `${emailDeliveries.filter((e) => e.status === "Bounced").length} bounced email(s)`,
                href: "/platform-operator/email-delivery",
                icon: MailWarning,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Customer Communications" && [
              {
                label: "Triage Urgent Support Tickets",
                desc: `${openTickets.length} active ticket(s)`,
                href: "/platform-operator/support-tickets",
                icon: LifeBuoy,
              },
              {
                label: "Review Break-Glass Access Requests",
                desc: `${pendingAccessCount} pending authorization(s)`,
                href: "/platform-operator/access-requests",
                icon: KeyRound,
              },
              {
                label: "Draft Tenant Maintenance Notice",
                desc: `${announcementDrafts.length} draft notice(s)`,
                href: "/platform-operator/announcement-drafts",
                icon: Megaphone,
              },
              {
                label: "Inspect Email Delivery Status",
                desc: `${emailDeliveries.length} tracked deliveries`,
                href: "/platform-operator/email-delivery",
                icon: Mail,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Revenue Operations" && [
              {
                label: "Triage Payment Failures",
                desc: `${unresolvedPaymentsCount} charges in dunning queue`,
                href: "/platform-operator/payment-failures",
                icon: CreditCard,
              },
              {
                label: "Inspect Subscription Tiers",
                desc: `${subscriptions.length} active customer contracts`,
                href: "/platform-operator/subscription-status",
                icon: ShieldCheck,
              },
              {
                label: "Resend Bounced Invoices",
                desc: `${bouncedInvoicesCount} invoice(s) needing delivery`,
                href: "/platform-operator/invoice-delivery",
                icon: FileWarning,
              },
              {
                label: "Track Billing Incidents",
                desc: `${openIncidents.length} platform incident(s)`,
                href: "/platform-operator/incidents",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Finance & Tax" && [
              {
                label: "Review Payment Exceptions",
                desc: `${unresolvedPaymentsCount} failed charge(s)`,
                href: "/platform-operator/payment-failures",
                icon: CreditCard,
              },
              {
                label: "Inspect Delivered Invoices",
                desc: `${invoiceDeliveries.length} tax invoice records`,
                href: "/platform-operator/invoice-delivery",
                icon: FileCheck2,
              },
              {
                label: "Audit Subscription Renewals",
                desc: `${subscriptions.length} monitored subscriptions`,
                href: "/platform-operator/subscription-status",
                icon: ShieldCheck,
              },
              {
                label: "View Billing Incidents",
                desc: `${openIncidents.length} active platform incident(s)`,
                href: "/platform-operator/incidents",
                icon: AlertTriangle,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Trust & Compliance" && [
              {
                label: "Inspect Operational Audit Logs",
                desc: `${activityLogs.length} immutable events recorded`,
                href: "/platform-operator/activity-logs",
                icon: History,
              },
              {
                label: "Review Break-Glass Access Records",
                desc: `${pendingAccessCount} access review(s) pending`,
                href: "/platform-operator/access-requests",
                icon: KeyRound,
              },
              {
                label: "Audit Security Anomaly Alerts",
                desc: `${activeAlerts.length} alarm signals`,
                href: "/platform-operator/alerts",
                icon: ShieldAlert,
              },
              {
                label: "Verify Infrastructure Status",
                desc: `${systemMetrics.length} monitored compute nodes`,
                href: "/platform-operator/monitoring",
                icon: Server,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}

            {activeDepartment === "Platform Operations" && [
              {
                label: "Review Workspace Availabilities",
                desc: `${operationalOrgs} / ${orgHealth.length} healthy`,
                href: "/platform-operator/organization-status",
                icon: Building2,
              },
              {
                label: "Declare Platform Incident",
                desc: `${openIncidents.length} active incident(s)`,
                href: "/platform-operator/incidents",
                icon: AlertTriangle,
              },
              {
                label: "Schedule Maintenance Window",
                desc: `${maintenanceWindows.length} planned maintenance item(s)`,
                href: "/platform-operator/maintenance",
                icon: Wrench,
              },
              {
                label: "Triage System Monitoring",
                desc: `${systemMetrics.length} monitored services`,
                href: "/platform-operator/monitoring",
                icon: Server,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 hover:border-teal-500/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}
          </div>
        </SurfaceCard>

        {/* Filtered Recent Operational Activity */}
        <SurfaceCard className="p-4 sm:p-5 space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Recent Operational Activity ({activeDepartment})
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Authorized audit events filtered to {activeDepartment} scope.
              </p>
            </div>
            {canViewModule("audit.activity_logs") && (
              <Link href="/platform-operator/activity-logs">
                <OpButton variant="ghost" size="xs">
                  Full Log <ArrowRight className="w-3 h-3" />
                </OpButton>
              </Link>
            )}
          </div>

          <div className="divide-y divide-[var(--color-border)]">
            {filteredActivityLogs.slice(0, 5).map((log) => (
              <div
                key={log.id}
                className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={log.category} tone="neutral" />
                    <span className="font-semibold text-[var(--color-text-primary)]">
                      {log.action}
                    </span>
                  </div>
                  <p className="text-[var(--color-text-secondary)] mt-0.5">{log.summary}</p>
                </div>
                <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">
                  {log.actorName} · {formatDateTime(log.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}

/** Stored operational counts by default; the sample dashboard only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function PlatformOperatorDashboardPage() {
  return previewEnabled() ? <PreviewPlatformOperatorDashboardPage /> : <LiveOperatorDashboard />;
}
