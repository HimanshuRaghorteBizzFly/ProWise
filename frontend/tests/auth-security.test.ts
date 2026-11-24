import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { ApiError, createApiClient } from "../src/lib/api";
import { attemptLogin, loginErrorMessage, CANNOT_REACH_SERVER_MESSAGE } from "../src/lib/login-flow";
import { passwordChangeError } from "../src/lib/password-policy";
import { clearAuthSession } from "../src/lib/auth-session";
import { useAuthStore } from "../src/store/auth-store";

// Frontend auth security fixes: no refresh deadlock, no fake sign-in, server password policy, no tokens in storage.

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

const UNAUTHORIZED = { code: "UNAUTHORIZED", message: "Sign in again.", request_id: "req-401", field_errors: [] };

/** Fails the test instead of hanging forever when a promise never settles. */
function settlesWithin<T>(promise: Promise<T>, ms = 1000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`did not settle within ${ms}ms (deadlock)`)), ms)),
  ]);
}

describe("token refresh never deadlocks", () => {
  it("rejects promptly when the refresh call itself returns 401", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(401, UNAUTHORIZED));
    const onSessionExpired = vi.fn();
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, onSessionExpired });

    const error = await settlesWithin(client.me().catch((e: unknown) => e));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401 });
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual(["http://api.test/v1/me", "http://api.test/v1/auth/refresh"]);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("refresh() rejects on 401 and clears the in-memory access token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "old", must_change_password: false, user: {} }))
      .mockResolvedValueOnce(jsonResponse(401, UNAUTHORIZED))
      .mockResolvedValueOnce(jsonResponse(200, { status: "UP" }));
    const onSessionExpired = vi.fn();
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, onSessionExpired });

    await client.login({ email: "a@b.test", password: "x" });
    await expect(settlesWithin(client.refresh())).rejects.toMatchObject({ status: 401 });
    await client.health();

    const healthHeaders = new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers);
    expect(healthHeaders.get("Authorization")).toBeNull();
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it("concurrent 401s share one refresh and all reject when it fails", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(401, UNAUTHORIZED));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, onSessionExpired: () => {} });

    const results = await settlesWithin(Promise.allSettled([client.me(), client.mySessions()]));

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    const refreshCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/v1/auth/refresh"));
    expect(refreshCalls.length).toBeLessThanOrEqual(2);
  });

  it.each([
    ["login", (c: ReturnType<typeof createApiClient>) => c.login({ email: "a@b.test", password: "wrong" })],
    ["signin", (c: ReturnType<typeof createApiClient>) => c.signin({ email: "a@b.test", password: "wrong" })],
  ])("a 401 from %s is returned as-is without a refresh", async (_name, call) => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(401, { code: "INVALID_CREDENTIALS", message: "Email or password is wrong.", request_id: "r", field_errors: [] }),
    );
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, onSessionExpired: () => {} });

    await expect(settlesWithin(call(client))).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("signout with an expired session settles and drops the access token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "old", must_change_password: false, user: {} }))
      .mockResolvedValueOnce(jsonResponse(401, UNAUTHORIZED))
      .mockResolvedValueOnce(jsonResponse(200, { status: "UP" }));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, onSessionExpired: () => {} });

    await client.login({ email: "a@b.test", password: "x" });
    await settlesWithin(client.signout().catch(() => undefined));
    await client.health();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers).get("Authorization")).toBeNull();
  });

  it("still retries a request once after a successful refresh, without needing refresh_token in any body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, UNAUTHORIZED))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "fresh", expires_in: 900 }))
      .mockResolvedValueOnce(jsonResponse(200, []));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, onSessionExpired: () => {} });

    await expect(client.mySessions()).resolves.toEqual([]);
    expect(new Headers((fetchMock.mock.calls[2][1] as RequestInit).headers).get("Authorization")).toBe("Bearer fresh");
  });
});

describe("login only succeeds on a real backend answer", () => {
  const ok = {
    access_token: "a", expires_in: 900, must_change_password: false, target_dashboard_url: "/x",
    user: { id: "u", email: "a@b.test", name: "A", role: "DEVELOPER", must_change_password: false },
  };

  it("returns the server response on 200", async () => {
    const result = await attemptLogin(() => Promise.resolve(ok), "a@b.test", "pw");
    expect(result).toEqual({ ok: true, response: ok });
  });

  it("returns the server's error message for a backend refusal, never a session", async () => {
    const refusal = new ApiError(401, "INVALID_CREDENTIALS", "Email or password is wrong.", "req-1");
    const result = await attemptLogin(() => Promise.reject(refusal), "a@b.test", "pw");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(refusal);
      expect(loginErrorMessage(result.error)).toContain("Email or password is wrong.");
      expect(loginErrorMessage(result.error)).toContain("req-1");
    }
  });

  it("reports that the server cannot be reached on a network failure", async () => {
    const result = await attemptLogin(
      () => Promise.reject(new ApiError(0, "NETWORK_ERROR", "Failed to fetch", "r")), "a@b.test", "pw");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(loginErrorMessage(result.error)).toBe(CANNOT_REACH_SERVER_MESSAGE);
  });

  it("reports that the server cannot be reached on a timeout, not a fake sign-in", async () => {
    const result = await attemptLogin(() => new Promise(() => undefined), "a@b.test", "pw", 20);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(loginErrorMessage(result.error)).toBe(CANNOT_REACH_SERVER_MESSAGE);
  });

  it("the login page no longer builds a client-side session from the typed email", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(__dirname, "../src/app/(auth)/login/page.tsx"), "utf8");
    expect(source).not.toMatch(/resolveRoleProfile/);
    expect(source).not.toMatch(/BACKEND_TIMEOUT/);
    expect(source).not.toMatch(/backendHandled/);
    expect(source).toMatch(/\/change-password/);
  });
});

