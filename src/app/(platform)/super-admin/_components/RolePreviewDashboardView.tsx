"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Code,
  Cpu,
  CreditCard,
  Eye,
  FileCheck2,
  FileText,
  Flame,
  FolderKanban,
  GitBranch,
  GitPullRequest,
  HardDrive,
  Inbox,
  KeyRound,
  Layers,
  LifeBuoy,
  ListTodo,
  Megaphone,
  Radio,
  Receipt,
  RotateCcw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useSuperAdminStore } from "../_store/useSuperAdminStore";
import { useAuthStore } from "@/store/auth-store";
import {
  buildRolePreviewDefinitions,
  resolvePreviewRole,
  RolePreviewDefinition,
} from "../_services/role-preview-config";
import { SurfaceCard } from "./SuperAdminPrimitives";

interface RolePreviewDashboardViewProps {
  roleId: string;
}

export function RolePreviewDashboardView({ roleId }: RolePreviewDashboardViewProps) {
  const router = useRouter();
  const currentOrg = useAuthStore((s) => s.currentOrg);
  const setCurrentRole = useAuthStore((s) => s.setCurrentRole);
  const setActiveRolePreview = useSuperAdminStore((s) => s.setActiveRolePreview);

  const orgId = currentOrg?.id || "org-acme";
  const preview = resolvePreviewRole(roleId, orgId);

  const handleRestoreSuperAdmin = () => {
    setActiveRolePreview("role-super-admin");
    setCurrentRole("SUPER_ADMIN");
    toast.success("Restored full Super Administrator access");
    router.push("/super-admin/dashboard");
  };

  const getKpisForRole = (roleDef: RolePreviewDefinition) => {
    switch (roleDef.id) {
      case "role-platform-operator":
        return [
          { label: "Platform Health", value: "99.98%", sublabel: "All systems green", tone: "text-emerald-600 dark:text-emerald-400", icon: Server },
          { label: "Active Incidents", value: "2 Open", sublabel: "1 High • 1 Medium", tone: "text-amber-600 dark:text-amber-400", icon: Flame },
          { label: "Support Queue", value: "3 Pending", sublabel: "SRE SLA on track", tone: "text-blue-600 dark:text-blue-400", icon: LifeBuoy },
          { label: "Sync & Webhooks", value: "99.4%", sublabel: "42ms queue latency", tone: "text-purple-600 dark:text-purple-400", icon: Cpu },
        ];
      case "role-developer":
        return [
          { label: "Assigned Tasks", value: "8 Tasks", sublabel: "3 in progress • 5 backlog", tone: "text-blue-600 dark:text-blue-400", icon: ListTodo },
          { label: "Current Sprint", value: "Sprint 24", sublabel: "6 days remaining", tone: "text-emerald-600 dark:text-emerald-400", icon: Layers },
          { label: "Code Reviews", value: "3 Pending", sublabel: "Awaiting QA verification", tone: "text-purple-600 dark:text-purple-400", icon: GitPullRequest },
          { label: "Active Blockers", value: "1 Flagged", sublabel: "High priority bug", tone: "text-amber-600 dark:text-amber-400", icon: Flame },
        ];
      case "role-viewer":
        return [
          { label: "Monitored Projects", value: "4 Projects", sublabel: "All workspaces active", tone: "text-blue-600 dark:text-blue-400", icon: FolderKanban },
          { label: "Milestone Delivery", value: "78.4%", sublabel: "On schedule for Q4", tone: "text-emerald-600 dark:text-emerald-400", icon: Layers },
          { label: "Active Deliverables", value: "14 Items", sublabel: "Read-only access", tone: "text-purple-600 dark:text-purple-400", icon: CheckCircle2 },
          { label: "Audit State", value: "Verified", sublabel: "Stakeholder certified", tone: "text-emerald-600 dark:text-emerald-400", icon: ShieldCheck },
        ];
      case "role-org-owner":
        return [
          { label: "Tenant Workspaces", value: "3 Workspaces", sublabel: "Production, Staging, QA", tone: "text-blue-600 dark:text-blue-400", icon: Building2 },
          { label: "Organization Seats", value: "124 / 150", sublabel: "Enterprise Plan", tone: "text-purple-600 dark:text-purple-400", icon: Users },
          { label: "Subscription Status", value: "Active", sublabel: "Renews Jan 2027", tone: "text-emerald-600 dark:text-emerald-400", icon: CreditCard },
          { label: "Monthly Spend", value: "$1,850", sublabel: "All invoices paid", tone: "text-emerald-600 dark:text-emerald-400", icon: Receipt },
        ];
      case "role-org-admin":
        return [
          { label: "Active Members", value: "124 Users", sublabel: "8 teams assigned", tone: "text-blue-600 dark:text-blue-400", icon: Users },
          { label: "Pending Invites", value: "4 Sent", sublabel: "Awaiting activation", tone: "text-amber-600 dark:text-amber-400", icon: Inbox },
          { label: "Access Requests", value: "2 Open", sublabel: "Role delegations", tone: "text-purple-600 dark:text-purple-400", icon: KeyRound },
          { label: "Audit Health", value: "Compliant", sublabel: "SOC2 aligned", tone: "text-emerald-600 dark:text-emerald-400", icon: ShieldCheck },
        ];
      case "role-project-manager":
        return [
          { label: "Active Roadmaps", value: "4 Milestones", sublabel: "Delivery on track", tone: "text-blue-600 dark:text-blue-400", icon: FolderKanban },
          { label: "Tasks Breakdown", value: "42 Total", sublabel: "28 done • 14 active", tone: "text-purple-600 dark:text-purple-400", icon: ListTodo },
          { label: "Scope Schedule", value: "100%", sublabel: "+0.0% variance", tone: "text-emerald-600 dark:text-emerald-400", icon: Layers },
          { label: "Deadline Status", value: "Target Met", sublabel: "Nov 2026 milestone", tone: "text-emerald-600 dark:text-emerald-400", icon: Clock },
        ];
      case "role-team-lead":
        return [
          { label: "Team Velocity", value: "48 pts", sublabel: "Target 45 pts / sprint", tone: "text-emerald-600 dark:text-emerald-400", icon: Activity },
          { label: "Sprint Board", value: "18 Items", sublabel: "12 in progress • 6 done", tone: "text-blue-600 dark:text-blue-400", icon: Layers },
          { label: "Workload Balance", value: "Optimal", sublabel: "4 developers balanced", tone: "text-purple-600 dark:text-purple-400", icon: Users },
          { label: "Reviews In Flight", value: "4 Reviews", sublabel: "Awaiting sign-off", tone: "text-amber-600 dark:text-amber-400", icon: GitPullRequest },
        ];
      case "role-qa-reviewer":
        return [
          { label: "Review Queue", value: "6 Pulls", sublabel: "3 high priority", tone: "text-amber-600 dark:text-amber-400", icon: GitPullRequest },
          { label: "Acceptance Rate", value: "94.2%", sublabel: "48 verified this sprint", tone: "text-emerald-600 dark:text-emerald-400", icon: CheckCircle2 },
          { label: "Checklists Signed", value: "12 Checklists", sublabel: "All criteria verified", tone: "text-blue-600 dark:text-blue-400", icon: FileCheck2 },
          { label: "Open Defects", value: "2 Reported", sublabel: "Assigned to devs", tone: "text-purple-600 dark:text-purple-400", icon: Flame },
        ];
      default:
        return [
          { label: "Permissions Active", value: `${preview.permissionsCount}`, sublabel: "Role enabled", tone: "text-blue-600 dark:text-blue-400", icon: Shield },
          { label: "Access Tier", value: preview.tier, sublabel: "Hierarchy aligned", tone: "text-purple-600 dark:text-purple-400", icon: Layers },
          { label: "Sections Available", value: `${preview.sections.length} Groups`, sublabel: "Sidebar ready", tone: "text-emerald-600 dark:text-emerald-400", icon: FolderKanban },
          { label: "Status", value: "Active Preview", sublabel: "Click sections to browse", tone: "text-amber-600 dark:text-amber-400", icon: Eye },
        ];
    }
  };

  const kpis = getKpisForRole(preview);

  return (
    <div className="space-y-6">
      {/* Role Hero Card */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-200">
                <Eye className="w-3.5 h-3.5" />
                Preview Mode Active
              </span>
              <span className="text-xs text-[var(--color-text-muted)]">• {preview.tier}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--color-text-primary)]">
              {preview.name} Dashboard
            </h1>
            <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-2xl leading-relaxed">
              {preview.description}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setCurrentRole(preview.systemRole);
                router.push(preview.dashboardUrl);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1A73E8] px-4 py-2.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-[#1557B0] hover:shadow-lg active:scale-95"
            >
              <span>Launch Dedicated {preview.name} Panel</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRestoreSuperAdmin}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2.5 text-xs font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-hover)]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore Super Admin</span>
            </button>
          </div>
        </div>
      </div>

      {/* Adapted Live KPIs */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <SurfaceCard key={idx} className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                  {kpi.label}
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <span className={`text-2xl font-bold tracking-tight ${kpi.tone}`}>
                  {kpi.value}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                {kpi.sublabel}
              </p>
            </SurfaceCard>
          );
        })}
      </div>

      {/* Role Navigation Sections Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
              {preview.name} Operational Sections ({preview.sections.reduce((acc, s) => acc + s.items.length, 0)} Pages Available)
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              All sections and sub-pages configured for this role view:
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {preview.sections.map((section) => (
            <SurfaceCard key={section.id} className="p-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2.5 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {section.title}
                  </span>
                  <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                    {section.items.length} items
                  </span>
                </div>
                <div className="space-y-1.5">
                  {section.items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <button
                        key={item.href}
                        type="button"
                        onClick={() => {
                          setCurrentRole(preview.systemRole);
                          router.push(item.href);
                        }}
                        className="w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-hover)] transition-colors group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ItemIcon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="truncate">{item.title}</span>
                        </div>
                        <ArrowRight className="w-3 h-3 text-[var(--color-text-muted)] group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      </div>
    </div>
  );
}
