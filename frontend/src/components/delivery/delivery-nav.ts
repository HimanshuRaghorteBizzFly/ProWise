import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileSearch,
  FileStack,
  FolderKanban,
  FolderPlus,
  GitPullRequestArrow,
  Hourglass,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  MessageSquareText,
  Network,
  OctagonAlert,
  PieChart,
  Scale,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { SystemRole } from "@/types";

export type DeliveryRole = "manager" | "lead" | "reviewer";

export interface DeliveryNavItem {
  title: string;
  path: string; // relative to the role base, "" = dashboard
  icon: LucideIcon;
  badgeKey?: string;
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
  alertsPath: string;
}

export const DELIVERY_ROLES: Record<DeliveryRole, DeliveryRoleConfig> = {
  manager: {
    role: "manager",
    systemRole: "PROJECT_MANAGER",
    label: "Manager",
    tagline: "Project Delivery",
    segment: "manager",
    alertsPath: "risks",
    sections: [
      {
        title: "Overview",
        items: [
          { title: "Dashboard", path: "", icon: LayoutDashboard },
          { title: "Portfolio", path: "projects", icon: FolderKanban },
          { title: "Health & Risks", path: "risks", icon: ShieldAlert, badgeKey: "risks" },
          { title: "Progress", path: "progress", icon: TrendingUp },
        ],
      },
      {
        title: "Delivery",
        items: [
          { title: "Deadlines", path: "deadlines", icon: CalendarClock, badgeKey: "overdue" },
          { title: "All Work", path: "work-items", icon: ListTodo },
          { title: "Blockers", path: "blockers", icon: OctagonAlert, badgeKey: "blockers" },
          { title: "Scope Changes", path: "scope", icon: Scale, badgeKey: "scope" },
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
    tagline: "Platform Squad",
    segment: "lead",
    alertsPath: "blockers",
    sections: [
      {
        title: "Overview",
        items: [
          { title: "Dashboard", path: "", icon: LayoutDashboard },
          { title: "Today & Overdue", path: "today", icon: CalendarDays, badgeKey: "today" },
        ],
      },
      {
        title: "My Team",
        items: [
          { title: "Members", path: "team", icon: Users },
          { title: "Workload", path: "workload", icon: PieChart },
          { title: "Check-ins", path: "check-ins", icon: MessageSquareText, badgeKey: "checkins" },
        ],
      },
      {
        title: "Team Work",
        items: [
          { title: "Tasks by Status", path: "work-items", icon: ListChecks },
          { title: "Assign Work", path: "assignments", icon: UserPlus, badgeKey: "unassigned" },
          { title: "Blockers", path: "blockers", icon: OctagonAlert, badgeKey: "blockers" },
          { title: "Dependencies", path: "dependencies", icon: Network },
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
    alertsPath: "waiting",
    sections: [
      {
        title: "Overview",
        items: [
          { title: "Dashboard", path: "", icon: LayoutDashboard },
          { title: "Review Queue", path: "queue", icon: GitPullRequestArrow, badgeKey: "queue" },
          { title: "Waiting Longest", path: "waiting", icon: Hourglass, badgeKey: "waiting" },
        ],
      },
      {
        title: "Inspect",
        items: [
          { title: "Evidence", path: "evidence", icon: FileSearch, badgeKey: "evidence" },
          { title: "Outcomes", path: "approvals", icon: ClipboardCheck },
        ],
      },
      {
        title: "Records",
        items: [{ title: "Review History", path: "history", icon: FileStack }],
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
