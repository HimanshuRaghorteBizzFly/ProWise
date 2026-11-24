import {
  Activity,
  Bell,
  Building2,
  CalendarDays,
  Tags,
  FileBarChart,
  FolderKanban,
  GitBranch,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Lock,
  Mail,
  ShieldCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import type { OrgFamily } from "./role-rules";

export interface OrgShellItem {
  title: string;
  path: string;
  icon: LucideIcon;
  badgeKey?: "invites" | "repos" | "notifications" | "risks" | "attention";
}

export interface OrgShellSection {
  title: string;
  items: OrgShellItem[];
}

export const ORG_SHELL: Record<OrgFamily, { label: string; tagline: string; sections: OrgShellSection[]; alertsPath: string }> = {
  owner: {
    label: "Owner",
    tagline: "Organization Console",
    alertsPath: "notifications",
    sections: [
      {
        title: "Overview",
        items: [
          { title: "Dashboard", path: "dashboard", icon: LayoutDashboard },
          { title: "Health & Risks", path: "health", icon: HeartPulse, badgeKey: "risks" },
          { title: "Projects Portfolio", path: "projects", icon: FolderKanban },
        ],
      },
      {
        title: "People & Access",
        items: [
          { title: "Members", path: "members", icon: Users },
          { title: "Invitations", path: "invitations", icon: Mail, badgeKey: "invites" },
          { title: "Teams", path: "teams", icon: UsersRound },
          { title: "Roles & Permissions", path: "roles-permissions", icon: ShieldCheck },
        ],
      },
      {
        title: "Workspace",
        items: [
          { title: "Integrations (GitHub)", path: "integrations", icon: GitBranch, badgeKey: "repos" },
          { title: "Reports", path: "reports", icon: FileBarChart },
          { title: "Audit & Security", path: "audit-logs", icon: Activity },
          { title: "Notifications", path: "notifications", icon: Bell, badgeKey: "notifications" },
        ],
      },
      {
        title: "Organization",
        items: [
          { title: "Organization Settings", path: "organization", icon: Building2 },
          { title: "Work Calendar", path: "work-calendar", icon: CalendarDays },
          { title: "Work Types", path: "work-types", icon: Tags },
          { title: "Data & Privacy", path: "privacy", icon: Lock },
          { title: "Transfer Ownership", path: "transfer-ownership", icon: KeyRound },
        ],
      },
    ],
  },
  admin: {
    label: "Admin",
    tagline: "Company Platform",
    alertsPath: "members",
    sections: [
      { title: "Overview", items: [{ title: "Dashboard", path: "dashboard", icon: LayoutDashboard }] },
      {
        title: "People",
        items: [
          { title: "Members", path: "members", icon: Users, badgeKey: "attention" },
          { title: "Invitations", path: "invitations", icon: Mail, badgeKey: "invites" },
          { title: "Teams", path: "teams", icon: UsersRound },
          { title: "Roles & Permissions", path: "roles-permissions", icon: ShieldCheck },
        ],
      },
      {
        title: "Platform",
        items: [
          { title: "Integrations & Sync", path: "integrations", icon: GitBranch, badgeKey: "repos" },
          { title: "Projects Overview", path: "projects", icon: FolderKanban },
          { title: "Work Calendar", path: "work-calendar", icon: CalendarDays },
          { title: "Work Types", path: "work-types", icon: Tags },
        ],
      },
      {
        title: "Insight",
        items: [
          { title: "Reports", path: "reports", icon: FileBarChart },
          { title: "Audit Activity", path: "audit-logs", icon: Activity },
        ],
      },
    ],
  },
};

export function orgPath(family: OrgFamily, orgId: string, path = "dashboard") {
  return `/org/${orgId}/${family}${path ? `/${path}` : ""}`;
}
