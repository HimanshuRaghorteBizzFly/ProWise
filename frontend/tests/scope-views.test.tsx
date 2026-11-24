import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { ScopeVersionDto } from "../src/types/api";

// Task 3.2 (T25, AS-08): scope versions on the project page.

vi.mock("next/navigation", () => ({ useParams: () => ({ orgId: "org-1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ status: "ready", can: () => true, canAny: () => true }) }));

const { scopeEffect, toChangeRequest, ScopeVersionCard } = await import("../src/components/work/ScopeViews");

function version(extra: Partial<ScopeVersionDto>): ScopeVersionDto {
  return { id: "v", version_no: 1, base_version_no: 0, unit: "POINTS", status: "ACTIVE", reason: "Initial scope from project setup",
    author_email: "pm@x.test", approver_email: "pm@x.test", created_at: "2026-11-24T10:00:00Z", approved_at: "2026-11-24T10:00:00Z",
    superseded_at: null, total_points: 100, leaves: [], changes: [], version: 1, ...extra };
}

describe("scope views", () => {
  it("shows the effect of a draft on the total points (100 becomes 125)", () => {
    const draft = version({ id: "d", status: "DRAFT", version_no: 2, base_version_no: 1, total_points: 125, approved_at: null, approver_email: null,
      reason: "Audit logging", changes: [{ kind: "ADD", work_item_id: "t", key: "CRM-9", title: "Audit trail", previous_points: null, new_points: 25, source_work_item_id: null }] });
    expect(scopeEffect(version({}), draft)).toBe("Total points 100 becomes 125");
    const html = renderToStaticMarkup(<ScopeVersionCard version={draft} active={version({})} onApprove={() => undefined} />);
    expect(html).toContain("Draft for version 2");
    expect(html).toContain("Audit trail");
    expect(html).toContain("25 pts");
    expect(html).toContain("Approve");
    expect(html).not.toContain('role="dialog"');
  });

  it("shows who approved a version and never offers approval on an approved one", () => {
    const html = renderToStaticMarkup(<ScopeVersionCard version={version({})} onApprove={() => undefined} />);
    expect(html).toContain("Version 1");
    expect(html).toContain("approved by pm@x.test");
    expect(html).not.toContain(">Approve<");
  });

  it("builds the change requests the API expects", () => {
    expect(toChangeRequest({ kind: "ADD", workItemId: "", title: "New", points: "25", parentId: "", parts: [] }))
      .toEqual({ kind: "ADD", title: "New", points: 25, parent_id: null });
    expect(toChangeRequest({ kind: "CANCEL", workItemId: "t", title: "", points: "", parentId: "", parts: [] }))
      .toEqual({ kind: "CANCEL", work_item_id: "t" });
    expect(toChangeRequest({ kind: "SPLIT", workItemId: "t", title: "", points: "", parentId: "", parts: [{ title: "A", points: "2" }, { title: "B", points: "3" }] }))
      .toEqual({ kind: "SPLIT", work_item_id: "t", parts: [{ title: "A", points: 2 }, { title: "B", points: 3 }] });
  });
});
