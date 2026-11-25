import {
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
        items: [{ title: "Projects Overview", path: "projects", icon: FolderKanban }],
      },
    ],
  },
};

export function orgPath(family: OrgFamily, orgId: string, path = "dashboard") {
  return `/org/${orgId}/${family}${path ? `/${path}` : ""}`;
}
