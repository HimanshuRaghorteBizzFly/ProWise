import {
<<<<<<< HEAD
  Activity,
  Bell,
  Building2,
  CalendarDays,
  Tags,
  FileBarChart,
=======
>>>>>>> 29db595 (Initial ProWise project upload)
  FolderKanban,
  KeyRound,
  LayoutDashboard,
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
}

export interface OrgShellSection {
  title: string;
  items: OrgShellItem[];
}

export const ORG_SHELL: Record<OrgFamily, { label: string; tagline: string; sections: OrgShellSection[] }> = {
  owner: {
    label: "Owner",
    tagline: "Organization Console",
    sections: [
      {
        title: "Overview",
        items: [
          { title: "Dashboard", path: "dashboard", icon: LayoutDashboard },
          { title: "Projects Portfolio", path: "projects", icon: FolderKanban },
        ],
      },
      {
        title: "People & Access",
        items: [
          { title: "Members", path: "members", icon: Users },
          { title: "Invitations", path: "invitations", icon: Mail },
          { title: "Teams", path: "teams", icon: UsersRound },
          { title: "Roles & Permissions", path: "roles-permissions", icon: ShieldCheck },
        ],
      },
      {
        title: "Organization",
        items: [
<<<<<<< HEAD
          { title: "Organization Settings", path: "organization", icon: Building2 },
          { title: "Work Calendar", path: "work-calendar", icon: CalendarDays },
          { title: "Work Types", path: "work-types", icon: Tags },
          { title: "Data & Privacy", path: "privacy", icon: Lock },
=======
>>>>>>> 29db595 (Initial ProWise project upload)
          { title: "Transfer Ownership", path: "transfer-ownership", icon: KeyRound },
        ],
      },
    ],
  },
  admin: {
    label: "Admin",
    tagline: "Company Platform",
    sections: [
      { title: "Overview", items: [{ title: "Dashboard", path: "dashboard", icon: LayoutDashboard }] },
      {
        title: "People",
        items: [
          { title: "Members", path: "members", icon: Users },
          { title: "Invitations", path: "invitations", icon: Mail },
          { title: "Teams", path: "teams", icon: UsersRound },
          { title: "Roles & Permissions", path: "roles-permissions", icon: ShieldCheck },
        ],
      },
      {
        title: "Platform",
<<<<<<< HEAD
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
=======
        items: [{ title: "Projects Overview", path: "projects", icon: FolderKanban }],
>>>>>>> 29db595 (Initial ProWise project upload)
      },
    ],
  },
};

export function orgPath(family: OrgFamily, orgId: string, path = "dashboard") {
  return `/org/${orgId}/${family}${path ? `/${path}` : ""}`;
}
