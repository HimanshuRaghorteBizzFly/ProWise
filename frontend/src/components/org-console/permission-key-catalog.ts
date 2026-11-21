import type { PermissionKey } from "@/types/permission";

/** The 22 permission keys from docs/permissions.md, grouped for the role editor. Labels are UI copy only. */
export interface KeyInfo {
  key: PermissionKey;
  label: string;
  description: string;
}

export interface KeyGroup {
  title: string;
  description: string;
  keys: KeyInfo[];
}

export const KEY_GROUPS: KeyGroup[] = [
  {
    title: "Organization & people",
    description: "Workspace policy, members, teams and roles",
    keys: [
      { key: "org.manage", label: "Manage organization", description: "Settings, policy and integrations approval." },
      { key: "member.invite", label: "Invite members", description: "Send and revoke invitations." },
      { key: "member.disable", label: "Disable members", description: "Suspend or re-enable a member." },
      { key: "role.manage", label: "Manage roles", description: "Create custom roles and grant or revoke roles." },
      { key: "team.manage", label: "Manage teams", description: "Create teams and set leads and members." },
    ],
  },
  {
    title: "Projects & scope",
    description: "Create, plan, change and archive projects",
    keys: [
      { key: "project.create", label: "Create projects", description: "Start projects in scope." },
      { key: "project.read", label: "View projects", description: "See permitted project status and progress." },
      { key: "project.edit", label: "Edit projects", description: "Change plans and details." },
      { key: "project.archive", label: "Archive projects", description: "Close and archive projects." },
      { key: "project.mode.change", label: "Change delivery mode", description: "Switch Individual / Structured." },
      { key: "project.scope.change", label: "Approve scope changes", description: "Approve scope versions." },
      { key: "project.deadline.edit", label: "Edit deadlines", description: "Change dates with a reason." },
    ],
  },
  {
    title: "Work & progress",
    description: "Tasks, reviews and progress reporting",
    keys: [
      { key: "project.progress.report", label: "Report progress", description: "Accountable developer, Individual mode." },
      { key: "project.progress.verify", label: "Approve check-ins", description: "Lead of the project's team; never own entries." },
      { key: "project.progress.override", label: "Override progress", description: "Separate correction entry." },
      { key: "task.create", label: "Create tasks", description: "Add work items." },
      { key: "task.assign", label: "Assign work", description: "Assign and reassign tasks." },
      { key: "task.update", label: "Update work", description: "Edit assigned work." },
      { key: "task.review", label: "Review work", description: "Approve or request changes with a reason." },
    ],
  },
  {
    title: "Repositories, reports & audit",
    description: "Private resources",
    keys: [
      { key: "repo.connect", label: "Connect repositories", description: "Link GitHub repositories." },
      { key: "repo.read", label: "View repositories", description: "Repository evidence (never sets progress)." },
      { key: "report.export", label: "Export reports", description: "Download CSV exports." },
      { key: "audit.read", label: "Read audit log", description: "Who changed what, and when." },
    ],
  },
];

export const KEY_LABEL: Record<string, string> = Object.fromEntries(
  KEY_GROUPS.flatMap((group) => group.keys.map((info) => [info.key, info.label])),
);

/** Denied to every role by docs/permission-matrix.md. */
export const MATRIX_DENIED_KEYS: readonly string[] = ["project.progress.override"];

export const TEMPLATE_LABEL: Record<string, string> = {
  ORGANIZATION_OWNER: "Organization Owner",
  ORGANIZATION_ADMIN: "Organization Admin",
  PROJECT_MANAGER: "Project Manager",
  TEAM_LEAD: "Team Lead",
  DEVELOPER: "Developer",
  QA_REVIEWER: "QA / Reviewer",
  VIEWER: "Viewer / Stakeholder",
};

export function roleDisplayName(name: string): string {
  return TEMPLATE_LABEL[name] ?? name;
}

/** Ladder tier: 0 Owner, 1 Admin, 2 everything below Admin (templates and custom roles). */
export function roleTier(role: { name: string; template: boolean; owner_only?: boolean }): 0 | 1 | 2 {
  if (role.owner_only || (role.template && role.name === "ORGANIZATION_OWNER")) return 0;
  if (role.template && role.name === "ORGANIZATION_ADMIN") return 1;
  return 2;
}
