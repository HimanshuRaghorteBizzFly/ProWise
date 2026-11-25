import React from "react";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ApiError, IDEMPOTENCY_KEY_HEADER, createApiClient } from "../src/lib/api";
import { createPlatformApi } from "../src/lib/admin-api/platform";
import type {
  AdminEmailDraft,
  PlatformAnnouncement,
  PlatformBranding,
  PlatformEmailTemplate,
  PlatformFeatureFlag,
  PlatformLicense,
  PlatformPolicies,
  ReportsOverview,
} from "../src/types/admin-platform";
import {
  MutationErrorBanner,
  STALE_VERSION_MESSAGE,
  describeMutationError,
  snakeField,
} from "../src/components/super-admin/platform-shared";
import {
  AnnouncementsView,
  announcementCounts,
  announcementInput,
  audienceLabel,
  audienceNames,
  bulkDeleteItems,
  isPendingReview,
  operatorAuthor,
  pendingReviewCount,
  reviewNoteError,
} from "../src/components/super-admin/AnnouncementsView";
import {
  EMAIL_DRAFT_STATUS_OPTIONS,
  OperatorEmailDraftsView,
  canReviewEmailDraft,
  rejectNoteError,
} from "../src/components/super-admin/OperatorEmailDraftsView";
import {
  EmailTemplatesView,
  PresetPicker,
  editorFromPreset,
  extractVariables,
  templateUpdateInput,
} from "../src/components/super-admin/EmailTemplatesView";
import { EMAIL_TEMPLATE_PRESETS, PRESET_VARIABLES } from "../src/components/super-admin/email-template-presets";
import { ConfigurationView } from "../src/components/super-admin/ConfigurationView";
import { SettingsView } from "../src/components/super-admin/SettingsView";
import { ReportsView, mergeMonthly, presetRange, rangeError } from "../src/components/super-admin/ReportsView";
import { AuditLogView, EMPTY_AUDIT_FILTERS, auditCounts, auditCsvRows } from "../src/components/super-admin/AuditLogView";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function platform(fetchMock: ReturnType<typeof vi.fn>) {
  const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock as unknown as typeof fetch, onSessionExpired: () => {} });
  return createPlatformApi(client);
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return {
    url: String(url),
    method: init.method as string,
    body: init.body === undefined ? undefined : JSON.parse(init.body as string),
    headers: init.headers as Headers,
  };
}

const noop = () => {};
const ok = () => vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));

/* ------------------------------------------------------------------ fixtures */

const announcement: PlatformAnnouncement = {
  id: "an-1",
  title: "Planned database upgrade",
  message: "Short read-only window on Sunday.",
  type: "MAINTENANCE",
  target_audience: "BY_PLAN",
  target_plans: ["plan-pro", "plan-ent"],
  target_org_ids: [],
  channels: ["IN_APP_BANNER"],
  status: "DRAFT",
  scheduled_for: null,
  expires_at: null,
  published_at: null,
  created_by: "admin@example.test",
  created_at: "2026-11-20T10:00:00Z",
  updated_at: "2026-11-20T10:00:00Z",
  version: 4,
};

const template: PlatformEmailTemplate = {
  id: "tpl-1",
  key: "WELCOME_OWNER",
  code: "TPL-1001",
  name: "Welcome owner",
  category: "AUTH",
  trigger_description: "Sent when an owner account is created.",
  header_badge: "ACCOUNT READY",
  banner_color: "indigo",
  sender_brand_name: "ProWise",
  show_highlight_box: true,
  footer_note: null,
  subject: "Welcome to {{organization_name}}",
  headline: "Hello {{user_name}}",
  body_paragraphs: "Your workspace is ready.",
  cta_label: "Open workspace",
  cta_url: "https://app.example.test",
  variables: ["organization_name", "user_name"],
  status: "ACTIVE",
  updated_at: "2026-11-21T09:00:00Z",
  updated_by: "admin@example.test",
  version: 2,
};

const flag: PlatformFeatureFlag = {
  id: "ff-1",
  flag_key: "github_sync",
  label: "GitHub sync",
  description: "Repository evidence sync.",
  enabled: true,
  audience: "All Tenants",
  created_at: null,
  updated_at: null,
  version: 7,
};

const license: PlatformLicense = {
  id: "lic-1",
  license_key: "PW-ENT-ABCD-1234",
  org_id: "org-1",
  plan_id: "plan-ent",
  status: "ACTIVE",
  max_seats: 50,
  issued_at: "2026-01-01T00:00:00Z",
  expires_at: "2027-01-01T00:00:00Z",
  revoked_at: null,
  revoked_reason: null,
  created_at: null,
  updated_at: null,
  version: 1,
};

const policies: PlatformPolicies = {
  checkin_grace_working_days: 2,
  stale_webhook_minutes: 30,
  audit_retention_days: 400,
  enforce_mfa_for_operators: true,
  auto_suspend_after_past_due_days: 14,
  default_trial_days: 21,
  max_attachment_mb: 25,
  maintenance_banner_mode: false,
  feature_flags: [flag],
  updated_at: "2026-11-01T00:00:00Z",
  version: 9,
};

const branding: PlatformBranding = {
  platform_name: "ProWise Cloud",
  support_email: "help@example.test",
  status_page_url: "https://status.example.test",
  default_timezone: "Asia/Kolkata",
  default_language: "English (US)",
  date_format: "YYYY-MM-DD",
  currency_display: "USD ($)",
  compact_density: false,
  updated_at: "2026-11-02T00:00:00Z",
  version: 5,
};

