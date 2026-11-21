import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  ApiError,
  IDEMPOTENCY_KEY_HEADER,
  REQUEST_ID_HEADER,
  createApiClient,
  isStaleVersion,
} from "../src/lib/api";
import { StaleVersionBanner } from "../src/components/org-console/StaleVersionBanner";
import { apiErrorMessage } from "../src/components/org-console/useRoleApi";

// Task 1.4 (NFR-04, T07): the client makes retries safe and makes lost races visible without a popup.

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

const ROLE = { id: "r1", name: "QA", template: false, owner_only: false, version: 1, grant_count: 0, permission_keys: [] };
const BODY = { name: "QA", permission_keys: [], expected_version: 0 };

function headersOf(call: unknown[]): Headers {
  return new Headers((call[1] as RequestInit).headers);
}

describe("API client change safety", () => {
  it("sends an Idempotency-Key and an X-Request-Id on every mutation", async () => {
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse(200, ROLE));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, isRolePreview: () => false });

    await client.updateRole("org-1", "r1", BODY);
    await client.updateRole("org-1", "r1", BODY);

    const first = headersOf(fetchMock.mock.calls[0]);
    const second = headersOf(fetchMock.mock.calls[1]);
    expect(first.get(IDEMPOTENCY_KEY_HEADER)).toMatch(/^[A-Za-z0-9-]{8,}$/);
    expect(first.get(REQUEST_ID_HEADER)).toMatch(/^[A-Za-z0-9-]{8,}$/);
    // Two separate user actions are two separate changes.
    expect(second.get(IDEMPOTENCY_KEY_HEADER)).not.toBe(first.get(IDEMPOTENCY_KEY_HEADER));
  });

  it("sends a request id but no Idempotency-Key on reads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, [ROLE]));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, isRolePreview: () => false });

    await client.roles("org-1");

    const headers = headersOf(fetchMock.mock.calls[0]);
    expect(headers.get(IDEMPOTENCY_KEY_HEADER)).toBeNull();
    expect(headers.get(REQUEST_ID_HEADER)).not.toBeNull();
  });

  it("reuses the same Idempotency-Key when a mutation is retried after a token refresh", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: "UNAUTHORIZED", message: "x", request_id: "a", field_errors: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "fresh" }))
      .mockResolvedValueOnce(jsonResponse(201, ROLE));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, isRolePreview: () => false });

    await client.createRole("org-1", BODY);

    const original = headersOf(fetchMock.mock.calls[0]);
    const retried = headersOf(fetchMock.mock.calls[2]);
    expect(fetchMock.mock.calls[1][0]).toBe("http://api.test/v1/auth/refresh");
    expect(retried.get(IDEMPOTENCY_KEY_HEADER)).toBe(original.get(IDEMPOTENCY_KEY_HEADER));
    expect(retried.get("Authorization")).toBe("Bearer fresh");
  });

  it("keeps the request id of a 409 STALE_VERSION and recognises it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(409, {
        code: "STALE_VERSION",
        message: "The record was changed by someone else. Reload and try again.",
        request_id: "req-409",
        field_errors: [],
      }),
    );
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, isRolePreview: () => false });

    const error = await client.updateRole("org-1", "r1", BODY).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "STALE_VERSION", requestId: "req-409" });
    expect(isStaleVersion(error)).toBe(true);
    expect(isStaleVersion(new ApiError(409, "DUPLICATE_ROLE", "x", "r"))).toBe(false);
  });

  it("falls back to the request id it sent when the server response has none", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("bad gateway", { status: 502 }));
    const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock, isRolePreview: () => false });

    const error = (await client.updateRole("org-1", "r1", BODY).catch((e: unknown) => e)) as ApiError;

    expect(error.requestId).toBe(headersOf(fetchMock.mock.calls[0]).get(REQUEST_ID_HEADER));
  });
});

describe("conflict and error display", () => {
  it("renders an inline reload banner with the request reference, not a dialog", () => {
    const markup = renderToStaticMarkup(<StaleVersionBanner requestId="req-409" onReload={() => undefined} />);

    expect(markup).toContain("Someone changed this.");
    expect(markup).toContain("Reload");
    expect(markup).toContain("Reference: req-409");
    expect(markup).toContain('role="status"');
    expect(markup).not.toContain('role="dialog"');
    expect(markup).not.toContain('role="alertdialog"');
  });

  it("shows the request id with every API error message", () => {
    expect(apiErrorMessage(new ApiError(409, "DUPLICATE_ROLE", "dup", "req-7"))).toBe(
      "A role with this name already exists. (Reference: req-7)",
    );
    expect(apiErrorMessage(new ApiError(0, "NETWORK_ERROR", "offline", ""))).toBe("offline");
  });
});
