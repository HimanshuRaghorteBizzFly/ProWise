import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../src/lib/api";
import {
  loadDashboardData,
  summarizeLeadDashboard,
  summarizeOrganizationDashboard,
  summarizeProjectManagerDashboard,
  summarizeQaDashboard,
} from "../src/lib/live-dashboard-data";
import type {
  CodeReviewDto,
  InvitationDto,
  MemberDto,
  ProjectDto,
  TeamDto,
} from "../src/types/api";

const member = (id: string, status: string): MemberDto => ({
  id,
  display_name: id,
  email: `${id}@example.test`,
  status,
  role_template: "VIEWER",
});

const project = (
  id: string,
  lifecycle: ProjectDto["lifecycle"],
  percent: number | null,
  taskCount = 0,
): ProjectDto => ({
  id,
  key: id.toUpperCase(),
  name: id,
  description: null,
  mode: "INDIVIDUAL",
  lifecycle,
  archived: false,
  priority: "MEDIUM",
  project_manager: null,
  accountable: null,
  members: [],
  team_id: null,
  team_name: null,
  start_on: null,
  target_on: null,
  timezone: "UTC",
  active_baseline_id: null,
  task_count: taskCount,
  progress: {
    percent,
    label: percent === null ? "Not reported" : "Developer reported",
    reported_at: percent === null ? null : "2026-11-21T10:00:00Z",
  },
  can_edit: false,
  version: 0,
  created_at: "2026-11-21T10:00:00Z",
  updated_at: "2026-11-21T10:00:00Z",
});

const invitation = (status: InvitationDto["status"]): InvitationDto => ({
  id: `invite-${status}`,
  email: "invitee@example.test",
  template_role_id: "role",
  role_name: "Viewer",
  team_id: null,
  team_name: null,
  status,
  expires_at: "2026-11-22T10:00:00Z",
  invited_by_email: "owner@example.test",
  created_at: "2026-11-21T10:00:00Z",
  last_sent_at: "2026-11-21T10:00:00Z",
  send_count: 1,
  accepted_at: null,
  revoked_at: null,
  version: 0,
});

const team = (id: string, status: TeamDto["status"]): TeamDto => ({
  id,
  name: id,
  description: null,
  status,
  lead_membership_id: null,
  lead_email: null,
  members: [],
  version: 0,
  created_at: "2026-11-21T10:00:00Z",
  updated_at: "2026-11-21T10:00:00Z",
});

afterEach(() => vi.restoreAllMocks());

