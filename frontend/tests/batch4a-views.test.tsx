import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HealthRisksView } from "../src/components/owner/HealthRisksView";
import { InvitationsView } from "../src/components/owner/InvitationsView";
import { ProjectsPortfolioView } from "../src/components/owner/ProjectsPortfolioView";
import { TeamsView } from "../src/components/owner/TeamsView";
import { calendarDaysUntil, deadlineStatus } from "../src/components/owner/project-format";
import { FIXTURE_INVITATIONS, FIXTURE_PORTFOLIO, FIXTURE_TEAMS } from "../src/lib/fixtures/org-admin";
import { FIXTURE_GRANTS } from "../src/lib/fixtures/permissions";
import { canWithGrants } from "../src/lib/permissions";
import type { PermissionKey } from "../src/types/permission";

const ORG = "org-acme";
const NOW = "2026-11-17T12:00:00Z";
const canFor = (role: keyof typeof FIXTURE_GRANTS) => (key: PermissionKey) => canWithGrants(FIXTURE_GRANTS[role], key);
const enabledButton = (label: string) => new RegExp(`<button(?![^>]*disabled)[^>]*>\\s*${label}`);

describe("deadline helpers (date-only, no 24h arithmetic)", () => {
  it("counts calendar days between local dates in the project time zone", () => {
    expect(calendarDaysUntil("2026-11-20", "America/New_York", NOW)).toBe(3);
    expect(calendarDaysUntil("2026-11-01", "America/New_York", NOW)).toBe(-16);
  });

  it("uses the project's local date, not UTC, near midnight", () => {
    // 03:00 UTC on Nov 18 is still Nov 17 in New York.
    expect(calendarDaysUntil("2026-11-18", "America/New_York", "2026-11-18T03:00:00Z")).toBe(1);
  });

  it("classifies overdue, due soon and later for open projects only", () => {
    expect(deadlineStatus({ targetDate: "2026-11-01", timezone: "UTC", lifecycle: "ACTIVE" }, NOW)).toBe("overdue");
    expect(deadlineStatus({ targetDate: "2026-11-20", timezone: "UTC", lifecycle: "ACTIVE" }, NOW)).toBe("due-soon");
    expect(deadlineStatus({ targetDate: "2027-03-01", timezone: "UTC", lifecycle: "PLANNED" }, NOW)).toBe("later");
    expect(deadlineStatus({ targetDate: "2026-11-01", timezone: "UTC", lifecycle: "DELIVERED" }, NOW)).toBe("closed");
  });
});

describe("InvitationsView", () => {
  const render = (props: Partial<React.ComponentProps<typeof InvitationsView>> = {}) =>
    renderToStaticMarkup(
      <InvitationsView invitations={FIXTURE_INVITATIONS(ORG)} source="fixture" can={canFor("ORGANIZATION_ADMIN")} now={NOW} {...props} />,
    );

  it("lists invitations without ever rendering the token", () => {
    const markup = render();
    expect(markup).toContain("clara.oswald@acmehealth.com");
    expect(markup).not.toContain("inv_tok_");
    expect(JSON.stringify(FIXTURE_INVITATIONS(ORG))).not.toContain("inv_tok_");
  });

  it("marks invite, resend and revoke as Later with no enabled write", () => {
    const markup = render();
    expect(markup).toContain("Later · task 1.2");
    for (const label of ["Invite member", "Resend", "Revoke"]) expect(markup).not.toMatch(enabledButton(label));
    expect(markup).toContain("Resend");
  });

  it("shows expiry relative to now", () => {
    expect(render()).toMatch(/Expires in 3 days|Expires 2026/);
  });

  it("is forbidden without member.invite", () => {
    const markup = render({ can: (key) => key === "role.manage" });
    expect(markup).toContain("Access Restricted");
    expect(markup).toContain("member.invite");
    expect(markup).not.toContain("clara.oswald");
  });

  it("has a specific empty state", () => {
    expect(render({ invitations: [] })).toContain("No invitations yet");
  });
});

