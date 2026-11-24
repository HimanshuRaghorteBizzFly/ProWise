import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// Only real data in normal use: pages without a backend show "Later (task X)", mock data needs
// NEXT_PUBLIC_USE_MOCKS=true, dashboards render only what the API returned for the active organization.

let pathname = "/org/org-a/owner/health";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useParams: () => ({ orgId: "org-a" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ status: "ready", can: (key: string) => key === "project.create" || key === "member.invite", canAny: () => true, retry: () => undefined }),
}));

const { isLiveRoute, laterInfoFor, areaOf } = await import("../src/lib/live-routes");
const { LiveRouteGate } = await import("../src/components/data/LiveRouteGate");
const { loadProwiseMock } = await import("../src/mocks/load-prowise-mock");
const { DeveloperDashboardContent, ViewerDashboardContent } = await import("../src/components/dashboards/LiveRoleDashboards");
const { OrganizationTable, PlatformDashboardContent } = await import("../src/app/(platform)/super-admin/_components/LivePlatformViews");
const { OperatorStatsContent } = await import("../src/app/(platform)/platform-operator/_components/LiveOperatorDashboard");
const { LiveOrganizationDashboard } = await import("../src/components/org-console/LiveOrganizationDashboard");

afterEach(() => {
  vi.unstubAllEnvs();
  pathname = "/org/org-a/owner/health";
});

describe("route registry", () => {
  it("keeps every role dashboard and the real record pages live, for any organization id", () => {
    for (const role of ["owner", "admin", "manager", "lead", "developer", "reviewer", "viewer"]) {
      expect(isLiveRoute(`/org/0a1b/${role}/dashboard`)).toBe(true);
      expect(isLiveRoute(`/org/0a1b/${role}`)).toBe(true);
    }
    for (const path of [
      "/org/x/owner/members", "/org/x/owner/members/m-1", "/org/x/owner/invitations/new", "/org/x/owner/teams/t-1",
      "/org/x/owner/roles-permissions", "/org/x/owner/projects/p-1/edit", "/org/x/admin/projects",
      "/org/x/manager/projects/p-1", "/org/x/manager/create-project", "/org/x/lead/check-ins",
      "/org/x/developer/checkins", "/org/x/developer/projects/p-1/individual/new-check-in",
      "/super-admin/dashboard", "/super-admin/organizations", "/super-admin/users", "/platform-operator/dashboard",
    ]) expect(isLiveRoute(path)).toBe(true);
  });

  it("sends pages without a backend to Later with the task that delivers them", () => {
    expect(isLiveRoute("/org/x/owner/health")).toBe(false);
    expect(laterInfoFor("/org/x/owner/health").task).toBe("5.1");
    expect(laterInfoFor("/org/x/manager/workload/m-1").task).toBe("5.4");
    expect(laterInfoFor("/org/x/owner/reports").task).toBe("5.5");
    expect(laterInfoFor("/org/x/developer/github").task).toBe("4.1");
    expect(laterInfoFor("/org/x/manager/work-items/t-1").task).toBe("3.1");
    expect(laterInfoFor("/org/x/developer/projects/p-1/structured/blockers").task).toBe("3.4");
    expect(laterInfoFor("/org/x/developer/deadlines").task).toBe("2.3");
    expect(laterInfoFor("/org/x/owner/billing").task).toBe("not in V1");
    expect(isLiveRoute("/super-admin/plans")).toBe(false);
  });

  it("does not gate sign-in and other non-workspace pages", () => {
    expect(areaOf("/login")).toBeNull();
    expect(isLiveRoute("/signup")).toBe(true);
  });
});