const report: ReportsOverview = {
  range: { from: "2026-06-01", to: "2026-11-24" },
  organizations: { total: 12, active: 9, trial: 2, suspended: 1, created_by_month: [{ month: "2026-06", count: 2 }, { month: "2026-09", count: 1 }] },
  users: { total: 140, active: 120, pending: 15, disabled: 5, created_by_month: [{ month: "2026-06", count: 5 }, { month: "2026-07", count: 3 }] },
  subscriptions: {
    by_status: [{ status: "ACTIVE", count: 8 }, { status: "TRIALING", count: 2 }],
    by_plan: [{ plan_id: "plan-pro", plan_name: "Pro", count: 6 }],
    mrr: 4321.5,
    arr: 51858,
  },
  invoices: { by_status: [{ status: "PAID", count: 4, total: 1000 }], billed_total: 1500, paid_total: 1000, outstanding_total: 500 },
  payments: { succeeded_total: 1000, refunded_total: 0, failed_count: 1 },
  audit: { by_category: [{ category: "SECURITY", count: 3 }], by_day: [{ date: "2026-11-20", count: 3 }] },
  logins: { by_day: [{ date: "2026-11-20", succeeded: 17, failed: 2 }] },
};

/* ------------------------------------------------------------------ typed client */

describe("platform client: paths, methods and bodies", () => {
  it("sends expected_version in the body of announcement updates and state changes", async () => {
    const fetchMock = ok();
    const api = platform(fetchMock);
    const input = announcementInput({
      title: " T ", message: "M", type: "INFO", audience: "ALL_ORGS", plans: ["x"], orgs: [], channels: ["IN_APP_BANNER"],
      status: "DRAFT", scheduledFor: "", expiresAt: "",
    });

    await api.announcements.update("an-1", input, 4);
    let call = lastCall(fetchMock);
    expect(call.url).toBe("http://api.test/v1/admin/announcements/an-1");
    expect(call.method).toBe("PUT");
    expect(call.body).toMatchObject({ title: "T", target_plans: [], expected_version: 4 });
    expect(call.headers.get(IDEMPOTENCY_KEY_HEADER)).toBeTruthy();

    await api.announcements.publish("an-1", 4);
    call = lastCall(fetchMock);
    expect([call.method, call.url, call.body]).toEqual(["POST", "http://api.test/v1/admin/announcements/an-1/publish", { expected_version: 4 }]);

    await api.announcements.archive("an-1", 5);
    call = lastCall(fetchMock);
    expect([call.method, call.url, call.body]).toEqual(["POST", "http://api.test/v1/admin/announcements/an-1/archive", { expected_version: 5 }]);
  });

  it("creates without a version", async () => {
    const fetchMock = ok();
    const api = platform(fetchMock);
    await api.announcements.create(announcementInput({
      title: "T", message: "M", type: "INFO", audience: "ALL_ORGS", plans: [], orgs: [], channels: ["IN_APP_BANNER"],
      status: "DRAFT", scheduledFor: "", expiresAt: "",
    }));
    const call = lastCall(fetchMock);
    expect(call.method).toBe("POST");
    expect(call.url).toBe("http://api.test/v1/admin/announcements");
    expect(call.body).not.toHaveProperty("expected_version");
  });

  it("deletes with ?expectedVersion= and no body, accepting 204", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    const api = platform(fetchMock);

    await expect(api.announcements.remove("an-1", 4)).resolves.toBeUndefined();
    await api.emailTemplates.remove("tpl/1", 2);
    await api.featureFlags.remove("ff-1", 7);

    const calls = fetchMock.mock.calls.map(([url, init]) => [init.method, String(url), init.body]);
    expect(calls).toEqual([
      ["DELETE", "http://api.test/v1/admin/announcements/an-1?expectedVersion=4", undefined],
      ["DELETE", "http://api.test/v1/admin/email-templates/tpl%2F1?expectedVersion=2", undefined],
      ["DELETE", "http://api.test/v1/admin/feature-flags/ff-1?expectedVersion=7", undefined],
    ]);
  });

  it("covers email templates, flags, licenses, policies, branding and reports", async () => {
    const fetchMock = ok();
    const api = platform(fetchMock);

    await api.emailTemplates.update("tpl-1", templateUpdateInput({
      name: "N", category: "AUTH", status: "ACTIVE", code: "", key: "K", senderBrandName: "", bannerColor: "indigo",
      headerBadge: "", triggerDescription: "", showHighlightBox: true, footerNote: "", subject: "Hi {{user_name}}",
      headline: "H", body: "B {{organization_name}}", ctaLabel: "", ctaUrl: "",
    }), 2);
    let call = lastCall(fetchMock);
    expect([call.method, call.url]).toEqual(["PUT", "http://api.test/v1/admin/email-templates/tpl-1"]);
    expect(call.body).toMatchObject({ expected_version: 2, variables: ["user_name", "organization_name"], header_badge: null });

    await api.emailTemplates.clone("tpl-1");
    call = lastCall(fetchMock);
    expect([call.method, call.url, call.body]).toEqual(["POST", "http://api.test/v1/admin/email-templates/tpl-1/clone", undefined]);

    await api.featureFlags.toggle("ff-1", false, 7);
    call = lastCall(fetchMock);
    expect([call.method, call.url, call.body]).toEqual(["POST", "http://api.test/v1/admin/feature-flags/ff-1/toggle", { enabled: false, expected_version: 7 }]);

    await api.featureFlags.update("ff-1", { label: "L", description: null, audience: "All Tenants" }, 7);
    call = lastCall(fetchMock);
    expect([call.method, call.body.expected_version]).toEqual(["PUT", 7]);

    await api.licenses.revoke("lic-1", "Contract ended", 1);
    call = lastCall(fetchMock);
    expect([call.method, call.url, call.body]).toEqual(["POST", "http://api.test/v1/admin/licenses/lic-1/revoke", { reason: "Contract ended", expected_version: 1 }]);

    await api.licenses.generate({ org_id: null, plan_id: null, max_seats: 5, validity_days: null });
    call = lastCall(fetchMock);
    expect([call.method, call.url]).toEqual(["POST", "http://api.test/v1/admin/licenses"]);
    expect(call.body).not.toHaveProperty("expected_version");

    const { feature_flags: _f, updated_at: _u, version: _v, ...policyInput } = policies;
    await api.policies.update(policyInput, 9);
    call = lastCall(fetchMock);
    expect([call.method, call.url, call.body.expected_version, call.body.audit_retention_days]).toEqual(["PUT", "http://api.test/v1/admin/policies", 9, 400]);

    const { updated_at: _bu, version: _bv, ...brandingInput } = branding;
    await api.branding.update(brandingInput, 5);
    call = lastCall(fetchMock);
    expect([call.method, call.url, call.body.expected_version]).toEqual(["PUT", "http://api.test/v1/admin/branding", 5]);

    await api.reports.overview("2026-06-01", "2026-11-24");
    call = lastCall(fetchMock);
    expect([call.method, call.url]).toEqual(["GET", "http://api.test/v1/admin/reports/overview?from=2026-06-01&to=2026-11-24"]);

    await api.auditLogs.list({ category: "ALL", search: "login" });
    expect(lastCall(fetchMock).url).toBe("http://api.test/v1/admin/audit-logs?search=login");
  });
});

