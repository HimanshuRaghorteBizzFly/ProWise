import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApiClient } from "../src/lib/api";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Approved decision D9: signup starts a pending account and issues no session; the emailed link activates it. */
describe("self-service signup client", () => {
  it("posts the signup and stores no token, because the API issues none", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(202, { message: "If this address can be registered..." }));
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock });

    const result = await client.signup({ email: "owner@test.prowise", password: "Self-Chosen-Pass-1", name: "Owner" });

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/auth/signup");
    expect(result).toEqual({ message: "If this address can be registered..." });
    expect(Object.keys(result)).not.toContain("access_token");

    // A later authenticated call carries no bearer token from signup.
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "x", email: "owner@test.prowise", memberships: [] }));
    await client.me().catch(() => undefined);
    const headers = new Headers(fetchMock.mock.calls[1]?.[1]?.headers);
    expect(headers.get("Authorization")).toBeNull();
  });

  it("verifies the email with only the link token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock });

    await client.verifyEmail("link-token-123");

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/auth/verify-email");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ token: "link-token-123" });
  });

  it("surfaces an invalid or used link as an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, { code: "INVALID_TOKEN", message: "This link is invalid, already used or expired.", request_id: "r", field_errors: [] }),
    );
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock });

    await expect(client.verifyEmail("used")).rejects.toMatchObject({ status: 400, code: "INVALID_TOKEN" });
  });
});

/** Confirmed contract mismatch: the operator API speaks snake_case; the operator client and pages use camelCase. */
describe("operator auth client casing", () => {
  let service: typeof import("../src/app/(platform)/platform-operator/_services/operator-auth-service");

  beforeAll(async () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "/api";
    service = await import("../src/app/(platform)/platform-operator/_services/operator-auth-service");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("maps the snake_case login response the sign-in page reads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        access_token: "acc",
        refresh_token: "ref",
        token_type: "Bearer",
        expires_in: 900,
        operator: { id: "op-1", name: "Dept Op", department_name: "Finance & Tax", shift_name: "Day", mfa_enabled: true, access_level: "DEPARTMENT_OPERATOR" },
        authorized_modules: ["billing.invoices"],
        effective_permissions: ["billing.invoices:view"],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await service.operatorAuthService.login("op@test.prowise", "Operator-Own-Pass-1", true);

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/auth/operator/login");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      email: "op@test.prowise",
      password: "Operator-Own-Pass-1",
      remember_me: true,
    });
    expect(res.accessToken).toBe("acc");
    expect(res.authorizedModules).toEqual(["billing.invoices"]);
    expect(res.operator.departmentName).toBe("Finance & Tax");
    expect(res.operator.accessLevel).toBe("DEPARTMENT_OPERATOR");
  });

  it("sends new_password for reset links and invitations", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, { message: "ok" })));
    vi.stubGlobal("fetch", fetchMock);

    await service.operatorAuthService.resetPassword("reset-token", "Fresh-Operator-Pass-9");
    await service.operatorAuthService.acceptInvitation("invite-token", "Fresh-Operator-Pass-9", "Taylor");

    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/auth/operator/reset-password");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ token: "reset-token", new_password: "Fresh-Operator-Pass-9" });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({
      token: "invite-token",
      new_password: "Fresh-Operator-Pass-9",
      name: "Taylor",
    });
  });

  it("converts nested keys in both directions", () => {
    expect(service.toSnakeCaseKeys({ rememberMe: true, nested: [{ newPassword: "x" }] })).toEqual({
      remember_me: true,
      nested: [{ new_password: "x" }],
    });
    expect(service.toCamelCaseKeys({ access_token: "a", operator: { department_id: "finance-tax" } })).toEqual({
      accessToken: "a",
      operator: { departmentId: "finance-tax" },
    });
  });
});

/** Approved decision D4: no published seed password ships in any frontend source. */
describe("no published seed credentials in the frontend", () => {
  it("login and operator login pages embed no seeded password", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    for (const page of ["src/app/(auth)/login/page.tsx", "src/app/(auth)/operator/login/page.tsx"]) {
      const source = readFileSync(resolve(__dirname, "..", page), "utf8");
      expect(source).not.toMatch(/(SuperAdmin|Operator|Developer|Owner|Admin|Manager|Lead|Reviewer|Viewer)2026!/);
    }
  });
});
