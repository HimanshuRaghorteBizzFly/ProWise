import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { BlockerDto, DependencyBoardDto, ReviewTaskDto } from "../src/types/api";

// Task 3.4 (T21, T24): dependencies and blockers.

vi.mock("next/navigation", () => ({ useParams: () => ({ orgId: "org-1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ status: "ready", can: () => true, canAny: () => true }) }));

const { blockerAge, linksFor, AffectedWarning, BlockerList } = await import("../src/components/work/DependencyViews");
const { MyTasksList } = await import("../src/components/work/ReviewViews");

const NOW = new Date("2026-11-24T12:00:00Z");

function blocker(extra: Partial<BlockerDto>): BlockerDto {
  return { id: "b1", work_item_id: "t1", work_item_key: "CRM-2", reason: "Vendor API down", severity: "NORMAL",
    owner: { membership_id: "m-lead", email: "lead@x.test" }, opened_by_email: "dev@x.test", opened_at: "2026-11-21T12:00:00Z",
    resolved_at: null, resolution: null, resolved_by_email: null, version: 0, ...extra };
}

describe("dependency views", () => {
  it("shows blocker age in minutes, hours or days", () => {
    expect(blockerAge("2026-11-24T11:30:00Z", NOW)).toBe("30m");
    expect(blockerAge("2026-11-24T07:00:00Z", NOW)).toBe("5h");
    expect(blockerAge("2026-11-21T12:00:00Z", NOW)).toBe("3d");
  });

  it("splits a task's links into Blocked by and Blocks", () => {
    const board: DependencyBoardDto = { flags: [], blockers: [], links: [
      { id: "l1", predecessor_id: "a", successor_id: "b", created_at: "" },
      { id: "l2", predecessor_id: "b", successor_id: "c", created_at: "" },
    ] };
    expect(linksFor("b", board).blockedBy.map((l) => l.predecessor_id)).toEqual(["a"]);
    expect(linksFor("b", board).blocks.map((l) => l.successor_id)).toEqual(["c"]);
  });

  it("lists blockers with reason, owner, age and a critical badge", () => {
    const html = renderToStaticMarkup(<BlockerList now={NOW} blockers={[blocker({ severity: "CRITICAL" })]} onResolve={() => undefined} />);
    expect(html).toContain("Critical blocker");
    expect(html).toContain("Vendor API down");
    expect(html).toContain("Owner: lead@x.test");
    expect(html).toContain("Open for 3d");
    expect(html).toContain("Clear blocker");
    expect(html).not.toContain('role="dialog"');
  });

  it("warns which work a change affects", () => {
    const html = renderToStaticMarkup(<AffectedWarning title="Blocker raised." affected={[
      { id: "b", key: "CRM-3", title: "B", state: "TODO" }, { id: "c", key: "CRM-4", title: "C", state: "TODO" }]} />);
    expect(html).toContain("Affected work: CRM-3, CRM-4");
    expect(renderToStaticMarkup(<AffectedWarning title="x" affected={[]} />)).toBe("");
  });

  it("holds back Submit while a predecessor is not approved, and shows blocked and review flags", () => {
    const task: ReviewTaskDto = {
      project_id: "p1", project_key: "CRM", project_name: "CRM", current_revision: 1, submitted_revision: null, accepted_revision: null,
      cancelled: false, checks: [], blocked: true, dependency_flag: "Predecessor CRM-1 was reopened. Check this work still holds.",
      waiting_on: [{ id: "a", key: "CRM-1", title: "A", state: "IN_PROGRESS" }],
      item: { id: "t1", key: "CRM-2", type: "TASK", parent_id: null, title: "Login", description: null, points: 5, unit: "pts",
        work_type_id: null, work_type_name: null, assignee: null, reviewer: null, collaborators: [], state: "IN_PROGRESS", position: 0,
        leaf: true, version: 1, created_at: null },
    };
    const html = renderToStaticMarkup(<MyTasksList tasks={[task]} onSubmit={() => undefined} pending={null} />);
    expect(html).toContain("Waiting on CRM-1");
    expect(html).toContain("Blocked");
    expect(html).toContain("was reopened");
    expect(html).not.toContain("Submit for review");
  });
});
