import { describe, expect, it, vi } from "vitest";

import { createApiClient } from "../src/lib/api";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Approved decisions 2 to 4: provisioning calls reach the real /v1 routes and never carry a password. */
describe("account provisioning client", () => {
  const user = {
    id: "u-1",
    email: "jane@test.prowise",
    name: "Jane",
    role: "DEVELOPER",
    status: "PENDING_ACTIVATION",
    must_change_password: false,
    created_at: "2026-11-23T00:00:00Z",
    email_delivery_status: "DELIVERED",
  };

  it("sends user provisioning through /api/v1/admin/users, not the old doubled /api/api path", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(201, user)));
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock });

    await client.superAdminUsers.create({ name: "Jane", email: "jane@test.prowise", role: "DEVELOPER", send_email: true });
    await client.superAdminUsers.resendSetupLink("u-1");
    await client.superAdminUsers.sendResetLink("u-1");

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls).toEqual([
      "/api/v1/admin/users",
      "/api/v1/admin/users/u-1/resend-invitation",
      "/api/v1/admin/users/u-1/reset-password",
    ]);
    urls.forEach((url) => expect(url).not.toContain("/api/api/"));
  });

  it("never sends a password when creating an account", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, user));
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock });

    await client.superAdminUsers.create({ name: "Jane", email: "jane@test.prowise", role: "DEVELOPER" });

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(Object.keys(body).some((key) => key.toLowerCase().includes("password"))).toBe(false);
  });

  it("returns delivery status only; the response type has no password field", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { user_id: "u-1", email: "jane@test.prowise", email_delivery_status: "FAILED" }));
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock });

    const result = await client.superAdminUsers.resendSetupLink("u-1");

    expect(result.email_delivery_status).toBe("FAILED");
    expect(Object.keys(result).some((key) => key.toLowerCase().includes("password"))).toBe(false);
  });

  it("signs in through /api/v1/auth/login and surfaces a pending-activation refusal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(403, {
        code: "ACCOUNT_PENDING_ACTIVATION",
        message: "Activate your account using the link we emailed you, then sign in.",
        request_id: "req-403",
        field_errors: [],
      }),
    );
    const client = createApiClient({ baseUrl: "/api", fetch: fetchMock });

    await expect(client.login({ email: "jane@test.prowise", password: "Whatever-Pass-1" })).rejects.toMatchObject({
      status: 403,
      code: "ACCOUNT_PENDING_ACTIVATION",
    });
    expect(String(fetchMock.mock.calls[0][0])).toBe("/api/v1/auth/login");
  });
});
