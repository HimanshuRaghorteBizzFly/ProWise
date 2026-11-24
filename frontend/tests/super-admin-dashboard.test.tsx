import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApiClient, endSessionAndGoToLogin } from "../src/lib/api";
import type { AdminDashboard } from "../src/types/admin";
import { DashboardBody } from "../src/components/super-admin/DashboardView";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const EMPTY: AdminDashboard = {
  total_organizations: 0,
  active_organizations: 0,
  trial_organizations: 0,
  suspended_organizations: 0,
  total_mrr: 0,
  total_arr: 0,
  active_subscriptions: 0,
  total_seats_allocated: 0,
  active_operators: 0,
  plan_distribution: [],
  recent_activity: [],
};

describe("Super Admin dashboard", () => {
  it("loads GET /v1/admin/dashboard through the typed client", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, EMPTY));
    const api = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock as unknown as typeof fetch, onSessionExpired: () => {} });

    await api.admin.dashboard();

    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/v1/admin/dashboard");
    expect(fetchMock.mock.calls[0][1].method).toBe("GET");
  });

  it("renders the server's figures and nothing invented", () => {
    const html = renderToStaticMarkup(
      <DashboardBody
        data={{
          ...EMPTY,
          total_organizations: 7,
          active_organizations: 5,
          active_operators: 3,
          total_mrr: 2299,
          plan_distribution: [{ plan_name: "Team", count: 2, percentage: 28.6 }],
          recent_activity: [
            {
              id: "a1",
              category: "SECURITY",
              action: "LOGIN",
              summary: "Signed in",
              actor_name: "Root",
              actor_email: null,
              target_label: null,
              severity: "INFO",
              timestamp: "2026-11-24T10:00:00Z",
            },
          ],
        }}
      />,
    );

    expect(html).toContain(">7<");
    expect(html).toContain("5 active");
    expect(html).toContain("Team");
    expect(html).toContain("Signed in");
    expect(html).toContain("Billing is dormant");
  });

  it("shows empty states, not sample rows, when the server has no plans or activity", () => {
    const html = renderToStaticMarkup(<DashboardBody data={EMPTY} />);

    expect(html).toContain("No plans");
    expect(html).toContain("No activity yet");
  });

  it("has no local store, simulated request or made-up history in the page source", () => {
    const source = readFileSync(resolve(__dirname, "../src/app/(platform)/super-admin/page.tsx"), "utf8");

    expect(source).not.toMatch(/useSuperAdminStore|withSimulatedRequest|generateSynchronizedCalendarEvents|Math\.round\(current/);
  });
});

describe("ended session", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubLocation(pathname: string, search = "") {
    const assign = vi.fn();
    vi.stubGlobal("window", { location: { pathname, search, assign } });
    vi.stubGlobal("sessionStorage", { removeItem: vi.fn() });
    vi.stubGlobal("localStorage", { removeItem: vi.fn() });
    vi.stubGlobal("document", { cookie: "" });
    return assign;
  }

  it("sends the person to /login and back to the page they were on", () => {
    const assign = stubLocation("/super-admin/plans", "?tab=all");

    endSessionAndGoToLogin();

    expect(assign).toHaveBeenCalledWith(`/login?next=${encodeURIComponent("/super-admin/plans?tab=all")}`);
  });

  it("does not redirect from the sign-in pages", () => {
    for (const page of ["/login", "/change-password", "/signup", "/invitations/accept"]) {
      const assign = stubLocation(page);
      endSessionAndGoToLogin();
      expect(assign).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    }
  });

  it("a refused refresh after a 401 ends the session", async () => {
    const onSessionExpired = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: "UNAUTHORIZED", message: "Authentication is required.", request_id: "r1" }))
      .mockResolvedValueOnce(jsonResponse(401, { code: "UNAUTHORIZED", message: "Refresh refused.", request_id: "r2" }));
    const api = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock as unknown as typeof fetch, onSessionExpired });

    await expect(api.admin.plans.list()).rejects.toMatchObject({ status: 401 });

    expect(fetchMock.mock.calls[1][0]).toBe("http://api.test/v1/auth/refresh");
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });
});
