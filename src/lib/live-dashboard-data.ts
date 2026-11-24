"use client";

import { useCallback, useEffect, useState } from "react";

import type { LoadStatus } from "@/components/delivery/DeliveryUI";
import { apiClient } from "@/lib/api";
import type {
  CodeReviewDto,
  InvitationDto,
  MemberDto,
  PendingReviewDto,
  ProjectDto,
  TeamDto,
} from "@/types/api";

export type LiveDashboardRole = "owner" | "admin" | "manager" | "lead" | "reviewer";

export type LiveDashboardData =
  | {
      kind: "organization";
      members: MemberDto[];
      teams: TeamDto[];
      invitations: InvitationDto[];
      projects: ProjectDto[];
    }
  | { kind: "manager"; projects: ProjectDto[] }
  | { kind: "lead"; pendingReviews: PendingReviewDto[] }
  | { kind: "reviewer"; codeReviews: CodeReviewDto[] };

const PAGE_SIZE = 50;

async function loadAllProjects(orgId: string): Promise<ProjectDto[]> {
  const projects: ProjectDto[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  while (true) {
    const page = await apiClient.projects(orgId, { limit: PAGE_SIZE, cursor });
    projects.push(...page.items);
    if (!page.has_more) return projects;
    if (!page.next_cursor || seenCursors.has(page.next_cursor)) {
      throw new Error("The project API returned an invalid pagination cursor.");
    }
    seenCursors.add(page.next_cursor);
    cursor = page.next_cursor;
  }
}

async function loadAllMembers(orgId: string): Promise<MemberDto[]> {
  const members: MemberDto[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  while (true) {
    const page = await apiClient.members(orgId, cursor);
    if (page.length <= PAGE_SIZE) {
      members.push(...page);
      return members;
    }

    members.push(...page.slice(0, PAGE_SIZE));
    const nextCursor = page[PAGE_SIZE - 1]?.id;
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error("The member API returned an invalid pagination cursor.");
    }
    seenCursors.add(nextCursor);
    cursor = nextCursor;
  }
}

export async function loadDashboardData(
  role: LiveDashboardRole,
  orgId: string,
): Promise<LiveDashboardData> {
  if (!orgId.trim()) throw new Error("An active organization is required to load dashboard data.");

  if (role === "owner" || role === "admin") {
    const [members, teams, invitations, projects] = await Promise.all([
      loadAllMembers(orgId),
      apiClient.teams(orgId),
      apiClient.invitations(orgId),
      loadAllProjects(orgId),
    ]);
    return { kind: "organization", members, teams, invitations, projects };
  }

  if (role === "manager") {
    return { kind: "manager", projects: await loadAllProjects(orgId) };
  }
  if (role === "lead") {
    return { kind: "lead", pendingReviews: await apiClient.pendingReviews(orgId) };
  }
  return { kind: "reviewer", codeReviews: await apiClient.codeReviews("assigned") };
}

export function summarizeOrganizationDashboard(data: {
  members: MemberDto[];
  teams: TeamDto[];
  invitations: InvitationDto[];
  projects: ProjectDto[];
}) {
  const reportedProgress = data.projects
    .map((project) => project.progress.percent)
    .filter((percent): percent is number => percent !== null);

  return {
    activeMembers: data.members.filter((member) => member.status === "ACTIVE").length,
    totalMembers: data.members.length,
    activeTeams: data.teams.filter((team) => team.status === "ACTIVE").length,
    pendingInvitations: data.invitations.filter((invite) => invite.status === "PENDING").length,
    activeProjects: data.projects.filter((project) => project.lifecycle === "ACTIVE").length,
    totalProjects: data.projects.length,
    projectsReportingProgress: reportedProgress.length,
    averageReportedProgress: reportedProgress.length
      ? Math.round(reportedProgress.reduce((total, percent) => total + percent, 0) / reportedProgress.length)
      : null,
  };
}

export function summarizeProjectManagerDashboard(projects: ProjectDto[]) {
  const reportedProgress = projects
    .map((project) => project.progress.percent)
    .filter((percent): percent is number => percent !== null);

  return {
    activeProjects: projects.filter((project) => project.lifecycle === "ACTIVE").length,
    totalProjects: projects.length,
    tasks: projects.reduce((total, project) => total + project.task_count, 0),
    projectsReportingProgress: reportedProgress.length,
    averageReportedProgress: reportedProgress.length
      ? Math.round(reportedProgress.reduce((total, percent) => total + percent, 0) / reportedProgress.length)
      : null,
  };
}

export function summarizeLeadDashboard(pendingReviews: Pick<PendingReviewDto, "project_id">[]) {
  return {
    pendingApprovals: pendingReviews.length,
    projectsNeedingApproval: new Set(pendingReviews.map((review) => review.project_id)).size,
  };
}

export function summarizeQaDashboard(codeReviews: Pick<CodeReviewDto, "status">[]) {
  return {
    pending: codeReviews.filter((review) => review.status === "PENDING").length,
    approved: codeReviews.filter((review) => review.status === "APPROVED").length,
    changesRequested: codeReviews.filter((review) => review.status === "CHANGES_REQUESTED").length,
  };
}

export function useLiveDashboardData(role: LiveDashboardRole, orgId: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<
    | { key: string; status: "loading" }
    | { key: string; status: "error"; message: string }
    | { key: string; status: "ready"; data: LiveDashboardData }
  >({ key: "", status: "loading" });
  const key = `${role}:${orgId}`;

  useEffect(() => {
    let active = true;
    setResult({ key, status: "loading" });
    loadDashboardData(role, orgId)
      .then((data) => {
        if (active) setResult({ key, status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "The dashboard data could not be loaded.";
        setResult({ key, status: "error", message });
      });

    return () => {
      active = false;
    };
  }, [attempt, key, orgId, role]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);
  const currentResult = result.key === key ? result : { status: "loading" as const };
  const status: LoadStatus = currentResult.status;
  return {
    status,
    data: currentResult.status === "ready" ? currentResult.data : undefined,
    errorMessage: currentResult.status === "error" ? currentResult.message : undefined,
    retry,
  };
}
