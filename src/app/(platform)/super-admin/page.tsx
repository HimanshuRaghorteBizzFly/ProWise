"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  Layers,
  Megaphone,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminPermissions, useSuperAdminStore } from "./_store/useSuperAdminStore";
import {
  exportRowsToCsv,
  formatCurrency,
  formatDateTime,
  withSimulatedRequest,
} from "./_services/super-admin-service";
import {
  AdminButton,
  EmptyStateView,
  ErrorBanner,
  KpiCard,
  PageHeader,
  StatusBadge,
  SurfaceCard,
  TableSkeleton,
  getStatusTone,
} from "./_components/SuperAdminPrimitives";
import {
  ComparisonBarChart,
  LiveTelemetryChart,
  LiveTelemetryPoint,
  PlanDistributionChart,
  RevenueOverviewChart,
} from "./_components/SuperAdminCharts";

const PLAN_COLORS = ["#64748B", "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B"];

function buildInitialTelemetrySeries(baseSeats: number): LiveTelemetryPoint[] {
  const now = Date.now();
  return Array.from({ length: 10 }).map((_, idx) => {
    const t = new Date(now - (9 - idx) * 5000);
    const label = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    return {
      time: label,
      requestsPerMin: 980 + ((idx * 37) % 140),
      activeSessions: Math.max(40, Math.round(baseSeats * 0.62) + ((idx * 11) % 24)),
      latencyMs: 52 + ((idx * 7) % 19),
    };
  });
}

