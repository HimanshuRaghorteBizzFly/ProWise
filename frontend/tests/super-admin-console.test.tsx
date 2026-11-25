import React from "react";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ApiError, IDEMPOTENCY_KEY_HEADER, createApiClient, queryString } from "../src/lib/api";
import type { SmtpSettingsResponse } from "../src/lib/api";
import type { AdminAuditLog, AdminOrganization, PlatformKeysResponse } from "../src/types/admin";
import { PlatformKeysView, displayedKeyValue } from "../src/components/super-admin/PlatformKeysView";
import { AuditLogView, EMPTY_AUDIT_FILTERS, auditQueryFromFilters } from "../src/components/super-admin/AuditLogView";
import { OrganizationsView } from "../src/components/super-admin/OrganizationsView";
import { OperatorsView, operatorActions } from "../src/components/super-admin/OperatorsView";
import { AdminListView } from "../src/components/super-admin/AdminListView";
import { BillingDormantNotice, type ResourceState } from "../src/components/super-admin/admin-resource";
import { planColumns } from "../src/components/super-admin/resource-columns";
import { isLiveSuperAdminRoute } from "../src/app/(platform)/super-admin/_services/live-routes";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function client(fetchMock: ReturnType<typeof vi.fn>) {
  return createApiClient({ baseUrl: "http://api.test", fetch: fetchMock as unknown as typeof fetch, onSessionExpired: () => {} });
}

const noop = () => {};

/* ------------------------------------------------------------------ typed client */

describe("Super Admin typed client", () => {
  it("reads platform keys with GET and offers no write or generate call", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { keys: [] }));
    const api = client(fetchMock);

    await api.platformKeys.get();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://api.test/v1/admin/platform-keys");
    expect(init.method).toBe("GET");
    expect(Object.keys(api.platformKeys)).toEqual(["get"]);
  });

  it("sends audit filters as the backend's query names and drops ALL / empty values", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, []));
    const api = client(fetchMock);

    await api.admin.auditLogs.list(
      auditQueryFromFilters({ category: "SECURITY", severity: "ALL", search: " login ", from: "2026-11-01", to: "2026-11-24" }),
    );

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/v1/admin/audit-logs");
    expect(url.searchParams.get("category")).toBe("SECURITY");
    expect(url.searchParams.has("severity")).toBe(false);
    expect(url.searchParams.get("search")).toBe("login");
    expect(url.searchParams.get("fromDate")).toBe("2026-11-01T00:00:00Z");
    expect(url.searchParams.get("toDate")).toBe("2026-11-24T23:59:59Z");
  });

  it("builds no query string when every filter is unset", () => {
    expect(queryString({ status: "ALL", search: "", planId: undefined })).toBe("");
    expect(queryString({ status: "ACTIVE" })).toBe("?status=ACTIVE");
  });

  it("calls the organization list, summary and detail endpoints", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    const api = client(fetchMock);

    await api.admin.organizations.list({ status: "SUSPENDED", search: "acme" });
    await api.admin.organizations.summary();
    await api.admin.organizations.get("0b0e-1");

    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      "http://api.test/v1/admin/organizations?status=SUSPENDED&search=acme",
      "http://api.test/v1/admin/organizations/summary",
      "http://api.test/v1/admin/organizations/0b0e-1",
    ]);
  });

  it("turns a foreign or unknown organization ID (404) into an ApiError without inventing a record", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { code: "NOT_FOUND", message: "Not found", request_id: "r1" }));
    const error = await client(fetchMock)
      .admin.organizations.get("missing")
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: "NOT_FOUND" });
  });

  it("sends operator status changes as PATCH with the caller's Idempotency-Key, reused on retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { code: "UNAVAILABLE", message: "down", request_id: "r" }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "op-1", status: "SUSPENDED" }));
    const api = client(fetchMock);

    await api.admin.operators.setStatus("op-1", "SUSPENDED", "key-123").catch(() => null);
    await api.admin.operators.setStatus("op-1", "SUSPENDED", "key-123");

    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe("http://api.test/v1/admin/operators/op-1/status");
      expect(init.method).toBe("PATCH");
      expect(JSON.parse(init.body)).toEqual({ status: "SUSPENDED" });
      expect(new Headers(init.headers).get(IDEMPOTENCY_KEY_HEADER)).toBe("key-123");
    }
  });

  it("lists billing records from the dormant billing endpoints", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, [])));
    const api = client(fetchMock);
    await api.admin.plans.list();
    await api.admin.subscriptions.list({ status: "ACTIVE" });
    await api.admin.invoices.list({ status: "OVERDUE" });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "http://api.test/v1/admin/plans",
      "http://api.test/v1/admin/subscriptions?status=ACTIVE",
      "http://api.test/v1/admin/invoices?status=OVERDUE",
    ]);
  });
});

