/**
 * Sample data for the Org Owner and Org Admin workspaces.
 *
 * Every dashboard and page for those two roles reads from this one file
 * (through `src/store/org-console-store.ts`). Nothing here is typed inside components.
 */

export const ORG_TODAY = "2026-11-20";
export const ORG_NOW = "2026-11-20T10:30:00Z";

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type PermissionId =
  | "org.manage"
  | "org.ownership.transfer"
  | "org.privacy.manage"
  | "member.invite"
  | "member.disable"
  | "role.manage"
  | "role.create"
  | "team.manage"
  | "project.create"
  | "project.read"
  | "project.edit"
  | "project.archive"
  | "project.scope.approve"
  | "task.create"
  | "task.assign"
  | "task.update"
  | "progress.report"
  | "task.review"
  | "repo.connect"
  | "repo.read"
  | "report.view"
  | "report.export"
  | "audit.read"
  | "integration.manage"
  | "notification.manage";

/** Organization-level permission groups (no platform-level permissions exist here). */
export type PermissionCategory = "Organization" | "People" | "Projects" | "Work & review" | "Repositories" | "Reports" | "Audit";

export const PERMISSION_GROUPS: { id: PermissionCategory; description: string }[] = [
  { id: "People", description: "Members, invitations, teams and roles" },
  { id: "Projects", description: "Create, plan and close projects" },
  { id: "Work & review", description: "Tasks, progress and QA decisions" },
  { id: "Repositories", description: "GitHub repositories used as evidence" },
  { id: "Reports", description: "Organization reports and exports" },
  { id: "Audit", description: "Audit trail and alerts" },
  { id: "Organization", description: "Owner-only controls; never delegated" },
];

export type RoleTier = 0 | 1 | 2;
export const ROLE_TIER_LABEL: Record<RoleTier, string> = {
  0: "Organization Owner",
  1: "Organization Admin",
  2: "Delivery & custom roles",
};

export interface PermissionDef {
  id: PermissionId;
  label: string;
  category: PermissionCategory;
  description: string;
  /** Only an owner may hold this permission. */
  ownerOnly?: boolean;
}

export interface RoleDef {
  id: string;
  name: string;
  description: string;
  color: string;
  system: boolean;
  /** 0 = Owner, 1 = Admin, 2 = everything below Admin (built-in and custom). */
  tier: RoleTier;
  permissions: PermissionId[];
  createdAt: string;
  createdById: string;
}

export interface RoleChange {
  id: string;
  roleId: string;
  actorId: string;
  at: string;
  summary: string;
  added: PermissionId[];
  removed: PermissionId[];
}

export type MemberStatus = "ACTIVE" | "INVITED" | "DISABLED" | "SUSPENDED";

export interface Member {
  id: string;
  name: string;
  initials: string;
  email: string;
  title: string;
  roleId: string;
  teamIds: string[];
  status: MemberStatus;
  joinedAt: string;
  lastActiveAt: string;
  mfa: boolean;
  location: string;
  color: string;
}

export type InviteStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";

export interface Invitation {
  id: string;
  email: string;
  roleId: string;
  teamId: string | null;
  invitedById: string;
  sentAt: string;
  expiresAt: string;
  status: InviteStatus;
  resentCount: number;
  message: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  leadId: string;
  memberIds: string[];
  color: string;
  createdAt: string;
}

export type Health = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";

export interface OrgProject {
  id: string;
  code: string;
  name: string;
  teamId: string;
  managerId: string;
  mode: "STRUCTURED" | "INDIVIDUAL";
  status: "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
  health: Health;
  progress: number;
  plannedProgress: number;
  startDate: string;
  dueDate: string;
  repoIds: string[];
  openRisks: number;
  openBlockers: number;
  color: string;
  summary: string;
}

export interface OrgRisk {
  id: string;
  title: string;
  projectId: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  ownerId: string;
  raisedAt: string;
  mitigation: string;
}

export type SyncStatus = "HEALTHY" | "SYNCING" | "FAILED" | "PAUSED";

export interface Repository {
  id: string;
  fullName: string;
  projectId: string | null;
  defaultBranch: string;
  visibility: "private" | "internal";
  status: SyncStatus;
  lastSyncAt: string;
  connectedAt: string;
  connectedById: string;
  openPullRequests: number;
  commits7d: number;
  error?: string;
}

export interface GithubConnection {
  installation: string;
  account: string;
  status: "CONNECTED" | "DEGRADED" | "DISCONNECTED";
  connectedAt: string;
  connectedById: string;
  scopes: string[];
  webhookHealth: number;
  rateLimitUsed: number;
}

export interface AvailableRepository {
  id: string;
  fullName: string;
  language: string;
  updatedAt: string;
}

export type AuditCategory = "SECURITY" | "MEMBER" | "ROLE" | "PROJECT" | "INTEGRATION" | "SETTINGS";

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  target: string;
  category: AuditCategory;
  severity: "INFO" | "WARNING" | "CRITICAL";
  at: string;
  ip: string;
  location: string;
  device: string;
  before?: string;
  after?: string;
}

export interface OrgNotification {
  id: string;
  title: string;
  body: string;
  kind: "SECURITY" | "MEMBER" | "PROJECT" | "INTEGRATION" | "BILLING_FREE";
  at: string;
  read: boolean;
  link: string;
}

export interface OrgReport {
  id: string;
  title: string;
  kind: "PORTFOLIO" | "PEOPLE" | "ACCESS" | "INTEGRATION" | "AUDIT";
  period: string;
  generatedAt: string;
  summary: string;
  highlights: string[];
  metrics: { label: string; value: string }[];
  /** Which families may open this report. */
  audience: ("owner" | "admin")[];
}

export interface OrgSettings {
  name: string;
  slug: string;
  domain: string;
  industry: string;
  timezone: string;
  locale: string;
  dataRegion: string;
  createdAt: string;
  requireMfa: boolean;
  allowedDomains: string[];
  sessionTimeoutHours: number;
  defaultRoleId: string;
}

export interface PrivacySettings {
  auditRetentionDays: number;
  activityRetentionDays: number;
  deletedMemberRetentionDays: number;
  exportRequests: { id: string; requestedById: string; scope: string; requestedAt: string; status: "READY" | "PROCESSING" | "EXPIRED" }[];
  deletionRequests: { id: string; subject: string; requestedAt: string; status: "PENDING" | "COMPLETED"; dueAt: string }[];
  subProcessors: { name: string; purpose: string; region: string }[];
}

/* ----------------------------------------------------------------------------
 * Organization & viewers
 * ------------------------------------------------------------------------- */

