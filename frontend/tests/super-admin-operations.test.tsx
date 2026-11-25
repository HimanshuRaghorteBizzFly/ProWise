import React from "react";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ApiError, IDEMPOTENCY_KEY_HEADER, createApiClient } from "../src/lib/api";
import { createOperationsApi } from "../src/lib/admin-api/operations";
import type {
  IntegrationSettings,
  OpsAccessRequest,
  OpsIncident,
  OpsMaintenanceWindow,
  OpsSupportTicket,
  SecurityOverview,
} from "../src/types/admin-operations";
import { STALE_VERSION_MESSAGE, toMutationNotice, MutationNotice } from "../src/components/super-admin/operations/shared";
import { IncidentsView } from "../src/components/super-admin/operations/IncidentsView";
import { SupportView } from "../src/components/super-admin/operations/SupportView";
import { AccessApprovalsView } from "../src/components/super-admin/operations/AccessApprovalsView";
import { MaintenanceView } from "../src/components/super-admin/operations/MaintenanceView";
import {
  GitHubRepositoriesView,
  IntegrationsOverviewView,
  WebhooksView,
} from "../src/components/super-admin/operations/IntegrationViews";
import { ApiMonitoringView } from "../src/components/super-admin/operations/ApiMonitoringView";
import {
  IntegrationSettingsView,
  buildSettingsUpdate,
  formFromSettings,
} from "../src/components/super-admin/operations/IntegrationSettingsView";
import { SecurityCenterView } from "../src/components/super-admin/operations/SecurityCenterView";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function ops(fetchMock: ReturnType<typeof vi.fn>) {
  return createOperationsApi(
    createApiClient({ baseUrl: "http://api.test", fetch: fetchMock as unknown as typeof fetch, onSessionExpired: () => {} }),
  );
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return {
    url: url as string,
    method: init.method as string,
    body: init.body ? JSON.parse(init.body as string) : undefined,
    headers: new Headers(init.headers),
  };
}

const noop = () => {};
const asyncTrue = async () => true;
const loading = { status: "loading" } as const;
const failed = { status: "error", message: "Cannot reach the ProWise server." } as const;
const empty = <T,>() => ({ status: "ready" as const, data: [] as T[] });

const STALE = { code: "STALE_VERSION", message: "stale", request_id: "r1", field_errors: [] };

/* ------------------------------------------------------------------ typed client */

