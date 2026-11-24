import { describe, expect, it, onTestFinished, vi } from "vitest";

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

<<<<<<< HEAD
  it("never lets a role preview block a real session's API without NEXT_PUBLIC_USE_MOCKS=true", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "u", email: "e", memberships: [] })));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, isRolePreview: () => true });
    await expect(client.me()).resolves.toMatchObject({ id: "u" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });

  it("does not send business API requests during development role preview", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCKS", "true");
    onTestFinished(() => { vi.unstubAllEnvs(); });
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
=======
  it("signs out through the API", async () => {
>>>>>>> 29db595 (Initial ProWise project upload)
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const client = createApiClient({
      baseUrl: "http://api.test",
      fetch: fetchMock,
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

  it("sends the organization with signup so registration can be atomic", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { access_token: "access-1" }));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });
    const signup = {
      email: "owner@example.test",
      password: "CorrectHorseBatteryStaple!",
      name: "Test Owner",
      organization: {
        name: "Acme",
        slug: "acme",
        timezone: "America/New_York",
        calendar: { workDays: [1, 2, 3, 4, 5], dailyHours: 8, holidays: [] },
      },
    };

    await expect(client.signup(signup)).resolves.toEqual({ access_token: "access-1" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual(signup);
  });

  it("loads assigned code reviews from the authenticated organization API", async () => {
    const reviews = [{ id: "review-1", status: "PENDING" }];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, reviews));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.codeReviews("assigned")).resolves.toEqual(reviews);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/v1/developer/reviews?type=assigned");
  });

  it("encodes the member cursor in the organization-scoped request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await client.members("org-a", "cursor+value");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://api.test/v1/organizations/org-a/members?cursor=cursor%2Bvalue",
    );
  });

  it("uses the project cursor-page query and snake_case request bodies", async () => {
    const project = {
      id: "project-1",
      key: "CORE",
      name: "Core",
      description: null,
      mode: "INDIVIDUAL",
      lifecycle: "ACTIVE",
      archived: false,
      priority: "HIGH",
      project_manager: null,
      accountable: null,
      members: [],
      team_id: null,
      team_name: null,
      start_on: null,
      target_on: null,
      timezone: "UTC",
      active_baseline_id: null,
      task_count: 0,
      progress: { percent: null, label: "Not reported", reported_at: null },
      can_edit: true,
      version: 1,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {
      items: [project],
      next_cursor: null,
      has_more: false,
    }));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await expect(client.projects("org-a", { q: "core", include_archived: false, limit: 10 }))
      .resolves.toMatchObject({ items: [project], has_more: false });

    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://api.test/v1/organizations/org-a/projects?q=core&include_archived=false&limit=10",
    );

    const createBody = {
      name: "Core",
      key: "CORE",
      mode: "INDIVIDUAL" as const,
      status: "ACTIVE" as const,
      start_on: "2026-01-01",
      target_on: "2026-02-01",
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(201, project));
    await client.createProject("org-a", createBody);

    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toEqual(createBody);
  });

  it("sends check-in decisions to the implemented decision route", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { id: "checkin-1" }));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await client.decideCheckIn("checkin-1", {
      decision: "APPROVE",
      reason: "Reviewed",
      expected_version: 2,
    });

    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/v1/checkins/checkin-1/decision");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      decision: "APPROVE",
      reason: "Reviewed",
      expected_version: 2,
    });
  });

  it("uses the implemented delivery lifecycle endpoints and request shapes", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, [])));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock });

    await client.deliveryStatus("project-1");
    expect(fetchMock.mock.calls[0][0]).toBe("http://api.test/v1/projects/project-1/delivery-status");

    await client.requestDeliveryAcceptance("project-1", {
      bound_checkin_id: "checkin-1",
      checklist: [{ id: "tests", label: "Tests pass", checked: true, notes: "CI" }],
      evidence_summary: "Release evidence",
      evidence_items: [{ type: "PR", title: "Release", url: "https://example.test/pr/1", reference: "PR-1" }],
    });
    expect(fetchMock.mock.calls[1][0]).toBe("http://api.test/v1/projects/project-1/acceptance-requests");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toMatchObject({
      bound_checkin_id: "checkin-1",
      evidence_summary: "Release evidence",
    });

    await client.decideDeliveryAcceptance("request-1", {
      decision: "ACCEPTED",
      reason: "Approved",
      expected_project_version: 3,
    });
    expect(fetchMock.mock.calls[2][0]).toBe("http://api.test/v1/acceptance-requests/request-1/decisions");
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
