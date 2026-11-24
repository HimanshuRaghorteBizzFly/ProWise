/**
 * Which pages show real data today. Every other page in a workspace or platform area has no backend yet: outside the
 * dev preview (NEXT_PUBLIC_USE_MOCKS=true) it renders a "Later (task X)" empty state, never sample data.
 * Patterns are relative to the area root ("/org/{orgId}/{role}" or "/super-admin" or "/platform-operator");
 * "*" matches one path segment and a trailing "**" matches the rest.
 */

export type Area =
  | "owner" | "admin" | "manager" | "lead" | "developer" | "reviewer" | "viewer"
  | "super-admin" | "platform-operator";

const ORG_CONSOLE = [
  "", "dashboard", "access", "members", "members/**", "invitations", "invitations/**", "teams", "teams/**",
  "roles-permissions", "roles-permissions/**", "projects", "projects/**",
];

export const LIVE_ROUTES: Record<Area, readonly string[]> = {
  // Members, invitations, teams, handover (1.2), roles and grants (1.3), projects (2.1), live dashboard.
  owner: [...ORG_CONSOLE, "transfer-ownership", "work-types", "work-calendar"],
  admin: [...ORG_CONSOLE, "work-types", "work-calendar"],
  // Projects (2.1) and the live portfolio dashboard.
  manager: ["", "dashboard", "projects", "projects/**", "create-project", "team-assignments", "deadlines",
    "work-items", "work-items/*", "project-planning", "scope", "scope/*", "blockers", "dependencies", "progress"],
  // Check-in approvals (2.2) and the live dashboard.
  lead: ["", "dashboard", "check-ins", "assignments", "work-items", "work-items/*", "team", "team/*", "my-team", "blockers", "blockers/*", "dependencies", "progress"],
  // Own Individual projects and check-ins (2.2).
  developer: [
    "", "dashboard", "check-ins", "checkins", "tasks", "deadlines",
    "projects/*/structured/my-tasks", "projects/*/structured/tasks/*", "projects/*/structured/blockers", "projects/*/structured/dependencies",
    "projects/*/structured/progress", "projects/*/individual/progress-history", "progress", "projects/*/individual/deadlines",
    "projects/*/individual", "projects/*/individual/check-ins", "projects/*/individual/new-check-in",
  ],
  // Assigned code reviews (stored review records) and the live dashboard.
  // Task reviews (3.3).
  reviewer: ["", "dashboard", "queue", "work-items"],
  // Permitted projects, read-only.
  viewer: ["", "dashboard", "tasks", "team", "progress"],
  // Stored organizations and users.
  "super-admin": ["", "dashboard", "organizations", "users", "users/**"],
  // Stored incident, ticket, webhook, job and alert counts.
  "platform-operator": ["", "dashboard", "login"],
};

/** First matching section keyword decides the task the page waits for. */
const LATER_TASKS: ReadonlyArray<[RegExp, string, string]> = [
  [/^(billing|subscriptions|workspaces|plans|invoices|payments|payment-failures|invoice-delivery|subscription-status)\b/, "not in V1", "Billing is outside the V1 scope."],
  [/^(health|risks|org-status|organization-status|delivery-status)\b/, "5.1", "Schedule health and its causes"],
  [/^(notifications|reminders|approvals|delivery-approvals|escalations|access-approvals|access-requests)\b/, "5.2", "Reminders, approvals and escalations"],
  [/^(my-work|search|portfolio)\b/, "5.3", "Portfolio search and My Work"],
  [/^(workload|timeline|timelines|calendar|milestones|sprints|sprint-planning|team-assignments)\b/, "5.4", "Timelines and planned workload"],
  [/^(reports)\b/, "5.5", "Reports and CSV exports"],
  [/^(privacy|audit|audit-logs|activity|activity-logs|security)\b/, "5.6", "Privacy operations and support audit"],
  [/^(integrations|integration-settings|integration-health|repositories|github|github-integrations|github-monitoring|evidence|webhooks|webhook-logs|sync-jobs)\b/, "4.1", "Repositories and code evidence"],
  [/^(work-items|tasks|my-tasks|assignments|structured|project-planning|team|my-team)\b/, "3.1", "Work breakdown and assignment"],
  [/^(scope)\b/, "3.2", "Scope approval and versions"],
  [/^(reviews|review-queue|review-history|queue|history|waiting|assigned-reviews|rejected-work|checklists|test-checklists|submit-review|review-feedback)\b/, "3.3", "Reviews"],
  [/^(blockers|dependencies)\b/, "3.4", "Blockers and dependencies"],
  [/^(progress|progress-history)\b/, "3.5", "Progress views"],
  [/^(deadlines)\b/, "2.3", "Working calendar and cadence"],
  [/^(delivery)\b/, "2.4", "Deliver, close, archive and restore"],
  [/^(settings|organization|configuration|account)\b/, "1.1", "Organization settings"],
];

export interface LaterInfo {
  task: string;
  title: string;
}

function matches(pattern: string, rest: string): boolean {
  const want = pattern === "" ? [] : pattern.split("/");
  const have = rest === "" ? [] : rest.split("/");
  for (let i = 0; i < want.length; i += 1) {
    if (want[i] === "**") return true;
    if (i >= have.length) return false;
    if (want[i] !== "*" && want[i] !== have[i]) return false;
  }
  return want.length === have.length;
}

/** Splits a pathname into its area and the rest; null for pages outside the gated areas (auth pages etc.). */
export function areaOf(pathname: string): { area: Area; rest: string } | null {
  const clean = pathname.split("?")[0].replace(/\/+$/, "");
  const org = clean.match(/^\/org\/[^/]+\/(owner|admin|manager|lead|developer|reviewer|viewer)(?:\/(.*))?$/);
  if (org) return { area: org[1] as Area, rest: org[2] ?? "" };
  const platform = clean.match(/^\/(super-admin|platform-operator)(?:\/(.*))?$/);
  if (platform) return { area: platform[1] as Area, rest: platform[2] ?? "" };
  return null;
}

export function isLiveRoute(pathname: string): boolean {
  const parsed = areaOf(pathname);
  if (!parsed) return true;
  return LIVE_ROUTES[parsed.area].some((pattern) => matches(pattern, parsed.rest));
}

/** The task a not-yet-live page waits for (based on its section name). */
export function laterInfoFor(pathname: string): LaterInfo {
  const parsed = areaOf(pathname);
  const rest = parsed?.rest ?? "";
  // Project sub-pages are named after their section: projects/{id}/structured/blockers -> blockers.
  const section = rest.replace(/^projects\/[^/]+\/(individual|structured)\/?/, "").replace(/^projects\/[^/]+\/?/, "") || rest;
  for (const [pattern, task, title] of LATER_TASKS) {
    if (pattern.test(section) || pattern.test(rest)) return { task, title };
  }
  if (parsed && (parsed.area === "super-admin" || parsed.area === "platform-operator")) {
    return { task: "platform", title: "Platform administration" };
  }
  return { task: "a later task", title: "This page" };
}
