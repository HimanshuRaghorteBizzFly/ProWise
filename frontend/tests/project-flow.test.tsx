import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { QueueItemDto, SetupOptionsDto } from "../src/types/flow";
import type { WorkItemDto } from "../src/types/work";

// Project delivery flow (owner decisions 2026-11-25): create wizard, My Work board, review page, progress labels.

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-1" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/org/org-1/developer/tasks",
}));

const { ProjectSetupWizard, stepProblem, totalPoints } = await import("../src/components/flow/ProjectSetupWizard");
const { WorkBoard, filterItems, moveAction } = await import("../src/components/flow/WorkBoard");
const { DecisionPanel, ReviewQueueList, reviewPaths } = await import("../src/components/flow/ReviewViews");
const { ProgressFigure } = await import("../src/components/flow/FlowUI");
const { ProgressOverview } = await import("../src/components/flow/ProgressOverviewView");

function render(node: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const OPTIONS: SetupOptionsDto = {
  default_timezone: "Europe/London",
  today: "2026-11-25",
  people: [
    { membership_id: "m-dev", user_id: "u-dev", name: "Dana Dev", email: "dana@example.test", role: "DEVELOPER", open_tasks: 2, active_projects: 1 },
    { membership_id: "m-qa", user_id: "u-qa", name: "Quinn QA", email: "quinn@example.test", role: "QA_REVIEWER", open_tasks: 0, active_projects: 3 },
  ],
  limits: { max_total_points: 100, document_max_bytes: 20971520, screenshot_max_bytes: 5242880, max_phases: 30, max_tasks: 200 },
};

function task(extra: Partial<WorkItemDto> = {}): WorkItemDto {
  return {
    id: "w-1", project_id: "p-1", parent_id: "ph-1", type: "TASK", key: "PRW-1", title: "Login", description: null,
    state: "TODO", plan_status: "ACTIVE", blocked: false, criticality: "NORMAL", criteria: "Deliver: Login", criteria_version: 1,
    weight: 30, weight_unit: "POINTS", due_on: null, revision: 1, submitted_revision: null, accepted_revision: null,
    review_required: true, primary_assignee: { user_id: "u-dev", email: "dana@example.test" }, reviewer: null, collaborators: [],
    depth: 3, child_count: 0, dependency_flag: null, retired_reason: null, version: 1, created_at: "2026-11-25T09:00:00Z",
    updated_at: "2026-11-25T09:00:00Z", phase: { id: "ph-1", key: "PRW-4", title: "Build" }, blocked_by: [], open_blockers: 0,
    changes_requested_reason: null, ...extra,
  };
}

describe("Create project wizard", () => {
  it("starts with the basics and offers both delivery modes as a page", () => {
    const markup = render(<ProjectSetupWizard orgId="org-1" options={OPTIONS} onCreated={() => undefined} cancel={<span>Cancel</span>} />);
    for (const label of ["Basics", "Documents", "Phases &amp; tasks", "People", "Approvers", "Review &amp; create",
      "Project name", "Team · Structured Delivery", "Solo · Individual Ownership", "Start date", "End date"]) {
      expect(markup).toContain(label);
    }
    expect(markup).not.toContain('role="dialog"');
    expect(markup).toContain('min="2026-11-25"');
  });

  it("checks the dates and keeps task points at 100 or less", () => {
    const base = { mode: "TEAM" as const, name: "Web", key: "PRW", startOn: "2026-11-25", targetOn: "2026-12-31", today: "2026-11-25",
      phases: [{ ref: "p1", name: "Build" }], developers: [] };
    expect(stepProblem("basics", { ...base, tasks: [] })).toBeNull();
    expect(stepProblem("basics", { ...base, startOn: "2026-11-24", tasks: [] })).toContain("today or later");
    expect(stepProblem("basics", { ...base, targetOn: "2026-11-01", tasks: [] })).toContain("on or after the start date");
    const tasks = [
      { ref: "t1", title: "A", description: "", phaseRef: "p1", points: "60", dependsOnRef: "", assignee: "" },
      { ref: "t2", title: "B", description: "", phaseRef: "p1", points: "41", dependsOnRef: "", assignee: "" },
    ];
    expect(totalPoints(tasks)).toBe(101);
    expect(stepProblem("plan", { ...base, tasks })).toContain("may not be above 100");
    expect(stepProblem("plan", { ...base, tasks: [{ ...tasks[0], points: "40" }, tasks[1]] })).toBeNull(); // 81: less is allowed
    expect(stepProblem("plan", { ...base, tasks: [{ ...tasks[0], phaseRef: "" }] })).toContain("Choose a phase");
    expect(stepProblem("plan", { ...base, tasks: [{ ...tasks[0], points: "2.5" }] })).toContain("whole points");
  });
});

describe("My Work board", () => {
  it("shows the four columns, what blocks a task and the reviewer's reason", () => {
    const items = [
      task({ id: "w-2", key: "PRW-2", title: "Dashboard", blocked_by: [{ id: "w-1", key: "PRW-1", title: "Login", state: "IN_PROGRESS" }] }),
      task({ id: "w-1", state: "IN_PROGRESS", changes_requested_reason: "Show an error for a wrong password" }),
      task({ id: "w-3", key: "PRW-3", title: "Release", state: "DONE" }),
    ];
    const markup = render(<WorkBoard items={items} base="/org/org-1/developer" orgId="org-1" myEmail={null} />);
    for (const column of ["Created", "In progress", "In review", "Completed"]) expect(markup).toContain(column);
    expect(markup).toContain("Blocked by PRW-1");
    expect(markup).toContain("Show an error for a wrong password");
    expect(markup).toContain("Submit for review");
    expect(markup).toContain('aria-label="Start PRW-2"');
    expect(markup).toMatch(/aria-label="Start PRW-2"[^>]*disabled|disabled[^>]*aria-label="Start PRW-2"/);
  });

  it("only allows the developer's own steps: start, then submit; never complete", () => {
    expect(moveAction("TODO", "IN_PROGRESS")).toBe("start");
    expect(moveAction("IN_PROGRESS", "IN_REVIEW")).toBe("submit");
    expect(moveAction("IN_REVIEW", "DONE")).toBeNull();
    expect(moveAction("TODO", "DONE")).toBeNull();
    expect(moveAction("DONE", "IN_PROGRESS")).toBeNull();
  });

  it("filters by search, phase and blocked", () => {
    const items = [task(), task({ id: "w-2", key: "PRW-2", title: "Dashboard", phase: null, open_blockers: 1 })];
    const none = { q: "", project: "", phase: "", state: "", blockedOnly: false };
    expect(filterItems(items, { ...none, q: "dash" }).map((i) => i.key)).toEqual(["PRW-2"]);
    expect(filterItems(items, { ...none, phase: "Build" }).map((i) => i.key)).toEqual(["PRW-1"]);
    expect(filterItems(items, { ...none, blockedOnly: true }).map((i) => i.key)).toEqual(["PRW-2"]);
    expect(filterItems([task({ type: "MILESTONE" })], none)).toHaveLength(0);
  });

  it("shows a real empty state", () => {
    expect(render(<WorkBoard items={[]} base="/b" orgId="org-1" myEmail={null} />)).toContain("No tasks assigned to you");
  });
});

describe("Review", () => {
  it("lists only what the server returns, linking into the approver's own panel", () => {
    const items: QueueItemDto[] = [
      { kind: "TASK", id: "w-1", review_ref: "w-1", project: { id: "p-1", key: "PRW", name: "Web", mode: "STRUCTURED" }, key: "PRW-1",
        title: "Login", points: 30, reported_percent: null, note: "Ready", submitted_by: "dana@example.test",
        submitted_at: "2026-11-25T10:00:00Z", revision: 2 },
      { kind: "SOLO", id: "c-1", review_ref: "checkin-c-1", project: { id: "p-2", key: "LND", name: "Landing", mode: "INDIVIDUAL" },
        key: "LND", title: "Landing", points: null, reported_percent: 40, note: null, submitted_by: "dana@example.test",
        submitted_at: "2026-11-25T11:00:00Z", revision: 1 },
    ];
    const paths = reviewPaths("org-1", "lead");
    const markup = render(<ReviewQueueList items={items} detail={paths.detail} />);
    expect(markup).toContain("/org/org-1/lead/reviews/w-1");
    expect(markup).toContain("/org/org-1/lead/reviews/checkin-c-1");
    expect(markup).toContain("30 pts · round 2");
    expect(markup).toContain("40% reported");
    expect(reviewPaths("org-1", "reviewer").detail("x")).toBe("/org/org-1/reviewer/reviews/x");
    expect(reviewPaths("org-1", "developer").list).toBe("/org/org-1/developer/approvals");
    expect(render(<ReviewQueueList items={[]} detail={paths.detail} />)).toContain("Nothing to review");
  });

  it("hides the decision for the developer's own task and requires a reason for changes", () => {
    const own = render(<DecisionPanel canDecide={false} blockedReason="You cannot approve your own task." pending={false} onDecide={() => undefined} />);
    expect(own).toContain("You cannot approve your own task.");
    expect(own).not.toContain(">Accept<");
    const approver = render(<DecisionPanel canDecide blockedReason={null} pending={false} onDecide={() => undefined} />);
    expect(approver).toContain("Accept");
    expect(approver).toContain("Reject");
    expect(approver).toContain("Reason (required to reject)");
  });
});

describe("Progress labels", () => {
  it("never blends reported and approved figures", () => {
    expect(render(<ProgressFigure percent={null} label="Not reported" method="approved points, 0 of 100" />)).toContain("Not reported");
    const solo = render(<ProgressFigure percent={null} label="Not reported" pending={40} />);
    expect(solo).toContain("40% reported, not yet approved");
    expect(render(<ProgressFigure percent={30} label="30%" method="approved points, 30 of 100" />)).toContain("approved points, 30 of 100");
  });

  it("shows each project's method and counts on the progress page", () => {
    const markup = render(<ProgressOverview projectHref={(id) => `/org/org-1/owner/projects/${id}`} rows={[
      { project_id: "p-1", key: "PRW", name: "Web", mode: "STRUCTURED", lifecycle: "ACTIVE", percent: 30, label: "30%",
        method_label: "approved points, 30 of 100", approved_points: 30, total_points: 100, pending_percent: null,
        todo: 1, in_progress: 1, in_review: 0, done: 1, open_blockers: 0, target_on: "2027-01-31", updated_at: "2026-11-25T10:00:00Z" },
      { project_id: "p-2", key: "LND", name: "Landing", mode: "INDIVIDUAL", lifecycle: "ACTIVE", percent: null, label: "Not reported",
        method_label: null, approved_points: null, total_points: null, pending_percent: 40,
        todo: 0, in_progress: 0, in_review: 0, done: 0, open_blockers: 0, target_on: null, updated_at: "2026-11-25T10:00:00Z" },
    ]} />);
    expect(markup).toContain("approved points, 30 of 100");
    expect(markup).toContain("1 created · 1 in progress · 0 in review · 1 completed");
    expect(markup).toContain("40% reported, not yet approved");
    expect(markup).toContain("/org/org-1/owner/projects/p-1");
  });
});
