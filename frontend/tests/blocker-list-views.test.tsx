import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { OrgBlockerDto } from "../src/types/api";
import { isLiveRoute } from "../src/lib/live-routes";

// Task 3.4 (T21, T24): blockers across projects and the dependency pages.

vi.mock("next/navigation", () => ({ useParams: () => ({ orgId: "org-1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ status: "ready", can: () => true, canAny: () => true }) }));

const { ProjectBlockerRow } = await import("../src/components/work/DependencyViews");

const NOW = new Date("2026-11-24T12:00:00Z");

function entry(extra: Partial<OrgBlockerDto> = {}, resolved = false): OrgBlockerDto {
  return {
    project_id: "p1", project_key: "CRM", project_name: "CRM rebuild", can_resolve: true,
    affected: [{ id: "b", key: "CRM-3", title: "B", state: "TODO" }],
    blocker: { id: "bl1", work_item_id: "a", work_item_key: "CRM-2", reason: "Vendor API down", severity: "CRITICAL",
      owner: { membership_id: "m-lead", email: "lead@x.test" }, opened_by_email: "dev@x.test", opened_at: "2026-11-21T12:00:00Z",
      resolved_at: resolved ? "2026-11-24T10:00:00Z" : null, resolution: resolved ? "Vendor fixed it" : null,
      resolved_by_email: resolved ? "lead@x.test" : null, version: 0 },
    ...extra,
  };
}

describe("blocker list views", () => {
  it("shows project, task, owner, age and the work it holds up, with Clear for those allowed", () => {
    const html = renderToStaticMarkup(<ul><ProjectBlockerRow entry={entry()} now={NOW} detailHref="/org/org-1/lead/blockers/bl1" onResolve={() => undefined} /></ul>);
    expect(html).toContain("Critical blocker");
    expect(html).toContain("CRM · CRM-2");
    expect(html).toContain("Owner: lead@x.test");
    expect(html).toContain("Open for 3d");
    expect(html).toContain("Holds up: CRM-3");
    expect(html).toContain("Clear blocker");
    expect(html).toContain("/org/org-1/lead/blockers/bl1");
  });

  it("hides Clear when the member may not clear it, and shows the resolution once cleared", () => {
    expect(renderToStaticMarkup(<ul><ProjectBlockerRow entry={entry({ can_resolve: false })} now={NOW} onResolve={() => undefined} /></ul>))
      .not.toContain("Clear blocker");
    const cleared = renderToStaticMarkup(<ul><ProjectBlockerRow entry={entry({}, true)} now={NOW} onResolve={() => undefined} /></ul>);
    expect(cleared).toContain("Cleared");
    expect(cleared).toContain("Resolution: Vendor fixed it");
    expect(cleared).not.toContain("Clear blocker");
  });

  it("replaces the Later pages of task 3.4", () => {
    for (const path of ["/org/o/lead/blockers", "/org/o/lead/blockers/bl1", "/org/o/lead/dependencies", "/org/o/manager/blockers",
      "/org/o/manager/dependencies", "/org/o/developer/projects/p1/structured/blockers", "/org/o/developer/projects/p1/structured/dependencies"]) {
      expect(isLiveRoute(path)).toBe(true);
    }
  });
});