export const ORG_SETTINGS: OrgSettings = {
  name: "Acme Health Technologies",
  slug: "acme-health",
  domain: "acmehealth.io",
  industry: "Digital health",
  timezone: "Europe/London",
  locale: "en-GB",
  dataRegion: "EU (Frankfurt)",
  createdAt: "2024-03-11",
  requireMfa: true,
  allowedDomains: ["acmehealth.io", "acme-contractors.io"],
  sessionTimeoutHours: 12,
  defaultRoleId: "role-developer",
};

export const ORG_VIEWERS = {
  owner: { id: "m-olivia", name: "Olivia Bennett", title: "Founder & CEO" },
  admin: { id: "m-rahul", name: "Rahul Mehta", title: "Head of Operations" },
} as const;

/* ----------------------------------------------------------------------------
 * Permissions & roles
 * ------------------------------------------------------------------------- */

export const PERMISSIONS: PermissionDef[] = [
  { id: "member.invite", label: "Invite members", category: "People", description: "Send, resend and revoke invitations." },
  { id: "member.disable", label: "Disable members", category: "People", description: "Suspend or re-enable a member's access." },
  { id: "team.manage", label: "Manage teams", category: "People", description: "Create teams and set leads and members." },
  { id: "role.manage", label: "Assign roles", category: "People", description: "Change which role a member holds." },
  { id: "role.create", label: "Create & edit roles", category: "People", description: "Define roles and switch their permissions." },
  { id: "project.read", label: "View projects", category: "Projects", description: "See status, health and progress." },
  { id: "project.create", label: "Create projects", category: "Projects", description: "Start projects and choose their mode." },
  { id: "project.edit", label: "Edit plans & deadlines", category: "Projects", description: "Change milestones, dates and weights." },
  { id: "project.scope.approve", label: "Approve scope changes", category: "Projects", description: "Accept or reject scope change requests." },
  { id: "project.archive", label: "Archive projects", category: "Projects", description: "Close and archive finished projects." },
  { id: "task.create", label: "Create tasks", category: "Work & review", description: "Add tasks to projects they can see." },
  { id: "task.assign", label: "Assign work", category: "Work & review", description: "Assign and reassign tasks." },
  { id: "task.update", label: "Update own work", category: "Work & review", description: "Change status of tasks assigned to them." },
  { id: "progress.report", label: "Report progress", category: "Work & review", description: "Submit check-ins and self-reported %." },
  { id: "task.review", label: "Review work", category: "Work & review", description: "Approve or request changes with a reason." },
  { id: "repo.read", label: "View repositories", category: "Repositories", description: "See sync status, commits and PRs as evidence." },
  { id: "repo.connect", label: "Connect repositories", category: "Repositories", description: "Link GitHub repositories to projects." },
  { id: "report.view", label: "View reports", category: "Reports", description: "Open organization and project reports." },
  { id: "report.export", label: "Export reports", category: "Reports", description: "Download reports as CSV." },
  { id: "audit.read", label: "Read audit log", category: "Audit", description: "See who changed what, and when." },
  { id: "notification.manage", label: "Organization alerts", category: "Audit", description: "Choose which events alert the organization." },
  { id: "org.manage", label: "Organization settings", category: "Organization", description: "Name, domain, security policy and defaults.", ownerOnly: true },
  { id: "org.privacy.manage", label: "Data & privacy", category: "Organization", description: "Retention, exports and deletion requests.", ownerOnly: true },
  { id: "integration.manage", label: "GitHub app", category: "Organization", description: "Install, re-authorize or remove the GitHub app.", ownerOnly: true },
  { id: "org.ownership.transfer", label: "Transfer ownership", category: "Organization", description: "Hand the organization to another member.", ownerOnly: true },
];

const ALL: PermissionId[] = PERMISSIONS.map((p) => p.id);

export const ROLES: RoleDef[] = [
  { id: "role-owner", name: "Organization Owner", description: "Full control of the organization, including ownership and privacy. Always read-only.", color: "#F59E0B", system: true, tier: 0, permissions: ALL, createdAt: "2024-03-11", createdById: "m-olivia" },
  {
    id: "role-admin", name: "Organization Admin", description: "Runs people, teams, roles and integrations day to day.", color: "#3B82F6", system: true, tier: 1, createdAt: "2024-03-11", createdById: "m-olivia",
    permissions: ["member.invite", "member.disable", "team.manage", "role.manage", "role.create", "project.read", "task.assign", "progress.report", "repo.read", "repo.connect", "report.view", "report.export", "audit.read", "notification.manage"],
  },
  {
    id: "role-pm", name: "Project Manager", description: "Plans projects, assigns work and approves scope changes.", color: "#8B5CF6", system: true, tier: 2, createdAt: "2024-03-11", createdById: "m-olivia",
    permissions: ["project.read", "project.create", "project.edit", "project.scope.approve", "project.archive", "task.create", "task.assign", "repo.read", "report.view", "report.export"],
  },
  { id: "role-lead", name: "Team Lead", description: "Runs one team: assigns and updates team work.", color: "#06B6D4", system: true, tier: 2, createdAt: "2024-03-11", createdById: "m-olivia", permissions: ["project.read", "task.create", "task.assign", "task.update", "progress.report", "repo.read", "report.view"] },
  { id: "role-developer", name: "Developer", description: "Delivers assigned work and reports progress.", color: "#10B981", system: true, tier: 2, createdAt: "2024-03-11", createdById: "m-olivia", permissions: ["project.read", "task.update", "progress.report", "repo.read"] },
  { id: "role-qa", name: "QA / Reviewer", description: "Reviews evidence and approves or requests changes.", color: "#EC4899", system: true, tier: 2, createdAt: "2024-03-11", createdById: "m-olivia", permissions: ["project.read", "task.review", "repo.read", "report.view"] },
  { id: "role-viewer", name: "Viewer / Stakeholder", description: "Read-only access to projects and reports.", color: "#64748B", system: true, tier: 2, createdAt: "2024-03-11", createdById: "m-olivia", permissions: ["project.read", "report.view"] },
  { id: "role-security", name: "Security Auditor", description: "Custom role for the external SOC 2 auditor.", color: "#EF4444", system: false, tier: 2, createdAt: "2026-06-02", createdById: "m-rahul", permissions: ["audit.read", "repo.read", "report.view", "report.export"] },
  { id: "role-delivery-director", name: "Delivery Director", description: "Custom role: oversees every project and can archive them.", color: "#14B8A6", system: false, tier: 2, createdAt: "2026-09-14", createdById: "m-olivia", permissions: ["project.read", "project.create", "project.edit", "project.scope.approve", "project.archive", "task.assign", "report.view", "report.export", "audit.read"] },
];

