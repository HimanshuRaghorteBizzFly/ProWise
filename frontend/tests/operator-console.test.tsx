import React from "react";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ module mocks */

const { fixtures } = vi.hoisted(() => ({
  fixtures: {} as Record<string, unknown>,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/platform-operator",
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * Pages load through `useOperatorResource` (= useAdminResource). The mock answers each resource by the part of its key
 * before ":" so a page can be rendered loading, failed, empty or with server rows without a network.
 */
vi.mock("@/components/super-admin/admin-resource", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/super-admin/admin-resource")>();
  return {
    ...actual,
    useAdminResource: (_loader: unknown, key: string) => ({
      state: fixtures[key.split(":")[0]] ?? { status: "loading" },
      reload: async () => {},
    }),
  };
});

import { ApiError, IDEMPOTENCY_KEY_HEADER, REQUEST_ID_HEADER, isStaleVersion } from "../src/lib/api";
import {
  createOperatorConsoleApi,
  createOperatorTransport,
} from "../src/app/(platform)/platform-operator/_services/operator-api";
import {
  MutationNotice,
  NotAvailableButton,
  OperatorResourceStatus,
  STALE_VERSION_MESSAGE,
  toMutationNotice,
} from "../src/app/(platform)/platform-operator/_components/OperatorLive";
import { useAuthStore } from "../src/store/auth-store";

import DashboardPage from "../src/app/(platform)/platform-operator/page";
import IncidentsPage from "../src/app/(platform)/platform-operator/incidents/page";
import SupportTicketsPage from "../src/app/(platform)/platform-operator/support-tickets/page";
import AccessRequestsPage from "../src/app/(platform)/platform-operator/access-requests/page";
import MaintenancePage from "../src/app/(platform)/platform-operator/maintenance/page";
import MonitoringPage from "../src/app/(platform)/platform-operator/monitoring/page";
import AlertsPage from "../src/app/(platform)/platform-operator/alerts/page";
import WebhookLogsPage from "../src/app/(platform)/platform-operator/webhook-logs/page";
import SyncJobsPage from "../src/app/(platform)/platform-operator/sync-jobs/page";
import EmailDeliveryPage from "../src/app/(platform)/platform-operator/email-delivery/page";
import IntegrationHealthPage from "../src/app/(platform)/platform-operator/integration-health/page";
import GitHubMonitoringPage from "../src/app/(platform)/platform-operator/github-monitoring/page";
import FailedEventsPage from "../src/app/(platform)/platform-operator/failed-events/page";
import SettingsPage from "../src/app/(platform)/platform-operator/settings/page";

/* ------------------------------------------------------------------ helpers */

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function client(fetchMock: ReturnType<typeof vi.fn>, session = { getToken: () => "op-token", refresh: vi.fn(async () => {}) }) {
  return createOperatorConsoleApi(
    createOperatorTransport({ baseUrl: "http://api.test", fetch: fetchMock as unknown as typeof fetch, session }),
  );
}

function call(fetchMock: ReturnType<typeof vi.fn>, index = fetchMock.mock.calls.length - 1) {
  const [url, init] = fetchMock.mock.calls[index];
  return {
    url: url as string,
    method: init.method as string,
    body: init.body ? JSON.parse(init.body as string) : undefined,
    headers: new Headers(init.headers),
    credentials: init.credentials as string,
  };
}

const STALE = { code: "STALE_VERSION", message: "stale", request_id: "r-stale", field_errors: [] };
const ready = <T,>(data: T) => ({ status: "ready" as const, data });
const render = (el: React.ReactElement) => renderToStaticMarkup(el);
const countNotAvailable = (html: string) => (html.match(/data-not-available="true"/g) ?? []).length;

function setFixtures(values: Record<string, unknown>) {
  for (const k of Object.keys(fixtures)) delete fixtures[k];
  Object.assign(fixtures, values);
}

const INCIDENT = {
  id: "inc-1a2b3c4d",
  title: "Webhook ingestion lag",
  severity: "SEV_2",
  status: "INVESTIGATING",
  department_id: "site-reliability",
  department_name: "Site Reliability",
  assigned_operator_id: "op-1",
  assigned_operator_name: "Dana Ops",
  description: "Queue lag above threshold",
  root_cause: null,
  mitigation_steps: null,
  resolved_at: null,
  created_at: "2026-11-20T10:00:00Z",
  updated_at: "2026-11-20T11:00:00Z",
  version: 4,
};
const TICKET = {
  id: "tkt-77",
  subject: "Cannot connect GitHub",
  customer_name: "Acme Corp",
  customer_email: "ops@acme.test",
  department_id: "customer-communications",
  department_name: "Customer Communications",
  assigned_operator_id: null,
  assigned_operator_name: "Unassigned",
  priority: "HIGH",
  status: "OPEN",
  description: "OAuth callback fails",
  created_at: "2026-11-21T09:00:00Z",
  updated_at: "2026-11-21T09:00:00Z",
  version: 2,
};
const ACCESS = {
  id: "acc-9",
  ticket_id: "tkt-77",
  requester_email: "dana@prowise.test",
  org_id: "6f1c0000-0000-0000-0000-000000000001",
  reason: "Inspect sync failure",
  status: "PENDING_APPROVAL",
  approved_by: null,
  approved_at: null,
  expires_at: null,
  created_at: "2026-11-22T09:00:00Z",
  version: 1,
};
const MAINT = {
  id: "maint-5",
  title: "Database minor upgrade",
  description: "Postgres 16.4",
  department_id: "site-reliability",
  status: "SCHEDULED",
  scheduled_start: "2026-11-30T02:00:00Z",
  scheduled_end: "2026-11-30T03:00:00Z",
  actual_start: null,
  actual_end: null,
  created_by: "op-1",
  created_at: "2026-11-22T09:00:00Z",
  updated_at: "2026-11-22T09:00:00Z",
  version: 3,
};
const ALERT = {
  id: "al-1",
  severity: "CRITICAL",
  title: "Outbox backlog growing",
  message: "More than 100 pending events",
  source_module: "outbox",
  department_id: "site-reliability",
  acknowledged: false,
  acknowledged_by: null,
  created_at: "2026-11-23T08:00:00Z",
};
const WEBHOOK = {
  id: "wh-1",
  webhook_id: "gh-delivery-42",
  source: "GITHUB",
  event_type: "push",
  status: "FAILED",
  attempts: 3,
  error_message: "Signature mismatch",
  payload: "SECRET-PAYLOAD-SHOULD-NOT-RENDER",
  received_at: "2026-11-23T08:00:00Z",
  last_retry_at: null,
};
const JOB = {
  id: "job-1",
  job_name: "github-repo-sync",
  queue_name: "github",
  status: "FAILED",
  attempts: 3,
  max_attempts: 3,
  error_details: "Rate limited",
  scheduled_at: "2026-11-23T08:00:00Z",
  started_at: null,
  completed_at: null,
  created_at: "2026-11-23T08:00:00Z",
};
const INTEGRATION = {
  id: "int-gh",
  name: "GitHub App",
  type: "GITHUB",
  status: "ACTIVE",
  health: "DEGRADED",
  last_synced_at: "2026-11-23T08:00:00Z",
  error_count: 7,
  config_json: "{\"private_key\":\"SECRET-CONFIG\"}",
  created_at: null,
  updated_at: null,
};
const REPO = {
  id: "repo-1",
  repo_full_name: "acme/payments-api",
  installation_id: "int-gh",
  default_branch: "main",
  webhook_active: false,
  last_event_at: "2026-11-23T08:00:00Z",
  created_at: null,
};
const FAILED_EVENT = {
  event_id: "9b2f6c1e-0000-0000-0000-000000000001",
  organization_id: null,
  aggregate_type: "work_item",
  event_type: "work_item.approved",
  attempts: 8,
  last_error: "Consumer timeout",
  failed_at: "2026-11-23T08:00:00Z",
};
const EMAIL = {
  id: "em-1",
  recipient: "new.user@acme.test",
  subject: "Set up your ProWise account",
  provider: "smtp",
  status: "FAILED",
  attempts: 1,
  error_code: "SMTP_421",
  error_message: "Service not available",
  sent_at: null,
  created_at: "2026-11-23T08:00:00Z",
};
const ME = {
  id: "op-1",
  name: "Dana Ops",
  email: "dana@prowise.test",
  role_id: "role-platform-operator",
  access_level: "MAIN_PLATFORM_OPERATOR",
  department: "platform-operations",
  status: "ACTIVE",
  mfa_enabled: true,
  on_call: true,
  shift_name: "EMEA",
  active_sessions_count: 2,
  total_permissions_count: 40,
  last_active_at: "2026-11-23T08:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  version: 1,
};

beforeEach(() => {
  useAuthStore.setState({ currentRole: "PLATFORM_OPERATOR" } as never);
  setFixtures({});
});

/* ------------------------------------------------------------------ typed client */

describe("operator console client", () => {
  it("reads the operator endpoints with GET, the operator bearer token and cookies", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, [])));
    const api = client(fetchMock);

    await api.incidents.list({ status: "ALL" });
    await api.tickets.list();
    await api.accessRequests.list();
    await api.maintenance.list();
    await api.alerts.list();
    await api.webhooks();
    await api.jobs();
    await api.integrations();
    await api.githubRepositories();
    await api.outbox.failed();
    await api.emailDelivery.list("FAILED");
    await api.teamWorkload();
    await api.departments();

    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toEqual([
      "http://api.test/v1/operator/incidents",
      "http://api.test/v1/operator/support/tickets",
      "http://api.test/v1/operator/support/access-requests",
      "http://api.test/v1/operator/maintenance",
      "http://api.test/v1/operator/monitoring/alerts",
      "http://api.test/v1/operator/webhooks",
      "http://api.test/v1/operator/jobs",
      "http://api.test/v1/operator/integrations",
      "http://api.test/v1/operator/github/repositories",
      "http://api.test/v1/operator/outbox/failed",
      "http://api.test/v1/operator/email/delivery?status=FAILED",
      "http://api.test/v1/operator/team/workload",
      "http://api.test/v1/departments",
    ]);
    const first = call(fetchMock, 0);
    expect(first.method).toBe("GET");
    expect(first.credentials).toBe("include");
    expect(first.headers.get("Authorization")).toBe("Bearer op-token");
    expect(first.headers.get(REQUEST_ID_HEADER)).toBeTruthy();
    expect(first.headers.get(IDEMPOTENCY_KEY_HEADER)).toBeNull();
  });

  it("reads me, dashboard and stats", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    const api = client(fetchMock);
    await api.me();
    await api.myPermissions();
    await api.dashboard();
    await api.dashboardStats();
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "http://api.test/v1/operator/me",
      "http://api.test/v1/operator/me/permissions",
      "http://api.test/v1/operator/dashboard",
      "http://api.test/v1/operator/dashboard/stats",
    ]);
  });

  it("sends expected_version on every versioned change and an Idempotency-Key on every mutation", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    const api = client(fetchMock);

    await api.incidents.update("inc-1", { status: "MONITORING" }, 4);
    expect(call(fetchMock)).toMatchObject({
      url: "http://api.test/v1/operator/incidents/inc-1",
      method: "PATCH",
      body: { status: "MONITORING", expected_version: 4 },
    });

    await api.incidents.assign("inc-1", "op-2", "handover", 5);
    expect(call(fetchMock)).toMatchObject({
      url: "http://api.test/v1/operator/incidents/inc-1/assign",
      method: "POST",
      body: { assigned_to_operator_id: "op-2", notes: "handover", expected_version: 5 },
    });

    await api.incidents.resolve("inc-1", { root_cause: "rc", mitigation_steps: "ms" }, 6);
    expect(call(fetchMock)).toMatchObject({
      url: "http://api.test/v1/operator/incidents/inc-1/resolve",
      body: { root_cause: "rc", mitigation_steps: "ms", expected_version: 6 },
    });

    await api.tickets.update("tkt-1", { priority: "URGENT" }, 2);
    expect(call(fetchMock)).toMatchObject({
      url: "http://api.test/v1/operator/support/tickets/tkt-1",
      method: "PATCH",
      body: { priority: "URGENT", expected_version: 2 },
    });

    await api.tickets.assign("tkt-1", "op-3", "", 3);
    expect(call(fetchMock)).toMatchObject({
      url: "http://api.test/v1/operator/support/tickets/tkt-1/assign",
      body: { assigned_operator_id: "op-3", expected_version: 3 },
    });

    await api.accessRequests.approve("acc-1", 1);
    expect(call(fetchMock)).toMatchObject({
      url: "http://api.test/v1/operator/support/access-requests/acc-1/approve",
      method: "POST",
      body: { expected_version: 1 },
    });
    await api.accessRequests.reject("acc-1", 2);
    expect(call(fetchMock)).toMatchObject({
      url: "http://api.test/v1/operator/support/access-requests/acc-1/reject",
      body: { expected_version: 2 },
    });

    await api.maintenance.update("maint-1", { status: "IN_PROGRESS" }, 7);
    expect(call(fetchMock)).toMatchObject({
      url: "http://api.test/v1/operator/maintenance/maint-1",
      method: "PATCH",
      body: { status: "IN_PROGRESS", expected_version: 7 },
    });

    for (let i = 0; i < fetchMock.mock.calls.length; i++) {
      expect(call(fetchMock, i).headers.get(IDEMPOTENCY_KEY_HEADER)).toBeTruthy();
    }
  });

  it("creates incidents and maintenance windows without a version", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(201, {})));
    const api = client(fetchMock);
    await api.incidents.create({ title: "t", severity: "SEV_3", description: "d" });
    expect(call(fetchMock)).toMatchObject({ url: "http://api.test/v1/operator/incidents", method: "POST" });
    expect(call(fetchMock).body).not.toHaveProperty("expected_version");

    await api.maintenance.create({
      title: "w",
      scheduled_start: "2026-11-30T02:00:00.000Z",
      scheduled_end: "2026-11-30T03:00:00.000Z",
    });
    expect(call(fetchMock)).toMatchObject({ url: "http://api.test/v1/operator/maintenance", method: "POST" });
    expect(call(fetchMock).body).not.toHaveProperty("expected_version");
  });

  it("turns 409 STALE_VERSION into the stale notice and never retries it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(409, STALE));
    const api = client(fetchMock);

    const error = await api.incidents.update("inc-1", { status: "RESOLVED" }, 1).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(isStaleVersion(error)).toBe(true);
    expect(error.requestId).toBe("r-stale");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(toMutationNotice(error)).toEqual({ stale: true, message: STALE_VERSION_MESSAGE });
    expect(STALE_VERSION_MESSAGE).toBe("This record was changed by someone else. Reload to see the latest version.");
  });

  it("keeps the standard error shape (code, message, request_id, field_errors)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        code: "VALIDATION_FAILED",
        message: "Title is required.",
        request_id: "r-400",
        field_errors: [{ field: "title", message: "required" }],
      }),
    );
    const error = await client(fetchMock).incidents.create({ title: "", severity: "SEV_1" }).catch((e) => e);
    expect(error).toMatchObject({ status: 400, code: "VALIDATION_FAILED", message: "Title is required.", requestId: "r-400" });
    expect(error.fieldErrors).toEqual([{ field: "title", message: "required" }]);
  });

  it("reuses the Idempotency-Key when the same action is retried after a 5xx, and uses a new one afterwards", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { code: "UNAVAILABLE", message: "down", request_id: "r", field_errors: [] }))
      .mockResolvedValueOnce(jsonResponse(200, {}))
      .mockResolvedValueOnce(jsonResponse(200, {}));
    const api = client(fetchMock);

    await expect(api.accessRequests.approve("acc-1", 1)).rejects.toBeInstanceOf(ApiError);
    await api.accessRequests.approve("acc-1", 1);
    const k1 = call(fetchMock, 0).headers.get(IDEMPOTENCY_KEY_HEADER);
    const k2 = call(fetchMock, 1).headers.get(IDEMPOTENCY_KEY_HEADER);
    expect(k1).toBeTruthy();
    expect(k2).toBe(k1);

    await api.accessRequests.approve("acc-1", 1);
    expect(call(fetchMock, 2).headers.get(IDEMPOTENCY_KEY_HEADER)).not.toBe(k1);
  });

  it("refreshes the operator session once on 401 and retries with the same Idempotency-Key", async () => {
    let token = "old";
    const session = { getToken: () => token, refresh: vi.fn(async () => void (token = "new")) };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, { code: "UNAUTHORIZED", message: "expired", request_id: "r", field_errors: [] }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "al-1" }));
    const api = client(fetchMock, session);

    await api.alerts.acknowledge("al-1");
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(call(fetchMock, 0).headers.get("Authorization")).toBe("Bearer old");
    expect(call(fetchMock, 1).headers.get("Authorization")).toBe("Bearer new");
    expect(call(fetchMock, 1).headers.get(IDEMPOTENCY_KEY_HEADER)).toBe(call(fetchMock, 0).headers.get(IDEMPOTENCY_KEY_HEADER));
  });

  it("reports a refused refresh as 401 and tells the caller the session ended", async () => {
    const onSessionExpired = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { code: "UNAUTHORIZED", message: "no", request_id: "r", field_errors: [] }));
    const api = createOperatorConsoleApi(
      createOperatorTransport({
        baseUrl: "http://api.test",
        fetch: fetchMock as unknown as typeof fetch,
        session: { getToken: () => null, refresh: () => Promise.reject(new Error("refused")) },
        onSessionExpired,
      }),
    );
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a network failure to an ApiError with status 0", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(client(fetchMock).incidents.list()).rejects.toMatchObject({ status: 0, code: "NETWORK_ERROR" });
  });

  it("accepts the 202 empty body of the outbox retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    await expect(client(fetchMock).outbox.retry("evt-1")).resolves.toBeUndefined();
    expect(call(fetchMock)).toMatchObject({ url: "http://api.test/v1/operator/outbox/evt-1/retry", method: "POST" });
  });
});

