/**
 * Sample data for the Project Manager, Team Lead and QA / Reviewer workspaces.
 *
 * Every dashboard and page for those three roles reads from this one file
 * (through `src/store/delivery-store.ts`). Nothing here is typed inside components.
 * Dates are fixed around DEMO_TODAY so "today", "overdue" and "waiting" stay stable.
 */

export const DEMO_TODAY = "2026-11-20";
export const DEMO_NOW = "2026-11-20T10:30:00Z";

/* ----------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export type Health = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";
export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED";
export type DeliveryMode = "STRUCTURED" | "INDIVIDUAL";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "BLOCKED" | "DONE";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Person {
  id: string;
  name: string;
  initials: string;
  title: string;
  teamId: string;
  email: string;
  location: string;
  capacityHours: number;
  assignedHours: number;
  skills: string[];
  color: string;
}

export interface Team {
  id: string;
  name: string;
  leadId: string;
  focus: string;
  memberIds: string[];
}

export interface Milestone {
  id: string;
  name: string;
  dueDate: string;
  status: "DONE" | "IN_PROGRESS" | "UPCOMING" | "LATE";
  progress: number;
}

export interface Risk {
  id: string;
  title: string;
  severity: Severity;
  ownerId: string;
  mitigation: string;
  raisedAt: string;
}

export interface Project {
  id: string;
  code: string;
  name: string;
  client: string;
  mode: DeliveryMode;
  status: ProjectStatus;
  health: Health;
  progress: number;
  plannedProgress: number;
  startDate: string;
  dueDate: string;
  managerId: string;
  teamId: string;
  memberIds: string[];
  budgetUsed: number;
  description: string;
  milestones: Milestone[];
  risks: Risk[];
  progressTrend: { week: string; actual: number; planned: number }[];
  color: string;
}

export interface Task {
  id: string;
  key: string;
  title: string;
  projectId: string;
  assigneeId: string | null;
  teamId: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string;
  estimateHours: number;
  weight: number;
  progress: number;
  description: string;
  updatedAt: string;
}

export interface Blocker {
  id: string;
  title: string;
  taskId: string;
  projectId: string;
  ownerId: string;
  raisedById: string;
  severity: Severity;
  raisedAt: string;
  status: "OPEN" | "RESOLVED";
  note: string;
  resolution?: string;
}

export interface ScopeChange {
  id: string;
  code: string;
  projectId: string;
  title: string;
  requestedBy: string;
  requestedAt: string;
  impactDays: number;
  impactHours: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reason: string;
  decisionNote?: string;
}

export interface CheckIn {
  id: string;
  memberId: string;
  dueAt: string;
  status: "DUE" | "OVERDUE" | "SUBMITTED";
  lastSummary: string;
  confidence: number;
}

export interface Dependency {
  id: string;
  fromTaskId: string;
  toTaskId: string;
  kind: "BLOCKS" | "NEEDS_INPUT" | "SHARED_COMPONENT";
  status: "OPEN" | "AT_RISK" | "RESOLVED";
  external: boolean;
  note: string;
}

export interface Report {
  id: string;
  title: string;
  kind: "STATUS" | "PORTFOLIO" | "WORKLOAD" | "RISK";
  period: string;
  generatedAt: string;
  summary: string;
  highlights: string[];
  metrics: { label: string; value: string }[];
}

export type ReviewStatus = "PENDING" | "APPROVED" | "CHANGES_REQUESTED";

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface Review {
  id: string;
  code: string;
  taskId: string;
  projectId: string;
  submittedById: string;
  reviewerId: string;
  submittedAt: string;
  status: ReviewStatus;
  priority: Priority;
  summary: string;
  evidenceIds: string[];
  checklist: ChecklistItem[];
  decidedAt?: string;
  reason?: string;
  round: number;
}

export type EvidenceType = "PULL_REQUEST" | "TEST_REPORT" | "SCREENSHOT" | "DEMO_VIDEO" | "DOCUMENT";

export interface Evidence {
  id: string;
  reviewId: string;
  type: EvidenceType;
  title: string;
  source: string;
  addedAt: string;
  status: "TO_INSPECT" | "VERIFIED" | "FLAGGED";
  detail: string;
  stats: { label: string; value: string }[];
}

/* ----------------------------------------------------------------------------
 * Viewers (the signed-in person for each role)
 * ------------------------------------------------------------------------- */

export const VIEWERS = {
  manager: { id: "p-priya", name: "Priya Raman", title: "Senior Project Manager" },
  lead: { id: "p-marcus", name: "Marcus Chen", title: "Team Lead · Platform Squad", teamId: "t-platform" },
  reviewer: { id: "p-elena", name: "Elena Ruiz", title: "QA Reviewer" },
} as const;

/* ----------------------------------------------------------------------------
 * People & teams
 * ------------------------------------------------------------------------- */

export const TEAMS: Team[] = [
  { id: "t-platform", name: "Platform Squad", leadId: "p-marcus", focus: "APIs, billing and integrations", memberIds: ["p-marcus", "p-aisha", "p-diego", "p-sofia", "p-liam", "p-yuki"] },
  { id: "t-mobile", name: "Mobile Crew", leadId: "p-hana", focus: "iOS and Android apps", memberIds: ["p-hana", "p-noah", "p-zara"] },
  { id: "t-data", name: "Data Guild", leadId: "p-omar", focus: "Analytics and reporting pipelines", memberIds: ["p-omar", "p-mei"] },
];

