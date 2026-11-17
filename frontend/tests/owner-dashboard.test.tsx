import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OwnerDashboardView } from "../src/components/owner/OwnerDashboardView";
import { getOwnerDashboardStateForOrg } from "../src/hooks/useOwnerDashboard";
import { SEEDED_PROJECTS, SEEDED_USERS } from "../src/lib/mock-data";

const acmeProjects = SEEDED_PROJECTS.filter((project) => project.orgId === "org-acme");

describe("Owner dashboard", () => {
  it("labels fixture data and keeps the two progress methods separate", () => {
    const markup = renderToStaticMarkup(
      <OwnerDashboardView
        orgId="org-acme"
        orgName="Acme Health Technologies"
        projects={acmeProjects}
        users={SEEDED_USERS}
        canViewProjects
      />,
    );

    expect(markup).toContain("Read-only fixture preview");
    expect(markup).toContain("Developer reported (Individual)");
    expect(markup).toContain("Calculated baseline (Structured)");
    expect(markup).toContain("45%");
    expect(markup).toContain("50%");
    expect(markup).not.toContain("Portfolio average");
  });

  it("shows fixture health reasons without inventing a corrective action", () => {
    const markup = renderToStaticMarkup(
      <OwnerDashboardView
        orgId="org-acme"
        orgName="Acme Health Technologies"
        projects={acmeProjects}
        users={SEEDED_USERS}
        canViewProjects
      />,
    );

    expect(markup).toContain("Items needing attention");
    expect(markup).toContain("Target completion date (2026-11-01) has passed while project is unfinished.");
    expect(markup).toContain("Corrective next action is not provided in this fixture.");
  });

  it("shows unavailable backend-dependent panels without exposing fixture records", () => {
    const markup = renderToStaticMarkup(
      <OwnerDashboardView
        orgId="org-acme"
        orgName="Acme Health Technologies"
        projects={acmeProjects}
        users={SEEDED_USERS}
        canViewProjects
      />,
    );

    expect(markup).toContain("Later · task 1.2");
    expect(markup).toContain("Later · task 1.4");
    expect(markup).toContain("audit.read");
    expect(markup).toContain("Later · task 5.4");
    expect(markup).not.toContain("Approved scope baseline v1");
    expect(markup).not.toContain("inv_tok_");
  });

  it("does not render project data when project viewing is denied", () => {
    const markup = renderToStaticMarkup(
      <OwnerDashboardView
        orgId="org-acme"
        orgName="Acme Health Technologies"
        projects={acmeProjects}
        users={SEEDED_USERS}
        canViewProjects={false}
      />,
    );

    expect(markup).toContain("Access Restricted");
    expect(markup).toContain("project.read");
    expect(markup).not.toContain("EMR-200");
  });

  it("shows an empty state when the permitted portfolio has no projects", () => {
    const markup = renderToStaticMarkup(
      <OwnerDashboardView
        orgId="org-empty"
        orgName="Empty workspace"
        projects={[]}
        users={[]}
        canViewProjects
      />,
    );

    expect(markup).toContain("No projects in this workspace");
    expect(markup).toContain("No active projects need attention");
  });

  it("does not expose a previous organization's dashboard while the new scope loads", () => {
    const state = getOwnerDashboardStateForOrg(
      { status: "ready", orgId: "org-acme", projects: acmeProjects, users: SEEDED_USERS },
      "org-nova",
    );

    expect(state).toEqual({ status: "loading", orgId: "org-nova" });
  });
});
