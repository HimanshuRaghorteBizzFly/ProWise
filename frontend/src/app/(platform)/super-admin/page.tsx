"use client";

<<<<<<< HEAD
import { previewEnabled } from "@/lib/permissions";
import { LivePlatformDashboard } from "./_components/LivePlatformViews";
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
import { RolePreviewDashboardView } from "./_components/RolePreviewDashboardView";

const PLAN_COLORS = ["#64748B", "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B"];

function PreviewSuperAdminDashboardPage() {
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
  const activeRoleId = useSuperAdminStore((s) => s.activeRoleId);

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

  if (activeRoleId && activeRoleId !== "role-super-admin") {
    return <RolePreviewDashboardView roleId={activeRoleId} />;
  }
=======
import React from "react";
import { RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { AdminDashboard } from "@/types/admin";
import { useAdminResource } from "@/components/super-admin/admin-resource";
import { DashboardBody } from "@/components/super-admin/DashboardView";
import { AdminButton, ErrorBanner, PageHeader, SurfaceCard, TableSkeleton } from "./_components/SuperAdminPrimitives";

/**
 * Super Admin overview. Every figure comes from GET /v1/admin/dashboard at the moment it is loaded: no sample data,
 * no estimated history and no trends (none is stored yet). Refresh loads it again.
 */
export default function SuperAdminDashboardPage() {
  const { state, reload } = useAdminResource<AdminDashboard>(() => apiClient.admin.dashboard(), "dashboard");
>>>>>>> 29db595 (Initial ProWise project upload)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Overview"
        description="Live counts from the ProWise server."
        actions={
          <AdminButton variant="outline" size="sm" onClick={() => void reload()} disabled={state.status === "loading"}>
            <RefreshCw className={`w-3.5 h-3.5 ${state.status === "loading" ? "animate-spin" : ""}`} />
            Refresh
          </AdminButton>
        }
      />

      {state.status === "loading" && (
        <SurfaceCard className="p-4">
          <div role="status" aria-label="Loading">
            <TableSkeleton rows={4} />
          </div>
        </SurfaceCard>
      )}

      {state.status === "error" && (
        <SurfaceCard className="p-4">
          <ErrorBanner message={state.message} onRetry={() => void reload()} />
        </SurfaceCard>
      )}

      {state.status === "ready" && <DashboardBody data={state.data} />}
    </div>
  );
}

/** Stored platform data by default; the sample dashboard only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function SuperAdminDashboardPage() {
  return previewEnabled() ? <PreviewSuperAdminDashboardPage /> : <LivePlatformDashboard />;
}