export const ROLE_HISTORY: RoleChange[] = [
  { id: "rh-1", roleId: "role-admin", actorId: "m-olivia", at: "2024-03-11T09:00:00Z", summary: "Created Organization Admin role", added: [], removed: [] },
  { id: "rh-2", roleId: "role-admin", actorId: "m-olivia", at: "2026-02-03T10:15:00Z", summary: "Allowed admins to create and edit roles", added: ["role.create"], removed: [] },
  { id: "rh-3", roleId: "role-admin", actorId: "m-olivia", at: "2026-07-21T08:40:00Z", summary: "Removed project creation from admins", added: [], removed: ["project.create"] },
  { id: "rh-4", roleId: "role-pm", actorId: "m-olivia", at: "2026-05-12T14:00:00Z", summary: "Project managers can approve scope changes", added: ["project.scope.approve"], removed: [] },
  { id: "rh-5", roleId: "role-pm", actorId: "m-rahul", at: "2026-10-02T11:30:00Z", summary: "Added report viewing", added: ["report.view"], removed: [] },
  { id: "rh-6", roleId: "role-lead", actorId: "m-rahul", at: "2026-08-19T09:20:00Z", summary: "Team leads can create tasks", added: ["task.create"], removed: [] },
  { id: "rh-7", roleId: "role-developer", actorId: "m-grace", at: "2026-04-08T16:05:00Z", summary: "Removed repository connect from developers", added: [], removed: ["repo.connect"] },
  { id: "rh-8", roleId: "role-qa", actorId: "m-rahul", at: "2026-06-30T13:10:00Z", summary: "QA can open reports", added: ["report.view"], removed: [] },
  { id: "rh-9", roleId: "role-viewer", actorId: "m-olivia", at: "2025-11-03T09:00:00Z", summary: "Renamed to Viewer / Stakeholder", added: [], removed: [] },
  { id: "rh-10", roleId: "role-security", actorId: "m-rahul", at: "2026-06-02T10:00:00Z", summary: "Created custom role for SOC 2 auditor", added: ["audit.read", "repo.read", "report.view", "report.export"], removed: [] },
  { id: "rh-11", roleId: "role-delivery-director", actorId: "m-olivia", at: "2026-09-14T15:10:00Z", summary: "Created custom role based on Project Manager", added: ["audit.read"], removed: ["task.create"] },
  { id: "rh-12", roleId: "role-delivery-director", actorId: "m-olivia", at: "2026-10-20T12:00:00Z", summary: "Removed role editing from Delivery Director", added: [], removed: ["role.create"] },
];

/* ----------------------------------------------------------------------------
 * Members, teams, invitations
 * ------------------------------------------------------------------------- */

export const MEMBERS: Member[] = [
  { id: "m-olivia", name: "Olivia Bennett", initials: "OB", email: "olivia@acmehealth.io", title: "Founder & CEO", roleId: "role-owner", teamIds: [], status: "ACTIVE", joinedAt: "2024-03-11", lastActiveAt: "2026-11-20T09:58:00Z", mfa: true, location: "London", color: "#F59E0B" },
  { id: "m-rahul", name: "Rahul Mehta", initials: "RM", email: "rahul@acmehealth.io", title: "Head of Operations", roleId: "role-admin", teamIds: [], status: "ACTIVE", joinedAt: "2024-04-02", lastActiveAt: "2026-11-20T10:12:00Z", mfa: true, location: "Bengaluru", color: "#3B82F6" },
  { id: "m-grace", name: "Grace Liu", initials: "GL", email: "grace@acmehealth.io", title: "IT Administrator", roleId: "role-admin", teamIds: [], status: "ACTIVE", joinedAt: "2025-01-20", lastActiveAt: "2026-11-19T17:40:00Z", mfa: true, location: "Singapore", color: "#0EA5E9" },
  { id: "m-priya", name: "Priya Raman", initials: "PR", email: "priya@acmehealth.io", title: "Senior Project Manager", roleId: "role-pm", teamIds: ["tm-platform"], status: "ACTIVE", joinedAt: "2024-05-13", lastActiveAt: "2026-11-20T08:30:00Z", mfa: true, location: "London", color: "#8B5CF6" },
  { id: "m-daniel", name: "Daniel Okafor", initials: "DO", email: "daniel@acmehealth.io", title: "Project Manager", roleId: "role-pm", teamIds: ["tm-mobile"], status: "ACTIVE", joinedAt: "2025-02-03", lastActiveAt: "2026-11-19T15:05:00Z", mfa: false, location: "Lagos", color: "#A855F7" },
  { id: "m-marcus", name: "Marcus Chen", initials: "MC", email: "marcus@acmehealth.io", title: "Team Lead · Platform", roleId: "role-lead", teamIds: ["tm-platform"], status: "ACTIVE", joinedAt: "2024-06-01", lastActiveAt: "2026-11-20T09:20:00Z", mfa: true, location: "Toronto", color: "#06B6D4" },
  { id: "m-hana", name: "Hana Kim", initials: "HK", email: "hana@acmehealth.io", title: "Team Lead · Mobile", roleId: "role-lead", teamIds: ["tm-mobile"], status: "ACTIVE", joinedAt: "2024-09-16", lastActiveAt: "2026-11-20T07:45:00Z", mfa: true, location: "Seoul", color: "#22D3EE" },
  { id: "m-omar", name: "Omar Haddad", initials: "OH", email: "omar@acmehealth.io", title: "Team Lead · Data", roleId: "role-lead", teamIds: ["tm-data"], status: "ACTIVE", joinedAt: "2025-03-10", lastActiveAt: "2026-11-18T16:10:00Z", mfa: true, location: "Amman", color: "#14B8A6" },
  { id: "m-aisha", name: "Aisha Bello", initials: "AB", email: "aisha@acmehealth.io", title: "Backend Engineer", roleId: "role-developer", teamIds: ["tm-platform"], status: "ACTIVE", joinedAt: "2024-07-22", lastActiveAt: "2026-11-20T10:01:00Z", mfa: true, location: "Lagos", color: "#10B981" },
  { id: "m-diego", name: "Diego Alvarez", initials: "DA", email: "diego@acmehealth.io", title: "Frontend Engineer", roleId: "role-developer", teamIds: ["tm-platform", "tm-design"], status: "ACTIVE", joinedAt: "2024-10-07", lastActiveAt: "2026-11-20T09:40:00Z", mfa: true, location: "Mexico City", color: "#F97316" },
  { id: "m-sofia", name: "Sofia Novak", initials: "SN", email: "sofia@acmehealth.io", title: "Full-stack Engineer", roleId: "role-developer", teamIds: ["tm-platform"], status: "ACTIVE", joinedAt: "2025-04-14", lastActiveAt: "2026-11-20T09:35:00Z", mfa: false, location: "Prague", color: "#0891B2" },
  { id: "m-noah", name: "Noah Williams", initials: "NW", email: "noah@acmehealth.io", title: "iOS Engineer", roleId: "role-developer", teamIds: ["tm-mobile"], status: "ACTIVE", joinedAt: "2025-01-06", lastActiveAt: "2026-11-20T06:50:00Z", mfa: true, location: "Austin", color: "#2563EB" },
  { id: "m-zara", name: "Zara Ahmed", initials: "ZA", email: "zara@acmehealth.io", title: "Android Engineer", roleId: "role-developer", teamIds: ["tm-mobile"], status: "SUSPENDED", joinedAt: "2025-05-19", lastActiveAt: "2026-11-02T12:00:00Z", mfa: true, location: "Dubai", color: "#EA580C" },
  { id: "m-mei", name: "Mei Lin", initials: "ML", email: "mei@acmehealth.io", title: "Data Engineer", roleId: "role-developer", teamIds: ["tm-data"], status: "ACTIVE", joinedAt: "2025-06-02", lastActiveAt: "2026-11-19T18:22:00Z", mfa: true, location: "Singapore", color: "#E11D48" },
  { id: "m-elena", name: "Elena Ruiz", initials: "ER", email: "elena@acmehealth.io", title: "QA Reviewer", roleId: "role-qa", teamIds: ["tm-platform", "tm-mobile"], status: "ACTIVE", joinedAt: "2024-08-12", lastActiveAt: "2026-11-20T09:10:00Z", mfa: true, location: "Madrid", color: "#EC4899" },
  { id: "m-lucas", name: "Lucas Moreau", initials: "LM", email: "lucas@acmehealth.io", title: "Product Designer", roleId: "role-developer", teamIds: ["tm-design"], status: "ACTIVE", joinedAt: "2025-08-25", lastActiveAt: "2026-11-19T14:30:00Z", mfa: true, location: "Lyon", color: "#D946EF" },
  { id: "m-ken", name: "Ken Watanabe", initials: "KW", email: "ken@acme-contractors.io", title: "Contract Developer", roleId: "role-developer", teamIds: ["tm-data"], status: "DISABLED", joinedAt: "2025-02-17", lastActiveAt: "2026-09-30T11:00:00Z", mfa: false, location: "Osaka", color: "#78716C" },
  { id: "m-amara", name: "Amara Singh", initials: "AS", email: "amara@acmehealth.io", title: "Board Observer", roleId: "role-viewer", teamIds: [], status: "ACTIVE", joinedAt: "2025-11-03", lastActiveAt: "2026-11-14T08:00:00Z", mfa: true, location: "Dublin", color: "#64748B" },
  { id: "m-victor", name: "Victor Hale", initials: "VH", email: "victor@trustline-audit.com", title: "SOC 2 Auditor (external)", roleId: "role-security", teamIds: [], status: "ACTIVE", joinedAt: "2026-06-02", lastActiveAt: "2026-11-17T13:15:00Z", mfa: true, location: "Boston", color: "#DC2626" },
  { id: "m-isabel", name: "Isabel Costa", initials: "IC", email: "isabel@acmehealth.io", title: "Delivery Director", roleId: "role-delivery-director", teamIds: [], status: "ACTIVE", joinedAt: "2026-09-14", lastActiveAt: "2026-11-20T08:05:00Z", mfa: true, location: "Lisbon", color: "#0D9488" },
];

