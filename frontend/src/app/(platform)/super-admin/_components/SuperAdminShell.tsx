"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  KeyRound,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Sun,
  UserCheck,
  UserCog,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Toaster, toast } from "sonner";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/theme-store";
import { useAuthStore } from "@/store/auth-store";
import { SystemRole } from "@/types";
import { PermissionKey } from "../_types";
import { PERMISSION_CATALOG } from "../_data/seed";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { useMaintenanceStore } from "@/store/maintenance-store";
import { formatDateTime } from "../_services/super-admin-service";
import { isLiveSuperAdminRoute } from "../_services/live-routes";
import { ModuleUnavailable } from "@/components/feedback/ModuleUnavailable";
import { apiClient } from "@/lib/api";


interface SidebarNavItem {
  title: string;
  href: string;
  matchPaths?: string[];
  icon: React.ElementType;
  requiredAny?: PermissionKey[];
  badgeCount?: number;
}

interface SidebarSectionConfig {
  id: string;
  title: string;
  items: SidebarNavItem[];
}

const ROUTE_TITLES: Record<string, { section: string; label: string }> = {
  "/super-admin": { section: "Overview", label: "Dashboard" },
  "/super-admin/dashboard": { section: "Overview", label: "Dashboard" },
  "/super-admin/users": { section: "Overview", label: "User Management" },
  "/super-admin/organizations": { section: "Overview", label: "Organizations" },
  "/super-admin/operators": { section: "Overview", label: "Platform Operators" },
  "/super-admin/roles-permissions": { section: "Overview", label: "Roles & Permissions" },
  "/super-admin/roles": { section: "Overview", label: "Roles & Permissions" },
  "/super-admin/plans": { section: "Billing & Revenue", label: "Plans" },
  "/super-admin/subscriptions": { section: "Billing & Revenue", label: "Subscriptions" },
  "/super-admin/payments": { section: "Billing & Revenue", label: "Billing & Payments" },
  "/super-admin/invoices": { section: "Billing & Revenue", label: "Invoices" },
  "/super-admin/security": { section: "Security & Governance", label: "Security Center" },
  "/super-admin/security-keys": { section: "Security & Governance", label: "Platform Keys & JWT" },
  "/super-admin/access-approvals": { section: "Security & Governance", label: "Support Access Approvals" },
  "/super-admin/incidents": { section: "Security & Governance", label: "Incident Governance" },
  "/super-admin/audit": { section: "Security & Governance", label: "Audit & Compliance" },
  "/super-admin/email-settings": { section: "Communication", label: "SMTP Email" },
  "/super-admin/emails": { section: "Communication", label: "SMTP Email" },
  "/super-admin/email-templates": { section: "Communication", label: "Email Templates" },
  "/super-admin/announcements": { section: "Communication", label: "Announcements" },
  "/super-admin/configuration": { section: "Platform Management", label: "Platform Configuration" },
  "/super-admin/maintenance": { section: "Platform Management", label: "Maintenance Mode" },
  "/super-admin/configuration/maintenance": { section: "Platform Management", label: "Maintenance Mode" },
  "/super-admin/reports": { section: "Platform Management", label: "Reports & Analytics" },
  "/super-admin/settings": { section: "Platform Management", label: "Settings" },
  "/super-admin/support": { section: "Platform Management", label: "Support Oversight" },
  "/super-admin/account": { section: "Super Admin Settings", label: "Account & Security" },
};

interface SuperAdminFeatureItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

