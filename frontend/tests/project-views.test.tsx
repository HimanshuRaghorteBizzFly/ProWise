import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IDEMPOTENCY_KEY_HEADER, createApiClient } from "../src/lib/api";
import type { ProjectDto } from "../src/types/api";

// Task 2.1 (T09, T11): project records on the real API.

const allowed = new Set<string>();

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/org/org-1/owner/projects",
}));

vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ status: "ready", can: (key: string) => allowed.has(key), retry: () => undefined }),
}));

const { ProjectCreateView, ProjectWorkspaceView, ProjectsPortfolioView, formatDay } = await import(
  "../src/components/projects/ApiProjectViews"
);

const NO_FILTERS = { q: "", status: "", mode: "", owner: "", team: "", from: "", to: "" };

function solo(extra: Partial<ProjectDto> = {}): ProjectDto {
  return {
    id: "p-1",
    key: "CRM",
    name: "Customer portal",
    description: "Self-service portal",
    mode: "INDIVIDUAL",
    lifecycle: "PLANNED",
    archived: false,
    priority: "MEDIUM",
    project_manager: null,
    accountable: { membership_id: "m-dev", email: "dev@example.test" },
    members: [{ membership_id: "m-dev", email: "dev@example.test" }],
    team_id: null,
    team_name: null,
    start_on: "2026-12-01",
    target_on: "2027-03-31",
    timezone: "Europe/London",
    active_baseline_id: null,
    task_count: 0,
    progress: { percent: null, label: "Not reported", reported_at: null },
    can_edit: false,
    version: 0,
    created_at: "2026-11-21T10:00:00Z",
    updated_at: "2026-11-21T10:00:00Z",
    ...extra,
  };
}

function render(node: React.ReactElement, seed: (client: QueryClient) => void) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  seed(client);
  return renderToStaticMarkup(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

function seedPortfolio(rows: ProjectDto[]) {
  return (client: QueryClient) => {
    client.setQueryData(["projects", "org-1", NO_FILTERS], { pages: [{ items: rows, next_cursor: null, has_more: false }], pageParams: [null] });
    client.setQueryData(["project-options", "org-1"], { members: [], teams: [], default_timezone: "Europe/London" });
  };
}

beforeEach(() => allowed.clear());

describe("project API client", () => {
  it("lists with cursor and filters, and creates with an Idempotency-Key", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ items: [], next_cursor: null, has_more: false })));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, isRolePreview: () => false });

    await client.projects("org-1", { q: "crm", status: "ACTIVE", mode: "", cursor: "abc", limit: 25 });
    await client.createProject("org-1", { name: "X", key: "XX", mode: "INDIVIDUAL", accountable_membership_id: "m" });
    await client.updateProject("org-1", "p-1", { target_on: "2027-04-30", previous_target_on: "2027-03-31", target_date_reason: "Scope", expected_version: 3 });

    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/v1/organizations/org-1/projects?q=crm&status=ACTIVE&cursor=abc&limit=25");
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get(IDEMPOTENCY_KEY_HEADER)).toBeTruthy();
    expect(fetchMock.mock.calls[2][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ expected_version: 3, target_date_reason: "Scope" });
  });

  it("shows a local date as the same calendar day in every viewer time zone", () => {
    expect(formatDay("2027-03-31")).toBe("31 Mar 2027");
    expect(formatDay(null)).toBe("Not set");
  });
});

describe("All projects", () => {
  it("lists permitted projects with Not reported progress, and Create only with project.create", () => {
    allowed.add("project.read");
    const withoutCreate = render(<ProjectsPortfolioView base="owner" />, seedPortfolio([solo()]));
    expect(withoutCreate).toContain("Customer portal");
    expect(withoutCreate).toContain("Not reported");
    expect(withoutCreate).not.toContain("Create project");
    allowed.add("project.create");
    const withCreate = render(<ProjectsPortfolioView base="admin" />, seedPortfolio([solo()]));
    expect(withCreate).toContain("/org/org-1/admin/projects/new");
    expect(render(<ProjectsPortfolioView base="manager" />, seedPortfolio([solo()]))).toContain("/org/org-1/manager/create-project");
  });

  it("shows an empty portfolio state", () => {
    const markup = render(<ProjectsPortfolioView base="owner" />, seedPortfolio([]));
    expect(markup).toContain("No projects yet");
  });
});

describe("Create project", () => {
  it("refuses the page without project.create", () => {
    const markup = render(<ProjectCreateView base="owner" />, () => undefined);
    expect(markup).toContain("project.create");
    expect(markup).not.toContain("Accountable developer");
  });

  it("offers every setup field as a page (no dialog)", () => {
    allowed.add("project.create");
    const markup = render(<ProjectCreateView base="owner" />, (client) =>
      client.setQueryData(["project-options", "org-1"], {
        members: [{ membership_id: "m-dev", email: "dev@example.test", role_template: "DEVELOPER" }],
        teams: [],
        default_timezone: "Europe/London",
      }));
    for (const label of ["Name", "Key (stable, unique)", "Scope description", "Individual", "Structured",
      "Accountable developer (required)", "Project manager", "Start date", "Target date", "Time zone", "Priority"]) {
      expect(markup).toContain(label);
    }
    expect(markup).toContain("Back to projects");
    expect(markup).not.toContain('role="dialog"');
  });
});

describe("Project workspace", () => {
  it("shows target date, zero tasks and Not reported for a new solo project with Individual tabs", () => {
    const markup = render(<ProjectWorkspaceView base="owner" projectId="p-1" />, (client) =>
      client.setQueryData(["project", "org-1", "p-1"], solo()));
    expect(markup).toContain("31 Mar 2027");
    expect(markup).toContain("Not reported");
    for (const tab of ["Overview", "Updates", "Repositories", "Activity", "Settings"]) expect(markup).toContain(tab);
    expect(markup).not.toContain("/projects/p-1/edit"); // no edit right, no edit action
  });

  it("offers Edit only when the project is editable, and marks Structured tabs as later", () => {
    const markup = render(<ProjectWorkspaceView base="manager" projectId="p-1" />, (client) =>
      client.setQueryData(["project", "org-1", "p-1"], solo({ mode: "STRUCTURED", can_edit: true })));
    expect(markup).toContain("/org/org-1/manager/projects/p-1/edit");
    expect(markup).toContain("arrive with tasks 3.1 to 3.4");
    expect(markup).not.toContain(">Repositories<");
  });
});
