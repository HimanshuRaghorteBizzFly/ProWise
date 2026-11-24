import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ProjectDto } from "../src/types/api";
import { isLiveRoute } from "../src/lib/live-routes";

// Task 3.5 (T27, AS-03): progress across projects; never an invented figure.

vi.mock("next/navigation", () => ({ useParams: () => ({ orgId: "org-1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ status: "ready", can: () => true, canAny: () => true }) }));

const { ProgressList } = await import("../src/components/work/ReviewViews");

function project(extra: Partial<ProjectDto>): ProjectDto {
  return {
    id: "p1", key: "CRM", name: "CRM rebuild", description: null, mode: "STRUCTURED", lifecycle: "ACTIVE", archived: false, priority: "MEDIUM",
    project_manager: null, accountable: null, members: [], team_id: null, team_name: null, start_on: null, target_on: null, timezone: "Europe/London",
    active_baseline_id: null, task_count: 3, progress: { percent: 40, label: "Calculated", reported_at: "2026-11-24T10:00:00Z" },
    can_edit: false, version: 1, created_at: "2026-11-20T10:00:00Z", updated_at: "2026-11-24T10:00:00Z",
    ...extra,
  } as ProjectDto;
}

describe("progress list views", () => {
  it("shows each project's figure and how it is measured", () => {
    const html = renderToStaticMarkup(<ProgressList projects={[
      project({}),
      project({ id: "p2", key: "OPS", name: "Ops", mode: "INDIVIDUAL", progress: { percent: null, label: "Not reported", reported_at: null } }),
      project({ id: "p3", key: "NEW", name: "New", progress: { percent: null, label: "Not measurable", reported_at: null } }),
    ]} projectHref={(p) => `/org/org-1/manager/projects/${p.id}`} />);
    expect(html).toContain("40%");
    expect(html).toContain("Approved points of the active scope");
    expect(html).toContain("Approved check-ins of the accountable developer");
    expect(html).toContain("Not reported");
    expect(html).toContain("Not measurable");
    expect(html).not.toContain(">0%<"); // no invented zero for projects without a figure
    expect(html).toContain("/org/org-1/manager/projects/p1");
  });

  it("has an empty state without sample data", () => {
    expect(renderToStaticMarkup(<ProgressList projects={[]} />)).toContain("No projects");
  });

  it("replaces the Later pages of task 3.5", () => {
    for (const path of ["/org/o/developer/progress", "/org/o/lead/progress", "/org/o/manager/progress", "/org/o/viewer/progress",
      "/org/o/developer/projects/p1/structured/progress", "/org/o/developer/projects/p1/individual/progress-history", "/org/o/developer/projects/p1/individual/deadlines"]) {
      expect(isLiveRoute(path)).toBe(true);
    }
  });
});