describe("live route gate", () => {
  it("shows Later (no page, no sample data) without NEXT_PUBLIC_USE_MOCKS", () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "");
    const html = renderToStaticMarkup(<LiveRouteGate><p>Acme Health Technologies 42 risks</p></LiveRouteGate>);
    expect(html).toContain("Later · task 5.1");
    expect(html).not.toContain("Acme");
    expect(html).not.toContain("42 risks");
    expect(html).toContain("/org/org-a/owner/dashboard");
    expect(html).toContain("Create a project"); // real next steps where the membership has the permission
    expect(html).toContain("Invite your team");
  });

  it("renders live pages normally, and every page in the dev preview", () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "");
    pathname = "/org/org-a/owner/members";
    expect(renderToStaticMarkup(<LiveRouteGate><p>members page</p></LiveRouteGate>)).toContain("members page");
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "true");
    pathname = "/org/org-a/owner/health";
    expect(renderToStaticMarkup(<LiveRouteGate><p>preview page</p></LiveRouteGate>)).toContain("preview page");
  });
});

describe("mock data needs the flag", () => {
  it("loads no sample company, person or number without NEXT_PUBLIC_USE_MOCKS", () => {
    const normal = loadProwiseMock({ nodeEnv: "development", useMocks: undefined });
    expect(normal.organizations).toEqual([]);
    expect(normal.users).toEqual([]);
    expect(JSON.stringify(normal)).not.toContain("Acme");
    expect(loadProwiseMock({ nodeEnv: "production", useMocks: "true" }).organizations).toEqual([]);
    expect(loadProwiseMock({ nodeEnv: "development", useMocks: "true" }).organizations.length).toBeGreaterThan(0);
  });
});

describe("role dashboards on real data", () => {
  it("developer: a new workspace shows real zeros and no invented projects", () => {
    const html = renderToStaticMarkup(<DeveloperDashboardContent projects={[]} email="dev@new.test" base="/org/org-a/developer" />);
    expect(html).toContain("No projects yet");
    expect(html).toContain("Later · task 3.1");
    expect(html).not.toContain("Acme");
  });

  it("viewer: only the projects the API returned", () => {
    const html = renderToStaticMarkup(<ViewerDashboardContent projects={[]} base="/org/org-a/viewer" />);
    expect(html).toContain("No projects shared with you");
  });

  it("organization dashboard shows only the active organization's records", () => {
    const orgA = { kind: "organization" as const, members: [{ membership_id: "m-a", status: "ACTIVE", email: "owner@a.test" }] as never,
      teams: [], invitations: [], projects: [] };
    const html = renderToStaticMarkup(<LiveOrganizationDashboard data={orgA} href={(p = "") => `/org/org-a/owner/${p}`} />);
    expect(html).toContain("1 total");
    expect(html).not.toContain("Company B");
    expect(html).not.toContain("Acme");
  });
});

describe("platform pages on stored data", () => {
  const org = (name: string, members: number, projects: number) => ({
    id: name, name, slug: name.toLowerCase().replace(/\s+/g, "-"), domain: null, industry: null, country: null,
    timezone: "UTC", owner_name: "Founder", owner_email: `founder@${name.toLowerCase().replace(/\s+/g, "")}.test`,
    status: "ACTIVE", plan_id: null, seats_used: members, seats_limit: 0, projects_count: projects,
    created_at: "2026-11-24T10:00:00Z", last_activity_at: null,
  });

  it("Super Admin lists the real organizations with real counts, and says revenue history is not stored", () => {
    const html = renderToStaticMarkup(<PlatformDashboardContent
      dashboard={{ total_organizations: 1, active_organizations: 1, trial_organizations: 0, suspended_organizations: 0, active_operators: 0, total_seats_allocated: 0 }}
      organizations={[org("New Co", 1, 0)]} />);
    expect(html).toContain("New Co");
    expect(html).toContain("founder@newco.test");
    expect(html).toContain("not stored yet");
    expect(html).not.toContain("Enterprise Software");
    expect(renderToStaticMarkup(<OrganizationTable organizations={[]} />)).toContain("No organizations yet");
  });

  it("Platform Operator shows stored counts and no invented health score", () => {
    const html = renderToStaticMarkup(<OperatorStatsContent stats={{ openIncidents: 0, openTickets: 2, pendingWebhooks: 0, failedJobs: 0, unacknowledgedAlerts: 1, operationalStatus: "OPERATIONAL" }} />);
    expect(html).toContain("Open support tickets");
    expect(html).not.toContain("99.98");
  });
});
