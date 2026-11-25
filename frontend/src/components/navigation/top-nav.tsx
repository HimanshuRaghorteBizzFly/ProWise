"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search, Menu, Sun, Moon, ChevronDown, ChevronRight, LogOut, Shield, Check, Settings, GitBranch, KeyRound } from "lucide-react";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";
import { useThemeStore } from "@/store/theme-store";
import { SystemRole } from "@/types";
import { Avatar } from "@/components/ui/avatar";
import { GlobalSearchModal } from "./global-search-modal";
import { cn } from "@/lib/utils";
import { apiClient } from "@/lib/api";
import { switchWorkspace } from "@/lib/workspace-switch";

interface TopNavProps {
  title?: string;
  breadcrumb?: { label: string; href?: string }[];
  onOpenNavigation?: () => void;
  navigationOpen?: boolean;
  navigationButtonRef?: React.RefObject<HTMLButtonElement>;
}

type OpenMenu = "profile" | null;

const ICON_BUTTON =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-app-text-secondary transition-colors hover:bg-app-hover hover:text-app-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent motion-reduce:transition-none";
const MENU_SECTION_TITLE = "px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted";
const MENU_ITEM =
  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent motion-reduce:transition-none";
const MENU_ITEM_ACTIVE = "bg-blue-500/15 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300";
const MENU_ITEM_IDLE = "text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary";

