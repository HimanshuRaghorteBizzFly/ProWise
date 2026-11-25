import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PaginationBar } from "../src/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { OrganizationsView } from "../src/components/super-admin/OrganizationsView";
import { pageOf, usePagedRows } from "../src/components/super-admin/use-paged-rows";
import type { CommercialOrganization } from "../src/types/admin-commercial";

const noop = () => {};

/** Visible text of server-rendered markup: tags and React text separators removed, whitespace collapsed. */
function text(markup: string): string {
  return markup
    .replace(/<!-- -->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ – /g, "–")
    .trim();
}

function org(n: number): CommercialOrganization {
  return {
    id: `o${n}`,
    name: `Org ${String(n).padStart(2, "0")}`,
    slug: `org-${n}`,
    domain: null,
    industry: null,
    country: null,
    timezone: "UTC",
    owner_name: "Owner",
    owner_email: `owner${n}@example.test`,
    status: "ACTIVE",
    plan_id: null,
    seats_used: 1,
    seats_limit: 5,
    projects_count: 0,
    storage_used_gb: 0,
    mrr: null,
    created_at: "2026-11-01T00:00:00Z",
    last_activity_at: null,
    suspended_reason: null,
    notes: null,
    version: 1,
  };
}

describe("pageOf (usePagedRows paging math)", () => {
  const rows = Array.from({ length: 12 }, (_, i) => i + 1);

  it("returns the requested page's rows", () => {
    expect(pageOf(rows, 1, 10)).toEqual({ page: 1, totalPages: 2, pageRows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    expect(pageOf(rows, 2, 10)).toEqual({ page: 2, totalPages: 2, pageRows: [11, 12] });
    expect(pageOf(rows, 3, 5).pageRows).toEqual([11, 12]);
  });

  it("clamps a page past the end or below 1", () => {
    expect(pageOf(rows, 9, 10).page).toBe(2);
    expect(pageOf(rows, 9, 10).pageRows).toEqual([11, 12]);
    expect(pageOf(rows, 0, 10).page).toBe(1);
    expect(pageOf(rows, 1, 50)).toEqual({ page: 1, totalPages: 1, pageRows: rows });
  });

  it("gives an empty list one empty page", () => {
    expect(pageOf([], 1, 10)).toEqual({ page: 1, totalPages: 1, pageRows: [] });
  });
});

describe("usePagedRows", () => {
  function Probe({ count, size }: { count: number; size?: number }) {
    const rows = Array.from({ length: count }, (_, i) => `row-${i + 1}`);
    const { pageRows, barProps } = usePagedRows(rows, size);
    return (
      <div>
        <ul>
          {pageRows.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <PaginationBar {...barProps} />
      </div>
    );
  }

  it("starts on page 1 with the default page size of 10", () => {
    const out = text(renderToStaticMarkup(<Probe count={12} />));
    expect(out).toContain("Showing 1–10 of 12");
    expect(out).toContain("1 / 2");
    expect(out).toContain("row-10");
    expect(out).not.toContain("row-11");
  });

  it("honours a custom default page size", () => {
    const out = text(renderToStaticMarkup(<Probe count={12} size={5} />));
    expect(out).toContain("Showing 1–5 of 12");
    expect(out).toContain("1 / 3");
    expect(out).not.toContain("row-6");
  });

  it("shows 0–0 of 0 for an empty list", () => {
    expect(text(renderToStaticMarkup(<Probe count={0} />))).toContain("Showing 0–0 of 0");
  });
});

describe("Super Admin view pagination", () => {
  const orgs = Array.from({ length: 12 }, (_, i) => org(i + 1));
  const render = (selectedIds: string[]) =>
    renderToStaticMarkup(
      <OrganizationsView
        state={{ status: "ready", data: orgs }}
        summary={{ status: "ready", data: { total_orgs: 12, active_orgs: 12, trial_orgs: 0, suspended_orgs: 0, total_mrr: null } }}
        search=""
        status="ALL"
        onSearchChange={noop}
        onStatusChange={noop}
        onRetry={noop}
        onOpen={noop}
        detail={null}
        onCloseDetail={noop}
        onRetryDetail={noop}
        selectedIds={selectedIds}
        onSelectedIdsChange={noop}
        onBulkSuspend={noop}
      />,
    );

  it("Organizations shows the first 10 of 12 rows and the pagination footer", () => {
    const markup = render([]);
    const out = text(markup);
    expect(out).toContain("Showing 1–10 of 12");
    expect(out).toContain("Rows:");
    expect(out).toContain("1 / 2");
    expect(markup).toContain("Org 10");
    expect(markup).not.toContain("Org 11");
    expect(markup).toContain('aria-label="Next page"');
  });

  it("Organizations select-all reflects the visible page only", () => {
    const selectAll = (markup: string) => /<input[^>]*aria-label="Select all organizations"[^>]*>/.exec(markup)?.[0] ?? "";
    const firstPage = orgs.slice(0, 10).map((o) => o.id);
    expect(selectAll(render(firstPage))).toContain("checked");
    expect(selectAll(render(firstPage.slice(0, 9)))).not.toContain("checked");
    // Rows on page 2 being selected does not tick "select all" for page 1.
    expect(selectAll(render(["o11", "o12"]))).not.toContain("checked");
  });
});
