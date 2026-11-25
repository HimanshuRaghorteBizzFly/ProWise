import {
  FolderKanban,
  FolderPlus,
  LayoutDashboard,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";
import type { SystemRole } from "@/types";

export type DeliveryRole = "manager" | "lead" | "reviewer";

export interface DeliveryNavItem {
  title: string;
  path: string; // relative to the role base, "" = dashboard
  icon: LucideIcon;
}

export interface DeliveryNavSection {
  title: string;
  items: DeliveryNavItem[];
}

export interface DeliveryRoleConfig {
  role: DeliveryRole;
  systemRole: SystemRole;
  label: string;
  tagline: string;
  segment: string;
  sections: DeliveryNavSection[];
}

/**
 * Only destinations backed by the real API are listed. Modules without a backend API yet (risks, deadlines,
 * workload, scope, reports, review queue, evidence...) are hidden and their routes show a "not available" notice.
 */
export const DELIVERY_ROLES: Record<DeliveryRole, DeliveryRoleConfig> = {
  manager: {
    role: "manager",
    systemRole: "PROJECT_MANAGER",
    label: "Manager",
    tagline: "Project Delivery",
    segment: "manager",
    sections: [
      {
        title: "Overview",
        items: [
          { title: "Dashboard", path: "", icon: LayoutDashboard },
          { title: "Portfolio", path: "projects", icon: FolderKanban },
        ],
      },
      {
        title: "Plan",
        items: [{ title: "Create Project", path: "create-project", icon: FolderPlus }],
      },
    ],
  },
  lead: {
    role: "lead",
    systemRole: "TEAM_LEAD",
    label: "Lead",
    tagline: "Team Delivery",
    segment: "lead",
    sections: [
      {
        title: "Overview",
        items: [
          { title: "Dashboard", path: "", icon: LayoutDashboard },
          { title: "Check-ins", path: "check-ins", icon: MessageSquareText },
        ],
      },
    ],
  },
  reviewer: {
    role: "reviewer",
    systemRole: "QA_REVIEWER",
    label: "QA",
    tagline: "Quality Review",
    segment: "reviewer",
    sections: [
      {
        title: "Overview",
        items: [{ title: "Dashboard", path: "", icon: LayoutDashboard }],
      },
    ],
  },
};

export function roleBase(role: DeliveryRole, orgId: string) {
  return `/org/${orgId}/${DELIVERY_ROLES[role].segment}`;
}

export function rolePath(role: DeliveryRole, orgId: string, path = "") {
  const base = roleBase(role, orgId);
  return path ? `${base}/${path}` : base;
}
