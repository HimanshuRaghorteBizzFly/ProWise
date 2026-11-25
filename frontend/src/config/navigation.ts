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
import type { PermissionKey } from "@/types/permission";

export interface NavItem {
  title: string;
  href: string;
  icon: any;
  badge?: string;
  requiredPermission?: PermissionKey;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export function getNavigationConfig(
  role: SystemRole,
  orgId: string = "",
  can?: (key: PermissionKey) => boolean,
): NavSection[] {
  switch (role) {
    case "SUPER_ADMIN":
      // Only modules with a live backend API are listed; the rest show "not available yet" if opened directly.
      return [
        {
          items: [
            { title: "Dashboard", href: "/super-admin/dashboard", icon: LayoutDashboard },
            { title: "Users", href: "/super-admin/users", icon: Users },
          ],
        },
        {
          title: "Communications",
          items: [{ title: "Email Settings", href: "/super-admin/email-settings", icon: Mail }],
        },
        {
          title: "Security",
          items: [{ title: "Security Keys", href: "/super-admin/security-keys", icon: Shield }],
        },
      ];
    case "PLATFORM_OPERATOR":
      return [
        {
          items: [
            { title: "Dashboard", href: "/platform-operator/dashboard", icon: LayoutDashboard },
            { title: "Email Delivery", href: "/platform-operator/email-delivery", icon: Mail },
          ],
        },
      ];
    case "ORGANIZATION_OWNER":
      return [
        {
          items: [
            { title: "Dashboard", href: `/org/${orgId}/owner`, icon: LayoutDashboard },
            { title: "Members", href: `/org/${orgId}/owner/members`, icon: Users },
            { title: "Teams", href: `/org/${orgId}/owner/teams`, icon: Users },
            { title: "Invitations", href: `/org/${orgId}/owner/invitations`, icon: Mail },
            { title: "Roles & Permissions", href: `/org/${orgId}/owner/roles-permissions`, icon: Shield },
          ],
        },
        {
          title: "Portfolio & Governance",
          items: [{ title: "Projects", href: `/org/${orgId}/owner/projects`, icon: FolderKanban }],
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
          title: "Engineering",
          items: [{ title: "Projects", href: `/org/${orgId}/admin/projects`, icon: FolderKanban }],
        },
      ];
    case "PROJECT_MANAGER": {
      const managerSections: NavSection[] = [
        {
          title: "Project Delivery",
          items: [
            { title: "PM Dashboard", href: `/org/${orgId}/manager`, icon: LayoutDashboard, requiredPermission: "project.read" },
            { title: "Projects", href: `/org/${orgId}/manager/projects`, icon: FolderKanban, requiredPermission: "project.read" },
            { title: "Create & plan", href: `/org/${orgId}/manager/create-project`, icon: Sparkles, requiredPermission: "project.create" },
          ],
        },
      ];
      return can
        ? managerSections
            .map((section) => ({
              ...section,
              items: section.items.filter((item) => item.requiredPermission && can(item.requiredPermission)),
            }))
            .filter((section) => section.items.length > 0)
        : managerSections;
    }

    case "TEAM_LEAD":
      return [
        {
          items: [
            { title: "Dashboard", href: `/org/${orgId}/lead/dashboard`, icon: LayoutDashboard },
            { title: "Check-ins", href: `/org/${orgId}/lead/check-ins`, icon: FileCheck },
          ],
        },
      ];
    case "DEVELOPER":
      return [
        {
          title: "Workspace",
          items: [
            { title: "Dashboard", href: `/org/${orgId}/developer/dashboard`, icon: LayoutDashboard },
            { title: "My Projects", href: `/org/${orgId}/developer/projects`, icon: FolderKanban },
            { title: "My Work", href: `/org/${orgId}/developer/tasks`, icon: CheckSquare },
            { title: "Approvals", href: `/org/${orgId}/developer/approvals`, icon: Layers },
            { title: "Progress Tracker", href: `/org/${orgId}/developer/progress`, icon: Activity },
          ],
        },
        {
          title: "Development",
          items: [
            { title: "Sprint Board", href: `/org/${orgId}/developer/sprints`, icon: FolderKanban },
            { title: "GitHub Activity", href: `/org/${orgId}/developer/github`, icon: GitBranch },
            { title: "Code Reviews", href: `/org/${orgId}/developer/reviews`, icon: GitPullRequest },
            { title: "Bugs & Issues", href: `/org/${orgId}/developer/bugs`, icon: AlertTriangle },
          ],
        },
        {
          title: "Collaboration",
          items: [
            { title: "Calendar & Deadlines", href: `/org/${orgId}/developer/calendar`, icon: Calendar },
            { title: "Team Collaboration", href: `/org/${orgId}/developer/discussions`, icon: Users },
            { title: "Files & Documents", href: `/org/${orgId}/developer/files`, icon: FileText },
          ],
        },
        {
          title: "Personal",
          items: [
            { title: "Notifications", href: `/org/${orgId}/developer/notifications`, icon: Bell },
            { title: "My Reports", href: `/org/${orgId}/developer/reports`, icon: BarChart3 },
            { title: "Settings", href: `/org/${orgId}/developer/settings`, icon: Settings },
          ],
        },
      ];

    case "QA_REVIEWER":
      return [
        {
          items: [{ title: "Dashboard", href: `/org/${orgId}/reviewer/dashboard`, icon: LayoutDashboard }],
        },
      ];

    case "VIEWER":
      return [
        {
          items: [
            { title: "Dashboard", href: `/org/${orgId}/viewer/dashboard`, icon: LayoutDashboard },
            { title: "Projects", href: `/org/${orgId}/viewer/projects`, icon: FolderKanban },
            { title: "Progress", href: `/org/${orgId}/viewer/progress`, icon: Activity },
            { title: "Approvals", href: `/org/${orgId}/viewer/approvals`, icon: Layers },
          ],
        },
        // Tasks, reports, calendar, team, files, activity, notifications and settings have no Viewer API yet: hidden.
      ];

    default:
      return [];
  }
}