const SUPER_ADMIN_FEATURES: SuperAdminFeatureItem[] = [
  {
    label: "Account & Security Settings",
    href: "/super-admin/account",
    icon: UserCog,
  },
  {
    label: "Roles & Permissions Governance",
    href: "/super-admin/roles-permissions",
    icon: ShieldCheck,
  },
  {
    label: "Organizations & Subscriptions",
    href: "/super-admin/organizations",
    icon: Building2,
  },
  {
    label: "Security Policies & Alerts",
    href: "/super-admin/security",
    icon: ShieldAlert,
  },
  {
    label: "Audit Logs & Oversight",
    href: "/super-admin/audit",
    icon: FileText,
  },
  {
    label: "Platform Configuration",
    href: "/super-admin/configuration",
    icon: Settings,
  },
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const { resolvedTheme, setTheme } = useThemeStore();
  const { currentRole, setCurrentRole, logout } = useAuthStore();

  const organizations = useSuperAdminStore((s) => s.organizations);
  const operators = useSuperAdminStore((s) => s.operators);
  const invoices = useSuperAdminStore((s) => s.invoices);
  const payments = useSuperAdminStore((s) => s.payments);
  const emailTemplates = useSuperAdminStore((s) => s.emailTemplates);
  const announcements = useSuperAdminStore((s) => s.announcements);
  const accessApprovals = useSuperAdminStore((s) => s.accessApprovals);
  const incidents = useSuperAdminStore((s) => s.incidents);
  const supportTickets = useSuperAdminStore((s) => s.supportTickets);
  const brandingPrefs = useSuperAdminStore((s) => s.brandingPrefs);
  const [accountProfile, setAccountProfile] = useState<{ name: string; email: string }>({ name: "", email: "" });
  useEffect(() => {
    apiClient
      .me()
      .then((me) => setAccountProfile({ name: me.name || me.email, email: me.email }))
      .catch(() => setAccountProfile({ name: "", email: "" }));
  }, []);
  const activities = useSuperAdminStore((s) => s.activities);
  const roles = useSuperAdminStore((s) => s.roles);
  const activeRoleId = useSuperAdminStore((s) => s.activeRoleId);
  const setActiveRolePreview = useSuperAdminStore((s) => s.setActiveRolePreview);
  const sidebarCollapsed = useSuperAdminStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useSuperAdminStore((s) => s.setSidebarCollapsed);

  const { activeRole, can } = useAdminPermissions();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    useSuperAdminStore.persist.rehydrate();
    const saved = localStorage.getItem("prowise-theme") as "light" | "dark" | "system" | null;
    if (saved) setTheme(saved);
    if (activeRoleId === "role-super-admin" && currentRole !== "SUPER_ADMIN") {
      setCurrentRole("SUPER_ADMIN");
    }
  }, [setTheme, currentRole, setCurrentRole, activeRoleId]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.style.colorScheme = resolvedTheme;
    }
  }, [resolvedTheme]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setMobileOpen(false);
        setSearchOpen(false);
        setNotifOpen(false);
        setRoleMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const overdueInvoicesCount = invoices.filter((i) => i.status === "OVERDUE").length;
  const failedPaymentsCount = payments.filter((p) => p.status === "FAILED").length;
  const pendingApprovalsCount = accessApprovals.filter((a) => a.status === "PENDING").length;
  const openIncidentsCount = incidents.filter((i) => i.status !== "Resolved").length;
  const escalatedSupportCount = supportTickets.filter((t) => t.status === "Escalated").length;
  const publishedAnnouncementsCount = announcements.filter((a) => a.status === "PUBLISHED").length;
  const pendingMaintenanceCount = useMaintenanceStore((s: any) => s.maintenanceWindows?.filter((m: any) => m.status === "PENDING_APPROVAL").length || 0);

  const sections: SidebarSectionConfig[] = useMemo(
    () => [
      {
        id: "overview",
        title: "Overview",
        items: [
          {
            title: "Dashboard",
            href: "/super-admin/dashboard",
            matchPaths: ["/super-admin", "/super-admin/dashboard"],
            icon: LayoutDashboard,
          },
          {
            title: "User Management",
            href: "/super-admin/users",
            icon: UserCheck,
            requiredAny: ["operators.view", "operators.manage"],
          },
          {
            title: "Organizations",
            href: "/super-admin/organizations",
            icon: Building2,
            requiredAny: ["orgs.view"],
          },
          {
            title: "Platform Operators",
            href: "/super-admin/operators",
            icon: Users,
            requiredAny: ["operators.view", "operators.manage"],
          },
          {
            title: "Roles & Permissions",
            href: "/super-admin/roles-permissions",
            matchPaths: ["/super-admin/roles-permissions", "/super-admin/roles"],
            icon: Shield,
            requiredAny: ["roles.manage", "operators.view"],
          },
        ],
      },
      {
        id: "billing",
        title: "Billing & Revenue",
        items: [
          {
            title: "Plans",
            href: "/super-admin/plans",
            icon: Layers,
            requiredAny: ["plans.manage", "subscriptions.manage"],
          },
          {
            title: "Subscriptions",
            href: "/super-admin/subscriptions",
            icon: CreditCard,
            requiredAny: ["subscriptions.manage", "payments.view"],
          },
          {
            title: "Billing & Payments",
            href: "/super-admin/payments",
            icon: Receipt,
            requiredAny: ["payments.view", "payments.refund"],
            badgeCount: failedPaymentsCount > 0 ? failedPaymentsCount : undefined,
          },
          {
            title: "Invoices",
            href: "/super-admin/invoices",
            icon: FileText,
            requiredAny: ["invoices.manage", "payments.view"],
            badgeCount: overdueInvoicesCount > 0 ? overdueInvoicesCount : undefined,
          },
        ],
      },
      {
        id: "security",
        title: "Security & Governance",
        items: [
          {
            title: "Security Center",
            href: "/super-admin/security",
            icon: ShieldCheck,
            requiredAny: ["security.manage", "audit.view"],
          },
          {
            title: "Platform Keys & JWT",
            href: "/super-admin/security-keys",
            matchPaths: ["/super-admin/security-keys", "/super-admin/security/keys"],
            icon: KeyRound,
            requiredAny: ["security.manage", "config.manage"],
          },
          {
            title: "Support Access Approvals",
            href: "/super-admin/access-approvals",
            icon: KeyRound,
            requiredAny: ["security.manage"],
            badgeCount: pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined,
          },
          {
            title: "Incident Governance",
            href: "/super-admin/incidents",
            icon: AlertTriangle,
            requiredAny: ["security.manage", "audit.view"],
            badgeCount: openIncidentsCount > 0 ? openIncidentsCount : undefined,
          },
          {
            title: "Audit & Compliance",
            href: "/super-admin/audit",
            icon: ShieldAlert,
            requiredAny: ["audit.view"],
          },
        ],
      },
      {
        id: "communication",
        title: "Communication",
        items: [
          {
            title: "SMTP Email",
            href: "/super-admin/email-settings",
            matchPaths: ["/super-admin/email-settings", "/super-admin/emails"],
            icon: Send,
            requiredAny: ["smtp.configure"],
          },
          {
            title: "Email Templates",
            href: "/super-admin/email-templates",
            icon: Mail,
            requiredAny: ["templates.manage"],
          },
          {
            title: "Announcements",
            href: "/super-admin/announcements",
            icon: Megaphone,
            requiredAny: ["announcements.manage"],
            badgeCount: publishedAnnouncementsCount > 0 ? publishedAnnouncementsCount : undefined,
          },
        ],
      },
      {
        id: "platform",
        title: "Platform Management",
        items: [
          {
            title: "Platform Configuration",
            href: "/super-admin/configuration",
            icon: Sliders,
            requiredAny: ["config.manage"],
          },
          {
            title: "Maintenance Mode",
            href: "/super-admin/maintenance",
            matchPaths: [
              "/super-admin/maintenance",
              "/super-admin/configuration/maintenance",
              "/super-admin/configuration?tab=maintenance",
            ],
            icon: Wrench,
            requiredAny: ["config.manage"],
            badgeCount: pendingMaintenanceCount > 0 ? pendingMaintenanceCount : undefined,
          },
          {
            title: "Reports & Analytics",
            href: "/super-admin/reports",
            icon: BarChart3,
            requiredAny: ["system.export", "payments.view", "audit.view"],
          },
          {
            title: "Settings",
            href: "/super-admin/settings",
            icon: Settings,
            requiredAny: ["config.manage"],
          },
          {
            title: "Support Oversight",
            href: "/super-admin/support",
            icon: LifeBuoy,
            requiredAny: ["support.manage", "security.manage"],
            badgeCount: escalatedSupportCount > 0 ? escalatedSupportCount : undefined,
          },
        ],
      },
      {
        id: "account",
        title: "Super Admin Settings",
        items: [
          {
            title: "Account & Security",
            href: "/super-admin/account",
            icon: UserCog,
          },
        ],
      },
    ],
    [
      failedPaymentsCount,
      overdueInvoicesCount,
      pendingApprovalsCount,
      openIncidentsCount,
      publishedAnnouncementsCount,
      escalatedSupportCount,
      pendingMaintenanceCount,
    ]
  );

  const visibleSections = useMemo(() => {
    return sections
      .map((section: any) => ({
        ...section,
        items: section.items.filter(
          (item: any) =>
            isLiveSuperAdminRoute(item.href) &&
            (!item.requiredAny || item.requiredAny.some((perm: any) => can(perm)))
        ),
      }))
      .filter((section: any) => section.items.length > 0);
  }, [sections, can]);

  const activeNavItem = useMemo(() => {
    for (const section of visibleSections) {
      for (const item of section.items) {
        const matches = item.matchPaths
          ? item.matchPaths.includes(pathname)
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        if (matches) return item;
      }
    }
    return undefined;
  }, [visibleSections, pathname]);

  const isRouteRestricted = Boolean(
    activeNavItem &&
      "requiredAny" in activeNavItem &&
      activeNavItem.requiredAny &&
      !activeNavItem.requiredAny.some((perm: any) => can(perm))
  );

  const requiredPermissionLabels = useMemo(() => {
    if (!activeNavItem || !("requiredAny" in activeNavItem) || !activeNavItem.requiredAny) return [];
    return activeNavItem.requiredAny.map(
      (k: any) => PERMISSION_CATALOG.find((p: any) => p.key === k)?.label || k
    );
  }, [activeNavItem]);

  const routeMeta = ROUTE_TITLES[pathname] || { section: "Super Admin", label: "Console" };

  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const pages = visibleSections.flatMap((s: any) =>
      s.items.map((item: any) => ({ ...item, sectionTitle: s.title }))
    );

    if (!q) {
      return {
        pages: pages.slice(0, 8),
        orgs: organizations.slice(0, 4),
        operators: operators.slice(0, 3),
        invoices: invoices.slice(0, 3),
        templates: [] as typeof emailTemplates,
      };
    }

    return {
      pages: pages.filter(
        (p: any) => p.title.toLowerCase().includes(q) || p.sectionTitle.toLowerCase().includes(q)
      ),
      orgs: organizations.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          o.slug.toLowerCase().includes(q) ||
          o.ownerEmail.toLowerCase().includes(q)
      ),
      operators: operators.filter(
        (op) => op.name.toLowerCase().includes(q) || op.email.toLowerCase().includes(q)
      ),
      invoices: invoices.filter((inv) => inv.invoiceNumber.toLowerCase().includes(q)),
      templates: emailTemplates.filter(
        (t) => t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
      ),
    };
  }, [searchTerm, visibleSections, organizations, operators, invoices, emailTemplates]);

  const renderSidebarBody = (collapsed: boolean, isMobileDrawer: boolean = false) => (
    <div className="flex h-full flex-col bg-[var(--color-sidebar)] text-[var(--color-text-primary)]">
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-3.5 shrink-0">
        <Link
          href="/super-admin/dashboard"
          className={cn("flex items-center gap-2.5 min-w-0", collapsed && "mx-auto")}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1A73E8] text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight text-[var(--color-text-primary)] truncate">
                  {brandingPrefs.platformName || "ProWise"}
                </span>
                <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300 shrink-0">
                  Admin
                </span>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] truncate">
                Governance Console
              </p>
            </div>
          )}
        </Link>

        {isMobileDrawer && (
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4" aria-label="Super Admin Navigation">
        {visibleSections.map((section: any) => (
          <div key={section.id} className="space-y-0.5">
            {!collapsed ? (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {section.title}
              </p>
            ) : (
              <div className="mx-2 my-1.5 border-t border-[var(--color-border)]" />
            )}

            {section.items.map((item: any) => {
              const Icon = item.icon;
              const isActive = item.matchPaths
                ? item.matchPaths.includes(pathname)
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.title : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors relative",
                    isActive
                      ? "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-semibold"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]",
                    collapsed && "justify-center px-0 py-2"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]"
                    )}
                  />
                  {!collapsed && <span className="truncate flex-1">{item.title}</span>}
                  {!collapsed && item.badgeCount !== undefined && (
                    <span className="ml-auto rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                      {item.badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-[var(--color-border)] p-2.5 shrink-0">
        <button
          type="button"
          onClick={() => setSidebarCollapsed(!collapsed)}
          className="hidden lg:flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <>
              <PanelLeftClose className="w-4 h-4" />
              <span>Collapse sidebar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen w-full flex bg-[var(--color-app-bg)] text-[var(--color-text-primary)] overflow-x-clip">
      {/* Desktop Sticky Sidebar */}
      <aside
        className={cn(
          "hidden lg:block shrink-0 border-r border-[var(--color-border)] sticky top-0 h-screen transition-all duration-200 z-30",
          sidebarCollapsed ? "w-[68px]" : "w-64"
        )}
      >
        {renderSidebarBody(sidebarCollapsed)}
      </aside>

      {/* Mobile / Tablet Slide-over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-[var(--color-border)] shadow-2xl">
            {renderSidebarBody(false, true)}
          </aside>
        </div>
      )}

      {/* Main Content Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Google Workspace-style Top Header */}
        <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md px-3 sm:px-5 lg:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5 text-xs sm:text-sm min-w-0">
              <Link
                href="/super-admin/dashboard"
                className="hidden sm:inline text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors truncate"
              >
                {routeMeta.section}
              </Link>
              <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
              <span className="font-semibold text-[var(--color-text-primary)] truncate">
                {routeMeta.label}
              </span>
            </div>
          </div>

          <div className="hidden md:flex flex-1 max-w-md mx-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-full items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-3 text-xs text-[var(--color-text-muted)] hover:border-blue-500/50 hover:text-[var(--color-text-primary)] transition-colors"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Search pages, organizations, invoices, operators...</span>
              </span>
              <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-mono">
                Ctrl+K
              </kbd>
            </button>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Search Super Admin"
              className="md:hidden rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Static Super Admin Role Indicator */}
            <div className="flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-2.5 h-8 text-xs font-semibold text-blue-700 dark:text-blue-300">
              <Shield className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="hidden sm:inline">Super Administrator</span>
            </div>

            {/* Theme Switcher */}
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle color theme"
              title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
              className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>

            {/* Recent Activity Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o);
                  setRoleMenuOpen(false);
                  setProfileMenuOpen(false);
                }}
                aria-label="View recent activity"
                className="relative rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <Bell className="w-4 h-4" />
                {(overdueInvoicesCount > 0 || failedPaymentsCount > 0 || pendingApprovalsCount > 0) && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[92vw] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-2xl z-50">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
                    <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                      Recent Admin Events
                    </span>
                    <Link
                      href="/super-admin/audit"
                      onClick={() => setNotifOpen(false)}
                      className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View Audit Log
                    </Link>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-[var(--color-border)] mt-1">
                    {activities.slice(0, 6).map((act) => (
                      <div key={act.id} className="py-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[var(--color-text-primary)] truncate">
                            {act.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">
                            {formatDateTime(act.timestamp)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">
                          {act.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile & ProWise Panel Switcher */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((o) => !o);
                  setNotifOpen(false);
                  setRoleMenuOpen(false);
                }}
                aria-label="Open account and panel menu"
                className="flex items-center gap-1.5 rounded-lg p-1 hover:bg-[var(--color-hover)] transition-colors"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A73E8] text-[11px] font-bold text-white uppercase">
                  {(accountProfile.name || "SA").slice(0, 2)}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)] hidden sm:inline" />
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
                  {/* User Profile Header */}
                  <div className="px-3 py-2.5 border-b border-[var(--color-border)]">
                    <div className="flex items-center justify-between gap-1.5">
                      <p className="text-xs font-bold text-[var(--color-text-primary)] truncate">
                        {accountProfile.name}
                      </p>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25 shrink-0">
                        Super Admin
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate mt-0.5 font-mono">
                      {accountProfile.email}
                    </p>
                  </div>

                  {/* Active Platform Console */}
                  <div className="py-2 px-1 border-b border-[var(--color-border)]">
                    <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      Platform Authority
                    </p>
                    <div className="flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold border border-blue-500/25">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Super Admin Platform</span>
                      </div>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Active
                      </span>
                    </div>
                  </div>

                  {/* Super Admin Features Only */}
                  <div className="py-2 px-1 border-b border-[var(--color-border)]">
                    <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                      Super Admin Features
                    </p>
                    <div className="space-y-0.5">
                      {SUPER_ADMIN_FEATURES.filter((feat) => isLiveSuperAdminRoute(feat.href)).map((feat) => {
                        const Icon = feat.icon;
                        const isActive = pathname === feat.href;
                        return (
                          <Link
                            key={feat.href}
                            href={feat.href}
                            onClick={() => setProfileMenuOpen(false)}
                            className={cn(
                              "w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                              isActive
                                ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]"
                            )}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Icon
                                className={cn(
                                  "w-3.5 h-3.5 shrink-0",
                                  isActive
                                    ? "text-blue-600 dark:text-blue-400"
                                    : "text-blue-500"
                                )}
                              />
                              <span className="truncate">{feat.label}</span>
                            </div>
                            {feat.badge && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--color-app-bg)] text-[var(--color-text-muted)] border border-[var(--color-border)] shrink-0">
                                {feat.badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  {/* Utilities & Sign Out */}
                  <div className="pt-1.5 px-1 space-y-0.5">
                    <Link
                      href="/"
                      onClick={() => setProfileMenuOpen(false)}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" />
                      <span>Landing Page</span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setProfileMenuOpen(false);
                        router.push("/login");
                      }}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>



        {/* Fluid Ultrawide-Friendly Workspace Canvas */}
        <main className="flex-1 w-full max-w-[1960px] mx-auto px-3.5 sm:px-6 lg:px-7 py-4 sm:py-6 min-w-0">
          {!isLiveSuperAdminRoute(pathname) ? (
            <ModuleUnavailable
              module={ROUTE_TITLES[pathname]?.label}
              homeHref="/super-admin/dashboard"
              homeLabel="Back to dashboard"
            />
          ) : isRouteRestricted ? (
            <div className="mx-auto max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center space-y-4 mt-8">
              <div className="mx-auto h-12 w-12 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Access Restricted Under {activeRole?.name}
                </h2>
                <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                  Viewing this page requires{" "}
                  <strong>{requiredPermissionLabels.join(" or ")}</strong> access, which is not enabled for your current role preview.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => router.push("/super-admin/dashboard")}
                  className="rounded-lg border border-[var(--color-border)] px-3.5 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]"
                >
                  Back to Dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRolePreview("role-super-admin");
                    toast.success("Restored full Super Administrator access");
                  }}
                  className="rounded-lg bg-[#1A73E8] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#1557B0]"
                >
                  Restore Super Admin Access
                </button>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Global Super Admin Quick Search Modal */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-black/65 backdrop-blur-xs"
            onClick={() => setSearchOpen(false)}
          />
          <div className="relative z-10 w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center border-b border-[var(--color-border)] px-4">
              <Search className="w-4 h-4 text-[var(--color-text-muted)] mr-3 shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Jump to any section, organization, invoice, or operator..."
                className="h-12 w-full bg-transparent text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-lg p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-3 space-y-4 text-xs">
              {searchResults.pages.length > 0 && (
                <div>
                  <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Navigation
                  </p>
                  <div className="space-y-0.5">
                    {searchResults.pages.map((p: any) => {
                      const Icon = p.icon;
                      return (
                        <button
                          key={p.href}
                          type="button"
                          onClick={() => {
                            setSearchOpen(false);
                            router.push(p.href);
                          }}
                          className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-[var(--color-hover)] transition-colors"
                        >
                          <span className="flex items-center gap-2.5 text-[var(--color-text-primary)] font-medium">
                            <Icon className="w-4 h-4 text-blue-500" />
                            {p.title}
                          </span>
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            {p.sectionTitle}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {searchResults.orgs.length > 0 && (
                <div>
                  <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Organizations
                  </p>
                  <div className="space-y-0.5">
                    {searchResults.orgs.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          router.push(`/super-admin/organizations?q=${encodeURIComponent(org.slug)}`);
                        }}
                        className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-[var(--color-hover)] transition-colors"
                      >
                        <span className="font-medium text-[var(--color-text-primary)]">
                          {org.name}{" "}
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            ({org.domain})
                          </span>
                        </span>
                        <span className="text-[11px] text-[var(--color-text-secondary)]">
                          {org.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.invoices.length > 0 && (
                <div>
                  <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Invoices
                  </p>
                  <div className="space-y-0.5">
                    {searchResults.invoices.map((inv) => (
                      <button
                        key={inv.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          router.push(`/super-admin/invoices?q=${encodeURIComponent(inv.invoiceNumber)}`);
                        }}
                        className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-[var(--color-hover)] transition-colors"
                      >
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          {inv.invoiceNumber}
                        </span>
                        <span className="text-[11px] text-[var(--color-text-secondary)]">
                          ${inv.total.toFixed(2)} • {inv.status}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {searchResults.pages.length === 0 &&
                searchResults.orgs.length === 0 &&
                searchResults.operators.length === 0 &&
                searchResults.invoices.length === 0 &&
                searchResults.templates.length === 0 && (
                  <p className="py-8 text-center text-[var(--color-text-muted)]">
                    No matching items found for &ldquo;{searchTerm}&rdquo;.
                  </p>
                )}
            </div>
          </div>
        </div>
      )}

      <Toaster position="bottom-right" theme={resolvedTheme} richColors closeButton />
    </div>
  );
}
