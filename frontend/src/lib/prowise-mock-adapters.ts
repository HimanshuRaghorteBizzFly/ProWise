import { loadProwiseMock } from "@/mocks/load-prowise-mock";
import type { PermissionGrant, PermissionKey, PermissionTarget } from "@/types/permission";
import type { SystemRole } from "@/types";

const mock = loadProwiseMock();

export interface MockCursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

function page<T>(items: T[]): MockCursorPage<T> {
  return { items, nextCursor: null, hasMore: false };
}

function can(grants: readonly PermissionGrant[], key: PermissionKey, target?: PermissionTarget): boolean {
  return grants.some((grant) =>
    grant.key === key &&
    (grant.scope === "ORG" || (target !== undefined && grant.scopeId === target.projectId)),
  );
}

export function getMockPermissions(role: SystemRole): PermissionGrant[] {
  return mock.grants
    .filter((grant) => grant.role === role)
    .map((grant) => grant.scope === "ORG"
      ? { key: grant.key, scope: "ORG" as const }
      : { key: grant.key, scope: "PROJECT" as const, scopeId: grant.scopeId ?? "" });
}

export function mockApiProjects(orgId: string, grants: readonly PermissionGrant[]) {
  if (!grants.some((grant) => grant.key === "project.read")) return page([]);
  const organization = mock.organizations.find((item) => item.id === orgId);
  if (!organization) return page([]);

  return page(mock.projects
    .filter((project) => project.orgId === orgId)
    .filter((project) => grantHasProject(grants, "project.read", project.id)));
}

function readableProjects(orgId: string, grants: readonly PermissionGrant[]) {
  if (!mock.organizations.some((organization) => organization.id === orgId)) return [];
  return mock.projects
    .filter((project) => project.orgId === orgId)
    .filter((project) => grantHasProject(grants, "project.read", project.id));
}

function grantHasProject(grants: readonly PermissionGrant[], key: PermissionKey, projectId: string): boolean {
  return can(grants, key, { projectId });
}

export function mockApiWorkItemsForOrg(orgId: string, grants: readonly PermissionGrant[]) {
  const projectIds = new Set(readableProjects(orgId, grants).map((project) => project.id));
  return page(mock.workItems.filter((item) => item.orgId === orgId && projectIds.has(item.projectId)));
}

export function mockApiWorkItems(orgId: string, projectId: string, grants: readonly PermissionGrant[]) {
  if (!mock.projects.some((project) => project.id === projectId && project.orgId === orgId)) return page([]);
  if (!grantHasProject(grants, "project.read", projectId)) return page([]);
  return page(mock.workItems.filter((item) => item.orgId === orgId && item.projectId === projectId));
}

export function mockApiProjectMembers(orgId: string, grants: readonly PermissionGrant[]) {
  const memberIds = new Set(
    readableProjects(orgId, grants).flatMap((project) => project.memberIds),
  );
  const activeMembershipIds = new Set(
    mock.memberships
      .filter((membership) => membership.orgId === orgId && membership.status === "ACTIVE")
      .map((membership) => membership.userId),
  );
  return page(mock.users.filter((user) => memberIds.has(user.id) && activeMembershipIds.has(user.id)));
}

export function mockApiOrganizationMembersForProjectCreation(
  orgId: string,
  grants: readonly PermissionGrant[],
) {
  if (!mock.organizations.some((organization) => organization.id === orgId)) return page([]);
  if (!can(grants, "project.create")) return page([]);
  const activeMemberIds = new Set(
    mock.memberships
      .filter((membership) => membership.orgId === orgId && membership.status === "ACTIVE")
      .map((membership) => membership.userId),
  );
  return page(mock.users.filter((user) => activeMemberIds.has(user.id)));
}