/* ------------------------------------------------------------------ security keys page */

const smtpReady: ResourceState<SmtpSettingsResponse> = {
  status: "ready",
  data: {
    provider: "SMTP_CUSTOM",
    host: "smtp.example.test",
    port: 587,
    encryption: "TLS",
    username: "mailer",
    credentials_configured: true,
    password_source: "DATABASE",
    password_updated_at: null,
    encryption_key_configured: true,
    settings_source: "DATABASE",
    from_name: "",
    from_email: "",
    reply_to_email: "",
    rate_limit_per_minute: 0,
    retry_attempts: 0,
    retry_wait_seconds: 0,
    connection_status: "CONNECTED",
    last_tested_at: null,
    last_test_message: null,
    problem: null,
    updated_by: null,
    updated_at: null,
    version: 1,
  },
};

const keysReady: ResourceState<PlatformKeysResponse> = {
  status: "ready",
  data: {
    keys: [
      // A misbehaving server that leaks a secret value must still not get it rendered.
      { key: "JWT_SIGNING_KEY", category: "Auth", purpose: "Signs tokens", secret: true, required: true, configured: true, value: "LEAKED-SECRET-VALUE" },
      { key: "DB_PASSWORD", category: "Database", purpose: "DB password", secret: true, required: true, configured: false, value: null },
      { key: "SMTP_PORT", category: "SMTP", purpose: "Port", secret: false, required: false, configured: true, value: "587" },
    ],
  },
};

describe("Platform keys page", () => {
  const markup = renderToStaticMarkup(
    <PlatformKeysView keys={keysReady} smtp={smtpReady} removedLegacy={false} onRetryKeys={noop} onRetrySmtp={noop} />,
  );

  it("never renders a secret value, even when the server sends one", () => {
    expect(markup).not.toContain("LEAKED-SECRET-VALUE");
    expect(displayedKeyValue(keysReady.status === "ready" ? keysReady.data.keys[0] : (null as never))).toBe("");
    expect(markup).toContain("Secret (not shown)");
  });

  it("has no inputs, edit, save or generate controls", () => {
    expect(markup).not.toMatch(/<input|<textarea|<select|<form/i);
    const buttonLabels = Array.from(markup.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)).map((m) =>
      m[1].replace(/<[^>]+>/g, "").trim(),
    );
    expect(buttonLabels).toEqual(["Refresh", "SMTP Email"]);
  });

  it("shows configured / missing status and the value of non-secret settings only", () => {
    expect(markup).toContain("JWT_SIGNING_KEY");
    expect(markup).toContain("Configured");
    expect(markup).toContain("Missing");
    expect(markup).toContain(">587<");
    expect(markup).toContain("1 required setting is missing.");
  });

  it("shows the live SMTP status card", () => {
    expect(markup).toContain("Outgoing email (live)");
    expect(markup).toContain("smtp.example.test");
    expect(markup).toContain("CONNECTED");
  });

  it("shows an error with Retry when the keys cannot be loaded", () => {
    const error = renderToStaticMarkup(
      <PlatformKeysView
        keys={{ status: "error", message: "You do not have permission to view this." }}
        smtp={{ status: "error", message: "SMTP down" }}
        removedLegacy
        onRetryKeys={noop}
        onRetrySmtp={noop}
      />,
    );
    expect(error).toContain("You do not have permission to view this.");
    expect(error).toContain("Retry");
    expect(error).toContain("SMTP down");
    expect(error).toContain("earlier version of this page were deleted");
  });

  it("never writes to browser storage (no localStorage.setItem in the page or view)", () => {
    const page = readFileSync(resolve(__dirname, "../src/app/(platform)/super-admin/security-keys/page.tsx"), "utf8");
    const view = readFileSync(resolve(__dirname, "../src/components/super-admin/PlatformKeysView.tsx"), "utf8");
    expect(page + view).not.toMatch(/localStorage\.setItem|sessionStorage\.setItem/);
    expect(page).toContain("prowise_platform_secrets");
    expect(page).toContain("prowise_smtp_password");
  });
});

