import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../src/lib/api";
import type { LiveDashboardData } from "../src/lib/live-dashboard-data";

// Real session after register / login: tokens are sent where they belong, a dead session goes to sign-in,
// and the dev preview (Quick Navigator, role preview, sample data) exists only with NEXT_PUBLIC_USE_MOCKS=true.

const permissions = { status: "ready", can: (_key: string) => true, canAny: () => true, retry: () => undefined };

vi.mock("next/navigation", () => ({
  useParams: () => ({ orgId: "org-new" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/org/org-new/owner/dashboard",
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => permissions }));
vi.mock("@/components/layouts/panel-layout", () => ({
  PanelLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// Static rendering reads a zustand store's initial snapshot; read the live state instead (real store otherwise).
vi.mock("@/store/auth-store", async () => {
  const actual = await vi.importActual<typeof import("../src/store/auth-store")>("../src/store/auth-store");
  type State = ReturnType<typeof actual.useAuthStore.getState>;
  const live = (selector?: (state: State) => unknown) =>
    selector ? selector(actual.useAuthStore.getState()) : actual.useAuthStore.getState();
  return { ...actual, useAuthStore: Object.assign(live, actual.useAuthStore) };
});

const { RoleTestBanner } = await import("../src/components/navigation/role-test-banner");
const { RoleSwitcher } = await import("../src/components/navigation/RoleSwitcher");
const { isProtectedPath, signInPathFor } = await import("../src/providers/AuthProvider");
const { LiveOrganizationDashboard } = await import("../src/components/org-console/LiveOrganizationDashboard");
const { OwnerAccessGate } = await import("../src/components/owner/OwnerAccessGate");
const { useAuthStore } = await import("../src/store/auth-store");
const { mocksAllowed, previewEnabled } = await import("../src/lib/permissions");

const initial = useAuthStore.getState();
afterEach(() => {
  vi.unstubAllEnvs();
  useAuthStore.setState(initial, true);
});

describe("API client session handling", () => {
  it("never sends a held (possibly stale) access token to sign-in, sign-up or refresh, but does elsewhere", async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(
      url.endsWith("/auth/login")
        ? { access_token: "held", refresh_token: "r", expires_in: 900, must_change_password: false, target_dashboard_url: "/x", user: {} }
        : { access_token: "t", id: "u", email: "e", memberships: [] },
    )));
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock, isRolePreview: () => false });
    await client.login({ email: "a@b.c", password: "x" }); // now holds "held"
    await client.refresh();
    await client.signup({ email: "a@b.c", password: "x", name: "n",
      organization: { name: "N", slug: "n", timezone: "UTC", calendar: { workDays: [1], dailyHours: 8, holidays: [] } } });
    await client.me();
    const auth = (i: number) => new Headers(fetchMock.mock.calls[i][1].headers).get("Authorization");
    expect(auth(1)).toBeNull(); // refresh
    expect(auth(2)).toBeNull(); // signup
    expect(auth(3)).toBe("Bearer t"); // business call
  });

  it("signals an expired session when a 401 survives the refresh, never for the auth routes themselves", async () => {
    const onSessionExpired = vi.fn();
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify({ code: "UNAUTHORIZED", message: "no", request_id: "r" }), { status: 401 }));
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock, isRolePreview: () => false, onSessionExpired });
    await expect(client.me()).rejects.toMatchObject({ status: 401 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    await expect(client.login({ email: "a@b.c", password: "bad" })).rejects.toMatchObject({ status: 401 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("sends an expired session on protected pages to sign-in, remembering the page", () => {
    expect(isProtectedPath("/org/org-new/owner/dashboard")).toBe(true);
    expect(isProtectedPath("/select-workspace")).toBe(true);
    expect(isProtectedPath("/login")).toBe(false);
    expect(isProtectedPath("/signup")).toBe(false);
    expect(signInPathFor("/org/org-new/owner/dashboard")).toBe("/login?expired=1&next=%2Forg%2Forg-new%2Fowner%2Fdashboard");
  });
});

describe("dev preview only with NEXT_PUBLIC_USE_MOCKS=true", () => {
  it("hides the Quick Navigator and the role switcher without the flag", () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "");
    expect(previewEnabled()).toBe(false);
    expect(renderToStaticMarkup(<RoleTestBanner />)).toBe("");
    expect(renderToStaticMarkup(<RoleSwitcher />)).toBe("");
  });

  it("shows them with the flag outside production", () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "true");
    expect(renderToStaticMarkup(<RoleTestBanner />)).toContain("Blueprint V1.1 Quick Navigator");
  });

  it("never allows sample data in a production build, even with the flag", () => {
    expect(mocksAllowed({ nodeEnv: "production", useMocks: "true" })).toBe(false);
    expect(mocksAllowed({ nodeEnv: "development", useMocks: undefined })).toBe(false);
  });

  it("a leftover role preview never overrides a real session's access checks", () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "");
    useAuthStore.setState({ isRolePreview: true, sessionStatus: "checking", currentOrg: { ...initial.currentOrg, id: "org-new" } });
    const html = renderToStaticMarkup(<OwnerAccessGate requiredPermission="org.manage"><p>owner home</p></OwnerAccessGate>);
    expect(html).toContain("Checking access"); // waits for the real session instead of trusting the preview
    expect(html).not.toContain("owner home");
  });
});

describe("Owner dashboard with real data", () => {
  const brandNew: Extract<LiveDashboardData, { kind: "organization" }> = {
    kind: "organization",
    members: [{ membership_id: "m-1", user_id: "u-1", email: "founder@newco.test", role_template: "ORGANIZATION_OWNER", status: "ACTIVE" }] as never,
    teams: [],
    invitations: [],
    projects: [],
  };

  it("shows real empty states for a brand-new organization: 1 member, 0 projects, no activity", () => {
    const html = renderToStaticMarkup(<LiveOrganizationDashboard data={brandNew} href={(p = "") => `/org/org-new/owner/${p}`} />);
    expect(html).toContain("Active members");
    expect(html).toContain("1 total");
    expect(html).toContain("0 total");
    expect(html).toContain("No projects are stored for this organization.");
    expect(html).toContain("No teams are stored for this organization.");
    expect(html).toContain("No pending invitations.");
    expect(html).not.toContain("Reported progress"); // no invented percentage
  });

  it("labels parts without a backend as Later (task X) instead of showing numbers", () => {
    const html = renderToStaticMarkup(<LiveOrganizationDashboard data={brandNew} href={(p = "") => `/org/org-new/owner/${p}`} />);
    expect(html).toContain("Schedule health and risks");
    expect(html).toContain("Later · task 5.1");
    expect(html).toContain("Later · task 5.5");
  });
});
