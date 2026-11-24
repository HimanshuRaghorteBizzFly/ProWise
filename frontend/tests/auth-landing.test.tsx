import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../src/lib/api";
import type { MeResponse } from "../src/types/api";

// Signup and login landing: the page comes from the server session, never from a default or hard-coded role.

const permissions = { status: "ready", can: (_key: string) => false, canAny: () => false, retry: () => undefined };
let routeOrgId = "org-new";

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: routeOrgId }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => `/org/${routeOrgId}/owner/dashboard`,
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => permissions }));
// Static rendering reads a zustand store's initial snapshot; read the live state instead (real store otherwise).
vi.mock("@/store/auth-store", async () => {
  const actual = await vi.importActual<typeof import("../src/store/auth-store")>("../src/store/auth-store");
  type State = ReturnType<typeof actual.useAuthStore.getState>;
  const live = (selector?: (state: State) => unknown) =>
    selector ? selector(actual.useAuthStore.getState()) : actual.useAuthStore.getState();
  return { ...actual, useAuthStore: Object.assign(live, actual.useAuthStore) };
});
vi.mock("@/components/layouts/panel-layout", () => ({
  PanelLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));

const { sessionFromMe } = await import("../src/lib/session");
const { useAuthStore, NO_ORG } = await import("../src/store/auth-store");
const { OwnerAccessGate } = await import("../src/components/owner/OwnerAccessGate");
const { NoWorkspaceContent, WorkspacePickerList } = await import("../src/components/auth/WorkspaceViews");

const initial = useAuthStore.getState();
afterEach(() => {
  useAuthStore.setState(initial, true);
  permissions.status = "ready";
  permissions.can = () => false;
  routeOrgId = "org-new";
});

function membership(orgId: string, role: string, name = "Acme") {
  return { id: `m-${orgId}`, org_id: orgId, role_template: role, status: "ACTIVE", name, slug: name.toLowerCase(), timezone: "UTC", work_calendar: "{}" };
}

function me(extra: Partial<MeResponse>): MeResponse {
  return { id: "u-1", email: "founder@example.test", memberships: [], ...extra };
}

describe("session from the server", () => {
  it("a new company owner lands on their own Owner dashboard with that organization active", () => {
    const session = sessionFromMe(me({
      role: "ORGANIZATION_OWNER", organization_id: "org-new", landing: "WORKSPACE", platform_account: false,
      target_dashboard_url: "/org/org-new/owner/dashboard", memberships: [membership("org-new", "ORGANIZATION_OWNER")],
    }));
    expect(session.target).toBe("/org/org-new/owner/dashboard");
    expect(session.activeOrgId).toBe("org-new");
    expect(session.role).toBe("ORGANIZATION_OWNER");
    expect(session.platform).toBe(false);
  });

  it("an Organization Admin lands on the Admin dashboard", () => {
    const session = sessionFromMe(me({
      role: "ORGANIZATION_ADMIN", organization_id: "org-a", target_dashboard_url: "/org/org-a/admin/dashboard",
      memberships: [membership("org-a", "ORGANIZATION_ADMIN")],
    }));
    expect(session.target).toBe("/org/org-a/admin/dashboard");
    expect(session.role).toBe("ORGANIZATION_ADMIN");
  });

  it("two organizations go to the workspace picker with no organization active", () => {
    const session = sessionFromMe(me({
      role: null, organization_id: null, landing: "SELECT_WORKSPACE", target_dashboard_url: "/select-workspace",
      memberships: [membership("org-a", "ORGANIZATION_OWNER"), membership("org-b", "DEVELOPER", "Beta")],
    }));
    expect(session.target).toBe("/select-workspace");
    expect(session.activeOrgId).toBe("");
  });

  it("no membership means \"no workspace yet\", and a normal user never gets Super Admin routing", () => {
    expect(sessionFromMe(me({ landing: "NO_WORKSPACE", target_dashboard_url: "/no-workspace" })).target).toBe("/no-workspace");
    // Even without a server target, an account without memberships never falls back to a platform dashboard.
    const bare = sessionFromMe(me({}));
    expect(bare.target).toBe("/no-workspace");
    expect(bare.target).not.toContain("super-admin");
    expect(bare.role).toBe("VIEWER");
    expect(bare.platform).toBe(false);
  });

  it("a real platform account keeps its platform dashboard and no organization", () => {
    const session = sessionFromMe(me({
      role: "SUPER_ADMIN", organization_id: null, landing: "PLATFORM", platform_account: true,
      target_dashboard_url: "/super-admin/dashboard",
    }));
    expect(session.target).toBe("/super-admin/dashboard");
    expect(session.platform).toBe(true);
    expect(session.activeOrgId).toBe("");
  });

  it("hydrates the organization the session is bound to, not the first one", () => {
    const orgs = sessionFromMe(me({ memberships: [membership("org-a", "DEVELOPER"), membership("org-b", "ORGANIZATION_OWNER")] })).organizations;
    useAuthStore.getState().hydrate({ id: "u", email: "e", name: "n", timezone: "UTC", createdAt: "" }, orgs, "ORGANIZATION_OWNER", "org-b");
    expect(useAuthStore.getState().currentOrg.id).toBe("org-b");
    expect(useAuthStore.getState().sessionStatus).toBe("authenticated");
    useAuthStore.getState().hydrate({ id: "u", email: "e", name: "n", timezone: "UTC", createdAt: "" }, orgs, "VIEWER", "");
    expect(useAuthStore.getState().currentOrg).toEqual(NO_ORG);
  });
});

describe("auth API client", () => {
  it("logs in through the proxied /v1 path and returns the server's signup landing", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "a", refresh_token: "r", expires_in: 900, must_change_password: false,
        target_dashboard_url: "/org/org-new/owner/dashboard", user: { role: "ORGANIZATION_OWNER" },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        access_token: "b", organization_id: "org-new", role: "ORGANIZATION_OWNER", target_dashboard_url: "/org/org-new/owner/dashboard",
      }), { status: 201 }));
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock, isRolePreview: () => false });

    const login = await client.login({ email: "founder@example.test", password: "x" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/auth/login"); // was /api/api/auth/login: never proxied
    expect(login.target_dashboard_url).toBe("/org/org-new/owner/dashboard");

    const signup = await client.signup({
      email: "founder@example.test", password: "correct-horse-battery", name: "F",
      organization: { name: "New Co", slug: "new-co", timezone: "UTC", calendar: { workDays: [1], dailyHours: 8, holidays: [] } },
    });
    expect(signup.target_dashboard_url).toBe("/org/org-new/owner/dashboard");
    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    expect(body).not.toHaveProperty("role");
    expect(body).not.toHaveProperty("organization_id");
  });
});