export const PEOPLE: Person[] = [
  { id: "p-priya", name: "Priya Raman", initials: "PR", title: "Senior Project Manager", teamId: "t-platform", email: "priya.raman@acme.dev", location: "London", capacityHours: 40, assignedHours: 34, skills: ["Planning", "Stakeholders"], color: "#3B82F6" },
  { id: "p-marcus", name: "Marcus Chen", initials: "MC", title: "Team Lead", teamId: "t-platform", email: "marcus.chen@acme.dev", location: "Toronto", capacityHours: 32, assignedHours: 30, skills: ["Java", "Architecture"], color: "#8B5CF6" },
  { id: "p-elena", name: "Elena Ruiz", initials: "ER", title: "QA Reviewer", teamId: "t-platform", email: "elena.ruiz@acme.dev", location: "Madrid", capacityHours: 40, assignedHours: 36, skills: ["Test design", "Accessibility"], color: "#EC4899" },
  { id: "p-aisha", name: "Aisha Bello", initials: "AB", title: "Backend Engineer", teamId: "t-platform", email: "aisha.bello@acme.dev", location: "Lagos", capacityHours: 40, assignedHours: 46, skills: ["Spring Boot", "PostgreSQL"], color: "#10B981" },
  { id: "p-diego", name: "Diego Alvarez", initials: "DA", title: "Frontend Engineer", teamId: "t-platform", email: "diego.alvarez@acme.dev", location: "Mexico City", capacityHours: 40, assignedHours: 38, skills: ["React", "Next.js"], color: "#F59E0B" },
  { id: "p-sofia", name: "Sofia Novak", initials: "SN", title: "Full-stack Engineer", teamId: "t-platform", email: "sofia.novak@acme.dev", location: "Prague", capacityHours: 32, assignedHours: 22, skills: ["TypeScript", "Java"], color: "#06B6D4" },
  { id: "p-liam", name: "Liam O'Connor", initials: "LO", title: "DevOps Engineer", teamId: "t-platform", email: "liam.oconnor@acme.dev", location: "Dublin", capacityHours: 40, assignedHours: 44, skills: ["Kubernetes", "CI/CD"], color: "#EF4444" },
  { id: "p-yuki", name: "Yuki Tanaka", initials: "YT", title: "Backend Engineer", teamId: "t-platform", email: "yuki.tanaka@acme.dev", location: "Osaka", capacityHours: 40, assignedHours: 28, skills: ["Kotlin", "Kafka"], color: "#14B8A6" },
  { id: "p-hana", name: "Hana Kim", initials: "HK", title: "Team Lead", teamId: "t-mobile", email: "hana.kim@acme.dev", location: "Seoul", capacityHours: 36, assignedHours: 33, skills: ["Swift", "Kotlin"], color: "#A855F7" },
  { id: "p-noah", name: "Noah Williams", initials: "NW", title: "iOS Engineer", teamId: "t-mobile", email: "noah.williams@acme.dev", location: "Austin", capacityHours: 40, assignedHours: 41, skills: ["SwiftUI"], color: "#0EA5E9" },
  { id: "p-zara", name: "Zara Ahmed", initials: "ZA", title: "Android Engineer", teamId: "t-mobile", email: "zara.ahmed@acme.dev", location: "Dubai", capacityHours: 40, assignedHours: 31, skills: ["Jetpack Compose"], color: "#F97316" },
  { id: "p-omar", name: "Omar Haddad", initials: "OH", title: "Team Lead", teamId: "t-data", email: "omar.haddad@acme.dev", location: "Amman", capacityHours: 36, assignedHours: 35, skills: ["dbt", "Python"], color: "#22C55E" },
  { id: "p-mei", name: "Mei Lin", initials: "ML", title: "Data Engineer", teamId: "t-data", email: "mei.lin@acme.dev", location: "Singapore", capacityHours: 40, assignedHours: 37, skills: ["Airflow", "SQL"], color: "#E11D48" },
];

/* ----------------------------------------------------------------------------
 * Projects
 * ------------------------------------------------------------------------- */

