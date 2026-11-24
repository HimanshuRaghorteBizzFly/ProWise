import {
  FolderGit2,
  LayoutDashboard,
  Mail,
  ShieldCheck,
  Users,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

import type { PermissionKey } from "@/types/permission";

/**
 * Sidebar menu for the Owner and Admin route families. The family (route prefix) follows the
 * membership's role template; every item is shown only if the membership holds one of
 * `requiredAny`. Items are added here as their pages are built (later batches).
 */
export type OrgNavFamily = "owner" | "admin";

export interface OrgNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  requiredAny?: readonly PermissionKey[];
}

export interface OrgNavGroup {
  title: string;
  items: OrgNavItem[];
}

const MEMBER_KEYS: readonly PermissionKey[] = ["member.invite", "member.disable", "role.manage"];

export function buildOrgNav(family: OrgNavFamily, orgId: string): OrgNavGroup[] {
  const base = `/org/${orgId}/${family}`;
  // Health, reports, integrations, notifications, audit, privacy and organization settings have no API yet: hidden.
  return [
    {
      title: "Overview",
      // Access Map was removed; Roles & permissions (People group) replaces it.
      items: [{ label: "Dashboard", href: `${base}/dashboard`, icon: LayoutDashboard }],
    },
    {
      title: "People",
      items: [
        { label: "Members", href: `${base}/members`, icon: Users, requiredAny: MEMBER_KEYS },
        { label: "Invitations", href: `${base}/invitations`, icon: Mail, requiredAny: ["member.invite"] },
        { label: "Teams", href: `${base}/teams`, icon: UsersRound, requiredAny: ["team.manage"] },
        { label: "Roles & permissions", href: `${base}/roles-permissions`, icon: ShieldCheck, requiredAny: ["role.manage"] },
      ],
    },
    {
      title: "Delivery",
      items: [
        { label: "Projects portfolio", href: `${base}/projects`, icon: FolderGit2, requiredAny: ["project.read"] },
      ],
    },
  ];
}

/** Keeps items the membership may open; drops groups left empty. */
export function filterOrgNav(
  groups: readonly OrgNavGroup[],
  canAny: (keys: readonly PermissionKey[]) => boolean,
): OrgNavGroup[] {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.requiredAny || canAny(item.requiredAny)),
    }))
    .filter((group) => group.items.length > 0);
}

/** The Admin route family opens for memberships holding any of these (never org.manage). */
export const ADMIN_GATE_KEYS: readonly PermissionKey[] = ["member.invite", "member.disable", "role.manage", "team.manage"];

export const FAMILY_LABEL: Record<OrgNavFamily, string> = { owner: "Owner", admin: "Admin" };
