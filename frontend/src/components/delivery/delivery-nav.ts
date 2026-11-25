import {
  Activity,
  BarChart3,
  CalendarClock,
  ListTodo,
  OctagonAlert,
  Scale,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
  ShieldCheck,
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
    // The Project Manager navigation as it was before the merge (your branch), plus Reviews: submitted work comes
    // to the project's PM to accept or reject. Pages without a backend API yet show a "not available" notice.
    sections: [
      {
        title: "Overview",
        items: [
          { title: "Dashboard", path: "", icon: LayoutDashboard },
          { title: "Portfolio", path: "projects", icon: FolderKanban },
          { title: "Health & Risks", path: "risks", icon: ShieldAlert },
          { title: "Progress", path: "progress", icon: TrendingUp },
        ],
      },
      {
        title: "Delivery",
        items: [
          { title: "Reviews", path: "reviews", icon: ShieldCheck },
          { title: "Deadlines", path: "deadlines", icon: CalendarClock },
          { title: "All Work", path: "work-items", icon: ListTodo },
          { title: "Blockers", path: "blockers", icon: OctagonAlert },
          { title: "Scope Changes", path: "scope", icon: Scale },
        ],
      },
      {
        title: "People",
        items: [
          { title: "Team Workload", path: "workload", icon: Users },
          { title: "Assign Work", path: "team-assignments", icon: UserPlus },
        ],
      },
      {
        title: "Plan & Report",
        items: [
          { title: "Create Project", path: "create-project", icon: FolderPlus },
          { title: "Reports", path: "reports", icon: BarChart3 },
        ],
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
          { title: "Reviews", path: "reviews", icon: ShieldCheck },
          { title: "Progress", path: "progress", icon: Activity },
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
        items: [
          { title: "Dashboard", path: "", icon: LayoutDashboard },
          { title: "Review queue", path: "review-queue", icon: ShieldCheck },
          { title: "Progress", path: "progress", icon: Activity },
        ],
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
