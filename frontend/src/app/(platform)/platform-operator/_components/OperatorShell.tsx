"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/theme-store";
import { useAuthStore } from "@/store/auth-store";
import { usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { useSuperAdminStore } from "../../super-admin/_store/useSuperAdminStore";
import { formatDateTime } from "../_services/operator-service";
import { operatorApi } from "../_services/operator-api";
import { useOperatorResource } from "./OperatorLive";
import type { OpsDashboardStats } from "@/types/admin-operations";
import {
  OPERATOR_DEPARTMENTS,
  isRouteAuthorized,
} from "../_services/operator-permission-service";
import {
  Activity,
  AlertTriangle,
  Bell,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FileWarning,
  History,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  MailPlus,
  Megaphone,
  Menu,
  Moon,
  Search,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Wrench,
  X,
} from "lucide-react";
import { RolePreviewGlobalBanner } from "../../super-admin/_components/RolePreviewGlobalBanner";

interface NavItem {
  id: string;
  label: string;
  href: string;
  matchPaths?: string[];
  icon: React.ElementType;
  badgeCount?: number;
}

interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

const ROUTE_TITLES: Record<string, { section: string; label: string }> = {
  "/platform-operator": { section: "Operations Overview", label: "Operations Dashboard" },
  "/platform-operator/dashboard": { section: "Operations Overview", label: "Operations Dashboard" },
  "/platform-operator/organization-status": {
    section: "Operations Overview",
    label: "Organization Service Status",
  },
  "/platform-operator/org-status": {
    section: "Operations Overview",
    label: "Organization Service Status",
  },
  "/platform-operator/monitoring": { section: "Operations Overview", label: "System Monitoring" },
  "/platform-operator/incidents": { section: "Incidents & Support", label: "Incident Management" },
  "/platform-operator/support-tickets": { section: "Incidents & Support", label: "Support Tickets" },
  "/platform-operator/tickets": { section: "Incidents & Support", label: "Support Tickets" },
  "/platform-operator/access-requests": {
    section: "Incidents & Support",
    label: "Support Access Requests",
  },
  "/platform-operator/email-delivery": {
    section: "Communication Operations",
    label: "Email Delivery & SMTP Health",
  },
  "/platform-operator/email-drafts": {
    section: "Communication Operations",
    label: "Email Template Drafts",
  },
  "/platform-operator/announcement-drafts": {
    section: "Communication Operations",
    label: "Announcement Drafts",
  },
  "/platform-operator/subscription-status": {
    section: "Billing Operations",
    label: "Subscription Status",
  },
  "/platform-operator/payment-failures": {
    section: "Billing Operations",
    label: "Payment Failures",
  },
  "/platform-operator/invoice-delivery": {
    section: "Billing Operations",
    label: "Invoice Delivery",
  },
  "/platform-operator/backups": { section: "System Operations", label: "Backup Monitoring" },
  "/platform-operator/maintenance": {
    section: "System Operations",
    label: "Maintenance Operations",
  },
  "/platform-operator/alerts": { section: "System Operations", label: "Alerts & Notifications" },
  "/platform-operator/activity-logs": {
    section: "Account & Audit",
    label: "Operational Activity Logs",
  },
  "/platform-operator/settings": { section: "Account & Audit", label: "Operator Settings" },
};


/** Sidebar badge numbers, by nav item id. Only real server counters; an item without one shows no number. */
export interface OperatorBadgeCounts {
  incidents?: number;
  "support-tickets"?: number;
  "access-requests"?: number;
  alerts?: number;
  "failed-events"?: number;
  "sync-jobs"?: number;
  "email-delivery"?: number;
  maintenance?: number;
}

/**
 * Badge counts from GET /v1/operator/dashboard/stats. Zero or a missing counter = no badge (undefined). Payment
 * failures and the other items have no stats counter, so they never get a number here.
 */
export function badgeCountsFromStats(stats: OpsDashboardStats | null | undefined): OperatorBadgeCounts {
  const n = (v: number | null | undefined) => (typeof v === "number" && v > 0 ? v : undefined);
  if (!stats) return {};
  return {
    incidents: n(stats.openIncidents),
    "support-tickets": n(stats.openTickets),
    "access-requests": n(stats.pendingAccessRequests),
    alerts: n(stats.unacknowledgedAlerts),
    "failed-events": n(stats.failedOutboxEvents),
    "sync-jobs": n(stats.failedJobs),
    "email-delivery": n(stats.failedEmailDeliveries24h),
    maintenance: n(stats.activeMaintenanceWindows),
  };
}

export function OperatorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useThemeStore();
  const { currentRole, setCurrentRole, logout } = useAuthStore();

  const incidents = usePlatformOperatorStore((s) => s.incidents);
  const tickets = usePlatformOperatorStore((s) => s.tickets);
  const activityLogs = usePlatformOperatorStore((s) => s.activityLogs);
  const orgHealth = usePlatformOperatorStore((s) => s.orgHealth);
  const accountSettings = usePlatformOperatorStore((s) => s.accountSettings);
  const setOperatorDepartment = usePlatformOperatorStore((s) => s.setOperatorDepartment);
  const setActiveOperatorProfile = usePlatformOperatorStore((s) => s.setActiveOperatorProfile);
  const sidebarCollapsed = usePlatformOperatorStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = usePlatformOperatorStore((s) => s.setSidebarCollapsed);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [deptMenuOpen, setDeptMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    usePlatformOperatorStore.persist.rehydrate();
    const saved = localStorage.getItem("prowise-theme") as "light" | "dark" | "system" | null;
    if (saved) setTheme(saved);
    if (currentRole !== "PLATFORM_OPERATOR") {
      setCurrentRole("PLATFORM_OPERATOR");
    }
  }, [currentRole, setCurrentRole, setTheme]);

  useEffect(() => {
    setMobileOpen(false);
    setNotifOpen(false);
    setDeptMenuOpen(false);
    setProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        setNotifOpen(false);
        setDeptMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Sidebar badges: real counters from the server (never the demo store).
  const shellStats = useOperatorResource(() => operatorApi.dashboardStats(), "shell-stats");
  const badges = useMemo(
    () => badgeCountsFromStats(shellStats.state.status === "ready" ? shellStats.state.data : null),
    [shellStats.state],
  );

  const rawSections: NavSection[] = useMemo(
    () => [
      {
        id: "overview",
        title: "Operations Overview",
        items: [
          {
            id: "dashboard",
            label: "Operations Dashboard",
            href: "/platform-operator/dashboard",
            matchPaths: ["/platform-operator", "/platform-operator/dashboard"],
            icon: LayoutDashboard,
          },
          {
            id: "org-status",
            label: "Organization Service Status",
            href: "/platform-operator/organization-status",
            matchPaths: [
              "/platform-operator/organization-status",
              "/platform-operator/org-status",
            ],
            icon: Building2,
          },
          {
            id: "monitoring",
            label: "System Monitoring",
            href: "/platform-operator/monitoring",
            icon: Server,
          },
        ],
      },
      {
        id: "incidents-support",
        title: "Incidents & Support",
        items: [
          {
            id: "incidents",
            label: "Incident Management",
            href: "/platform-operator/incidents",
            icon: AlertTriangle,
            badgeCount: badges.incidents,
          },
          {
            id: "support-tickets",
            label: "Support Tickets",
            href: "/platform-operator/support-tickets",
            matchPaths: ["/platform-operator/support-tickets", "/platform-operator/tickets"],
            icon: LifeBuoy,
            badgeCount: badges["support-tickets"],
          },
          {
            id: "access-requests",
            label: "Support Access Requests",
            href: "/platform-operator/access-requests",
            icon: KeyRound,
            badgeCount: badges["access-requests"],
          },
        ],
      },
      {
        id: "communication",
        title: "Communication Operations",
        items: [
          {
            id: "email-delivery",
            label: "Email Delivery & SMTP Health",
            href: "/platform-operator/email-delivery",
            icon: Mail,
            badgeCount: badges["email-delivery"],
          },
          {
            id: "email-drafts",
            label: "Email Template Drafts",
            href: "/platform-operator/email-drafts",
            icon: MailPlus,
          },
          {
            id: "announcement-drafts",
            label: "Announcement Drafts",
            href: "/platform-operator/announcement-drafts",
            icon: Megaphone,
          },
        ],
      },
      {
        id: "billing",
        title: "Billing Operations",
        items: [
          {
            id: "subscription-status",
            label: "Subscription Status",
            href: "/platform-operator/subscription-status",
            icon: ShieldCheck,
          },
          {
            id: "payment-failures",
            label: "Payment Failures",
            href: "/platform-operator/payment-failures",
            icon: FileWarning,
            // No server counter for payment failures: the item stays, without a number.
          },
          {
            id: "invoice-delivery",
            label: "Invoice Delivery",
            href: "/platform-operator/invoice-delivery",
            icon: CreditCard,
          },
        ],
      },
      {
        id: "system-ops",
        title: "System Operations",
        items: [
          {
            id: "backups",
            label: "Backup Monitoring",
            href: "/platform-operator/backups",
            icon: DatabaseBackup,
          },
          {
            id: "maintenance",
            label: "Maintenance Operations",
            href: "/platform-operator/maintenance",
            icon: Wrench,
            badgeCount: badges.maintenance,
          },
          {
            id: "alerts",
            label: "Alerts & Notifications",
            href: "/platform-operator/alerts",
            icon: Bell,
            badgeCount: badges.alerts,
          },
        ],
      },
      {
        id: "account",
        title: "Account & Audit",
        items: [
          {
            id: "activity-logs",
            label: "Operational Activity Logs",
            href: "/platform-operator/activity-logs",
            icon: History,
          },
          {
            id: "settings",
            label: "Operator Settings",
            href: "/platform-operator/settings",
            icon: Settings,
          },
        ],
      },
    ],
    [badges]
  );

  const activeDepartment = accountSettings.department || "Platform Operations";
  const superAdminOperators = useSuperAdminStore((s) => s.operators);

  const activeOperator = useMemo(() => {
    const byId = superAdminOperators.find((o) => o.id === accountSettings.activeOperatorId);
    if (byId) return { ...byId, accessLevel: byId.accessLevel || "MAIN_PLATFORM_OPERATOR" };
    const byDept = superAdminOperators.find((o) => o.department === activeDepartment);
    if (byDept) return { ...byDept, accessLevel: byDept.accessLevel || "MAIN_PLATFORM_OPERATOR" };
    return {
      id: "op-current",
      name: accountSettings.name,
      email: accountSettings.email,
      department: activeDepartment,
      accessLevel: "MAIN_PLATFORM_OPERATOR" as const,
      roleId: "role-platform-operator",
      status: "ACTIVE" as const,
      mfaEnabled: accountSettings.mfaEnabled,
      onCall: true,
      shiftName: accountSettings.shiftName,
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }, [superAdminOperators, accountSettings, activeDepartment]);

  const sections: NavSection[] = useMemo(() => {
    return rawSections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => isRouteAuthorized(activeOperator, item.href)),
      }))
      .filter((section) => section.items.length > 0);
  }, [rawSections, activeOperator]);

  const isCurrentPathAuthorized = useMemo(() => {
    return isRouteAuthorized(activeOperator, pathname);
  }, [activeOperator, pathname]);

  const routeMeta = ROUTE_TITLES[pathname] || {
    section: "Platform Operator",
    label: "Operations",
  };

  const quickSearchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const pages = sections.flatMap((s) =>
      s.items.map((item) => ({
        title: item.label,
        subtitle: s.title,
        href: item.href,
        kind: "Page",
      }))
    );

    if (!q) return pages.slice(0, 8);

    const orgHits = orgHealth
      .filter((o) => o.orgName.toLowerCase().includes(q))
      .map((o) => ({
        title: o.orgName,
        subtitle: `Status: ${o.status} · ${o.region}`,
        href: "/platform-operator/organization-status",
        kind: "Organization",
      }));

    const incHits = incidents
      .filter((i) => i.code.toLowerCase().includes(q) || i.title.toLowerCase().includes(q))
      .map((i) => ({
        title: `${i.code}: ${i.title}`,
        subtitle: `${i.severity} · ${i.status}`,
        href: "/platform-operator/incidents",
        kind: "Incident",
      }));

    const tktHits = tickets
      .filter((t) => t.ticketNumber.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q))
      .map((t) => ({
        title: `${t.ticketNumber}: ${t.subject}`,
        subtitle: `${t.orgName} · ${t.status}`,
        href: "/platform-operator/support-tickets",
        kind: "Ticket",
      }));

    const pageHits = pages.filter(
      (p) => p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q)
    );

    return [...pageHits, ...incHits, ...tktHits, ...orgHits].slice(0, 10);
  }, [searchTerm, sections, orgHealth, incidents, tickets]);

  const toggleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    toast.success(`Switched to ${next} mode`);
  };

  const totalNotifs = (badges.alerts ?? 0) + (badges["failed-events"] ?? 0);

  const renderSidebarBody = (isMobileDrawer: boolean) => {
    const collapsed = isMobileDrawer ? false : sidebarCollapsed;
    return (
      <div className="flex h-full flex-col bg-[var(--color-sidebar)] text-[var(--color-text-primary)] select-none">
        <div
          className={cn(
            "flex h-14 items-center border-b border-[var(--color-border)] shrink-0",
            collapsed ? "justify-center px-2" : "justify-between px-4"
          )}
        >
          <Link
            href="/platform-operator/dashboard"
            className="flex items-center gap-2.5 min-w-0"
            title="ProWise Platform Operator"
          >
            <div className="h-8 w-8 rounded-lg bg-[#0D9488] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Activity className="w-4 h-4" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight truncate">ProWise</span>
                  <span className="rounded bg-teal-500/15 border border-teal-500/30 px-1.5 py-0.5 text-[10px] font-bold text-teal-700 dark:text-teal-300">
                    OPERATOR
                  </span>
                </div>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                  Operations & Reliability
                </p>
              </div>
            )}
          </Link>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            !collapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="rounded-lg p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4">
          {sections.map((section) => (
            <div key={section.id} className="space-y-1">
              {!collapsed && (
                <p className="px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.matchPaths
                  ? item.matchPaths.includes(pathname)
                  : pathname === item.href;

                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "group flex items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-teal-500/12 text-teal-700 dark:text-teal-300 font-semibold"
                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]",
                      collapsed && "justify-center px-2"
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={cn(
                          "w-4 h-4 shrink-0",
                          isActive
                            ? "text-teal-600 dark:text-teal-400"
                            : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]"
                        )}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!collapsed && item.badgeCount !== undefined && item.badgeCount > 0 && (
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                        {item.badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-[var(--color-border)] p-2.5 space-y-2 shrink-0">
          {collapsed && !isMobileDrawer ? (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="w-full flex items-center justify-center rounded-lg py-2 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--color-text-primary)]">
                  Delegated Scope
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <p className="text-[var(--color-text-muted)] leading-snug">
                Global billing rules & final approvals belong to Super Admin.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen w-full bg-[var(--color-app-bg)] text-[var(--color-text-primary)] antialiased">
      <aside
        className={cn(
          "hidden lg:block shrink-0 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] sticky top-0 h-screen transition-all duration-200 z-30",
          sidebarCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        {renderSidebarBody(false)}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full border-r border-[var(--color-border)] bg-[var(--color-sidebar)] shadow-2xl">
            {renderSidebarBody(true)}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-sm px-3 sm:px-5 lg:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
                <span className="hidden sm:inline">Platform Operator</span>
                <span className="hidden sm:inline">/</span>
                <span className="hidden md:inline">{routeMeta.section}</span>
                <span className="hidden md:inline">/</span>
                <span className="font-semibold text-[var(--color-text-primary)] truncate">
                  {routeMeta.label}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-muted)] hover:border-teal-500/40 hover:text-[var(--color-text-primary)] transition-colors"
              title="Quick search (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Search operations...</span>
              <kbd className="hidden xl:inline rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px]">
                Ctrl+K
              </kbd>
            </button>

            {/* Operator Department Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setDeptMenuOpen((v) => !v);
                  setNotifOpen(false);
                  setProfileMenuOpen(false);
                }}
                className="flex items-center gap-1.5 h-8 rounded-lg border border-teal-500/30 bg-teal-500/10 px-2.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/20 transition-colors"
                title="Switch active operator department"
              >
                <Shield className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span className="hidden sm:inline truncate max-w-[150px]">
                  {activeOperator?.accessLevel === "MAIN_PLATFORM_OPERATOR" ? "Main Operator (Global)" : activeDepartment}
                </span>
                <ChevronDown className="w-3 h-3 text-teal-600 dark:text-teal-400" />
              </button>

              {deptMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-2xl z-40 space-y-1">
                  <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-1.5 flex items-center justify-between">
                    <span>Department Context</span>
                    <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400">7 Departments</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto space-y-1 pr-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDeptMenuOpen(false);
                        const mainOp = superAdminOperators.find((o) => o.accessLevel === "MAIN_PLATFORM_OPERATOR" || o.id === "op-main-1");
                        if (mainOp) {
                          setActiveOperatorProfile({
                            id: mainOp.id,
                            name: mainOp.name,
                            email: mainOp.email,
                            department: "Platform Operations",
                            shiftName: mainOp.shiftName,
                            mfaEnabled: mainOp.mfaEnabled,
                          });
                        } else {
                          setOperatorDepartment("Platform Operations");
                        }
                        toast.success("Switched to Main Platform Operator (Global Operational Scope)");
                      }}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-left transition-colors border-b border-[var(--color-border)] mb-1 pb-2",
                        activeOperator?.accessLevel === "MAIN_PLATFORM_OPERATOR"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold"
                          : "text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]"
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                        <div>
                          <div className="font-semibold text-[11px]">Main Platform Operator</div>
                          <div className="text-[10px] text-[var(--color-text-muted)]">Global Scope (All 7 Departments)</div>
                        </div>
                      </div>
                    </button>
                    {OPERATOR_DEPARTMENTS.map((dept) => {
                      const sampleOp = superAdminOperators.find((o) => o.department === dept);
                      const isCurrent = dept === activeDepartment;
                      return (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => {
                            setDeptMenuOpen(false);
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
                            toast.success(`Active context switched to ${dept}`);
                          }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs text-left transition-colors",
                            isCurrent
                              ? "bg-teal-500/15 text-teal-700 dark:text-teal-300 font-semibold"
                              : "text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]"
                          )}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="font-semibold truncate">{dept}</div>
                            {sampleOp && (
                              <div className="text-[10px] text-[var(--color-text-muted)] truncate">
                                {sampleOp.name} • {sampleOp.shiftName?.split(" ")[0] || "Shift"}
                              </div>
                            )}
                          </div>
                          {isCurrent && (
                            <span className="rounded bg-teal-500/20 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 dark:text-teal-300 shrink-0">
                              Active
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileMenuOpen(false);
                }}
                aria-label="Operational notifications"
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
              >
                <Bell className="w-4 h-4" />
                {totalNotifs > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {totalNotifs}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl z-40 overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3.5 py-2.5">
                    <span className="text-xs font-semibold">Operational Attention</span>
                    <span className="text-[11px] text-[var(--color-text-muted)]">
                      {totalNotifs} active
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-border)]">
                    {activityLogs.slice(0, 6).map((act) => (
                      <div key={act.id} className="px-3.5 py-2.5 text-xs space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[var(--color-text-primary)] truncate">
                            {act.action}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                            {act.category}
                          </span>
                        </div>
                        <p className="text-[var(--color-text-secondary)] line-clamp-2">{act.summary}</p>
                        <p className="text-[10px] text-[var(--color-text-muted)]">
                          {formatDateTime(act.timestamp)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[var(--color-border)] px-3.5 py-2 text-center">
                    <Link
                      href="/platform-operator/alerts"
                      className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      Open Alerts & Notifications
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle color theme"
              title="Toggle light/dark theme"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((v) => !v);
                  setNotifOpen(false);
                }}
                aria-label="Operator profile menu"
                className="flex items-center gap-2 h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] pl-1.5 pr-2.5 text-xs hover:bg-[var(--color-hover)]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-[#0D9488] text-[10px] font-bold text-white">
                  {accountSettings.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <span className="hidden md:inline font-medium max-w-[110px] truncate">
                  {accountSettings.name}
                </span>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-xl z-40 space-y-1.5">
                  <div className="px-2 py-1.5 border-b border-[var(--color-border)]">
                    <p className="text-xs font-semibold truncate">{accountSettings.name}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                      {accountSettings.email}
                    </p>
                  </div>
                  <Link
                    href="/platform-operator/settings"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Operator Settings
                  </Link>
                  <Link
                    href="/platform-operator/activity-logs"
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Activity History
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      router.push("/login");
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <RolePreviewGlobalBanner />

        <main className="flex-1 w-full min-w-0 px-3 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6 max-w-[2200px] mx-auto">
          {isCurrentPathAuthorized ? (
            children
          ) : (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center max-w-xl mx-auto my-12 space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <span className="rounded-full bg-rose-500/15 border border-rose-500/30 px-3 py-0.5 text-xs font-bold text-rose-700 dark:text-rose-300">
                  403 ACCESS RESTRICTED
                </span>
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                  Module Not Authorized
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] max-w-md mx-auto">
                  Your active department (<strong>{activeDepartment}</strong>) does not have authorization to view <strong>{routeMeta.label}</strong>.
                  Individual permission overrides can be granted by a Super Administrator in Platform Operator Management.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/platform-operator/dashboard"
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs px-4 py-2.5 transition-colors shadow-sm"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Return to Authorized Operations Dashboard
                </Link>
              </div>
            </div>
          )}
        </main>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setSearchOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-4 py-3">
              <Search className="w-4 h-4 text-[var(--color-text-muted)]" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Jump to page, organization, incident, or ticket..."
                className="w-full bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border)]">
              {quickSearchResults.map((res, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchTerm("");
                    router.push(res.href);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-[var(--color-hover)] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {res.title}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-secondary)] truncate">
                      {res.subtitle}
                    </p>
                  </div>
                  <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-secondary)] shrink-0">
                    {res.kind}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <Toaster position="bottom-right" theme={mounted ? resolvedTheme : "light"} richColors closeButton />
    </div>
  );
}
