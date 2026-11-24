import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Developer workspace (Phase 3 developer UI): authenticated transport, the 11-item sidebar, and the task workflow.

let pathname = "/org/org-acme/developer/dashboard";
vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-acme", taskId: "t-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => pathname,
  useSearchParams: () => new URLSearchParams(),
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));

const { ApiError, apiClient } = await import("../src/lib/api");
const { developerApi, camelizeKeys, snakeizeKeys } = await import("../src/lib/developer-api");
const { devKeys } = await import("../src/components/developer/useDeveloperData");
const { isOverdue } = await import("../src/components/developer/DevUI");
const { Sidebar } = await import("../src/components/navigation/sidebar");
const { useAuthStore } = await import("../src/store/auth-store");
const { permissionStore } = await import("../src/store/permission-store");
const { FIXTURE_GRANTS } = await import("./fixtures/permissions");
const { SEEDED_ORGS } = await import("./fixtures/mock-data");
const TaskPage = (await import("../src/app/(workspace)/org/[orgId]/developer/tasks/[taskId]/page")).default;

import type { ReviewHistoryDto, WorkItemDto } from "../src/types/work";

afterEach(() => vi.restoreAllMocks());

/* ------------------------------------------------------------------ transport */

describe("developerApi transport", () => {
  it("goes through the authenticated client and converts snake_case at the boundary", async () => {
    const call = vi.spyOn(apiClient, "call").mockResolvedValue([{ project_id: "p-1", completion_percent: null, latest_check_in: { approved_at: "x" } }]);
    const rows = await developerApi.getProjects("ignored-org");
    expect(call).toHaveBeenCalledWith("/v1/developer/projects", { method: undefined, body: undefined });
    expect(rows).toEqual([{ projectId: "p-1", completionPercent: null, latestCheckIn: { approvedAt: "x" } }]);
  });

  it("sends request bodies as snake_case", async () => {
    const call = vi.spyOn(apiClient, "call").mockResolvedValue({});
    await developerApi.createBug({ projectId: "p-1", title: "T", description: "D", reproductionSteps: "1. open" });
    expect(call).toHaveBeenCalledWith("/v1/developer/bugs", {
      method: "POST",
      body: { project_id: "p-1", title: "T", description: "D", reproduction_steps: "1. open" },
    });
  });

  it("throws the API error instead of returning fake data", async () => {
    vi.spyOn(apiClient, "call").mockRejectedValue(new ApiError(403, "FORBIDDEN", "No access", "req-1"));
    await expect(developerApi.getDashboard()).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  it("converts nested keys both ways and leaves values alone", () => {
    expect(camelizeKeys({ a_b: [{ c_d: "e_f" }] })).toEqual({ aB: [{ cD: "e_f" }] });
    expect(snakeizeKeys({ aB: { cD: "eF" } })).toEqual({ a_b: { c_d: "eF" } });
  });
});

describe("date-only deadlines", () => {
  it("compare calendar days and never flag finished work", () => {
    expect(isOverdue("2000-01-01", "IN_PROGRESS")).toBe(true);
    expect(isOverdue("2000-01-01", "DONE")).toBe(false);
    expect(isOverdue("2999-01-01", "TODO")).toBe(false);
    expect(isOverdue(null, "TODO")).toBe(false);
  });
});

/* ------------------------------------------------------------------ redirects */

describe("folded routes", () => {
  it.each([
    ["my-work", "tasks"],
    ["sprints", "tasks"],
    ["bugs", "blockers?tab=issues"],
    ["files", "reviews?tab=files"],
    ["reports", "progress"],
    ["deadlines", "calendar"],
    ["comments", "discussions"],
    ["check-ins", "progress"],
  ])("/developer/%s redirects to /developer/%s", async (from, to) => {
    const Page = (await import(`../src/app/(workspace)/org/[orgId]/developer/${from}/page.tsx`)).default;
    expect(() => Page({ params: { orgId: "org-acme" } })).toThrow(`REDIRECT:/org/org-acme/developer/${to}`);
  });
});

/* ------------------------------------------------------------------ sidebar */

describe("developer sidebar", () => {
  beforeEach(() => {
    const acme = SEEDED_ORGS[0];
    Object.assign(useAuthStore.getInitialState(), { currentRole: "DEVELOPER", currentOrg: acme });
    useAuthStore.setState({ currentRole: "DEVELOPER", currentOrg: acme });
    vi.spyOn(permissionStore, "getInitialState").mockImplementation(() => permissionStore.getState());
    permissionStore.setState({
      orgId: acme.id, role: "DEVELOPER", status: "ready", source: "api", scopeReported: true,
      grants: FIXTURE_GRANTS.DEVELOPER,
    });
  });

  it("shows exactly the 11 Developer destinations", () => {
    const html = renderToStaticMarkup(<Sidebar mobileOpen={false} onMobileClose={() => undefined} mobileTriggerRef={React.createRef()} />);
    const devLinks = Array.from(new Set(html.match(/href="\/org\/[^"/]+\/developer\/[a-z-]+"/g) ?? []));
    expect(devLinks.map((h) => h.replace(/.*\/developer\//, "").replace('"', ""))).toEqual([
      "dashboard", "tasks", "projects", "progress", "github", "reviews", "blockers", "calendar", "discussions", "notifications", "settings",
    ]);
    for (const label of ["Dashboard", "My Tasks", "My Projects", "Progress &amp; Tracker", "GitHub Activity", "Reviews &amp; Evidence",
      "Blockers &amp; Issues", "Calendar &amp; Deadlines", "Team &amp; Comments", "Notifications", "Settings"]) {
      expect(html).toContain(label);
    }
    expect(html).not.toMatch(/developer\/(sprints|reports|bugs|files|my-work)"/);
  });
});

/* ------------------------------------------------------------------ task detail */

function item(extra: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: "t-1", project_id: "p-1", parent_id: null, type: "TASK", key: "CRM-7", title: "Import leads", description: null,
    state: "TODO", plan_status: "ACTIVE", blocked: false, criticality: null, criteria: "Leads import from CSV",
    criteria_version: 1, weight: 5, weight_unit: "POINTS", due_on: "2026-12-01", revision: 1, submitted_revision: null,
    accepted_revision: null, review_required: true, primary_assignee: { user_id: "u-dev", email: "dev@example.test" },
    reviewer: { user_id: "u-qa", email: "qa@example.test" }, collaborators: [], depth: 1, child_count: 0,
    dependency_flag: null, retired_reason: null, version: 3, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z",
    ...extra,
  };
}

const emptyHistory: ReviewHistoryDto = { submissions: [], reviews: [], checks: [], reopen_events: [] };

function renderTask(w: WorkItemDto, meId: string, history: ReviewHistoryDto = emptyHistory) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(devKeys.item("t-1"), w);
  client.setQueryData(["developer", "me"], { id: meId, email: "x@example.test", memberships: [] });
  client.setQueryData(devKeys.itemHistory("t-1"), history);
  client.setQueryData(devKeys.itemDeps("t-1"), { blocked_by: [], blocks: [], affected: [] });
  client.setQueryData(devKeys.itemBlockers("t-1"), []);
  return renderToStaticMarkup(<QueryClientProvider client={client}><TaskPage /></QueryClientProvider>);
}

describe("developer task detail", () => {
  it("offers Start only to the primary assignee of a To do task", () => {
    expect(renderTask(item(), "u-dev")).toContain("Start work");
    expect(renderTask(item(), "u-someone-else")).not.toContain("Start work");
    expect(renderTask(item({ state: "IN_PROGRESS" }), "u-dev")).not.toContain("Start work");
  });

  it("shows the evidence form while in progress and never to another member", () => {
    const mine = renderTask(item({ state: "IN_PROGRESS" }), "u-dev");
    expect(mine).toContain("Submit for review");
    expect(mine).toContain("Raise a blocker");
    const other = renderTask(item({ state: "IN_PROGRESS" }), "u-other");
    expect(other).not.toContain("Submit for review");
    expect(other).not.toContain("Raise a blocker");
  });

  it("blocks submission without acceptance criteria", () => {
    const html = renderTask(item({ state: "IN_PROGRESS", criteria: null }), "u-dev");
    expect(html).toContain("No acceptance criteria yet");
    expect(html).toContain("Waiting for acceptance criteria.");
  });

  it("shows blocked as a flag beside the state, and suspended credit when a prerequisite reopened", () => {
    const html = renderTask(item({ state: "IN_PROGRESS", blocked: true, dependency_flag: "PREREQUISITE_REOPENED" }), "u-dev");
    expect(html).toContain("In progress");
    expect(html).toContain("Blocked");
    expect(html).toContain("credit suspended");
  });

  it("lists review decisions, submissions with evidence, and read-only checks", () => {
    const html = renderTask(item({ state: "IN_PROGRESS", revision: 2 }), "u-dev", {
      submissions: [{
        id: "s-1", revision: 1, criteria_version: 1, note: "First pass", status: "REVIEWED", submitted_at: "2026-11-02T09:00:00Z",
        submitted_by: "u-dev", submitted_by_email: "dev@example.test",
        evidence: [{ type: "PULL_REQUEST", ref: "https://github.com/acme/crm/pull/9", label: "PR 9" }],
      }],
      reviews: [{
        id: "r-1", decision: "CHANGES_REQUESTED", reason: "Validate empty rows", evidence_ref: null, revision: 1,
        decided_at: "2026-11-03T09:00:00Z", reviewer_id: "u-qa", reviewer_email: "qa@example.test",
      }],
      checks: [{ key: "tests", label: "Unit tests pass", satisfied: false, satisfied_at: null }],
      reopen_events: [],
    });
    expect(html).toContain("Changes requested");
    expect(html).toContain("Validate empty rows");
    expect(html).toContain("PR 9");
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain("Unit tests pass");
    expect(html).toContain("you cannot mark your own");
    // Changes requested puts the work back in progress: the developer submits the next revision for review.
    expect(html).toContain("Submit for review");
  });

  it("replaces the revision waiting for review when the developer resubmits", () => {
    expect(renderTask(item({ state: "IN_REVIEW", submitted_revision: 1 }), "u-dev")).toContain("Submit a new revision");
  });
});

/* ------------------------------------------------------------------ unreachable API */

const { toState } = await import("../src/components/org-console/useRoleApi");
const { classifyFailure } = await import("../src/lib/permissions");

describe("unreachable API", () => {
  it("shows an error state with retry, never sample data", () => {
    const refetch = vi.fn();
    const state = toState({ isPending: false, error: new ApiError(0, "NETWORK_ERROR", "down", ""), data: undefined, refetch });
    expect(state.kind).toBe("error");
    if (state.kind === "error") state.retry();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("maps real 401/403/404/500 answers to their own states", () => {
    for (const [status, kind] of [[401, "unauthenticated"], [403, "forbidden"], [404, "not-found"], [500, "error"]] as const) {
      expect(classifyFailure(new ApiError(status, "X", "x", ""))).toBe(kind);
    }
  });
});
