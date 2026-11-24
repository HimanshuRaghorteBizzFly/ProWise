"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  ChevronRight,
  ClipboardCheck,
  FolderKanban,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Users,
  X,
} from "lucide-react";
import { Toaster } from "sonner";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/store/theme-store";
import { useAuthStore } from "@/store/auth-store";
<<<<<<< HEAD
import { useDeliveryStore } from "@/store/delivery-store";
import { PEOPLE, VIEWERS } from "@/mocks/delivery-dashboards";
import { apiClient } from "@/lib/api";
import { previewEnabled } from "@/lib/permissions";
=======
import { apiClient } from "@/lib/api";
>>>>>>> 29db595 (Initial ProWise project upload)
import { DELIVERY_ROLES, rolePath, type DeliveryRole } from "./delivery-nav";

const ROLE_ICON: Record<DeliveryRole, React.ElementType> = {
  manager: FolderKanban,
  lead: Users,
  reviewer: ClipboardCheck,
};

const ROLE_BADGE: Record<DeliveryRole, string> = {
  manager: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
  lead: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  reviewer: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
};

<<<<<<< HEAD
/** Live sidebar badge counts for each role, derived from the delivery store. */
export function useNavBadges(role: DeliveryRole): Record<string, number> {
  const tasks = useDeliveryStore((s) => s.tasks);
  const blockers = useDeliveryStore((s) => s.blockers);
  const projects = useDeliveryStore((s) => s.projects);
  const scopeChanges = useDeliveryStore((s) => s.scopeChanges);
  const checkIns = useDeliveryStore((s) => s.checkIns);
  const reviews = useDeliveryStore((s) => s.reviews);
  const evidence = useDeliveryStore((s) => s.evidence);
  const teams = useDeliveryStore((s) => s.teams);

  return useMemo((): Record<string, number> => {
    // Badge counts come from the sample delivery store: only in the dev preview, never as real numbers.
    if (!previewEnabled()) return {};
    if (role === "manager") {
      return {
        risks: projects.flatMap((p) => p.risks).filter((r) => r.severity === "HIGH" || r.severity === "CRITICAL").length,
        overdue: tasks.filter((t) => t.status !== "DONE" && daysFromToday(t.dueDate) < 0).length,
        blockers: blockers.filter((b) => b.status === "OPEN").length,
        scope: scopeChanges.filter((c) => c.status === "PENDING").length,
      };
    }
    if (role === "lead") {
      const team = teams.find((t) => t.id === VIEWERS.lead.teamId);
      const members = new Set(team?.memberIds ?? []);
      const teamTasks = tasks.filter((t) => (t.assigneeId ? members.has(t.assigneeId) : t.teamId === team?.id));
      const teamTaskIds = new Set(teamTasks.map((t) => t.id));
      return {
        today: teamTasks.filter((t) => t.status !== "DONE" && daysFromToday(t.dueDate) <= 0).length,
        checkins: checkIns.filter((c) => members.has(c.memberId) && c.status !== "SUBMITTED").length,
        unassigned: teamTasks.filter((t) => !t.assigneeId && t.status !== "DONE").length,
        blockers: blockers.filter((b) => b.status === "OPEN" && teamTaskIds.has(b.taskId)).length,
      };
    }
    const pending = reviews.filter((r) => r.status === "PENDING");
    return {
      queue: pending.length,
      waiting: pending.filter((r) => hoursSince(r.submittedAt) >= 48).length,
      evidence: evidence.filter((e) => e.status === "TO_INSPECT").length,
    };
  }, [role, tasks, blockers, projects, scopeChanges, checkIns, reviews, evidence, teams]);
}

=======
>>>>>>> 29db595 (Initial ProWise project upload)
export function DeliverySidebarBody({
  role,
  orgId,
  collapsed = false,
  onClose,
  onToggleCollapse,
}: {
  role: DeliveryRole;
  orgId: string;
  collapsed?: boolean;
  onClose?: () => void;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname() || "";
  const config = DELIVERY_ROLES[role];
  const RoleIcon = ROLE_ICON[role];
  const dashboardHref = rolePath(role, orgId);

  const isActive = (path: string) => {
    const href = rolePath(role, orgId, path);
    if (!path) return pathname === href || pathname === `${href}/dashboard`;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--color-sidebar)] text-[var(--color-text-primary)]">
      <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-3.5 shrink-0">
        <Link href={dashboardHref} className={cn("flex items-center gap-2.5 min-w-0", collapsed && "mx-auto")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1A73E8] text-white shadow-xs">
            <RoleIcon className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold tracking-tight truncate">ProWise</span>
                <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0", ROLE_BADGE[role])}>
                  {config.label}
                </span>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] truncate">{config.tagline}</p>
            </div>
          )}
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="rounded-lg p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-4" aria-label={`${config.label} navigation`}>
        {config.sections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            {!collapsed ? (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {section.title}
              </p>
            ) : (
              <div className="mx-2 my-1.5 border-t border-[var(--color-border)]" />
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.title}
                  href={rolePath(role, orgId, item.path)}
                  title={collapsed ? item.title : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors relative",
                    active
                      ? "bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 font-semibold"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)]",
                    collapsed && "justify-center px-0 py-2"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4 shrink-0",
                      active ? "text-blue-600 dark:text-blue-400" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-primary)]"
                    )}
                  />
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
      )}
    </div>
  );
}