/* ------------------------------------------------------------------ audit log page */

const auditRows: AdminAuditLog[] = [
  {
    id: "a1",
    category: "SECURITY",
    action: "OPERATOR_SUSPENDED",
    summary: "Suspended an operator",
    actor_name: "Platform Admin",
    actor_email: "admin@example.test",
    target_label: "op@example.test",
    severity: "WARNING",
    timestamp: "2026-11-24T10:00:00Z",
  },
];

function renderAudit(state: ResourceState<AdminAuditLog[]>, filters = EMPTY_AUDIT_FILTERS) {
  return renderToStaticMarkup(
    <AuditLogView state={state} filters={filters} categories={["SECURITY"]} onFiltersChange={noop} onRetry={noop} />,
  );
}

describe("Audit log page", () => {
  it("shows the empty state when the server has no events", () => {
    const markup = renderAudit({ status: "ready", data: [] });
    expect(markup).toContain("No audit events yet");
    expect(markup).not.toContain("<table");
  });

  it("shows a filter-specific empty state when filters exclude everything", () => {
    const markup = renderAudit({ status: "ready", data: [] }, { ...EMPTY_AUDIT_FILTERS, severity: "CRITICAL" });
    expect(markup).toContain("No events match these filters");
  });

  it("shows the error with a Retry button and no rows", () => {
    const markup = renderAudit({ status: "error", message: "Cannot reach the ProWise server." });
    expect(markup).toContain("Cannot reach the ProWise server.");
    expect(markup).toContain("Retry");
    expect(markup).not.toContain("<table");
  });

  it("shows a loading state without sample rows", () => {
    const markup = renderAudit({ status: "loading" });
    expect(markup).toContain('aria-label="Loading"');
    expect(markup).not.toContain("<table");
  });

  it("renders server rows", () => {
    const markup = renderAudit({ status: "ready", data: auditRows });
    expect(markup).toContain("OPERATOR_SUSPENDED");
    expect(markup).toContain("Suspended an operator");
    expect(markup).toContain("admin@example.test");
  });
});

/* ------------------------------------------------------------------ organizations, operators, billing */

describe("Organizations page", () => {
  const org: AdminOrganization = {
    id: "o1",
    name: "Northwind",
    slug: "northwind",
    domain: null,
    industry: null,
    country: null,
    timezone: "UTC",
    owner_name: "Owner",
    owner_email: "owner@northwind.test",
    status: "ACTIVE",
    plan_id: "plan-team",
    seats_used: 3,
    seats_limit: 10,
    projects_count: 2,
    storage_used_gb: 0,
    mrr: null,
    created_at: "2026-11-01T00:00:00Z",
    last_activity_at: null,
    suspended_reason: null,
    notes: null,
  };
  const base = {
    search: "",
    status: "ALL",
    onSearchChange: noop,
    onStatusChange: noop,
    onRetry: noop,
    onOpen: noop,
    detail: null,
    onCloseDetail: noop,
    onRetryDetail: noop,
  };

  it("renders rows and summary from the server", () => {
    const markup = renderToStaticMarkup(
      <OrganizationsView
        {...base}
        state={{ status: "ready", data: [org] }}
        summary={{ status: "ready", data: { total_orgs: 1, active_orgs: 1, trial_orgs: 0, suspended_orgs: 0, total_mrr: null } }}
      />,
    );
    expect(markup).toContain("Northwind");
    expect(markup).toContain("3 / 10");
  });

  it("shows error with Retry and dashes for an unavailable summary", () => {
    const markup = renderToStaticMarkup(
      <OrganizationsView {...base} state={{ status: "error", message: "boom" }} summary={{ status: "error", message: "nope" }} />,
    );
    expect(markup).toContain("boom");
    expect(markup).toContain("Retry");
    expect(markup).toContain("Summary unavailable: nope");
  });
});