/* ------------------------------------------------------------------ shared views */

describe("operator live building blocks", () => {
  it("renders loading, error with Retry, and the empty state", () => {
    const base = { isEmpty: (d: unknown[]) => d.length === 0, onRetry: () => {}, emptyTitle: "No incidents", emptyDescription: "Nothing open." };
    expect(render(<OperatorResourceStatus {...base} state={{ status: "loading" }} />)).toContain('aria-label="Loading"');
    const failed = render(<OperatorResourceStatus {...base} state={{ status: "error", message: "Cannot reach the ProWise server." }} />);
    expect(failed).toContain("Cannot reach the ProWise server.");
    expect(failed).toContain("Retry");
    expect(render(<OperatorResourceStatus {...base} state={ready([])} />)).toContain("No incidents");
    expect(render(<OperatorResourceStatus {...base} state={ready([1])} />)).toBe("");
  });

  it("shows the stale notice with a Reload button", () => {
    const html = render(<MutationNotice notice={{ stale: true, message: STALE_VERSION_MESSAGE }} onReload={() => {}} onDismiss={() => {}} />);
    expect(html).toContain(STALE_VERSION_MESSAGE);
    expect(html).toContain("Reload");
  });

  it("keeps a control without an endpoint visible, disabled and labelled Not available yet", () => {
    const html = render(<NotAvailableButton>Escalate</NotAvailableButton>);
    expect(html).toContain("Escalate");
    expect(html).toMatch(/<button[^>]*disabled/);
    expect(html).toContain('title="Not available yet"');
    expect(html).toContain(">Not available yet<");
  });
});