export const PROJECTS: Project[] = [
  {
    id: "prj-atlas", code: "ATL", name: "Atlas Billing Revamp", client: "Northwind Retail", mode: "STRUCTURED", status: "ACTIVE", health: "AT_RISK",
    progress: 58, plannedProgress: 70, startDate: "2026-08-03", dueDate: "2026-12-18", managerId: "p-priya", teamId: "t-platform",
    memberIds: ["p-marcus", "p-aisha", "p-diego", "p-sofia", "p-liam", "p-elena"], budgetUsed: 64, color: "#3B82F6",
    description: "Replace the legacy invoicing engine with usage-based billing, tax handling and self-serve invoices.",
    milestones: [
      { id: "ms-atl-1", name: "Pricing model signed off", dueDate: "2026-08-28", status: "DONE", progress: 100 },
      { id: "ms-atl-2", name: "Metering service live", dueDate: "2026-10-16", status: "DONE", progress: 100 },
      { id: "ms-atl-3", name: "Invoice generation beta", dueDate: "2026-11-27", status: "IN_PROGRESS", progress: 62 },
      { id: "ms-atl-4", name: "Customer migration", dueDate: "2026-12-18", status: "UPCOMING", progress: 10 },
    ],
    risks: [
      { id: "rk-atl-1", title: "Tax provider sandbox unstable", severity: "HIGH", ownerId: "p-aisha", mitigation: "Mock adapter in place; escalated to vendor account team.", raisedAt: "2026-11-12" },
      { id: "rk-atl-2", title: "Migration window overlaps holiday freeze", severity: "MEDIUM", ownerId: "p-priya", mitigation: "Proposed migration dry-run on 4 Dec.", raisedAt: "2026-11-15" },
    ],
    progressTrend: [
      { week: "W40", actual: 22, planned: 25 }, { week: "W41", actual: 28, planned: 32 }, { week: "W42", actual: 35, planned: 40 },
      { week: "W43", actual: 41, planned: 48 }, { week: "W44", actual: 47, planned: 55 }, { week: "W45", actual: 52, planned: 62 }, { week: "W46", actual: 58, planned: 70 },
    ],
  },
  {
    id: "prj-beacon", code: "BCN", name: "Beacon Mobile App 3.0", client: "Helio Health", mode: "STRUCTURED", status: "ACTIVE", health: "ON_TRACK",
    progress: 74, plannedProgress: 72, startDate: "2026-07-13", dueDate: "2027-01-22", managerId: "p-priya", teamId: "t-mobile",
    memberIds: ["p-hana", "p-noah", "p-zara", "p-elena"], budgetUsed: 61, color: "#10B981",
    description: "Redesigned patient app with offline appointments, secure messaging and Apple Health sync.",
    milestones: [
      { id: "ms-bcn-1", name: "Design system v2", dueDate: "2026-08-21", status: "DONE", progress: 100 },
      { id: "ms-bcn-2", name: "Offline appointments", dueDate: "2026-10-30", status: "DONE", progress: 100 },
      { id: "ms-bcn-3", name: "Secure messaging", dueDate: "2026-12-11", status: "IN_PROGRESS", progress: 70 },
      { id: "ms-bcn-4", name: "Store release", dueDate: "2027-01-22", status: "UPCOMING", progress: 0 },
    ],
    risks: [{ id: "rk-bcn-1", title: "App Store review lead time", severity: "LOW", ownerId: "p-hana", mitigation: "Submit TestFlight build two weeks early.", raisedAt: "2026-11-02" }],
    progressTrend: [
      { week: "W40", actual: 40, planned: 40 }, { week: "W41", actual: 46, planned: 45 }, { week: "W42", actual: 52, planned: 51 },
      { week: "W43", actual: 58, planned: 57 }, { week: "W44", actual: 63, planned: 62 }, { week: "W45", actual: 69, planned: 67 }, { week: "W46", actual: 74, planned: 72 },
    ],
  },
  {
    id: "prj-cobalt", code: "CBT", name: "Cobalt Data Warehouse", client: "Internal · Finance", mode: "STRUCTURED", status: "ACTIVE", health: "OFF_TRACK",
    progress: 31, plannedProgress: 55, startDate: "2026-09-01", dueDate: "2026-12-04", managerId: "p-priya", teamId: "t-data",
    memberIds: ["p-omar", "p-mei", "p-yuki"], budgetUsed: 72, color: "#EF4444",
    description: "Consolidate finance reporting into a governed warehouse with daily refreshed revenue models.",
    milestones: [
      { id: "ms-cbt-1", name: "Source inventory", dueDate: "2026-09-19", status: "DONE", progress: 100 },
      { id: "ms-cbt-2", name: "Ingestion pipelines", dueDate: "2026-11-06", status: "LATE", progress: 55 },
      { id: "ms-cbt-3", name: "Revenue models", dueDate: "2026-12-04", status: "UPCOMING", progress: 5 },
    ],
    risks: [
      { id: "rk-cbt-1", title: "ERP export access still pending", severity: "CRITICAL", ownerId: "p-omar", mitigation: "Escalated to Finance IT director; daily follow-up.", raisedAt: "2026-11-04" },
      { id: "rk-cbt-2", title: "Single data engineer on critical path", severity: "HIGH", ownerId: "p-priya", mitigation: "Borrow Yuki from Platform Squad for 2 sprints.", raisedAt: "2026-11-10" },
    ],
    progressTrend: [
      { week: "W40", actual: 8, planned: 12 }, { week: "W41", actual: 12, planned: 20 }, { week: "W42", actual: 17, planned: 28 },
      { week: "W43", actual: 21, planned: 35 }, { week: "W44", actual: 24, planned: 42 }, { week: "W45", actual: 28, planned: 49 }, { week: "W46", actual: 31, planned: 55 },
    ],
  },
  {
    id: "prj-delta", code: "DLT", name: "Delta Partner Portal", client: "Orbit Logistics", mode: "INDIVIDUAL", status: "ACTIVE", health: "ON_TRACK",
    progress: 86, plannedProgress: 82, startDate: "2026-09-14", dueDate: "2026-12-11", managerId: "p-priya", teamId: "t-platform",
    memberIds: ["p-sofia"], budgetUsed: 70, color: "#8B5CF6",
    description: "Single-developer partner portal for shipment tracking, documents and invoice download.",
    milestones: [
      { id: "ms-dlt-1", name: "Auth and onboarding", dueDate: "2026-10-09", status: "DONE", progress: 100 },
      { id: "ms-dlt-2", name: "Tracking timeline", dueDate: "2026-11-13", status: "DONE", progress: 100 },
      { id: "ms-dlt-3", name: "Documents and handover", dueDate: "2026-12-11", status: "IN_PROGRESS", progress: 60 },
    ],
    risks: [],
    progressTrend: [
      { week: "W40", actual: 34, planned: 30 }, { week: "W41", actual: 45, planned: 40 }, { week: "W42", actual: 55, planned: 50 },
      { week: "W43", actual: 63, planned: 60 }, { week: "W44", actual: 72, planned: 68 }, { week: "W45", actual: 80, planned: 76 }, { week: "W46", actual: 86, planned: 82 },
    ],
  },
  {
    id: "prj-ember", code: "EMB", name: "Ember Identity & SSO", client: "Internal · Security", mode: "STRUCTURED", status: "ACTIVE", health: "AT_RISK",
    progress: 44, plannedProgress: 50, startDate: "2026-10-05", dueDate: "2027-02-12", managerId: "p-priya", teamId: "t-platform",
    memberIds: ["p-marcus", "p-yuki", "p-liam", "p-elena"], budgetUsed: 38, color: "#F59E0B",
    description: "SAML / OIDC single sign-on, SCIM provisioning and session hardening for enterprise tenants.",
    milestones: [
      { id: "ms-emb-1", name: "OIDC provider", dueDate: "2026-11-13", status: "DONE", progress: 100 },
      { id: "ms-emb-2", name: "SAML + SCIM", dueDate: "2026-12-23", status: "IN_PROGRESS", progress: 35 },
      { id: "ms-emb-3", name: "Security review", dueDate: "2027-02-12", status: "UPCOMING", progress: 0 },
    ],
    risks: [{ id: "rk-emb-1", title: "SCIM spec gaps with Okta tenant", severity: "MEDIUM", ownerId: "p-yuki", mitigation: "Pairing session with Okta solutions engineer on 24 Nov.", raisedAt: "2026-11-17" }],
    progressTrend: [
      { week: "W41", actual: 5, planned: 6 }, { week: "W42", actual: 12, planned: 14 }, { week: "W43", actual: 20, planned: 22 },
      { week: "W44", actual: 28, planned: 31 }, { week: "W45", actual: 37, planned: 41 }, { week: "W46", actual: 44, planned: 50 },
    ],
  },
  {
    id: "prj-fjord", code: "FJD", name: "Fjord Support Console", client: "Nordic Telecom", mode: "STRUCTURED", status: "PLANNING", health: "ON_TRACK",
    progress: 8, plannedProgress: 8, startDate: "2026-11-16", dueDate: "2027-03-26", managerId: "p-priya", teamId: "t-platform",
    memberIds: ["p-diego", "p-aisha"], budgetUsed: 4, color: "#06B6D4",
    description: "Agent console with unified ticket inbox, customer timeline and macro library.",
    milestones: [
      { id: "ms-fjd-1", name: "Discovery and scope", dueDate: "2026-12-04", status: "IN_PROGRESS", progress: 40 },
      { id: "ms-fjd-2", name: "Inbox MVP", dueDate: "2027-02-05", status: "UPCOMING", progress: 0 },
    ],
    risks: [],
    progressTrend: [{ week: "W46", actual: 8, planned: 8 }],
  },
];

