"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Layers,
  LayoutDashboard,
  Building2,
  Users,
  FolderGit2,
  GitPullRequest,
  CheckSquare,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Menu,
  Activity,
  CreditCard,
  Mail,
  Bell,
  Calendar,
  Clock,
  Sparkles,
  Server,
  KeyRound,
  FileCheck,
  LifeBuoy,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";
import { SystemRole } from "@/types";
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

export function Sidebar() {
  const pathname = usePathname();
  const { currentRole, currentOrg } = useAuthStore();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    main: true,
    platform: true,
    projects: true,
    governance: true,
  });

  const orgId = currentOrg.id;

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

      case "ORGANIZATION_OWNER":
        return [
          {
            groupTitle: "Workspace",
            items: [
              { label: "Owner Dashboard", href: `/org/${orgId}/owner`, icon: LayoutDashboard },
              { label: "Organization Profile", href: `/org/${orgId}/owner/profile`, icon: Building2 },
              { label: "Members & Leads", href: `/org/${orgId}/owner/members`, icon: Users },
              { label: "Teams & Roster", href: `/org/${orgId}/owner/teams`, icon: Users },
              { label: "Invitations", href: `/org/${orgId}/owner/invitations`, icon: Mail, badge: 2 },
            ],
          },
          {
            groupTitle: "Delivery & Finance",
            items: [
              { label: "Project Portfolio", href: `/org/${orgId}/owner/projects`, icon: FolderGit2 },
              { label: "Subscription & Billing", href: `/org/${orgId}/owner/billing`, icon: CreditCard },
              { label: "Integrations", href: `/org/${orgId}/owner/integrations`, icon: FolderGit2 },
              { label: "Audit & Compliance", href: `/org/${orgId}/owner/audit`, icon: Activity },
              { label: "Transfer Ownership", href: `/org/${orgId}/owner/transfer`, icon: KeyRound },
            ],
          },
        ];

      case "ORGANIZATION_ADMIN":
        return [
          {
            groupTitle: "Administration",
            items: [
              { label: "Admin Dashboard", href: `/org/${orgId}/admin`, icon: LayoutDashboard },
              { label: "Members & Access", href: `/org/${orgId}/admin/members`, icon: Users },
              { label: "Teams", href: `/org/${orgId}/admin/teams`, icon: Users },
              { label: "Invitations", href: `/org/${orgId}/admin/invitations`, icon: Mail },
              { label: "Projects Overview", href: `/org/${orgId}/admin/projects`, icon: FolderGit2 },
              { label: "Repositories (GitHub)", href: `/org/${orgId}/admin/repositories`, icon: GitPullRequest },
              { label: "Activity Stream", href: `/org/${orgId}/admin/activity`, icon: Activity },
              { label: "Admin Settings", href: `/org/${orgId}/admin/settings`, icon: Settings },
            ],
          },
        ];

      case "PROJECT_MANAGER":
        return [
          {
            groupTitle: "Project Delivery",
            items: [
              { label: "PM Dashboard", href: `/org/${orgId}/manager`, icon: LayoutDashboard },
              { label: "All Projects", href: `/org/${orgId}/manager/projects`, icon: FolderGit2 },
              { label: "Create Project", href: `/org/${orgId}/manager/create-project`, icon: Sparkles },
              { label: "Scope & Baselines", href: `/org/${orgId}/manager/scope`, icon: FileCheck },
              { label: "Progress History", href: `/org/${orgId}/manager/progress`, icon: Clock },
            ],
          },
          {
            groupTitle: "Governance & Reviews",
            items: [
              { label: "Deadlines & Health", href: `/org/${orgId}/manager/deadlines`, icon: AlertTriangle },
              { label: "Delivery Approvals", href: `/org/${orgId}/manager/delivery-approvals`, icon: ShieldCheck, badge: 1 },
              { label: "Workload & Capacity", href: `/org/${orgId}/manager/workload`, icon: Users },
              { label: "Portfolio Reports", href: `/org/${orgId}/manager/reports`, icon: FileText },
            ],
          },
        ];

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
              { label: "Viewer Dashboard", href: `/org/${orgId}/viewer`, icon: LayoutDashboard },
              { label: "Projects Portfolio", href: `/org/${orgId}/viewer/projects`, icon: FolderGit2 },
              { label: "Progress Summaries", href: `/org/${orgId}/viewer/progress`, icon: Activity },
              { label: "Milestones & Delivery", href: `/org/${orgId}/viewer/milestones`, icon: Calendar },
              { label: "Project Activity", href: `/org/${orgId}/viewer/activity`, icon: Clock },
              { label: "Authorized Reports", href: `/org/${orgId}/viewer/reports`, icon: FileText },
            ],
          },
        ];
    }
  };

  const navGroups = getNavGroups();

  return (
    <aside
      className={cn(
        "relative flex flex-col border-r border-app-border bg-app-sidebar transition-all duration-300 z-30 select-none",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-app-border">
        {!isCollapsed && (
          <Link href="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              P
            </div>
            <div>
              <div className="text-base font-bold text-app-text-primary tracking-tight leading-none">
                ProWise
              </div>
              <div className="text-[10px] text-app-text-muted mt-0.5 font-medium uppercase tracking-wider">
                Delivery SaaS
              </div>
            </div>
          </Link>
        )}
        {isCollapsed && (
          <div className="mx-auto h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
            P
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="rounded-lg p-1.5 text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary transition-colors ml-auto"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Workspace Selector (when in org context) */}
      {!isCollapsed && currentRole !== "SUPER_ADMIN" && currentRole !== "PLATFORM_OPERATOR" && (
        <div className="p-3 border-b border-app-border">
          <div className="rounded-lg bg-app-surface border border-app-border p-2 shadow-xs">
            <div className="text-[10px] uppercase font-bold text-app-text-muted tracking-wider">
              Active Organization
            </div>
            <div className="text-xs font-semibold text-app-text-primary truncate mt-0.5">
              {currentOrg.name}
            </div>
            <div className="text-[10px] text-app-text-secondary flex items-center gap-1 mt-0.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500"></span>
              {currentOrg.timezone} • {currentOrg.plan}
            </div>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="space-y-1">
            {!isCollapsed && group.groupTitle && (
              <div className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-app-text-muted">
                {group.groupTitle}
              </div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative",
                    isActive
                      ? "bg-blue-100/70 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold"
                      : "text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary",
                    isCollapsed && "justify-center px-0"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-blue-600 dark:text-blue-400" : "text-app-text-muted")} />
                  {!isCollapsed && <span className="truncate flex-1">{item.label}</span>}
                  {!isCollapsed && item.badge !== undefined && (
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

      {/* Footer Info */}
      {!isCollapsed && (
        <div className="p-3 border-t border-app-border text-[11px] text-app-text-muted flex items-center justify-between">
          <span>Blueprint V1.1</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">Online</span>
        </div>
      )}
    </aside>
  );
}

