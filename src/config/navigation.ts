import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  CreditCard,
  Mail,
  Bell,
  GitBranch,
  Webhook,
  Activity,
  AlertTriangle,
  FileText,
  Settings,
  HelpCircle,
  FolderKanban,
  CheckSquare,
  Clock,
  GitPullRequest,
  Eye,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  BarChart3,
  Server,
  FileCheck,
  Briefcase,
} from "lucide-react";
import { SystemRole } from "@/types";

export interface NavItem {
  title: string;
  href: string;
  icon: any;
  badge?: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export function getNavigationConfig(role: SystemRole, orgId: string = "org-1"): NavSection[] {
  switch (role) {
    case "SUPER_ADMIN":
      return [
        {
          items: [
            { title: "Dashboard", href: "/super-admin/dashboard", icon: LayoutDashboard },
            { title: "Organizations", href: "/super-admin/organizations", icon: Building2 },
            { title: "Platform Operators", href: "/super-admin/operators", icon: Users },
            { title: "Roles & Permissions", href: "/super-admin/roles-permissions", icon: Shield },
          ],
        },
        {
          title: "Billing & Plans",
          items: [
            { title: "Plans", href: "/super-admin/plans", icon: Layers },
            { title: "Subscriptions", href: "/super-admin/subscriptions", icon: CreditCard },
            { title: "Payments", href: "/super-admin/payments", icon: CreditCard },
            { title: "Invoices", href: "/super-admin/invoices", icon: FileText },
          ],
        },
        {
          title: "Communications",
          items: [
            { title: "Email Settings", href: "/super-admin/email-settings", icon: Mail },
            { title: "Email Templates", href: "/super-admin/email-templates", icon: Mail },
            { title: "Announcements", href: "/super-admin/announcements", icon: Bell },
          ],
        },
        {
          title: "Operations & Security",
          items: [
            { title: "Integrations", href: "/super-admin/integrations", icon: Webhook },
            { title: "GitHub Integrations", href: "/super-admin/github-integrations", icon: GitBranch },
            { title: "Webhooks", href: "/super-admin/webhooks", icon: Webhook },
            { title: "API Monitoring", href: "/super-admin/api-monitoring", icon: Activity },
            { title: "Security & MFA", href: "/super-admin/security", icon: Shield },
            { title: "Access Approvals", href: "/super-admin/access-approvals", icon: CheckCircle2 },
            { title: "Incidents", href: "/super-admin/incidents", icon: AlertTriangle },
            { title: "Audit Logs", href: "/super-admin/audit", icon: FileText },
            { title: "System Reports", href: "/super-admin/reports", icon: BarChart3 },
            { title: "Configuration", href: "/super-admin/configuration", icon: Settings },
            { title: "Support", href: "/super-admin/support", icon: HelpCircle },
          ],
        },
      ];

    case "PLATFORM_OPERATOR":
      return [
        {
          items: [
            { title: "Dashboard", href: "/platform-operator/dashboard", icon: LayoutDashboard },
            { title: "Org Status", href: "/platform-operator/organization-status", icon: Building2 },
            { title: "Infrastructure Monitoring", href: "/platform-operator/monitoring", icon: Activity },
            { title: "Incidents", href: "/platform-operator/incidents", icon: AlertTriangle },
            { title: "Support Tickets", href: "/platform-operator/support-tickets", icon: HelpCircle },
            { title: "Access Requests", href: "/platform-operator/access-requests", icon: Shield },
          ],
        },
        {
          title: "Integrations & Jobs",
          items: [
            { title: "Integration Health", href: "/platform-operator/integration-health", icon: Activity },
            { title: "GitHub Monitoring", href: "/platform-operator/github-monitoring", icon: GitBranch },
            { title: "Webhook Logs", href: "/platform-operator/webhook-logs", icon: Webhook },
            { title: "Failed Events", href: "/platform-operator/failed-events", icon: AlertTriangle },
            { title: "Sync Jobs", href: "/platform-operator/sync-jobs", icon: Server },
            { title: "API Errors", href: "/platform-operator/api-errors", icon: Activity },
          ],
        },
        {
          title: "Communications & Billing",
          items: [
            { title: "Email Delivery", href: "/platform-operator/email-delivery", icon: Mail },
            { title: "Email Drafts", href: "/platform-operator/email-drafts", icon: Mail },
            { title: "Announcement Drafts", href: "/platform-operator/announcement-drafts", icon: Bell },
            { title: "Subscription Status", href: "/platform-operator/subscription-status", icon: CreditCard },
            { title: "Payment Failures", href: "/platform-operator/payment-failures", icon: AlertTriangle },
            { title: "Invoice Delivery", href: "/platform-operator/invoice-delivery", icon: FileText },
          ],
        },
        {
          title: "Maintenance & Logs",
          items: [
            { title: "Backups", href: "/platform-operator/backups", icon: Server },
            { title: "Maintenance", href: "/platform-operator/maintenance", icon: Settings },
            { title: "Alerts", href: "/platform-operator/alerts", icon: Bell },
            { title: "Activity Logs", href: "/platform-operator/activity-logs", icon: FileText },
            { title: "Settings", href: "/platform-operator/settings", icon: Settings },
          ],
        },
      ];

    case "ORGANIZATION_OWNER":
      return [
        {
          items: [
            { title: "Dashboard", href: `/org/${orgId}/owner/dashboard`, icon: LayoutDashboard },
            { title: "Organization Profile", href: `/org/${orgId}/owner/organization`, icon: Building2 },
            { title: "Workspaces", href: `/org/${orgId}/owner/workspaces`, icon: Layers },
            { title: "Members", href: `/org/${orgId}/owner/members`, icon: Users },
            { title: "Teams", href: `/org/${orgId}/owner/teams`, icon: Users },
            { title: "Invitations", href: `/org/${orgId}/owner/invitations`, icon: Mail },
            { title: "Roles & Permissions", href: `/org/${orgId}/owner/roles-permissions`, icon: Shield },
          ],
        },
        {
          title: "Portfolio & Finance",
          items: [
            { title: "Projects", href: `/org/${orgId}/owner/projects`, icon: FolderKanban },
            { title: "Subscriptions", href: `/org/${orgId}/owner/subscriptions`, icon: CreditCard },
            { title: "Billing & Invoices", href: `/org/${orgId}/owner/billing`, icon: FileText },
            { title: "Integrations", href: `/org/${orgId}/owner/integrations`, icon: Webhook },
            { title: "Reports & KPIs", href: `/org/${orgId}/owner/reports`, icon: BarChart3 },
            { title: "Audit Logs", href: `/org/${orgId}/owner/audit-logs`, icon: FileText },
            { title: "Org Settings", href: `/org/${orgId}/owner/settings`, icon: Settings },
          ],
        },
      ];

    case "ORGANIZATION_ADMIN":
      return [
        {
          items: [
            { title: "Dashboard", href: `/org/${orgId}/admin/dashboard`, icon: LayoutDashboard },
            { title: "Members", href: `/org/${orgId}/admin/members`, icon: Users },
            { title: "Teams", href: `/org/${orgId}/admin/teams`, icon: Users },
            { title: "Invitations", href: `/org/${orgId}/admin/invitations`, icon: Mail },
            { title: "Roles & Permissions", href: `/org/${orgId}/admin/roles-permissions`, icon: Shield },
          ],
        },
        {
          title: "Engineering & Repos",
          items: [
            { title: "Projects", href: `/org/${orgId}/admin/projects`, icon: FolderKanban },
            { title: "Repositories", href: `/org/${orgId}/admin/repositories`, icon: GitBranch },
            { title: "Integrations", href: `/org/${orgId}/admin/integrations`, icon: Webhook },
            { title: "Activity", href: `/org/${orgId}/admin/activity`, icon: Activity },
            { title: "Reports", href: `/org/${orgId}/admin/reports`, icon: BarChart3 },
            { title: "Settings", href: `/org/${orgId}/admin/settings`, icon: Settings },
          ],
        },
      ];

    case "PROJECT_MANAGER":
      return [
        {
          items: [
            { title: "Dashboard", href: `/org/${orgId}/manager/dashboard`, icon: LayoutDashboard },
            { title: "Projects", href: `/org/${orgId}/manager/projects`, icon: FolderKanban },
            { title: "Create Project", href: `/org/${orgId}/manager/create-project`, icon: Sparkles },
            { title: "Project Planning", href: `/org/${orgId}/manager/project-planning`, icon: Calendar },
            { title: "Work Items", href: `/org/${orgId}/manager/work-items`, icon: CheckSquare },
            { title: "Team Assignments", href: `/org/${orgId}/manager/team-assignments`, icon: Users },
          ],
        },
        {
          title: "Delivery & Tracking",
          items: [
            { title: "Progress & Baseline", href: `/org/${orgId}/manager/progress`, icon: Activity },
            { title: "Deadlines & Cadence", href: `/org/${orgId}/manager/deadlines`, icon: Clock },
            { title: "Dependencies", href: `/org/${orgId}/manager/dependencies`, icon: Layers },
            { title: "Review Oversight", href: `/org/${orgId}/manager/reviews`, icon: FileCheck },
            { title: "Delivery Approvals", href: `/org/${orgId}/manager/delivery`, icon: CheckCircle2 },
            { title: "Reports & Analytics", href: `/org/${orgId}/manager/reports`, icon: BarChart3 },
            { title: "Settings", href: `/org/${orgId}/manager/settings`, icon: Settings },
          ],
        },
      ];

    case "TEAM_LEAD":
      return [
        {
          items: [
            { title: "Dashboard", href: `/org/${orgId}/lead/dashboard`, icon: LayoutDashboard },
            { title: "My Team", href: `/org/${orgId}/lead/my-team`, icon: Users },
            { title: "Projects", href: `/org/${orgId}/lead/projects`, icon: FolderKanban },
            { title: "Work Items", href: `/org/${orgId}/lead/work-items`, icon: CheckSquare },
            { title: "Assignments", href: `/org/${orgId}/lead/assignments`, icon: Users },
            { title: "Sprint Planning", href: `/org/${orgId}/lead/sprint-planning`, icon: Calendar },
          ],
        },
        {
          title: "Execution & Flow",
          items: [
            { title: "Progress", href: `/org/${orgId}/lead/progress`, icon: Activity },
            { title: "Blockers & Risks", href: `/org/${orgId}/lead/blockers`, icon: AlertTriangle },
            { title: "Peer Reviews", href: `/org/${orgId}/lead/reviews`, icon: FileCheck },
            { title: "Workload Balance", href: `/org/${orgId}/lead/workload`, icon: Briefcase },
            { title: "Team Activity", href: `/org/${orgId}/lead/activity`, icon: Activity },
            { title: "Reports", href: `/org/${orgId}/lead/reports`, icon: BarChart3 },
          ],
        },
      ];

    case "DEVELOPER":
      return [
        {
          items: [
            { title: "Dashboard", href: `/org/${orgId}/developer/dashboard`, icon: LayoutDashboard },
            { title: "My Work", href: `/org/${orgId}/developer/my-work`, icon: CheckSquare },
            { title: "Assigned Projects", href: `/org/${orgId}/developer/projects`, icon: FolderKanban },
            { title: "Tasks & Work Items", href: `/org/${orgId}/developer/tasks`, icon: Layers },
            { title: "Check-Ins", href: `/org/${orgId}/developer/check-ins`, icon: Clock },
            { title: "Progress Tracker", href: `/org/${orgId}/developer/progress`, icon: Activity },
          ],
        },
        {
          title: "Artifacts & Evidence",
          items: [
            { title: "Repositories", href: `/org/${orgId}/developer/repositories`, icon: GitBranch },
            { title: "Evidence & PRs", href: `/org/${orgId}/developer/evidence`, icon: FileText },
            { title: "My Blockers", href: `/org/${orgId}/developer/blockers`, icon: AlertTriangle },
            { title: "Comments", href: `/org/${orgId}/developer/comments`, icon: Mail },
            { title: "Notifications", href: `/org/${orgId}/developer/notifications`, icon: Bell },
            { title: "Settings", href: `/org/${orgId}/developer/settings`, icon: Settings },
          ],
        },
      ];

    case "QA_REVIEWER":
      return [
        {
          items: [
            { title: "Dashboard", href: `/org/${orgId}/reviewer/dashboard`, icon: LayoutDashboard },
            { title: "Review Queue", href: `/org/${orgId}/reviewer/review-queue`, icon: CheckSquare },
            { title: "Assigned Reviews", href: `/org/${orgId}/reviewer/assigned-reviews`, icon: FileCheck },
            { title: "Work Items", href: `/org/${orgId}/reviewer/work-items`, icon: Layers },
            { title: "Test Checklists", href: `/org/${orgId}/reviewer/test-checklists`, icon: CheckCircle2 },
          ],
        },
        {
          title: "Verification & Audit",
          items: [
            { title: "Evidence Review", href: `/org/${orgId}/reviewer/evidence`, icon: FileText },
            { title: "Approvals", href: `/org/${orgId}/reviewer/approvals`, icon: CheckCircle2 },
            { title: "Rejected Work", href: `/org/${orgId}/reviewer/rejected-work`, icon: AlertTriangle },
            { title: "Review History", href: `/org/${orgId}/reviewer/review-history`, icon: Clock },
            { title: "QA Reports", href: `/org/${orgId}/reviewer/reports`, icon: BarChart3 },
            { title: "Settings", href: `/org/${orgId}/reviewer/settings`, icon: Settings },
          ],
        },
      ];

    case "VIEWER":
      return [
        {
          items: [
            { title: "Dashboard", href: `/org/${orgId}/viewer/dashboard`, icon: LayoutDashboard },
            { title: "Projects", href: `/org/${orgId}/viewer/projects`, icon: FolderKanban },
            { title: "Progress", href: `/org/${orgId}/viewer/progress`, icon: Activity },
            { title: "Milestones", href: `/org/${orgId}/viewer/milestones`, icon: CheckSquare },
            { title: "Delivery Status", href: `/org/${orgId}/viewer/delivery-status`, icon: CheckCircle2 },
          ],
        },
        {
          title: "Insights & Activity",
          items: [
            { title: "Reports", href: `/org/${orgId}/viewer/reports`, icon: BarChart3 },
            { title: "Activity", href: `/org/${orgId}/viewer/activity`, icon: Activity },
            { title: "Notifications", href: `/org/${orgId}/viewer/notifications`, icon: Bell },
            { title: "Settings", href: `/org/${orgId}/viewer/settings`, icon: Settings },
          ],
        },
      ];

    default:
      return [];
  }
}