/* ----------------------------------------------------------------------------
 * Tasks
 * ------------------------------------------------------------------------- */

export const TASKS: Task[] = [
  { id: "tk-101", key: "ATL-101", title: "Invoice PDF renderer with tax lines", projectId: "prj-atlas", assigneeId: "p-aisha", teamId: "t-platform", status: "IN_PROGRESS", priority: "HIGH", dueDate: "2026-11-20", estimateHours: 16, weight: 8, progress: 70, description: "Render invoices with per-line tax, currency rounding rules and localized dates.", updatedAt: "2026-11-20T08:12:00Z" },
  { id: "tk-102", key: "ATL-102", title: "Usage aggregation nightly job", projectId: "prj-atlas", assigneeId: "p-yuki", teamId: "t-platform", status: "IN_REVIEW", priority: "HIGH", dueDate: "2026-11-21", estimateHours: 12, weight: 6, progress: 95, description: "Aggregate metered usage per customer per day; idempotent re-runs.", updatedAt: "2026-11-19T17:40:00Z" },
  { id: "tk-103", key: "ATL-103", title: "Tax provider adapter retries", projectId: "prj-atlas", assigneeId: "p-aisha", teamId: "t-platform", status: "BLOCKED", priority: "CRITICAL", dueDate: "2026-11-18", estimateHours: 10, weight: 5, progress: 40, description: "Exponential backoff and dead-letter for the tax provider calls.", updatedAt: "2026-11-18T15:05:00Z" },
  { id: "tk-104", key: "ATL-104", title: "Self-serve invoice history page", projectId: "prj-atlas", assigneeId: "p-diego", teamId: "t-platform", status: "IN_PROGRESS", priority: "MEDIUM", dueDate: "2026-11-24", estimateHours: 14, weight: 5, progress: 45, description: "List, filter and download invoices from the customer portal.", updatedAt: "2026-11-20T09:00:00Z" },
  { id: "tk-105", key: "ATL-105", title: "Proration rules for plan changes", projectId: "prj-atlas", assigneeId: "p-sofia", teamId: "t-platform", status: "TODO", priority: "HIGH", dueDate: "2026-11-26", estimateHours: 18, weight: 7, progress: 0, description: "Daily proration when customers upgrade or downgrade mid-cycle.", updatedAt: "2026-11-17T11:30:00Z" },
  { id: "tk-106", key: "ATL-106", title: "Billing alerts in Grafana", projectId: "prj-atlas", assigneeId: "p-liam", teamId: "t-platform", status: "DONE", priority: "MEDIUM", dueDate: "2026-11-14", estimateHours: 6, weight: 3, progress: 100, description: "Dashboards and alerts for failed invoice runs.", updatedAt: "2026-11-14T16:20:00Z" },
  { id: "tk-107", key: "ATL-107", title: "Migration dry-run script", projectId: "prj-atlas", assigneeId: null, teamId: "t-platform", status: "TODO", priority: "HIGH", dueDate: "2026-12-02", estimateHours: 12, weight: 6, progress: 0, description: "Copy 5% of customers to the new engine and diff invoices.", updatedAt: "2026-11-19T10:00:00Z" },
  { id: "tk-108", key: "ATL-108", title: "Credit note workflow", projectId: "prj-atlas", assigneeId: "p-diego", teamId: "t-platform", status: "TODO", priority: "MEDIUM", dueDate: "2026-11-19", estimateHours: 10, weight: 4, progress: 10, description: "Issue credit notes from support console with approval.", updatedAt: "2026-11-16T13:45:00Z" },
  { id: "tk-201", key: "BCN-201", title: "Secure messaging thread list", projectId: "prj-beacon", assigneeId: "p-noah", teamId: "t-mobile", status: "IN_PROGRESS", priority: "HIGH", dueDate: "2026-11-25", estimateHours: 16, weight: 6, progress: 60, description: "Thread list with unread counts and end-to-end encryption badges.", updatedAt: "2026-11-20T07:50:00Z" },
  { id: "tk-202", key: "BCN-202", title: "Android push notification channels", projectId: "prj-beacon", assigneeId: "p-zara", teamId: "t-mobile", status: "IN_REVIEW", priority: "MEDIUM", dueDate: "2026-11-21", estimateHours: 8, weight: 3, progress: 90, description: "Separate channels for reminders, messages and results.", updatedAt: "2026-11-19T14:10:00Z" },
  { id: "tk-203", key: "BCN-203", title: "Apple Health sync consent flow", projectId: "prj-beacon", assigneeId: "p-noah", teamId: "t-mobile", status: "DONE", priority: "HIGH", dueDate: "2026-11-13", estimateHours: 12, weight: 5, progress: 100, description: "Granular HealthKit consent with revoke option.", updatedAt: "2026-11-13T12:00:00Z" },
  { id: "tk-204", key: "BCN-204", title: "Offline queue conflict handling", projectId: "prj-beacon", assigneeId: "p-zara", teamId: "t-mobile", status: "TODO", priority: "HIGH", dueDate: "2026-11-28", estimateHours: 14, weight: 6, progress: 0, description: "Resolve appointment edits made offline on two devices.", updatedAt: "2026-11-18T09:30:00Z" },
  { id: "tk-301", key: "CBT-301", title: "ERP ledger ingestion pipeline", projectId: "prj-cobalt", assigneeId: "p-mei", teamId: "t-data", status: "BLOCKED", priority: "CRITICAL", dueDate: "2026-11-06", estimateHours: 20, weight: 9, progress: 35, description: "Daily incremental load of general ledger entries.", updatedAt: "2026-11-15T10:10:00Z" },
  { id: "tk-302", key: "CBT-302", title: "CRM opportunities connector", projectId: "prj-cobalt", assigneeId: "p-yuki", teamId: "t-data", status: "IN_PROGRESS", priority: "HIGH", dueDate: "2026-11-17", estimateHours: 14, weight: 6, progress: 55, description: "Incremental sync of opportunities and line items.", updatedAt: "2026-11-19T16:00:00Z" },
  { id: "tk-303", key: "CBT-303", title: "Revenue recognition model", projectId: "prj-cobalt", assigneeId: "p-omar", teamId: "t-data", status: "TODO", priority: "HIGH", dueDate: "2026-12-01", estimateHours: 24, weight: 10, progress: 0, description: "dbt model for monthly recognized revenue by product line.", updatedAt: "2026-11-12T08:00:00Z" },
  { id: "tk-304", key: "CBT-304", title: "Data quality tests for ledger", projectId: "prj-cobalt", assigneeId: "p-mei", teamId: "t-data", status: "IN_REVIEW", priority: "MEDIUM", dueDate: "2026-11-22", estimateHours: 8, weight: 3, progress: 90, description: "Uniqueness, freshness and balance checks.", updatedAt: "2026-11-19T18:20:00Z" },
  { id: "tk-401", key: "DLT-401", title: "Document vault with previews", projectId: "prj-delta", assigneeId: "p-sofia", teamId: "t-platform", status: "IN_PROGRESS", priority: "MEDIUM", dueDate: "2026-11-27", estimateHours: 16, weight: 6, progress: 65, description: "Upload, preview and share shipment documents.", updatedAt: "2026-11-20T09:40:00Z" },
  { id: "tk-402", key: "DLT-402", title: "Handover runbook", projectId: "prj-delta", assigneeId: "p-sofia", teamId: "t-platform", status: "TODO", priority: "LOW", dueDate: "2026-12-08", estimateHours: 6, weight: 2, progress: 0, description: "Operational runbook and support contacts for Orbit.", updatedAt: "2026-11-15T12:00:00Z" },
  { id: "tk-501", key: "EMB-501", title: "SAML assertion validation", projectId: "prj-ember", assigneeId: "p-yuki", teamId: "t-platform", status: "IN_PROGRESS", priority: "CRITICAL", dueDate: "2026-11-20", estimateHours: 14, weight: 7, progress: 50, description: "Signature, audience and clock-skew validation with test vectors.", updatedAt: "2026-11-20T08:45:00Z" },
  { id: "tk-502", key: "EMB-502", title: "SCIM user provisioning endpoint", projectId: "prj-ember", assigneeId: "p-marcus", teamId: "t-platform", status: "IN_PROGRESS", priority: "HIGH", dueDate: "2026-11-27", estimateHours: 18, weight: 8, progress: 30, description: "Create, update and deactivate users via SCIM 2.0.", updatedAt: "2026-11-19T15:30:00Z" },
  { id: "tk-503", key: "EMB-503", title: "Session revocation on role change", projectId: "prj-ember", assigneeId: "p-liam", teamId: "t-platform", status: "IN_REVIEW", priority: "HIGH", dueDate: "2026-11-20", estimateHours: 8, weight: 4, progress: 95, description: "Invalidate active sessions when a membership role changes.", updatedAt: "2026-11-19T19:05:00Z" },
  { id: "tk-504", key: "EMB-504", title: "SSO admin settings screen", projectId: "prj-ember", assigneeId: "p-diego", teamId: "t-platform", status: "TODO", priority: "MEDIUM", dueDate: "2026-12-03", estimateHours: 12, weight: 5, progress: 0, description: "Configure IdP metadata, test connection and enforce SSO.", updatedAt: "2026-11-18T10:15:00Z" },
  { id: "tk-505", key: "EMB-505", title: "Hardware key enrollment spike", projectId: "prj-ember", assigneeId: null, teamId: "t-platform", status: "TODO", priority: "LOW", dueDate: "2026-12-10", estimateHours: 6, weight: 2, progress: 0, description: "Evaluate WebAuthn enrollment UX for admins.", updatedAt: "2026-11-18T10:20:00Z" },
  { id: "tk-601", key: "FJD-601", title: "Inbox information architecture", projectId: "prj-fjord", assigneeId: "p-diego", teamId: "t-platform", status: "IN_PROGRESS", priority: "MEDIUM", dueDate: "2026-11-28", estimateHours: 10, weight: 4, progress: 35, description: "Wireframes and navigation model for the agent inbox.", updatedAt: "2026-11-19T11:00:00Z" },
  { id: "tk-602", key: "FJD-602", title: "Ticket API discovery", projectId: "prj-fjord", assigneeId: "p-aisha", teamId: "t-platform", status: "TODO", priority: "LOW", dueDate: "2026-12-04", estimateHours: 8, weight: 3, progress: 0, description: "Map Nordic Telecom ticket API and rate limits.", updatedAt: "2026-11-17T09:00:00Z" },
];