/* ------------------------------------------------------------------ pages */

describe("operator pages render server data", () => {
  it("incidents: rows from the server, Live data, disabled escalate / ticket / bulk controls", () => {
    setFixtures({ incidents: ready([INCIDENT]), "operator-directory": ready([]), "incident-assignments": ready([]) });
    const html = render(<IncidentsPage />);
    expect(html).toContain("Live data");
    expect(html).toContain("Webhook ingestion lag");
    expect(html).toContain("Declare Incident");
    expect(html).toContain("Escalate");
    expect(countNotAvailable(html)).toBeGreaterThan(0);
    expect(html).not.toContain("Demo Data (Simulated)");
  });

  it("incidents: loading, error and empty states", () => {
    expect(render(<IncidentsPage />)).toContain('aria-label="Loading"');
    setFixtures({ incidents: { status: "error", message: "Cannot reach the ProWise server." } });
    const failed = render(<IncidentsPage />);
    expect(failed).toContain("Cannot reach the ProWise server.");
    expect(failed).toContain("Retry");
    setFixtures({ incidents: ready([]) });
    expect(render(<IncidentsPage />)).not.toContain("Webhook ingestion lag");
  });

  it("support tickets: server rows; New Ticket, comments and escalation are Not available yet", () => {
    setFixtures({ tickets: ready([TICKET]), "operator-directory": ready([]) });
    const html = render(<SupportTicketsPage />);
    expect(html).toContain("Cannot connect GitHub");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("New Ticket");
    expect(countNotAvailable(html)).toBeGreaterThan(0);
  });

  it("access requests: server rows; Request Access and revoke stay visible but disabled", () => {
    setFixtures({ "access-requests": ready([ACCESS]) });
    const html = render(<AccessRequestsPage />);
    expect(html).toContain("Inspect sync failure");
    expect(html).toContain("Request Access");
    expect(countNotAvailable(html)).toBeGreaterThan(0);
  });

  it("maintenance: server windows with real Start / Cancel; Emergency Request is Not available yet", () => {
    setFixtures({ maintenance: ready([MAINT]) });
    const html = render(<MaintenancePage />);
    expect(html).toContain("Database minor upgrade");
    expect(html).toContain("Request Maintenance");
    expect(html).toContain("Emergency Request");
    expect(html).toContain("Start");
    expect(countNotAvailable(html)).toBeGreaterThan(0);
  });

  it("alerts: Acknowledge is live, Resolve and Create Incident are Not available yet", () => {
    setFixtures({ alerts: ready([ALERT]) });
    const html = render(<AlertsPage />);
    expect(html).toContain("Outbox backlog growing");
    expect(html).toContain("Acknowledge");
    expect(html).toContain("Resolve");
    expect(countNotAvailable(html)).toBeGreaterThan(0);
  });

  it("monitoring: real counters, never the server health score; telemetry tiles say Not available yet", () => {
    setFixtures({
      integrations: ready([INTEGRATION]),
      "dashboard-stats": ready({ openIncidents: 3, openTickets: 2, pendingWebhooks: 1, failedJobs: 4, unacknowledgedAlerts: 5, systemHealthScore: "99.98%" }),
    });
    const html = render(<MonitoringPage />);
    expect(html).toContain("GitHub App");
    expect(html).toContain("Not available yet");
    expect(html).not.toContain("99.98%");
    expect(html).not.toContain("SECRET-CONFIG");
  });

  it("webhook logs: server receipts, never the payload; retry buttons disabled (server would fake success)", () => {
    setFixtures({ webhooks: ready([WEBHOOK]) });
    const html = render(<WebhookLogsPage />);
    expect(html).toContain("gh-delivery-42");
    expect(html).not.toContain("SECRET-PAYLOAD-SHOULD-NOT-RENDER");
    expect(html).toContain("Retry");
    expect(countNotAvailable(html)).toBeGreaterThan(0);
  });

  it("sync jobs: server jobs; retry and pause are Not available yet", () => {
    setFixtures({ jobs: ready([JOB]) });
    const html = render(<SyncJobsPage />);
    expect(html).toContain("github-repo-sync");
    expect(html).toContain("Retry");
    expect(countNotAvailable(html)).toBeGreaterThan(0);
  });

  it("email delivery: server log rows and the empty state", () => {
    setFixtures({ "email-delivery": ready([EMAIL]) });
    const html = render(<EmailDeliveryPage />);
    expect(html).toContain("new.user@acme.test");
    expect(html).toContain("Live data");
    setFixtures({ "email-delivery": ready([]) });
    expect(render(<EmailDeliveryPage />)).not.toContain("new.user@acme.test");
  });

  it("integration health: server connectors, never config_json; diagnostics are Not available yet", () => {
    setFixtures({ integrations: ready([INTEGRATION]) });
    const html = render(<IntegrationHealthPage />);
    expect(html).toContain("GitHub App");
    expect(html).not.toContain("SECRET-CONFIG");
    expect(countNotAvailable(html)).toBeGreaterThan(0);
  });

  it("github monitoring: server repositories; Sync Now and Pause are Not available yet", () => {
    setFixtures({ "github-repositories": ready([REPO]), integrations: ready([INTEGRATION]) });
    const html = render(<GitHubMonitoringPage />);
    expect(html).toContain("acme");
    expect(html).toContain("Sync Now");
    expect(countNotAvailable(html)).toBeGreaterThan(0);
  });

  it("failed events: server outbox failures with a live Retry & Sync Now", () => {
    setFixtures({ "outbox-failed": ready([FAILED_EVENT]) });
    const html = render(<FailedEventsPage />);
    expect(html).toContain("work_item.approved");
    expect(html).toContain("Consumer timeout");
    expect(html).toContain("Retry &amp; Sync Now");
  });

  it("settings: the operator's own profile; edits without an endpoint are disabled", () => {
    setFixtures({ me: ready(ME), "my-permissions": ready({ permissions: [] }), departments: ready([]) });
    const html = render(<SettingsPage />);
    expect(html).toContain("dana@prowise.test");
    expect(html).toContain("Save Profile &amp; Preferences");
    expect(html).toContain("Update Password");
    expect(countNotAvailable(html)).toBeGreaterThan(0);
  });

  it("dashboard: real counts only, fixed server KPIs are never rendered", () => {
    setFixtures({
      me: ready(ME),
      "my-permissions": ready({ permissions: [] }),
      dashboard: ready({
        department: "platform-operations",
        department_name: "Platform Operations",
        kpis: [{ label: "Global Availability", value: "99.96%", change: "Optimal", tone: "emerald" }],
        authorized_modules: [],
        department_data: { operationalStatus: "Core Web API & databases operating within thresholds" },
      }),
      "dashboard-stats": ready({ openIncidents: 1, openTickets: 1, pendingWebhooks: 0, failedJobs: 0, unacknowledgedAlerts: 1, systemHealthScore: "99.98%" }),
      incidents: ready([INCIDENT]),
      tickets: ready([TICKET]),
      "access-requests": ready([ACCESS]),
      alerts: ready([ALERT]),
      jobs: ready([JOB]),
      webhooks: ready([WEBHOOK]),
      maintenance: ready([MAINT]),
      "outbox-failed": ready([FAILED_EVENT]),
      "email-delivery": ready([EMAIL]),
      "operator-directory": ready([ME]),
    });
    const html = render(<DashboardPage />);
    expect(html).toContain("Live data");
    expect(html).toContain("Not available yet");
    expect(html).not.toContain("99.96%");
    expect(html).not.toContain("99.98%");
    expect(html).not.toContain("operating within thresholds");
  });
});

