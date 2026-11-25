import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ProgressRowDto } from "../src/types/flow";
import type { WorkItemDto } from "../src/types/work";

// PM progress pages: project cards, one progress ring, task tiles and tasks grouped by phase.

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/org/org-1/manager/progress",
}));

const { ProgressCards, TasksByPhase, taskTiles } = await import("../src/components/flow/PmProgressViews");
const { ProgressRing } = await import("../src/components/flow/FlowUI");

function row(extra: Partial<ProgressRowDto>): ProgressRowDto {
  return {
    project_id: "p-1", key: "ALPHA", name: "Alpha web", mode: "STRUCTURED", lifecycle: "ACTIVE", percent: 50, label: "50%",
    method_label: "approved points, 40 of 80", approved_points: 40, total_points: 80, pending_percent: null,
    todo: 1, in_progress: 1, in_review: 1, done: 2, open_blockers: 1, target_on: null, updated_at: "2026-11-25T10:00:00Z", ...extra,
  };
}

function task(extra: Partial<WorkItemDto>): WorkItemDto {
  return {
    id: "w-1", project_id: "p-1", parent_id: "ph", type: "TASK", key: "ALPHA-1", title: "Login", description: null, state: "DONE",
    plan_status: "ACTIVE", blocked: false, criticality: "NORMAL", criteria: null, criteria_version: 1, weight: 30, weight_unit: "POINTS",
    due_on: null, revision: 1, submitted_revision: null, accepted_revision: 1, review_required: true,
    primary_assignee: { user_id: "u", email: "dana@example.test" }, reviewer: null, collaborators: [], depth: 3, child_count: 0,
    dependency_flag: null, retired_reason: null, version: 1, created_at: "", updated_at: "", phase: { id: "ph", key: "ALPHA-9", title: "Build" },
    blocked_by: [], open_blockers: 0, changes_requested_reason: null, ...extra,
  };
}

describe("Progress cards", () => {
  it("shows every project with its badge, % as text, method and backend status", () => {
    const markup = renderToStaticMarkup(<ProgressCards href={(id) => `/org/org-1/manager/progress/${id}`} rows={[
      row({}),
      row({ project_id: "p-2", key: "DELTA", name: "Delta", mode: "INDIVIDUAL", lifecycle: "PLANNED", percent: null, label: "Not reported",
        method_label: null, pending_percent: 40 }),
    ]} />);
    expect(markup).toContain("Alpha web");
    expect(markup).toContain("Team");
    expect(markup).toContain("50%");
    expect(markup).toContain("approved points, 40 of 80");
    expect(markup).toContain("Active");
    expect(markup).toContain("Delta");
    expect(markup).toContain("Solo");
    expect(markup).toContain("Not reported");
    expect(markup).toContain("40% reported, not yet approved");
    expect(markup).toContain("/org/org-1/manager/progress/p-2");
  });
});

describe("Project progress", () => {
  it("draws one ring with the % and method, or Not reported", () => {
    expect(renderToStaticMarkup(<ProgressRing percent={38} label="38%" method="approved points, 30 of 80" />))
      .toContain("38%");
    expect(renderToStaticMarkup(<ProgressRing percent={null} label="Not reported" />)).toContain("Not reported");
  });

  it("counts tiles and groups tasks under phases with tabs", () => {
    const rows = [
      task({}),
      task({ id: "w-2", key: "ALPHA-2", title: "Dashboard", state: "TODO", blocked_by: [{ id: "w-1", key: "ALPHA-1", title: "Login", state: "IN_PROGRESS" }] }),
      task({ id: "w-3", key: "ALPHA-3", title: "Release", state: "IN_REVIEW", phase: { id: "p2", key: "ALPHA-10", title: "Ship" } }),
      task({ id: "m", type: "MILESTONE", title: "Build" }),
    ];
    expect(taskTiles(rows.filter((r) => r.type !== "MILESTONE"))).toEqual({ completed: 1, inReview: 1, inProgress: 0, notStarted: 1, blocked: 1 });
    const all = renderToStaticMarkup(<TasksByPhase rows={rows} tab="all" taskHref={(id) => `/t/${id}`} />);
    expect(all).toContain("Build");
    expect(all).toContain("Ship");
    expect(all).toContain("dana@example.test");
    expect(all).toContain("30 pts");
    expect(all).toContain("/t/w-2");
    const blocked = renderToStaticMarkup(<TasksByPhase rows={rows} tab="blocked" taskHref={(id) => `/t/${id}`} />);
    expect(blocked).toContain("Dashboard");
    expect(blocked).not.toContain("Release");
    expect(renderToStaticMarkup(<TasksByPhase rows={rows} tab="completed" taskHref={(id) => `/t/${id}`} />)).not.toContain("Dashboard");
  });
});
