"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import {
  LayoutDashboard,
  FolderGit2,
  Activity,
  Menu,
  X,
  Lock,
  Sun,
  Moon,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useThemeStore } from "@/store/theme-store";
import { ReadOnlyBadge } from "./ViewerPrimitives";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

/**
 * Viewer navigation lists only modules backed by a live API. Modules without one (tasks, reports, calendar,
 * team, files, activity, notifications, milestones, delivery status, settings) are hidden until they ship.
 */
export function viewerNavigation(orgId: string): NavItem[] {
  return [
    { title: "Dashboard", href: `/org/${orgId}/viewer/dashboard`, icon: LayoutDashboard },
    { title: "Projects Portfolio", href: `/org/${orgId}/viewer/projects`, icon: FolderGit2 },
    { title: "Progress Summaries", href: `/org/${orgId}/viewer/progress`, icon: Activity },
    { title: "Approvals", href: `/org/${orgId}/viewer/approvals`, icon: Lock },
  ];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ViewerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const orgId = (params?.orgId as string) || "";

  const { currentUser, currentOrg, logout } = useAuthStore();
  const { resolvedTheme, toggleTheme } = useThemeStore();

  const displayName = currentUser.name || currentUser.email;
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const navigation = useMemo(() => viewerNavigation(orgId), [orgId]);

  const isActive = (href: string) =>
    pathname === href ||
    (href === `/org/${orgId}/viewer/dashboard` && pathname === `/org/${orgId}/viewer`) ||
    (href !== `/org/${orgId}/viewer/dashboard` && pathname.startsWith(`${href}/`));

  const currentLabel = navigation.find((item) => isActive(item.href))?.title ?? "Viewer";

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setIsProfileMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProfileMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await apiClient.signout();
    } catch {
      // The local session is cleared either way.
    }
    logout();
    setIsProfileMenuOpen(false);
    router.push("/login");
  };

  const navLinks = (onNavigate?: () => void) =>
    navigation.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors",
            active
              ? "bg-blue-100/70 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold"
              : "text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary",
            isSidebarCollapsed && !onNavigate && "justify-center px-0",
          )}
          title={isSidebarCollapsed ? item.title : undefined}
        >
          <Icon className={cn("w-4 h-4 shrink-0", active ? "text-blue-600 dark:text-blue-400" : "text-app-text-muted")} />
          {(!isSidebarCollapsed || onNavigate) && <span className="truncate flex-1">{item.title}</span>}
        </Link>
      );
    });

  return (
    <div className="min-h-screen w-full flex bg-app-bg text-app-text-primary antialiased">
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-app-border bg-app-sidebar transition-all duration-200 shrink-0 sticky top-0 h-screen z-30",
          isSidebarCollapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-app-border">
          {!isSidebarCollapsed && (
            <Link href={`/org/${orgId}/viewer/dashboard`} className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
                P
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-app-text-primary tracking-tight">ProWise</span>
                <span className="rounded bg-blue-100 dark:bg-blue-950 px-1.5 text-[9px] font-bold text-blue-700 dark:text-blue-300">
                  VIEWER
                </span>
              </div>
            </Link>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 rounded-lg text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary transition-colors ml-auto"
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>

        {!isSidebarCollapsed && currentOrg.name && (
          <div className="p-3 border-b border-app-border">
            <div className="rounded-xl bg-app-surface border border-app-border p-2.5">
              <div className="text-[10px] uppercase font-bold text-app-text-muted tracking-wider">Active Organization</div>
              <div className="text-xs font-semibold text-app-text-primary truncate mt-0.5">{currentOrg.name}</div>
              <div className="text-[10px] text-app-text-secondary mt-0.5">{currentOrg.timezone} • Read-Only</div>
            </div>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">{navLinks()}</nav>

        {!isSidebarCollapsed && (
          <div className="p-3 border-t border-app-border text-[11px] text-app-text-muted flex items-center gap-1">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>Viewer Role</span>
          </div>
        )}
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-900/60 flex">
          <div className="w-72 bg-app-sidebar border-r border-app-border h-full flex flex-col p-4">
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <span className="font-bold text-sm text-app-text-primary">ProWise Viewer</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1 rounded-lg text-app-text-muted hover:text-app-text-primary"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto py-3 space-y-1">{navLinks(() => setIsMobileMenuOpen(false))}</nav>
          </div>
          <div className="flex-1" onClick={() => setIsMobileMenuOpen(false)} />
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0 min-h-screen">
        <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-app-border bg-app-surface/95 backdrop-blur-md px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-app-text-secondary hover:bg-app-hover"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <nav className="flex items-center space-x-1 text-[11px] text-app-text-muted">
                {currentOrg.name && (
                  <>
                    <span>{currentOrg.name}</span>
                    <span>/</span>
                  </>
                )}
                <span className="font-semibold text-blue-600 dark:text-blue-400">Viewer</span>
              </nav>
              <h1 className="text-base font-bold text-app-text-primary leading-tight mt-0.5">{currentLabel}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary transition-colors"
              title={resolvedTheme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {resolvedTheme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 rounded-xl p-1 hover:bg-app-hover transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                  {initials(displayName)}
                </div>
                <div className="hidden sm:block text-left text-xs">
                  <div className="font-bold text-app-text-primary leading-none max-w-[120px] truncate">{displayName}</div>
                  <div className="text-[10px] text-app-text-muted leading-tight mt-0.5">Viewer</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-app-text-muted mr-1" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl border border-app-border bg-app-surface shadow-xl z-50 p-2 text-xs">
                  <div className="p-3 border-b border-app-border">
                    <div className="font-bold text-app-text-primary truncate">{currentUser.name}</div>
                    <div className="text-app-text-muted text-[11px] truncate">{currentUser.email}</div>
                    <div className="mt-2">
                      <ReadOnlyBadge />
                    </div>
                  </div>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
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

        <main className="flex-1 w-full max-w-[1960px] mx-auto px-3.5 sm:px-6 lg:px-7 py-4 sm:py-6 min-w-0">{children}</main>
      </div>

      <Toaster position="bottom-right" theme={resolvedTheme} richColors closeButton />
    </div>
  );
}
