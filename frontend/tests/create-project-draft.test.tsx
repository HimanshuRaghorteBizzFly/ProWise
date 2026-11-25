import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { DraftViewDto } from "../src/types/flow";

// Multi-step Create Project: steps per mode, page paths, step pages from a saved draft.

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/org/org-1/manager/create-project",
}));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ status: "ready", can: () => true, retry: () => undefined }),
}));

const { DraftStepView, createPaths, stepsFor } = await import("../src/components/flow/DraftWizard");

const DRAFT: DraftViewDto = {
  id: "d-1", status: "DRAFT", version: 3, name: "Orbit web", key: "ORB", description: null, mode: "TEAM",
  start_on: "2026-11-25", target_on: "2026-12-31", documents: [],
  phases: [{ ref: "p1", name: "Build" }], tasks: [{ ref: "t1", title: "Login", phase_ref: "p1", points: 30 }],
  team_lead_membership_id: null, developer_membership_ids: [], qa_membership_ids: [], approver_membership_ids: [],
  repository: { connected: false, repository: null, token_last4: null, url: null }, can_connect_repository: false, project_id: null,
};

const OPTIONS = {
  default_timezone: "UTC", today: "2026-11-25", people: [],
  limits: { max_total_points: 100, document_max_bytes: 1, screenshot_max_bytes: 1, max_phases: 30, max_tasks: 200 },
};

function render(step: Parameters<typeof DraftStepView>[0]["step"], draft: DraftViewDto = DRAFT) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["flow", "draft", draft.id], draft);
  client.setQueryData(["flow", "setup-options", "org-1"], OPTIONS);
  return renderToStaticMarkup(
    <QueryClientProvider client={client}><DraftStepView orgId="org-1" base="manager" draftId={draft.id} step={step} /></QueryClientProvider>);
}

describe("Create project steps", () => {
  it("skips phases and tasks for Solo projects", () => {
    expect(stepsFor("TEAM")).toEqual(["basics", "documents", "plan", "repository", "people", "approvers", "review"]);
    expect(stepsFor("SOLO")).toEqual(["basics", "documents", "repository", "people", "approvers", "review"]);
  });

  it("puts every step on its own page under the role's create path", () => {
    expect(createPaths("org-1", "manager").step("d-1", "plan")).toBe("/org/org-1/manager/create-project/d-1/plan");
    expect(createPaths("org-1", "owner").step("d-1", "review")).toBe("/org/org-1/owner/projects/new/d-1/review");
  });

  it("shows the step indicator, a back link and the live points total", () => {
    const markup = render("plan");
    expect(markup).toContain("Phases &amp; tasks");
    expect(markup).toContain("Back to Documents");
    expect(markup).toContain("30 / 100 points");
    expect(markup).toContain("below 100");
  });

  it("tells a role without repo.connect that an admin can connect later", () => {
    expect(render("repository")).toContain("An admin can connect this later");
  });

  it("summarises every step with an Edit link before creating", () => {
    const markup = render("review");
    expect(markup).toContain("ORB · Orbit web");
    expect(markup).toContain("1 phases · 1 tasks · 30 of at most 100 points");
    expect(markup).toContain("/org/org-1/manager/create-project/d-1/people");
    expect(markup).toContain("Create project");
    expect(markup).toContain("Discard draft");
  });

  it("does not offer steps of a draft that was already created", () => {
    const markup = render("review", { ...DRAFT, status: "ACTIVATED", project_id: "p-9" });
    expect(markup).toContain("This project was created");
    expect(markup).toContain("/org/org-1/manager/projects/p-9");
  });
});

describe("Connected repository", () => {
  it("shows the repository link and only the last 4 characters of the token, with replace and disconnect", () => {
    const connected = { ...DRAFT, can_connect_repository: true,
      repository: { connected: true, repository: "acme/web", token_last4: "1234", url: "https://github.com/acme/web" } };
    const step = render("repository", connected);
    expect(step).toContain("https://github.com/acme/web");
    expect(step).toContain("…1234");
    expect(step).toContain("Replace token");
    expect(step).toContain("Disconnect");
    expect(step).not.toContain("An admin can connect this later");
    const review = render("review", connected);
    expect(review).toContain("acme/web");
    expect(review).toContain("token …1234");
  });
});
