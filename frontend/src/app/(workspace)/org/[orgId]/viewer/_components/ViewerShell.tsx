"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  CheckSquare,
  Activity,
  BarChart3,
  Users,
  Calendar,
  FileText,
  Clock,
  Bell,
  Settings,
  Lock,
  Search,
  Menu,
  X,
  Sun,
  Moon,
  ChevronDown,
  Sparkles,
  Shield,
  ExternalLink,
  Check,
  ChevronRight,
  LogOut,
  Layers,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { RolePreviewGlobalBanner } from "@/app/(platform)/super-admin/_components/RolePreviewGlobalBanner";
import { useThemeStore } from "@/store/theme-store";
import { useViewerStore } from "../_store/useViewerStore";
import { ProjectDetailDrawer } from "./ProjectDetailDrawer";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { FilePreviewModal } from "./FilePreviewModal";
import { EventDetailModal } from "./EventDetailModal";
import { ReadOnlyBadge, SimulatedMetricBadge } from "./ViewerPrimitives";
import { getViewerProjects, getViewerTasks, getViewerMembers, getViewerFiles } from "../_services/viewer-service";
import { Toaster, toast } from "sonner";
import { SystemRole } from "@/types";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number | string;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

export function ViewerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const rawOrgId = params?.orgId as string;
  const orgId = !rawOrgId || rawOrgId === "viewer" ? "org-acme" : rawOrgId;

  const { currentUser, currentRole, currentOrg, switchRoleAndNavigate, logout } = useAuthStore();
  const { theme, resolvedTheme, toggleTheme, setTheme } = useThemeStore();
  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    selectedProject,
    setSelectedProject,
    selectedTask,
    setSelectedTask,
    selectedFile,
    setSelectedFile,
    selectedEvent,
    setSelectedEvent,
    isSearchModalOpen,
    setIsSearchModalOpen,
  } = useViewerStore();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationPopoverOpen, setIsNotificationPopoverOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isRoleSwitcherOpen, setIsRoleSwitcherOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const notificationPopoverRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    // Theme initialization
    const savedTheme = localStorage.getItem("prowise-theme") as "light" | "dark" | "system" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, [setTheme]);

  // Outside click listener for notification popover & profile dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        notificationPopoverRef.current &&
        !notificationPopoverRef.current.contains(e.target as Node)
      ) {
        setIsNotificationPopoverOpen(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setIsProfileMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchModalOpen(true);
      }
      if (e.key === "Escape") {
        setIsSearchModalOpen(false);
        setIsNotificationPopoverOpen(false);
        setIsProfileMenuOpen(false);
        setIsRoleSwitcherOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setIsSearchModalOpen]);

  // Navigation Items according to 10 features
  const navigationSections: NavSection[] = useMemo(() => [
    {
      title: "Core Workspaces",
      items: [
        { title: "Dashboard", href: `/org/${orgId}/viewer/dashboard`, icon: LayoutDashboard },
        { title: "Projects Portfolio", href: `/org/${orgId}/viewer/projects`, icon: FolderGit2 },
        { title: "Tasks & Work", href: `/org/${orgId}/viewer/tasks`, icon: CheckSquare },
      ],
    },
    {
      title: "Delivery & Governance",
      items: [
        { title: "Progress Summaries", href: `/org/${orgId}/viewer/progress`, icon: Activity },
        { title: "Authorized Reports", href: `/org/${orgId}/viewer/reports`, icon: BarChart3 },
        { title: "Calendar & Milestones", href: `/org/${orgId}/viewer/calendar`, icon: Calendar },
      ],
    },
    {
      title: "Collaboration & Evidence",
      items: [
        { title: "Team Directory", href: `/org/${orgId}/viewer/team`, icon: Users },
        { title: "Files & Evidence", href: `/org/${orgId}/viewer/files`, icon: FileText },
        { title: "Activity Timeline", href: `/org/${orgId}/viewer/activity`, icon: Clock },
      ],
    },
    {
      title: "Personal",
      items: [
        {
          title: "Notifications",
          href: `/org/${orgId}/viewer/notifications`,
          icon: Bell,
          badge: unreadCount > 0 ? unreadCount : undefined,
        },
        { title: "Settings", href: `/org/${orgId}/viewer/settings`, icon: Settings },
      ],
    },
  ], [orgId, unreadCount]);

  // Search Results for Global Search Modal
  const searchResults = useMemo(() => {
    if (!searchFilter.trim()) return { projects: [], tasks: [], members: [], files: [] };
    const q = searchFilter.toLowerCase();
    const projects = getViewerProjects(orgId).filter(
      (p) => p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
    );
    const tasks = getViewerTasks(orgId, undefined, undefined, undefined, q);
    const members = getViewerMembers(orgId, q);
    const files = getViewerFiles(orgId).filter(
      (f) => f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)
    );
    return { projects, tasks, members, files };
  }, [orgId, searchFilter]);

  // Roles available for testing
  const allRoles: { role: SystemRole; label: string; path: string }[] = [
    { role: "SUPER_ADMIN", label: "Super Admin", path: "/super-admin" },
    { role: "PLATFORM_OPERATOR", label: "Platform Operator", path: "/platform-operator" },
    { role: "ORGANIZATION_OWNER", label: "Org Owner", path: `/org/${orgId}/owner` },
    { role: "ORGANIZATION_ADMIN", label: "Org Admin", path: `/org/${orgId}/admin` },
    { role: "PROJECT_MANAGER", label: "Project Manager", path: `/org/${orgId}/manager` },
    { role: "TEAM_LEAD", label: "Team Lead", path: `/org/${orgId}/lead` },
    { role: "DEVELOPER", label: "Developer", path: `/org/${orgId}/developer` },
    { role: "QA_REVIEWER", label: "QA / Reviewer", path: `/org/${orgId}/reviewer` },
    { role: "VIEWER", label: "Viewer (Read-Only)", path: `/org/${orgId}/viewer/dashboard` },
  ];

  const currentPathLabel = useMemo(() => {
    for (const section of navigationSections) {
      for (const item of section.items) {
        if (pathname === item.href || (item.href !== `/org/${orgId}/viewer` && pathname.startsWith(item.href))) {
          return item.title;
        }
      }
    }
    return "Dashboard";
  }, [pathname, navigationSections, orgId]);

  return (
    <div className="min-h-screen w-full flex bg-app-bg text-app-text-primary antialiased">
      {/* 1. Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-app-border bg-app-sidebar transition-all duration-200 shrink-0 sticky top-0 h-screen z-30",
          isSidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-app-border">
          {!isSidebarCollapsed ? (
            <Link href={`/org/${orgId}/viewer/dashboard`} className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                P
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-bold text-app-text-primary tracking-tight">ProWise</span>
                  <span className="rounded bg-blue-100 dark:bg-blue-950 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 dark:text-blue-300">
                    VIEWER
                  </span>
                </div>
                <div className="text-[10px] text-app-text-muted font-medium">Read-Only Governance</div>
              </div>
            </Link>
          ) : (
            <div className="mx-auto h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              P
            </div>
          )}

          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary transition-colors ml-auto"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {/* Organization Scoping Card */}
        {!isSidebarCollapsed && (
          <div className="p-3 border-b border-app-border">
            <div className="rounded-xl bg-app-surface border border-app-border p-2.5 shadow-2xs">
              <div className="text-[10px] uppercase font-bold text-app-text-muted tracking-wider">
                Active Organization
              </div>
              <div className="text-xs font-semibold text-app-text-primary truncate mt-0.5">
                {currentOrg.name || "Acme Health Technologies"}
              </div>
              <div className="text-[10px] text-app-text-secondary flex items-center gap-1 mt-0.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span>{currentOrg.timezone || "America/New_York"} • Read-Only</span>
              </div>
            </div>
          </div>
        )}

        {/* Nav Links */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {navigationSections.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {!isSidebarCollapsed && section.title && (
                <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== `/org/${orgId}/viewer` &&
                    item.href !== `/org/${orgId}/viewer/dashboard` &&
                    pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors relative",
                      isActive
                        ? "bg-blue-100/70 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold"
                        : "text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary",
                      isSidebarCollapsed && "justify-center px-0"
                    )}
                    title={isSidebarCollapsed ? item.title : undefined}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 shrink-0",
                        isActive ? "text-blue-600 dark:text-blue-400" : "text-app-text-muted"
                      )}
                    />
                    {!isSidebarCollapsed && <span className="truncate flex-1">{item.title}</span>}
                    {!isSidebarCollapsed && item.badge !== undefined && (
                      <span className="ml-auto rounded-full bg-blue-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        {!isSidebarCollapsed && (
          <div className="p-3 border-t border-app-border text-[11px] text-app-text-muted flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Lock className="w-3 h-3 text-slate-400" />
              <span>Viewer Role</span>
            </span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">Scoped</span>
          </div>
        )}
      </aside>

      {/* 2. Mobile Drawer Navigation (<768px) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-900/60 backdrop-blur-xs flex">
          <div className="w-72 bg-app-sidebar border-r border-app-border h-full flex flex-col p-4 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  P
                </div>
                <span className="font-bold text-sm text-app-text-primary">ProWise Viewer</span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-app-text-muted hover:text-app-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4">
              {navigationSections.map((section, idx) => (
                <div key={idx} className="space-y-1">
                  {section.title && (
                    <div className="px-2 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
                      {section.title}
                    </div>
                  )}
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium",
                          isActive
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-semibold"
                            : "text-app-text-secondary hover:bg-app-hover"
                        )}
                      >
                        <Icon className="w-4 h-4 text-blue-500" />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      {/* 3. Main Content Container */}
      <div className="flex flex-1 flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-app-border bg-app-surface/95 backdrop-blur-md px-4 sm:px-6 shadow-2xs">
          {/* Mobile hamburger + Breadcrumb */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-app-text-secondary hover:bg-app-hover"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <nav className="flex items-center space-x-1 text-[11px] text-app-text-muted">
                <span>{currentOrg.name || "Acme Health Technologies"}</span>
                <span>/</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">Viewer</span>
                <span>/</span>
                <span className="text-app-text-primary">{currentPathLabel}</span>
              </nav>
              <h1 className="text-base font-bold text-app-text-primary leading-tight mt-0.5">
                {currentPathLabel}
              </h1>
            </div>
          </div>

          {/* Center Search bar button */}
          <div className="hidden lg:block max-w-sm w-full mx-4">
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="flex w-full items-center justify-between h-9 px-3 rounded-xl border border-app-border bg-app-bg text-xs text-app-text-muted hover:border-blue-400 hover:text-app-text-primary transition-all shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-app-text-muted" />
                <span>Search projects, tasks, files...</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-app-surface border border-app-border text-app-text-muted font-mono">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Scoped pill */}
            <div className="hidden sm:flex">
              <SimulatedMetricBadge />
            </div>

            {/* Global Search trigger for smaller screens */}
            <button
              onClick={() => setIsSearchModalOpen(true)}
              className="lg:hidden p-2 rounded-lg text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary transition-colors"
              title="Search (⌘K)"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary transition-colors"
              title={resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Notification Bell with Dropdown Popover */}
            <div className="relative" ref={notificationPopoverRef}>
              <button
                onClick={() => setIsNotificationPopoverOpen(!isNotificationPopoverOpen)}
                className="p-2 rounded-lg text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary transition-colors relative cursor-pointer"
                title="Notifications"
                aria-label="Open notifications menu"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-app-surface" />
                )}
              </button>

              {isNotificationPopoverOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-app-border bg-app-surface shadow-xl z-50 p-4 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-app-border">
                    <span className="font-bold text-xs text-app-text-primary">
                      Notifications ({unreadCount} unread)
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => {
                          markAllNotificationsAsRead();
                          toast.success("All notifications marked as read");
                        }}
                        className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold hover:underline cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="py-2 max-h-72 overflow-y-auto space-y-2">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-xs text-[var(--color-text-muted,#80868B)]">
                        No notifications to display.
                      </div>
                    ) : (
                      notifications.slice(0, 5).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => {
                            markNotificationAsRead(n.id);
                            toast.info(`Opened: ${n.title}`);
                            if (n.link) router.push(n.link);
                            setIsNotificationPopoverOpen(false);
                          }}
                          className={cn(
                            "p-2.5 rounded-lg text-xs cursor-pointer transition-colors border",
                            n.read
                              ? "border-transparent hover:bg-app-hover text-app-text-secondary"
                              : "border-blue-100 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-950/30 text-app-text-primary font-medium"
                          )}
                        >
                          <div className="flex items-center justify-between text-[10px] text-app-text-muted mb-0.5">
                            <span className="font-semibold text-blue-600 dark:text-blue-400">{n.category}</span>
                            <span>{n.timestamp ? n.timestamp.split("T")[0] : ""}</span>
                          </div>
                          <div className="font-semibold text-[var(--color-text-primary,#202124)]">{n.title}</div>
                          <div className="text-[11px] text-app-text-secondary line-clamp-2 mt-0.5">
                            {n.message}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="pt-2 border-t border-app-border text-center">
                    <Link
                      href={`/org/${orgId}/viewer/notifications`}
                      onClick={() => setIsNotificationPopoverOpen(false)}
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View all notifications →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar & Menu */}
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 p-1 pl-2 rounded-xl border border-app-border bg-app-bg hover:bg-app-hover transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  JL
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-bold text-app-text-primary leading-none">Jordan Lee</div>
                  <div className="text-[10px] text-app-text-muted leading-tight mt-0.5">Viewer</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-app-text-muted mr-1" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-app-border bg-app-surface shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150 text-xs">
                  <div className="p-3 border-b border-app-border">
                    <div className="font-bold text-app-text-primary">Jordan Lee</div>
                    <div className="text-app-text-muted text-[11px]">jordan.lee@acmehealth.com</div>
                    <div className="mt-2">
                      <ReadOnlyBadge />
                    </div>
                  </div>

                  <div className="py-1">
                    <Link
                      href={`/org/${orgId}/viewer/settings`}
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-app-hover text-app-text-secondary hover:text-app-text-primary"
                    >
                      <Settings className="w-4 h-4 text-app-text-muted" />
                      <span>My Profile Preferences</span>
                    </Link>

                    {/* Quick Role Switcher for Verification */}
                    <button
                      onClick={() => {
                        setIsRoleSwitcherOpen(true);
                        setIsProfileMenuOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 rounded-lg hover:bg-app-hover text-app-text-secondary hover:text-app-text-primary"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        <span>Switch Role Preview</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-app-text-muted" />
                    </button>
                  </div>

                  <div className="pt-1 border-t border-app-border">
                    <button
                      onClick={() => logout()}
                      className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <RolePreviewGlobalBanner />

        {/* Read-Only Stakeholder Governance Banner */}
        <div className="bg-slate-900 text-slate-100 px-4 sm:px-6 py-2 text-xs border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded text-[10px] tracking-wide uppercase">
              <Lock className="w-3 h-3" />
              <span>Read-Only Governance</span>
            </span>
            <span className="text-slate-300">
              Viewing authorized organization &amp; project health for <strong>{currentOrg.name}</strong>. Mutations and administrative actions are strictly restricted.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsRoleSwitcherOpen(true)}
              className="text-[11px] text-blue-400 hover:text-blue-300 font-medium underline"
            >
              Test Other Roles
            </button>
          </div>
        </div>

        {/* Scrollable Main Area - Ultrawide & Super Admin Aligned */}
        <main className="flex-1 w-full max-w-[1960px] mx-auto px-3.5 sm:px-6 lg:px-7 py-4 sm:py-6 min-w-0">
          {children}
        </main>
      </div>

      {/* 4. Global Search Modal (⌘K) */}
      {isSearchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 pt-16 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-app-surface border border-app-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-app-border flex items-center gap-3">
              <Search className="w-5 h-5 text-app-text-muted" />
              <input
                type="text"
                autoFocus
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search projects, tasks, team members, files..."
                className="flex-1 bg-transparent text-sm text-app-text-primary placeholder:text-app-text-muted focus:outline-hidden"
              />
              <button
                onClick={() => setIsSearchModalOpen(false)}
                className="p-1 rounded-lg text-app-text-muted hover:text-app-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-4 text-xs">
              {!searchFilter.trim() ? (
                <div className="text-center py-8 text-app-text-muted">
                  Type project keys (CRM-100, SOLO-10), task titles, team members, or files to search.
                </div>
              ) : (
                <>
                  {/* Projects matches */}
                  {searchResults.projects.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-app-text-muted mb-1.5">
                        Projects ({searchResults.projects.length})
                      </div>
                      <div className="space-y-1">
                        {searchResults.projects.map((p) => (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedProject(p);
                              setIsSearchModalOpen(false);
                            }}
                            className="p-2.5 rounded-lg hover:bg-app-hover cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-600">{p.key}</span>
                              <span className="font-semibold text-app-text-primary">{p.name}</span>
                            </div>
                            <span className="text-app-text-muted">{p.lastProgressPercent}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tasks matches */}
                  {searchResults.tasks.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-app-text-muted mb-1.5">
                        Tasks &amp; Work Items ({searchResults.tasks.length})
                      </div>
                      <div className="space-y-1">
                        {searchResults.tasks.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => {
                              setSelectedTask(t);
                              setIsSearchModalOpen(false);
                            }}
                            className="p-2.5 rounded-lg hover:bg-app-hover cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-blue-600">{t.key}</span>
                              <span className="text-app-text-primary">{t.title}</span>
                            </div>
                            <span className="text-[11px] text-app-text-muted">{t.state}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Members matches */}
                  {searchResults.members.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-app-text-muted mb-1.5">
                        Team Members ({searchResults.members.length})
                      </div>
                      <div className="space-y-1">
                        {searchResults.members.map((m) => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setIsSearchModalOpen(false);
                              router.push(`/org/${orgId}/viewer/team`);
                            }}
                            className="p-2.5 rounded-lg hover:bg-app-hover cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <div className="font-semibold text-app-text-primary">{m.name}</div>
                              <div className="text-[10px] text-app-text-muted">{m.email}</div>
                            </div>
                            <span className="text-app-text-muted">{m.roleLabel}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Files matches */}
                  {searchResults.files.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-app-text-muted mb-1.5">
                        Files &amp; Documents ({searchResults.files.length})
                      </div>
                      <div className="space-y-1">
                        {searchResults.files.map((f) => (
                          <div
                            key={f.id}
                            onClick={() => {
                              setSelectedFile(f);
                              setIsSearchModalOpen(false);
                            }}
                            className="p-2.5 rounded-lg hover:bg-app-hover cursor-pointer flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-blue-500" />
                              <span className="font-mono text-app-text-primary">{f.name}</span>
                            </div>
                            <span className="text-[11px] text-app-text-muted">{f.size}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Role Switcher Modal for test navigation */}
      {isRoleSwitcherOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-app-surface border border-app-border rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-app-border">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-sm text-app-text-primary">Role Dashboard Preview</h3>
              </div>
              <button
                onClick={() => setIsRoleSwitcherOpen(false)}
                className="p-1 rounded-lg text-app-text-muted hover:text-app-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-app-text-secondary">
              Preview sample dashboards for each role. Real API data and actions remain protected by your account permissions.
            </p>

            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {allRoles.map((r) => (
                <button
                  key={r.role}
                  onClick={() => {
                    switchRoleAndNavigate(r.role, (p) => router.push(p));
                    setIsRoleSwitcherOpen(false);
                    toast.info(`Switched role to ${r.label}`);
                  }}
                  aria-current={r.role === currentRole ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center justify-between p-2.5 rounded-lg text-xs font-medium transition-colors border",
                    r.role === currentRole
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold"
                      : "border-transparent hover:bg-app-hover text-app-text-secondary"
                  )}
                >
                  <span>{r.label}</span>
                  {r.role === currentRole && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawers & Modals */}
      <ProjectDetailDrawer project={selectedProject} onClose={() => setSelectedProject(null)} />
      <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />
      <FilePreviewModal file={selectedFile} onClose={() => setSelectedFile(null)} />
      <EventDetailModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />

      {/* Notification Toaster */}
      <Toaster position="bottom-right" theme={resolvedTheme} richColors closeButton />
    </div>
  );
}