describe("live dashboard data", () => {
  it("loads organization dashboard data only from the organization APIs", async () => {
    const members = [member("active", "ACTIVE"), member("disabled", "DISABLED")];
    const teams = [team("active-team", "ACTIVE")];
    const invitations = [invitation("PENDING")];
    const projects = [project("active-project", "ACTIVE", 40)];
    vi.spyOn(apiClient, "members").mockResolvedValue(members);
    vi.spyOn(apiClient, "teams").mockResolvedValue(teams);
    vi.spyOn(apiClient, "invitations").mockResolvedValue(invitations);
    vi.spyOn(apiClient, "projects").mockResolvedValue({
      items: projects,
      next_cursor: null,
      has_more: false,
    });

    const data = await loadDashboardData("owner", "org-a");

    expect(data).toMatchObject({ kind: "organization", members, teams, invitations, projects });
    expect(apiClient.members).toHaveBeenCalledWith("org-a", undefined);
    expect(apiClient.teams).toHaveBeenCalledWith("org-a");
    expect(apiClient.invitations).toHaveBeenCalledWith("org-a");
    expect(apiClient.projects).toHaveBeenCalledWith("org-a", { limit: 50 });
  });

  it("loads every member page without dropping the page-boundary record", async () => {
    const firstPage = Array.from({ length: 51 }, (_, index) => member(`member-${index}`, "ACTIVE"));
    const secondPage = [firstPage[50], member("member-51", "ACTIVE")];
    const loadMembers = vi.spyOn(apiClient, "members")
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);
    vi.spyOn(apiClient, "teams").mockResolvedValue([]);
    vi.spyOn(apiClient, "invitations").mockResolvedValue([]);
    vi.spyOn(apiClient, "projects").mockResolvedValue({ items: [], next_cursor: null, has_more: false });

    const data = await loadDashboardData("admin", "org-a");

    expect(data.kind).toBe("organization");
    if (data.kind !== "organization") throw new Error("Expected organization dashboard data.");
    expect(data.members).toHaveLength(52);
    expect(data.members[50].id).toBe("member-50");
    expect(loadMembers).toHaveBeenNthCalledWith(1, "org-a", undefined);
    expect(loadMembers).toHaveBeenNthCalledWith(2, "org-a", "member-49");
  });

  it("loads all project pages instead of displaying a partial portfolio", async () => {
    const first = project("first", "ACTIVE", 20);
    const second = project("second", "PLANNED", null);
    const loadProjects = vi.spyOn(apiClient, "projects")
      .mockResolvedValueOnce({ items: [first], next_cursor: "cursor-1", has_more: true })
      .mockResolvedValueOnce({ items: [second], next_cursor: null, has_more: false });

    const data = await loadDashboardData("manager", "org-a");

    expect(data).toMatchObject({ kind: "manager", projects: [first, second] });
    expect(loadProjects).toHaveBeenNthCalledWith(1, "org-a", { limit: 50 });
    expect(loadProjects).toHaveBeenNthCalledWith(2, "org-a", { limit: 50, cursor: "cursor-1" });
  });

  it("loads only the caller's persisted check-in approval queue for team leads", async () => {
    const pendingReviews: Awaited<ReturnType<typeof apiClient.pendingReviews>> = [];
    const loadPendingReviews = vi.spyOn(apiClient, "pendingReviews").mockResolvedValue(pendingReviews);

    const data = await loadDashboardData("lead", "org-a");

    expect(data).toEqual({ kind: "lead", pendingReviews });
    expect(loadPendingReviews).toHaveBeenCalledWith("org-a");
  });

  it("loads assigned persisted code reviews for QA", async () => {
    const codeReviews: CodeReviewDto[] = [{
      id: "review-a",
      project_id: "project-a",
      work_item_id: null,
      title: "Review project change",
      pr_number: 1,
      pr_url: "https://example.test/pr/1",
      repository_name: "example/repo",
      branch: "feature",
      author_id: "author",
      reviewer_id: "reviewer",
      status: "PENDING",
      inspected_revision: 1,
      comments_count: 0,
      created_at: "2026-11-21T10:00:00Z",
      updated_at: "2026-11-21T10:00:00Z",
    }];
    const loadCodeReviews = vi.spyOn(apiClient, "codeReviews").mockResolvedValue(codeReviews);

    const data = await loadDashboardData("reviewer", "org-a");

    expect(data).toEqual({ kind: "reviewer", codeReviews });
    expect(loadCodeReviews).toHaveBeenCalledWith("assigned");
  });

  it("derives organization metrics from persisted values and ignores unreported progress", () => {
    const metrics = summarizeOrganizationDashboard({
      members: [member("active", "ACTIVE"), member("disabled", "DISABLED")],
      teams: [team("active-team", "ACTIVE"), team("archived-team", "ARCHIVED")],
      invitations: [invitation("PENDING"), invitation("ACCEPTED")],
      projects: [project("active", "ACTIVE", 40), project("planned", "PLANNED", null)],
    });

    expect(metrics).toEqual({
      activeMembers: 1,
      totalMembers: 2,
      activeTeams: 1,
      pendingInvitations: 1,
      activeProjects: 1,
      totalProjects: 2,
      projectsReportingProgress: 1,
      averageReportedProgress: 40,
    });
  });

  it("summarizes lead and QA queues from the real API records", () => {
    expect(summarizeLeadDashboard([])).toEqual({ pendingApprovals: 0, projectsNeedingApproval: 0 });
    expect(summarizeLeadDashboard([
      { project_id: "project-a" },
      { project_id: "project-a" },
      { project_id: "project-b" },
    ])).toEqual({ pendingApprovals: 3, projectsNeedingApproval: 2 });
    expect(summarizeQaDashboard([
      { status: "PENDING" },
      { status: "APPROVED" },
      { status: "CHANGES_REQUESTED" },
      { status: "MERGED" },
    ])).toEqual({ pending: 1, approved: 1, changesRequested: 1 });
    expect(summarizeProjectManagerDashboard([
      project("active", "ACTIVE", 0, 3),
      project("planned", "PLANNED", null, 2),
    ])).toEqual({ activeProjects: 1, totalProjects: 2, tasks: 5, projectsReportingProgress: 1, averageReportedProgress: 0 });
    expect(summarizeProjectManagerDashboard([project("planned", "PLANNED", null)]).averageReportedProgress).toBeNull();
  });

  it("rejects API failures instead of returning demo or zero-valued data", async () => {
    vi.spyOn(apiClient, "codeReviews").mockRejectedValue(new Error("API unavailable"));

    await expect(loadDashboardData("reviewer", "org-a")).rejects.toThrow("API unavailable");
  });
});