describe("TeamsView", () => {
  const render = (props: Partial<React.ComponentProps<typeof TeamsView>> = {}) =>
    renderToStaticMarkup(<TeamsView teams={FIXTURE_TEAMS(ORG)} source="fixture" can={canFor("ORGANIZATION_ADMIN")} {...props} />);

  it("lists teams with lead and member count", () => {
    const markup = render();
    expect(markup).toContain("Core Clinical Engineering");
    expect(markup).toMatch(/3 members/);
    expect(markup).toContain("Lead");
  });

  it("marks team writes as Later", () => {
    const markup = render();
    expect(markup).toContain("Later · task 1.2");
    for (const label of ["Create team", "Edit", "Archive"]) expect(markup).not.toMatch(enabledButton(label));
  });

  it("is forbidden without team.manage and has an empty state", () => {
    expect(render({ can: () => false })).toContain("team.manage");
    expect(render({ teams: [] })).toContain("No teams yet");
  });
});

describe("ProjectsPortfolioView", () => {
  const portfolio = FIXTURE_PORTFOLIO(ORG);
  const render = (props: Partial<React.ComponentProps<typeof ProjectsPortfolioView>> = {}) =>
    renderToStaticMarkup(
      <ProjectsPortfolioView {...portfolio} source="fixture" can={canFor("ORGANIZATION_OWNER")} now={NOW} {...props} />,
    );

  it("lists projects with separate progress methods and no portfolio average", () => {
    const markup = render();
    expect(markup).toContain("EMR-200");
    expect(markup).toContain("Developer reported (Individual)");
    expect(markup).toContain("Calculated baseline (Structured)");
    expect(markup).not.toMatch(/average/i);
  });

  it("flags an overdue target date", () => {
    expect(render()).toContain("Overdue");
  });

  it("hides archived projects by default", () => {
    expect(render()).not.toContain(portfolio.projects.find((project) => project.archived)?.key ?? "__none__");
  });

  it("owner sees create and archive actions as Later; admin sees create only", () => {
    const owner = render();
    expect(owner).toContain("Create project");
    expect(owner).toContain("Later · task 2.1");
    expect(owner).toContain("Archive");
    expect(owner).not.toMatch(enabledButton("Create project"));
    expect(owner).not.toMatch(enabledButton("Archive"));

    const admin = render({ can: canFor("ORGANIZATION_ADMIN") });
    expect(admin).toContain("Create project");
    expect(admin).not.toMatch(/>\s*Archive\s*</);
  });

  it("offers list and card views and marks saved filters Later", () => {
    const markup = render();
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain("Cards");
    expect(markup).toContain("Later · task 5.3");
  });

  it("is forbidden without project.read and has an empty state", () => {
    expect(render({ can: () => false })).toContain("project.read");
    expect(render({ projects: [] })).toContain("No projects yet");
  });
});

describe("HealthRisksView", () => {
  const portfolio = FIXTURE_PORTFOLIO(ORG);
  const render = (props: Partial<React.ComponentProps<typeof HealthRisksView>> = {}) =>
    renderToStaticMarkup(
      <HealthRisksView projects={portfolio.projects} users={portfolio.users} source="fixture" can={canFor("ORGANIZATION_OWNER")} now={NOW} {...props} />,
    );

  it("lists need-attention projects with reasons and who can resolve", () => {
    const markup = render();
    expect(markup).toContain("Need attention");
    expect(markup).toContain("Who can resolve");
    expect(markup).toContain("Delayed");
  });

  it("labels the health rules engine as Later and does not invent causes", () => {
    const markup = render();
    expect(markup).toContain("Later · task 5.1");
  });

  it("is forbidden without project.read and shows a specific empty state", () => {
    expect(render({ can: () => false })).toContain("project.read");
    const onTrackOnly = portfolio.projects.filter((project) => project.health === "ON_TRACK");
    expect(render({ projects: onTrackOnly })).toContain("No active projects need attention");
  });
});
