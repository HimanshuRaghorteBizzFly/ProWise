import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AuditView } from "../src/components/owner/AuditView";
import { HealthRisksView } from "../src/components/owner/HealthRisksView";
import { IntegrationsView } from "../src/components/owner/IntegrationsView";
import { NotificationsView } from "../src/components/owner/NotificationsView";
import { OrganizationDangerZone } from "../src/components/owner/OrganizationDangerZone";
import { OwnerDashboardView } from "../src/components/owner/OwnerDashboardView";
import { OwnerOrganizationSettingsView } from "../src/components/owner/OwnerOrganizationSettingsView";
import { PrivacyView } from "../src/components/owner/PrivacyView";
import { ReportsView } from "../src/components/owner/ReportsView";
import {
  FIXTURE_AUDIT,
  FIXTURE_NOTIFICATIONS,
  FIXTURE_PORTFOLIO,
  FIXTURE_REPOSITORIES,
} from "./fixtures/org-admin";
import { FIXTURE_GRANTS } from "./fixtures/permissions";
import { SEEDED_ORGS, SEEDED_PROJECTS, SEEDED_USERS } from "./fixtures/mock-data";
import { canWithGrants } from "../src/lib/permissions";
import type { PermissionKey } from "../src/types/permission";

const ORG = "org-acme";
const NOW = "2026-11-17T12:00:00Z";
const canFor = (role: keyof typeof FIXTURE_GRANTS) => (key: PermissionKey) => canWithGrants(FIXTURE_GRANTS[role], key);
const enabledButton = (label: string) => new RegExp(`<button(?![^>]*disabled)[^>]*>\\s*${label}`);

<<<<<<< HEAD
describe("Owner dashboard in production", () => {
  it("never starts from fixture data in a production build", () => {
    expect(getOwnerDashboardStart(ORG, { nodeEnv: "production", useMocks: "true" })).toEqual({ status: "unavailable", orgId: ORG });
  });

  it("loads fixtures outside production only with NEXT_PUBLIC_USE_MOCKS=true", () => {
    expect(getOwnerDashboardStart(ORG, { nodeEnv: "development", useMocks: "true" })).toEqual({ status: "loading", orgId: ORG });
    expect(getOwnerDashboardStart(ORG, { nodeEnv: "development", useMocks: undefined })).toEqual({ status: "unavailable", orgId: ORG });
  });
});

=======
>>>>>>> 29db595 (Initial ProWise project upload)
describe("Who can resolve is labelled as recorded data", () => {
  it("on the dashboard", () => {
    const markup = renderToStaticMarkup(
      <OwnerDashboardView
        orgId={ORG}
        orgName="Acme"
        projects={SEEDED_PROJECTS.filter((project) => project.orgId === ORG)}
        users={SEEDED_USERS}
        canViewProjects
      />,
    );
    expect(markup).toContain("Who can resolve");
    expect(markup).toContain("From the project record");
  });

  it("on Health & risks", () => {
    const portfolio = FIXTURE_PORTFOLIO(ORG);
    const markup = renderToStaticMarkup(
      <HealthRisksView projects={portfolio.projects} users={portfolio.users} can={canFor("ORGANIZATION_OWNER")} now={NOW} />,
    );
    expect(markup).toContain("From the project record");
  });
});

describe("IntegrationsView", () => {
  const render = (props: Partial<React.ComponentProps<typeof IntegrationsView>> = {}) =>
    renderToStaticMarkup(
      <IntegrationsView family="owner" repositories={FIXTURE_REPOSITORIES(ORG)} can={canFor("ORGANIZATION_OWNER")} {...props} />,
    );

  it("lists repositories with sync status and failure reason", () => {
    const markup = render();
    expect(markup).toContain("acme-health/fhir-intake");
    expect(markup).toContain("Failed");
    expect(markup).toContain("Re-authorization required");
  });

  it("states that repository activity is evidence only", () => {
    expect(render()).toContain("never sets completion");
  });

  it("gates connect on repo.connect and approval on org.manage, both Later", () => {
    const owner = render();
    expect(owner).toContain("Connect repositories");
    expect(owner).toContain("Approve integration");
    expect(owner).toContain("Later · task 4.1");
    expect(owner).not.toMatch(enabledButton("Connect repositories"));

    const admin = render({ family: "admin", can: canFor("ORGANIZATION_ADMIN") });
    expect(admin).toContain("Connect repositories");
    expect(admin).not.toContain("Approve integration");
  });

  it("is forbidden without repo.read and shows GitHub disconnected when empty", () => {
    expect(render({ can: () => false })).toContain("repo.read");
    expect(render({ repositories: [] })).toContain("GitHub disconnected");
  });
});