/* ----------------------------------------------------------------------------
 * Blockers, scope changes, check-ins, dependencies
 * ------------------------------------------------------------------------- */

export const BLOCKERS: Blocker[] = [
  { id: "bl-1", title: "Tax provider sandbox returns 503 for EU addresses", taskId: "tk-103", projectId: "prj-atlas", ownerId: "p-aisha", raisedById: "p-aisha", severity: "CRITICAL", raisedAt: "2026-11-16T09:20:00Z", status: "OPEN", note: "Vendor ticket #48211 open. Workaround: stubbed responses for EU in staging." },
  { id: "bl-2", title: "ERP export credentials not issued", taskId: "tk-301", projectId: "prj-cobalt", ownerId: "p-omar", raisedById: "p-mei", severity: "CRITICAL", raisedAt: "2026-11-04T13:00:00Z", status: "OPEN", note: "Finance IT approval pending for 16 days." },
  { id: "bl-3", title: "Okta test tenant lacks SCIM push", taskId: "tk-502", projectId: "prj-ember", ownerId: "p-marcus", raisedById: "p-marcus", severity: "HIGH", raisedAt: "2026-11-18T10:45:00Z", status: "OPEN", note: "Requested upgraded developer tenant from Okta." },
  { id: "bl-4", title: "Design for credit note approval missing", taskId: "tk-108", projectId: "prj-atlas", ownerId: "p-priya", raisedById: "p-diego", severity: "MEDIUM", raisedAt: "2026-11-19T15:10:00Z", status: "OPEN", note: "Waiting on product design review slot." },
  { id: "bl-5", title: "Push certificate expired in staging", taskId: "tk-202", projectId: "prj-beacon", ownerId: "p-hana", raisedById: "p-zara", severity: "LOW", raisedAt: "2026-11-10T08:30:00Z", status: "RESOLVED", note: "Rotated certificate.", resolution: "New APNs key uploaded on 11 Nov." },
];