/* ------------------------------------------------------------------ stale writes and field errors */

describe("409 STALE_VERSION and field errors", () => {
  it("surfaces a stale write as the reload message, never retrying", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(409, { code: "STALE_VERSION", message: "Version mismatch", request_id: "r1", field_errors: [] }),
    );
    const api = platform(fetchMock);

    const error = await api.featureFlags.toggle("ff-1", false, 6).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const failure = describeMutationError(error);
    expect(failure).toEqual({ message: STALE_VERSION_MESSAGE, stale: true, fieldErrors: {} });
    expect(STALE_VERSION_MESSAGE).toBe("This record was changed by someone else. Reload to see the latest version.");

    const markup = renderToStaticMarkup(<MutationErrorBanner failure={failure} onReload={noop} />);
    expect(markup).toContain(STALE_VERSION_MESSAGE);
    expect(markup).toContain("Reload");
  });

  it("treats a different 409 as a normal error without Reload", () => {
    const failure = describeMutationError(new ApiError(409, "DUPLICATE_KEY", "Key exists.", "r"));
    expect(failure.stale).toBe(false);
    const markup = renderToStaticMarkup(<MutationErrorBanner failure={failure} onReload={noop} />);
    expect(markup).toContain("Key exists.");
    expect(markup).not.toContain("Reload");
  });

  it("maps server field_errors to wire field names", () => {
    const failure = describeMutationError(
      new ApiError(400, "VALIDATION_FAILED", "Invalid", "r", [
        { field: "supportEmail", message: "must be a well-formed email address" },
        { field: "body.title", message: "must not be blank" },
      ]),
    );
    expect(failure.fieldErrors).toEqual({ support_email: "must be a well-formed email address", title: "must not be blank" });
    expect(snakeField("targetAudience")).toBe("target_audience");
  });
});

/* ------------------------------------------------------------------ reports */

