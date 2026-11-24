import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/org/org-acme/owner/members",
  useRouter: () => ({ push: vi.fn() }),
}));

import { Sidebar } from "../src/components/navigation/sidebar";
import { TopNav } from "../src/components/navigation/top-nav";
import { FIXTURE_GRANTS } from "./fixtures/permissions";
import { SEEDED_ORGS } from "./fixtures/mock-data";
import { useAuthStore } from "../src/store/auth-store";
import { permissionStore } from "../src/store/permission-store";
import type { SystemRole } from "../src/types";

const acme = SEEDED_ORGS[0];

// zustand v5 renders the server snapshot from getInitialState(), so tests seed that snapshot.
const authInitial = useAuthStore.getInitialState();
const authDefaults = {
  currentRole: authInitial.currentRole,
  currentOrg: authInitial.currentOrg,
};
vi.spyOn(permissionStore, "getInitialState").mockImplementation(() => permissionStore.getState());

function setup(role: SystemRole, grants = FIXTURE_GRANTS[role]) {
  Object.assign(authInitial, { currentRole: role, currentOrg: acme });
  useAuthStore.setState({ currentRole: role, currentOrg: acme });
  permissionStore.setState({
    orgId: acme.id,
    role,
    status: "ready",
    source: "api",
    scopeReported: true,
    grants,
  });
}

const renderSidebar = (mobileOpen = false) =>
  renderToStaticMarkup(
    <Sidebar mobileOpen={mobileOpen} onMobileClose={() => undefined} mobileTriggerRef={React.createRef()} />,
  );

afterEach(() => {
  Object.assign(authInitial, authDefaults);
  useAuthStore.setState(authDefaults);
  permissionStore.setState({
    orgId: "",
    role: null,
    status: "idle",
    source: null,
    scopeReported: false,
    grants: [],
  });
});

describe("org shell sidebar", () => {
  it("shows the owner menu without billing, subscriptions, workspaces or modules that have no API yet", () => {
    setup("ORGANIZATION_OWNER");
    const markup = renderSidebar();
    expect(markup).toContain("Roles &amp; permissions");
    expect(markup).toContain("Projects portfolio");
    expect(markup).not.toMatch(/billing|subscriptions|workspaces/i);
    expect(markup).not.toContain("Organization settings");
    expect(markup).not.toContain("Health &amp; risks");
    expect(markup).not.toContain("Audit &amp; security");
  });

  it("marks the current page with aria-current", () => {
    setup("ORGANIZATION_OWNER");
    expect(renderSidebar()).toMatch(/aria-current="page"[^>]*href="\/org\/org-acme\/owner\/members"|href="\/org\/org-acme\/owner\/members"[^>]*aria-current="page"/);
  });

  it("never shows organization settings to the admin family", () => {
    setup("ORGANIZATION_ADMIN");
    const markup = renderSidebar();
    expect(markup).toContain("/org/org-acme/admin/members");
    expect(markup).not.toContain("Organization settings");
    expect(markup).not.toContain("/owner/");
  });

  it("hides links whose keys are not granted, even for the owner template", () => {
    setup("ORGANIZATION_OWNER", [{ key: "project.read", scope: "ORG" }]);
    const markup = renderSidebar();
    expect(markup).toContain("Projects portfolio");
    expect(markup).not.toContain("Organization settings");
    expect(markup).not.toContain("Members");
  });

  it("is an off-canvas drawer below lg and a modal dialog only when open", () => {
    setup("ORGANIZATION_OWNER");
    const closed = renderSidebar(false);
    expect(closed).toContain("-translate-x-full");
    expect(closed).toContain("lg:translate-x-0");
    expect(closed).not.toContain('aria-modal="true"');

    const open = renderSidebar(true);
    expect(open).toContain('role="dialog"');
    expect(open).toContain('aria-modal="true"');
    expect(open).toContain("Close primary navigation");
    expect(open).toContain("motion-reduce:transition-none");
  });

  it("keeps other roles' menus unchanged", () => {
    setup("PROJECT_MANAGER");
    const markup = renderSidebar();
    expect(markup).toContain("PM Dashboard");
    expect(markup).toContain("/org/org-acme/manager/projects");
    expect(markup).not.toContain("/org/org-acme/manager/workload");
  });
});

describe("org shell top nav", () => {
  const renderTopNav = () =>
    renderToStaticMarkup(<TopNav title="Members" breadcrumb={[{ label: acme.name }, { label: "Owner" }]} onOpenNavigation={() => undefined} />);

<<<<<<< HEAD
  it("shows the Sample data badge while fixture permissions are in use", () => {
    setup("ORGANIZATION_OWNER", "fixture");
    expect(renderTopNav()).toContain("Sample data");
  });

  it("shows no badge for live API permissions in normal use (no NEXT_PUBLIC_USE_MOCKS)", () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "");
    onTestFinished(() => { vi.unstubAllEnvs(); });
    setup("ORGANIZATION_OWNER", "api");
=======
  it("never shows a sample-data badge", () => {
    setup("ORGANIZATION_OWNER");
>>>>>>> 29db595 (Initial ProWise project upload)
    expect(renderTopNav()).not.toContain("Sample data");
  });

  it("labels icon-only controls and hides the menu button at lg", () => {
    setup("ORGANIZATION_OWNER");
    const markup = renderTopNav();
    expect(markup).toContain('aria-label="Open primary navigation"');
    expect(markup).toMatch(/aria-label="Switch to (dark|light) mode"/);
    expect(markup).toContain('aria-label="Account menu for');
    expect(markup).toContain("lg:hidden");
    expect(markup).toContain("<h1");
  });
});