export const SCOPE_CHANGES: ScopeChange[] = [
  { id: "sc-1", code: "SC-031", projectId: "prj-atlas", title: "Add multi-currency invoices (EUR, GBP)", requestedBy: "Northwind Retail · CFO", requestedAt: "2026-11-14", impactDays: 8, impactHours: 64, status: "PENDING", reason: "EU expansion launches in Q1; invoices must show local currency." },
  { id: "sc-2", code: "SC-032", projectId: "prj-beacon", title: "Video consultation entry point", requestedBy: "Helio Health · Product", requestedAt: "2026-11-11", impactDays: 5, impactHours: 40, status: "PENDING", reason: "Partner clinic pilot requires a deep link into video calls." },
  { id: "sc-3", code: "SC-029", projectId: "prj-cobalt", title: "Drop marketing attribution models", requestedBy: "Finance · Controller", requestedAt: "2026-11-03", impactDays: -6, impactHours: -48, status: "APPROVED", reason: "Reduce scope to recover schedule; attribution moves to phase 2.", decisionNote: "Approved to protect the 4 Dec revenue model date." },
  { id: "sc-4", code: "SC-030", projectId: "prj-ember", title: "Support Azure AD as second IdP", requestedBy: "Security · CISO", requestedAt: "2026-11-08", impactDays: 10, impactHours: 80, status: "REJECTED", reason: "Two enterprise prospects use Azure AD.", decisionNote: "Deferred to Q2; not in V1 contract." },
  { id: "sc-5", code: "SC-033", projectId: "prj-delta", title: "CSV export of shipment history", requestedBy: "Orbit Logistics · Ops", requestedAt: "2026-11-18", impactDays: 2, impactHours: 12, status: "PENDING", reason: "Ops team reconciles shipments weekly in spreadsheets." },
];

export const CHECK_INS: CheckIn[] = [
  { id: "ci-1", memberId: "p-aisha", dueAt: "2026-11-20T16:00:00Z", status: "DUE", lastSummary: "PDF renderer handles tax lines; blocked on EU tax calls.", confidence: 62 },
  { id: "ci-2", memberId: "p-diego", dueAt: "2026-11-19T16:00:00Z", status: "OVERDUE", lastSummary: "Invoice history list done; filters in progress.", confidence: 70 },
  { id: "ci-3", memberId: "p-sofia", dueAt: "2026-11-20T16:00:00Z", status: "SUBMITTED", lastSummary: "Document previews working for PDF and images.", confidence: 85 },
  { id: "ci-4", memberId: "p-liam", dueAt: "2026-11-18T16:00:00Z", status: "OVERDUE", lastSummary: "Session revocation in review; starting CI cache work.", confidence: 78 },
  { id: "ci-5", memberId: "p-yuki", dueAt: "2026-11-20T16:00:00Z", status: "DUE", lastSummary: "SAML validation: signature checks done, clock skew next.", confidence: 66 },
  { id: "ci-6", memberId: "p-marcus", dueAt: "2026-11-21T16:00:00Z", status: "DUE", lastSummary: "SCIM create/update done; waiting on Okta tenant.", confidence: 58 },
];

export const DEPENDENCIES: Dependency[] = [
  { id: "dp-1", fromTaskId: "tk-103", toTaskId: "tk-101", kind: "BLOCKS", status: "AT_RISK", external: true, note: "Tax totals on invoices need retry-safe adapter." },
  { id: "dp-2", fromTaskId: "tk-102", toTaskId: "tk-105", kind: "BLOCKS", status: "OPEN", external: false, note: "Proration reads aggregated usage." },
  { id: "dp-3", fromTaskId: "tk-501", toTaskId: "tk-504", kind: "NEEDS_INPUT", status: "OPEN", external: false, note: "Admin screen shows validation errors from SAML." },
  { id: "dp-4", fromTaskId: "tk-502", toTaskId: "tk-503", kind: "SHARED_COMPONENT", status: "RESOLVED", external: false, note: "Shared membership event publisher." },
  { id: "dp-5", fromTaskId: "tk-301", toTaskId: "tk-302", kind: "SHARED_COMPONENT", status: "AT_RISK", external: true, note: "Data Guild connector framework reused by Platform." },
  { id: "dp-6", fromTaskId: "tk-104", toTaskId: "tk-108", kind: "NEEDS_INPUT", status: "OPEN", external: false, note: "Credit notes appear in invoice history." },
];

/* ----------------------------------------------------------------------------
 * Reports (Project Manager)
 * ------------------------------------------------------------------------- */

export const REPORTS: Report[] = [
  { id: "rp-1", title: "Weekly portfolio status · W46", kind: "PORTFOLIO", period: "10–16 Nov 2026", generatedAt: "2026-11-17T07:00:00Z", summary: "6 projects tracked: 3 on track, 2 at risk, 1 off track. Cobalt slipped a further 3 points against plan.", highlights: ["Beacon ahead of plan by 2 points", "Cobalt ingestion milestone late by 14 days", "Two scope changes awaiting decision"], metrics: [{ label: "Avg progress", value: "50%" }, { label: "Open blockers", value: "4" }, { label: "Overdue tasks", value: "5" }] },
  { id: "rp-2", title: "Atlas Billing · stakeholder update", kind: "STATUS", period: "November 2026", generatedAt: "2026-11-18T12:30:00Z", summary: "Invoice beta at 62%. Tax provider instability is the main risk to the 27 Nov milestone.", highlights: ["Metering live since 16 Oct", "Grafana billing alerts shipped", "Migration dry-run proposed for 4 Dec"], metrics: [{ label: "Progress", value: "58%" }, { label: "Budget used", value: "64%" }, { label: "Risks", value: "2" }] },
  { id: "rp-3", title: "Team workload snapshot", kind: "WORKLOAD", period: "Week of 16 Nov 2026", generatedAt: "2026-11-16T18:00:00Z", summary: "3 people above capacity (Aisha 115%, Liam 110%, Noah 103%). Sofia and Yuki have room.", highlights: ["Rebalance ATL-107 to Sofia", "Pause FJD discovery for Aisha", "Yuki on loan to Cobalt"], metrics: [{ label: "Avg utilisation", value: "92%" }, { label: "Over capacity", value: "3" }, { label: "Unassigned tasks", value: "2" }] },
  { id: "rp-4", title: "Risk register review", kind: "RISK", period: "Q4 2026", generatedAt: "2026-11-15T09:00:00Z", summary: "6 open risks, 1 critical (ERP access). Two mitigations due this week.", highlights: ["ERP access escalated to director", "Holiday freeze conflict for Atlas migration"], metrics: [{ label: "Open risks", value: "6" }, { label: "Critical", value: "1" }, { label: "Mitigated", value: "3" }] },
];

