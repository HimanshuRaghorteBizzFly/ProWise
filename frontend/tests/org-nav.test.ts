import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { buildOrgNav, filterOrgNav } from "../src/components/owner/org-nav";
import { FIXTURE_GRANTS } from "../src/lib/fixtures/permissions";
import { canAnyWithGrants } from "../src/lib/permissions";

const ORG = "org-acme";
const flat = (groups: ReturnType<typeof buildOrgNav>) => groups.flatMap((group) => group.items);
const canAnyFor = (role: keyof typeof FIXTURE_GRANTS) => (keys: Parameters<typeof canAnyWithGrants>[1]) =>
  canAnyWithGrants(FIXTURE_GRANTS[role], keys);

describe("org nav config", () => {
  it.each(["owner", "admin"] as const)("keeps every %s link inside its own route family", (family) => {
    for (const item of flat(buildOrgNav(family, ORG))) {
      expect(item.href.startsWith(`/org/${ORG}/${family}/`)).toBe(true);
    }
  });

  it("never links billing, subscriptions or workspaces", () => {
    const hrefs = [...flat(buildOrgNav("owner", ORG)), ...flat(buildOrgNav("admin", ORG))].map((item) => item.href);
    expect(hrefs.some((href) => /billing|subscriptions|workspaces/.test(href))).toBe(false);
  });

  it("gates every link except the dashboard and Notifications by permission keys", () => {
    for (const family of ["owner", "admin"] as const) {
      for (const item of flat(buildOrgNav(family, ORG))) {
        // Ungated by design: dashboard (widgets gate themselves), Notifications (membership only).
        if (["/dashboard", "/notifications"].some((suffix) => item.href.endsWith(suffix))) continue;
        expect(item.requiredAny?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it.each(["owner", "admin"] as const)("only links %s routes that have a page", (family) => {
    for (const item of flat(buildOrgNav(family, ORG))) {
      const route = item.href.replace(`/org/${ORG}/`, "");
      const page = resolve(__dirname, "../src/app/(workspace)/org/[orgId]", route, "page.tsx");
      expect(existsSync(page), `${item.href} has no page`).toBe(true);
    }
  });

  it.each(["owner", "admin"] as const)("no longer links an Access Map in the %s family", (family) => {
    expect(flat(buildOrgNav(family, ORG)).some((item) => item.href.endsWith("/access") || item.label === "Access Map")).toBe(false);
  });

  it("does not offer organization settings in the admin family", () => {
    expect(flat(buildOrgNav("admin", ORG)).some((item) => item.href.endsWith("/organization"))).toBe(false);
  });
});

describe("filterOrgNav", () => {
  it("shows the owner every built link with the owner fixture grants", () => {
    const visible = flat(filterOrgNav(buildOrgNav("owner", ORG), canAnyFor("ORGANIZATION_OWNER")));
    expect(visible.map((item) => item.label)).toEqual(flat(buildOrgNav("owner", ORG)).map((item) => item.label));
  });

  it("hides owner-only links from a membership without org.manage", () => {
    const visible = flat(filterOrgNav(buildOrgNav("owner", ORG), canAnyFor("ORGANIZATION_ADMIN")));
    expect(visible.some((item) => item.href.endsWith("/organization"))).toBe(false);
    expect(visible.some((item) => item.href.endsWith("/members"))).toBe(true);
  });

  it("shows only the ungated links and drops empty groups when nothing is granted", () => {
    const groups = filterOrgNav(buildOrgNav("admin", ORG), () => false);
    expect(flat(groups).map((item) => item.label)).toEqual(["Dashboard", "Notifications"]);
    expect(groups.every((group) => group.items.length > 0)).toBe(true);
  });
});
