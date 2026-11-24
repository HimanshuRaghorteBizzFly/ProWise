import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { AssignableItemDto, TeamWorkDto, WorkItemDto } from "../src/types/api";
import { isLiveRoute } from "../src/lib/live-routes";

// Task 3.1 (T20): work items across projects, one work item, team work.

vi.mock("next/navigation", () => ({ useParams: () => ({ orgId: "org-1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ status: "ready", can: () => true, canAny: () => true }) }));

const { filterWork, WorkItemTable, WorkItemDetail, TeamWorkPanels } = await import("../src/components/work/WorkListViews");

function item(extra: Partial<WorkItemDto>): WorkItemDto {
  return { id: "t1", key: "CRM-2", type: "TASK", parent_id: "p", title: "Login form", description: null, points: 5, unit: "pts",
    work_type_id: null, work_type_name: null, assignee: { membership_id: "m-dev", email: "dev@x.test" }, reviewer: { membership_id: "m-qa", email: "qa@x.test" },
    collaborators: [], state: "IN_PROGRESS", position: 0, leaf: true, version: 1, created_at: null, ...extra };
}

function entry(extra: Partial<WorkItemDto>, project = "p1"): AssignableItemDto {
  return { project_id: project, project_key: project === "p1" ? "CRM" : "OPS", project_name: project === "p1" ? "CRM rebuild" : "Ops", item: item(extra) };
}

const ROWS = [entry({}), entry({ id: "t2", key: "CRM-3", assignee: null, state: "TODO" }), entry({ id: "t3", key: "OPS-1", state: "DONE" }, "p2")];

describe("work list views", () => {
  it("filters by project, state and assignee", () => {
    expect(filterWork(ROWS, { project: "p2", state: "", assignee: "" }).map((r) => r.item.key)).toEqual(["OPS-1"]);
    expect(filterWork(ROWS, { project: "", state: "TODO", assignee: "" }).map((r) => r.item.key)).toEqual(["CRM-3"]);
    expect(filterWork(ROWS, { project: "", state: "", assignee: "none" }).map((r) => r.item.key)).toEqual(["CRM-3"]);
    expect(filterWork(ROWS, { project: "", state: "", assignee: "me" }, ["m-dev"]).map((r) => r.item.key)).toEqual(["CRM-2", "OPS-1"]);
  });

  it("lists tasks with project, points, assignee and plain state, linking to the detail page", () => {
    const html = renderToStaticMarkup(<WorkItemTable items={ROWS} itemHref={(e) => `/org/org-1/manager/work-items/${e.item.id}`} />);
    expect(html).toContain("CRM · CRM rebuild · 5 pts");
    expect(html).toContain("Unassigned");
    expect(html).toContain("In progress");
    expect(html).toContain("/org/org-1/manager/work-items/t1");
    expect(renderToStaticMarkup(<WorkItemTable items={[]} />)).toContain("No tasks match");
  });

  it("shows a task's people and points", () => {
    const html = renderToStaticMarkup(<WorkItemDetail entry={entry({ work_type_name: "Feature" })} />);
    expect(html).toContain("dev@x.test");
    expect(html).toContain("qa@x.test");
    expect(html).toContain("Feature");
    expect(html).toContain("5 pts");
  });

  it("shows team members with their open work, and an honest empty state", () => {
    const teams: TeamWorkDto[] = [{ id: "team-1", name: "Payments", lead_email: "lead@x.test", you_lead: true, members: [
      { membership_id: "m-lead", email: "lead@x.test", lead: true, open_tasks: 0, open_points: 0, tasks: [] },
      { membership_id: "m-dev", email: "dev@x.test", lead: false, open_tasks: 2, open_points: 8, tasks: [] },
    ] }];
    const html = renderToStaticMarkup(<TeamWorkPanels teams={teams} memberHref={(m) => `/org/org-1/lead/team/${m.membership_id}`} />);
    expect(html).toContain("You lead this team");
    expect(html).toContain("2 open tasks · 8 pts");
    expect(html).toContain("No open tasks");
    expect(html).toContain("/org/org-1/lead/team/m-dev");
    expect(renderToStaticMarkup(<TeamWorkPanels teams={[]} />)).toContain("lead or belong to an active team.");
  });

  it("replaces the Later pages of task 3.1", () => {
    for (const path of ["/org/o/manager/work-items", "/org/o/manager/work-items/t1", "/org/o/manager/project-planning", "/org/o/lead/team",
      "/org/o/lead/team/m1", "/org/o/lead/work-items/t1", "/org/o/reviewer/work-items", "/org/o/viewer/tasks", "/org/o/viewer/team",
      "/org/o/developer/projects/p1/structured/my-tasks", "/org/o/developer/projects/p1/structured/tasks/t1"]) {
      expect(isLiveRoute(path)).toBe(true);
    }
  });
});
