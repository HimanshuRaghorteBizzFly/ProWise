import { SystemRole } from "@/types";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Shield,
  Building2,
  CreditCard,
  Receipt,
  FileText,
  Plug,
  GitBranch,
  Webhook,
  Activity,
  ShieldCheck,
  KeyRound,
  AlertTriangle,
  ShieldAlert,
  Send,
  Mail,
  Megaphone,
  Sliders,
  Wrench,
  BarChart3,
  Settings,
  LifeBuoy,
  UserCog,
  Briefcase,
  Eye,
  Code,
  CheckSquare,
  Layers,
  Clock,
  Cpu,
  FolderKanban,
  ListTodo,
  GitPullRequest,
  Bug,
  MessageSquare,
  FileCheck2,
  Calendar,
  HardDrive,
  CheckCircle2,
  Server,
  Radio,
  FileCode,
  Inbox,
  Flame,
  type LucideIcon,
} from "lucide-react";

export interface PreviewSidebarItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badgeCount?: number;
  matchPaths?: string[];
  requiredAny?: string[];
}

export interface PreviewSidebarSection {
  id: string;
  title: string;
  items: PreviewSidebarItem[];
}

export interface RolePreviewDefinition {
  id: string;
  slug: string;
  name: string;
  systemRole: SystemRole;
  dashboardUrl: string;
  badgeLabel: string;
  tier: string;
  description: string;
  permissionsCount: number;
  sections: PreviewSidebarSection[];
}

export function getSafeOrgId(): string {
  if (typeof window !== "undefined") {
    try {
      const authRaw = localStorage.getItem("prowise-auth-store");
      if (authRaw) {
        const parsed = JSON.parse(authRaw);
        if (parsed?.state?.currentOrg?.id) {
          return parsed.state.currentOrg.id;
        }
        if (parsed?.state?.activeOrgId) {
          return parsed.state.activeOrgId;
        }
      }
    } catch {}
  }
  return "org-acme";
}

