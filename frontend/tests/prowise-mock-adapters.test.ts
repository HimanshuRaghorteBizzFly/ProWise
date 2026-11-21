import { describe, expect, it } from "vitest";

import {
  mockApiProjects,
  mockApiProgress,
  mockApiProgressForOrg,
  mockApiHealth,
  mockApiRepositories,
  mockApiReviewerQueue,
  mockApiTeams,
  mockApiWorkItems,
  mockApiWorkItemsForOrg,
  mockApiProjectMembers,
  mockApiOrganizationMembersForProjectCreation,
  getMockPermissions,
  mockApiBaselines,
  mockApiDependencies,
  mockApiBlockers,
} from "../src/lib/prowise-mock-adapters";
import { loadProwiseMock, parseProwiseMock } from "../src/mocks/load-prowise-mock";
import { PERMISSION_KEYS } from "../src/lib/permissions";

describe("Prowise single mock dataset", () => {
  it("loads and validates the JSON schema", () => {
    const mock = loadProwiseMock();
    expect(mock.schemaVersion).toBe("1.0");
    expect(mock.projects).toHaveLength(2);
  });

  it("rejects malformed or incomplete JSON input", () => {
    expect(() => parseProwiseMock({ schemaVersion: "1.0" })).toThrow();
  });

  it("filters projects and teams by organization", () => {
    const owner = getMockPermissions("ORGANIZATION_OWNER");
    expect(mockApiProjects("org-acme", owner).items.every((project) => project.orgId === "org-acme")).toBe(true);
    expect(mockApiProjects("org-nova", owner).items).toEqual([]);
    expect(mockApiTeams("org-nova", owner).items).toEqual([]);
    expect(mockApiHealth("org-nova", owner).items).toEqual([]);
    expect(mockApiRepositories("org-nova", owner).items).toEqual([]);
  });

  it("blocks cross-org work, progress and repository reads", () => {
    const pm = getMockPermissions("PROJECT_MANAGER");
    expect(mockApiWorkItems("org-nova", "proj-structured-cds", pm).items).toEqual([]);
    expect(mockApiWorkItemsForOrg("org-nova", pm).items).toEqual([]);
    expect(mockApiBaselines("org-nova", pm).items).toEqual([]);
    expect(mockApiDependencies("org-nova", pm).items).toEqual([]);
    expect(mockApiBlockers("org-nova", pm).items).toEqual([]);
    expect(mockApiProjectMembers("org-nova", pm).items).toEqual([]);
    expect(mockApiProgress("org-nova", "proj-structured-cds", pm).items).toEqual([]);
    expect(mockApiProgressForOrg("org-nova", pm).items).toEqual([]);
    expect(mockApiReviewerQueue("org-nova", "usr-reviewer", getMockPermissions("QA_REVIEWER")).items).toEqual([]);
  });

  it("keeps PM reads within readable projects and only exposes active eligible members", () => {
    const manager = getMockPermissions("PROJECT_MANAGER");
    const workItems = mockApiWorkItemsForOrg("org-acme", manager).items;
    expect(workItems.every((item) => item.orgId === "org-acme")).toBe(true);

    const members = mockApiProjectMembers("org-acme", manager).items;
    expect(members.map((member) => member.id)).toContain("usr-developer");
    expect(members.map((member) => member.id)).not.toContain("usr-owner-nova");
    expect(mockApiOrganizationMembersForProjectCreation("org-acme", manager).items)
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: "usr-developer" })]));
    expect(mockApiOrganizationMembersForProjectCreation("org-acme", getMockPermissions("TEAM_LEAD")).items)
      .toEqual([]);
  });

  it("keeps portfolio health consistent with the reason-bearing health record", () => {
    const manager = getMockPermissions("PROJECT_MANAGER");
    const project = mockApiProjects("org-acme", manager).items.find((item) => item.id === "proj-structured-cds");
    const health = mockApiHealth("org-acme", manager).items.find((item) => item.projectId === "proj-structured-cds");
    expect(project?.health).toBe(health?.status);
    expect(project?.healthReasons).toEqual(health?.reasons);
  });

  it("does not leak project-scoped grants to other projects", () => {
    const lead = getMockPermissions("TEAM_LEAD");
    expect(mockApiTeams("org-acme", lead, "usr-lead").items).toHaveLength(1);
    expect(mockApiProjects("org-acme", lead).items.map((project) => project.id)).toEqual(["proj-structured-cds"]);
    expect(mockApiWorkItems("org-acme", "proj-individual-solo", lead).items).toEqual([]);
    expect(mockApiRepositories("org-acme", lead).items.map((repo) => repo.id)).toEqual(["repo-2"]);
    expect(mockApiProgressForOrg("org-acme", lead).items.every((snapshot) =>
      snapshot.projectId === "proj-structured-cds" && snapshot.orgId === "org-acme",
    )).toBe(true);
  });

  it("keeps reviewer queue on the assigned project and reviewer relationship", () => {
    const reviewer = getMockPermissions("QA_REVIEWER");
    expect(mockApiReviewerQueue("org-acme", "usr-reviewer", reviewer).items).toHaveLength(1);
    expect(mockApiReviewerQueue("org-acme", "usr-other", reviewer).items).toEqual([]);
  });

  it("matches the matrix grants for Owner, Admin, PM, Team Lead and QA/Reviewer", () => {
    const orgKeys = (role: Parameters<typeof getMockPermissions>[0]) =>
      getMockPermissions(role)
        .filter((grant) => grant.scope === "ORG")
        .map((grant) => grant.key)
        .sort();
    const projectKeys = (role: Parameters<typeof getMockPermissions>[0]) =>
      getMockPermissions(role)
        .filter((grant) => grant.scope === "PROJECT" && grant.scopeId === "proj-structured-cds")
        .map((grant) => grant.key)
        .sort();

    expect(orgKeys("ORGANIZATION_OWNER")).toEqual(PERMISSION_KEYS.filter((key) => key !== "project.progress.override" && key !== "project.progress.verify").slice().sort());
    expect(orgKeys("ORGANIZATION_ADMIN")).toEqual([
      "audit.read", "member.disable", "member.invite", "project.create", "project.read",
      "repo.connect", "repo.read", "report.export", "role.manage", "team.manage",
    ]);
    expect(orgKeys("PROJECT_MANAGER")).toEqual([
      "project.create", "project.deadline.edit", "project.edit", "project.mode.change",
      "project.read", "project.scope.change", "repo.read", "report.export",
      "task.assign", "task.create", "task.update",
    ]);
    expect(projectKeys("TEAM_LEAD")).toEqual([
      "project.read", "repo.read", "task.assign", "task.create", "task.update", "team.manage",
    ]);
    expect(projectKeys("QA_REVIEWER")).toEqual(["project.read", "task.review"]);
    expect(getMockPermissions("TEAM_LEAD").every((grant) => grant.scope === "PROJECT")).toBe(true);
    expect(getMockPermissions("QA_REVIEWER").every((grant) => grant.scope === "PROJECT")).toBe(true);
    expect(mockApiHealth("org-acme", getMockPermissions("TEAM_LEAD")).items.map((item) => item.projectId))
      .toEqual(["proj-structured-cds"]);
  });
});