describe("change-password mirrors the server PasswordPolicy", () => {
  it.each([
    ["Short-1!", /Missing:.*12 to 200/],
    ["correct-horse-battery-1!", /Missing:.*uppercase/i],
    ["CORRECT-HORSE-BATTERY-1", /Missing:.*lowercase/i],
    ["Correct-Horse-Battery", /Missing:.*number/i],
    ["CorrectHorseBattery1", /Missing:.*special/i],
    [`Aa1!${"x".repeat(200)}`, /200/],
  ])("refuses %s", (password, message) => {
    expect(passwordChangeError(password, password)).toMatch(message);
  });

  it("refuses a confirmation that does not match", () => {
    expect(passwordChangeError("Correct-Horse-42!", "Correct-Horse-42?")).toMatch(/match/);
  });

  it("accepts a password that meets every rule", () => {
    expect(passwordChangeError("Correct-Horse-42!", "Correct-Horse-42!")).toBeNull();
  });

  it("never trims: surrounding spaces are part of the password", () => {
    // 11 visible characters plus a trailing space: the space is the special character and the twelfth character.
    expect(passwordChangeError("Abcdefghij1 ", "Abcdefghij1 ")).toBeNull();
    expect(passwordChangeError("Abcdefghij1 ", "Abcdefghij1")).toMatch(/match/);
  });

  it("the change-password page uses the shared policy and sends passwords untrimmed", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(__dirname, "../src/app/(auth)/change-password/page.tsx"), "utf8");
    expect(source).toMatch(/passwordChangeError/);
    expect(source).not.toMatch(/Password\.trim\(\)/);
    expect(source).not.toMatch(/>= 8/);
  });
});

describe("auth state is cleared when the session is gone", () => {
  it("clearAuthSession drops the persisted isAuthenticated flag", () => {
    useAuthStore.getState().login("a@b.test", "DEVELOPER");
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    clearAuthSession();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("the default session-expired handler clears the auth store after a failed refresh", async () => {
    useAuthStore.getState().login("a@b.test", "DEVELOPER");
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(401, UNAUTHORIZED));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await settlesWithin(client.me().catch(() => undefined));

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("AuthProvider clears the session on a failed me()", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(resolve(__dirname, "../src/providers/AuthProvider.tsx"), "utf8");
    expect(source).toMatch(/clearAuthSession\(\)/);
  });
});

describe("operator access token stays in memory", () => {
  let mod: typeof import("../src/app/(platform)/platform-operator/_services/operator-auth-service");
  const storage = new Map<string, string>();
  const localStorageStub = {
    getItem: vi.fn((k: string) => storage.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void storage.set(k, v)),
    removeItem: vi.fn((k: string) => void storage.delete(k)),
  };

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "/api";
    mod = await import("../src/app/(platform)/platform-operator/_services/operator-auth-service");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    storage.clear();
    localStorageStub.setItem.mockClear();
  });

  const loginBody = {
    access_token: "acc", token_type: "Bearer", expires_in: 900,
    operator: { id: "op-1", name: "Op", email: "op@test.prowise" }, authorized_modules: [], effective_permissions: [],
  };

  it("never writes the access token to localStorage and ignores a previously stored one", async () => {
    storage.set("prowise_operator_access_token", "stale-token");
    vi.stubGlobal("window", { localStorage: localStorageStub });
    vi.stubGlobal("localStorage", localStorageStub);
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(200, loginBody));
    vi.stubGlobal("fetch", fetchMock);

    const service = new mod.OperatorAuthService();
    expect(service.getToken()).toBeNull();
    expect(storage.has("prowise_operator_access_token")).toBe(false);

    await service.login("op@test.prowise", "Operator-Own-Pass-1");

    expect(service.getToken()).toBe("acc");
    expect(localStorageStub.setItem).not.toHaveBeenCalled();
  });

  it("on page load (no token in memory) a 401 refreshes through the HttpOnly cookie and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, UNAUTHORIZED))
      .mockResolvedValueOnce(jsonResponse(200, { ...loginBody, access_token: "fresh" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "op-1", name: "Op", email: "op@test.prowise" }));
    vi.stubGlobal("fetch", fetchMock);

    const service = new mod.OperatorAuthService();
    const profile = await settlesWithin(service.getProfile());

    expect(profile.id).toBe("op-1");
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual(["/api/v1/operator/me", "/api/v1/auth/operator/refresh", "/api/v1/operator/me"]);
    expect(fetchMock.mock.calls[1][1].credentials).toBe("include");
    expect(fetchMock.mock.calls[1][1].body).toBeUndefined();
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get("Authorization")).toBe("Bearer fresh");
  });

  it("a failed operator refresh rejects promptly and clears the in-memory token", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(401, UNAUTHORIZED));
    vi.stubGlobal("fetch", fetchMock);

    const service = new mod.OperatorAuthService();
    service.setToken("expired");
    await expect(settlesWithin(service.getProfile())).rejects.toThrow();

    expect(service.getToken()).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a 401 from operator login does not trigger a refresh", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(401, { ...UNAUTHORIZED, code: "INVALID_CREDENTIALS" }));
    vi.stubGlobal("fetch", fetchMock);

    const service = new mod.OperatorAuthService();
    await expect(settlesWithin(service.login("op@test.prowise", "wrong"))).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