export const TEAMS: Team[] = [
  { id: "tm-platform", name: "Platform Squad", description: "APIs, billing engine and integrations.", leadId: "m-marcus", memberIds: ["m-marcus", "m-priya", "m-aisha", "m-diego", "m-sofia", "m-elena"], color: "#3B82F6", createdAt: "2024-06-01" },
  { id: "tm-mobile", name: "Mobile Crew", description: "Patient iOS and Android apps.", leadId: "m-hana", memberIds: ["m-hana", "m-daniel", "m-noah", "m-zara", "m-elena"], color: "#10B981", createdAt: "2024-09-16" },
  { id: "tm-data", name: "Data Guild", description: "Warehouse, analytics and finance reporting.", leadId: "m-omar", memberIds: ["m-omar", "m-mei", "m-ken"], color: "#8B5CF6", createdAt: "2025-03-10" },
  { id: "tm-design", name: "Design Studio", description: "Product design system and research.", leadId: "m-lucas", memberIds: ["m-lucas", "m-diego"], color: "#EC4899", createdAt: "2025-08-25" },
];

export const INVITATIONS: Invitation[] = [
  { id: "inv-1", email: "fatima.yusuf@acmehealth.io", roleId: "role-developer", teamId: "tm-platform", invitedById: "m-rahul", sentAt: "2026-11-18T09:00:00Z", expiresAt: "2026-11-25T09:00:00Z", status: "PENDING", resentCount: 0, message: "Welcome to the Platform Squad!" },
  { id: "inv-2", email: "tom.becker@acmehealth.io", roleId: "role-qa", teamId: "tm-mobile", invitedById: "m-grace", sentAt: "2026-11-15T14:20:00Z", expiresAt: "2026-11-22T14:20:00Z", status: "PENDING", resentCount: 1, message: "Joining as QA for Beacon 3.0." },
  { id: "inv-3", email: "nina.petrova@acmehealth.io", roleId: "role-pm", teamId: "tm-data", invitedById: "m-olivia", sentAt: "2026-11-19T16:45:00Z", expiresAt: "2026-11-26T16:45:00Z", status: "PENDING", resentCount: 0, message: "PM for Cobalt warehouse." },
  { id: "inv-4", email: "sam.ortiz@acme-contractors.io", roleId: "role-developer", teamId: "tm-data", invitedById: "m-rahul", sentAt: "2026-11-05T10:00:00Z", expiresAt: "2026-11-12T10:00:00Z", status: "EXPIRED", resentCount: 2, message: "Contract data engineer." },
  { id: "inv-5", email: "lee.harper@acmehealth.io", roleId: "role-viewer", teamId: null, invitedById: "m-olivia", sentAt: "2026-11-01T08:00:00Z", expiresAt: "2026-11-08T08:00:00Z", status: "ACCEPTED", resentCount: 0, message: "Investor read-only access." },
  { id: "inv-6", email: "chris.fowler@gmail.com", roleId: "role-developer", teamId: "tm-platform", invitedById: "m-grace", sentAt: "2026-11-10T11:30:00Z", expiresAt: "2026-11-17T11:30:00Z", status: "REVOKED", resentCount: 0, message: "Revoked: personal address not allowed." },
  { id: "inv-7", email: "ava.richter@acmehealth.io", roleId: "role-lead", teamId: "tm-design", invitedById: "m-rahul", sentAt: "2026-11-20T08:10:00Z", expiresAt: "2026-11-27T08:10:00Z", status: "PENDING", resentCount: 0, message: "Design Studio co-lead." },
];