export default function SuperAdminDashboardPage() {
  const router = useRouter();
  const organizations = useSuperAdminStore((s) => s.organizations);
  const plans = useSuperAdminStore((s) => s.plans);
  const subscriptions = useSuperAdminStore((s) => s.subscriptions);
  const payments = useSuperAdminStore((s) => s.payments);
  const invoices = useSuperAdminStore((s) => s.invoices);
  const operators = useSuperAdminStore((s) => s.operators);
  const announcements = useSuperAdminStore((s) => s.announcements);
  const activities = useSuperAdminStore((s) => s.activities);

  const { can } = useAdminPermissions();

  const [chartHorizon, setChartHorizon] = useState<"6M" | "12M">("6M");
  const [activityFilter, setActivityFilter] = useState<string>("ALL");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Live telemetry stream & auto-refresh state (reactive demo mode)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<3 | 5 | 15 | 30>(5);
  const [liveTick, setLiveTick] = useState(0);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");
  const [telemetrySeries, setTelemetrySeries] = useState<LiveTelemetryPoint[]>([]);

  // New Organizations functional dropdown state
  const [newOrgMenuOpen, setNewOrgMenuOpen] = useState(false);
  const newOrgMenuRef = useRef<HTMLDivElement | null>(null);

  const baseSeatsTotal = useMemo(
    () => organizations.reduce((sum, o) => sum + o.seatsUsed, 0),
    [organizations]
  );

  const pushTelemetryPoint = (seatBase: number) => {
    const label = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const nextPoint: LiveTelemetryPoint = {
      time: label,
      requestsPerMin: Math.round(1020 + (Math.random() - 0.35) * 190),
      activeSessions: Math.max(45, Math.round(seatBase * 0.64 + (Math.random() - 0.4) * 32)),
      latencyMs: Math.max(36, Math.round(58 + (Math.random() - 0.5) * 24)),
    };
    setTelemetrySeries((prev) =>
      prev.length === 0 ? buildInitialTelemetrySeries(seatBase) : [...prev.slice(-9), nextPoint]
    );
    setLastUpdatedAt(label);
  };

  useEffect(() => {
    setTelemetrySeries(buildInitialTelemetrySeries(baseSeatsTotal));
    setLastUpdatedAt(
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const timer = setInterval(() => {
      useSuperAdminStore.persist.rehydrate();
      setLiveTick((t) => t + 1);
      pushTelemetryPoint(baseSeatsTotal);
    }, refreshIntervalSec * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshEnabled, refreshIntervalSec, baseSeatsTotal]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (newOrgMenuRef.current && !newOrgMenuRef.current.contains(e.target as Node)) {
        setNewOrgMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNewOrgMenuOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const latestTelemetry = telemetrySeries[telemetrySeries.length - 1] || {
    time: "--:--:--",
    requestsPerMin: 1042,
    activeSessions: Math.max(48, Math.round(baseSeatsTotal * 0.64)),
    latencyMs: 56,
  };

  const liveSeatPulse = useMemo(() => {
    if (liveTick === 0) return 0;
    const pattern = [0, 2, 4, 1, 5, 3];
    return pattern[liveTick % pattern.length];
  }, [liveTick]);

  const stats = useMemo(() => {
    const activeOrgs = organizations.filter((o) => o.status === "ACTIVE").length;
    const trialOrgs = organizations.filter((o) => o.status === "TRIAL").length;
    const suspendedOrgs = organizations.filter((o) => o.status === "SUSPENDED").length;
    const totalMrr = organizations.reduce((sum, o) => sum + o.mrr, 0);
    const totalSeats = organizations.reduce((sum, o) => sum + o.seatsUsed, 0) + liveSeatPulse;

    const activeSubs = subscriptions.filter((s) => s.status === "ACTIVE").length;
    const pastDueSubs = subscriptions.filter((s) => s.status === "PAST_DUE").length;

    const settledPayments = payments
      .filter((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED")
      .reduce((sum, p) => sum + (p.amount - p.refundedAmount), 0);
    const failedPayments = payments.filter((p) => p.status === "FAILED").length;

    const openOrOverdueInvoices = invoices.filter(
      (i) => i.status === "OPEN" || i.status === "OVERDUE"
    );
    const outstandingBalance = openOrOverdueInvoices.reduce((sum, i) => sum + i.total, 0);
    const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

    const activeOperators = operators.filter((o) => o.status === "ACTIVE").length;
    const onCallOperators = operators.filter((o) => o.status === "ACTIVE" && o.onCall).length;
    const liveAnnouncements = announcements.filter((a) => a.status === "PUBLISHED").length;

    return {
      activeOrgs,
      trialOrgs,
      suspendedOrgs,
      totalMrr,
      arr: totalMrr * 12,
      totalSeats,
      activeSubs,
      pastDueSubs,
      settledPayments,
      failedPayments,
      openInvoiceCount: openOrOverdueInvoices.length,
      outstandingBalance,
      overdueCount,
      activeOperators,
      onCallOperators,
      liveAnnouncements,
    };
  }, [organizations, subscriptions, payments, invoices, operators, announcements, liveSeatPulse]);

  const revenueSeries = useMemo(() => {
    const currentMrr = stats.totalMrr;
    const currentCollected = Math.max(stats.settledPayments, currentMrr) + liveSeatPulse * 35;
    const base6 = [
      { period: "Jun", mrr: Math.round(currentMrr * 0.56), collected: Math.round(currentCollected * 0.42), refunded: 0 },
      { period: "Jul", mrr: Math.round(currentMrr * 0.65), collected: Math.round(currentCollected * 0.51), refunded: 499 },
      { period: "Aug", mrr: Math.round(currentMrr * 0.74), collected: Math.round(currentCollected * 0.62), refunded: 0 },
      { period: "Sep", mrr: Math.round(currentMrr * 0.84), collected: Math.round(currentCollected * 0.71), refunded: 499 },
      { period: "Oct", mrr: Math.round(currentMrr * 0.92), collected: Math.round(currentCollected * 0.89), refunded: 450 },
      { period: "Nov (Live)", mrr: currentMrr, collected: currentCollected, refunded: payments.reduce((s, p) => s + p.refundedAmount, 0) },
    ];
    if (chartHorizon === "6M") return base6;

    return [
      { period: "Dec", mrr: Math.round(currentMrr * 0.25), collected: Math.round(currentCollected * 0.21), refunded: 0 },
      { period: "Jan", mrr: Math.round(currentMrr * 0.31), collected: Math.round(currentCollected * 0.26), refunded: 0 },
      { period: "Feb", mrr: Math.round(currentMrr * 0.38), collected: Math.round(currentCollected * 0.31), refunded: 0 },
      { period: "Mar", mrr: Math.round(currentMrr * 0.44), collected: Math.round(currentCollected * 0.35), refunded: 200 },
      { period: "Apr", mrr: Math.round(currentMrr * 0.49), collected: Math.round(currentCollected * 0.38), refunded: 0 },
      { period: "May", mrr: Math.round(currentMrr * 0.52), collected: Math.round(currentCollected * 0.4), refunded: 0 },
      ...base6,
    ];
  }, [stats.totalMrr, stats.settledPayments, payments, chartHorizon, liveSeatPulse]);

  const planDistribution = useMemo(() => {
    return plans.map((plan, idx) => {
      const matchedOrgs = organizations.filter((o) => o.planId === plan.id);
      const mrr = matchedOrgs.reduce((sum, o) => sum + o.mrr, 0);
      return {
        name: plan.name,
        orgs: matchedOrgs.length,
        mrr,
        color: PLAN_COLORS[idx % PLAN_COLORS.length],
      };
    });
  }, [plans, organizations]);

  const orgGrowthSeries = useMemo(() => {
    const total = organizations.length;
    return [
      { label: "Jun", primary: Math.max(2, total - 5), secondary: 320 },
      { label: "Jul", primary: Math.max(3, total - 4), secondary: 490 },
      { label: "Aug", primary: Math.max(4, total - 3), secondary: 620 },
      { label: "Sep", primary: Math.max(5, total - 2), secondary: 740 },
      { label: "Oct", primary: Math.max(6, total - 1), secondary: 860 },
      { label: "Now", primary: total, secondary: stats.totalSeats },
    ];
  }, [organizations.length, stats.totalSeats]);

  const topOrganizations = useMemo(() => {
    return [...organizations]
      .sort((a, b) => b.mrr - a.mrr || b.seatsUsed - a.seatsUsed)
      .slice(0, 6);
  }, [organizations]);

  const filteredActivities = useMemo(() => {
    if (activityFilter === "ALL") return activities.slice(0, 8);
    return activities.filter((a) => a.category === activityFilter).slice(0, 8);
  }, [activities, activityFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      await withSimulatedRequest(() => {
        useSuperAdminStore.persist.rehydrate();
        setLiveTick((t) => t + 1);
        pushTelemetryPoint(baseSeatsTotal);
        return true;
      }, { delayMs: 260 });
      toast.success("Live telemetry and dashboard metrics refreshed");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to refresh metrics");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleExportSummary = () => {
    if (!can("system.export")) {
      toast.error("Your active role lacks system.export permission.");
      return;
    }
    exportRowsToCsv(
      `prowise-super-admin-overview-${new Date().toISOString().split("T")[0]}.csv`,
      ["Organization", "Slug", "Status", "Seats Used", "Seats Limit", "Projects", "MRR (USD)", "Owner Email"],
      organizations.map((o) => [
        o.name,
        o.slug,
        o.status,
        o.seatsUsed,
        o.seatsLimit,
        o.projectsCount,
        o.mrr,
        o.ownerEmail,
      ])
    );
    toast.success("Exported organization & revenue summary CSV");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description="Live tenant organizations, streaming telemetry, subscription revenue, and administrative audit activity."
        simulationLabel="Reactive Live Demo Data"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Auto-Refresh Controls */}
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 h-9 text-xs transition-all duration-200 hover:border-blue-500/40">
              <span className="relative flex h-2 w-2 shrink-0">
                {autoRefreshEnabled && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    autoRefreshEnabled ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
              </span>
              <span className="font-medium text-[var(--color-text-primary)] hidden sm:inline">
                {autoRefreshEnabled ? "Live" : "Paused"}
              </span>
              {lastUpdatedAt && (
                <span className="text-[11px] text-[var(--color-text-muted)] hidden md:inline tabular-nums">
                  • {lastUpdatedAt}
                </span>
              )}
              <select
                value={refreshIntervalSec}
                onChange={(e) => setRefreshIntervalSec(Number(e.target.value) as 3 | 5 | 15 | 30)}
                aria-label="Auto-refresh interval"
                className="bg-transparent text-[11px] font-medium text-[var(--color-text-secondary)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value={3} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">3s</option>
                <option value={5} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">5s</option>
                <option value={15} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">15s</option>
                <option value={30} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">30s</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setAutoRefreshEnabled((prev) => !prev);
                  toast.info(autoRefreshEnabled ? "Auto-refresh paused" : "Live telemetry resumed");
                }}
                aria-label={autoRefreshEnabled ? "Pause auto-refresh" : "Resume auto-refresh"}
                title={autoRefreshEnabled ? "Pause auto-refresh" : "Resume auto-refresh"}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {autoRefreshEnabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            </div>

            <AdminButton variant="outline" size="sm" onClick={handleRefresh} isLoading={isRefreshing} className="transition-transform duration-150 active:scale-95">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </AdminButton>

            <AdminButton
              variant="outline"
              size="sm"
              onClick={handleExportSummary}
              permissionLocked={!can("system.export")}
              className="transition-transform duration-150 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              Export Summary
            </AdminButton>

            {/* Functional New Organizations Dropdown */}
            <div className="relative" ref={newOrgMenuRef}>
              <AdminButton
                variant="primary"
                size="sm"
                aria-haspopup="menu"
                aria-expanded={newOrgMenuOpen}
                onClick={() => setNewOrgMenuOpen((v) => !v)}
                className="transition-transform duration-150 active:scale-95"
              >
                <Plus className="w-3.5 h-3.5" />
                New Organizations
                <ChevronDown
                  className={`w-3.5 h-3.5 ml-0.5 opacity-85 transition-transform duration-200 ${
                    newOrgMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </AdminButton>

              {newOrgMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-1.5 shadow-xl z-40 animate-in fade-in zoom-in-95 duration-150"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!can("orgs.create")}
                    onClick={() => {
                      setNewOrgMenuOpen(false);
                      router.push("/super-admin/organizations?create=1");
                    }}
                    className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--color-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    <Plus className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[var(--color-text-primary)] block">
                        Create Organization
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        Provision a new customer workspace
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setNewOrgMenuOpen(false);
                      router.push("/super-admin/organizations?recent=1");
                    }}
                    className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--color-hover)] transition-colors"
                  >
                    <Clock className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[var(--color-text-primary)] block">
                        View Recent
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        Sort organizations by newest first
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    disabled={!can("orgs.create")}
                    onClick={() => {
                      setNewOrgMenuOpen(false);
                      router.push("/super-admin/organizations?import=1");
                    }}
                    className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--color-hover)] disabled:opacity-50 disabled:pointer-events-none transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-[var(--color-text-primary)] block">
                        Import Organizations
                      </span>
                      <span className="text-[11px] text-[var(--color-text-muted)]">
                        Bulk onboard workspaces from CSV
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />

      {loadError && <ErrorBanner message={loadError} onRetry={handleRefresh} />}

      {/* Live KPI Grid with subtle motion/hover effects */}
      {isRefreshing ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SurfaceCard key={i} className="p-4 h-28 animate-pulse bg-[var(--color-elevated)]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          <div className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <KpiCard
              label="Organizations"
              value={organizations.length}
              sublabel={`${stats.activeOrgs} Active • ${stats.trialOrgs} Trial • ${stats.suspendedOrgs} Suspended`}
              trend={{ value: "+2 this mo", positive: true }}
              icon={Building2}
              tone="blue"
            />
          </div>
          <div className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <KpiCard
              label="Monthly Recurring (MRR)"
              value={formatCurrency(stats.totalMrr)}
              sublabel={`ARR Run-rate: ${formatCurrency(stats.arr)}`}
              trend={{ value: "+14.2%", positive: true }}
              icon={TrendingUp}
              tone="emerald"
            />
          </div>
          <div className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <KpiCard
              label="Active Subscriptions"
              value={stats.activeSubs}
              sublabel={stats.pastDueSubs > 0 ? `${stats.pastDueSubs} past due dunning` : "All billing current"}
              trend={stats.pastDueSubs > 0 ? { value: `${stats.pastDueSubs} past due`, positive: false } : { value: "Healthy", positive: true }}
              icon={CreditCard}
              tone="violet"
            />
          </div>
          <div className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <KpiCard
              label="Net Collected"
              value={formatCurrency(stats.settledPayments)}
              sublabel={stats.failedPayments > 0 ? `${stats.failedPayments} failed txn needs retry` : "Zero failed charges"}
              icon={DollarSign}
              tone="emerald"
            />
          </div>
          <div className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <KpiCard
              label="Open / Overdue Invoices"
              value={formatCurrency(stats.outstandingBalance)}
              sublabel={`${stats.openInvoiceCount} invoices (${stats.overdueCount} overdue)`}
              trend={stats.overdueCount > 0 ? { value: `${stats.overdueCount} overdue`, positive: false } : undefined}
              icon={FileText}
              tone="amber"
            />
          </div>
          <div className="transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md rounded-xl">
            <KpiCard
              label="Operators & Notices"
              value={stats.activeOperators}
              sublabel={`${stats.onCallOperators} on-call • ${stats.liveAnnouncements} live banners`}
              icon={Users}
              tone="slate"
            />
          </div>
        </div>
      )}

      {/* Real-Time Streaming Telemetry Panel & Live Graph */}
      <SurfaceCard className="p-4 sm:p-5 transition-all duration-200 hover:border-violet-500/35">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-violet-500 animate-pulse" />
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Live Platform Telemetry Stream
              </h3>
              <StatusBadge
                label={autoRefreshEnabled ? `Streaming (${refreshIntervalSec}s)` : "Paused"}
                tone={autoRefreshEnabled ? "success" : "neutral"}
                dot
              />
            </div>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Real-time reactive API traffic, concurrent active sessions, and gateway latency pulse (simulated demo telemetry)
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 transition-all duration-200 hover:border-violet-500/40 hover:-translate-y-0.5">
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                <Zap className="w-3 h-3 text-violet-500" />
                Requests/min
              </span>
              <strong className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">
                {latestTelemetry.requestsPerMin.toLocaleString()}
              </strong>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 transition-all duration-200 hover:border-cyan-500/40 hover:-translate-y-0.5">
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                <Users className="w-3 h-3 text-cyan-500" />
                Live Sessions
              </span>
              <strong className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">
                {latestTelemetry.activeSessions.toLocaleString()}
              </strong>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 py-2 transition-all duration-200 hover:border-emerald-500/40 hover:-translate-y-0.5">
              <span className="flex items-center gap-1 text-[10px] text-[var(--color-text-muted)]">
                <Gauge className="w-3 h-3 text-emerald-500" />
                Avg Latency
              </span>
              <strong className="text-sm font-bold text-[var(--color-text-primary)] tabular-nums">
                {latestTelemetry.latencyMs} ms
              </strong>
            </div>
          </div>
        </div>

        <LiveTelemetryChart data={telemetrySeries} height={205} />
      </SurfaceCard>

      {/* Primary Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        <SurfaceCard className="lg:col-span-7 xl:col-span-8 p-4 sm:p-5 transition-all duration-200 hover:border-blue-500/35 hover:shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Revenue &amp; MRR Trajectory
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Monthly recurring revenue run-rate compared against net collected settlements
              </p>
            </div>
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs self-start">
              {(["6M", "12M"] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setChartHorizon(h)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all duration-150 ${
                    chartHorizon === h
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-300 shadow-xs"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>
          <RevenueOverviewChart data={revenueSeries} height={265} />
        </SurfaceCard>

        <SurfaceCard className="lg:col-span-5 xl:col-span-4 p-4 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:border-blue-500/35 hover:shadow-md">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Organizations by Plan Tier
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Interactive plan distribution — hover slices or cards to highlight
            </p>
          </div>
          <PlanDistributionChart data={planDistribution} height={220} />
        </SurfaceCard>
      </div>

      {/* Organization Stats Table + Growth Chart + Activity Stream */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
        {/* Top Organizations Statistics */}
        <SurfaceCard className="xl:col-span-7 overflow-hidden flex flex-col transition-all duration-200 hover:border-blue-500/35">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] px-4 sm:px-5 py-3.5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Organization Utilization &amp; Revenue
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Active seat consumption and monthly billing across top tenants
              </p>
            </div>
            <Link
              href="/super-admin/organizations"
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline transition-transform hover:translate-x-0.5"
            >
              Manage all <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isRefreshing ? (
            <TableSkeleton rows={5} />
          ) : topOrganizations.length === 0 ? (
            <EmptyStateView
              icon={Building2}
              title="No organizations yet"
              description="Provision your first tenant workspace to begin tracking utilization."
            />
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-4 py-2.5">Organization</th>
                    <th className="px-4 py-2.5">Plan</th>
                    <th className="px-4 py-2.5">Seat Capacity</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">MRR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {topOrganizations.map((org, idx) => {
                    const plan = plans.find((p) => p.id === org.planId);
                    const liveOrgSeats = Math.min(
                      org.seatsLimit,
                      org.seatsUsed + (idx === 0 ? liveSeatPulse : 0)
                    );
                    const pct = Math.min(
                      100,
                      Math.round((liveOrgSeats / Math.max(1, org.seatsLimit)) * 100)
                    );
                    return (
                      <tr
                        key={org.id}
                        onClick={() => router.push(`/super-admin/organizations?inspect=${org.id}`)}
                        className="group hover:bg-[var(--color-hover)] cursor-pointer transition-all duration-150"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[var(--color-text-primary)] group-hover:text-blue-500 transition-colors">
                            {org.name}
                          </div>
                          <div className="text-[11px] text-[var(--color-text-muted)]">
                            {org.industry} • {org.projectsCount} projects
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2 py-0.5 text-[11px] font-medium">
                            {plan?.name || "Custom"}
                          </span>
                        </td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-[var(--color-text-primary)] font-medium tabular-nums">
                              {liveOrgSeats} / {org.seatsLimit}
                            </span>
                            <span className="text-[var(--color-text-muted)] tabular-nums">{pct}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-[var(--color-elevated)] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                pct > 85 ? "bg-amber-500" : "bg-blue-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge label={org.status} tone={getStatusTone(org.status)} dot />
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[var(--color-text-primary)] tabular-nums">
                          {formatCurrency(org.mrr)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>

        {/* Right Stack: Growth Bar + Recent Activity */}
        <div className="xl:col-span-5 space-y-4 min-w-0">
          <SurfaceCard className="p-4 sm:p-5 transition-all duration-200 hover:border-blue-500/35 hover:shadow-md">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Tenant &amp; Seat Growth
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Cumulative provisioned workspaces &amp; active seat volume
                </p>
              </div>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
                {stats.totalSeats.toLocaleString()} seats
              </span>
            </div>
            <ComparisonBarChart
              data={orgGrowthSeries}
              primaryLabel="Organizations"
              secondaryLabel="Total Seats"
              primaryColor="#3B82F6"
              secondaryColor="#10B981"
              height={185}
            />
          </SurfaceCard>

          <SurfaceCard className="p-4 sm:p-5 transition-all duration-200 hover:border-blue-500/35">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Recent Platform Activity
                </h3>
              </div>
              <Link
                href="/super-admin/audit"
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Full log
              </Link>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {["ALL", "ORGANIZATION", "PAYMENT", "INVOICE", "COMMUNICATION"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActivityFilter(cat)}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-all duration-150 ${
                    activityFilter === cat
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                      : "bg-[var(--color-app-bg)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {filteredActivities.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)] py-6 text-center">
                  No recent activity in this category.
                </p>
              ) : (
                filteredActivities.map((act) => (
                  <div
                    key={act.id}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5 text-xs transition-all duration-200 hover:border-blue-500/40 hover:bg-[var(--color-hover)]/45 hover:translate-x-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <StatusBadge
                          label={act.category}
                          tone={
                            act.severity === "CRITICAL"
                              ? "danger"
                              : act.severity === "WARNING"
                              ? "warning"
                              : "info"
                          }
                        />
                        <span className="font-semibold text-[var(--color-text-primary)] truncate">
                          {act.action}
                        </span>
                      </div>
                      <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                        {formatDateTime(act.timestamp)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 leading-snug">
                      {act.summary}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                      By {act.actorName} ({act.actorEmail})
                    </p>
                  </div>
                ))
              )}
            </div>
          </SurfaceCard>
        </div>
      </div>

      {/* Connected Quick Workflows Strip */}
      <SurfaceCard className="p-4 transition-all duration-200 hover:border-blue-500/35">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text-primary)]">Quick Admin Shortcuts:</strong>{" "}
              Jump straight to billing recovery, plan pricing, SMTP diagnostics, or tenant broadcasts.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton variant="outline" size="xs" onClick={() => router.push("/super-admin/plans")} className="transition-transform hover:-translate-y-0.5">
              <Layers className="w-3.5 h-3.5" /> Plans
            </AdminButton>
            <AdminButton variant="outline" size="xs" onClick={() => router.push("/super-admin/payments")} className="transition-transform hover:-translate-y-0.5">
              <ShieldAlert className="w-3.5 h-3.5" /> Failed Payments ({stats.failedPayments})
            </AdminButton>
            <AdminButton variant="outline" size="xs" onClick={() => router.push("/super-admin/invoices")} className="transition-transform hover:-translate-y-0.5">
              <FileText className="w-3.5 h-3.5" /> Invoices ({stats.openInvoiceCount} Open)
            </AdminButton>
            <AdminButton variant="outline" size="xs" onClick={() => router.push("/super-admin/announcements")} className="transition-transform hover:-translate-y-0.5">
              <Megaphone className="w-3.5 h-3.5" /> Announcements
            </AdminButton>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
