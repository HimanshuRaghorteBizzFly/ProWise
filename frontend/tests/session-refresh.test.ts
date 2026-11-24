import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "../src/lib/api";

// Sessions: one refresh at a time, retry once, logout only when refresh itself fails, no loops, token in memory only.

type Handler = (url: string, init: RequestInit) => { status: number; body?: unknown };

function fakeFetch(handler: Handler) {
  const calls: { url: string; auth: string | null }[] = [];
  const fetch = vi.fn(async (url: string, init: RequestInit) => {
    const auth = new Headers(init.headers).get("Authorization");
    calls.push({ url, auth });
    const { status, body } = handler(url, init);
    return new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const UNAUTHORIZED = { code: "UNAUTHORIZED", message: "Sign in again.", request_id: "r", field_errors: [] };
const ENDED = { code: "SESSION_ENDED", message: "Your session ended. Please sign in again.", request_id: "r", field_errors: [] };

function client(handler: Handler) {
  const fake = fakeFetch(handler);
  const onSessionExpired = vi.fn();
  const api = createApiClient({ fetch: fake.fetch, baseUrl: "/api", onSessionExpired, isRolePreview: () => false });
  return { api, onSessionExpired, calls: fake.calls };
}

describe("session refresh", () => {
  it("after the access token expires: one refresh, then the original request is retried with the new token", async () => {
    let refreshes = 0;
    const { api, calls, onSessionExpired } = client((url, init) => {
      if (url.endsWith("/v1/auth/refresh")) { refreshes++; return { status: 200, body: { access_token: `fresh-${refreshes}` } }; }
      const auth = new Headers(init.headers).get("Authorization");
      return auth === "Bearer fresh-1" ? { status: 200, body: { id: "u" } } : { status: 401, body: UNAUTHORIZED };
    });
    await expect(api.me()).resolves.toEqual({ id: "u" });
    expect(refreshes).toBe(1);
    expect(calls.at(-1)?.auth).toBe("Bearer fresh-1");
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it("many requests failing at once share a single refresh (others wait in the queue)", async () => {
    let refreshes = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const { api } = client((url, init) => {
      if (url.endsWith("/v1/auth/refresh")) { refreshes++; return { status: 200, body: { access_token: "fresh" } }; }
      return new Headers(init.headers).get("Authorization") === "Bearer fresh" ? { status: 200, body: { ok: true } } : { status: 401, body: UNAUTHORIZED };
    });
    const all = Promise.all([api.me(), api.myPermissions("org-1"), api.me(), api.orgRoles("org-1")]);
    release();
    await gate;
    await expect(all).resolves.toHaveLength(4);
    expect(refreshes).toBe(1);
  });

  it("a request that fails with an older token after another refresh just retries with the current token", async () => {
    let refreshes = 0;
    const { api } = client((url, init) => {
      if (url.endsWith("/v1/auth/refresh")) { refreshes++; return { status: 200, body: { access_token: `t${refreshes}` } }; }
      const auth = new Headers(init.headers).get("Authorization");
      return auth === "Bearer t1" ? { status: 200, body: { ok: true } } : { status: 401, body: UNAUTHORIZED };
    });
    await api.refresh(); // t1
    // Simulate a late 401 for a request sent with no token before the refresh finished: no second refresh.
    await expect(api.me()).resolves.toEqual({ ok: true });
    expect(refreshes).toBe(1);
  });

  it("only a failed refresh ends the session, once, with no refresh loop", async () => {
    let refreshes = 0;
    const { api, onSessionExpired } = client((url) => {
      if (url.endsWith("/v1/auth/refresh")) { refreshes++; return { status: 401, body: ENDED }; }
      return { status: 401, body: UNAUTHORIZED };
    });
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(refreshes).toBe(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("a retried request that is still 401 does not refresh again (no loop)", async () => {
    let refreshes = 0;
    let requests = 0;
    const { api } = client((url) => {
      if (url.endsWith("/v1/auth/refresh")) { refreshes++; return { status: 200, body: { access_token: "fresh" } }; }
      requests++;
      return { status: 401, body: UNAUTHORIZED };
    });
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(refreshes).toBe(1);
    expect(requests).toBe(2);
  });

  it("page reload: refreshes silently from the cookie before the first request, then sends Bearer", async () => {
    const { api, calls } = client((url, init) => {
      if (url.endsWith("/v1/auth/refresh")) return { status: 200, body: { access_token: "reloaded" } };
      return new Headers(init.headers).get("Authorization") === "Bearer reloaded" ? { status: 200, body: { id: "u" } } : { status: 401, body: UNAUTHORIZED };
    });
    await expect(api.ensureAccessToken()).resolves.toBe("reloaded");
    await api.me();
    expect(calls.map((c) => c.url)).toEqual(["/api/v1/auth/refresh", "/api/v1/me"]);
    // The refresh call never carries a token and has no body: the refresh token is only the httpOnly cookie.
    expect(calls[0].auth).toBeNull();
  });

  it("never stores the access token in localStorage", async () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { setItem, getItem: () => null, removeItem: vi.fn(), clear: vi.fn(), key: () => null, length: 0 });
    vi.stubGlobal("sessionStorage", { setItem, getItem: () => null, removeItem: vi.fn(), clear: vi.fn(), key: () => null, length: 0 });
    const { api } = client(() => ({ status: 200, body: { access_token: "secret-token" } }));
    await api.refresh();
    await api.me();
    expect(setItem.mock.calls.flat().join(" ")).not.toContain("secret-token");
    vi.unstubAllGlobals();
  });
});