describe("Operators page", () => {
  it("offers only the actions the backend supports for each status", () => {
    const op = {
      id: "op-1",
      name: "Op",
      email: "op@example.test",
      role_id: null,
      access_level: null,
      department: null,
      status: "INVITED",
      mfa_enabled: false,
      on_call: false,
      shift_name: null,
      active_sessions_count: 0,
      total_permissions_count: 0,
      last_active_at: null,
      created_at: "2026-11-01T00:00:00Z",
    };
    expect(operatorActions(op)).toEqual(["resend-invite"]);
    expect(operatorActions({ ...op, status: "ACTIVE", active_sessions_count: 2 })).toEqual(["suspend", "revoke-sessions"]);
    expect(operatorActions({ ...op, status: "SUSPENDED" })).toEqual(["activate"]);
  });

  it("shows the empty state with no invented operators", () => {
    const markup = renderToStaticMarkup(
      <OperatorsView
        state={{ status: "ready", data: [] }}
        search=""
        status="ALL"
        onSearchChange={noop}
        onStatusChange={noop}
        onRetry={noop}
        selected={null}
        permissions={null}
        onOpen={noop}
        onClose={noop}
        onRetryPermissions={noop}
        onAction={noop}
        busy={false}
      />,
    );
    expect(markup).toContain("No platform operators yet");
    expect(markup).not.toContain("Platform Director");
  });
});

describe("Billing pages", () => {
  it("are labelled dormant and render stored records read-only", () => {
    const markup = renderToStaticMarkup(
      <AdminListView
        title="Plans"
        description="Plans"
        notice={<BillingDormantNotice />}
        state={{
          status: "ready",
          data: [
            {
              id: "p1",
              code: "TEAM",
              name: "Team",
              tagline: null,
              monthly_price: 10,
              annual_price: 100,
              currency: "USD",
              status: "ACTIVE",
              badge_label: null,
              brand_color: null,
              ai_token_quota: null,
              trial_days: 14,
              limits: null,
              features: null,
              created_at: null,
              updated_at: null,
            },
          ],
        }}
        columns={planColumns}
        rowKey={(p) => p.id}
        onRetry={noop}
        emptyTitle="No plans"
        emptyDescription="none"
      />,
    );
    expect(markup).toContain("Billing is dormant");
    expect(markup).toContain("TEAM");
    expect(markup).not.toMatch(/<input|<select/i);
  });
});

/* ------------------------------------------------------------------ menu and mock regression guards */

describe("Super Admin live routes", () => {
  it("lists wired modules and keeps the unwired ones hidden", () => {
    for (const live of [
      "/super-admin/organizations", "/super-admin/audit", "/super-admin/operators", "/super-admin/security-keys/",
      "/super-admin/payments", "/super-admin/support", "/super-admin/webhooks", "/super-admin/reports",
    ]) {
      expect(isLiveSuperAdminRoute(live)).toBe(true);
    }
    for (const hidden of ["/super-admin/configuration/maintenance", "/super-admin/not-a-module"]) {
      expect(isLiveSuperAdminRoute(hidden)).toBe(false);
    }
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("no mock backend or hardcoded credentials in the frontend", () => {
  const src = resolve(__dirname, "../src");

  it("has no Next.js route handlers shadowing the /api/v1 proxy to the backend", () => {
    expect(existsSync(join(src, "app/api"))).toBe(false);
    const handlers = walk(join(src, "app")).filter((f) => /[\\/]route\.(t|j)sx?$/.test(f));
    expect(handlers).toEqual([]);
  });

  it("contains no hardcoded sign-in credentials", () => {
    const offenders = walk(src)
      .filter((f) => /\.(t|j)sx?$/.test(f))
      .filter((f) => /SuperAdmin2026|Operator2026|live-session-token|master-session/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