describe("operations client", () => {
  it("lists with GET on the operator paths and drops ALL filters", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, [])));
    const api = ops(fetchMock);

    await api.incidents.list({ status: "ALL", severity: "SEV_1" });
    await api.tickets.list();
    await api.accessRequests.list("PENDING_APPROVAL");
    await api.integrations();
    await api.githubRepositories();
    await api.webhooks();
    await api.jobs();
    await api.maintenance.list();
    await api.alerts.list(false);
    await api.outbox.failed();
    await api.operators();

    const calls = fetchMock.mock.calls.map(([url, init]) => `${init.method} ${url}`);
    expect(calls).toEqual([
      "GET http://api.test/v1/operator/incidents?severity=SEV_1",
      "GET http://api.test/v1/operator/support/tickets",
      "GET http://api.test/v1/operator/support/access-requests?status=PENDING_APPROVAL",
      "GET http://api.test/v1/operator/integrations",
      "GET http://api.test/v1/operator/github/repositories",
      "GET http://api.test/v1/operator/webhooks",
      "GET http://api.test/v1/operator/jobs",
      "GET http://api.test/v1/operator/maintenance",
      "GET http://api.test/v1/operator/monitoring/alerts?acknowledged=false",
      "GET http://api.test/v1/operator/outbox/failed",
      "GET http://api.test/v1/operators",
    ]);
  });

  it("reads the security overview and integration settings from the admin endpoints", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    const api = ops(fetchMock);
    await api.security.overview();
    await api.integrationSettings.get();
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "http://api.test/v1/admin/security/overview",
      "http://api.test/v1/admin/integration-settings",
    ]);
  });

  it("sends expected_version on incident update, assign and resolve, with an Idempotency-Key", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    const api = ops(fetchMock);

    await api.incidents.update("inc-1", { status: "MONITORING" }, 3);
    let c = lastCall(fetchMock);
    expect(c.method).toBe("PATCH");
    expect(c.url).toBe("http://api.test/v1/operator/incidents/inc-1");
    expect(c.body).toEqual({ status: "MONITORING", expected_version: 3 });
    expect(c.headers.get(IDEMPOTENCY_KEY_HEADER)).toBeTruthy();

    await api.incidents.assign("inc-1", "op-7", "handover", 4);
    c = lastCall(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toBe("http://api.test/v1/operator/incidents/inc-1/assign");
    expect(c.body).toEqual({ assigned_to_operator_id: "op-7", notes: "handover", expected_version: 4 });

    await api.incidents.resolve("inc-1", { root_cause: "disk", mitigation_steps: "rotated" }, 5);
    c = lastCall(fetchMock);
    expect(c.url).toBe("http://api.test/v1/operator/incidents/inc-1/resolve");
    expect(c.body).toEqual({ root_cause: "disk", mitigation_steps: "rotated", expected_version: 5 });
  });

  it("creates an incident without a version and lists its assignment history", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    const api = ops(fetchMock);
    await api.incidents.create({ title: "API down", severity: "SEV_1", department_id: "site-reliability" });
    let c = lastCall(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toBe("http://api.test/v1/operator/incidents");
    expect(c.body).toEqual({ title: "API down", severity: "SEV_1", department_id: "site-reliability" });
    await api.incidents.assignments("inc-1");
    c = lastCall(fetchMock);
    expect(c.url).toBe("http://api.test/v1/operator/incidents/inc-1/assignments");
    expect(c.method).toBe("GET");
  });

  it("sends expected_version on ticket, access-request and maintenance changes", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    const api = ops(fetchMock);

    await api.tickets.update("t-1", { priority: "URGENT" }, 2);
    expect(lastCall(fetchMock)).toMatchObject({
      method: "PATCH",
      url: "http://api.test/v1/operator/support/tickets/t-1",
      body: { priority: "URGENT", expected_version: 2 },
    });
    await api.tickets.assign("t-1", "op-2", "", 3);
    expect(lastCall(fetchMock)).toMatchObject({
      method: "POST",
      url: "http://api.test/v1/operator/support/tickets/t-1/assign",
      body: { assigned_operator_id: "op-2", notes: "", expected_version: 3 },
    });
    await api.accessRequests.approve("ar-1", 1);
    expect(lastCall(fetchMock)).toMatchObject({
      method: "POST",
      url: "http://api.test/v1/operator/support/access-requests/ar-1/approve",
      body: { expected_version: 1 },
    });
    await api.accessRequests.reject("ar-2", 6);
    expect(lastCall(fetchMock)).toMatchObject({
      method: "POST",
      url: "http://api.test/v1/operator/support/access-requests/ar-2/reject",
      body: { expected_version: 6 },
    });
    await api.maintenance.update("m-1", { status: "COMPLETED" }, 9);
    expect(lastCall(fetchMock)).toMatchObject({
      method: "PATCH",
      url: "http://api.test/v1/operator/maintenance/m-1",
      body: { status: "COMPLETED", expected_version: 9 },
    });
    await api.maintenance.create({ title: "DB upgrade", scheduled_start: "2026-12-01T02:00:00.000Z", scheduled_end: "2026-12-01T03:00:00.000Z" });
    expect(lastCall(fetchMock)).toMatchObject({ method: "POST", url: "http://api.test/v1/operator/maintenance" });
  });

  it("puts integration settings with expected_version and no secret fields", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    const api = ops(fetchMock);
    const result = buildSettingsUpdate(formFromSettings(settings), settings.version);
    if (!("body" in result)) throw new Error("expected a valid body");
    await api.integrationSettings.update(result.body);
    const c = lastCall(fetchMock);
    expect(c.method).toBe("PUT");
    expect(c.url).toBe("http://api.test/v1/admin/integration-settings");
    expect(c.body).toEqual({
      github_app_slug: "prowise-app",
      github_client_id: "Iv1.abc",
      webhook_max_retries: 5,
      webhook_timeout_seconds: 10,
      webhook_signature_required: true,
      allowed_event_types: ["push", "pull_request"],
      expected_version: 7,
    });
    expect(Object.keys(c.body).some((k) => /secret|private|password|token/i.test(k))).toBe(false);
  });

  it("acknowledges alerts and retries outbox events with POST (202 with empty body is success)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: "al-1", acknowledged: true }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    const api = ops(fetchMock);
    await api.alerts.acknowledge("al-1");
    expect(lastCall(fetchMock)).toMatchObject({ method: "POST", url: "http://api.test/v1/operator/monitoring/alerts/al-1/ack" });
    await expect(api.outbox.retry("ev-1")).resolves.toBeUndefined();
    expect(lastCall(fetchMock)).toMatchObject({ method: "POST", url: "http://api.test/v1/operator/outbox/ev-1/retry" });
  });

  it("surfaces an outbox retry refusal as an ApiError", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { code: "NOT_FOUND", message: "Not found", request_id: "r" }));
    const error = await ops(fetchMock).outbox.retry("missing").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404 });
  });

  it("does not offer webhook or job retry (the server only relabels the record)", () => {
    const api = ops(vi.fn());
    expect(typeof api.webhooks).toBe("function");
    expect(typeof api.jobs).toBe("function");
    expect(Object.keys(api)).not.toContain("retryWebhook");
    expect(Object.keys(api)).not.toContain("retryJob");
  });

  it("turns 409 STALE_VERSION into the reload message, without retrying the write", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(409, STALE));
    const error = await ops(fetchMock)
      .incidents.update("inc-1", { title: "x" }, 1)
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 409, code: "STALE_VERSION" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toMutationNotice(error)).toEqual({ stale: true, message: STALE_VERSION_MESSAGE });
    expect(STALE_VERSION_MESSAGE).toBe("This record was changed by someone else. Reload to see the latest version.");

    const other = toMutationNotice(new ApiError(409, "CONFLICT", "Already resolved.", "r"));
    expect(other).toEqual({ stale: false, message: "Already resolved." });
  });

  it("renders the stale notice with a Reload button", () => {
    const markup = renderToStaticMarkup(
      <MutationNotice notice={{ stale: true, message: STALE_VERSION_MESSAGE }} onReload={noop} onDismiss={noop} />,
    );
    expect(markup).toContain(STALE_VERSION_MESSAGE);
    expect(markup).toContain("Reload");
  });
});