/* ----------------------------------------------------------------------------
 * Projects & risks
 * ------------------------------------------------------------------------- */

export const ORG_PROJECTS: OrgProject[] = [
  { id: "op-atlas", code: "ATL", name: "Atlas Billing Revamp", teamId: "tm-platform", managerId: "m-priya", mode: "STRUCTURED", status: "ACTIVE", health: "AT_RISK", progress: 58, plannedProgress: 70, startDate: "2026-08-03", dueDate: "2026-12-18", repoIds: ["rp-atlas-api", "rp-atlas-web"], openRisks: 2, openBlockers: 2, color: "#3B82F6", summary: "Usage-based billing, tax handling and self-serve invoices." },
  { id: "op-beacon", code: "BCN", name: "Beacon Mobile App 3.0", teamId: "tm-mobile", managerId: "m-daniel", mode: "STRUCTURED", status: "ACTIVE", health: "ON_TRACK", progress: 74, plannedProgress: 72, startDate: "2026-07-13", dueDate: "2027-01-22", repoIds: ["rp-beacon-ios", "rp-beacon-android"], openRisks: 1, openBlockers: 0, color: "#10B981", summary: "Offline appointments, secure messaging, Apple Health sync." },
  { id: "op-cobalt", code: "CBT", name: "Cobalt Data Warehouse", teamId: "tm-data", managerId: "m-priya", mode: "STRUCTURED", status: "ACTIVE", health: "OFF_TRACK", progress: 31, plannedProgress: 55, startDate: "2026-09-01", dueDate: "2026-12-04", repoIds: ["rp-cobalt-dbt"], openRisks: 2, openBlockers: 1, color: "#EF4444", summary: "Governed finance warehouse with daily revenue models." },
  { id: "op-delta", code: "DLT", name: "Delta Partner Portal", teamId: "tm-platform", managerId: "m-priya", mode: "INDIVIDUAL", status: "ACTIVE", health: "ON_TRACK", progress: 86, plannedProgress: 82, startDate: "2026-09-14", dueDate: "2026-12-11", repoIds: ["rp-delta-portal"], openRisks: 0, openBlockers: 0, color: "#8B5CF6", summary: "Single-developer partner portal for shipments and documents." },
  { id: "op-ember", code: "EMB", name: "Ember Identity & SSO", teamId: "tm-platform", managerId: "m-priya", mode: "STRUCTURED", status: "ACTIVE", health: "AT_RISK", progress: 44, plannedProgress: 50, startDate: "2026-10-05", dueDate: "2027-02-12", repoIds: ["rp-ember-auth"], openRisks: 1, openBlockers: 1, color: "#F59E0B", summary: "SAML / OIDC SSO, SCIM provisioning and session hardening." },
  { id: "op-fjord", code: "FJD", name: "Fjord Support Console", teamId: "tm-design", managerId: "m-daniel", mode: "STRUCTURED", status: "PLANNING", health: "ON_TRACK", progress: 8, plannedProgress: 8, startDate: "2026-11-16", dueDate: "2027-03-26", repoIds: [], openRisks: 0, openBlockers: 0, color: "#06B6D4", summary: "Agent console with unified inbox and customer timeline." },
  { id: "op-gaia", code: "GAI", name: "Gaia Design System v3", teamId: "tm-design", managerId: "m-daniel", mode: "INDIVIDUAL", status: "COMPLETED", health: "ON_TRACK", progress: 100, plannedProgress: 100, startDate: "2026-05-04", dueDate: "2026-10-30", repoIds: ["rp-gaia-ui"], openRisks: 0, openBlockers: 0, color: "#EC4899", summary: "Tokens, components and accessibility audit for all apps." },
  { id: "op-helix", code: "HLX", name: "Helix Clinical Integrations", teamId: "tm-data", managerId: "m-isabel", mode: "STRUCTURED", status: "ON_HOLD", health: "AT_RISK", progress: 22, plannedProgress: 35, startDate: "2026-08-17", dueDate: "2027-01-29", repoIds: [], openRisks: 1, openBlockers: 1, color: "#A855F7", summary: "HL7 / FHIR connectors for partner clinics. Paused pending legal review." },
];

/** How each project's progress is measured, and why it has its current health (dashboard chart tooltips). */
export const PROJECT_PROGRESS_NOTES: Record<string, { method: string; healthReason: string }> = {
  "op-atlas": { method: "Weighted tasks · QA-approved", healthReason: "12 points behind plan; tax provider sandbox unstable." },
  "op-beacon": { method: "Weighted tasks · QA-approved", healthReason: "2 points ahead of plan; no open blockers." },
  "op-cobalt": { method: "Weighted tasks · QA-approved", healthReason: "24 points behind plan; ERP export access still pending." },
  "op-delta": { method: "Self-reported check-ins (Individual)", healthReason: "4 points ahead of plan; weekly check-ins on time." },
  "op-ember": { method: "Weighted tasks · QA-approved", healthReason: "6 points behind plan; SCIM gaps with Okta tenant." },
  "op-fjord": { method: "Milestone sign-off", healthReason: "Discovery on schedule; plan baseline set last week." },
  "op-gaia": { method: "Self-reported check-ins (Individual)", healthReason: "Delivered on 30 Oct; final review approved." },
  "op-helix": { method: "Weighted tasks · QA-approved", healthReason: "On hold pending clinic data-sharing agreement." },
};

export const ORG_RISKS: OrgRisk[] = [
  { id: "ork-1", title: "ERP export access still pending", projectId: "op-cobalt", severity: "CRITICAL", ownerId: "m-omar", raisedAt: "2026-11-04", mitigation: "Escalated to Finance IT director; daily follow-up." },
  { id: "ork-2", title: "Tax provider sandbox unstable", projectId: "op-atlas", severity: "HIGH", ownerId: "m-aisha", raisedAt: "2026-11-12", mitigation: "Mock adapter in place; vendor ticket #48211." },
  { id: "ork-3", title: "Clinic data-sharing agreement unsigned", projectId: "op-helix", severity: "HIGH", ownerId: "m-isabel", raisedAt: "2026-10-28", mitigation: "Legal review booked for 26 Nov." },
  { id: "ork-4", title: "Single data engineer on critical path", projectId: "op-cobalt", severity: "HIGH", ownerId: "m-priya", raisedAt: "2026-11-10", mitigation: "Borrowing capacity from Platform Squad for 2 sprints." },
  { id: "ork-5", title: "SCIM spec gaps with Okta tenant", projectId: "op-ember", severity: "MEDIUM", ownerId: "m-marcus", raisedAt: "2026-11-17", mitigation: "Pairing with Okta solutions engineer on 24 Nov." },
  { id: "ork-6", title: "Migration overlaps holiday freeze", projectId: "op-atlas", severity: "MEDIUM", ownerId: "m-priya", raisedAt: "2026-11-15", mitigation: "Dry-run proposed for 4 Dec." },
  { id: "ork-7", title: "App Store review lead time", projectId: "op-beacon", severity: "LOW", ownerId: "m-hana", raisedAt: "2026-11-02", mitigation: "Submit TestFlight build two weeks early." },
];