/* ------------------------------------------------------------------ source checks */

const OPERATOR_DIR = resolve(__dirname, "../src/app/(platform)/platform-operator");
const LIVE_PAGES = [
  "page.tsx",
  "incidents/page.tsx",
  "support-tickets/page.tsx",
  "access-requests/page.tsx",
  "maintenance/page.tsx",
  "monitoring/page.tsx",
  "alerts/page.tsx",
  "webhook-logs/page.tsx",
  "sync-jobs/page.tsx",
  "email-delivery/page.tsx",
  "integration-health/page.tsx",
  "github-monitoring/page.tsx",
  "failed-events/page.tsx",
  "settings/page.tsx",
];

describe("live operator pages no longer use demo data", () => {
  it.each(LIVE_PAGES)("%s imports neither the demo store nor the seed data", (file) => {
    const source = readFileSync(join(OPERATOR_DIR, file), "utf8");
    expect(source).not.toMatch(/_store\//);
    expect(source).not.toMatch(/_data\//);
    expect(source).not.toMatch(/useSuperAdminStore|maintenance-store/);
    expect(source).toMatch(/operator-api|OperatorLive/);
    expect(source).toMatch(/liveData/);
  });

  it.each(LIVE_PAGES)("%s never calls the retry endpoints that would fake success", (file) => {
    const source = readFileSync(join(OPERATOR_DIR, file), "utf8");
    expect(source).not.toMatch(/operatorApi\.retryWebhook|operatorApi\.retryJob|emailDelivery\.retry/);
  });

  it("aliases still point at the live pages", () => {
    expect(readFileSync(join(OPERATOR_DIR, "dashboard/page.tsx"), "utf8")).toContain('"../page"');
    expect(readFileSync(join(OPERATOR_DIR, "tickets/page.tsx"), "utf8")).toContain('"../support-tickets/page"');
    expect(readFileSync(join(OPERATOR_DIR, "webhooks/page.tsx"), "utf8")).toContain('"../webhook-logs/page"');
  });
});

/* ------------------------------------------------------------------ dashboard tiles + shell badges */

describe("dashboard and shell badges (live)", () => {
  const STATS = {
    openIncidents: 3,
    openTickets: 2,
    pendingWebhooks: 0,
    failedJobs: 4,
    unacknowledgedAlerts: 5,
    pendingAccessRequests: 1,
    failedOutboxEvents: 6,
    failedEmailDeliveries24h: 7,
    activeMaintenanceWindows: 0,
    organizationsByState: { ACTIVE: 41, SUSPENDED: 2, ARCHIVED: 0 },
    systemHealthScore: null,
    operationalStatus: null,
  };
  const page = <T,>(items: T[], total = items.length) => ready({ items, total, page: 0, size: 25 });

  function dashFixtures(department: string) {
    setFixtures({
      me: ready({ ...ME, department }),
      "my-permissions": ready({ permissions: [] }),
      dashboard: ready({ department, department_name: department, kpis: [], authorized_modules: [], department_data: {} }),
      "dashboard-stats": ready(STATS),
      incidents: ready([]),
      tickets: ready([]),
      "access-requests": ready([]),
      alerts: ready([]),
      jobs: ready([]),
      webhooks: ready([]),
      maintenance: ready([]),
      "outbox-failed": ready([]),
      "email-delivery": ready([]),
      "operator-directory": ready([ME]),
      "dash-orgs": page([{ id: "org-1", name: "Acme Workspace", slug: "acme", state: "ACTIVE", created_at: null, member_count: 12, project_count: 3, owner_email: null, subscription_id: null, subscription_status: null, plan_id: null, plan_name: "Growth" }], 43),
      "dash-subscriptions": page([{ id: "sub-1", org_id: "org-1", org_name: "Acme Workspace", org_slug: "acme", plan_id: "p", plan_code: "growth", plan_name: "Growth Plan", billing_cycle: "MONTHLY", status: "ACTIVE", seats: 20, seats_used: 12, amount: 99, currency: "USD", current_period_start: null, current_period_end: null, auto_renew: true, cancel_at_period_end: false, created_at: null }], 57),
      "dash-subscriptions-active": page([], 51),
      "dash-payment-failures": page([{ id: "pay-1", transaction_ref: "tx", org_id: "org-1", org_name: "Beta Corp", subscription_id: null, invoice_id: null, invoice_number: "INV-0042", invoice_status: "OPEN", amount: 120, currency: "USD", method: "card", method_last4: "4242", gateway_label: null, description: null, failure_reason: "Card declined", failed_at: "2026-11-23T08:00:00Z", updated_at: null }], 9),
      "dash-invoices": page([{ invoice_id: "inv-1", invoice_number: "INV-0099", org_id: "org-1", org_name: "Acme Workspace", invoice_status: "OPEN", total: 99, issue_date: "2026-11-01", due_date: "2026-11-15", delivery_status: "FAILED", recipient_email: "billing@acme.test", delivery_attempts: 2, last_attempt_at: null, last_sent_at: null, last_error_code: "SMTP_550" }], 31),
      "dash-invoices-failed": page([], 4),
      "dash-invoices-not-sent": page([], 8),
      "dash-api-errors": ready({ from: "", to: "", total: 77, client_errors: 70, server_errors: 7, by_status: [], by_path: [{ method: "GET", path: "/v1/projects/{id}", count: 30, server_errors: 2 }], by_code: [] }),
      "dash-email-drafts": page([{ id: "ed-1", name: "Welcome refresh", subject: "Welcome to ProWise", status: "SUBMITTED" }], 6),
      "dash-email-drafts-submitted": page([], 2),
      "dash-announcement-drafts": page([{ id: "ad-1", title: "Planned maintenance", target_audience: "ALL_ORGS", status: "PENDING_REVIEW" }], 5),
      "dash-announcements-pending": page([], 3),
      "dash-announcements-published": page([], 11),
      "dash-backups": ready({ configured: true, running: false, items: [{ id: "b1", status: "SUCCEEDED", started_at: null, finished_at: null, size_bytes: 1024, file_name: "x.dump", triggered_by: "op-1", error_message: null }], total: 1, page: 0, size: 5 }),
      "dash-activity": page([{ id: "act-1", source: "AUDIT", operator_id: "op-1", operator_name: "Dana Ops", department_id: null, action: "INCIDENT_UPDATED", resource_type: "incident", resource_id: "inc-1", module_key: null, details: null, ip_address: null, occurred_at: "2026-11-23T08:00:00Z" }], 120),
      "dash-activity-today": page([], 14),
    });
  }

  it("badge counts come from /dashboard/stats only; zero or missing = no number; payment failures never get one", async () => {
    const { badgeCountsFromStats } = await import("../src/app/(platform)/platform-operator/_components/OperatorShell");
    const badges = badgeCountsFromStats(STATS);
    expect(badges).toEqual({
      incidents: 3,
      "support-tickets": 2,
      "access-requests": 1,
      alerts: 5,
      "failed-events": 6,
      "sync-jobs": 4,
      "email-delivery": 7,
      maintenance: undefined,
    });
    expect(Object.keys(badges)).not.toContain("payment-failures");
    expect(badgeCountsFromStats(null)).toEqual({});
  });

  it("the shell reads badge counts from the stats endpoint, not the demo store", () => {
    const source = readFileSync(join(OPERATOR_DIR, "_components/OperatorShell.tsx"), "utf8");
    expect(source).toContain("operatorApi.dashboardStats()");
    expect(source).not.toMatch(/\(s\) => s\.(paymentFailures|accessRequests|webhooks|alerts)\b/);
    expect(source).not.toMatch(/openPaymentFailures|failedWebhooksCount|pendingAccessCount/);
    const paymentItem = source.slice(source.indexOf('id: "payment-failures"'), source.indexOf('id: "invoice-delivery"'));
    expect(paymentItem).not.toContain("badgeCount");
  });

  it("platform operations: org counts and the workspace list are real; health/latency stay Not available yet", () => {
    dashFixtures("platform-operations");
    const html = render(<DashboardPage />);
    expect(html).toContain("Acme Workspace");
    expect(html).toMatch(/>41</); // active organizations from stats
    expect(html).toMatch(/>43</); // organizations total
    expect(html).toContain("Dana Ops"); // recent activity row
    expect(html).toContain("Workspace availability and latency are not measured");
    expect(html).toContain("Not available yet");
    expect(html).not.toContain("no list endpoint yet");
  });

  it("revenue operations: subscription, payment failure and invoice totals come from the server", () => {
    dashFixtures("revenue-operations");
    const html = render(<DashboardPage />);
    expect(html).toMatch(/>51</); // active subscriptions total
    expect(html).toMatch(/>57</); // all subscriptions total
    expect(html).toMatch(/>9</); // payment failures total
    expect(html).toContain("Card declined");
    expect(html).toContain("Growth Plan");
    expect(html).toContain("Retry Charge"); // still visible, disabled
    expect(countNotAvailable(html)).toBeGreaterThan(0);
    expect(html).not.toContain("has no operator endpoint yet");
  });

  it("finance & tax: invoice delivery exceptions = failed + not sent", () => {
    dashFixtures("finance-tax");
    const html = render(<DashboardPage />);
    expect(html).toMatch(/>12</); // 4 failed + 8 not sent
    expect(html).toContain("INV-0099");
    expect(html).toContain("Card declined");
  });

  it("lifecycle messaging: draft counts are real; SMTP pool and inbox placement stay Not available yet", () => {
    dashFixtures("lifecycle-messaging");
    const html = render(<DashboardPage />);
    expect(html).toMatch(/>5</); // 2 submitted email + 3 pending announcements
    expect(html).toContain("Welcome refresh");
    expect(html).toContain("Planned maintenance");
    expect(html).toContain("SMTP connection pool and sender domain checks are not exposed");
    expect(html).not.toContain("drafts have no server endpoint yet");
  });

  it("site reliability: API error and backup tiles are real; system health and latency stay Not available yet", () => {
    dashFixtures("site-reliability");
    const html = render(<DashboardPage />);
    expect(html).toMatch(/>77</);
    expect(html).toContain("/v1/projects/{id}");
    expect(html).toContain("Latest backup: Succeeded");
    expect(html).toContain("CPU, memory and latency metrics are not collected");
    expect(html).toContain("no service health metrics endpoint");
  });

  it("trust & compliance: audit events today and the audit stream come from the activity log", () => {
    dashFixtures("trust-compliance");
    const html = render(<DashboardPage />);
    expect(html).toMatch(/>14</);
    expect(html).toMatch(/>120</);
    expect(html).toContain("Incident Updated");
  });

  it("tiles show a dash (not sample values) while the new lists are still loading", () => {
    setFixtures({ me: ready({ ...ME, department: "revenue-operations" }) });
    const html = render(<DashboardPage />);
    expect(html).not.toContain("Card declined");
    expect(html).toContain('aria-label="Loading"');
  });
});

/* ------------------------------------------------------------------ announcement & email drafts (live) */

describe("drafts pages (live)", () => {
  const ANN_DRAFT = {
    id: "ann-1",
    title: "Database index upgrade tonight",
    message: "Search may be slower for about ten minutes.",
    type: "MAINTENANCE",
    target_audience: "ALL_ORGS",
    target_plans: [],
    target_org_ids: [],
    channels: ["IN_APP_BANNER"],
    status: "DRAFT",
    scheduled_for: "2026-11-30T02:00:00Z",
    expires_at: null,
    published_at: null,
    author_type: "OPERATOR",
    author_id: "op-1",
    created_by: "dana@prowise.test",
    submitted_at: null,
    submitted_by: null,
    reviewer_note: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: "2026-11-20T10:00:00Z",
    updated_at: "2026-11-20T10:00:00Z",
    version: 3,
  };
  const EMAIL_DRAFT = {
    id: "ed-1",
    name: "Scheduled upgrade notice",
    category: "Incident Notice",
    subject: "Planned maintenance window",
    headline: "Upcoming platform improvement",
    body_text: "We will upgrade the database on Sunday night.",
    body_html: null,
    cta_label: "Open status page",
    audience_description: null,
    status: "DRAFT",
    author_type: "OPERATOR",
    created_by: "op-1",
    created_by_email: "dana@prowise.test",
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    reviewer_note: null,
    created_at: "2026-11-20T10:00:00Z",
    updated_at: "2026-11-21T10:00:00Z",
    version: 5,
  };
  const paged = <T,>(items: T[]) => ready({ items, total: items.length, page: 0, size: 6 });

  it("announcement drafts client: list paging, create, PUT/submit with expected_version, DELETE ?expectedVersion=", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, ANN_DRAFT));
    const api = client(fetchMock);

    await api.announcementDrafts.list({ status: "PENDING_REVIEW", search: "index", page: 1, size: 6 });
    let c = call(fetchMock);
    expect(c.method).toBe("GET");
    expect(c.url).toBe("http://api.test/v1/operator/announcement-drafts?status=PENDING_REVIEW&search=index&page=1&size=6");

    await api.announcementDrafts.list({ status: "ALL" });
    expect(call(fetchMock).url).toBe("http://api.test/v1/operator/announcement-drafts");

    const body = { title: "Upgrade", message: "Ten minutes of slower search.", type: "MAINTENANCE", target_audience: "ALL_ORGS" };
    await api.announcementDrafts.create(body);
    c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toBe("http://api.test/v1/operator/announcement-drafts");
    expect(c.body).toEqual(body);
    expect(c.body.expected_version).toBeUndefined();
    expect(c.headers.get(IDEMPOTENCY_KEY_HEADER)).toBeTruthy();

    await api.announcementDrafts.update("ann-1", body, 3);
    c = call(fetchMock);
    expect(c.method).toBe("PUT");
    expect(c.url).toBe("http://api.test/v1/operator/announcement-drafts/ann-1");
    expect(c.body).toEqual({ ...body, expected_version: 3 });

    await api.announcementDrafts.submit("ann-1", 4);
    c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toBe("http://api.test/v1/operator/announcement-drafts/ann-1/submit");
    expect(c.body).toEqual({ expected_version: 4 });

    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 204 }));
    await api.announcementDrafts.remove("ann-1", 4);
    c = call(fetchMock);
    expect(c.method).toBe("DELETE");
    expect(c.url).toBe("http://api.test/v1/operator/announcement-drafts/ann-1?expectedVersion=4");
    expect(c.body).toBeUndefined();
  });

  it("email drafts client: list paging, create, PUT/submit with expected_version, DELETE ?expectedVersion=", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, EMAIL_DRAFT));
    const api = client(fetchMock);

    await api.emailDrafts.list({ status: "REJECTED", page: 0, size: 25 });
    expect(call(fetchMock).url).toBe("http://api.test/v1/operator/email-drafts?status=REJECTED&page=0&size=25");

    const body = { name: "Notice", subject: "Planned window", body_text: "We will upgrade on Sunday.", body_html: "<p>Hi</p>" };
    await api.emailDrafts.create(body);
    let c = call(fetchMock);
    expect(c.method).toBe("POST");
    expect(c.url).toBe("http://api.test/v1/operator/email-drafts");
    expect(c.body).toEqual(body);

    await api.emailDrafts.update("ed-1", body, 5);
    c = call(fetchMock);
    expect(c.method).toBe("PUT");
    expect(c.url).toBe("http://api.test/v1/operator/email-drafts/ed-1");
    expect(c.body).toEqual({ ...body, expected_version: 5 });

    await api.emailDrafts.submit("ed-1", 6);
    c = call(fetchMock);
    expect(c.url).toBe("http://api.test/v1/operator/email-drafts/ed-1/submit");
    expect(c.body).toEqual({ expected_version: 6 });

    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 204 }));
    await api.emailDrafts.remove("ed-1", 6);
    c = call(fetchMock);
    expect(c.method).toBe("DELETE");
    expect(c.url).toBe("http://api.test/v1/operator/email-drafts/ed-1?expectedVersion=6");
  });

  it("an unsafe body_html refusal (400 field_errors) is shown next to the HTML field", async () => {
    const { FieldErrorText, fieldErrorsOf, toOperatorNotice } = await import(
      "../src/app/(platform)/platform-operator/_components/OperatorLive"
    );
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, {
        code: "VALIDATION_FAILED",
        message: "Validation failed.",
        request_id: "r-html",
        field_errors: [{ field: "body_html", message: "must not contain script tags" }],
      }),
    );
    const error = await client(fetchMock)
      .emailDrafts.create({ name: "N", subject: "S", body_text: "Body text here", body_html: "<script>x</script>" })
      .catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    const errors = fieldErrorsOf(error);
    expect(errors).toEqual({ body_html: "must not contain script tags" });
    const html = render(<FieldErrorText errors={errors} field="body_html" />);
    expect(html).toContain('data-field-error="body_html"');
    expect(html).toContain("must not contain script tags");
    expect(render(<FieldErrorText errors={errors} field="subject" />)).toBe("");
    expect(toOperatorNotice(error).stale).toBe(false);
  });

  it("a 403 on a draft write shows the permission message; a stale version offers Reload", async () => {
    const { PERMISSION_DENIED_MESSAGE, toOperatorNotice } = await import(
      "../src/app/(platform)/platform-operator/_components/OperatorLive"
    );
    const denied = await client(vi.fn(async () => jsonResponse(403, { code: "FORBIDDEN", message: "no", request_id: "r", field_errors: [] })))
      .announcementDrafts.submit("ann-1", 3)
      .catch((e) => e);
    expect(toOperatorNotice(denied)).toEqual({ stale: false, message: PERMISSION_DENIED_MESSAGE });
    expect(PERMISSION_DENIED_MESSAGE).toBe("You do not have permission for this.");

    const fetchMock = vi.fn(async () => jsonResponse(409, STALE));
    const stale = await client(fetchMock).emailDrafts.update("ed-1", { name: "N", subject: "S", body_text: "B" }, 1).catch((e) => e);
    expect(isStaleVersion(stale)).toBe(true);
    expect(toOperatorNotice(stale)).toEqual({ stale: true, message: STALE_VERSION_MESSAGE });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("announcement drafts page: server rows, Live data, locked states and the reviewer note", async () => {
    const { default: AnnouncementDraftsPage } = await import(
      "../src/app/(platform)/platform-operator/announcement-drafts/page"
    );
    setFixtures({
      "announcement-drafts": paged([
        ANN_DRAFT,
        { ...ANN_DRAFT, id: "ann-2", title: "Billing page refresh", status: "PENDING_REVIEW", type: "PRODUCT_UPDATE" },
        { ...ANN_DRAFT, id: "ann-3", title: "Search outage recap", status: "CHANGES_REQUESTED", reviewer_note: "Shorten the second paragraph." },
      ]),
    });
    const html = render(<AnnouncementDraftsPage />);
    expect(html).toContain("Live data");
    expect(html).not.toContain("Demo Data (Simulated)");
    expect(html).toContain("Database index upgrade tonight");
    expect(html).toContain("3 Proposals");
    expect(html).toContain("New Announcement Proposal");
    expect(html).toContain("Submitted for Approval");
    expect(html).toContain("Shorten the second paragraph.");
    expect(html).toContain("Only drafts in Draft or Changes Requested can be changed.");
    expect(html).toContain("Submit for Approval");
  });

  it("announcement drafts page: loading, error and empty states", async () => {
    const { default: AnnouncementDraftsPage } = await import(
      "../src/app/(platform)/platform-operator/announcement-drafts/page"
    );
    expect(render(<AnnouncementDraftsPage />)).toContain('aria-label="Loading"');
    setFixtures({ "announcement-drafts": { status: "error", message: "You do not have permission for this." } });
    const failed = render(<AnnouncementDraftsPage />);
    expect(failed).toContain("You do not have permission for this.");
    expect(failed).toContain("Retry");
    setFixtures({ "announcement-drafts": paged([]) });
    expect(render(<AnnouncementDraftsPage />)).toContain("No announcement drafts found");
  });

  it("email drafts page: server rows, Live data, rejected note and locked submitted drafts", async () => {
    const { default: EmailDraftsPage } = await import("../src/app/(platform)/platform-operator/email-drafts/page");
    setFixtures({
      "email-drafts": paged([
        EMAIL_DRAFT,
        { ...EMAIL_DRAFT, id: "ed-2", name: "Invoice reminder", status: "SUBMITTED", category: "Billing" },
        { ...EMAIL_DRAFT, id: "ed-3", name: "Welcome email", status: "REJECTED", reviewer_note: "Use the new brand name." },
      ]),
    });
    const html = render(<EmailDraftsPage />);
    expect(html).toContain("Live data");
    expect(html).not.toContain("Demo Data (Simulated)");
    expect(html).toContain("Scheduled upgrade notice");
    expect(html).toContain("3 Drafts");
    expect(html).toContain("New Email Draft");
    expect(html).toContain("Use the new brand name.");
    expect(html).toContain("Only drafts in Draft or Rejected can be changed.");
    expect(html).toContain("Submitted for Approval");
  });

  it("email drafts page: loading, error and empty states", async () => {
    const { default: EmailDraftsPage } = await import("../src/app/(platform)/platform-operator/email-drafts/page");
    expect(render(<EmailDraftsPage />)).toContain('aria-label="Loading"');
    setFixtures({ "email-drafts": { status: "error", message: "Cannot reach the ProWise server." } });
    expect(render(<EmailDraftsPage />)).toContain("Cannot reach the ProWise server.");
    setFixtures({ "email-drafts": paged([]) });
    expect(render(<EmailDraftsPage />)).toContain("No email template drafts found");
  });

  it.each(["announcement-drafts/page.tsx", "email-drafts/page.tsx"])(
    "%s uses the live client and neither the demo store nor the seed data",
    (file) => {
      const source = readFileSync(join(OPERATOR_DIR, file), "utf8");
      expect(source).not.toMatch(/_store\//);
      expect(source).not.toMatch(/_data\//);
      expect(source).not.toMatch(/useSuperAdminStore|usePlatformOperatorStore/);
      expect(source).toMatch(/operatorApi\.(announcementDrafts|emailDrafts)/);
      expect(source).toMatch(/liveData/);
      // Operators cannot publish and nothing is sent from the console.
      expect(source).not.toMatch(/\/publish|\.publish\(/);
      expect(source).toMatch(/NotAvailableButton/);
    },
  );
});

/* ------------------------------------------------------------------ billing, API errors, backups (live) */

describe("billing, api error and backup pages (live)", () => {
  const PAYMENT = {
    id: "pay-1",
    transaction_ref: "TXN-9001",
    org_id: "org-1",
    org_name: "Acme Corp",
    subscription_id: "sub-1",
    invoice_id: "inv-1",
    invoice_number: "INV-2026-0042",
    invoice_status: "OVERDUE",
    amount: 49,
    currency: "USD",
    method: "CARD",
    method_last4: "4242",
    gateway_label: "Stripe",
    description: "Renewal",
    failure_reason: "Card declined",
    failed_at: "2026-11-23T08:00:00Z",
    updated_at: "2026-11-23T08:00:00Z",
  };
  const INVOICE = {
    invoice_id: "inv-1",
    invoice_number: "INV-2026-0042",
    org_id: "org-1",
    org_name: "Acme Corp",
    invoice_status: "OPEN",
    total: 49,
    issue_date: "2026-11-01",
    due_date: "2026-11-15",
    delivery_status: "FAILED",
    recipient_email: "billing@acme.test",
    delivery_attempts: 2,
    last_attempt_at: "2026-11-02T08:00:00Z",
    last_sent_at: null,
    last_error_code: "SMTP_550",
  };
  const API_ERROR = {
    id: "err-1",
    occurred_at: "2026-11-23T08:00:00Z",
    request_id: "req-abc-123",
    method: "POST",
    path: "/v1/orgs/{orgId}/projects",
    status: 500,
    error_code: "INTERNAL_ERROR",
    actor_type: "USER",
    actor_id: "u-1",
    org_id: "org-1",
  };
  const SUMMARY = {
    from: "2026-11-22T08:00:00Z",
    to: "2026-11-23T08:00:00Z",
    total: 17,
    client_errors: 12,
    server_errors: 5,
    by_status: [{ status: 500, count: 5 }, { status: 422, count: 12 }],
    by_path: [{ method: "POST", path: "/v1/orgs/{orgId}/projects", count: 9, server_errors: 5 }],
    by_code: [{ error_code: "VALIDATION_FAILED", count: 12 }],
  };
  const RUN = {
    id: "bk-1",
    status: "SUCCEEDED",
    started_at: "2026-11-23T02:00:00Z",
    finished_at: "2026-11-23T02:01:30Z",
    size_bytes: 5 * 1024 * 1024,
    file_name: "prowise-20261123-020000.dump",
    triggered_by: "dana@prowise.test",
    error_message: null,
  };
  const pagedOf = <T,>(items: T[], total = items.length) => ({ items, total, page: 0, size: 25 });
  const livePages = ["payment-failures", "invoice-delivery", "api-errors", "backups"];

  it("client: reads billing, API error and backup endpoints with server paging and filters", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, pagedOf([])));
    const api = client(fetchMock);

    await api.paymentFailures({ search: "acme", from: "2026-11-01T00:00:00.000Z", page: 1, size: 10 });
    let c = call(fetchMock);
    expect(c.method).toBe("GET");
    expect(c.url).toContain("/v1/operator/payments/failures?");
    expect(c.url).toContain("search=acme");
    expect(c.url).toContain("page=1");
    expect(c.url).toContain("size=10");

    await api.invoiceDelivery({ delivery_status: "FAILED", invoice_status: "ALL", page: 0, size: 25 });
    c = call(fetchMock);
    expect(c.url).toContain("/v1/operator/invoices/delivery?");
    expect(c.url).toContain("delivery_status=FAILED");
    expect(c.url).not.toContain("invoice_status");

    await api.apiErrors.list({ status_class: "5xx", status: 503, path: "/v1/orgs", code: "X", page: 2, size: 50 });
    c = call(fetchMock);
    expect(c.url).toContain("/v1/operator/api-errors?");
    expect(c.url).toContain("status_class=5xx");
    expect(c.url).toContain("status=503");
    expect(c.url).toContain("page=2");
    expect(c.url).toContain("size=50");

    await api.apiErrors.summary();
    expect(call(fetchMock).url).toBe("http://api.test/v1/operator/api-errors/summary");

    await api.backups.list({ page: 0, size: 10 });
    expect(call(fetchMock).url).toBe("http://api.test/v1/operator/backups?page=0&size=10");
  });

  it("converts the 1-based UI page into the 0-based server page and clamps size to 1..100", async () => {
    const { toServerPaging } = await import("../src/app/(platform)/platform-operator/_components/OperatorLive");
    expect(toServerPaging(1, 10)).toEqual({ page: 0, size: 10 });
    expect(toServerPaging(3, 500)).toEqual({ page: 2, size: 100 });
    expect(toServerPaging(0, 0)).toEqual({ page: 0, size: 1 });
  });

  it("backup run: POST with an Idempotency-Key; 503 and 409 become readable notices, never retried", async () => {
    const { toOperatorNotice } = await import("../src/app/(platform)/platform-operator/_components/OperatorLive");
    const { BACKUP_CODE_MESSAGES, BACKUP_NOT_CONFIGURED_MESSAGE, BACKUP_RUNNING_MESSAGE } = await import(
      "../src/app/(platform)/platform-operator/backups/backup-messages"
    );

    const accepted = vi.fn(async () => new Response(null, { status: 202 }));
    await client(accepted).backups.run();
    const sent = call(accepted);
    expect(sent.method).toBe("POST");
    expect(sent.url).toBe("http://api.test/v1/operator/backups");
    expect(sent.headers.get(IDEMPOTENCY_KEY_HEADER)).toBeTruthy();

    const notConfigured = vi.fn(async () =>
      jsonResponse(503, { code: "BACKUP_NOT_CONFIGURED", message: "not configured", request_id: "r1", field_errors: [] }),
    );
    const e503 = await client(notConfigured).backups.run().catch((e) => e);
    expect(e503).toBeInstanceOf(ApiError);
    expect(e503.status).toBe(503);
    expect(toOperatorNotice(e503, BACKUP_CODE_MESSAGES)).toEqual({ stale: false, message: BACKUP_NOT_CONFIGURED_MESSAGE });
    expect(BACKUP_NOT_CONFIGURED_MESSAGE).toContain("PROWISE_BACKUP_DIR");
    expect(BACKUP_NOT_CONFIGURED_MESSAGE).toContain("PROWISE_PG_DUMP_PATH");

    const busy = vi.fn(async () =>
      jsonResponse(409, { code: "BACKUP_RUNNING", message: "running", request_id: "r2", field_errors: [] }),
    );
    const e409 = await client(busy).backups.run().catch((e) => e);
    expect(busy).toHaveBeenCalledTimes(1);
    expect(toOperatorNotice(e409, BACKUP_CODE_MESSAGES)).toEqual({ stale: false, message: BACKUP_RUNNING_MESSAGE });
  });

  it("a 403 shows the operator permission message", async () => {
    const { toOperatorNotice, PERMISSION_DENIED_MESSAGE } = await import(
      "../src/app/(platform)/platform-operator/_components/OperatorLive"
    );
    const denied = new ApiError(403, "FORBIDDEN", "Forbidden", "r-403");
    expect(PERMISSION_DENIED_MESSAGE).toBe("You do not have permission for this.");
    expect(toOperatorNotice(denied).message).toBe("You do not have permission for this.");
  });

  it("payment failures: server rows, Live data; retry and escalate stay visible but disabled", async () => {
    const { default: Page } = await import("../src/app/(platform)/platform-operator/payment-failures/page");
    setFixtures({ "payment-failures": ready(pagedOf([PAYMENT], 3)) });
    const html = render(<Page />);
    expect(html).toContain("Live data");
    expect(html).toContain("TXN-9001");
    expect(html).toContain("Card declined");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("3 Unresolved");
    expect(html).toContain("Retry Charge (Sim)");
    expect(html).toContain("Escalate");
    // The bulk bar (with its disabled "Retry Selected") only appears once rows are selected.
    expect(countNotAvailable(html)).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain("Demo Data (Simulated)");
  });

  it("payment failures: loading, permission error and empty states", async () => {
    const { default: Page } = await import("../src/app/(platform)/platform-operator/payment-failures/page");
    expect(render(<Page />)).toContain('aria-label="Loading"');
    setFixtures({ "payment-failures": { status: "error", message: "You do not have permission for this." } });
    expect(render(<Page />)).toContain("You do not have permission for this.");
    setFixtures({ "payment-failures": ready(pagedOf([])) });
    expect(render(<Page />)).toContain("No payment failures match your filter");
  });

  it("invoice delivery: server rows and real totals; resend is Not available yet", async () => {
    const { default: Page } = await import("../src/app/(platform)/platform-operator/invoice-delivery/page");
    setFixtures({
      "invoice-delivery": ready(pagedOf([INVOICE])),
      "invoice-delivery-total": ready(pagedOf([], 8)),
      "invoice-delivery-accepted": ready(pagedOf([], 5)),
    });
    const html = render(<Page />);
    expect(html).toContain("Live data");
    expect(html).toContain("INV-2026-0042");
    expect(html).toContain("billing@acme.test");
    expect(html).toContain("SMTP_550");
    expect(html).toContain("3 Attention Needed");
    expect(html).toContain("Resend Copy");
    // The bulk bar (with its disabled "Resend Selected") only appears once rows are selected.
    expect(countNotAvailable(html)).toBeGreaterThanOrEqual(1);
  });

  it("api errors: summary KPIs, endpoint rows and the raw log; latency and volume are Not available yet", async () => {
    const { default: Page } = await import("../src/app/(platform)/platform-operator/api-errors/page");
    setFixtures({ "api-errors-summary": ready(SUMMARY), "api-errors": ready(pagedOf([API_ERROR])) });
    const html = render(<Page />);
    expect(html).toContain("Live data");
    expect(html).toMatch(/>17</);
    expect(html).toMatch(/>12</);
    expect(html).toMatch(/>5</);
    expect(html).toContain("/v1/orgs/{orgId}/projects");
    expect(html).toContain("VALIDATION_FAILED");
    expect(html).toContain("req-abc-123");
    expect(html).toContain("Requests / Minute");
    expect(html).toContain("Average Response Time");
    expect(html).toContain("Not available yet");
    expect(html).toContain("Incident");
  });

  it("backups: server runs, Live data, not-configured banner; download and restore are Not available yet", async () => {
    const { default: Page } = await import("../src/app/(platform)/platform-operator/backups/page");
    setFixtures({ backups: ready({ ...pagedOf([RUN]), configured: false, running: false }) });
    const html = render(<Page />);
    expect(html).toContain("Live data");
    expect(html).toContain("prowise-20261123-020000.dump");
    expect(html).toContain("5.0 MB");
    expect(html).toContain('data-backup-not-configured="true"');
    expect(html).toContain("PROWISE_BACKUP_DIR");
    expect(html).toContain("Run Snapshot Now");
    expect(html).toContain("Request Restore");
    expect(html).toContain("Download");
    expect(countNotAvailable(html)).toBeGreaterThanOrEqual(2);
  });

  it("backups: while a run is in progress the run button is disabled and the page says it refreshes", async () => {
    const { default: Page } = await import("../src/app/(platform)/platform-operator/backups/page");
    setFixtures({
      backups: ready({
        ...pagedOf([{ ...RUN, status: "RUNNING", finished_at: null, size_bytes: null }]),
        configured: true,
        running: true,
      }),
    });
    const html = render(<Page />);
    expect(html).toContain("Backup Running...");
    expect(html).toContain("refreshes every 5 seconds");
    expect(html).not.toContain('data-backup-not-configured="true"');
  });

  it.each(livePages)("%s imports neither the demo store nor the seed data", (dir) => {
    const source = readFileSync(join(OPERATOR_DIR, `${dir}/page.tsx`), "utf8");
    expect(source).not.toMatch(/_store\//);
    expect(source).not.toMatch(/_data\//);
    expect(source).not.toMatch(/useSuperAdminStore/);
    expect(source).toMatch(/operator-api/);
    expect(source).toMatch(/liveData/);
  });

  it("billing pages never call a payment retry or invoice send endpoint", () => {
    for (const dir of ["payment-failures", "invoice-delivery"]) {
      const source = readFileSync(join(OPERATOR_DIR, `${dir}/page.tsx`), "utf8");
      expect(source).not.toMatch(/method:\s*"POST"/);
      expect(source).not.toMatch(/\.retry\(|resend\(/i);
    }
  });
});

/* ------------------------------------------------------------------ activity logs, organization status, subscriptions */

describe("activity logs, organization status and subscription pages (live)", () => {
  const LOG = {
    id: "log-1",
    source: "AUDIT",
    operator_id: "op-1",
    operator_name: "Dana Ops",
    department_id: "site-reliability",
    action: "incident.updated",
    resource_type: "incident",
    resource_id: "inc-1a2b3c4d",
    module_key: "incidents",
    details: "Status INVESTIGATING -> MITIGATED",
    ip_address: "10.0.0.5",
    occurred_at: "2026-11-23T08:00:00Z",
  };
  const ORG = {
    id: "org-1",
    name: "Acme Corp",
    slug: "acme",
    state: "SUSPENDED",
    created_at: "2026-01-01T00:00:00Z",
    member_count: 12,
    project_count: 4,
    owner_email: "owner@acme.test",
    subscription_id: "sub-1",
    subscription_status: "PAST_DUE",
    plan_id: "plan-growth",
    plan_name: "Growth",
  };
  const SUB = {
    id: "sub-1",
    org_id: "org-1",
    org_name: "Acme Corp",
    org_slug: "acme",
    plan_id: "plan-growth",
    plan_code: "growth",
    plan_name: "Growth",
    billing_cycle: "MONTHLY",
    status: "PAST_DUE",
    seats: 20,
    seats_used: 12,
    amount: 49,
    currency: "USD",
    current_period_start: "2026-11-01T00:00:00Z",
    current_period_end: "2026-12-01T00:00:00Z",
    auto_renew: true,
    cancel_at_period_end: false,
    created_at: "2026-01-01T00:00:00Z",
  };
  const paged = <T,>(items: T[], total = items.length) => ready({ items, total, page: 0, size: 25 });

  it("client: activity logs, organizations and subscriptions send filters and 0-based paging", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { items: [], total: 0, page: 0, size: 10 }));
    const api = client(fetchMock);
    await api.activityLogs({ search: "incident", source: "AUDIT", from: "2026-11-23T00:00:00.000Z", page: 2, size: 10 });
    let c = call(fetchMock);
    expect(c.method).toBe("GET");
    expect(c.url).toContain("/v1/operator/activity-logs?");
    const q = new URL(c.url).searchParams;
    expect(q.get("search")).toBe("incident");
    expect(q.get("source")).toBe("AUDIT");
    expect(q.get("from")).toBe("2026-11-23T00:00:00.000Z");
    expect(q.get("page")).toBe("2");
    expect(q.get("size")).toBe("10");

    await api.activityLogs({ source: "ALL" });
    expect(call(fetchMock).url).toBe("http://api.test/v1/operator/activity-logs");

    await api.organizations.list({ state: "SUSPENDED", page: 0, size: 6 });
    expect(call(fetchMock).url).toBe("http://api.test/v1/operator/organizations?state=SUSPENDED&page=0&size=6");

    fetchMock.mockImplementationOnce(async () => jsonResponse(200, { id: "org-1" }));
    await api.organizations.get("org/1");
    expect(call(fetchMock).url).toBe("http://api.test/v1/operator/organizations/org%2F1");

    await api.subscriptions({ status: "PAST_DUE", search: "acme", page: 1, size: 6 });
    c = call(fetchMock);
    expect(c.url).toBe("http://api.test/v1/operator/subscriptions?status=PAST_DUE&search=acme&page=1&size=6");
    expect(c.method).toBe("GET");
  });

  it("a 403 shows the operator permission message; a stale write is still the Reload notice", async () => {
    const { PERMISSION_DENIED_MESSAGE, operatorErrorMessage, toOperatorNotice } = await import(
      "../src/app/(platform)/platform-operator/_components/OperatorLive"
    );
    const denied = new ApiError(403, "FORBIDDEN", "Forbidden", "r-1");
    expect(PERMISSION_DENIED_MESSAGE).toBe("You do not have permission for this.");
    expect(operatorErrorMessage(denied)).toBe("You do not have permission for this.");
    expect(toOperatorNotice(denied).message).toBe("You do not have permission for this.");
    expect(toOperatorNotice(new ApiError(409, "STALE_VERSION", "stale", "r-2")).stale).toBe(true);
  });

  it("activity logs: server rows, Live data; severity and category stay visible but Not available yet", async () => {
    const { default: ActivityLogsPage } = await import("../src/app/(platform)/platform-operator/activity-logs/page");
    setFixtures({ "activity-logs": paged([LOG], 37) });
    const html = render(<ActivityLogsPage />);
    expect(html).toContain("Live data");
    expect(html).toContain("incident.updated");
    expect(html).toContain("Status INVESTIGATING -&gt; MITIGATED");
    expect(html).toContain("Dana Ops");
    expect(html).toContain("37 Events");
    expect(html).toContain("Warning / Critical Actions");
    expect(html).toContain("Routine Operations");
    expect(html).toContain("Filter log severity");
    expect(html).toContain("Filter log category");
    expect(countNotAvailable(html)).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain("Demo Data (Simulated)");

    setFixtures({ "activity-logs": { status: "error", message: "You do not have permission for this." } });
    expect(render(<ActivityLogsPage />)).toContain("You do not have permission for this.");
    setFixtures({ "activity-logs": paged([]) });
    expect(render(<ActivityLogsPage />)).toContain("No operational logs match your filter");
    setFixtures({});
    expect(render(<ActivityLogsPage />)).toContain('aria-label="Loading"');
  });

  it("organization status: server rows and state counts; health metrics and probes are Not available yet", async () => {
    const { default: OrgStatusPage } = await import("../src/app/(platform)/platform-operator/organization-status/page");
    setFixtures({
      organizations: paged([ORG], 3),
      "dashboard-stats": ready({ organizationsByState: { ACTIVE: 2, SUSPENDED: 1, ARCHIVED: 0 } }),
    });
    const html = render(<OrgStatusPage />);
    expect(html).toContain("Live data");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Growth");
    expect(html).toContain("Suspended");
    expect(html).toContain("3 Workspaces");
    expect(html).toContain("1 suspended");
    expect(html).toContain("Inspect");
    expect(html).toContain("Check");
    expect(html).toContain("30d Uptime");
    expect(html).toContain("Fleet 30-Day Availability");
    expect(html).toContain('title="Not available yet: there is no health probe endpoint"');
    expect(countNotAvailable(html)).toBeGreaterThanOrEqual(3);

    setFixtures({ organizations: { status: "error", message: "You do not have permission for this." } });
    expect(render(<OrgStatusPage />)).toContain("You do not have permission for this.");
  });

  it("subscription status: server rows and per-status totals; Edit Note is Not available yet", async () => {
    const { default: SubscriptionsPage } = await import("../src/app/(platform)/platform-operator/subscription-status/page");
    const one = (total: number) => ready({ items: [], total, page: 0, size: 1 });
    setFixtures({
      subscriptions: paged([SUB]),
      "subscriptions-total": one(9),
      "subscriptions-active": one(5),
      "subscriptions-trialing": one(2),
      "subscriptions-past-due": one(1),
      "subscriptions-suspended": one(0),
    });
    const html = render(<SubscriptionsPage />);
    expect(html).toContain("Live data");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("Past Due");
    expect(html).toContain("12 / 20 seats");
    expect(html).toContain("$49.00");
    expect(html).toMatch(/Active &amp; Trial Accounts[\s\S]*?>7</);
    expect(html).toMatch(/Total Monitored Subscriptions[\s\S]*?>9</);
    expect(html).toContain("Edit Note");
    expect(html).toContain("Not available yet: support notes have no server endpoint yet");
    expect(countNotAvailable(html)).toBeGreaterThanOrEqual(1);
  });

  it.each(["activity-logs/page.tsx", "organization-status/page.tsx", "subscription-status/page.tsx"])(
    "%s reads the live API and imports neither the demo store nor the seed data",
    (file) => {
      const source = readFileSync(join(OPERATOR_DIR, file), "utf8");
      expect(source).not.toMatch(/_store\//);
      expect(source).not.toMatch(/_data\//);
      expect(source).not.toMatch(/useSuperAdminStore|usePlatformOperatorStore/);
      expect(source).toMatch(/operatorApi\./);
      expect(source).toMatch(/liveData/);
    },
  );

  it("org-status alias still points at the live organization status page", () => {
    expect(readFileSync(join(OPERATOR_DIR, "org-status/page.tsx"), "utf8")).toContain('"../organization-status/page"');
  });
});
