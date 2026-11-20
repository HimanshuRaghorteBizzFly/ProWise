import { z } from "zod";

const roleSchema = z.enum([
  "SUPER_ADMIN",
  "PLATFORM_OPERATOR",
  "ORGANIZATION_OWNER",
  "ORGANIZATION_ADMIN",
  "PROJECT_MANAGER",
  "TEAM_LEAD",
  "DEVELOPER",
  "QA_REVIEWER",
  "VIEWER",
]);

const permissionKeySchema = z.enum([
  "org.manage",
  "member.invite",
  "member.disable",
  "role.manage",
  "team.manage",
  "project.create",
  "project.read",
  "project.edit",
  "project.archive",
  "project.mode.change",
  "project.scope.change",
  "project.deadline.edit",
  "project.progress.report",
  "project.progress.override",
  "task.create",
  "task.assign",
  "task.update",
  "task.review",
  "repo.connect",
  "repo.read",
  "report.export",
  "audit.read",
]);

const projectSchema = z.object({
  id: z.string(),
  orgId: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string(),
  mode: z.enum(["INDIVIDUAL", "STRUCTURED"]),
  lifecycle: z.enum(["PLANNED", "ACTIVE", "ON_HOLD", "DELIVERED", "CLOSED", "CANCELLED"]),
  archived: z.boolean(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  projectManagerId: z.string(),
  accountableOwnerId: z.string(),
  teamIds: z.array(z.string()),
  memberIds: z.array(z.string()),
  startDate: z.string(),
  targetDate: z.string(),
  timezone: z.string(),
  cadence: z.enum(["DAILY", "WEEKLY", "FORTNIGHTLY"]),
  graceWorkingDays: z.number(),
  version: z.number(),
  activeBaselineId: z.string().optional(),
  lastProgressPercent: z.number(),
  lastProgressMethod: z.enum(["DEVELOPER_REPORTED", "CALCULATED_BASELINE", "NOT_REPORTED"]),
  lastReportedAt: z.string().optional(),
  health: z.enum(["ON_TRACK", "AT_RISK", "DELAYED", "UNKNOWN"]),
  healthReasons: z.array(z.string()),
  repositoryIds: z.array(z.string()),
  createdAt: z.string(),
});

export const ProwiseMockSchema = z.object({
  schemaVersion: z.literal("1.0"),
  dataAsOf: z.string(),
  organizations: z.array(z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
    ownerId: z.string(),
    timezone: z.string(),
    workCalendar: z.object({ workDays: z.array(z.number()), dailyHours: z.number(), holidays: z.array(z.string()) }),
    createdAt: z.string(),
    plan: z.enum(["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"]),
    status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]),
  })),
  users: z.array(z.object({ id: z.string(), email: z.string(), name: z.string(), timezone: z.string(), createdAt: z.string() })),
  memberships: z.array(z.object({ id: z.string(), orgId: z.string(), userId: z.string(), role: roleSchema, teamId: z.string().optional(), status: z.enum(["ACTIVE", "INVITED", "DISABLED"]), invitedAt: z.string().optional(), joinedAt: z.string().optional() })),
  roleTemplates: z.array(z.object({ role: roleSchema, name: z.string() })),
  grants: z.array(z.object({ role: roleSchema, key: permissionKeySchema, scope: z.enum(["ORG", "PROJECT"]), scopeId: z.string().optional() })
    .superRefine((grant, context) => {
      if (grant.scope === "PROJECT" && !grant.scopeId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "PROJECT grants require scopeId", path: ["scopeId"] });
      }
      if (grant.scope === "ORG" && grant.scopeId) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "ORG grants cannot have scopeId", path: ["scopeId"] });
      }
    })),
  teams: z.array(z.object({ id: z.string(), orgId: z.string(), name: z.string(), leadId: z.string(), memberIds: z.array(z.string()), description: z.string().optional(), archived: z.boolean().optional() })),
  projects: z.array(projectSchema),
  workItems: z.array(z.object({
    id: z.string(), projectId: z.string(), orgId: z.string(), parentId: z.string().optional(),
    type: z.enum(["MILESTONE", "DELIVERABLE", "TASK", "SUBTASK"]), key: z.string(), title: z.string(), description: z.string(),
    primaryAssigneeId: z.string().optional(), reviewerId: z.string().optional(), collaboratorIds: z.array(z.string()),
    state: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"]), isBlocked: z.boolean(),
    blockers: z.array(z.object({ id: z.string(), reason: z.string(), severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), ownerId: z.string(), createdAt: z.string(), resolvedAt: z.string().optional() })),
    weight: z.number(), weightUnit: z.string(), criteria: z.string(), criteriaVersion: z.number(),
    currentRevision: z.number(), submittedRevision: z.number().optional(), dueDate: z.string().optional(),
    criticality: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), version: z.number(), archived: z.boolean().optional(),
    createdAt: z.string(), updatedAt: z.string(),
  })),
  submissions: z.array(z.object({ id: z.string(), workItemId: z.string(), projectId: z.string(), orgId: z.string(), submittedBy: z.string(), submittedRevision: z.number(), criteriaVersion: z.number(), evidenceUrls: z.array(z.string()), submittedAt: z.string(), status: z.enum(["IN_REVIEW", "APPROVED", "CHANGES_REQUESTED"]) })),
  reviews: z.array(z.object({ id: z.string(), workItemId: z.string(), projectId: z.string(), reviewerId: z.string(), submittedRevision: z.number(), decision: z.enum(["APPROVED", "CHANGES_REQUESTED"]), feedbackReason: z.string().optional(), evidenceUrls: z.array(z.string()).optional(), checklistPassed: z.boolean(), createdAt: z.string() })),
  checkIns: z.array(z.object({ id: z.string(), projectId: z.string(), orgId: z.string(), authorId: z.string(), revisionOfId: z.string().optional(), percent: z.number(), accomplished: z.string(), nextSteps: z.string(), blockers: z.array(z.string()), projectedFinish: z.string(), optionalEvidence: z.string().optional(), downwardRevisionReason: z.string().optional(), verificationStatus: z.enum(["ACCEPTED", "PENDING_VERIFICATION", "REJECTED"]), verifiedBy: z.string().optional(), verifiedAt: z.string().optional(), createdAt: z.string(), version: z.number() })),
  blockers: z.array(z.object({ id: z.string(), workItemId: z.string(), projectId: z.string(), orgId: z.string(), reason: z.string(), severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), ownerId: z.string(), createdAt: z.string(), resolvedAt: z.string().optional() })),
  dependencies: z.array(z.object({ id: z.string(), projectId: z.string(), orgId: z.string(), predecessorId: z.string(), successorId: z.string() })),
  baselines: z.array(z.object({ id: z.string(), projectId: z.string(), orgId: z.string(), version: z.number(), reason: z.string(), unit: z.string(), approvedBy: z.string(), approvedAt: z.string(), totalWeight: z.number(), leaves: z.array(z.object({ workItemId: z.string(), title: z.string(), weight: z.number(), isEligible: z.boolean(), isDone: z.boolean() })), supersededAt: z.string().optional() })),
  progressSnapshots: z.array(z.object({ id: z.string(), projectId: z.string(), orgId: z.string(), instant: z.string(), method: z.enum(["DEVELOPER_REPORTED", "CALCULATED_BASELINE"]), value: z.number(), isNotMeasurable: z.boolean().optional(), isNotReported: z.boolean().optional(), numerator: z.number().optional(), denominator: z.number().optional(), baselineId: z.string().optional(), baselineVersion: z.number().optional(), cause: z.string(), isModeTransitionMarker: z.boolean().optional(), transitionNote: z.string().optional() })),
  health: z.array(z.object({ id: z.string(), projectId: z.string(), orgId: z.string(), status: z.enum(["ON_TRACK", "AT_RISK", "DELAYED", "UNKNOWN"]), reasons: z.array(z.string()), affectedItemIds: z.array(z.string()), timeBasis: z.string(), unit: z.string(), calculatedAt: z.string() })),
  notifications: z.array(z.object({ id: z.string(), orgId: z.string(), userId: z.string(), category: z.enum(["ASSIGNMENT", "CHECK_IN_DUE", "REVIEW_REQUEST", "REVIEW_DECISION", "BLOCKER", "HEALTH_CHANGE", "DEADLINE_CHANGE", "DELIVERY_ACCEPTANCE", "SYSTEM"]), title: z.string(), message: z.string(), targetUrl: z.string(), read: z.boolean(), createdAt: z.string() })),
  auditEvents: z.array(z.object({ id: z.string(), orgId: z.string(), actorEmail: z.string(), actorRole: z.string(), action: z.string(), targetType: z.string(), targetId: z.string(), details: z.string(), timestamp: z.string() })),
  repos: z.array(z.object({ id: z.string(), orgId: z.string(), name: z.string(), owner: z.string(), providerRepoId: z.string(), installationId: z.string(), defaultBranch: z.string(), syncStatus: z.enum(["SYNCED", "SYNCING", "FAILED", "DISCONNECTED"]), lastSuccessfulSync: z.string().optional(), lastFailureReason: z.string().optional(), linkedProjectIds: z.array(z.string()) })),
  gitEvents: z.array(z.object({ id: z.string(), repositoryId: z.string(), orgId: z.string(), repoName: z.string(), type: z.enum(["PUSH", "PULL_REQUEST", "REVIEW", "CHECK_RUN", "DEPLOYMENT"]), actor: z.string(), title: z.string(), detail: z.string(), sha: z.string().optional(), prNumber: z.number().optional(), branch: z.string().optional(), status: z.enum(["SUCCESS", "FAILURE", "PENDING", "MERGED", "OPEN"]).optional(), linkedTaskKey: z.string().optional(), timestamp: z.string() })),
});

export type ProwiseMock = z.infer<typeof ProwiseMockSchema>;