/* ----------------------------------------------------------------------------
 * Integrations
 * ------------------------------------------------------------------------- */

export const GITHUB_CONNECTION: GithubConnection = {
  installation: "ProWise GitHub App #4471023",
  account: "acme-health",
  status: "DEGRADED",
  connectedAt: "2024-03-14T10:00:00Z",
  connectedById: "m-olivia",
  scopes: ["contents:read", "pull_requests:read", "metadata:read", "checks:read"],
  webhookHealth: 96,
  rateLimitUsed: 38,
};

export const REPOSITORIES: Repository[] = [
  { id: "rp-atlas-api", fullName: "acme-health/atlas-billing-api", projectId: "op-atlas", defaultBranch: "main", visibility: "private", status: "HEALTHY", lastSyncAt: "2026-11-20T10:21:00Z", connectedAt: "2026-08-04T09:00:00Z", connectedById: "m-rahul", openPullRequests: 7, commits7d: 64 },
  { id: "rp-atlas-web", fullName: "acme-health/atlas-billing-web", projectId: "op-atlas", defaultBranch: "main", visibility: "private", status: "HEALTHY", lastSyncAt: "2026-11-20T10:18:00Z", connectedAt: "2026-08-04T09:05:00Z", connectedById: "m-rahul", openPullRequests: 4, commits7d: 38 },
  { id: "rp-beacon-ios", fullName: "acme-health/beacon-ios", projectId: "op-beacon", defaultBranch: "develop", visibility: "private", status: "SYNCING", lastSyncAt: "2026-11-20T10:27:00Z", connectedAt: "2026-07-14T12:00:00Z", connectedById: "m-grace", openPullRequests: 5, commits7d: 51 },
  { id: "rp-beacon-android", fullName: "acme-health/beacon-android", projectId: "op-beacon", defaultBranch: "develop", visibility: "private", status: "HEALTHY", lastSyncAt: "2026-11-20T10:05:00Z", connectedAt: "2026-07-14T12:04:00Z", connectedById: "m-grace", openPullRequests: 3, commits7d: 44 },
  { id: "rp-cobalt-dbt", fullName: "acme-health/cobalt-dbt", projectId: "op-cobalt", defaultBranch: "main", visibility: "internal", status: "FAILED", lastSyncAt: "2026-11-19T22:00:00Z", connectedAt: "2026-09-02T08:00:00Z", connectedById: "m-rahul", openPullRequests: 2, commits7d: 12, error: "Webhook delivery failed 6 times: 401 Bad credentials after token rotation." },
  { id: "rp-delta-portal", fullName: "acme-health/delta-portal", projectId: "op-delta", defaultBranch: "main", visibility: "private", status: "HEALTHY", lastSyncAt: "2026-11-20T09:55:00Z", connectedAt: "2026-09-15T10:00:00Z", connectedById: "m-grace", openPullRequests: 1, commits7d: 22 },
  { id: "rp-ember-auth", fullName: "acme-health/ember-auth", projectId: "op-ember", defaultBranch: "main", visibility: "private", status: "PAUSED", lastSyncAt: "2026-11-16T18:00:00Z", connectedAt: "2026-10-06T09:00:00Z", connectedById: "m-rahul", openPullRequests: 6, commits7d: 29, error: "Paused by Grace Liu during secret rotation." },
  { id: "rp-gaia-ui", fullName: "acme-health/gaia-ui", projectId: "op-gaia", defaultBranch: "main", visibility: "internal", status: "HEALTHY", lastSyncAt: "2026-11-20T07:00:00Z", connectedAt: "2026-05-05T09:00:00Z", connectedById: "m-olivia", openPullRequests: 0, commits7d: 3 },
];

export const AVAILABLE_REPOSITORIES: AvailableRepository[] = [
  { id: "ar-1", fullName: "acme-health/fjord-console", language: "TypeScript", updatedAt: "2026-11-19T16:00:00Z" },
  { id: "ar-2", fullName: "acme-health/helix-fhir-gateway", language: "Kotlin", updatedAt: "2026-11-12T11:00:00Z" },
  { id: "ar-3", fullName: "acme-health/infra-terraform", language: "HCL", updatedAt: "2026-11-18T09:30:00Z" },
  { id: "ar-4", fullName: "acme-health/beacon-shared-kmp", language: "Kotlin", updatedAt: "2026-11-17T13:20:00Z" },
];

/* ----------------------------------------------------------------------------
 * Audit, notifications, reports
 * ------------------------------------------------------------------------- */