describe("Reports & Analytics", () => {
  const range = { preset: "CUSTOM" as const, from: "2026-06-01", to: "2026-11-24" };

  it("joins monthly series without adding months the server did not send", () => {
    expect(mergeMonthly(report.organizations.created_by_month, report.users.created_by_month)).toEqual([
      { label: "2026-06", primary: 2, secondary: 5 },
      { label: "2026-07", primary: 0, secondary: 3 },
      { label: "2026-09", primary: 1, secondary: 0 },
    ]);
    expect(mergeMonthly([], [])).toEqual([]);
  });

  it("renders totals and plotted values exactly from the fixture", () => {
    const markup = renderToStaticMarkup(<ReportsView state={{ status: "ready", data: report }} range={range} onRangeChange={noop} onRetry={noop} />);
    expect(markup).toContain("Reports &amp; Analytics");
    expect(markup).toContain(">12<");
    expect(markup).toContain("9 active, 2 trial, 1 suspended");
    expect(markup).toContain(">140<");
    expect(markup).toContain("2026-06");
    expect(markup).toContain("2026-07");
    expect(markup).toContain("2026-09");
    expect(markup).not.toContain("2026-08");
    expect(markup).not.toContain("2026-10");
    expect(markup).toContain("Pro");
    expect(markup).toContain("Download CSV");
    // no invented trend badges
    expect(markup).not.toMatch(/[+-]\d+(\.\d+)?%/);
  });

  it("shows no-data notes instead of charts for empty series", () => {
    const empty: ReportsOverview = {
      ...report,
      organizations: { ...report.organizations, created_by_month: [] },
      users: { ...report.users, created_by_month: [] },
      logins: { by_day: [] },
      audit: { by_category: [], by_day: [] },
    };
    const markup = renderToStaticMarkup(<ReportsView state={{ status: "ready", data: empty }} range={range} onRangeChange={noop} onRetry={noop} />);
    expect(markup.match(/No data in this range\./g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("shows loading, error with Retry, and an invalid range without numbers", () => {
    expect(renderToStaticMarkup(<ReportsView state={{ status: "loading" }} range={range} onRangeChange={noop} onRetry={noop} />)).toContain('aria-label="Loading"');
    const error = renderToStaticMarkup(<ReportsView state={{ status: "error", message: "Cannot reach the ProWise server." }} range={range} onRangeChange={noop} onRetry={noop} />);
    expect(error).toContain("Cannot reach the ProWise server.");
    expect(error).toContain("Retry");
    expect(error).not.toContain("Monthly recurring revenue");
    const bad = { ...range, from: "2026-12-01" };
    expect(rangeError(bad)).toBe("The start date must be on or before the end date.");
    expect(renderToStaticMarkup(<ReportsView state={{ status: "invalid", message: rangeError(bad)! }} range={bad} onRangeChange={noop} onRetry={noop} />)).toContain("The start date must be on or before the end date.");
  });

  it("computes preset ranges as calendar dates", () => {
    const today = new Date(2026, 10, 24);
    expect(presetRange("30D", today)).toEqual({ preset: "30D", from: "2026-10-26", to: "2026-11-24" });
    expect(presetRange("YTD", today)).toEqual({ preset: "YTD", from: "2026-01-01", to: "2026-11-24" });
    expect(presetRange("6M", today)).toEqual({ preset: "6M", from: "2026-05-01", to: "2026-11-24" });
  });
});

/* ------------------------------------------------------------------ list pages */

describe("Announcements page", () => {
  const api = createPlatformApi({ call: vi.fn() });

  it("renders server rows with counts from the loaded list only", () => {
    const rows = [announcement, { ...announcement, id: "an-2", status: "PUBLISHED", title: "Release 2.0", version: 1 }];
    expect(announcementCounts(rows)).toEqual({ total: 2, published: 1, scheduled: 0, draft: 1, archived: 0 });
    expect(audienceLabel(announcement)).toBe("2 plan(s)");
    const markup = renderToStaticMarkup(<AnnouncementsView state={{ status: "ready", data: rows }} onRetry={noop} api={api} plans={[]} organizations={[]} />);
    expect(markup).toContain("Planned database upgrade");
    expect(markup).toContain("Release 2.0");
    expect(markup).toContain("Publish");
    expect(markup).toContain("Archive");
    expect(markup).toContain("2 notices");
  });

  it("shows empty and error states without sample rows", () => {
    const empty = renderToStaticMarkup(<AnnouncementsView state={{ status: "ready", data: [] }} onRetry={noop} api={api} plans={[]} organizations={[]} />);
    expect(empty).toContain("No announcements yet");
    const error = renderToStaticMarkup(<AnnouncementsView state={{ status: "error", message: "Boom" }} onRetry={noop} api={api} plans={[]} organizations={[]} />);
    expect(error).toContain("Boom");
    expect(error).toContain("Retry");
    expect(error).not.toContain("Planned database upgrade");
  });
});

describe("Email templates page", () => {
  const api = createPlatformApi({ call: vi.fn() });

  it("renders templates without open/click rates or a fake test send", () => {
    const markup = renderToStaticMarkup(<EmailTemplatesView state={{ status: "ready", data: [template] }} onRetry={noop} api={api} organizationNames={[]} />);
    expect(markup).toContain("Welcome owner");
    expect(markup).toContain("TPL-1001");
    expect(markup).not.toMatch(/open rate|click rate/i);
    expect(markup).not.toMatch(/send test/i);
    expect(extractVariables("{{a}} {{ b }}", "{{a}}")).toEqual(["a", "b"]);
  });

  it("shows empty and error states", () => {
    expect(renderToStaticMarkup(<EmailTemplatesView state={{ status: "ready", data: [] }} onRetry={noop} api={api} organizationNames={[]} />)).toContain("No email templates yet");
    const error = renderToStaticMarkup(<EmailTemplatesView state={{ status: "error", message: "Nope" }} onRetry={noop} api={api} organizationNames={[]} />);
    expect(error).toContain("Nope");
    expect(error).toContain("Retry");
  });
});

describe("Audit page", () => {
  const rows = [
    { id: "1", category: "SECURITY", action: "REVOKE_LICENSE", summary: "Revoked", actor_name: "A", actor_email: "a@x.test", target_label: null, severity: "WARNING", timestamp: "2026-11-24T10:00:00Z" },
    { id: "2", category: "PLATFORM", action: "TOGGLE_FEATURE_FLAG", summary: "Toggled", actor_name: "A", actor_email: "a@x.test", target_label: "github_sync", severity: "CRITICAL", timestamp: "2026-11-24T11:00:00Z" },
  ];

  it("counts and exports only the loaded rows", () => {
    expect(auditCounts(rows)).toEqual({ total: 2, warning: 1, critical: 1, actors: 1 });
    expect(auditCsvRows(rows)).toHaveLength(2);
    const markup = renderToStaticMarkup(
      <AuditLogView state={{ status: "ready", data: rows }} filters={EMPTY_AUDIT_FILTERS} categories={[]} onFiltersChange={noop} onRetry={noop} />,
    );
    expect(markup).toContain("Export loaded rows (CSV)");
    expect(markup).toContain("TOGGLE_FEATURE_FLAG");
  });
});

/* ------------------------------------------------------------------ configuration and settings */

describe("Platform Configuration and Settings", () => {
  const api = createPlatformApi({ call: vi.fn() });
  const ready = <T,>(data: T) => ({ status: "ready" as const, data });

  it("renders policies from the server and real KPI counts", () => {
    const markup = renderToStaticMarkup(
      <ConfigurationView
        policies={ready(policies)}
        flags={ready([flag, { ...flag, id: "ff-2", enabled: false, label: "Exports" }])}
        licenses={ready([license])}
        onReloadPolicies={noop}
        onReloadFlags={noop}
        onReloadLicenses={noop}
        api={api}
        organizations={[]}
        plans={[]}
      />,
    );
    expect(markup).toContain("Platform Configuration");
    expect(markup).toContain("1 / 2");
    expect(markup).toContain("Mandatory");
    expect(markup).toContain("400 days");
    expect(markup).toContain('value="21"');
    expect(markup).toContain('href="/super-admin/maintenance"');
    expect(markup).not.toContain('type="password"');
  });

  it("renders flags and licenses tabs, plus their empty and error states", () => {
    const flagsTab = renderToStaticMarkup(
      <ConfigurationView initialTab="flags" policies={ready(policies)} flags={ready([flag])} licenses={ready([])} onReloadPolicies={noop} onReloadFlags={noop} onReloadLicenses={noop} api={api} organizations={[]} plans={[]} />,
    );
    expect(flagsTab).toContain("github_sync");
    expect(flagsTab).toContain("Enabled");

    const licensesTab = renderToStaticMarkup(
      <ConfigurationView initialTab="licenses" policies={ready(policies)} flags={ready([])} licenses={ready([license])} onReloadPolicies={noop} onReloadFlags={noop} onReloadLicenses={noop} api={api} organizations={[{ id: "org-1", name: "Acme" }]} plans={[]} />,
    );
    expect(licensesTab).toContain("PW-ENT-ABCD-1234");
    expect(licensesTab).toContain("Acme");
    expect(licensesTab).toContain("Revoke");

    const emptyFlags = renderToStaticMarkup(
      <ConfigurationView initialTab="flags" policies={{ status: "error", message: "x" }} flags={ready([])} licenses={{ status: "loading" }} onReloadPolicies={noop} onReloadFlags={noop} onReloadLicenses={noop} api={api} organizations={[]} plans={[]} />,
    );
    expect(emptyFlags).toContain("No feature flags yet");

    const policyError = renderToStaticMarkup(
      <ConfigurationView policies={{ status: "error", message: "Policies unavailable" }} flags={ready([])} licenses={ready([])} onReloadPolicies={noop} onReloadFlags={noop} onReloadLicenses={noop} api={api} organizations={[]} plans={[]} />,
    );
    expect(policyError).toContain("Policies unavailable");
    expect(policyError).toContain("Retry");
  });

  it("renders branding settings with no secret inputs, linking to Platform Keys", () => {
    const markup = renderToStaticMarkup(<SettingsView state={ready(branding)} onRetry={noop} api={api} />);
    expect(markup).toContain('value="ProWise Cloud"');
    expect(markup).toContain('value="help@example.test"');
    expect(markup).toContain("Asia/Kolkata");
    expect(markup).toContain('href="/super-admin/security-keys"');
    expect(markup).not.toContain('type="password"');
    expect(markup).not.toMatch(/<label[^>]*>[^<]*(secret|password|api key|token)/i);

    const error = renderToStaticMarkup(<SettingsView state={{ status: "error", message: "Down" }} onRetry={noop} api={api} />);
    expect(error).toContain("Down");
    expect(error).toContain("Retry");
  });
});

/* ------------------------------------------------------------------ source guards */

describe("no demo store or simulated requests in these sections", () => {
  const root = resolve(__dirname, "../src");
  const files = [
    "app/(platform)/super-admin/audit/page.tsx",
    "app/(platform)/super-admin/announcements/page.tsx",
    "app/(platform)/super-admin/email-templates/page.tsx",
    "app/(platform)/super-admin/configuration/page.tsx",
    "app/(platform)/super-admin/reports/page.tsx",
    "app/(platform)/super-admin/settings/page.tsx",
    "components/super-admin/AuditLogView.tsx",
    "components/super-admin/AnnouncementsView.tsx",
    "components/super-admin/EmailTemplatesView.tsx",
    "components/super-admin/ConfigurationView.tsx",
    "components/super-admin/SettingsView.tsx",
    "components/super-admin/ReportsView.tsx",
    "components/super-admin/platform-shared.tsx",
    "components/super-admin/email-template-presets.ts",
    "lib/admin-api/platform.ts",
  ];

  it.each(files)("%s reads only the server", (file) => {
    const source = readFileSync(join(root, file), "utf8");
    expect(source).not.toMatch(/useSuperAdminStore|_store\/|_data\/seed|withSimulatedRequest|SimulationNotice|localStorage\.setItem/);
    expect(source).not.toMatch(/type=["']password["']/);
  });
});

/* ------------------------------------------------------------------ email template presets and cards */

describe("Email template presets", () => {
  it("fill the editor without calling the server", () => {
    const call = vi.fn();
    createPlatformApi({ call });

    expect(EMAIL_TEMPLATE_PRESETS.map((p) => p.name)).toEqual([
      "Welcome", "Account verification", "Password reset", "Password changed", "Operator invitation",
      "Operator activation", "Organization invitation", "Organization created", "Subscription activated",
      "Subscription renewed", "Subscription cancelled", "Payment successful", "Payment failed", "Invoice generated",
      "Invoice overdue", "Security alert", "Announcement", "Account suspended", "Account restored",
    ]);

    const reset = EMAIL_TEMPLATE_PRESETS.find((p) => p.id === "password-reset")!;
    const form = editorFromPreset(reset);
    expect(form).toMatchObject({
      name: "Password reset",
      key: "password_reset",
      category: "AUTH",
      status: "DRAFT",
      subject: reset.subject,
      headline: reset.headline,
      ctaUrl: "{{resetPasswordLink}}",
    });
    expect(form.body).toContain("{{userEmail}}");
    expect(templateUpdateInput(form).variables).toContain("resetPasswordLink");

    // Rendering the picker and filling the form never touches the API.
    const picker = renderToStaticMarkup(<PresetPicker selected="password-reset" onPick={noop} />);
    expect(picker).toContain("Start from a system template");
    expect(picker).toContain("Nothing is saved until you click Create template.");
    expect(picker).not.toMatch(/type="submit"/);
    expect(call).not.toHaveBeenCalled();

    const allowed = new Set<string>(PRESET_VARIABLES);
    for (const p of EMAIL_TEMPLATE_PRESETS) {
      expect(p.html).not.toMatch(/<script|javascript:|\son\w+=/i);
      expect(p.text.length).toBeGreaterThan(0);
      const used = extractVariables(p.subject, p.headline, p.paragraphs.join(" "), p.ctaUrl ?? "", p.html, p.text);
      for (const v of used) expect(allowed.has(v), `${p.id} uses {{${v}}}`).toBe(true);
    }
  });
});

describe("Email template cards", () => {
  const api = createPlatformApi({ call: vi.fn() });

  it("render the record's real fields, the SMTP chip from settings, and no open/click rates or test send", () => {
    const smtp = { status: "ready" as const, data: { host: "smtp.gmail.com", provider: "GMAIL", connection_status: "CONNECTED" } as never };
    const markup = renderToStaticMarkup(
      <EmailTemplatesView state={{ status: "ready", data: [template] }} onRetry={noop} api={api} organizationNames={[]} smtp={smtp} />,
    );
    expect(markup).toContain("SMTP: smtp.gmail.com (CONNECTED)");
    expect(markup).toContain('href="/super-admin/email-settings"');
    expect(markup).toContain("Welcome owner");
    expect(markup).toContain("TPL-1001");
    expect(markup).toContain("ACCOUNT READY");
    expect(markup).toContain("Authentication");
    expect(markup).toContain("Sent when an owner account is created.");
    expect(markup).toContain("Welcome to {{organization_name}}");
    expect(markup).toContain("Updated ");
    expect(markup).toContain("Clone Welcome owner");
    expect(markup).toContain("Delete Welcome owner");
    expect(markup).toContain("Table");
    expect(markup).toContain("Cards");
    expect(markup).not.toMatch(/open rate|click rate|opens|clicks/i);
    expect(markup).not.toMatch(/send test|test send/i);

    const noSmtp = renderToStaticMarkup(
      <EmailTemplatesView state={{ status: "ready", data: [template] }} onRetry={noop} api={api} organizationNames={[]} smtp={{ status: "error", message: "x" }} />,
    );
    expect(noSmtp).toContain("SMTP status unavailable");
    expect(noSmtp).not.toContain("CONNECTED");
  });
});

/* ------------------------------------------------------------------ announcement cards, bulk delete, pagination */

describe("Announcement cards", () => {
  const api = createPlatformApi({ call: vi.fn() });

  it("render real audience, channels, author and a scheduled date", () => {
    const scheduled: PlatformAnnouncement = {
      ...announcement,
      id: "an-9",
      title: "Billing migration",
      type: "RELEASE",
      status: "SCHEDULED",
      target_audience: "SPECIFIC_ORGS",
      target_plans: [],
      target_org_ids: ["org-1", "org-unknown"],
      channels: ["IN_APP_BANNER", "EMAIL_BROADCAST"],
      scheduled_for: "2026-12-01T09:00:00Z",
      created_by: "ops@example.test",
    };
    const orgs = [{ id: "org-1", name: "Acme Corp" }];
    expect(audienceNames(scheduled, [], orgs)).toBe("Acme Corp");
    const markup = renderToStaticMarkup(
      <AnnouncementsView state={{ status: "ready", data: [scheduled, { ...announcement, created_by: null }] }} onRetry={noop} api={api} plans={[]} organizations={orgs} />,
    );
    expect(markup).toContain("Billing migration");
    expect(markup).toContain("2 selected organization(s)");
    expect(markup).toContain("Acme Corp");
    expect(markup).not.toContain("org-unknown");
    expect(markup).toContain("In-App Banner");
    expect(markup).toContain("Email Broadcast");
    expect(markup).toContain("ops@example.test");
    expect(markup).toContain("For ");
    expect(markup).toContain("#1");
    expect(markup).toContain("#2");
    expect(markup).toContain("Product Release");
    expect(markup).toContain("Select Billing migration");
    expect(markup).not.toMatch(/Unpublish/);
  });

  it("offers Publish for archived notices and Archive for published ones", () => {
    const rows = [
      { ...announcement, id: "a1", status: "ARCHIVED", title: "Old notice" },
      { ...announcement, id: "a2", status: "PUBLISHED", title: "Live notice" },
    ];
    const markup = renderToStaticMarkup(<AnnouncementsView state={{ status: "ready", data: rows }} onRetry={noop} api={api} plans={[]} organizations={[]} />);
    expect(markup.match(/<\/svg>Publish</g)?.length).toBe(1);
    expect(markup.match(/<\/svg>Archive</g)?.length).toBe(1);
  });

  it("bulk delete sends every selected id with its version", async () => {
    const rows = [announcement, { ...announcement, id: "an-2", version: 9 }, { ...announcement, id: "an-3", version: 1 }];
    const items = bulkDeleteItems(rows, ["an-2", "an-1"]);
    expect(items).toEqual([{ id: "an-1", version: 4 }, { id: "an-2", version: 9 }]);

    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(new Response(null, { status: 204 })));
    await platform(fetchMock).announcements.bulkRemove(items);
    const call = lastCall(fetchMock);
    expect([call.method, call.url]).toEqual(["POST", "http://api.test/v1/admin/announcements/bulk-delete"]);
    expect(call.body).toEqual({ items: [{ id: "an-1", expected_version: 4 }, { id: "an-2", expected_version: 9 }] });
    expect(call.headers.get(IDEMPOTENCY_KEY_HEADER)).toBeTruthy();
  });

  it("paginates the loaded rows with a Showing x-y of N footer", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ ...announcement, id: `an-${i + 1}`, title: `Notice number ${i + 1}` }));
    const markup = renderToStaticMarkup(<AnnouncementsView state={{ status: "ready", data: rows }} onRetry={noop} api={api} plans={[]} organizations={[]} />);
    expect(markup).toContain("Notice number 10<");
    expect(markup).not.toContain("Notice number 11<");
    expect(markup.replace(/<[^>]+>/g, "")).toContain("Showing 1–10 of 12");
    expect(markup).toContain('aria-label="Rows per page"');
    expect(markup).toContain("Prev");
    expect(markup).toContain("Next");
    expect(markup).toContain("1 / 2");
  });
});

/* ------------------------------------------------------------------ operator review workflow (Super Admin side) */

describe("operator review workflow: client", () => {
  it("requests changes on an announcement with expected_version and the reviewer note", async () => {
    const fetchMock = ok();
    await platform(fetchMock).announcements.requestChanges("an-1", 6, "Fix the date");
    const call = lastCall(fetchMock);
    expect([call.method, call.url]).toEqual(["POST", "http://api.test/v1/admin/announcements/an-1/request-changes"]);
    expect(call.body).toEqual({ expected_version: 6, reviewer_note: "Fix the date" });
    expect(call.headers.get(IDEMPOTENCY_KEY_HEADER)).toBeTruthy();
  });

  it("lists operator email drafts with 0-based paging and a status filter (ALL sends no status)", async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, { items: [], total: 0, page: 0, size: 25 })));
    const api = platform(fetchMock);
    await api.emailDrafts.list({ status: "SUBMITTED", page: 0, size: 25 });
    let call = lastCall(fetchMock);
    expect(call.method).toBe("GET");
    const url = new URL(call.url);
    expect(url.pathname).toBe("/v1/admin/email-drafts");
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: "SUBMITTED", page: "0", size: "25" });

    await api.emailDrafts.list({ status: "ALL", page: 2, size: 10 });
    call = lastCall(fetchMock);
    expect(Object.fromEntries(new URL(call.url).searchParams)).toEqual({ page: "2", size: "10" });
  });

  it("approves with an optional note and rejects with a required note, both versioned", async () => {
    const fetchMock = ok();
    const api = platform(fetchMock);
    await api.emailDrafts.approve("ed-1", 3);
    let call = lastCall(fetchMock);
    expect([call.method, call.url, call.body]).toEqual(["POST", "http://api.test/v1/admin/email-drafts/ed-1/approve", { expected_version: 3 }]);

    await api.emailDrafts.approve("ed-1", 3, "  Looks good ");
    call = lastCall(fetchMock);
    expect(call.body).toEqual({ expected_version: 3, reviewer_note: "Looks good" });

    await api.emailDrafts.reject("ed/2", 4, "Too long");
    call = lastCall(fetchMock);
    expect([call.method, call.url, call.body]).toEqual([
      "POST",
      "http://api.test/v1/admin/email-drafts/ed%2F2/reject",
      { expected_version: 4, reviewer_note: "Too long" },
    ]);
  });

  it("turns a stale review decision into the reload message", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(jsonResponse(409, { code: "STALE_VERSION", message: "stale", request_id: "r", field_errors: [] })),
    );
    const error = await platform(fetchMock).emailDrafts.reject("ed-1", 1, "x").catch((e) => e);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const failure = describeMutationError(error);
    expect(failure.stale).toBe(true);
    expect(failure.message).toBe(STALE_VERSION_MESSAGE);
  });
});