/* ----------------------------------------------------------------------------
 * Reviews & evidence (QA / Reviewer)
 * ------------------------------------------------------------------------- */

export const REVIEWS: Review[] = [
  { id: "rv-1", code: "RV-2041", taskId: "tk-102", projectId: "prj-atlas", submittedById: "p-yuki", reviewerId: "p-elena", submittedAt: "2026-11-19T17:40:00Z", status: "PENDING", priority: "HIGH", round: 1, summary: "Nightly usage aggregation with idempotent re-runs and backfill flag.", evidenceIds: ["ev-1", "ev-2"], checklist: [{ label: "Acceptance criteria met", done: true }, { label: "Re-run produces identical totals", done: false }, { label: "Backfill documented", done: true }, { label: "Alerts configured", done: false }] },
  { id: "rv-2", code: "RV-2038", taskId: "tk-202", projectId: "prj-beacon", submittedById: "p-zara", reviewerId: "p-elena", submittedAt: "2026-11-17T14:10:00Z", status: "PENDING", priority: "MEDIUM", round: 2, summary: "Notification channels split into reminders, messages and results.", evidenceIds: ["ev-3", "ev-4"], checklist: [{ label: "Channels visible in Android settings", done: true }, { label: "Silent channel for results", done: true }, { label: "Screenshots for Android 13 and 14", done: false }] },
  { id: "rv-3", code: "RV-2035", taskId: "tk-304", projectId: "prj-cobalt", submittedById: "p-mei", reviewerId: "p-elena", submittedAt: "2026-11-15T18:20:00Z", status: "PENDING", priority: "MEDIUM", round: 1, summary: "Freshness, uniqueness and balance tests on the ledger staging models.", evidenceIds: ["ev-5"], checklist: [{ label: "Tests run in CI", done: true }, { label: "Failing test triggers alert", done: false }, { label: "Thresholds agreed with Finance", done: false }] },
  { id: "rv-4", code: "RV-2043", taskId: "tk-503", projectId: "prj-ember", submittedById: "p-liam", reviewerId: "p-elena", submittedAt: "2026-11-19T19:05:00Z", status: "PENDING", priority: "CRITICAL", round: 1, summary: "Sessions revoked within 5s of a membership role change; audit row written.", evidenceIds: ["ev-6", "ev-7"], checklist: [{ label: "Revocation under 5 seconds", done: true }, { label: "Audit event recorded", done: true }, { label: "Concurrency test included", done: false }, { label: "No tokens in logs", done: true }] },
  { id: "rv-5", code: "RV-2029", taskId: "tk-401", projectId: "prj-delta", submittedById: "p-sofia", reviewerId: "p-elena", submittedAt: "2026-11-13T10:00:00Z", status: "PENDING", priority: "LOW", round: 1, summary: "Document vault previews for PDF, PNG and JPEG with share links.", evidenceIds: ["ev-8"], checklist: [{ label: "Preview for 3 file types", done: true }, { label: "Share link expires", done: false }] },
  { id: "rv-6", code: "RV-2021", taskId: "tk-106", projectId: "prj-atlas", submittedById: "p-liam", reviewerId: "p-elena", submittedAt: "2026-11-13T11:00:00Z", status: "APPROVED", priority: "MEDIUM", round: 1, summary: "Grafana dashboards and alert rules for failed invoice runs.", evidenceIds: ["ev-9"], checklist: [{ label: "Alert fires on failure", done: true }, { label: "Runbook linked", done: true }], decidedAt: "2026-11-14T15:30:00Z", reason: "Alert verified in staging; runbook is clear." },
  { id: "rv-7", code: "RV-2018", taskId: "tk-203", projectId: "prj-beacon", submittedById: "p-noah", reviewerId: "p-elena", submittedAt: "2026-11-11T09:00:00Z", status: "APPROVED", priority: "HIGH", round: 2, summary: "HealthKit consent with granular toggles and revoke.", evidenceIds: ["ev-10"], checklist: [{ label: "Consent per data type", done: true }, { label: "Revoke clears cached data", done: true }], decidedAt: "2026-11-12T16:10:00Z", reason: "Round 2 fixes confirmed; revoke clears cache." },
  { id: "rv-8", code: "RV-2015", taskId: "tk-302", projectId: "prj-cobalt", submittedById: "p-yuki", reviewerId: "p-elena", submittedAt: "2026-11-10T13:00:00Z", status: "CHANGES_REQUESTED", priority: "HIGH", round: 1, summary: "CRM opportunities connector first cut.", evidenceIds: ["ev-11"], checklist: [{ label: "Incremental cursor persisted", done: false }, { label: "Rate limits handled", done: true }], decidedAt: "2026-11-11T10:20:00Z", reason: "Cursor is kept in memory; a restart re-syncs everything. Persist the cursor and add a restart test." },
  { id: "rv-9", code: "RV-2012", taskId: "tk-501", projectId: "prj-ember", submittedById: "p-yuki", reviewerId: "p-elena", submittedAt: "2026-11-06T12:00:00Z", status: "CHANGES_REQUESTED", priority: "CRITICAL", round: 1, summary: "SAML signature validation, first submission.", evidenceIds: ["ev-12"], checklist: [{ label: "Rejects unsigned assertions", done: true }, { label: "Clock-skew tolerance", done: false }], decidedAt: "2026-11-07T09:45:00Z", reason: "Assertions with a 10-minute clock skew are accepted. Limit tolerance to 2 minutes and add test vectors." },
  { id: "rv-10", code: "RV-2009", taskId: "tk-203", projectId: "prj-beacon", submittedById: "p-noah", reviewerId: "p-elena", submittedAt: "2026-11-05T09:00:00Z", status: "CHANGES_REQUESTED", priority: "HIGH", round: 1, summary: "HealthKit consent, first submission.", evidenceIds: [], checklist: [{ label: "Consent per data type", done: true }, { label: "Revoke clears cached data", done: false }], decidedAt: "2026-11-06T11:00:00Z", reason: "Revoking consent leaves cached step counts on device." },
  { id: "rv-11", code: "RV-2005", taskId: "tk-106", projectId: "prj-atlas", submittedById: "p-diego", reviewerId: "p-elena", submittedAt: "2026-11-03T10:00:00Z", status: "APPROVED", priority: "LOW", round: 1, summary: "Billing settings copy and empty states.", evidenceIds: [], checklist: [{ label: "Copy reviewed", done: true }], decidedAt: "2026-11-03T15:00:00Z", reason: "Copy matches content guide." },
];

