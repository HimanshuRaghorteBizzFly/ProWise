"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  CreditCard,
  KeyRound,
  LifeBuoy,
  MailWarning,
  RefreshCw,
  RotateCcw,
  Server,
} from "lucide-react";
import { usePlatformOperatorStore } from "./_store/usePlatformOperatorStore";
import { formatDateTime } from "./_services/operator-service";
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

export default function PlatformOperatorDashboardPage() {
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
  const emailDrafts = usePlatformOperatorStore((s) => s.emailDrafts);
  const activityLogs = usePlatformOperatorStore((s) => s.activityLogs);
  const accountSettings = usePlatformOperatorStore((s) => s.accountSettings);
  const lastTelemetryTickAt = usePlatformOperatorStore((s) => s.lastTelemetryTickAt);
  const tickLiveDemoMetrics = usePlatformOperatorStore((s) => s.tickLiveDemoMetrics);
  const acknowledgeAlert = usePlatformOperatorStore((s) => s.acknowledgeAlert);
  const createIncidentFromAlert = usePlatformOperatorStore((s) => s.createIncidentFromAlert);

  const [autoPulseEnabled, setAutoPulseEnabled] = useState(true);

  useEffect(() => {
    if (!autoPulseEnabled || accountSettings.autoRefreshSeconds === 0) return;
    const ms = Math.max(5000, accountSettings.autoRefreshSeconds * 1000);
    const id = setInterval(() => {
      tickLiveDemoMetrics();
    }, ms);
    return () => clearInterval(id);
  }, [autoPulseEnabled, accountSettings.autoRefreshSeconds, tickLiveDemoMetrics]);

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
    () => emailDrafts.filter((d) => d.status === "Submitted for Approval").length,
    [emailDrafts]
  );

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

  const activeAlerts = useMemo(
    () => alerts.filter((a) => a.status !== "Resolved"),
    [alerts]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        badge={autoPulseEnabled ? "Auto-Refresh On" : "Manual Refresh"}
        demoLabel="Demo Data (Simulated Telemetry)"
        description="Live operational overview of customer availability, incidents, support SLAs, webhook retries, billing triage, and core infrastructure."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <OpButton
              variant="outline"
              size="sm"
              onClick={() => setAutoPulseEnabled((v) => !v)}
            >
              <Activity className="w-3.5 h-3.5" />
              {autoPulseEnabled ? "Pause Auto-Refresh" : "Resume Auto-Refresh"}
            </OpButton>
            <OpButton
              variant="primary"
              size="sm"
              onClick={() => {
                tickLiveDemoMetrics();
                toast.success("Refreshed simulated platform telemetry.");
              }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Now
            </OpButton>
          </div>
        }
      />

      <DemoDataBanner
        title="Live Simulated Telemetry & Delegated Scope"
        description={`Metrics auto-refresh every ${Math.max(
          5,
          accountSettings.autoRefreshSeconds || 10
        )}s from persistent simulated telemetry (last tick: ${formatDateTime(
          lastTelemetryTickAt
        )}). Connect Spring Boot Actuator, gateway, and queue endpoints for production metrics.`}
      />

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Organizations Healthy"
          value={`${operationalOrgs} / ${orgHealth.length}`}
          sublabel="Workspaces operating within SLA latency"
          icon={Building2}
          tone={operationalOrgs === orgHealth.length ? "emerald" : "amber"}
        />
        <KpiCard
          label="Open Incidents & Tickets"
          value={`${openIncidents.length} / ${openTickets.length}`}
          sublabel={`${
            tickets.filter((t) => t.slaState !== "On Track" && t.status !== "Resolved").length
          } SLA ticket(s) need attention`}
          icon={AlertTriangle}
          tone={openIncidents.length > 0 ? "amber" : "emerald"}
        />
        <KpiCard
          label="Sync Queue & Retries"
          value={totalQueueDepth}
          sublabel={`${failedWebhooksCount} webhook event(s) awaiting retry`}
          icon={RotateCcw}
          tone={failedWebhooksCount > 0 ? "amber" : "teal"}
        />
        <KpiCard
          label="Average API Response"
          value={`${avgApiLatency} ms`}
          sublabel="Across monitored customer endpoints"
          icon={Server}
          tone="blue"
        />
      </div>

      {/* Connected Queue Attention Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            label: "Payment Failures",
            count: unresolvedPaymentsCount,
            href: "/platform-operator/payment-failures",
            tone: unresolvedPaymentsCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
            icon: CreditCard,
          },
          {
            label: "Bounced Invoices",
            count: bouncedInvoicesCount,
            href: "/platform-operator/invoice-delivery",
            tone: bouncedInvoicesCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400",
            icon: MailWarning,
          },
          {
            label: "Pending Access Approvals",
            count: pendingAccessCount,
            href: "/platform-operator/access-requests",
            tone: pendingAccessCount > 0 ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400",
            icon: KeyRound,
          },
          {
            label: "Drafts Awaiting Review",
            count: pendingDraftsCount,
            href: "/platform-operator/email-drafts",
            tone: "text-teal-600 dark:text-teal-400",
            icon: LifeBuoy,
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

      {/* Live Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SurfaceCard className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                API Response Time Trend (Simulated Live)
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Tracks average response latency in milliseconds over the last hour.
              </p>
            </div>
            <Link href="/platform-operator/api-errors">
              <OpButton variant="ghost" size="xs">
                Details <ArrowRight className="w-3 h-3" />
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
                Processed items vs. retry counts across active sync jobs.
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
            primaryLabel="Items Processed"
            secondaryKey="retries"
            secondaryLabel="Retries"
            height={230}
          />
        </SurfaceCard>
      </div>

      {/* Active Alerts & Service Health */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <SurfaceCard className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Active Operational Alerts ({activeAlerts.length})
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Acknowledge warnings or escalate directly into tracked incidents.
              </p>
            </div>
            <Link href="/platform-operator/alerts">
              <OpButton variant="outline" size="xs">
                All Alerts
              </OpButton>
            </Link>
          </div>

          {activeAlerts.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-6 text-center text-xs text-[var(--color-text-secondary)]">
              <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
              All platform alerts are acknowledged or resolved.
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={alert.severity} tone={getStatusTone(alert.severity)} />
                      <StatusBadge label={alert.status} tone={getStatusTone(alert.status)} dot />
                    </div>
                    <p className="text-xs sm:text-sm font-semibold text-[var(--color-text-primary)]">
                      {alert.title}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {alert.affectedTarget} · {formatDateTime(alert.triggeredAt)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
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
                          if (inc) toast.success(`Opened ${inc.code} from alert.`);
                        }}
                      >
                        Open Incident
                      </OpButton>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        {/* System Health Snapshot */}
        <SurfaceCard className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Core Infrastructure Snapshot
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Live CPU, memory, and queue pacing across monitored services.
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

      {/* Quick Workflows & Recent Operational Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <SurfaceCard className="p-4 sm:p-5 space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Connected Operator Workflows
          </h3>
          <div className="space-y-2">
            {[
              {
                label: "Retry Failed Webhook Deliveries",
                desc: `${failedWebhooksCount} event(s) waiting`,
                href: "/platform-operator/failed-events",
                icon: RotateCcw,
              },
              {
                label: "Triage Customer Support Tickets",
                desc: `${openTickets.length} active ticket(s)`,
                href: "/platform-operator/support-tickets",
                icon: LifeBuoy,
              },
              {
                label: "Follow Up Payment Failures",
                desc: `${unresolvedPaymentsCount} charge(s) need attention`,
                href: "/platform-operator/payment-failures",
                icon: CreditCard,
              },
              {
                label: "Request Scoped Workspace Access",
                desc: `${pendingAccessCount} awaiting Super Admin review`,
                href: "/platform-operator/access-requests",
                icon: KeyRound,
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
                      <p className="text-[11px] text-[var(--color-text-muted)]">{item.desc}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
                </Link>
              );
            })}
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-4 sm:p-5 space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Recent Operational Activity
            </h3>
            <Link href="/platform-operator/activity-logs">
              <OpButton variant="ghost" size="xs">
                Full Log <ArrowRight className="w-3 h-3" />
              </OpButton>
            </Link>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {activityLogs.slice(0, 6).map((log) => (
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