const emailDraft: AdminEmailDraft = {
  id: "ed-1",
  name: "Renewal reminder",
  category: "BILLING",
  subject: "Your plan renews soon",
  headline: "Heads up",
  body_text: "Your plan renews in 7 days.",
  body_html: "<p>Your plan renews in 7 days.</p>",
  cta_label: "Review plan",
  audience_description: "Owners on paid plans",
  status: "SUBMITTED",
  author_type: "OPERATOR",
  created_by: "op-1",
  created_by_email: "dana@prowise.test",
  submitted_at: "2026-11-22T10:00:00Z",
  reviewed_by: null,
  reviewed_at: null,
  reviewer_note: null,
  created_at: "2026-11-21T10:00:00Z",
  updated_at: "2026-11-22T10:00:00Z",
  version: 3,
};

describe("operator review workflow: Super Admin screens", () => {
  const api = createPlatformApi({ call: vi.fn() });

  it("marks operator-submitted announcements Pending review with the author, Publish and Request changes", () => {
    const pending = {
      ...announcement,
      id: "an-9",
      title: "Operator maintenance notice",
      status: "PENDING_REVIEW",
      created_by: "dana@prowise.test",
      submitted_by: "dana@prowise.test",
    };
    const rows = [announcement, pending];
    expect(pendingReviewCount(rows)).toBe(1);
    expect(isPendingReview(pending)).toBe(true);
    expect(operatorAuthor(pending)).toBe("dana@prowise.test");
    expect(reviewNoteError("  ")).toBeTruthy();
    expect(reviewNoteError("Fix it")).toBeNull();

    const markup = renderToStaticMarkup(<AnnouncementsView state={{ status: "ready", data: rows }} onRetry={noop} api={api} plans={[]} organizations={[]} />);
    expect(markup).toContain("Pending review");
    expect(markup).toContain("Operator draft by dana@prowise.test");
    expect(markup).toContain("Request changes");
    expect(markup).toContain("Publish");
    expect((markup.match(/data-pending-review="true"/g) ?? []).length).toBe(1);
    // The tab carries the count; the status filter offers the review states.
    expect(markup.replace(/<[^>]+>/g, " ")).toMatch(/Pending review\s+1/);
    expect(markup).toContain('value="PENDING_REVIEW"');
    expect(markup).toContain('value="CHANGES_REQUESTED"');
    // Existing counts and controls are untouched.
    expect(announcementCounts(rows)).toEqual({ total: 2, published: 0, scheduled: 0, draft: 1, archived: 0 });
    expect(markup).toContain("New Announcement");
  });

  it("does not offer Request changes on admin drafts", () => {
    const markup = renderToStaticMarkup(<AnnouncementsView state={{ status: "ready", data: [announcement] }} onRetry={noop} api={api} plans={[]} organizations={[]} />);
    expect(markup).not.toContain("Request changes<");
    expect(markup).not.toContain('data-pending-review="true"');
  });

  it("lists operator email drafts with Preview, Approve and Reject only for submitted drafts", () => {
    const approved = {
      ...emailDraft,
      id: "ed-2",
      name: "Welcome tips",
      status: "APPROVED",
      reviewer_note: "Fine",
      reviewed_at: "2026-11-23T10:00:00Z",
      reviewed_by: "admin@example.test",
    };
    const markup = renderToStaticMarkup(
      <OperatorEmailDraftsView
        state={{ status: "ready", data: { items: [emailDraft, approved], total: 2, page: 0, size: 25 } }}
        onRetry={noop}
        api={api}
        status="ALL"
        onStatusChange={noop}
        page={1}
        pageSize={25}
        onPageChange={noop}
        onPageSizeChange={noop}
      />,
    );
    expect(markup).toContain("Operator drafts");
    expect(markup).toContain("Renewal reminder");
    expect(markup).toContain("dana@prowise.test");
    expect(markup).toContain("Awaiting review");
    expect(markup).toContain("Note: Fine");
    expect((markup.match(/>Preview</g) ?? []).length).toBe(2);
    expect((markup.match(/>Approve</g) ?? []).length).toBe(1);
    expect((markup.match(/>Reject</g) ?? []).length).toBe(1);
    expect(markup.replace(/<[^>]+>/g, "")).toContain("Showing 1–2 of 2");
    // The HTML body is never injected into the page.
    expect(markup).not.toContain("<p>Your plan renews in 7 days.</p>");
    expect(canReviewEmailDraft(emailDraft)).toBe(true);
    expect(canReviewEmailDraft(approved)).toBe(false);
    expect(rejectNoteError("")).toBeTruthy();
    expect(EMAIL_DRAFT_STATUS_OPTIONS).toContain("SUBMITTED");
  });

  it("shows loading, empty and error states for operator drafts", () => {
    const props = { onRetry: noop, api, status: "SUBMITTED", onStatusChange: noop, page: 1, pageSize: 25, onPageChange: noop, onPageSizeChange: noop };
    expect(renderToStaticMarkup(<OperatorEmailDraftsView {...props} state={{ status: "loading" }} />)).toContain('aria-label="Loading"');
    expect(
      renderToStaticMarkup(<OperatorEmailDraftsView {...props} state={{ status: "ready", data: { items: [], total: 0, page: 0, size: 25 } }} />),
    ).toContain("No operator drafts");
    const error = renderToStaticMarkup(<OperatorEmailDraftsView {...props} state={{ status: "error", message: "Denied" }} />);
    expect(error).toContain("Denied");
    expect(error).toContain("Retry");
  });

  it("the review screens read only the server and never inject draft HTML", () => {
    const root = resolve(__dirname, "../src");
    for (const file of ["components/super-admin/OperatorEmailDraftsView.tsx", "app/(platform)/super-admin/email-templates/page.tsx"]) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source).not.toMatch(/useSuperAdminStore|_store\/|_data\/seed|withSimulatedRequest|localStorage\.setItem/);
      expect(source).not.toMatch(/dangerouslySetInnerHTML/);
    }
    const view = readFileSync(join(root, "components/super-admin/OperatorEmailDraftsView.tsx"), "utf8");
    expect(view).toContain('sandbox=""');
    expect(readFileSync(join(root, "app/(platform)/super-admin/email-templates/page.tsx"), "utf8")).toContain("Operator drafts");
  });
});