/* ------------------------------------------------------------------ fixtures */

const incident: OpsIncident = {
  id: "inc-1a2b",
  title: "Webhook ingestion delayed",
  severity: "SEV_1",
  status: "INVESTIGATING",
  department_id: "site-reliability",
  department_name: "Site Reliability",
  assigned_operator_id: null,
  assigned_operator_name: "Unassigned",
  description: "GitHub events arrive late.",
  root_cause: null,
  mitigation_steps: null,
  resolved_at: null,
  created_at: "2026-11-20T10:00:00Z",
  updated_at: "2026-11-20T10:00:00Z",
  version: 2,
};

const ticket: OpsSupportTicket = {
  id: "tkt-1",
  subject: "Cannot invite members",
  customer_name: "Ada",
  customer_email: "ada@example.test",
  department_id: "customer-communications",
  department_name: "Customer Communications",
  assigned_operator_id: null,
  assigned_operator_name: "Unassigned",
  priority: "URGENT",
  status: "OPEN",
  description: "Invite button fails",
  created_at: "2026-11-21T09:00:00Z",
  updated_at: "2026-11-21T09:00:00Z",
  version: 1,
};

const accessRequest: OpsAccessRequest = {
  id: "ar-1",
  ticket_id: "tkt-1",
  requester_email: "operator@example.test",
  org_id: "org-uuid-1",
  reason: "Reproduce invite failure",
  status: "PENDING_APPROVAL",
  approved_by: null,
  approved_at: null,
  expires_at: null,
  created_at: "2026-11-21T09:30:00Z",
  version: 0,
};

const maintenanceWindow: OpsMaintenanceWindow = {
  id: "maint-1",
  title: "Database minor upgrade",
  description: "Postgres 16.4",
  department_id: "site-reliability",
  status: "SCHEDULED",
  scheduled_start: "2026-12-01T02:00:00Z",
  scheduled_end: "2026-12-01T03:00:00Z",
  actual_start: null,
  actual_end: null,
  created_by: "op-main",
  created_at: "2026-11-22T00:00:00Z",
  updated_at: "2026-11-22T00:00:00Z",
  version: 4,
};

const settings: IntegrationSettings = {
  github_app_slug: "prowise-app",
  github_client_id: "Iv1.abc",
  webhook_max_retries: 5,
  webhook_timeout_seconds: 10,
  webhook_signature_required: true,
  allowed_event_types: ["push", "pull_request"],
  updated_at: "2026-11-23T00:00:00Z",
  updated_by: "admin@example.test",
  version: 7,
};

const overview: SecurityOverview = {
  failed_logins_24h: 3,
  failed_logins_7d: 11,
  locked_accounts: 1,
  users_must_change_password: 2,
  active_user_sessions: 4,
  active_operator_sessions: 1,
  super_admin_count: 2,
  operators_locked: 0,
  recent_failed_logins: [{ email_masked: "a***@example.test", ip_address: "203.0.113.5", at: "2026-11-24T08:00:00Z", reason: "BAD_PASSWORD" }],
};

const mutationProps = { busy: null, notice: null, onReload: noop, onDismissNotice: noop };