export function buildRolePreviewDefinitions(orgId: string = "org-acme"): Record<string, RolePreviewDefinition> {
  const safeOrg = orgId && orgId.trim() !== "" ? orgId : "org-acme";

  return {
    "role-super-admin": {
      id: "role-super-admin",
      slug: "super-admin",
      name: "Super Admin",
      systemRole: "SUPER_ADMIN",
      dashboardUrl: "/super-admin/dashboard",
      badgeLabel: "Platform Governance Root",
      tier: "Platform Governance Tier",
      description: "Platform governance, organizations, operators, billing, global security policies, and audit oversight.",
      permissionsCount: 75,
      sections: [
        {
          id: "overview",
          title: "Overview",
          items: [
            { title: "Dashboard", href: "/super-admin/dashboard", matchPaths: ["/super-admin", "/super-admin/dashboard"], icon: LayoutDashboard },
            { title: "User Management", href: "/super-admin/users", icon: UserCheck },
            { title: "Organizations", href: "/super-admin/organizations", icon: Building2 },
            { title: "Platform Operators", href: "/super-admin/operators", icon: Users },
            { title: "Roles & Permissions", href: "/super-admin/roles-permissions", matchPaths: ["/super-admin/roles-permissions", "/super-admin/roles"], icon: Shield },
          ],
        },
        {
          id: "billing",
          title: "Billing & Revenue",
          items: [
            { title: "Plans", href: "/super-admin/plans", icon: Layers },
            { title: "Subscriptions", href: "/super-admin/subscriptions", icon: CreditCard },
            { title: "Billing & Payments", href: "/super-admin/payments", icon: Receipt },
            { title: "Invoices", href: "/super-admin/invoices", icon: FileText },
          ],
        },
        {
          id: "integrations",
          title: "Integrations & API",
          items: [
            { title: "Integration Overview", href: "/super-admin/integrations", icon: Plug },
            { title: "GitHub Integration", href: "/super-admin/github-integrations", icon: GitBranch },
            { title: "Webhooks & Events", href: "/super-admin/webhooks", icon: Webhook },
            { title: "API Monitoring", href: "/super-admin/api-monitoring", icon: Activity },
            { title: "Integration Settings", href: "/super-admin/integration-settings", icon: Wrench },
          ],
        },
        {
          id: "security",
          title: "Security & Governance",
          items: [
            { title: "Security Center", href: "/super-admin/security", icon: ShieldCheck },
            { title: "Support Access Approvals", href: "/super-admin/access-approvals", icon: KeyRound },
            { title: "Incident Governance", href: "/super-admin/incidents", icon: AlertTriangle },
            { title: "Audit & Compliance", href: "/super-admin/audit", icon: ShieldAlert },
          ],
        },
        {
          id: "communication",
          title: "Communication",
          items: [
            { title: "SMTP Email", href: "/super-admin/email-settings", matchPaths: ["/super-admin/email-settings", "/super-admin/emails"], icon: Send },
            { title: "Email Templates", href: "/super-admin/email-templates", icon: Mail },
            { title: "Announcements", href: "/super-admin/announcements", icon: Megaphone },
          ],
        },
        {
          id: "platform",
          title: "Platform Management",
          items: [
            { title: "Platform Configuration", href: "/super-admin/configuration", icon: Sliders },
            { title: "Maintenance Mode", href: "/super-admin/maintenance", matchPaths: ["/super-admin/maintenance", "/super-admin/configuration/maintenance"], icon: Wrench },
            { title: "Reports & Analytics", href: "/super-admin/reports", icon: BarChart3 },
            { title: "Settings", href: "/super-admin/settings", icon: Settings },
            { title: "Support Oversight", href: "/super-admin/support", icon: LifeBuoy },
          ],
        },
        {
          id: "account",
          title: "Super Admin Settings",
          items: [
            { title: "Account & Security", href: "/super-admin/account", icon: UserCog },
          ],
        },
      ],
    },

    "role-platform-operator": {
      id: "role-platform-operator",
      slug: "platform-operator",
      name: "Platform Operator",
      systemRole: "PLATFORM_OPERATOR",
      dashboardUrl: "/platform-operator/dashboard",
      badgeLabel: "SRE & Operations Lead",
      tier: "Platform Governance Tier",
      description: "Delegated SRE monitoring, incident response, support tickets, webhooks, queues, and operational maintenance.",
      permissionsCount: 43,
      sections: [
        {
          id: "op-overview",
          title: "Operations Overview",
          items: [
            { title: "Operations Dashboard", href: "/platform-operator/dashboard", matchPaths: ["/platform-operator", "/platform-operator/dashboard"], icon: LayoutDashboard },
            { title: "Organization Service Status", href: "/platform-operator/org-status", icon: Server },
            { title: "System Monitoring", href: "/platform-operator/monitoring", icon: Activity },
          ],
        },
        {
          id: "op-incidents",
          title: "Incidents & Support",
          items: [
            { title: "Incident Management", href: "/platform-operator/incidents", icon: Flame },
            { title: "Support Tickets", href: "/platform-operator/support-tickets", matchPaths: ["/platform-operator/support-tickets", "/platform-operator/tickets"], icon: LifeBuoy },
            { title: "Support Access Requests", href: "/platform-operator/access-requests", icon: KeyRound },
          ],
        },
        {
          id: "op-integrations",
          title: "Integration Operations",
          items: [
            { title: "Integration Health", href: "/platform-operator/integration-health", icon: Plug },
            { title: "GitHub App Monitoring", href: "/platform-operator/github-monitoring", icon: GitBranch },
            { title: "Webhook Delivery Logs", href: "/platform-operator/webhook-logs", matchPaths: ["/platform-operator/webhook-logs", "/platform-operator/webhooks"], icon: Webhook },
            { title: "Failed Events & Retries", href: "/platform-operator/failed-events", icon: AlertTriangle },
            { title: "Sync Jobs & Queues", href: "/platform-operator/sync-jobs", icon: Cpu },
            { title: "API Error Monitoring", href: "/platform-operator/api-errors", icon: Radio },
          ],
        },
        {
          id: "op-communication",
          title: "Communication Operations",
          items: [
            { title: "Email Delivery & SMTP", href: "/platform-operator/email-delivery", icon: Mail },
            { title: "Email Template Drafts", href: "/platform-operator/email-drafts", icon: FileText },
            { title: "Announcement Drafts", href: "/platform-operator/announcement-drafts", icon: Megaphone },
          ],
        },
        {
          id: "op-billing",
          title: "Billing Operations",
          items: [
            { title: "Subscription Status", href: "/platform-operator/subscription-status", icon: CreditCard },
            { title: "Payment Failures", href: "/platform-operator/payment-failures", icon: Receipt },
            { title: "Invoice Delivery", href: "/platform-operator/invoice-delivery", icon: FileCheck2 },
          ],
        },
        {
          id: "op-system",
          title: "System Operations",
          items: [
            { title: "Backup Monitoring", href: "/platform-operator/backups", icon: HardDrive },
            { title: "Maintenance Operations", href: "/platform-operator/maintenance", icon: Wrench },
            { title: "Alerts & Notifications", href: "/platform-operator/alerts", icon: ShieldAlert },
          ],
        },
        {
          id: "op-account",
          title: "Account & Audit",
          items: [
            { title: "Operational Activity Logs", href: "/platform-operator/activity-logs", icon: FileText },
            { title: "Operator Settings", href: "/platform-operator/settings", icon: Settings },
          ],
        },
      ],
    },

    "role-developer": {
      id: "role-developer",
      slug: "developer",
      name: "Developer",
      systemRole: "DEVELOPER",
      dashboardUrl: `/org/${safeOrg}/developer/dashboard`,
      badgeLabel: "Full-Stack Developer",
      tier: "Engineering & QA Tier",
      description: "Assigned engineering tasks, daily check-ins, sprint execution, commit evidence, reviews, and bug fixes.",
      permissionsCount: 28,
      sections: [
        {
          id: "dev-workspace",
          title: "Workspace",
          items: [
            { title: "Developer Dashboard", href: `/org/${safeOrg}/developer/dashboard`, matchPaths: [`/org/${safeOrg}/developer`, `/org/${safeOrg}/developer/dashboard`], icon: LayoutDashboard },
            { title: "My Projects", href: `/org/${safeOrg}/developer/projects`, icon: FolderKanban },
            { title: "My Tasks", href: `/org/${safeOrg}/developer/tasks`, icon: ListTodo },
            { title: "Progress Tracker", href: `/org/${safeOrg}/developer/progress`, icon: Activity },
            { title: "My Work", href: `/org/${safeOrg}/developer/my-work`, icon: Briefcase },
          ],
        },
        {
          id: "dev-development",
          title: "Development",
          items: [
            { title: "Sprint Board", href: `/org/${safeOrg}/developer/sprints`, icon: Layers },
            { title: "GitHub Activity", href: `/org/${safeOrg}/developer/github`, icon: GitBranch },
            { title: "Code Reviews", href: `/org/${safeOrg}/developer/reviews`, icon: GitPullRequest },
            { title: "Bugs & Issues", href: `/org/${safeOrg}/developer/bugs`, icon: Bug },
          ],
        },
        {
          id: "dev-collaboration",
          title: "Collaboration & Delivery",
          items: [
            { title: "Comments & Mentions", href: `/org/${safeOrg}/developer/comments`, icon: MessageSquare },
            { title: "Evidence & Check-ins", href: `/org/${safeOrg}/developer/evidence`, icon: FileCheck2 },
            { title: "Discussions", href: `/org/${safeOrg}/developer/discussions`, icon: Inbox },
            { title: "Calendar & Deadlines", href: `/org/${safeOrg}/developer/calendar`, icon: Calendar },
            { title: "Delivery Reports", href: `/org/${safeOrg}/developer/reports`, icon: BarChart3 },
            { title: "Developer Settings", href: `/org/${safeOrg}/developer/settings`, icon: Settings },
          ],
        },
      ],
    },

    "role-viewer": {
      id: "role-viewer",
      slug: "viewer",
      name: "Viewer",
      systemRole: "VIEWER",
      dashboardUrl: `/org/${safeOrg}/viewer/dashboard`,
      badgeLabel: "Stakeholder & Auditor",
      tier: "Stakeholder & Audit Tier",
      description: "Authorized read-only visibility into projects, milestones, roadmaps, team activity, and progress reports.",
      permissionsCount: 12,
      sections: [
        {
          id: "viewer-overview",
          title: "Stakeholder Overview",
          items: [
            { title: "Viewer Dashboard", href: `/org/${safeOrg}/viewer/dashboard`, matchPaths: [`/org/${safeOrg}/viewer`, `/org/${safeOrg}/viewer/dashboard`], icon: LayoutDashboard },
            { title: "Projects Directory", href: `/org/${safeOrg}/viewer/projects`, icon: FolderKanban },
            { title: "Tasks & Deliverables", href: `/org/${safeOrg}/viewer/tasks`, icon: ListTodo },
            { title: "Milestones Roadmap", href: `/org/${safeOrg}/viewer/milestones`, icon: Layers },
            { title: "Progress & Metrics", href: `/org/${safeOrg}/viewer/progress`, icon: Activity },
            { title: "Delivery Status", href: `/org/${safeOrg}/viewer/delivery-status`, icon: CheckCircle2 },
          ],
        },
        {
          id: "viewer-insights",
          title: "Insights & Reports",
          items: [
            { title: "Team Activity Feed", href: `/org/${safeOrg}/viewer/activity`, icon: Clock },
            { title: "Delivery Calendar", href: `/org/${safeOrg}/viewer/calendar`, icon: Calendar },
            { title: "Reports & Exports", href: `/org/${safeOrg}/viewer/reports`, icon: BarChart3 },
            { title: "Shared Files", href: `/org/${safeOrg}/viewer/files`, icon: FileText },
            { title: "Team Directory", href: `/org/${safeOrg}/viewer/team`, icon: Users },
            { title: "Viewer Preferences", href: `/org/${safeOrg}/viewer/settings`, icon: Settings },
          ],
        },
      ],
    },

    "role-org-owner": {
      id: "role-org-owner",
      slug: "organization-owner",
      name: "Organization Owner",
      systemRole: "ORGANIZATION_OWNER",
      dashboardUrl: `/org/${safeOrg}/owner/dashboard`,
      badgeLabel: "Tenant Owner",
      tier: "Tenant Administration Tier",
      description: "Full tenant administration, workspaces, billing subscription, member management, and workspace settings.",
      permissionsCount: 64,
      sections: [
        {
          id: "owner-management",
          title: "Organization Management",
          items: [
            { title: "Owner Dashboard", href: `/org/${safeOrg}/owner/dashboard`, icon: LayoutDashboard },
            { title: "Workspaces", href: `/org/${safeOrg}/owner/workspaces`, icon: Building2 },
            { title: "Projects", href: `/org/${safeOrg}/owner/projects`, icon: FolderKanban },
            { title: "Members & Teams", href: `/org/${safeOrg}/owner/members`, icon: Users },
            { title: "Billing & Subscription", href: `/org/${safeOrg}/owner/billing`, icon: CreditCard },
            { title: "Organization Settings", href: `/org/${safeOrg}/owner/settings`, icon: Settings },
          ],
        },
      ],
    },

    "role-org-admin": {
      id: "role-org-admin",
      slug: "organization-admin",
      name: "Organization Admin",
      systemRole: "ORGANIZATION_ADMIN",
      dashboardUrl: `/org/${safeOrg}/admin/dashboard`,
      badgeLabel: "Workspace Administrator",
      tier: "Tenant Administration Tier",
      description: "Delegated organization administration, members, teams, invitations, integrations, access, and audit logs.",
      permissionsCount: 59,
      sections: [
        {
          id: "admin-operations",
          title: "Administration",
          items: [
            { title: "Admin Dashboard", href: `/org/${safeOrg}/admin/dashboard`, icon: LayoutDashboard },
            { title: "Members", href: `/org/${safeOrg}/admin/members`, icon: Users },
            { title: "Teams", href: `/org/${safeOrg}/admin/teams`, icon: Building2 },
            { title: "Invitations", href: `/org/${safeOrg}/admin/invitations`, icon: UserCheck },
            { title: "Access & Roles", href: `/org/${safeOrg}/admin/roles-permissions`, icon: Shield },
            { title: "Projects", href: `/org/${safeOrg}/admin/projects`, icon: FolderKanban },
            { title: "Workspace Health", href: `/org/${safeOrg}/admin/health`, icon: Activity },
            { title: "Integrations", href: `/org/${safeOrg}/admin/integrations`, icon: Plug },
            { title: "Audit Logs", href: `/org/${safeOrg}/admin/audit-logs`, icon: ShieldAlert },
            { title: "Reports", href: `/org/${safeOrg}/admin/reports`, icon: BarChart3 },
          ],
        },
      ],
    },

    "role-project-manager": {
      id: "role-project-manager",
      slug: "project-manager",
      name: "Project Manager",
      systemRole: "PROJECT_MANAGER",
      dashboardUrl: `/org/${safeOrg}/manager/dashboard`,
      badgeLabel: "Delivery Lead",
      tier: "Delivery Leadership Tier",
      description: "Assigned project delivery, roadmaps, milestones, scope modes, deadlines, task breakdowns, and progress tracking.",
      permissionsCount: 39,
      sections: [
        {
          id: "pm-delivery",
          title: "Project Delivery",
          items: [
            { title: "Manager Dashboard", href: `/org/${safeOrg}/manager/dashboard`, icon: LayoutDashboard },
            { title: "Projects", href: `/org/${safeOrg}/manager/projects`, icon: FolderKanban },
            { title: "Milestones", href: `/org/${safeOrg}/manager/milestones`, icon: Layers },
            { title: "Roadmaps", href: `/org/${safeOrg}/manager/roadmaps`, icon: Calendar },
            { title: "Tasks & Scope", href: `/org/${safeOrg}/manager/tasks`, icon: ListTodo },
            { title: "Team Allocations", href: `/org/${safeOrg}/manager/teams`, icon: Users },
            { title: "Progress Reports", href: `/org/${safeOrg}/manager/reports`, icon: BarChart3 },
            { title: "Settings", href: `/org/${safeOrg}/manager/settings`, icon: Settings },
          ],
        },
      ],
    },

    "role-team-lead": {
      id: "role-team-lead",
      slug: "team-lead",
      name: "Team Lead",
      systemRole: "TEAM_LEAD",
      dashboardUrl: `/org/${safeOrg}/lead/dashboard`,
      badgeLabel: "Sprint Coordinator",
      tier: "Delivery Leadership Tier",
      description: "Team sprint execution, workload balance, task assignments, blocker resolution, and peer review coordination.",
      permissionsCount: 32,
      sections: [
        {
          id: "lead-coordination",
          title: "Team Coordination",
          items: [
            { title: "Lead Dashboard", href: `/org/${safeOrg}/lead/dashboard`, icon: LayoutDashboard },
            { title: "My Team", href: `/org/${safeOrg}/lead/teams`, icon: Users },
            { title: "Sprint Execution", href: `/org/${safeOrg}/lead/sprints`, icon: Layers },
            { title: "Task Board", href: `/org/${safeOrg}/lead/tasks`, icon: ListTodo },
            { title: "Workload Balancing", href: `/org/${safeOrg}/lead/workload`, icon: Activity },
            { title: "Blockers & Issues", href: `/org/${safeOrg}/lead/blockers`, icon: AlertTriangle },
            { title: "Reviews Overview", href: `/org/${safeOrg}/lead/reviews`, icon: GitPullRequest },
            { title: "Sprint Reports", href: `/org/${safeOrg}/lead/reports`, icon: BarChart3 },
          ],
        },
      ],
    },

    "role-qa-reviewer": {
      id: "role-qa-reviewer",
      slug: "qa-reviewer",
      name: "QA / Reviewer",
      systemRole: "QA_REVIEWER",
      dashboardUrl: `/org/${safeOrg}/reviewer/dashboard`,
      badgeLabel: "Quality Assurance",
      tier: "Engineering & QA Tier",
      description: "Evidence verification, test checklists, peer review sign-offs, deliverable acceptance, and quality audit trails.",
      permissionsCount: 26,
      sections: [
        {
          id: "qa-verification",
          title: "Quality Verification",
          items: [
            { title: "Reviewer Dashboard", href: `/org/${safeOrg}/reviewer/dashboard`, icon: LayoutDashboard },
            { title: "Assigned Reviews", href: `/org/${safeOrg}/reviewer/assigned-reviews`, icon: GitPullRequest },
            { title: "Review Queue", href: `/org/${safeOrg}/reviewer/queue`, icon: Inbox },
            { title: "Test Checklists", href: `/org/${safeOrg}/reviewer/checklists`, icon: CheckSquare },
            { title: "Verification Evidence", href: `/org/${safeOrg}/reviewer/evidence`, icon: FileCheck2 },
            { title: "Approvals & Sign-offs", href: `/org/${safeOrg}/reviewer/approvals`, icon: CheckCircle2 },
            { title: "Review History", href: `/org/${safeOrg}/reviewer/history`, icon: Clock },
            { title: "Quality Reports", href: `/org/${safeOrg}/reviewer/reports`, icon: BarChart3 },
          ],
        },
      ],
    },
  };
}

export function resolvePreviewRole(roleIdentifier: string, orgId: string = "org-acme"): RolePreviewDefinition {
  const definitions = buildRolePreviewDefinitions(orgId);
  if (definitions[roleIdentifier]) {
    return definitions[roleIdentifier];
  }

  // Check by slug or systemRole
  for (const def of Object.values(definitions)) {
    if (
      def.slug === roleIdentifier ||
      def.systemRole === roleIdentifier ||
      roleIdentifier.toLowerCase().includes(def.slug)
    ) {
      return def;
    }
  }

  // Fallback to Super Admin
  return definitions["role-super-admin"];
}
