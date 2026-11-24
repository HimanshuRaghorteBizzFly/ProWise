"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { ChevronRight, Crown, LogOut, Menu, Moon, PanelLeftClose, PanelLeftOpen, ShieldHalf, Sun, X } from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/theme-store";
import { useAuthStore } from "@/store/auth-store";
<<<<<<< HEAD
import { useOrgConsoleStore } from "@/store/org-console-store";
import { ORG_VIEWERS } from "@/mocks/org-console";
import { apiClient } from "@/lib/api";
import { previewEnabled } from "@/lib/permissions";
=======
import { apiClient } from "@/lib/api";
>>>>>>> 29db595 (Initial ProWise project upload)
import { ORG_SHELL, orgPath } from "./org-nav-config";
import type { OrgFamily } from "./role-rules";

const ROLE_BADGE: Record<OrgFamily, string> = {
  owner: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  admin: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
};

<<<<<<< HEAD
/** Live sidebar badge counts derived from the org console store. */
export function useOrgBadges(): Record<string, number> {
  const invitations = useOrgConsoleStore((s) => s.invitations);
  const repositories = useOrgConsoleStore((s) => s.repositories);
  const notifications = useOrgConsoleStore((s) => s.notifications);
  const risks = useOrgConsoleStore((s) => s.risks);
  const members = useOrgConsoleStore((s) => s.members);
  const preview = previewEnabled();
  return useMemo(
    (): Record<string, number> => (!preview ? {} : {
      invites: invitations.filter((i) => i.status === "PENDING").length,
      repos: repositories.filter((r) => r.status === "FAILED" || r.status === "PAUSED").length,
      notifications: notifications.filter((n) => !n.read).length,
      risks: risks.filter((r) => r.severity === "CRITICAL" || r.severity === "HIGH").length,
      attention: members.filter((m) => m.status === "SUSPENDED" || (m.status === "ACTIVE" && !m.mfa)).length,
    }),
    [preview, invitations, repositories, notifications, risks, members]
  );
=======
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0]?.slice(0, 2) ?? "").toUpperCase() || "PW";
>>>>>>> 29db595 (Initial ProWise project upload)
}
export function OrgSidebarBody({
  family,
  orgId,
  collapsed = false,
  onClose,
  onToggleCollapse,
}: {
  family: OrgFamily;
  orgId: string;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname() || "";
  const config = ORG_SHELL[family];
<<<<<<< HEAD
  const badges = useOrgBadges();
  const sampleOrgName = useOrgConsoleStore((s) => s.settings.name);
  // The real organization from the session; the sample name only in the dev preview.
  const sessionOrgName = useAuthStore((s) => (s.currentOrg.id === orgId ? s.currentOrg.name : ""));
  const orgName = previewEnabled() ? sampleOrgName : sessionOrgName;
=======
  const orgName = useAuthStore((s) => (s.currentOrg.id === orgId ? s.currentOrg.name : ""));
>>>>>>> 29db595 (Initial ProWise project upload)
  const Icon = family === "owner" ? Crown : ShieldHalf;

  return (
    <div className="flex h-full flex-col bg-[var(--color-sidebar)] text-[var(--color-text-primary)]">
      <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-3.5 shrink-0">
        <Link href={orgPath(family, orgId)} className={cn("flex items-center gap-2.5 min-w-0", collapsed && "mx-auto")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1A73E8] text-white shadow-xs">
            <Icon className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight truncate">ProWise</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0", ROLE_BADGE[family])}>{config.label}</span>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] truncate">{orgName}</p>
            </div>
          )}
        </Link>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close navigation menu" className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4" aria-label={`${config.label} navigation`}>
        {config.sections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            {!collapsed ? (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">{section.title}</p>
            ) : (
              <div className="mx-2 my-1.5 border-t border-[var(--color-border)]" />
            )}
            {section.items.map((item) => {
              const href = orgPath(family, orgId, item.path);
              const active = pathname === href || pathname.startsWith(`${href}/`);
              const ItemIcon = item.icon;
              return (
                <Link
                  key={item.path}
                  href={href}
                  title={collapsed ? item.title : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                    active
                      ? "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-semibold"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]",
                    collapsed && "justify-center px-0 py-2"
                  )}
                >
                  <ItemIcon className={cn("w-4 h-4 shrink-0", active ? "text-blue-600 dark:text-blue-400" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]")} />
                  {!collapsed && <span className="truncate flex-1">{item.title}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {onToggleCollapse && (
        <div className="border-t border-[var(--color-border)] p-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="hidden lg:flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : (<><PanelLeftClose className="w-4 h-4" /><span>Collapse sidebar</span></>)}
          </button>
        </div>
      )}
    </div>
  );
}

export function OrgShell({ family, children }: { family: OrgFamily; children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const config = ORG_SHELL[family];
  const { resolvedTheme, setTheme } = useThemeStore();
  const logout = useAuthStore((s) => s.logout);
  const currentUser = useAuthStore((s) => s.currentUser);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("prowise-theme") as "light" | "dark" | "system" | null;
    if (saved) setTheme(saved);
    try {
      if (localStorage.getItem(`prowise-${family}-sidebar`) === "collapsed") setCollapsed(true);
    } catch {
      /* storage unavailable */
    }
  }, [setTheme, family]);

  useEffect(() => {
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapse = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(`prowise-${family}-sidebar`, c ? "expanded" : "collapsed");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });

  const routeMeta = useMemo(() => {
    for (const section of config.sections) {
      for (const item of section.items) {
        const href = orgPath(family, orgId, item.path);
        if (pathname === href || pathname.startsWith(`${href}/`)) return { section: section.title, label: item.title };
      }
    }
    return { section: "Overview", label: "Dashboard" };
  }, [config.sections, family, orgId, pathname]);

<<<<<<< HEAD
  const preview = previewEnabled();
  const sessionUser = useAuthStore((s) => s.currentUser);
  const sessionOrg = useAuthStore((s) => (s.currentOrg.id === orgId ? s.currentOrg.name : ""));
  // The signed-in user; the sample persona only in the dev preview.
  const viewer = preview ? ORG_VIEWERS[family] : { ...ORG_VIEWERS[family], name: sessionUser.name || sessionUser.email, title: sessionOrg };
  const person = preview ? members.find((m) => m.id === viewer.id) : { color: "#1A73E8", initials: (viewer.name.replace(/@.*/, "").split(/[s._-]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("") || "PW").toUpperCase() };
  const alerts = family === "owner" ? badges.notifications ?? 0 : (badges.attention ?? 0) + (badges.repos ?? 0);

=======
  const displayName = currentUser.name || currentUser.email;
  const signOut = async () => {
    try {
      await apiClient.signout();
    } finally {
      logout();
      router.push("/login");
    }
  };
>>>>>>> 29db595 (Initial ProWise project upload)
  return (
    <div className="min-h-screen w-full flex bg-[var(--color-app-bg)] text-[var(--color-text-primary)] overflow-x-clip">
      <style>{`
        @keyframes pwRise { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .pw-rise > * { animation: pwRise 420ms cubic-bezier(.2,.7,.2,1) both; }
        .pw-rise > *:nth-child(2) { animation-delay: 60ms; }
        .pw-rise > *:nth-child(3) { animation-delay: 120ms; }
        .pw-rise > *:nth-child(4) { animation-delay: 180ms; }
        .pw-rise > *:nth-child(n+5) { animation-delay: 240ms; }
        @media (prefers-reduced-motion: reduce) { .pw-rise > * { animation: none; } }
      `}</style>

      <aside className={cn("hidden lg:block shrink-0 border-r border-[var(--color-border)] sticky top-0 h-screen transition-all duration-200 z-30", collapsed ? "w-[68px]" : "w-64")}>
        <OrgSidebarBody family={family} orgId={orgId} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-[var(--color-border)] shadow-2xl">
            <OrgSidebarBody family={family} orgId={orgId} onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 flex h-14 w-full items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md px-3 sm:px-5 lg:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            <button type="button" onClick={() => setMobileOpen(true)} aria-label="Open navigation menu" className="lg:hidden rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]">
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm min-w-0">
              <Link href={orgPath(family, orgId)} className="hidden sm:inline text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors truncate">{routeMeta.section}</Link>
              <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
              <span className="font-semibold truncate">{routeMeta.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button type="button" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} aria-label="Toggle color theme" className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors">
              {mounted && resolvedTheme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2 pl-1">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1A73E8] text-[11px] font-bold text-white uppercase">{initials(displayName)}</div>
              <div className="hidden md:block min-w-0 leading-tight">
                <p className="text-xs font-semibold truncate max-w-[160px]">{displayName}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[160px]">{config.label}</p>
              </div>
            </div>
<<<<<<< HEAD
            <button type="button" onClick={() => { void apiClient.signout().catch(() => undefined).finally(() => { logout(); router.push("/login"); }); }} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-rose-500/10 hover:text-rose-600 transition-colors">
=======
            <button type="button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-rose-500/10 hover:text-rose-600 transition-colors">
>>>>>>> 29db595 (Initial ProWise project upload)
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 w-full max-w-[1960px] mx-auto px-3.5 sm:px-6 lg:px-7 py-4 sm:py-6 min-w-0">{children}</main>
      </div>
      <Toaster position="top-right" theme={resolvedTheme} richColors />
    </div>
  );
}