/* ------------------------------------------------------------------ views */

describe("operations views", () => {
  it("incidents: real rows and counts, error with Retry, and an empty state", () => {
    const base = {
      operators: empty<never>(),
      onRetry: noop,
      ...mutationProps,
      onCreate: asyncTrue,
      onUpdate: asyncTrue,
      onAssign: asyncTrue,
      onResolve: asyncTrue,
      assignments: null,
      onOpenIncident: noop,
      onRetryAssignments: noop,
    };
    const ready = renderToStaticMarkup(<IncidentsView {...base} incidents={{ status: "ready", data: [incident] }} />);
    expect(ready).toContain("Webhook ingestion delayed");
    expect(ready).toContain("inc-1a2b");
    expect(ready).toContain("Site Reliability");

    const error = renderToStaticMarkup(<IncidentsView {...base} incidents={failed} />);
    expect(error).toContain("Cannot reach the ProWise server.");
    expect(error).toContain("Retry");

    const none = renderToStaticMarkup(<IncidentsView {...base} incidents={empty<OpsIncident>()} />);
    expect(none).toContain("No incidents recorded");

    const busy = renderToStaticMarkup(<IncidentsView {...base} incidents={loading} />);
    expect(busy).toContain('aria-label="Loading"');
    expect(busy).not.toMatch(/>\s*\d+\s*</); // no counts invented while loading
  });

  it("support: lists tickets, shows the stale message with Reload", () => {
    const markup = renderToStaticMarkup(
      <SupportView
        tickets={{ status: "ready", data: [ticket] }}
        operators={empty()}
        onRetry={noop}
        {...mutationProps}
        notice={{ stale: true, message: STALE_VERSION_MESSAGE }}
        onUpdate={asyncTrue}
        onAssign={asyncTrue}
      />,
    );
    expect(markup).toContain("Cannot invite members");
    expect(markup).toContain(STALE_VERSION_MESSAGE);
    expect(markup).toContain("Reload");

    const none = renderToStaticMarkup(
      <SupportView tickets={empty()} operators={empty()} onRetry={noop} {...mutationProps} onUpdate={asyncTrue} onAssign={asyncTrue} />,
    );
    expect(none).toContain("No support tickets");
  });

  it("access approvals: pending requests offer Approve and Reject; org IDs resolve to names", () => {
    const markup = renderToStaticMarkup(
      <AccessApprovalsView
        requests={{ status: "ready", data: [accessRequest, { ...accessRequest, id: "ar-2", status: "REJECTED" }] }}
        orgName={(id) => (id === "org-uuid-1" ? "Acme Corp" : id)}
        onRetry={noop}
        {...mutationProps}
        onApprove={noop}
        onReject={noop}
      />,
    );
    expect(markup).toContain("Acme Corp");
    expect(markup.match(/Approve</g)?.length).toBe(1);
    expect(markup).toContain("Reject");

    const error = renderToStaticMarkup(
      <AccessApprovalsView requests={failed} orgName={(id) => id} onRetry={noop} {...mutationProps} onApprove={noop} onReject={noop} />,
    );
    expect(error).toContain("Retry");
  });

  it("maintenance: scheduled windows offer Start, Edit and Cancel; empty state otherwise", () => {
    const base = { onRetry: noop, ...mutationProps, onCreate: asyncTrue, onUpdate: asyncTrue };
    const markup = renderToStaticMarkup(<MaintenanceView {...base} windows={{ status: "ready", data: [maintenanceWindow] }} />);
    expect(markup).toContain("Database minor upgrade");
    expect(markup).toContain("Start");
    expect(markup).toContain("Cancel");
    expect(markup).not.toMatch(/emergency|banner/i);
    expect(renderToStaticMarkup(<MaintenanceView {...base} windows={empty()} />)).toContain("No maintenance windows");
  });

  it("integration overview and GitHub show empty server lists without a connect flow", () => {
    const overviewMarkup = renderToStaticMarkup(
      <IntegrationsOverviewView integrations={empty()} repositories={empty()} onRetryIntegrations={noop} onRetryRepositories={noop} />,
    );
    expect(overviewMarkup).toContain("No integrations installed");
    expect(overviewMarkup).toContain("No repositories linked");
    expect(overviewMarkup).not.toMatch(/Connect GitHub|Install App|Test Connection/i);

    const github = renderToStaticMarkup(<GitHubRepositoriesView repositories={failed} onRetry={noop} />);
    expect(github).toContain("Retry");
    expect(github).not.toMatch(/Pause sync|Sync now/i);
  });

  it("webhooks: receipts are read-only; failed outbound events offer Retry delivery", () => {
    const markup = renderToStaticMarkup(
      <WebhooksView
        receipts={{
          status: "ready",
          data: [{ id: "wh-1", webhook_id: "d-1", source: "GITHUB", event_type: "push", status: "FAILED", attempts: 2, error_message: "bad sig", payload: "SECRET-PAYLOAD", received_at: null, last_retry_at: null }],
        }}
        outbox={{
          status: "ready",
          data: [{ event_id: "ev-1", organization_id: null, aggregate_type: "project", event_type: "project.updated", attempts: 8, last_error: "timeout", failed_at: null }],
        }}
        onRetryReceipts={noop}
        onRetryOutboxList={noop}
        onRetryEvent={noop}
        {...mutationProps}
      />,
    );
    expect(markup).toContain("project.updated");
    expect(markup.match(/Retry delivery/g)?.length).toBe(1);
    expect(markup).not.toContain("SECRET-PAYLOAD");
  });

  it("API monitoring shows no invented traffic figures", () => {
    const markup = renderToStaticMarkup(
      <ApiMonitoringView
        stats={{ status: "ready", data: { unacknowledgedAlerts: 2, failedJobs: 0, openIncidents: 1, pendingWebhooks: 0 } }}
        alerts={empty()}
        jobs={empty()}
        onRetryStats={noop}
        onRetryAlerts={noop}
        onRetryJobs={noop}
        onAcknowledge={noop}
        {...mutationProps}
      />,
    );
    expect(markup).toContain("No operational alerts");
    expect(markup).not.toMatch(/req\/s|p99|99\.98|98\.45|ms</);
  });

  it("integration settings: no secret or password inputs, and range validation", () => {
    const markup = renderToStaticMarkup(
      <IntegrationSettingsView settings={{ status: "ready", data: settings }} onRetry={noop} onSave={asyncTrue} saving={false} {...mutationProps} />,
    );
    expect(markup).toContain("prowise-app");
    expect(markup).not.toMatch(/type="password"/);
    const labels = [...markup.matchAll(/<label[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(labels.some((l) => /secret|private key|token/i.test(l))).toBe(false);

    const bad = buildSettingsUpdate({ ...formFromSettings(settings), webhookMaxRetries: "21", webhookTimeoutSeconds: "0" }, 7);
    expect("errors" in bad && Object.keys(bad.errors).sort()).toEqual(["webhookMaxRetries", "webhookTimeoutSeconds"]);
  });

  it("security center shows the server overview and no MFA or policy toggles", () => {
    const markup = renderToStaticMarkup(<SecurityCenterView overview={{ status: "ready", data: overview }} onRetry={noop} />);
    expect(markup).toContain("a***@example.test");
    expect(markup).toContain("203.0.113.5");
    expect(markup).not.toMatch(/MFA Coverage|IP allowlist|Rotate|Enabled<|Disabled</i);
    // No settings controls: the only form control allowed is the table pager (Rows per page).
    expect(markup).not.toMatch(/<input/i);
    expect(markup.match(/<select/gi) ?? []).toHaveLength(1);
    expect(markup).toMatch(/aria-label="Rows per page"/);

    const error = renderToStaticMarkup(<SecurityCenterView overview={failed} onRetry={noop} />);
    expect(error).toContain("Retry");
  });
});

/* ------------------------------------------------------------------ source guards */

describe("operations pages read only the server", () => {
  const root = resolve(__dirname, "../src");
  const pages = [
    "integrations",
    "github-integrations",
    "webhooks",
    "api-monitoring",
    "integration-settings",
    "security",
    "access-approvals",
    "incidents",
    "support",
    "maintenance",
  ].map((p) => join(root, "app/(platform)/super-admin", p, "page.tsx"));
  const views = [
    "shared.tsx",
    "IncidentsView.tsx",
    "SupportView.tsx",
    "AccessApprovalsView.tsx",
    "MaintenanceView.tsx",
    "IntegrationViews.tsx",
    "ApiMonitoringView.tsx",
    "IntegrationSettingsView.tsx",
    "SecurityCenterView.tsx",
  ].map((f) => join(root, "components/super-admin/operations", f));

  it("import no local store, seed data or simulated request helper", () => {
    for (const file of [...pages, ...views, join(root, "lib/admin-api/operations.ts")]) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/useSuperAdminStore|_store\/|_data\/seed|maintenance-store|usePlatformOperatorStore|withSimulatedRequest|SimulationNotice/);
    }
  });

  it("each page loads through the operations client", () => {
    for (const file of pages) {
      expect(readFileSync(file, "utf8"), file).toContain("@/lib/admin-api/operations");
    }
  });
});