export const EVIDENCE: Evidence[] = [
  { id: "ev-1", reviewId: "rv-1", type: "PULL_REQUEST", title: "PR #482 · usage aggregation job", source: "github.com/acme/atlas/pull/482", addedAt: "2026-11-19T17:35:00Z", status: "TO_INSPECT", detail: "Adds UsageAggregationJob with upsert on (customer_id, day). Includes backfill flag.", stats: [{ label: "Files", value: "14" }, { label: "Additions", value: "+612" }, { label: "Deletions", value: "−88" }, { label: "Checks", value: "12/12 passed" }] },
  { id: "ev-2", reviewId: "rv-1", type: "TEST_REPORT", title: "Aggregation re-run test report", source: "CI run #9921", addedAt: "2026-11-19T17:38:00Z", status: "TO_INSPECT", detail: "Re-running the job for 3 days produced identical totals for 1,240 customers.", stats: [{ label: "Tests", value: "48" }, { label: "Passed", value: "48" }, { label: "Coverage", value: "86%" }] },
  { id: "ev-3", reviewId: "rv-2", type: "SCREENSHOT", title: "Android 14 notification settings", source: "Pixel 8 · build 3.0.0-rc4", addedAt: "2026-11-17T14:05:00Z", status: "VERIFIED", detail: "Three channels visible with correct importance levels.", stats: [{ label: "Device", value: "Pixel 8" }, { label: "OS", value: "Android 14" }] },
  { id: "ev-4", reviewId: "rv-2", type: "DEMO_VIDEO", title: "Channel behaviour walkthrough", source: "Loom · 2m 41s", addedAt: "2026-11-17T14:08:00Z", status: "TO_INSPECT", detail: "Shows reminder, message and result notifications arriving on each channel.", stats: [{ label: "Length", value: "2m 41s" }] },
  { id: "ev-5", reviewId: "rv-3", type: "TEST_REPORT", title: "dbt test results · ledger staging", source: "dbt Cloud job #3310", addedAt: "2026-11-15T18:15:00Z", status: "FLAGGED", detail: "2 warnings on freshness threshold; balance check passes.", stats: [{ label: "Tests", value: "31" }, { label: "Warnings", value: "2" }, { label: "Errors", value: "0" }] },
  { id: "ev-6", reviewId: "rv-4", type: "PULL_REQUEST", title: "PR #517 · revoke sessions on role change", source: "github.com/acme/ember/pull/517", addedAt: "2026-11-19T19:00:00Z", status: "TO_INSPECT", detail: "Publishes MembershipRoleChanged; consumer deletes sessions and writes audit row.", stats: [{ label: "Files", value: "9" }, { label: "Additions", value: "+344" }, { label: "Deletions", value: "−21" }, { label: "Checks", value: "11/11 passed" }] },
  { id: "ev-7", reviewId: "rv-4", type: "DOCUMENT", title: "Revocation latency measurements", source: "Confluence · SEC-112", addedAt: "2026-11-19T19:02:00Z", status: "TO_INSPECT", detail: "p50 1.2s, p95 3.8s across 500 role changes in staging.", stats: [{ label: "p50", value: "1.2s" }, { label: "p95", value: "3.8s" }] },
  { id: "ev-8", reviewId: "rv-5", type: "SCREENSHOT", title: "Document preview grid", source: "Chrome 131 · staging", addedAt: "2026-11-13T09:55:00Z", status: "TO_INSPECT", detail: "Grid with PDF, PNG and JPEG previews and share action.", stats: [{ label: "Browser", value: "Chrome 131" }] },
  { id: "ev-9", reviewId: "rv-6", type: "SCREENSHOT", title: "Grafana failed-run alert", source: "grafana.acme.dev", addedAt: "2026-11-13T10:50:00Z", status: "VERIFIED", detail: "Alert fired within 60s of a forced failure.", stats: [{ label: "Latency", value: "54s" }] },
  { id: "ev-10", reviewId: "rv-7", type: "DEMO_VIDEO", title: "HealthKit consent round 2", source: "Loom · 1m 58s", addedAt: "2026-11-11T08:55:00Z", status: "VERIFIED", detail: "Revoke clears cached samples; consent persists across reinstall.", stats: [{ label: "Length", value: "1m 58s" }] },
  { id: "ev-11", reviewId: "rv-8", type: "PULL_REQUEST", title: "PR #77 · CRM connector", source: "github.com/acme/cobalt/pull/77", addedAt: "2026-11-10T12:55:00Z", status: "FLAGGED", detail: "Cursor stored in memory only.", stats: [{ label: "Files", value: "6" }, { label: "Additions", value: "+290" }] },
  { id: "ev-12", reviewId: "rv-9", type: "TEST_REPORT", title: "SAML test vectors v1", source: "CI run #9710", addedAt: "2026-11-06T11:55:00Z", status: "FLAGGED", detail: "Clock-skew vector with 10 minutes accepted.", stats: [{ label: "Vectors", value: "24" }, { label: "Failed", value: "1" }] },
];

/* ----------------------------------------------------------------------------
 * Chart series
 * ------------------------------------------------------------------------- */

export const MANAGER_THROUGHPUT = [
  { label: "W41", primary: 14, secondary: 3 },
  { label: "W42", primary: 17, secondary: 2 },
  { label: "W43", primary: 12, secondary: 5 },
  { label: "W44", primary: 19, secondary: 4 },
  { label: "W45", primary: 16, secondary: 6 },
  { label: "W46", primary: 21, secondary: 5 },
];

export const REVIEWER_WEEKLY_OUTCOMES = [
  { label: "W41", primary: 9, secondary: 3 },
  { label: "W42", primary: 11, secondary: 4 },
  { label: "W43", primary: 8, secondary: 5 },
  { label: "W44", primary: 13, secondary: 2 },
  { label: "W45", primary: 10, secondary: 4 },
  { label: "W46", primary: 12, secondary: 3 },
];

export const REVIEWER_TURNAROUND_HOURS = [
  { label: "W41", value: 26 },
  { label: "W42", value: 22 },
  { label: "W43", value: 31 },
  { label: "W44", value: 18 },
  { label: "W45", value: 20 },
  { label: "W46", value: 16 },
];
