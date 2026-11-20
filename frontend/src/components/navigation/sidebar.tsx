"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  Bell,
  FolderGit2,
  GitPullRequest,
  CheckSquare,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Settings,
  X,
  Activity,
  CreditCard,
  Mail,
  Calendar,
  Clock,
  Sparkles,
  Server,
  KeyRound,
  FileCheck,
  LifeBuoy,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { usePermissions } from "@/hooks/usePermissions";
import { buildOrgNav, filterOrgNav, type OrgNavFamily } from "@/components/owner/org-nav";
import { getNavigationConfig } from "@/config/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
}

interface NavGroup {
  groupTitle?: string;
  items: NavItem[];
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  mobileTriggerRef: React.RefObject<HTMLButtonElement>;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface NavGroupsProps {
  groups: NavGroup[];
  pathname: string;
  compact: boolean;
  onNavigate: () => void;
}

function NavGroups({ groups, pathname, compact, onNavigate }: NavGroupsProps) {
  return (
    <>
      {groups.map((group, groupIdx) => (
        <div key={group.groupTitle ?? groupIdx} className="space-y-0.5">
          {!compact && group.groupTitle ? (
            <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">
              {group.groupTitle}
            </p>
          ) : (
            compact && <div className="mx-2 my-1.5 border-t border-app-border" aria-hidden="true" />
          )}
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={compact ? item.label : undefined}
                title={compact ? item.label : undefined}
                onClick={onNavigate}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors motion-reduce:transition-none",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent",
                  isActive
                    ? "bg-blue-500/15 font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                    : "text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary",
                  compact && "justify-center px-0 py-2",
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 shrink-0",
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-app-text-muted group-hover:text-app-text-primary",
                  )}
                />
                {!compact && <span className="flex-1 truncate">{item.label}</span>}
                {!compact && item.badge !== undefined && (
                  <span className="ml-auto rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

/** Owner/Admin menu: route family from the role template, every item gated by permission keys. */
function OrgPermissionNav({
  family,
  orgId,
  ...rest
}: { family: OrgNavFamily; orgId: string } & Omit<NavGroupsProps, "groups">) {
  const { canAny } = usePermissions();
  const groups = filterOrgNav(buildOrgNav(family, orgId), canAny).map((group) => ({
    groupTitle: group.title,
    items: group.items,
  }));
  return <NavGroups groups={groups} {...rest} />;
}

export function Sidebar({ mobileOpen, onMobileClose, mobileTriggerRef }: SidebarProps) {
  const pathname = usePathname();
  const { currentRole, currentOrg } = useAuthStore();
  const permissions = usePermissions();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const orgId = currentOrg.id;
  const isCompact = isCollapsed && !mobileOpen;
  const orgFamily: OrgNavFamily | null =
    currentRole === "ORGANIZATION_OWNER" ? "owner" : currentRole === "ORGANIZATION_ADMIN" ? "admin" : null;

  const closeMobileNavigation = useCallback(() => {
    onMobileClose();
    mobileTriggerRef.current?.focus();
  }, [mobileTriggerRef, onMobileClose]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileNavigation();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!sidebarRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen, closeMobileNavigation]);

  // Close the drawer if the viewport grows to desktop width while it is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) onMobileClose();
    };
    desktop.addEventListener("change", onChange);
    return () => desktop.removeEventListener("change", onChange);
  }, [mobileOpen, onMobileClose]);

  // Build role-specific navigation menu items
  const getNavGroups = (): NavGroup[] => {
    switch (currentRole) {
      case "SUPER_ADMIN":
        return [
          {
            groupTitle: "Platform Core",
            items: [
              { label: "Dashboard", href: "/super-admin", icon: LayoutDashboard },
              { label: "Organizations", href: "/super-admin/organizations", icon: Building2 },
              { label: "Platform Operators", href: "/super-admin/operators", icon: Users },
              { label: "Roles & Permissions", href: "/super-admin/roles", icon: KeyRound },
            ],
          },
          {
            groupTitle: "Commercial & Billing",
            items: [
              { label: "Subscription Plans", href: "/super-admin/plans", icon: Layers },
              { label: "Subscriptions", href: "/super-admin/subscriptions", icon: CreditCard },
              { label: "Payments & Invoices", href: "/super-admin/invoices", icon: FileText },
              { label: "Email & Templates", href: "/super-admin/emails", icon: Mail },
            ],
          },
          {
            groupTitle: "System & Governance",
            items: [
              { label: "Security & Access", href: "/super-admin/security", icon: ShieldCheck },
              { label: "Incidents & Health", href: "/super-admin/incidents", icon: AlertTriangle },
              { label: "Audit Logs", href: "/super-admin/audit", icon: Activity },
              { label: "Platform Settings", href: "/super-admin/settings", icon: Settings },
            ],
          },
        ];

      case "PLATFORM_OPERATOR":
        return [
          {
            groupTitle: "Operations",
            items: [
              { label: "Dashboard", href: "/platform-operator", icon: LayoutDashboard },
              { label: "Organization Status", href: "/platform-operator/org-status", icon: Building2 },
              { label: "System Monitoring", href: "/platform-operator/monitoring", icon: Server },
              { label: "Support Tickets", href: "/platform-operator/tickets", icon: LifeBuoy, badge: 2 },
              { label: "Incidents", href: "/platform-operator/incidents", icon: AlertTriangle, badge: 1 },
            ],
          },
          {
            groupTitle: "Integrations & Sync",
            items: [
              { label: "Integration Health", href: "/platform-operator/integrations", icon: FolderGit2 },
              { label: "Webhook Logs", href: "/platform-operator/webhooks", icon: Activity },
              { label: "Failed Events & Retries", href: "/platform-operator/failed-events", icon: AlertTriangle },
              { label: "Backups & Maintenance", href: "/platform-operator/backups", icon: ShieldCheck },
              { label: "Operator Settings", href: "/platform-operator/settings", icon: Settings },
            ],
          },
        ];

      case "PROJECT_MANAGER": {
        const canManagerPermission = (key: Parameters<typeof permissions.can>[0]) =>
          permissions.can(key) ||
          permissions.grants.some(
            (grant) =>
              grant.key === key &&
              grant.scope === "PROJECT" &&
              permissions.can(key, { projectId: grant.scopeId }),
          );
        return getNavigationConfig("PROJECT_MANAGER", orgId, canManagerPermission).map((section) => ({
          groupTitle: section.title,
          items: section.items.map(({ title, href, icon, badge }) => ({
            label: title,
            href,
            icon,
            badge,
          })),
        }));
      }

      case "TEAM_LEAD":
        return [
          {
            groupTitle: "Team Coordination",
            items: [
              { label: "Lead Dashboard", href: `/org/${orgId}/lead`, icon: LayoutDashboard },
              { label: "My Team", href: `/org/${orgId}/lead/team`, icon: Users },
              { label: "Team Projects", href: `/org/${orgId}/lead/projects`, icon: FolderGit2 },
              { label: "Work Items & Tasks", href: `/org/${orgId}/lead/work-items`, icon: CheckSquare },
              { label: "Sprint & Planning", href: `/org/${orgId}/lead/planning`, icon: Calendar },
            ],
          },
          {
            groupTitle: "Tracking",
            items: [
              { label: "Dependencies & Graph", href: `/org/${orgId}/lead/dependencies`, icon: Activity },
              { label: "Blockers", href: `/org/${orgId}/lead/blockers`, icon: AlertTriangle, badge: 1 },
              { label: "Member Workload", href: `/org/${orgId}/lead/workload`, icon: Users },
              { label: "Team Activity", href: `/org/${orgId}/lead/activity`, icon: Clock },
            ],
          },
        ];

      case "DEVELOPER":
        return [
          {
            groupTitle: "My Delivery",
            items: [
              { label: "Developer Dashboard", href: `/org/${orgId}/developer`, icon: LayoutDashboard },
              { label: "My Work & Tasks", href: `/org/${orgId}/developer/my-work`, icon: CheckSquare },
              { label: "Deadlines & Due Dates", href: `/org/${orgId}/developer/deadlines`, icon: Clock },
              { label: "Check-ins Due", href: `/org/${orgId}/developer/checkins`, icon: FileCheck },
            ],
          },
          {
            groupTitle: "Live Project Modes",
            items: [
              {
                label: "Solo: FHIR Intake",
                href: `/org/${orgId}/developer/projects/proj-individual-solo/individual`,
                icon: FolderGit2,
              },
              {
                label: "Structured: CDS API",
                href: `/org/${orgId}/developer/projects/proj-structured-cds/structured`,
                icon: GitPullRequest,
              },
            ],
          },
        ];

      case "QA_REVIEWER":
        return [
          {
            groupTitle: "Quality Assurance",
            items: [
              { label: "QA Dashboard", href: `/org/${orgId}/reviewer`, icon: LayoutDashboard },
              { label: "Review Queue", href: `/org/${orgId}/reviewer/queue`, icon: CheckSquare, badge: 1 },
              { label: "Test Checklists", href: `/org/${orgId}/reviewer/checklists`, icon: FileCheck },
              { label: "Evidence Inspector", href: `/org/${orgId}/reviewer/evidence`, icon: FolderGit2 },
              { label: "Review History", href: `/org/${orgId}/reviewer/history`, icon: Clock },
              { label: "Quality Reports", href: `/org/${orgId}/reviewer/reports`, icon: FileText },
            ],
          },
        ];

      case "VIEWER":
      default:
        return [
          {
            groupTitle: "Stakeholder Overview",
            items: [
              { label: "Dashboard", href: `/org/${orgId}/viewer/dashboard`, icon: LayoutDashboard },
              { label: "Projects Portfolio", href: `/org/${orgId}/viewer/projects`, icon: FolderGit2 },
              { label: "Tasks & Work", href: `/org/${orgId}/viewer/tasks`, icon: CheckSquare },
              { label: "Progress Summaries", href: `/org/${orgId}/viewer/progress`, icon: Activity },
              { label: "Authorized Reports", href: `/org/${orgId}/viewer/reports`, icon: FileText },
              { label: "Milestones & Delivery", href: `/org/${orgId}/viewer/milestones`, icon: Calendar },
              { label: "Team Directory", href: `/org/${orgId}/viewer/team`, icon: Users },
              { label: "Calendar", href: `/org/${orgId}/viewer/calendar`, icon: Calendar },
              { label: "Files & Evidence", href: `/org/${orgId}/viewer/files`, icon: FileText },
              { label: "Project Activity", href: `/org/${orgId}/viewer/activity`, icon: Clock },
              { label: "Notifications", href: `/org/${orgId}/viewer/notifications`, icon: Bell },
              { label: "Settings", href: `/org/${orgId}/viewer/settings`, icon: Settings },
            ],
          },
        ];
    }
  };

  const onNavigate = () => {
    if (mobileOpen) closeMobileNavigation();
  };

  return (
    <>
      {mobileOpen && (
        <div
          aria-hidden="true"
          onClick={closeMobileNavigation}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        ref={sidebarRef}
        id="primary-navigation"
        role={mobileOpen ? "dialog" : undefined}
        aria-modal={mobileOpen ? true : undefined}
        aria-label="Primary navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] shrink-0 flex-col border-r border-app-border bg-app-sidebar text-app-text-primary shadow-2xl",
          "transition-transform duration-200 motion-reduce:transition-none",
          "lg:sticky lg:top-0 lg:z-30 lg:max-w-none lg:translate-x-0 lg:shadow-none lg:visible lg:transition-[width]",
          isCollapsed ? "lg:w-[68px]" : "lg:w-64",
          mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full",
        )}
      >
        {/* Brand header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-app-border px-3.5">
          <Link
            href="/"
            aria-label="ProWise home"
            className={cn(
              "flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent",
              isCompact && "mx-auto",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1A73E8] text-white shadow-xs">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            {!isCompact && (
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold tracking-tight text-app-text-primary">ProWise</span>
                <span className="block truncate text-[10px] text-app-text-muted">Delivery workspace</span>
              </span>
            )}
          </Link>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeMobileNavigation}
            aria-label="Close primary navigation"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-app-text-secondary hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent lg:hidden"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Active organization */}
        {!isCompact && currentRole !== "SUPER_ADMIN" && currentRole !== "PLATFORM_OPERATOR" && (
          <div className="shrink-0 border-b border-app-border p-2.5">
            <div className="rounded-lg border border-app-border bg-app-surface px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-app-text-muted">Active organization</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-app-text-primary">{currentOrg.name}</p>
              {currentOrg.timezone && (
                <p className="mt-0.5 truncate text-[10px] text-app-text-secondary">{currentOrg.timezone}</p>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav aria-label="Primary navigation" className="flex-1 space-y-4 overflow-y-auto px-2.5 py-3">
          {orgFamily ? (
            <OrgPermissionNav
              family={orgFamily}
              orgId={orgId}
              pathname={pathname}
              compact={isCompact}
              onNavigate={onNavigate}
            />
          ) : (
            <NavGroups groups={getNavGroups()} pathname={pathname} compact={isCompact} onNavigate={onNavigate} />
          )}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className="hidden shrink-0 border-t border-app-border p-2.5 lg:block">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-app-border bg-app-surface px-2.5 py-1.5 text-xs font-medium text-app-text-secondary transition-colors hover:bg-app-hover hover:text-app-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent motion-reduce:transition-none"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
                <span>Collapse sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
