import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ProjectScopeVersionDto, ScopeVersionDto } from "../src/types/api";
import { isLiveRoute } from "../src/lib/live-routes";

// Task 3.2 (T25, AS-08): scope versions across projects for the Project Manager.

vi.mock("next/navigation", () => ({ useParams: () => ({ orgId: "org-1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ status: "ready", can: () => true, canAny: () => true }) }));

const { ProjectScopeCard } = await import("../src/components/work/ScopeViews");

function version(extra: Partial<ScopeVersionDto>): ScopeVersionDto {
  return { id: "v1", version_no: 1, base_version_no: 0, unit: "POINTS", status: "ACTIVE", reason: "Initial scope from project setup",
    author_email: "pm@x.test", approver_email: "pm@x.test", created_at: "2026-11-24T10:00:00Z", approved_at: "2026-11-24T10:00:00Z",
    superseded_at: null, total_points: 100, leaves: [], changes: [], version: 1, ...extra };
}

function entry(extra: Partial<ProjectScopeVersionDto>): ProjectScopeVersionDto {
  return { project_id: "p1", project_key: "CRM", project_name: "CRM rebuild", can_approve: true,
    version: version({ id: "v2", version_no: 2, base_version_no: 1, status: "DRAFT", total_points: 125, approved_at: null, approver_email: null,
      reason: "Audit logging", changes: [{ kind: "ADD", work_item_id: "t", key: "CRM-9", title: "Audit trail", previous_points: null, new_points: 25, source_work_item_id: null }] }),
    active: version({}), ...extra };
}

describe("scope list views", () => {
  it("shows the project, the effect on the total and Approve for an approver", () => {
    const html = renderToStaticMarkup(<ProjectScopeCard entry={entry({})} detailHref="/org/org-1/manager/scope/v2" canApproveHere onApprove={() => undefined} />);
    expect(html).toContain("CRM · CRM rebuild");
    expect(html).toContain("/org/org-1/manager/scope/v2");
    expect(html).toContain("Audit trail");
    expect(html).toContain("100 becomes 125");
    expect(html).toContain("Approve");
    expect(html).not.toContain('role="dialog"');
  });

  it("hides Approve when the server says no or this member lacks project.scope.change", () => {
    expect(renderToStaticMarkup(<ProjectScopeCard entry={entry({ can_approve: false })} canApproveHere onApprove={() => undefined} />)).not.toContain(">Approve<");
    expect(renderToStaticMarkup(<ProjectScopeCard entry={entry({})} canApproveHere={false} onApprove={() => undefined} />)).not.toContain(">Approve<");
  });

  it("replaces the Later pages of task 3.2", () => {
    expect(isLiveRoute("/org/o/manager/scope")).toBe(true);
    expect(isLiveRoute("/org/o/manager/scope/v2")).toBe(true);
  });
});