export function DeliveryShell({ role, children }: { role: DeliveryRole; children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const config = DELIVERY_ROLES[role];

  const { resolvedTheme, setTheme } = useThemeStore();
  const { currentRole, setCurrentRole, logout, currentUser, currentOrg } = useAuthStore();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("prowise-theme") as "light" | "dark" | "system" | null;
    if (saved) setTheme(saved);
    if (localStorage.getItem(`prowise-${role}-sidebar`) === "collapsed") setCollapsed(true);
  }, [setTheme, role]);

  useEffect(() => {
    // Dev preview only: in normal use the role always comes from the real session, never from the URL.
    if (previewEnabled() && currentRole !== config.systemRole) setCurrentRole(config.systemRole);
  }, [currentRole, config.systemRole, setCurrentRole]);

  useEffect(() => {
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(`prowise-${role}-sidebar`, c ? "expanded" : "collapsed");
      } catch {
        /* storage unavailable */
      }
      return !c;
    });
  };

  const routeMeta = useMemo(() => {
    let best: { section: string; label: string; len: number } = { section: "Overview", label: "Dashboard", len: -1 };
    for (const section of config.sections) {
      for (const item of section.items) {
        const href = rolePath(role, orgId, item.path);
        const matches = item.path
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === href || pathname === `${href}/dashboard`;
        if (matches && href.length > best.len) best = { section: section.title, label: item.title, len: href.length };
      }
    }
    return best;
  }, [config.sections, role, orgId, pathname]);

<<<<<<< HEAD
  const preview = previewEnabled();
  const sessionUser = useAuthStore((state) => state.currentUser);
  const sessionOrgName = useAuthStore((state) => (state.currentOrg.id === orgId ? state.currentOrg.name : ""));
  const sampleViewer = VIEWERS[role];
  // The signed-in user and organization; the sample persona only in the dev preview.
  const viewer = preview ? sampleViewer : { ...sampleViewer, name: sessionUser.name || sessionUser.email, title: sessionOrgName };
  const viewerPerson = preview ? PEOPLE.find((p) => p.id === viewer.id) : { color: "#1A73E8", initials: initialsOf(viewer.name) };
  const alertCount = Object.values(badges).reduce((s, n) => s + n, 0);
=======
  const displayName = currentUser.name || currentUser.email;
  const initials = displayName
    ? displayName.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("")
    : "";
  const subtitle = currentOrg.name ? `${config.label} · ${currentOrg.name}` : config.label;
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

      <aside
        className={cn(
          "hidden lg:block shrink-0 border-r border-[var(--color-border)] sticky top-0 h-screen transition-all duration-200 z-30",
          collapsed ? "w-[68px]" : "w-64"
        )}
      >
        <DeliverySidebarBody role={role} orgId={orgId} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 h-full w-72 max-w-[85vw] border-r border-[var(--color-border)] shadow-2xl">
            <DeliverySidebarBody role={role} orgId={orgId} onClose={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
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
                href={rolePath(role, orgId)}
                className="hidden sm:inline text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors truncate"
              >
                {routeMeta.section}
              </Link>
              <ChevronRight className="hidden sm:inline w-3.5 h-3.5 text-[var(--color-text-muted)] shrink-0" />
              <span className="font-semibold text-[var(--color-text-primary)] truncate">{routeMeta.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle color theme"
              className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {mounted && resolvedTheme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
            <div className="flex items-center gap-2 pl-1">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white uppercase"
                style={{ backgroundColor: "#1A73E8" }}
              >
                {initials || "PW"}
              </div>
              <div className="hidden md:block min-w-0 leading-tight">
                <p className="text-xs font-semibold truncate max-w-[160px]">{displayName}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[160px]">{subtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
<<<<<<< HEAD
                // End the server session too (revokes it and clears the httpOnly cookies), then sign in again.
                void apiClient.signout().catch(() => undefined).finally(() => {
                  logout();
                  router.push("/login");
                });
=======
                void apiClient
                  .signout()
                  .catch(() => undefined)
                  .finally(() => {
                    logout();
                    router.push("/login");
                  });
>>>>>>> 29db595 (Initial ProWise project upload)
              }}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-lg p-2 text-[var(--color-text-secondary)] hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
            >
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

function initialsOf(name: string): string {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "PW").toUpperCase();
}
