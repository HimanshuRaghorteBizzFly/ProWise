import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OwnerDashboardView } from "../src/components/owner/OwnerDashboardView";
import { FIXTURE_GRANTS } from "./fixtures/permissions";
import { SEEDED_PROJECTS, SEEDED_USERS } from "./fixtures/mock-data";

const ROUTES = resolve(__dirname, "../src/app/(workspace)/org/[orgId]");
const read = (path: string) => readFileSync(resolve(ROUTES, path), "utf8");

describe("Admin page wrappers", () => {
  it.each(["dashboard", "members", "roles-permissions", "invitations", "teams", "projects"])(
    "admin/%s has its own wrapper and does not re-export an owner page",
    (route) => {
      const source = read(`admin/${route}/page.tsx`);
      expect(source).not.toMatch(/export \{ default \} from/);
      // Must not import an owner route page (shared components live in src/components/owner).
      expect(source).not.toMatch(/from "(\.\.\/)+owner\//);
      expect(source).not.toContain("[orgId]/owner");
      expect(source).toContain('family="admin"');
    },
  );

  it.each(["dashboard", "members", "roles-permissions", "invitations", "teams", "projects"])(
    "owner/%s uses the owner family",
    (route) => {
      expect(read(`owner/${route}/page.tsx`)).toContain('family="owner"');
    },
  );

  it("gates the admin family with its own keys, never org.manage", () => {
    const layout = read("admin/layout.tsx");
    expect(layout).toContain("ADMIN_GATE_KEYS");
    expect(layout).not.toContain("org.manage");
  });

  it("keeps billing, subscriptions and workspaces pages (hidden, not deleted)", () => {
    for (const route of ["billing", "subscriptions", "workspaces"]) {
      expect(existsSync(resolve(ROUTES, `owner/${route}/page.tsx`))).toBe(true);
    }
  });
});

describe("Dashboard additions", () => {
  const acmeProjects = SEEDED_PROJECTS.filter((project) => project.orgId === "org-acme");
  const render = (props: Partial<React.ComponentProps<typeof OwnerDashboardView>> = {}) =>
    renderToStaticMarkup(
      <OwnerDashboardView
        orgId="org-acme"
        orgName="Acme Health Technologies"
        projects={acmeProjects}
        users={SEEDED_USERS}
        canViewProjects
        {...props}
      />,
    );

  it("links inside the admin family when rendered for admins", () => {
    const markup = render({ basePath: "/org/org-acme/admin" });
    expect(markup).toContain("/org/org-acme/admin/projects");
    expect(markup).not.toContain("/org/org-acme/owner/");
  });

  it("shows an access snapshot that links to the Access Map", () => {
    const markup = render({
      basePath: "/org/org-acme/admin",
      access: { grants: FIXTURE_GRANTS.ORGANIZATION_ADMIN, scopeReported: true },
    });
    expect(markup).toContain("Your access");
    expect(markup).toContain("10 of 23");
    expect(markup).toContain("/org/org-acme/admin/access");
  });

  it("shows when the data was last updated and who can resolve attention items", () => {
    const markup = render({ dataAsOf: "2026-11-17T10:30:00Z" });
    expect(markup).toContain("Data as of");
    expect(markup).toContain("Who can resolve");
  });
});

describe("Batch 4b routes, redirects and sidebar coverage", () => {
  // Modules without a backend API render a "not available yet" notice (never sample data) and link back home.
  // Integrations has a real API now (task 4.1, GitHub App): both families render the GitHub view, never sample data.
  it.each(["owner", "admin"])("%s/integrations renders the real GitHub integration", (family) => {
    const source = read(`${family}/integrations/page.tsx`);
    expect(source).toContain("<OrgIntegrationsView");
    expect(source).toContain(`family="${family}"`);
    expect(source).not.toContain("<ModuleUnavailable");
    expect(source).not.toMatch(/store|mocks|fixture/i);
  });

  it.each(["reports", "audit-logs"])("admin/%s shows the not-available notice", (route) => {
    const source = read(`admin/${route}/page.tsx`);
    expect(source).not.toMatch(/export \{ default \} from/);
    expect(source).toContain("<ModuleUnavailable");
    expect(source).toContain("/admin/dashboard");
    expect(source).not.toMatch(/store|mocks|fixture/i);
  });

  it.each(["health", "reports", "notifications", "audit-logs", "privacy", "organization", "billing", "subscriptions", "workspaces"])(
    "owner/%s shows the not-available notice",
    (route) => {
      const source = read(`owner/${route}/page.tsx`);
      expect(source).toContain("<ModuleUnavailable");
      expect(source).toContain("/owner/dashboard");
      expect(source).not.toMatch(/store|mocks|fixture/i);
    },
  );

  it("keeps Data & privacy owner-only (no admin route)", () => {
    expect(existsSync(resolve(ROUTES, "admin/privacy/page.tsx"))).toBe(false);
  });

  const REDIRECTS: [string, string][] = [
    ["owner/page.tsx", "owner/dashboard"],
    ["admin/page.tsx", "admin/dashboard"],
    ["owner/settings/page.tsx", "owner/organization"],
    ["admin/repositories/page.tsx", "admin/dashboard"],
    ["admin/activity/page.tsx", "admin/dashboard"],
    ["admin/settings/page.tsx", "admin/roles-permissions"],
    // Access Map was removed from both families; old links land on Roles & permissions.
    ["owner/access/page.tsx", "owner/roles-permissions"],
    ["admin/access/page.tsx", "admin/roles-permissions"],
    // Health and notifications are not part of the admin family; they redirect into it.
    ["admin/health/page.tsx", "admin/projects"],
    ["admin/notifications/page.tsx", "admin/dashboard"],
  ];

  it.each(REDIRECTS)("%s redirects to an existing page (%s)", (file, target) => {
    const source = read(file);
    expect(source).toContain("redirect(");
    expect(source).toContain(`/${target}\``);
    expect(existsSync(resolve(ROUTES, target, "page.tsx"))).toBe(true);
  });

  it("gives every sidebar route of both families a page", async () => {
    const { buildOrgNav } = await import("../src/components/owner/org-nav");
    for (const family of ["owner", "admin"] as const) {
      for (const item of buildOrgNav(family, "org-acme").flatMap((group) => group.items)) {
        const route = item.href.replace("/org/org-acme/", "");
        expect(existsSync(resolve(ROUTES, route, "page.tsx")), `${item.href} has no page`).toBe(true);
      }
    }
  });
});