const ROLES: { role: SystemRole; label: string }[] = [
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

export function TopNav({
  title,
  breadcrumb = [],
  onOpenNavigation,
  navigationOpen = false,
  navigationButtonRef,
}: TopNavProps) {
  const router = useRouter();

  // Once, right after the first sign-in with an invitation's temporary password (flag set by the login page).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("prowise_temporary_password_reminder") !== "1") return;
    sessionStorage.removeItem("prowise_temporary_password_reminder");
    toast.info("You signed in with a temporary password.", {
      description: "Choose your own password now, or later from the account menu → Change password.",
      duration: 12000,
      action: { label: "Change now", onClick: () => router.push("/change-password") },
    });
  }, [router]);
  const { currentUser, currentRole, currentOrg, logout, organizations, isAuthenticated } = useAuthStore();
  // Only the signed-in person's own memberships (from /v1/me) can be switched to.
  const switchableOrgs = isAuthenticated ? organizations : [];
  const { setTheme, resolvedTheme } = useThemeStore();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const toggleMenu = (menu: Exclude<OpenMenu, null>) => setOpenMenu((current) => (current === menu ? null : menu));

  // Escape and outside clicks close the open menu.
  useEffect(() => {
    if (!openMenu) return;
    const activeRef = profileRef;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        activeRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!activeRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openMenu]);

  const toggleTheme = () => setTheme(resolvedTheme === "light" ? "dark" : "light");
  const roleLabel = ROLES.find((r) => r.role === currentRole)?.label || currentRole;

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-app-border bg-app-surface px-3 sm:px-5 lg:px-6">
        {/* Left: menu + breadcrumb/title */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {onOpenNavigation && (
            <button
              ref={navigationButtonRef}
              type="button"
              onClick={onOpenNavigation}
              aria-label="Open primary navigation"
              aria-controls="primary-navigation"
              aria-expanded={navigationOpen}
              className={cn(ICON_BUTTON, "lg:hidden")}
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <div className="flex min-w-0 items-center gap-1.5 text-xs sm:text-sm">
            {breadcrumb.length > 0 && (
              <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 sm:flex">
                {breadcrumb.map((b, idx) => (
                  <React.Fragment key={`${b.label}-${idx}`}>
                    {b.href ? (
                      <button
                        type="button"
                        onClick={() => router.push(b.href!)}
                        className="truncate rounded text-app-text-muted transition-colors hover:text-app-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
                      >
                        {b.label}
                      </button>
                    ) : (
                      <span className="max-w-[160px] truncate text-app-text-muted">{b.label}</span>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-app-text-muted" aria-hidden="true" />
                  </React.Fragment>
                ))}
              </nav>
            )}
            <h1 className="truncate font-semibold text-app-text-primary">{title || "Dashboard"}</h1>
          </div>
        </div>

        {/* Center: search trigger */}
        <div className="mx-2 hidden max-w-md flex-1 lg:flex">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex h-9 w-full items-center justify-between rounded-lg border border-app-border bg-app-bg px-3 text-xs text-app-text-muted transition-colors hover:border-blue-500/50 hover:text-app-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent motion-reduce:transition-none"
          >
            <span className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">Search projects, tasks, or members...</span>
            </span>
            <kbd className="hidden rounded border border-app-border bg-app-surface px-1.5 py-0.5 font-mono text-[10px] lg:inline-block">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Right: actions */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button type="button" onClick={() => setIsSearchOpen(true)} aria-label="Search" className={cn(ICON_BUTTON, "lg:hidden")}>
            <Search className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${resolvedTheme === "light" ? "dark" : "light"} mode`}
            className={ICON_BUTTON}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="h-4 w-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {/* Active panel indicator */}
          <span className="hidden h-8 items-center gap-1.5 rounded-lg border border-app-border bg-app-bg px-2.5 text-xs font-medium text-app-text-primary sm:inline-flex">
            <Shield className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true" />
            <span className="max-w-[140px] truncate">{roleLabel}</span>
          </span>

          {/* Profile */}
          <div ref={profileRef} className="relative">
            <button
              type="button"
              onClick={() => toggleMenu("profile")}
              aria-label={`Account menu for ${currentUser.name || "current user"}`}
              aria-haspopup="true"
              aria-expanded={openMenu === "profile"}
              className="flex items-center gap-1.5 rounded-lg p-1 transition-colors hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent motion-reduce:transition-none"
            >
              <Avatar name={currentUser.name} size="sm" />
              <ChevronDown className="hidden h-3.5 w-3.5 text-app-text-muted sm:inline-block" aria-hidden="true" />
            </button>

            {openMenu === "profile" && (
              <div className="absolute right-0 z-50 mt-2 w-64 max-w-[92vw] rounded-xl border border-app-border bg-app-surface p-2 shadow-2xl">
                <div className="border-b border-app-border px-2.5 py-2">
                  <div className="flex items-center justify-between gap-1">
                    <p className="truncate text-xs font-bold text-app-text-primary">{currentUser.name}</p>
                    <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                      {roleLabel}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-app-text-muted mt-0.5">{currentUser.email}</p>
                </div>

                <div className="border-b border-app-border py-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      if (currentRole === "DEVELOPER") {
                        router.push(`/org/${currentOrg.id}/developer/settings`);
                      } else {
                        router.push(getRoleDashboardPath(currentRole, currentOrg.id));
                      }
                    }}
                    className={cn(MENU_ITEM, MENU_ITEM_IDLE, "justify-start gap-2")}
                  >
                    <Settings className="h-3.5 w-3.5 text-app-text-muted" aria-hidden="true" />
                    <span>Settings &amp; Preferences</span>
                  </button>

                  {/* Every role: change the password (e.g. the temporary one from an invitation email). */}
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      router.push("/change-password");
                    }}
                    className={cn(MENU_ITEM, MENU_ITEM_IDLE, "justify-start gap-2")}
                  >
                    <KeyRound className="h-3.5 w-3.5 text-app-text-muted" aria-hidden="true" />
                    <span>Change password</span>
                  </button>

                  {currentRole === "DEVELOPER" && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenu(null);
                        router.push(`/org/${currentOrg.id}/developer/github`);
                      }}
                      className={cn(MENU_ITEM, MENU_ITEM_IDLE, "justify-start gap-2")}
                    >
                      <GitBranch className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
                      <span>GitHub Repositories</span>
                    </button>
                  )}
                </div>

                {switchableOrgs.length > 0 && (
                <div className="border-b border-app-border py-2">
                  <p className={MENU_SECTION_TITLE}>Switch organization</p>
                  <div className="space-y-0.5">
                    {switchableOrgs.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={async () => {
                          setOpenMenu(null);
                          // Real session: a token bound to that organization and the role held there (server).
                          const result = await switchWorkspace(org.id);
                          if (!result.ok) return;
                          router.push(result.targetDashboardUrl || getRoleDashboardPath(currentRole, org.id));
                        }}
                        aria-current={currentOrg.id === org.id ? "true" : undefined}
                        className={cn(MENU_ITEM, currentOrg.id === org.id ? MENU_ITEM_ACTIVE : MENU_ITEM_IDLE)}
                      >
                        <span className="truncate">{org.name}</span>
                        {currentOrg.id === org.id && <Check className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />}
                      </button>
                    ))}
                  </div>
                </div>
                )}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenu(null);
                      router.push("/account/sessions");
                    }}
                    className={cn(MENU_ITEM, MENU_ITEM_IDLE, "justify-start gap-2")}
                  >
                    <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>My sessions</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setOpenMenu(null);
                      // Revoke the session on the server too; local state alone would leave the refresh token usable.
                      try {
                        await apiClient.signout();
                      } catch {
                        /* already signed out or offline: clearing local state below is enough */
                      }
                      logout();
                      router.push("/login");
                    }}
                    className={cn(MENU_ITEM, "justify-start font-medium text-rose-600 hover:bg-rose-500/10 dark:text-rose-400")}
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Sign out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
