"use client";

import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Search,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  LogOut,
  Building2,
  Shield,
  Check,
  CheckCheck,
  ExternalLink,
} from "lucide-react";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";
import { useThemeStore } from "@/store/theme-store";
import { useProjectStore } from "@/store/project-store";
import { SystemRole } from "@/types";
import { Avatar } from "@/components/ui/avatar";
import { GlobalSearchModal } from "./global-search-modal";
import { SEEDED_ORGS, SEEDED_USERS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface TopNavProps {
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
}

export function TopNav({ title, breadcrumb = [] }: TopNavProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, currentRole, currentOrg, setCurrentOrg, switchRoleAndNavigate, logout } =
    useAuthStore();
  const { theme, setTheme, resolvedTheme } = useThemeStore();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useProjectStore();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isOrgDropdownOpen, setIsOrgDropdownOpen] = useState(false);

  const unreadNotifications = notifications.filter((n) => !n.read);

  const toggleTheme = () => {
    if (resolvedTheme === "light") {
      setTheme("dark");
    } else {
      setTheme("light");
    }
  };

  const roles: { role: SystemRole; label: string }[] = [
    { role: "SUPER_ADMIN", label: "Super Admin" },
    { role: "PLATFORM_OPERATOR", label: "Platform Operator" },
    { role: "ORGANIZATION_OWNER", label: "Org Owner" },
    { role: "ORGANIZATION_ADMIN", label: "Org Admin" },
    { role: "PROJECT_MANAGER", label: "Project Manager" },
    { role: "TEAM_LEAD", label: "Team Lead" },
    { role: "DEVELOPER", label: "Developer" },
    { role: "QA_REVIEWER", label: "QA / Reviewer" },
    { role: "VIEWER", label: "Viewer / Stakeholder" },
  ];

  return (
    <>
      <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between border-b border-app-border bg-app-surface px-4 sm:px-6 shadow-xs select-none">
        {/* Left: Breadcrumbs & Title */}
        <div className="flex flex-col justify-center">
          {breadcrumb.length > 0 && (
            <nav className="flex items-center space-x-1 text-[11px] text-app-text-muted">
              {breadcrumb.map((b, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span>/</span>}
                  {b.href ? (
                    <button
                      onClick={() => router.push(b.href!)}
                      className="hover:text-app-text-primary transition-colors"
                    >
                      {b.label}
                    </button>
                  ) : (
                    <span>{b.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          )}
          <h1 className="text-base font-bold text-app-text-primary leading-tight">
            {title || "Dashboard"}
          </h1>
        </div>

        {/* Center: Global Search Bar trigger */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex w-full items-center justify-between h-9 px-3.5 rounded-lg border border-app-border bg-app-bg text-xs text-app-text-muted hover:border-blue-400 hover:text-app-text-primary transition-all shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-app-text-muted" />
              <span>Search projects, tasks, or members...</span>
            </div>
            <kbd className="hidden lg:inline-block rounded border border-app-border bg-app-surface px-1.5 py-0.5 text-[10px] font-mono text-app-text-muted">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right Action Icons & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mobile search button */}
          <button
            onClick={() => setIsSearchOpen(true)}
            className="md:hidden p-2 rounded-lg text-app-text-secondary hover:bg-app-hover"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary transition-colors"
            title={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
          >
            {resolvedTheme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="relative p-2 rounded-lg text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications.length > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl bg-app-surface border border-app-border shadow-modal p-3 z-50 animate-in fade-in slide-in-from-top-1">
                <div className="flex items-center justify-between pb-2 border-b border-app-border">
                  <span className="text-xs font-bold text-app-text-primary">
                    Notifications ({unreadNotifications.length})
                  </span>
                  {unreadNotifications.length > 0 && (
                    <button
                      onClick={() => markAllNotificationsRead()}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <CheckCheck className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-app-border mt-1">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        markNotificationRead(n.id);
                        setIsNotifOpen(false);
                        router.push(n.targetUrl);
                      }}
                      className={cn(
                        "p-2.5 text-xs hover:bg-app-hover transition-colors cursor-pointer rounded-lg",
                        !n.read ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-app-text-primary truncate">
                          {n.title}
                        </span>
                        {!n.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0"></span>
                        )}
                      </div>
                      <p className="text-app-text-secondary line-clamp-2 mt-0.5">{n.message}</p>
                      <span className="text-[10px] text-app-text-muted mt-1 block">
                        {new Date(n.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="py-6 text-center text-xs text-app-text-muted">
                      No notifications yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Quick Active Role Indicator Badge */}
          <div className="hidden sm:flex items-center">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-app-sidebar border border-app-border text-app-text-primary">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>{roles.find((r) => r.role === currentRole)?.label || currentRole}</span>
            </span>
          </div>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-app-hover transition-colors"
            >
              <Avatar name={currentUser.name} size="sm" />
              <ChevronDown className="w-3.5 h-3.5 text-app-text-muted hidden sm:inline-block" />
            </button>

            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl bg-app-surface border border-app-border shadow-modal p-2 z-50">
                <div className="px-3 py-2 border-b border-app-border">
                  <p className="text-xs font-bold text-app-text-primary truncate">
                    {currentUser.name}
                  </p>
                  <p className="text-[11px] text-app-text-muted truncate">{currentUser.email}</p>
                </div>

                {/* Role Switcher in Profile Menu */}
                <div className="py-2 border-b border-app-border">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
                    Switch Active Panel / Role
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-0.5">
                    {roles.map((r) => (
                      <button
                        key={r.role}
                        onClick={() => {
                          switchRoleAndNavigate(r.role, router.push);
                          setIsProfileOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-lg transition-colors",
                          currentRole === r.role
                            ? "bg-blue-100/70 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold"
                            : "hover:bg-app-hover text-app-text-secondary hover:text-app-text-primary"
                        )}
                      >
                        <span>{r.label}</span>
                        {currentRole === r.role && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Organization Switcher */}
                <div className="py-2 border-b border-app-border">
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-app-text-muted">
                    Switch Organization
                  </div>
                  <div className="space-y-0.5">
                    {SEEDED_ORGS.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => {
                          setCurrentOrg(org);
                          setIsProfileOpen(false);
                          router.push(getRoleDashboardPath(currentRole, org.id));
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left rounded-lg transition-colors",
                          currentOrg.id === org.id
                            ? "bg-blue-100/70 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold"
                            : "hover:bg-app-hover text-app-text-secondary hover:text-app-text-primary"
                        )}
                      >
                        <span className="truncate">{org.name}</span>
                        {currentOrg.id === org.id && <Check className="w-3.5 h-3.5 text-blue-600" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logout */}
                <div className="pt-1">
                  <button
                    onClick={() => {
                      logout();
                      setIsProfileOpen(false);
                      router.push("/login");
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
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

      {/* Global Search Dialog */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}

