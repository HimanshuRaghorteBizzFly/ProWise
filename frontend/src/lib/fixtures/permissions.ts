import type { SystemRole } from "@/types";
import type { PermissionGrant, PermissionKey } from "@/types/permission";

/**
 * Mock adapter standing in for GET /v1/me/permissions in development only
 * (NEXT_PUBLIC_USE_MOCKS=true or API unreachable; never in production builds).
 * Derived from docs/permission-matrix.md. CONDITIONAL cells become PROJECT-scoped
 * grants on fixture projects from src/lib/mock-data.ts. The role template only selects
 * which sample response to return; authorization still goes through the grants.
 */

const SAMPLE_PROJECTS = ["proj-individual-solo", "proj-structured-cds"] as const;

const org = (keys: PermissionKey[]): PermissionGrant[] => keys.map((key) => ({ key, scope: "ORG" as const }));

const onProjects = (keys: PermissionKey[], projectIds: readonly string[] = SAMPLE_PROJECTS): PermissionGrant[] =>
  projectIds.flatMap((scopeId) => keys.map((key) => ({ key, scope: "PROJECT" as const, scopeId })));

export const FIXTURE_GRANTS: Record<SystemRole, PermissionGrant[]> = {
  SUPER_ADMIN: [],
  PLATFORM_OPERATOR: [],
  ORGANIZATION_OWNER: org([
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
    "task.create",
    "task.assign",
    "task.update",
    "task.review",
    "repo.connect",
    "repo.read",
    "report.export",
    "audit.read",
  ]),
  ORGANIZATION_ADMIN: org([
    "member.invite",
    "member.disable",
    "role.manage",
    "team.manage",
    "project.create",
    "project.read",
    "repo.connect",
    "repo.read",
    "report.export",
    "audit.read",
  ]),
  PROJECT_MANAGER: org([
    "project.create",
    "project.read",
    "project.edit",
    "project.mode.change",
    "project.scope.change",
    "project.deadline.edit",
    "task.create",
    "task.assign",
    "task.update",
    "repo.read",
    "report.export",
  ]),
  TEAM_LEAD: onProjects(
    ["team.manage", "project.read", "task.create", "task.assign", "task.update", "repo.read"],
    [SAMPLE_PROJECTS[1]],
  ),
  DEVELOPER: [
    ...onProjects(["project.read", "project.edit", "task.update", "repo.read"]),
    ...onProjects(["project.progress.report"], [SAMPLE_PROJECTS[0]]),
  ],
  QA_REVIEWER: onProjects(["project.read", "task.review"], [SAMPLE_PROJECTS[1]]),
  VIEWER: onProjects(["project.read"]),
};