export const AUDIT_EVENTS: AuditEvent[] = [
  { id: "ae-1", actorId: "m-rahul", action: "invited a member", target: "ava.richter@acmehealth.io as Team Lead", category: "MEMBER", severity: "INFO", at: "2026-11-20T08:10:00Z", ip: "103.21.58.14", location: "Bengaluru, IN", device: "Chrome 131 · macOS" },
  { id: "ae-2", actorId: "m-grace", action: "paused repository sync", target: "acme-health/ember-auth", category: "INTEGRATION", severity: "WARNING", at: "2026-11-16T18:00:00Z", ip: "121.6.44.201", location: "Singapore, SG", device: "Firefox 133 · Windows" },
  { id: "ae-3", actorId: "m-olivia", action: "changed role", target: "Isabel Costa → Delivery Director", category: "ROLE", severity: "WARNING", at: "2026-11-19T11:42:00Z", ip: "81.2.69.160", location: "London, GB", device: "Safari 18 · iPhone", before: "Project Manager", after: "Delivery Director" },
  { id: "ae-4", actorId: "m-rahul", action: "suspended member", target: "Zara Ahmed", category: "SECURITY", severity: "CRITICAL", at: "2026-11-02T12:05:00Z", ip: "103.21.58.14", location: "Bengaluru, IN", device: "Chrome 131 · macOS", before: "Active", after: "Suspended" },
  { id: "ae-5", actorId: "m-victor", action: "exported audit log", target: "Q3 2026 audit export (CSV)", category: "SECURITY", severity: "INFO", at: "2026-11-17T13:20:00Z", ip: "198.51.100.23", location: "Boston, US", device: "Edge 131 · Windows" },
  { id: "ae-6", actorId: "m-olivia", action: "enabled MFA requirement", target: "Organization security policy", category: "SETTINGS", severity: "WARNING", at: "2026-11-10T09:00:00Z", ip: "81.2.69.160", location: "London, GB", device: "Chrome 131 · macOS", before: "Optional", after: "Required" },
  { id: "ae-7", actorId: "m-grace", action: "revoked invitation", target: "chris.fowler@gmail.com", category: "MEMBER", severity: "INFO", at: "2026-11-10T11:45:00Z", ip: "121.6.44.201", location: "Singapore, SG", device: "Firefox 133 · Windows" },
  { id: "ae-8", actorId: "m-rahul", action: "connected repository", target: "acme-health/cobalt-dbt → Cobalt Data Warehouse", category: "INTEGRATION", severity: "INFO", at: "2026-09-02T08:00:00Z", ip: "103.21.58.14", location: "Bengaluru, IN", device: "Chrome 131 · macOS" },
  { id: "ae-9", actorId: "m-ken", action: "failed sign-in (5 attempts)", target: "ken@acme-contractors.io", category: "SECURITY", severity: "CRITICAL", at: "2026-11-18T03:12:00Z", ip: "45.155.205.9", location: "Unknown", device: "curl/8.4" },
  { id: "ae-10", actorId: "m-priya", action: "archived project", target: "Gaia Design System v3", category: "PROJECT", severity: "INFO", at: "2026-10-31T17:00:00Z", ip: "81.2.69.161", location: "London, GB", device: "Chrome 131 · macOS" },
  { id: "ae-11", actorId: "m-rahul", action: "created team", target: "Design Studio", category: "MEMBER", severity: "INFO", at: "2025-08-25T10:00:00Z", ip: "103.21.58.14", location: "Bengaluru, IN", device: "Chrome 128 · macOS" },
  { id: "ae-12", actorId: "m-olivia", action: "created custom role", target: "Delivery Director", category: "ROLE", severity: "WARNING", at: "2026-09-14T15:10:00Z", ip: "81.2.69.160", location: "London, GB", device: "Chrome 129 · macOS" },
];

export const ORG_NOTIFICATIONS: OrgNotification[] = [
  { id: "on-1", title: "Repository sync failing", body: "acme-health/cobalt-dbt has failed 6 webhook deliveries since 22:00 UTC.", kind: "INTEGRATION", at: "2026-11-20T06:00:00Z", read: false, link: "integrations/rp-cobalt-dbt" },
  { id: "on-2", title: "5 failed sign-ins on a disabled account", body: "ken@acme-contractors.io from an unknown location (45.155.205.9).", kind: "SECURITY", at: "2026-11-18T03:15:00Z", read: false, link: "audit-logs/ae-9" },
  { id: "on-3", title: "Cobalt is off track", body: "Progress is 24 points behind plan; delivery date 4 Dec.", kind: "PROJECT", at: "2026-11-17T07:00:00Z", read: false, link: "projects/op-cobalt" },
  { id: "on-4", title: "Invitation expiring soon", body: "tom.becker@acmehealth.io's invitation expires on 22 Nov.", kind: "MEMBER", at: "2026-11-19T09:00:00Z", read: true, link: "invitations/inv-2" },
  { id: "on-5", title: "2 members without MFA", body: "Daniel Okafor and Sofia Novak have not enrolled MFA, which is now required.", kind: "SECURITY", at: "2026-11-11T09:00:00Z", read: true, link: "members" },
];

export const ORG_REPORTS: OrgReport[] = [
  { id: "or-1", title: "Organization health · November", kind: "PORTFOLIO", period: "1–20 Nov 2026", generatedAt: "2026-11-20T07:00:00Z", summary: "8 projects: 4 on track, 3 at risk, 1 off track. Average progress 53% against 59% planned.", highlights: ["Gaia Design System delivered on time", "Cobalt slipped 3 points this week", "Helix on hold pending legal review"], metrics: [{ label: "Avg progress", value: "53%" }, { label: "Open risks", value: "7" }, { label: "Off track", value: "1" }], audience: ["owner", "admin"] },
  { id: "or-2", title: "People & access review · Q4", kind: "ACCESS", period: "Q4 2026", generatedAt: "2026-11-15T09:00:00Z", summary: "20 members across 9 roles. 2 members lack MFA; 1 contractor disabled; 1 external auditor active until 31 Dec.", highlights: ["Remove Security Auditor role after audit closes", "Enforce MFA for Daniel and Sofia", "Review custom Delivery Director role"], metrics: [{ label: "Members", value: "20" }, { label: "Without MFA", value: "2" }, { label: "Custom roles", value: "2" }], audience: ["owner", "admin"] },
  { id: "or-3", title: "Team capacity snapshot", kind: "PEOPLE", period: "Week 46", generatedAt: "2026-11-16T18:00:00Z", summary: "Platform Squad carries 4 of 8 projects. Data Guild has one engineer on the critical path.", highlights: ["Rebalance Cobalt work", "Design Studio has spare capacity"], metrics: [{ label: "Teams", value: "4" }, { label: "Avg team size", value: "4" }, { label: "Projects / team", value: "2" }], audience: ["owner", "admin"] },
  { id: "or-4", title: "GitHub integration health", kind: "INTEGRATION", period: "Last 7 days", generatedAt: "2026-11-20T06:30:00Z", summary: "8 repositories connected; 1 failing (token rotation), 1 paused. Webhook success 96%.", highlights: ["Re-authorize cobalt-dbt webhook", "Resume ember-auth after rotation"], metrics: [{ label: "Repos", value: "8" }, { label: "Failing", value: "1" }, { label: "Webhook success", value: "96%" }], audience: ["owner", "admin"] },
  { id: "or-5", title: "Security & audit summary · Q3", kind: "AUDIT", period: "Jul–Sep 2026", generatedAt: "2026-10-02T08:00:00Z", summary: "412 audit events, 9 warnings, 2 critical (both resolved). Prepared for SOC 2 Type II.", highlights: ["MFA enforcement rolled out", "External auditor onboarded"], metrics: [{ label: "Events", value: "412" }, { label: "Critical", value: "2" }, { label: "Resolved", value: "100%" }], audience: ["owner"] },
];

