import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ProgressSnapshotDto, ReviewTaskDto, WorkItemDto } from "../src/types/api";
import { isLiveRoute } from "../src/lib/live-routes";

// Tasks 3.3 (T22) and 3.5 (T27, AS-03): review screens and accepted-work progress.

vi.mock("next/navigation", () => ({ useParams: () => ({ orgId: "org-1" }), useRouter: () => ({ push: vi.fn() }) }));

const { MyTasksList, ReviewDecisionCard, ProgressSummary, SnapshotHistory } = await import("../src/components/work/ReviewViews");

function item(extra: Partial<WorkItemDto>): WorkItemDto {
  return { id: "t1", key: "CRM-2", type: "TASK", parent_id: "p", title: "Login form", description: null, points: 20, unit: "pts",
    work_type_id: null, work_type_name: null, assignee: { membership_id: "m-dev", email: "dev@x.test" },
    reviewer: { membership_id: "m-qa", email: "qa@x.test" }, collaborators: [], state: "IN_PROGRESS", position: 0, leaf: true, version: 3,
    created_at: null, ...extra };
}

function task(extra: Partial<ReviewTaskDto>, itemExtra: Partial<WorkItemDto> = {}): ReviewTaskDto {
  return { project_id: "p1", project_key: "CRM", project_name: "CRM rebuild", item: item(itemExtra), current_revision: 1,
    submitted_revision: null, accepted_revision: null, cancelled: false, checks: [], waiting_on: [], blocked: false, dependency_flag: null, ...extra };
}

function snapshot(extra: Partial<ProgressSnapshotDto>): ProgressSnapshotDto {
  return { id: Math.random().toString(), scope_version_no: 1, numerator: 0, denominator: 100, percent: 0, display_percent: 0,
    method: "calculated", cause: "SCOPE_APPROVED", captured_at: "2026-11-24T10:00:00Z", ...extra };
}

describe("review views", () => {
  it("offers Submit only for open work of the assignee", () => {
    const html = renderToStaticMarkup(<MyTasksList tasks={[task({}), task({}, { id: "t2", key: "CRM-3", state: "IN_REVIEW" })]}
      onSubmit={() => undefined} pending={null} />);
    expect(html).toContain("CRM-2");
    expect(html).toContain("In review");
    expect(html.match(/Submit for review/g)).toHaveLength(1);
    expect(html).toContain("Reviewer: qa@x.test");
  });

  it("shows the empty state without sample data", () => {
    const html = renderToStaticMarkup(<MyTasksList tasks={[]} onSubmit={() => undefined} pending={null} />);
    expect(html).toContain("No tasks assigned");
  });

  it("lists the required checks and blocks approval until every one is ticked", () => {
    const html = renderToStaticMarkup(<ReviewDecisionCard task={task({ submitted_revision: 1, checks: [{ id: "c1", label: "Tests pass" }] }, { state: "IN_REVIEW" })}
      onApprove={() => undefined} onRequestChanges={() => undefined} pending={false} />);
    expect(html).toContain("Required checks");
    expect(html).toContain("Tests pass");
    expect(html).toContain("Tick every check to approve.");
    expect(html).toMatch(/<button[^>]*disabled[^>]*>.*Approve/);
    expect(html).not.toContain('role="dialog"');
  });

  it("shows progress as approved points of the active scope, and Not measurable for an empty scope", () => {
    const html = renderToStaticMarkup(<ProgressSummary progress={{ numerator: 50, denominator: 125, percent: 40, display_percent: 40,
      label: "Calculated", method: "calculated", scope_version_no: 2, snapshots: [] }} />);
    expect(html).toContain("40%");
    expect(html).toContain("50 of 125 pts approved");
    expect(html).toContain("scope version 2");
    const empty = renderToStaticMarkup(<ProgressSummary progress={{ numerator: 0, denominator: 0, percent: null, display_percent: null,
      label: "Not measurable", method: "calculated", scope_version_no: null, snapshots: [] }} />);
    expect(empty).toContain("Not measurable");
  });

  it("keeps every snapshot, newest first, and marks the scope-version break", () => {
    const html = renderToStaticMarkup(<SnapshotHistory snapshots={[
      snapshot({}),
      snapshot({ cause: "TASK_APPROVED", numerator: 50, display_percent: 50, percent: 50 }),
      snapshot({ scope_version_no: 2, denominator: 125, numerator: 50, display_percent: 40, percent: 40 }),
      snapshot({ scope_version_no: 2, denominator: 125, numerator: 20, display_percent: 16, percent: 16, cause: "TASK_REOPENED" }),
    ]} />);
    expect(html.indexOf("16%")).toBeLessThan(html.indexOf("40%"));
    expect(html.indexOf("40%")).toBeLessThan(html.indexOf("50%"));
    expect(html).toContain("Task reopened");
    expect(html.match(/New scope: the total changed from here/g)).toHaveLength(1);
  });

  it("makes the developer tasks and reviewer queue pages live", () => {
    expect(isLiveRoute("/org/org-1/developer/tasks")).toBe(true);
    expect(isLiveRoute("/org/org-1/reviewer/queue")).toBe(true);
  });
});