export function mockApiReviewerQueue(orgId: string, reviewerId: string, grants: readonly PermissionGrant[]) {
  return page(mock.submissions
    .filter((submission) => submission.orgId === orgId)
    .filter((submission) => grantHasProject(grants, "task.review", submission.projectId))
    .filter((submission) => {
      const project = mock.projects.find((item) => item.id === submission.projectId && item.orgId === orgId);
      const workItem = mock.workItems.find((item) => item.id === submission.workItemId);
      return project !== undefined &&
        workItem?.orgId === orgId &&
        workItem.projectId === submission.projectId &&
        workItem.reviewerId === reviewerId;
    }));
}

export function mockApiTeams(orgId: string, grants: readonly PermissionGrant[], leadId?: string) {
  if (!mock.organizations.some((organization) => organization.id === orgId)) return page([]);
  return page(mock.teams.filter((team) => {
    if (team.orgId !== orgId || (leadId && team.leadId !== leadId)) return false;
    if (can(grants, "team.manage")) return true;
    return mock.projects.some((project) =>
      project.orgId === orgId &&
      project.teamIds.includes(team.id) &&
      grantHasProject(grants, "team.manage", project.id),
    );
  }));
}

export function mockApiProgress(orgId: string, projectId: string, grants: readonly PermissionGrant[]) {
  if (!mock.projects.some((project) => project.id === projectId && project.orgId === orgId)) return page([]);
  if (!grantHasProject(grants, "project.read", projectId)) return page([]);
  return page(mock.progressSnapshots
    .filter((snapshot) => snapshot.orgId === orgId && snapshot.projectId === projectId)
    .sort((a, b) => a.instant.localeCompare(b.instant)));
}

export function mockApiProgressForOrg(orgId: string, grants: readonly PermissionGrant[]) {
  const projectIds = new Set(readableProjects(orgId, grants).map((project) => project.id));
  return page(mock.progressSnapshots
    .filter((snapshot) => snapshot.orgId === orgId && projectIds.has(snapshot.projectId))
    .sort((a, b) => a.instant.localeCompare(b.instant)));
}

export function mockApiCheckIns(orgId: string, grants: readonly PermissionGrant[]) {
  const projectIds = new Set(readableProjects(orgId, grants).map((project) => project.id));
  return page(mock.checkIns
    .filter((checkIn) => checkIn.orgId === orgId && projectIds.has(checkIn.projectId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
}

export function mockApiBaselines(orgId: string, grants: readonly PermissionGrant[]) {
  const projectIds = new Set(readableProjects(orgId, grants).map((project) => project.id));
  return page(mock.baselines.filter((baseline) =>
    baseline.orgId === orgId && projectIds.has(baseline.projectId),
  ));
}

export function mockApiDependencies(orgId: string, grants: readonly PermissionGrant[]) {
  const projectIds = new Set(readableProjects(orgId, grants).map((project) => project.id));
  return page(mock.dependencies.filter((dependency) =>
    dependency.orgId === orgId && projectIds.has(dependency.projectId),
  ));
}

export function mockApiBlockers(orgId: string, grants: readonly PermissionGrant[]) {
  const projectIds = new Set(readableProjects(orgId, grants).map((project) => project.id));
  return page(mock.blockers.filter((blocker) =>
    blocker.orgId === orgId && projectIds.has(blocker.projectId),
  ));
}

export function mockApiHealth(orgId: string, grants: readonly PermissionGrant[]) {
  if (!mock.organizations.some((organization) => organization.id === orgId)) return page([]);
  return page(mock.health.filter((item) =>
    item.orgId === orgId && grantHasProject(grants, "project.read", item.projectId),
  ));
}

export function mockApiRepositories(orgId: string, grants: readonly PermissionGrant[]) {
  if (!mock.organizations.some((organization) => organization.id === orgId)) return page([]);
  return page(mock.repos.filter((repository) =>
    repository.orgId === orgId &&
    (can(grants, "repo.read") || repository.linkedProjectIds.some((projectId) =>
      mock.projects.some((project) =>
        project.id === projectId &&
        project.orgId === orgId &&
        grantHasProject(grants, "repo.read", projectId),
      ),
    )),
  ));
}
