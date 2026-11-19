import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  EXPECTED_VERSION_FIELD,
  IDEMPOTENCY_KEY_HEADER,
  REQUEST_ID_HEADER,
  createApiClient,
  resolveApiBaseUrl,
} from "../src/lib/api";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("typed API client", () => {
  it("fetches /v1/health from the configured base URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { status: "ok", request_id: "req-1", profile: "default" }, { [REQUEST_ID_HEADER]: "req-1" }),
    );
    const client = createApiClient({ baseUrl: "http://api.test/", fetch: fetchMock });

    const health = await client.health();

    expect(health).toEqual({ status: "ok", request_id: "req-1", profile: "default" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/v1/health");
    expect(new Headers(init.headers).get("Accept")).toBe("application/json");
  });

  it("parses the standard error shape into ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        code: "VALIDATION_FAILED",
        message: "The request has invalid fields.",
        request_id: "req-400",
        field_errors: [{ field: "name", message: "must not be blank" }],
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    const error = await client.health().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      code: "VALIDATION_FAILED",
      message: "The request has invalid fields.",
      requestId: "req-400",
      fieldErrors: [{ field: "name", message: "must not be blank" }],
    });
  });

  it("maps a non-JSON failure to an ApiError that keeps the response request ID", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("<html>Bad gateway</html>", {
        status: 502,
        headers: { "Content-Type": "text/html", [REQUEST_ID_HEADER]: "req-502" },
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    const error = await client.health().catch((e: unknown) => e);

    expect(error).toMatchObject({ status: 502, code: "HTTP_502", requestId: "req-502", fieldErrors: [] });
  });

  it("maps a network failure to NETWORK_ERROR", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.health()).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("does not send business API requests during development role preview", async () => {
    const fetchMock = vi.fn();
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetch: fetchMock,
      isRolePreview: () => true,
    });

    await expect(client.me()).rejects.toMatchObject({ status: 0, code: "ROLE_PREVIEW" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("allows sign-out while role preview blocks business API requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetch: fetchMock,
      isRolePreview: () => true,
    });

    await expect(client.signout()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/v1/auth/signout");
  });

  it("explains a missing NEXT_PUBLIC_API_BASE_URL clearly", () => {
    expect(() => resolveApiBaseUrl("")).toThrow(/NEXT_PUBLIC_API_BASE_URL/);
    expect(() => resolveApiBaseUrl(undefined)).toThrow(/frontend\/\.env\.example/);
    expect(resolveApiBaseUrl("http://localhost:8080///")).toBe("http://localhost:8080");
  });

  it("does not resolve the base URL until a request is made", () => {
    expect(() => createApiClient({ fetch: vi.fn() })).not.toThrow();
  });

  it("exposes the contract header and field names", () => {
    expect(IDEMPOTENCY_KEY_HEADER).toBe("Idempotency-Key");
    expect(EXPECTED_VERSION_FIELD).toBe("expectedVersion");
    expect(REQUEST_ID_HEADER).toBe("X-Request-Id");
  });

  it("refreshes once on 401 and retries with the in-memory access token", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: "UNAUTHORIZED", message: "Authentication is required." }))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "access-2" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "user-1", email: "user@example.test", memberships: [] }));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.me()).resolves.toMatchObject({ id: "user-1" });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][1].credentials).toBe("include");
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get("Authorization")).toBe("Bearer access-2");
  });
});
