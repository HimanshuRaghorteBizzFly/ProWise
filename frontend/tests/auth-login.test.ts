import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Common login for all nine roles (frontend): the server's role and organization are applied as-is, organization
// selection, panel guard, invitation activation and session management client calls.

const store = new Map<string, string>();
vi.stubGlobal("sessionStorage", {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

const { createApiClient } = await import("../src/lib/api");
const { applyLoginResponse, readChoices, toSystemRole } = await import("../src/lib/auth-session");
const { mayOpenPanel, panelOf } = await import("../src/components/navigation/RoleRouteGuard");
const { validateNewPassword } = await import("../src/components/org-console/AcceptInvitationView");
const { deviceLabel } = await import("../src/components/account/device-label");
const { useAuthStore } = await import("../src/store/auth-store");
import type { AuthLoginResponse } from "../src/lib/api";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function response(extra: Partial<AuthLoginResponse> = {}): AuthLoginResponse {
  return {
    access_token: "a", expires_in: 900, must_change_password: false,
    target_dashboard_url: `/org/${ORG}/developer/dashboard`,
    user: { id: "u-1", email: "dev@acme.test", name: "Dev", role: "DEVELOPER", organization_id: ORG, organization_name: "Acme", must_change_password: false },
    requires_organization_selection: false,
    organizations: [{ organization_id: ORG, name: "Acme", role: "DEVELOPER", target_dashboard_url: `/org/${ORG}/developer/dashboard` }],
    ...extra,
  };
}

beforeEach(() => store.clear());
afterEach(() => vi.restoreAllMocks());

describe("applying a real sign-in", () => {
  it("uses the server's role, user and organization, never the demo organization", () => {
    const destination = applyLoginResponse(response());
    const state = useAuthStore.getState();
    expect(destination).toBe(`/org/${ORG}/developer/dashboard`);
    expect(state.currentRole).toBe("DEVELOPER");
    expect(state.currentOrg.id).toBe(ORG);
    expect(state.currentOrg.id).not.toBe("org-acme");
    expect(state.currentUser.id).toBe("u-1");
    expect(state.isAuthenticated).toBe(true);
  });

  it("sends a member of several organizations to the chooser and remembers the role each one gives", () => {
    const destination = applyLoginResponse(response({
      requires_organization_selection: true,
      target_dashboard_url: "/select-org",
      user: { id: "u-2", email: "both@x.test", name: "Both", role: null, organization_id: null, must_change_password: false },
      organizations: [
        { organization_id: ORG, name: "Acme", role: "DEVELOPER", target_dashboard_url: `/org/${ORG}/developer/dashboard` },
        { organization_id: OTHER, name: "Globex", role: "ORGANIZATION_OWNER", target_dashboard_url: `/org/${OTHER}/owner/dashboard` },
      ],
    }));
    expect(destination).toBe("/select-org");
    expect(useAuthStore.getState().organizations.map((o) => o.id)).toEqual([ORG, OTHER]);
    expect(readChoices().map((c) => c.role)).toEqual(["DEVELOPER", "ORGANIZATION_OWNER"]);
  });

  it("accepts only the nine known roles", () => {
    for (const role of ["SUPER_ADMIN", "PLATFORM_OPERATOR", "ORGANIZATION_OWNER", "ORGANIZATION_ADMIN", "PROJECT_MANAGER",
      "TEAM_LEAD", "DEVELOPER", "QA_REVIEWER", "VIEWER"]) {
      expect(toSystemRole(role)).toBe(role);
    }
    expect(toSystemRole("ROOT")).toBeNull();
    expect(toSystemRole(null)).toBeNull();
  });
});

describe("panel guard", () => {
  const panels: Record<string, string> = {
    ORGANIZATION_OWNER: "owner", ORGANIZATION_ADMIN: "admin", PROJECT_MANAGER: "manager", TEAM_LEAD: "lead",
    DEVELOPER: "developer", QA_REVIEWER: "reviewer", VIEWER: "viewer",
  };

  it("lets each organization role open only its own panel", () => {
    for (const [role, own] of Object.entries(panels)) {
      for (const panel of Object.values(panels)) {
        const allowed = panel === own || (role === "ORGANIZATION_OWNER" && panel === "admin");
        expect(mayOpenPanel(role as never, `/org/${ORG}/${panel}/dashboard`), `${role} -> ${panel}`).toBe(allowed);
      }
    }
  });

  it("keeps platform roles out of organization panels but not out of organization-level pages", () => {
    expect(mayOpenPanel("SUPER_ADMIN", `/org/${ORG}/owner/dashboard`)).toBe(false);
    expect(mayOpenPanel("PLATFORM_OPERATOR", `/org/${ORG}/developer/tasks`)).toBe(false);
    expect(panelOf(`/org/${ORG}/dashboard`)).toBeNull();
    expect(mayOpenPanel("DEVELOPER", `/org/${ORG}`)).toBe(true);
  });
});

describe("invitation activation", () => {
  it("mirrors the server password rule", () => {
    expect(validateNewPassword("short", "short")).toMatch(/12/);
    expect(validateNewPassword("long-enough-pass", "different-pass!")).toMatch(/match/);
    expect(validateNewPassword("long-enough-pass", "long-enough-pass")).toBeNull();
    expect(validateNewPassword("x".repeat(201), "x".repeat(201))).toMatch(/200/);
  });
});

describe("auth client calls", () => {
  function client(body: unknown, status = 200) {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
    return { fetchMock, api: createApiClient({ baseUrl: "http://api.test", fetch: fetchMock }) };
  }

  it("signs straight into a chosen organization", async () => {
    const { fetchMock, api } = client(response());
    await api.login({ email: "dev@acme.test", password: "pw-123456789012", organization_id: ORG });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/v1/auth/login");
    expect(JSON.parse(init.body)).toEqual({ email: "dev@acme.test", password: "pw-123456789012", organization_id: ORG });
  });

  it("previews and activates an invitation with the token in the body, never in the URL", async () => {
    const { fetchMock, api } = client({ organization_id: ORG, organization_name: "Acme", membership_id: "m", role_template: "DEVELOPER" });
    await api.activateInvitation({ token: "secret-token", password: "pw-123456789012", name: "New" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/v1/invitations/activate");
    expect(url).not.toContain("secret-token");
    expect(JSON.parse(init.body)).toMatchObject({ token: "secret-token" });
    expect(new Headers(init.headers).get("Idempotency-Key")).toBeTruthy();
  });

  it("lists and revokes the caller's sessions", async () => {
    const { fetchMock, api } = client([]);
    await api.mySessions();
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/v1/me/sessions");
    const revokeFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await createApiClient({ baseUrl: "http://api.test", fetch: revokeFetch }).revokeSession("s-1");
    expect(revokeFetch.mock.calls[0][0]).toBe("http://api.test/v1/me/sessions/s-1");
    expect(revokeFetch.mock.calls[0][1].method).toBe("DELETE");
  });
});

describe("device labels", () => {
  it("describes common browsers and falls back safely", () => {
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36")).toBe("Chrome on Windows");
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Gecko/20100101 Firefox/121.0")).toBe("Firefox on macOS");
    expect(deviceLabel(null)).toBe("Unknown device");
  });
});