export const PRIVACY_SETTINGS: PrivacySettings = {
  auditRetentionDays: 730,
  activityRetentionDays: 365,
  deletedMemberRetentionDays: 30,
  exportRequests: [
    { id: "ex-1", requestedById: "m-olivia", scope: "Full organization export", requestedAt: "2026-11-12T10:00:00Z", status: "READY" },
    { id: "ex-2", requestedById: "m-victor", scope: "Audit log Q3 2026", requestedAt: "2026-11-17T13:18:00Z", status: "EXPIRED" },
  ],
  deletionRequests: [
    { id: "dr-1", subject: "Former contractor · j.doe@acme-contractors.io", requestedAt: "2026-11-14T09:00:00Z", status: "PENDING", dueAt: "2026-12-14" },
    { id: "dr-2", subject: "Former employee · m.ross@acmehealth.io", requestedAt: "2026-10-01T09:00:00Z", status: "COMPLETED", dueAt: "2026-10-31" },
  ],
  subProcessors: [
    { name: "AWS", purpose: "Hosting & database", region: "eu-central-1" },
    { name: "GitHub", purpose: "Repository evidence", region: "US / EU" },
    { name: "Postmark", purpose: "Transactional email", region: "US" },
  ],
};

/* ----------------------------------------------------------------------------
 * Chart series
 * ------------------------------------------------------------------------- */

export const MEMBER_GROWTH = [
  { month: "Jun", members: 13, invites: 3 },
  { month: "Jul", members: 14, invites: 2 },
  { month: "Aug", members: 15, invites: 3 },
  { month: "Sep", members: 17, invites: 4 },
  { month: "Oct", members: 18, invites: 2 },
  { month: "Nov", members: 20, invites: 5 },
];

export const AUDIT_ACTIVITY = [
  { label: "W41", primary: 38, secondary: 2 },
  { label: "W42", primary: 44, secondary: 1 },
  { label: "W43", primary: 31, secondary: 3 },
  { label: "W44", primary: 52, secondary: 2 },
  { label: "W45", primary: 47, secondary: 4 },
  { label: "W46", primary: 41, secondary: 3 },
];

export const SYNC_EVENTS = [
  { label: "Mon", primary: 412, secondary: 3 },
  { label: "Tue", primary: 455, secondary: 1 },
  { label: "Wed", primary: 398, secondary: 6 },
  { label: "Thu", primary: 470, secondary: 9 },
  { label: "Fri", primary: 220, secondary: 6 },
];

/* ----------------------------------------------------------------------------
 * Task 1.3 · Roles & Permissions API fixture (dev only, used when the API is unreachable
 * and mocks are allowed). Shapes follow the real snake_case API; template permissions come
 * from FIXTURE_GRANTS (the shared mock JSON), so nothing here grants by role name.
 * ------------------------------------------------------------------------- */

export const ROLE_TEMPLATE_IDS = {
  ORGANIZATION_OWNER: "10000000-0000-0000-0000-000000000001",
  ORGANIZATION_ADMIN: "10000000-0000-0000-0000-000000000002",
  PROJECT_MANAGER: "10000000-0000-0000-0000-000000000003",
  TEAM_LEAD: "10000000-0000-0000-0000-000000000004",
  DEVELOPER: "10000000-0000-0000-0000-000000000005",
  QA_REVIEWER: "10000000-0000-0000-0000-000000000006",
  VIEWER: "10000000-0000-0000-0000-000000000007",
} as const;

export const API_CUSTOM_ROLE_FIXTURES = [
  {
    id: "7b0d3a1e-2f4c-4d7a-9c1e-5a8b6c3d2e10",
    name: "Security Auditor",
    template: false,
    owner_only: false,
    version: 2,
    grant_count: 1,
    permission_keys: ["audit.read", "repo.read", "report.export"],
  },
  {
    id: "3c9e8f72-1a5b-4e6d-8f0a-2b7c9d1e4f55",
    name: "Release Coordinator",
    template: false,
    owner_only: false,
    version: 0,
    grant_count: 0,
    permission_keys: ["project.read", "task.assign", "repo.read"],
  },
];

export const API_MEMBER_FIXTURES = [
  { id: "a1f0c2d3-0000-4000-8000-000000000001", display_name: "olivia@acmehealth.io", email: "olivia@acmehealth.io", status: "ACTIVE", role_template: "ORGANIZATION_OWNER" },
  { id: "a1f0c2d3-0000-4000-8000-000000000002", display_name: "rahul@acmehealth.io", email: "rahul@acmehealth.io", status: "ACTIVE", role_template: "ORGANIZATION_ADMIN" },
  { id: "a1f0c2d3-0000-4000-8000-000000000003", display_name: "priya@acmehealth.io", email: "priya@acmehealth.io", status: "ACTIVE", role_template: "PROJECT_MANAGER" },
  { id: "a1f0c2d3-0000-4000-8000-000000000004", display_name: "aisha@acmehealth.io", email: "aisha@acmehealth.io", status: "ACTIVE", role_template: "DEVELOPER" },
  { id: "a1f0c2d3-0000-4000-8000-000000000005", display_name: "victor@trustline-audit.com", email: "victor@trustline-audit.com", status: "ACTIVE", role_template: "VIEWER" },
  { id: "a1f0c2d3-0000-4000-8000-000000000006", display_name: "ken@acme-contractors.io", email: "ken@acme-contractors.io", status: "DISABLED", role_template: "DEVELOPER" },
];

export const API_GRANT_FIXTURES = [
  { id: "g-0001", membership_id: "a1f0c2d3-0000-4000-8000-000000000001", template_role_id: ROLE_TEMPLATE_IDS.ORGANIZATION_OWNER, org_role_id: null, role_name: "ORGANIZATION_OWNER", scope: "ORG" as const, scope_id: null, expires_at: null, version: 0 },
  { id: "g-0002", membership_id: "a1f0c2d3-0000-4000-8000-000000000002", template_role_id: ROLE_TEMPLATE_IDS.ORGANIZATION_ADMIN, org_role_id: null, role_name: "ORGANIZATION_ADMIN", scope: "ORG" as const, scope_id: null, expires_at: null, version: 0 },
  { id: "g-0003", membership_id: "a1f0c2d3-0000-4000-8000-000000000003", template_role_id: ROLE_TEMPLATE_IDS.PROJECT_MANAGER, org_role_id: null, role_name: "PROJECT_MANAGER", scope: "ORG" as const, scope_id: null, expires_at: null, version: 0 },
  { id: "g-0004", membership_id: "a1f0c2d3-0000-4000-8000-000000000004", template_role_id: ROLE_TEMPLATE_IDS.DEVELOPER, org_role_id: null, role_name: "DEVELOPER", scope: "PROJECT" as const, scope_id: "5f6e7d8c-0000-4000-8000-00000000a7a5", expires_at: null, version: 0 },
  { id: "g-0005", membership_id: "a1f0c2d3-0000-4000-8000-000000000005", template_role_id: null, org_role_id: "7b0d3a1e-2f4c-4d7a-9c1e-5a8b6c3d2e10", role_name: "Security Auditor", scope: "ORG" as const, scope_id: null, expires_at: "2026-12-31T23:59:00Z", version: 1 },
];