describe("ReportsView", () => {
  const portfolio = FIXTURE_PORTFOLIO(ORG);
  const render = (props: Partial<React.ComponentProps<typeof ReportsView>> = {}) =>
    renderToStaticMarkup(<ReportsView projects={portfolio.projects} can={canFor("ORGANIZATION_OWNER")} now={NOW} {...props} />);

  it("offers the four blueprint reports", () => {
    const markup = render();
    for (const name of ["Portfolio", "Overdue", "Workload", "Acceptance"]) expect(markup).toContain(name);
  });

  it("previews overdue projects from the record", () => {
    expect(render()).toContain("EMR-200");
  });

  it("shows CSV export only with report.export, always Later", () => {
    const markup = render();
    expect(markup).toContain("Export CSV");
    expect(markup).toContain("Later · task 5.5");
    expect(markup).not.toMatch(enabledButton("Export CSV"));
    expect(render({ can: (key) => key === "project.read" })).not.toContain("Export CSV");
  });

  it("is forbidden without project.read", () => {
    expect(render({ can: () => false })).toContain("project.read");
  });
});

describe("NotificationsView", () => {
  const notifications = FIXTURE_NOTIFICATIONS(ORG, "usr-owner", `/org/${ORG}/owner`);
  const render = (props: Partial<React.ComponentProps<typeof NotificationsView>> = {}) =>
    renderToStaticMarkup(<NotificationsView notifications={notifications} {...props} />);

  it("lists only the viewer's notifications with links inside their family", () => {
    expect(notifications.length).toBeGreaterThan(0);
    expect(notifications.every((notification) => notification.userId === "usr-owner")).toBe(true);
    expect(notifications.every((notification) => notification.targetUrl.startsWith(`/org/${ORG}/owner/`))).toBe(true);
    expect(render()).toContain(notifications[0].title);
  });

  it("marks read state changes and preferences as Later", () => {
    const markup = render();
    expect(markup).toContain("Later · task 5.2");
    expect(markup).not.toMatch(enabledButton("Mark all read"));
  });

  it("has a specific empty state", () => {
    expect(render({ notifications: [] })).toContain("No notifications");
  });
});

describe("AuditView", () => {
  const render = (props: Partial<React.ComponentProps<typeof AuditView>> = {}) =>
    renderToStaticMarkup(<AuditView records={FIXTURE_AUDIT(ORG)} can={canFor("ORGANIZATION_ADMIN")} {...props} />);

  it("lists audit records with actor, action and UTC time", () => {
    const markup = render();
    expect(markup).toContain("elena.rostova@acmehealth.com");
    expect(markup).toContain("Baseline approved");
    expect(markup).toContain("UTC");
  });

  it("is forbidden without audit.read (admins need it too)", () => {
    const markup = render({ can: (key) => key !== "audit.read" });
    expect(markup).toContain("audit.read");
    expect(markup).not.toContain("elena.rostova");
  });

  it("labels the audit API Later and has an empty state", () => {
    expect(render()).toContain("Later · task 1.4");
    expect(render({ records: [] })).toContain("No audit records");
  });

  it("does not offer operator support grants (N2 not built)", () => {
    expect(render()).not.toMatch(/support access grant/i);
  });
});

describe("PrivacyView", () => {
  const render = (can = canFor("ORGANIZATION_OWNER")) => renderToStaticMarkup(<PrivacyView can={can} />);

  it("is owner-only through org.manage", () => {
    expect(render(canFor("ORGANIZATION_ADMIN"))).toContain("Access Restricted");
    expect(render(canFor("ORGANIZATION_ADMIN"))).toContain("org.manage");
  });

  it("marks export, deletion and retention requests Later", () => {
    const markup = render();
    expect(markup).toContain("Later · task 5.6");
    for (const label of ["Request data export", "Request deletion"]) expect(markup).not.toMatch(enabledButton(label));
    expect(markup).not.toMatch(/support access grant/i);
  });
});

describe("Organization settings extension", () => {
  const organization = SEEDED_ORGS[0];

  it("is read-only with a Later reason and no local-preview save", () => {
    const markup = renderToStaticMarkup(
      <OwnerOrganizationSettingsView
        organization={organization}
        canEdit={false}
        onSave={vi.fn()}
        showLocalPreviewNotice={false}
        readOnlyReason="Saving settings is not available yet."
      />,
    );
    expect(markup).toContain("Saving settings is not available yet.");
    expect(markup).not.toContain("Local preview only");
    expect(markup).not.toContain(">Save changes<");
  });

  it("shows the danger zone transfer only to the current owner with org.manage", () => {
    expect(renderToStaticMarkup(<OrganizationDangerZone canTransfer />)).toContain("Transfer ownership");
    expect(renderToStaticMarkup(<OrganizationDangerZone canTransfer transferHref="/org/o1/owner/transfer-ownership" />)).toContain(
      `href="/org/o1/owner/transfer-ownership"`,
    );
    expect(renderToStaticMarkup(<OrganizationDangerZone canTransfer={false} />)).toBe("");
  });
});
