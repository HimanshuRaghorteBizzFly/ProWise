"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Gauge,
  Layers,
  Megaphone,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  useAdminPermissions,
  useSuperAdminStore,
} from "./_store/useSuperAdminStore";
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
  PageHeader,
  StatusBadge,
  SurfaceCard,
  TableSkeleton,
  getStatusTone,
} from "./_components/SuperAdminPrimitives";
import {
  ComparisonBarChart,
  PlanDistributionChart,
  RevenueOverviewChart,
} from "./_components/SuperAdminCharts";
import { DashboardKpiCards } from "./_components/DashboardKpiCards";
import { AdminCalendar } from "./_components/AdminCalendar";
import { UpcomingEventsWidget } from "./_components/UpcomingEventsWidget";
import { AdminCalendarEvent } from "./_types";
import { generateSynchronizedCalendarEvents } from "./_services/calendar-service";

const PLAN_COLORS = ["#64748B", "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B"];

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
  const incidents = useSuperAdminStore((s) => s.incidents);
  const accessApprovals = useSuperAdminStore((s) => s.accessApprovals);
  const manualCalendarEvents = useSuperAdminStore((s) => s.manualCalendarEvents);

  const { can } = useAdminPermissions();

  // Filters & State
  const [chartHorizon, setChartHorizon] = useState<"6M" | "12M">("6M");
  const [growthHorizon, setGrowthHorizon] = useState<"3M" | "6M" | "1Y" | "ALL">("6M");
  const [activityFilter, setActivityFilter] = useState<string>("ALL");
  const [orgTableSearch, setOrgTableSearch] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Auto-refresh state (reactive demo mode)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [refreshIntervalSec, setRefreshIntervalSec] = useState<3 | 5 | 15 | 30>(5);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>("");

  // New Organizations functional dropdown state
  const [newOrgMenuOpen, setNewOrgMenuOpen] = useState(false);
  const newOrgMenuRef = useRef<HTMLDivElement | null>(null);

  // Calendar State & Linking
  const [calendarTimezone, setCalendarTimezone] = useState("LOCAL");
  const [selectedUpcomingEvent, setSelectedUpcomingEvent] = useState<AdminCalendarEvent | null>(null);
  const [calendarCreateSignal, setCalendarCreateSignal] = useState(0);

  // Unified Calendar events list for Upcoming Events widget
  const unifiedCalendarEvents = useMemo(() => {
    const auto = generateSynchronizedCalendarEvents({
      subscriptions,
      invoices,
      announcements,
      accessApprovals,
      incidents,
      organizations,
      plans,
    });
    return [...auto, ...manualCalendarEvents];
  }, [
    subscriptions,
    invoices,
    announcements,
    accessApprovals,
    incidents,
    organizations,
    plans,
    manualCalendarEvents,
  ]);

  useEffect(() => {
    setLastUpdatedAt(
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );
  }, []);

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const timer = setInterval(() => {
      useSuperAdminStore.persist.rehydrate();
      setLastUpdatedAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }, refreshIntervalSec * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshEnabled, refreshIntervalSec]);

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

  // Shared KPI calculations for charts consistency
  const stats = useMemo(() => {
    const totalMrr = organizations.reduce((sum, o) => sum + o.mrr, 0);
    const totalSeats = organizations.reduce((sum, o) => sum + o.seatsUsed, 0);
    const settledPayments = payments
      .filter((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED")
      .reduce((sum, p) => sum + (p.amount - p.refundedAmount), 0);
    const failedPayments = payments.filter((p) => p.status === "FAILED").length;

    const openOrOverdueInvoices = invoices.filter(
      (i) => i.status === "OPEN" || i.status === "OVERDUE"
    );
    const outstandingBalance = openOrOverdueInvoices.reduce((sum, i) => sum + i.total, 0);

    return {
      totalMrr,
      arr: totalMrr * 12,
      totalSeats,
      settledPayments,
      failedPayments,
      openInvoiceCount: openOrOverdueInvoices.length,
      outstandingBalance,
    };
  }, [organizations, payments, invoices]);

  // Consistent Revenue & MRR Trajectory
  const revenueSeries = useMemo(() => {
    const currentMrr = stats.totalMrr;
    const currentCollected = Math.max(stats.settledPayments, currentMrr);
    const totalRefunded = payments.reduce((s, p) => s + p.refundedAmount, 0);

    const base6 = [
      { period: "Jun", mrr: Math.round(currentMrr * 0.56), collected: Math.round(currentCollected * 0.42), refunded: 0 },
      { period: "Jul", mrr: Math.round(currentMrr * 0.65), collected: Math.round(currentCollected * 0.51), refunded: 499 },
      { period: "Aug", mrr: Math.round(currentMrr * 0.74), collected: Math.round(currentCollected * 0.62), refunded: 0 },
      { period: "Sep", mrr: Math.round(currentMrr * 0.84), collected: Math.round(currentCollected * 0.71), refunded: 499 },
      { period: "Oct", mrr: Math.round(currentMrr * 0.92), collected: Math.round(currentCollected * 0.89), refunded: 450 },
      { period: "Nov (Live)", mrr: currentMrr, collected: currentCollected, refunded: totalRefunded },
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
  }, [stats.totalMrr, stats.settledPayments, payments, chartHorizon]);

  // Organizations by Plan Tier
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

  // Tenant & Seat Growth with Horizon Date Filter
  const orgGrowthSeries = useMemo(() => {
    const total = organizations.length;
    const totalSeats = stats.totalSeats;

    if (growthHorizon === "3M") {
      return [
        { label: "Sep", primary: Math.max(4, total - 2), secondary: Math.max(450, Math.round(totalSeats * 0.76)) },
        { label: "Oct", primary: Math.max(5, total - 1), secondary: Math.max(620, Math.round(totalSeats * 0.88)) },
        { label: "Now", primary: total, secondary: totalSeats },
      ];
    }
    if (growthHorizon === "1Y" || growthHorizon === "ALL") {
      return [
        { label: "Dec '25", primary: Math.max(1, total - 7), secondary: 180 },
        { label: "Feb '26", primary: Math.max(2, total - 6), secondary: 290 },
        { label: "Apr '26", primary: Math.max(3, total - 5), secondary: 420 },
        { label: "Jun '26", primary: Math.max(4, total - 4), secondary: 560 },
        { label: "Aug '26", primary: Math.max(5, total - 2), secondary: 710 },
        { label: "Oct '26", primary: Math.max(6, total - 1), secondary: 840 },
        { label: "Now", primary: total, secondary: totalSeats },
      ];
    }

    // Default 6M
    return [
      { label: "Jun", primary: Math.max(2, total - 5), secondary: Math.max(280, Math.round(totalSeats * 0.38)) },
      { label: "Jul", primary: Math.max(3, total - 4), secondary: Math.max(390, Math.round(totalSeats * 0.52)) },
      { label: "Aug", primary: Math.max(4, total - 3), secondary: Math.max(510, Math.round(totalSeats * 0.65)) },
      { label: "Sep", primary: Math.max(5, total - 2), secondary: Math.max(650, Math.round(totalSeats * 0.78)) },
      { label: "Oct", primary: Math.max(6, total - 1), secondary: Math.max(790, Math.round(totalSeats * 0.9)) },
      { label: "Now", primary: total, secondary: totalSeats },
    ];
  }, [organizations.length, stats.totalSeats, growthHorizon]);

  // Filtered Organizations for Table with Search
  const filteredOrganizations = useMemo(() => {
    let list = [...organizations].sort((a, b) => b.mrr - a.mrr || b.seatsUsed - a.seatsUsed);
    if (!orgTableSearch.trim()) return list;

    const q = orgTableSearch.toLowerCase().trim();
    return list.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        o.domain.toLowerCase().includes(q) ||
        o.industry.toLowerCase().includes(q) ||
        o.ownerEmail.toLowerCase().includes(q) ||
        o.ownerName.toLowerCase().includes(q)
    );
  }, [organizations, orgTableSearch]);

  // Filtered Activities
  const filteredActivities = useMemo(() => {
    if (activityFilter === "ALL") return activities.slice(0, 8);
    return activities.filter((a) => a.category === activityFilter).slice(0, 8);
  }, [activities, activityFilter]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLoadError(null);
    try {
      await withSimulatedRequest(
        () => {
          useSuperAdminStore.persist.rehydrate();
          setLastUpdatedAt(
            new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          );
          return true;
        },
        { delayMs: 250 }
      );
      toast.success("Dashboard metrics and calendar synchronization refreshed");
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
      [
        "Sr. No.",
        "Organization",
        "Slug",
        "Status",
        "Plan",
        "Seats Used",
        "Seats Limit",
        "Projects",
        "MRR (USD)",
        "Owner Email",
      ],
      organizations.map((o, idx) => {
        const plan = plans.find((p) => p.id === o.planId);
        return [
          idx + 1,
          o.name,
          o.slug,
          o.status,
          plan?.name || "Custom",
          o.seatsUsed,
          o.seatsLimit,
          o.projectsCount,
          o.mrr,
          o.ownerEmail,
        ];
      })
    );
    toast.success("Exported organization & revenue summary CSV");
  };

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      {/* Header Toolbar */}
      <PageHeader
        title="Platform Overview"
        description="Super Admin mission control: cross-tenant health, revenue trajectory, administrative calendar, and operational governance."
        simulationLabel="Reactive Demo Data"
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
                {autoRefreshEnabled ? "Live Sync" : "Paused"}
              </span>
              {lastUpdatedAt && (
                <span className="text-[11px] text-[var(--color-text-muted)] hidden md:inline tabular-nums">
                  • {lastUpdatedAt}
                </span>
              )}
              <select
                value={refreshIntervalSec}
                onChange={(e) =>
                  setRefreshIntervalSec(Number(e.target.value) as 3 | 5 | 15 | 30)
                }
                aria-label="Auto-refresh interval"
                className="bg-transparent text-[11px] font-medium text-[var(--color-text-secondary)] focus:outline-none [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value={3} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                  3s
                </option>
                <option value={5} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                  5s
                </option>
                <option value={15} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                  15s
                </option>
                <option value={30} className="bg-[var(--color-surface)] text-[var(--color-text-primary)]">
                  30s
                </option>
              </select>
              <button
                type="button"
                onClick={() => {
                  setAutoRefreshEnabled((prev) => !prev);
                  toast.info(
                    autoRefreshEnabled ? "Auto-refresh paused" : "Live synchronization resumed"
                  );
                }}
                aria-label={autoRefreshEnabled ? "Pause auto-refresh" : "Resume auto-refresh"}
                title={autoRefreshEnabled ? "Pause auto-refresh" : "Resume auto-refresh"}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {autoRefreshEnabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
            </div>

            <AdminButton
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              isLoading={isRefreshing}
              className="transition-transform duration-150 active:scale-95"
            >
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

            {/* New Organizations Dropdown */}
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

      {/* 1. Dashboard KPI Cards (Interactive, data-driven cards) */}
      <DashboardKpiCards />

      {/* 2. Primary Charts: Revenue & MRR Trajectory + Organizations by Plan Tier */}
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

      {/* 3. Organization Utilization & Revenue Table + Growth Chart + Activity Stream */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 min-w-0">
        {/* Left: Organization Utilization & Revenue Table with Sr. No, Search, and View Details */}
        <SurfaceCard className="xl:col-span-7 overflow-hidden flex flex-col transition-all duration-200 hover:border-blue-500/35">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 sm:px-5 py-3.5">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Organization Utilization &amp; Revenue
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Active seat consumption, status, and monthly billing across tenant workspaces
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Search filter input */}
              <div className="relative min-w-[170px] sm:min-w-[210px]">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                <input
                  type="text"
                  placeholder="Filter orgs..."
                  value={orgTableSearch}
                  onChange={(e) => setOrgTableSearch(e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-8 pr-7 py-1 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-blue-500 transition-colors"
                />
                {orgTableSearch && (
                  <button
                    type="button"
                    onClick={() => setOrgTableSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
              <Link
                href="/super-admin/organizations"
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                Manage all <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {isRefreshing ? (
            <TableSkeleton rows={6} />
          ) : filteredOrganizations.length === 0 ? (
            <div className="p-8 text-center">
              <EmptyStateView
                icon={Building2}
                title="No matching organizations found"
                description={`No workspaces found matching "${orgTableSearch}".`}
                actionLabel="Clear Search"
                onAction={() => setOrgTableSearch("")}
              />
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <tr>
                    <th className="px-3 py-2.5 text-center w-12">Sr. No.</th>
                    <th className="px-4 py-2.5">Organization</th>
                    <th className="px-3 py-2.5">Plan</th>
                    <th className="px-4 py-2.5 min-w-[140px]">Seat Capacity</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">MRR</th>
                    <th className="px-4 py-2.5 text-right w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filteredOrganizations.slice(0, 8).map((org, idx) => {
                    const plan = plans.find((p) => p.id === org.planId);
                    const pct = Math.min(
                      100,
                      Math.round((org.seatsUsed / Math.max(1, org.seatsLimit)) * 100)
                    );
                    return (
                      <tr
                        key={org.id}
                        className="group hover:bg-[var(--color-hover)] transition-all duration-150"
                      >
                        {/* Sr. No. */}
                        <td className="px-3 py-3 text-center text-xs font-semibold text-[var(--color-text-muted)] tabular-nums">
                          #{idx + 1}
                        </td>

                        {/* Organization */}
                        <td className="px-4 py-3">
                          <div className="font-semibold text-[var(--color-text-primary)] group-hover:text-blue-500 transition-colors">
                            {org.name}
                          </div>
                          <div className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[200px]">
                            {org.domain} • {org.industry}
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="px-3 py-3">
                          <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                            {plan?.name || "Custom"}
                          </span>
                        </td>

                        {/* Seat Capacity */}
                        <td className="px-4 py-3 min-w-[140px]">
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="text-[var(--color-text-primary)] font-medium tabular-nums">
                              {org.seatsUsed} / {org.seatsLimit}
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

                        {/* Status */}
                        <td className="px-3 py-3">
                          <StatusBadge label={org.status} tone={getStatusTone(org.status)} dot />
                        </td>

                        {/* MRR */}
                        <td className="px-4 py-3 text-right font-semibold text-[var(--color-text-primary)] tabular-nums whitespace-nowrap">
                          {formatCurrency(org.mrr)}
                        </td>

                        {/* View Details Action */}
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/super-admin/organizations?inspect=${org.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30 transition-all active:scale-95 whitespace-nowrap"
                          >
                            <Eye className="w-3 h-3" />
                            <span>View Details</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-sidebar)] text-[11px] text-[var(--color-text-muted)] flex items-center justify-between">
                <span>
                  Showing {Math.min(8, filteredOrganizations.length)} of {organizations.length} organizations
                </span>
                {filteredOrganizations.length > 8 && (
                  <Link
                    href="/super-admin/organizations"
                    className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                  >
                    View all {filteredOrganizations.length} &rarr;
                  </Link>
                )}
              </div>
            </div>
          )}
        </SurfaceCard>

        {/* Right Stack: Growth Bar + Recent Activity */}
        <div className="xl:col-span-5 space-y-4 min-w-0">
          {/* Tenant & Seat Growth Chart with Date Filters */}
          <SurfaceCard className="p-4 sm:p-5 transition-all duration-200 hover:border-blue-500/35 hover:shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Tenant &amp; Seat Growth
                </h3>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Cumulative provisioned workspaces &amp; active seat volume
                </p>
              </div>

              {/* Date Filters */}
              <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs self-start">
                {(["3M", "6M", "1Y", "ALL"] as const).map((horizon) => (
                  <button
                    key={horizon}
                    type="button"
                    onClick={() => setGrowthHorizon(horizon)}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-all duration-150 ${
                      growthHorizon === horizon
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-300 shadow-xs"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    {horizon}
                  </button>
                ))}
              </div>
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

          {/* Recent Platform Activity */}
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
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                View Full Log <ArrowUpRight className="w-3.5 h-3.5" />
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

      {/* 4. Functional Administrative Calendar & Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 min-w-0">
        <div className="lg:col-span-8 xl:col-span-9 min-w-0">
          <AdminCalendar
            selectedEventFromUpcoming={selectedUpcomingEvent}
            onClearSelectedUpcoming={() => setSelectedUpcomingEvent(null)}
            timezone={calendarTimezone}
            onChangeTimezone={setCalendarTimezone}
            triggerCreateSignal={calendarCreateSignal}
          />
        </div>
        <div className="lg:col-span-4 xl:col-span-3 min-w-0">
          <UpcomingEventsWidget
            events={unifiedCalendarEvents}
            timezone={calendarTimezone}
            onSelectEvent={(evt) => setSelectedUpcomingEvent(evt)}
            onOpenCreateModal={() => {
              setSelectedUpcomingEvent(null);
              setCalendarCreateSignal((prev) => prev + 1);
            }}
          />
        </div>
      </div>

      {/* 5. Connected Quick Workflows Strip */}
      <SurfaceCard className="p-4 transition-all duration-200 hover:border-blue-500/35">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text-primary)]">Quick Admin Shortcuts:</strong>{" "}
              Jump straight to billing recovery, plan pricing, tenant broadcasts, or security audits.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              variant="outline"
              size="xs"
              onClick={() => router.push("/super-admin/plans")}
              className="transition-transform hover:-translate-y-0.5"
            >
              <Layers className="w-3.5 h-3.5" /> Plans
            </AdminButton>
            <AdminButton
              variant="outline"
              size="xs"
              onClick={() => router.push("/super-admin/payments?status=FAILED")}
              className="transition-transform hover:-translate-y-0.5"
            >
              <ShieldAlert className="w-3.5 h-3.5" /> Failed Payments ({stats.failedPayments})
            </AdminButton>
            <AdminButton
              variant="outline"
              size="xs"
              onClick={() => router.push("/super-admin/invoices")}
              className="transition-transform hover:-translate-y-0.5"
            >
              <FileText className="w-3.5 h-3.5" /> Invoices ({stats.openInvoiceCount} Open)
            </AdminButton>
            <AdminButton
              variant="outline"
              size="xs"
              onClick={() => router.push("/super-admin/announcements")}
              className="transition-transform hover:-translate-y-0.5"
            >
              <Megaphone className="w-3.5 h-3.5" /> Announcements
            </AdminButton>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
