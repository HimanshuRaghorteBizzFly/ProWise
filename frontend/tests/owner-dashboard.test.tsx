import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { OwnerDashboardView } from "../src/components/owner/OwnerDashboardView";
import { getOwnerDashboardStateForOrg } from "../src/hooks/useOwnerDashboard";
import {
  FIXTURE_AUDIT,
  FIXTURE_INVITATIONS,
  FIXTURE_MEMBERS,
  FIXTURE_PORTFOLIO,
  FIXTURE_REPOSITORIES,
  FIXTURE_TEAMS,
} from "../src/lib/fixtures/org-admin";
import { SEEDED_PROJECTS, SEEDED_USERS } from "../src/lib/mock-data";

const orgId = "org-acme";
const orgName = "Acme Health Technologies";
const basePath = `/org/${orgId}/owner`;
const portfolio = FIXTURE_PORTFOLIO(orgId);
const members = FIXTURE_MEMBERS(orgId);
const invitations = FIXTURE_INVITATIONS(orgId);
const teams = FIXTURE_TEAMS(orgId);
const repositories = FIXTURE_REPOSITORIES(orgId);
const audit = FIXTURE_AUDIT(orgId);

function renderDashboard(props: Partial<React.ComponentProps<typeof OwnerDashboardView>> = {}) {
  return renderToStaticMarkup(
    <OwnerDashboardView
      orgId={orgId}
      orgName={orgName}
      {...portfolio}
      members={members}
      invitations={invitations}
      teams={teams}
      repositories={repositories}
      audit={audit}
      canViewProjects
      basePath={basePath}
      can={() => true}
      {...props}
    />,
  );
}

describe("Owner dashboard", () => {
  it("renders organization KPIs and both portfolio charts from sample fixtures", () => {
    const markup = renderDashboard();

    expect(markup).toContain("Organization overview");
    expect(markup).toContain("Sample data");
    expect(markup).toContain("Active projects");
    expect(markup).toContain("Active members");
    expect(markup).toContain("Active teams");
    expect(markup).toContain("Pending invites");
    expect(markup).toContain("Need attention");
    expect(markup).toContain("GitHub repositories");
    expect(markup).toContain("Active projects by health");
    expect(markup).toContain("Project count by lifecycle");
    expect(markup).toContain("GitHub activity never determines completion");
  });

  it("links owner dashboard records to their full-page routes", () => {
    const markup = renderDashboard();

    expect(markup).toContain(`${basePath}/projects/${portfolio.projects[0].id}`);
    expect(markup).toContain(`${basePath}/members/${members[0].id}`);
    expect(markup).toContain(`${basePath}/teams/${teams[0].id}`);
    expect(markup).toContain(`${basePath}/invitations/${invitations[0].id}`);
    expect(markup).toContain(`${basePath}/integrations/${repositories[0].id}`);
    expect(markup).toContain(`${basePath}/audit-logs/${audit[0].id}`);
    expect(markup).toContain(`${basePath}/projects/new`);
    expect(markup).toContain(`${basePath}/invitations/new`);
  });

  it("does not render project data when project viewing is denied", () => {
    const markup = renderDashboard({ canViewProjects: false });

    expect(markup).toContain("Access Restricted");
    expect(markup).toContain("project.read");
    expect(markup).not.toContain("EMR-200");
  });

  it("shows meaningful empty states when the organization has no records", () => {
    const markup = renderDashboard({
      projects: [],
      users: [],
      members: [],
      invitations: [],
      teams: [],
      repositories: [],
      audit: [],
    });

    expect(markup).toContain("No active project health data is available");
    expect(markup).toContain("No projects are available in this organization");
    expect(markup).toContain("No members are listed yet");
    expect(markup).toContain("No repositories connected");
    expect(markup).toContain("No audit events are recorded");
  });

  it("does not show a previous organization's dashboard while the new scope loads", () => {
    const acmeProjects = SEEDED_PROJECTS.filter((project) => project.orgId === orgId);
    const state = getOwnerDashboardStateForOrg(
      { status: "ready", orgId, projects: acmeProjects, users: SEEDED_USERS },
      "org-nova",
    );

    expect(state.orgId).toBe("org-nova"); // never the previous organization's data
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "");
    expect(getOwnerDashboardStateForOrg(
      { status: "ready", orgId, projects: acmeProjects, users: SEEDED_USERS },
      "org-nova",
    )).toEqual({ status: "unavailable", orgId: "org-nova" }); // normal use: no sample data
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "true");
    const preview = getOwnerDashboardStateForOrg(
      { status: "ready", orgId, projects: acmeProjects, users: SEEDED_USERS },
      "org-nova",
    );
    vi.unstubAllEnvs();
    expect(preview).toEqual({ status: "loading", orgId: "org-nova" });
  });
});
