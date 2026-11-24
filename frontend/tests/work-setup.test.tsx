import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { IDEMPOTENCY_KEY_HEADER, createApiClient } from "../src/lib/api";
import type { AssignableItemDto, ProjectDocumentDto, WorkItemDto } from "../src/types/api";

// Task 3.1 (T12, T20): Create Project setup steps, breakdown and assignment screens.

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/org/org-1/manager/create-project",
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ status: "ready", can: () => true, canAny: () => true, retry: () => undefined }),
}));

const { setupProblems, StructuredSetupSteps, BreakdownTree, AssignWorkList, DocumentList, MAX_DOCUMENT_BYTES } =
  await import("../src/components/work/WorkViews");
const { isLiveRoute } = await import("../src/lib/live-routes");

const doc: ProjectDocumentDto = { id: "d-1", project_id: null, file_name: "brief.pdf", file_size: 2048, file_type: "application/pdf", uploaded_by_email: "pm@x.test", uploaded_at: "2026-11-24T10:00:00Z" };

function item(extra: Partial<WorkItemDto>): WorkItemDto {
  return { id: "i", key: "CRM-1", type: "TASK", parent_id: null, title: "Task", description: null, points: 5, unit: "pts",
    work_type_id: null, work_type_name: null, assignee: null, reviewer: null, collaborators: [], state: "TODO", position: 0,
    leaf: true, version: 0, created_at: null, ...extra };
}

function render(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe("setup rules", () => {
  it("requires at least one document, one phase and one task with points and a reviewer", () => {
    expect(setupProblems([], [])).toEqual(["Upload at least one document.", "Add at least one phase.", "Add at least one task with points."]);
    expect(setupProblems([doc], [{ title: "P", tasks: [] }])).toEqual(["Add at least one task with points."]);
    expect(setupProblems([doc], [{ title: "P", tasks: [{ title: "T", points: "0", reviewer: "m" }] }]))
      .toContain("Every task needs points greater than 0 and a reviewer.");
    expect(setupProblems([doc], [{ title: "P", tasks: [{ title: "T", points: "5", reviewer: "" }] }]))
      .toContain("Every task needs points greater than 0 and a reviewer.");
    expect(setupProblems([doc], [{ title: "P", tasks: [{ title: "T", points: "5", reviewer: "m" }] }])).toEqual([]);
    expect(MAX_DOCUMENT_BYTES).toBe(10 * 1024 * 1024);
  });

  it("shows the four steps on a page (no dialog) before the project exists", () => {
    const html = render(<StructuredSetupSteps orgId="org-1" options={{ members: [], teams: [], default_timezone: "UTC" }}
      details={{ name: "CRM", key: "CRM", mode: "STRUCTURED" }} onBack={() => undefined} onCreated={() => undefined} />);
    expect(html).toContain("1. Documents (0)");
    expect(html).toContain("2. Phases (0)");
    expect(html).toContain("3. Tasks (0)");
    expect(html).toContain("4. Create");
    expect(html).toContain("Up to 10 MB each");
    expect(html).not.toContain('role="dialog"');
  });
});

describe("API client", () => {
  it("uploads raw bytes without an Idempotency-Key and creates the configured project with one", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({}), { status: 201 }));
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock, isRolePreview: () => false });
    const file = new File(["hello"], "brief.txt", { type: "text/plain" });
    await client.uploadProjectDocument("org-1", file);
    await client.createConfiguredProject("org-1", { project: { name: "CRM", key: "CRM", mode: "STRUCTURED" }, document_ids: ["d-1"],
      phases: [{ title: "P", tasks: [{ title: "T", points: 5, reviewer_membership_id: "m" }] }] });
    const [uploadUrl, uploadInit] = fetchMock.mock.calls[0];
    expect(uploadUrl).toBe("/api/v1/organizations/org-1/project-documents?file_name=brief.txt");
    expect(new Headers(uploadInit.headers).get("Content-Type")).toBe("text/plain");
    expect(new Headers(uploadInit.headers).get(IDEMPOTENCY_KEY_HEADER)).toBeNull();
    expect(uploadInit.body).toBe(file);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v1/organizations/org-1/projects/configured");
    expect(new Headers(fetchMock.mock.calls[1][1].headers).get(IDEMPOTENCY_KEY_HEADER)).toBeTruthy();
  });
});

describe("breakdown and assignment", () => {
  it("shows phases with their tasks, points, assignee and reviewer; phases carry no points", () => {
    const html = render(<BreakdownTree items={[
      item({ id: "p", key: "CRM-1", type: "MILESTONE", title: "Discovery", points: 0, leaf: false }),
      item({ id: "t", key: "CRM-2", parent_id: "p", title: "Interviews", points: 5, reviewer: { membership_id: "r", email: "qa@x.test" } }),
    ]} />);
    expect(html).toContain("Discovery");
    expect(html).toContain("Phase");
    expect(html).toContain("Interviews");
    expect(html).toContain("5 pts");
    expect(html).toContain("Unassigned");
    expect(html).toContain("qa@x.test");
    expect(html).toContain("Total points: <b>5</b>");
  });

  it("lists tasks to assign with the project's team members", () => {
    const entry: AssignableItemDto = { project_id: "pr", project_key: "CRM", project_name: "Customer portal", item: item({ id: "t", key: "CRM-2", title: "Interviews" }) };
    const html = render(<AssignWorkList items={[entry]} pending={null} onAssign={() => undefined}
      people={{ pr: [{ membership_id: "m-dev", email: "dev@x.test" }] }} />);
    expect(html).toContain("CRM-2");
    expect(html).toContain("Unassigned");
    expect(html).toContain("dev@x.test");
    expect(render(<AssignWorkList items={[]} pending={null} onAssign={() => undefined} people={{}} />)).toContain("Nothing to assign");
  });

  it("lists documents with their size", () => {
    expect(render(<DocumentList documents={[doc]} />)).toContain("2.0 KB");
  });

  it("makes the assignment and work-type pages live", () => {
    expect(isLiveRoute("/org/x/lead/assignments")).toBe(true);
    expect(isLiveRoute("/org/x/manager/team-assignments")).toBe(true);
    expect(isLiveRoute("/org/x/owner/work-types")).toBe(true);
  });
});