describe("Owner gate", () => {
  const owner = () => {
    useAuthStore.setState({
      sessionStatus: "authenticated",
      isRolePreview: false,
      currentRole: "ORGANIZATION_OWNER",
      currentOrg: { ...initial.currentOrg, id: "org-new", name: "New Co" },
    });
  };

  it("shows \"checking access\" (never restricted access) while the session is loading", () => {
    useAuthStore.setState({ sessionStatus: "checking", isRolePreview: false });
    const html = renderToStaticMarkup(<OwnerAccessGate requiredPermission="org.manage"><p>owner home</p></OwnerAccessGate>);
    expect(html).toContain("Checking access");
    expect(html).not.toContain("owner home");
    expect(html).not.toMatch(/permission/i);
  });

  it("lets the Owner in once the server grants org.manage", () => {
    owner();
    permissions.can = (key: string) => key === "org.manage";
    const html = renderToStaticMarkup(<OwnerAccessGate requiredPermission="org.manage"><p>owner home</p></OwnerAccessGate>);
    expect(html).toContain("owner home");
  });

  it("is restricted only when the active membership truly lacks the permission", () => {
    owner();
    const html = renderToStaticMarkup(<OwnerAccessGate requiredPermission="org.manage"><p>owner home</p></OwnerAccessGate>);
    expect(html).not.toContain("owner home");
    expect(html).toContain("org.manage");
  });

  it("asks to pick a workspace when the page's organization is not the session's", () => {
    owner();
    permissions.can = () => true;
    routeOrgId = "org-other";
    const html = renderToStaticMarkup(<OwnerAccessGate requiredPermission="org.manage"><p>owner home</p></OwnerAccessGate>);
    expect(html).not.toContain("owner home");
    expect(html).toContain("workspace context is missing or expired");
  });

  it("says the session ended when there is no session (no fake identity)", () => {
    useAuthStore.setState({ sessionStatus: "anonymous", isRolePreview: false });
    permissions.status = "unauthenticated";
    const html = renderToStaticMarkup(<OwnerAccessGate requiredPermission="org.manage"><p>owner home</p></OwnerAccessGate>);
    expect(html).toContain("Session expired");
  });
});

describe("workspace pages", () => {
  it("the picker lists every workspace with the role held there", () => {
    const html = renderToStaticMarkup(
      <WorkspacePickerList pending={null} onSelect={() => undefined}
        memberships={[membership("org-a", "ORGANIZATION_OWNER", "Acme"), membership("org-b", "DEVELOPER", "Beta")]} />,
    );
    expect(html).toContain("Acme");
    expect(html).toContain("Beta");
    expect(html).toContain("Organization Owner");
    expect(html).toContain("Developer");
    expect(html).not.toContain('role="dialog"');
  });

  it("\"no workspace yet\" offers to create a company", () => {
    const html = renderToStaticMarkup(<NoWorkspaceContent email="lonely@example.test" onSignOut={() => undefined} />);
    expect(html).toContain("No workspace yet");
    expect(html).toContain("lonely@example.test");
    expect(html).toContain("/create-organization");
    expect(html).toContain("Create a company");
  });
});
