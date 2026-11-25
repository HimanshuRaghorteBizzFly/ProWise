import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ApiError, IDEMPOTENCY_KEY_HEADER, createApiClient } from "../src/lib/api";
import { createCommercialApi, type CallInit } from "../src/lib/admin-api/commercial";
import type {
  CommercialInvoice,
  CommercialOrganization,
  CommercialPayment,
  CommercialPlan,
  CommercialSubscription,
} from "../src/types/admin-commercial";
import type { ResourceState } from "../src/components/super-admin/admin-resource";
import {
  STALE_VERSION_MESSAGE,
  MutationErrorNotice,
  describeMutationError,
} from "../src/components/super-admin/commercial/mutation";
import {
  PlanFormModal,
  PlansView,
  planBodyFromForm,
  planFormValues,
  planUpdateBody,
  validatePlanForm,
} from "../src/components/super-admin/commercial/PlansView";
import { SubscriptionsView, subscriptionActions } from "../src/components/super-admin/commercial/SubscriptionsView";
import { PaymentsView, paymentActions, validateRefund } from "../src/components/super-admin/commercial/PaymentsView";
import { InvoicesView, invoiceActions } from "../src/components/super-admin/commercial/InvoicesView";
import { buildLookups } from "../src/components/super-admin/commercial/shared";
import {
  OrganizationFormModal,
  OrganizationsView,
  organizationActions,
  validateOrganizationForm,
} from "../src/components/super-admin/OrganizationsView";
import { OperatorsView, validateOperatorForm } from "../src/components/super-admin/OperatorsView";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function setup(response: () => Response = () => jsonResponse(200, {})) {
  const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(response()));
  const client = createApiClient({ baseUrl: "http://api.test", fetch: fetchMock as unknown as typeof fetch, onSessionExpired: () => {} });
  const api = createCommercialApi(<T,>(path: string, init: CallInit = {}) => client.call<T>(path, init));
  const calls = () =>
    fetchMock.mock.calls.map(([url, init]) => ({
      url: String(url).replace("http://api.test", ""),
      method: init.method as string,
      body: init.body ? JSON.parse(init.body as string) : undefined,
      key: new Headers(init.headers).get(IDEMPOTENCY_KEY_HEADER),
    }));
  return { api, calls, fetchMock };
}

const noop = () => {};
const loading = { status: "loading" } as const;

const plan: CommercialPlan = {
  id: "plan-team",
  code: "TEAM",
  name: "Team",
  tagline: "For growing teams",
  monthly_price: 10,
  annual_price: 96,
  currency: "USD",
  status: "ACTIVE",
  is_popular: true,
  badge_label: null,
  brand_color: "violet",
  ai_token_quota: null,
  trial_days: 14,
  limits: { max_seats: 25, max_projects: 40, max_workspaces: 2, storage_gb: 100, api_rate_limit_per_min: 600 },
  features: ["SSO", "Audit export"],
  created_at: null,
  updated_at: null,
  version: 3,
};

const org: CommercialOrganization = {
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
  version: 7,
};

const lookups = buildLookups({ status: "ready", data: [org] }, { status: "ready", data: [plan] });

/* ------------------------------------------------------------------ typed client: paths, methods, versions */

describe("commercial client", () => {
  it("sends expected_version on plan updates and state changes, ?expectedVersion on DELETE, none on create", async () => {
    const { api, calls } = setup();
    await api.plans.create({ name: "Team" });
    await api.plans.update("plan-team", 3, { name: "Team 2" });
    await api.plans.toggleArchive("plan-team", 3);
    await api.plans.remove("plan-team", 3);

    expect(calls()).toMatchObject([
      { url: "/v1/admin/plans", method: "POST", body: { name: "Team" } },
      { url: "/v1/admin/plans/plan-team", method: "PATCH", body: { name: "Team 2", expected_version: 3 } },
      { url: "/v1/admin/plans/plan-team/archive", method: "POST", body: { expected_version: 3 } },
      { url: "/v1/admin/plans/plan-team?expectedVersion=3", method: "DELETE", body: undefined },
    ]);
    expect(calls()[0].body).not.toHaveProperty("expected_version");
  });

  it("covers organization create, update, suspend, reactivate, bulk suspend and delete", async () => {
    const { api, calls } = setup();
    await api.organizations.create({ name: "A", slug: "a", owner_name: "O", owner_email: "o@a.test" });
    await api.organizations.update("o1", 7, { name: "B" });
    await api.organizations.suspend("o1", 7, "Unpaid");
    await api.organizations.reactivate("o1", 8);
    await api.organizations.bulkSuspend([{ id: "o1", version: 8 }, { id: "o2", version: 2 }], "Abuse");
    await api.organizations.remove("o1", 9);

    expect(calls()).toMatchObject([
      { url: "/v1/admin/organizations", method: "POST" },
      { url: "/v1/admin/organizations/o1", method: "PUT", body: { name: "B", expected_version: 7 } },
      { url: "/v1/admin/organizations/o1/suspend", method: "POST", body: { reason: "Unpaid", expected_version: 7 } },
      { url: "/v1/admin/organizations/o1/reactivate", method: "POST", body: { expected_version: 8 } },
      {
        url: "/v1/admin/organizations/bulk-suspend",
        method: "POST",
        body: { reason: "Abuse", items: [{ id: "o1", expected_version: 8 }, { id: "o2", expected_version: 2 }] },
      },
      { url: "/v1/admin/organizations/o1?expectedVersion=9", method: "DELETE" },
    ]);
  });

  it("covers subscription, payment and invoice state changes with their versions", async () => {
    const { api, calls } = setup();
    await api.subscriptions.assign({ org_id: "o1", plan_id: "plan-team" });
    await api.subscriptions.update("s1", 4, { seats: 12 });
    await api.subscriptions.renew("s1", 4);
    await api.subscriptions.cancel("s1", 5, true);
    await api.subscriptions.reactivate("s1", 6);
    await api.subscriptions.remove("s1", 7);
    await api.payments.record({ org_id: "o1", amount: 10, description: "Wire" });
    await api.payments.update("p1", 1, { status: "FAILED" });
    await api.payments.retry("p1", 2);
    await api.payments.refund("p1", 3, { amount: 5, reason: "Duplicate" });
    await api.payments.bulkDelete([{ id: "p1", version: 4 }]);
    await api.payments.remove("p2", 1);
    await api.invoices.create({ org_id: "o1", line_items: [{ description: "Seats", quantity: 2, unit_price: 5 }] });
    await api.invoices.update("i1", 2, { notes: "n" });
    await api.invoices.markPaid("i1", 3, "p1");
    await api.invoices.voidInvoice("i1", 4);
    await api.invoices.remove("i1", 5);

    expect(calls()).toMatchObject([
      { url: "/v1/admin/subscriptions", method: "POST", body: { org_id: "o1", plan_id: "plan-team" } },
      { url: "/v1/admin/subscriptions/s1", method: "PATCH", body: { seats: 12, expected_version: 4 } },
      { url: "/v1/admin/subscriptions/s1/renew", method: "POST", body: { expected_version: 4 } },
      { url: "/v1/admin/subscriptions/s1/cancel", method: "POST", body: { immediate: true, expected_version: 5 } },
      { url: "/v1/admin/subscriptions/s1/reactivate", method: "POST", body: { expected_version: 6 } },
      { url: "/v1/admin/subscriptions/s1?expectedVersion=7", method: "DELETE" },
      { url: "/v1/admin/payments", method: "POST", body: { org_id: "o1", amount: 10, description: "Wire" } },
      { url: "/v1/admin/payments/p1", method: "PUT", body: { status: "FAILED", expected_version: 1 } },
      { url: "/v1/admin/payments/p1/retry", method: "POST", body: { expected_version: 2 } },
      { url: "/v1/admin/payments/p1/refund", method: "POST", body: { amount: 5, reason: "Duplicate", expected_version: 3 } },
      { url: "/v1/admin/payments/bulk-delete", method: "POST", body: { items: [{ id: "p1", expected_version: 4 }] } },
      { url: "/v1/admin/payments/p2?expectedVersion=1", method: "DELETE" },
      { url: "/v1/admin/invoices", method: "POST" },
      { url: "/v1/admin/invoices/i1", method: "PUT", body: { notes: "n", expected_version: 2 } },
      { url: "/v1/admin/invoices/i1/mark-paid", method: "POST", body: { payment_id: "p1", expected_version: 3 } },
      { url: "/v1/admin/invoices/i1/void", method: "POST", body: { expected_version: 4 } },
      { url: "/v1/admin/invoices/i1?expectedVersion=5", method: "DELETE" },
    ]);
  });

  it("covers roles and platform operators", async () => {
    const { api, calls } = setup();
    await api.roles.create({ name: "Auditor", slug: "auditor", permissions: ["audit.read"] });
    await api.roles.update("r1", 2, { description: "Audit only" }); // task 1.5: capabilities have their own route
    await api.roles.clone("r1", { new_name: "Copy", new_slug: "copy" });
    await api.roles.toggleActive("r1", 3);
    await api.roles.remove("r1", 4);
    await api.operators.create({ name: "Op", email: "op@x.test", department: "platform-operations" });
    await api.operators.update("op-1", 5, { on_call: true });
    await api.operators.setStatus("op-1", 6, "SUSPENDED");
    await api.operators.resendInvite("op-1");
    await api.operators.revokeSessions("op-1");
    await api.operators.remove("op-1", 7);

    expect(calls()).toMatchObject([
      { url: "/v1/admin/roles", method: "POST" },
      { url: "/v1/admin/roles/r1", method: "PUT", body: { description: "Audit only", expected_version: 2 } },
      { url: "/v1/admin/roles/r1/clone", method: "POST", body: { new_name: "Copy", new_slug: "copy" } },
      { url: "/v1/admin/roles/r1/toggle-active", method: "POST", body: { expected_version: 3 } },
      { url: "/v1/admin/roles/r1?expectedVersion=4", method: "DELETE" },
      { url: "/v1/operators", method: "POST" },
      { url: "/v1/operators/op-1", method: "PATCH", body: { on_call: true, expected_version: 5 } },
      { url: "/v1/operators/op-1/status", method: "PATCH", body: { status: "SUSPENDED", expected_version: 6 } },
      { url: "/v1/operators/op-1/resend-invite", method: "POST", body: undefined },
      { url: "/v1/operators/op-1/revoke-sessions", method: "POST", body: undefined },
      { url: "/v1/operators/op-1?expectedVersion=7", method: "DELETE" },
    ]);
    expect(calls()[2].body).not.toHaveProperty("expected_version");
  });

  it("drops ALL / empty list filters and uses the backend's query names", async () => {
    const { api, calls } = setup(() => jsonResponse(200, []));
    await api.subscriptions.list({ status: "ALL", planId: "plan-team" });
    await api.payments.list({ status: "FAILED", search: "" });
    await api.invoices.list({ orgId: "o1", status: "ALL", search: "INV" });
    await api.operators.list({ department: "ALL", status: "INVITED" });
    expect(calls().map((c) => c.url)).toEqual([
      "/v1/admin/subscriptions?planId=plan-team",
      "/v1/admin/payments?status=FAILED",
      "/v1/admin/invoices?orgId=o1&search=INV",
      "/v1/operators?status=INVITED",
    ]);
  });

  it("reuses the caller's Idempotency-Key when the same change is retried", async () => {
    const responses = [
      jsonResponse(503, { code: "UNAVAILABLE", message: "down", request_id: "r" }),
      jsonResponse(200, { ...plan, version: 4 }),
    ];
    const { api, calls } = setup(() => responses.shift()!);
    await api.plans.update("plan-team", 3, { name: "Team" }, "key-1").catch(() => null);
    await api.plans.update("plan-team", 3, { name: "Team" }, "key-1");
    expect(calls().map((c) => c.key)).toEqual(["key-1", "key-1"]);
  });
});

/* ------------------------------------------------------------------ stale version and server field errors */

describe("409 STALE_VERSION handling", () => {
  const stale = () => jsonResponse(409, { code: "STALE_VERSION", message: "Version 3 is stale", request_id: "r1", field_errors: [] });

  it("turns a stale write into the reload message, never a silent overwrite", async () => {
    const { api, fetchMock } = setup(stale);
    const error = await api.plans.update("plan-team", 3, { name: "X" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const failure = describeMutationError(error);
    expect(failure).toEqual({ kind: "stale", message: STALE_VERSION_MESSAGE });
    expect(STALE_VERSION_MESSAGE).toBe("This record was changed by someone else. Reload to see the latest version.");
  });

  it("shows the message with a Reload action in the notice and in an open form, with Save disabled", () => {
    const failure = describeMutationError(new ApiError(409, "STALE_VERSION", "stale", "r"));
    const notice = renderToStaticMarkup(<MutationErrorNotice failure={failure} onReload={noop} />);
    expect(notice).toContain(STALE_VERSION_MESSAGE);
    expect(notice).toContain("Reload");

    const form = renderToStaticMarkup(
      <PlanFormModal isOpen plan={plan} busy={false} failure={failure} onReload={noop} onClose={noop} onSubmit={noop} />,
    );
    expect(form).toContain(STALE_VERSION_MESSAGE);
    expect(form).toMatch(/<button disabled=""[^>]*type="submit"[^>]*>Save Plan<\/button>/);
  });

  it("treats other 409s as ordinary errors and shows server field errors next to the field", () => {
    const conflict = describeMutationError(new ApiError(409, "DUPLICATE_SLUG", "Slug taken", "r"));
    expect(conflict).toMatchObject({ kind: "error", message: "Slug taken" });

    const failure = describeMutationError(
      new ApiError(400, "VALIDATION_FAILED", "Invalid", "r", [{ field: "owner_email", message: "must be a well-formed email address" }]),
    );
    const markup = renderToStaticMarkup(
      <OrganizationFormModal isOpen org={null} plans={[plan]} busy={false} failure={failure} onReload={noop} onClose={noop} onCreate={noop} onUpdate={noop} />,
    );
    expect(markup).toContain("must be a well-formed email address");
    expect(markup).toContain("The change was not saved");
  });
});

/* ------------------------------------------------------------------ client-side validation mirrors the backend */

describe("form validation", () => {
  it("plans: name required, prices and limits non-negative", () => {
    const v = { ...planFormValues(null), name: " ", monthly_price: "-1", max_seats: "5" };
    const errors = validatePlanForm(v, true);
    expect(errors.name).toBeTruthy();
    expect(errors.monthly_price).toBeTruthy();
    expect(errors.max_projects).toBe("Required when any limit is set.");
    const body = planBodyFromForm(planFormValues(plan));
    expect(body.limits).toEqual(plan.limits);
    expect(planUpdateBody(body)).not.toHaveProperty("code");
  });

  it("organizations: owner email format and required fields", () => {
    const base = { name: "A", slug: "a", domain: "", industry: "", country: "", timezone: "UTC", owner_name: "O", owner_email: "bad", plan_id: "", seats_limit: "", notes: "" };
    expect(validateOrganizationForm(base, true).owner_email).toBe("Enter a valid email address.");
    expect(validateOrganizationForm({ ...base, slug: "", owner_email: "o@a.test" }, true)).toEqual({ slug: "Slug is required." });
    expect(validateOrganizationForm({ ...base, owner_email: "o@a.test", timezone: "Mars/Base" }, true).timezone).toBeTruthy();
  });

  it("refunds: at least 0.01, not more than the remaining amount, reason required", () => {
    expect(validateRefund("0", "x", 10).amount).toBeTruthy();
    expect(validateRefund("11", "x", 10).amount).toBe("At most 10.00 can be refunded.");
    expect(validateRefund("5", " ", 10).reason).toBeTruthy();
    expect(validateRefund("5", "Duplicate", 10)).toEqual({});
  });

  it("operators: a department operator needs a department; the super admin role is not assignable", () => {
    const v = { name: "Op", email: "op@x.test", role_id: "role-super-admin", access_level: "DEPARTMENT_OPERATOR" as const, department: "", mfa_enabled: true, on_call: false, shift_name: "" };
    const errors = validateOperatorForm(v);
    expect(errors.department).toBeTruthy();
    expect(errors.role_id).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ views: real data, empty and error states */

describe("Plans view", () => {
  const base = {
    subscriptions: { status: "ready", data: [] } as ResourceState<CommercialSubscription[]>,
    billingView: "MONTHLY" as const,
    showArchived: false,
    onBillingViewChange: noop,
    onToggleArchived: noop,
    onRetry: noop,
    onCreate: noop,
    onEdit: noop,
    onArchive: noop,
    onDelete: noop,
  };

  it("renders plan cards from the server with prices, quotas, features and actions", () => {
    const markup = renderToStaticMarkup(<PlansView {...base} state={{ status: "ready", data: [plan] }} />);
    expect(markup).toContain("Billing is dormant");
    expect(markup).toContain("TEAM");
    expect(markup).toContain("$10.00");
    expect(markup).toContain("Annual plan: $96.00/yr");
    expect(markup).toContain("Save 20% yearly");
    expect(markup).toContain("600");
    expect(markup).toContain("SSO");
    expect(markup).toContain("0 subscriptions");
    for (const label of ["Customize", "Archive", "Create Plan", "Show Archived", "Monthly", "Annual"]) expect(markup).toContain(label);
    expect(markup).not.toMatch(/MRR/);
  });

  it("hides archived plans until Show Archived and shows empty, loading and error states", () => {
    const archived = { ...plan, status: "ARCHIVED" };
    expect(renderToStaticMarkup(<PlansView {...base} state={{ status: "ready", data: [archived] }} />)).toContain("Only archived plans");
    expect(renderToStaticMarkup(<PlansView {...base} showArchived state={{ status: "ready", data: [archived] }} />)).toContain("Restore");
    expect(renderToStaticMarkup(<PlansView {...base} state={{ status: "ready", data: [] }} />)).toContain("No plans stored");
    expect(renderToStaticMarkup(<PlansView {...base} state={loading} />)).toContain('aria-label="Loading"');
    const error = renderToStaticMarkup(<PlansView {...base} state={{ status: "error", message: "Cannot reach the ProWise server." }} />);
    expect(error).toContain("Cannot reach the ProWise server.");
    expect(error).toContain("Retry");
  });
});

describe("Subscriptions, payments and invoices views", () => {
  const sub: CommercialSubscription = {
    id: "sub-1",
    org_id: "o1",
    plan_id: "plan-team",
    billing_cycle: "ANNUAL",
    status: "ACTIVE",
    seats: 12,
    amount: 96,
    currency: "USD",
    current_period_start: "2026-01-01T00:00:00Z",
    current_period_end: "2027-01-01T00:00:00Z",
    auto_renew: true,
    cancel_at_period_end: false,
    payment_method_label: null,
    created_at: null,
    updated_at: null,
    version: 1,
  };
  const subBase = {
    lookups,
    search: "",
    status: "ALL",
    planId: "ALL",
    cycle: "ALL",
    onSearchChange: noop,
    onStatusChange: noop,
    onPlanChange: noop,
    onCycleChange: noop,
    onRetry: noop,
    onAssign: noop,
    onAction: noop,
  };

  it("subscriptions: rows resolve org and plan names; actions follow the state", () => {
    const markup = renderToStaticMarkup(<SubscriptionsView {...subBase} state={{ status: "ready", data: [sub] }} />);
    expect(markup).toContain("Northwind");
    expect(markup).toContain("Team");
    expect(markup).toContain("Annual");
    expect(markup).toContain("Assign Subscription");
    expect(subscriptionActions(sub)).toEqual(["edit", "renew", "cancel", "delete"]);
    expect(subscriptionActions({ ...sub, status: "CANCELLED" })).toEqual(["edit", "reactivate", "delete"]);
    expect(renderToStaticMarkup(<SubscriptionsView {...subBase} state={{ status: "ready", data: [] }} />)).toContain("No subscriptions stored");
  });

  const payment: CommercialPayment = {
    id: "pay-1",
    transaction_ref: "TXN-1",
    org_id: "o1",
    subscription_id: null,
    invoice_id: null,
    amount: 50,
    refunded_amount: 10,
    currency: "USD",
    status: "PARTIALLY_REFUNDED",
    method: "WIRE",
    method_last4: "1234",
    gateway_label: null,
    description: "Manual wire",
    failure_reason: null,
    refund_reason: null,
    created_at: "2026-11-02T00:00:00Z",
    updated_at: null,
    version: 2,
  };
  const payBase = {
    lookups,
    search: "",
    status: "ALL",
    method: "ALL",
    onSearchChange: noop,
    onStatusChange: noop,
    onMethodChange: noop,
    onRetry: noop,
    onRecord: noop,
    onAction: noop,
  };

  it("payments: KPIs come from the summary endpoint only; refund and retry follow the state", () => {
    const markup = renderToStaticMarkup(
      <PaymentsView
        {...payBase}
        state={{ status: "ready", data: [payment] }}
        summary={{ status: "ready", data: { total_transactions: 4, total_volume: 200, refunded_volume: 10, successful_count: 3, failed_count: 1 } }}
      />,
    );
    expect(markup).toContain("TXN-1");
    expect(markup).toContain("$190.00");
    expect(markup).toContain("75.0%");
    expect(markup).toContain("-$10.00 refunded");
    expect(markup).not.toMatch(/Collected Volume|Settlement Mix|Simulated/);
    expect(paymentActions(payment)).toEqual(["view", "edit", "refund", "delete"]);
    expect(paymentActions({ ...payment, status: "FAILED" })).toEqual(["view", "edit", "retry", "delete"]);

    const failed = renderToStaticMarkup(
      <PaymentsView {...payBase} state={{ status: "error", message: "boom" }} summary={{ status: "error", message: "nope" }} />,
    );
    expect(failed).toContain("boom");
    expect(failed).toContain("Retry");
    expect(failed).toContain("Summary unavailable: nope");
  });

  const invoice: CommercialInvoice = {
    id: "inv-1",
    invoice_number: "INV-2026-001",
    org_id: "o1",
    subscription_id: null,
    payment_id: null,
    issue_date: "2026-11-01",
    due_date: "2026-11-30",
    status: "OPEN",
    subtotal: 100,
    tax_rate: 10,
    tax_amount: 10,
    total: 110,
    line_items: [{ id: "li-1", description: "Seats", quantity: 10, unit_price: 10, total: 100 }],
    notes: null,
    paid_at: null,
    created_at: null,
    updated_at: null,
    version: 1,
  };

  it("invoices: rows, date-only dates as sent, and no reminder button (the endpoint sends no email)", () => {
    const markup = renderToStaticMarkup(
      <InvoicesView
        state={{ status: "ready", data: [invoice] }}
        summary={{ status: "ready", data: { total_invoices: 1, total_billed: 110, total_paid: 0, total_outstanding: 110, overdue_count: 0 } }}
        lookups={lookups}
        search=""
        status="ALL"
        orgId="ALL"
        onSearchChange={noop}
        onStatusChange={noop}
        onOrgChange={noop}
        onRetry={noop}
        onCreate={noop}
        onAction={noop}
      />,
    );
    expect(markup).toContain("INV-2026-001");
    expect(markup).toContain("2026-11-30");
    expect(markup).toContain("$110.00");
    expect(markup).toContain("Generate Invoice");
    expect(markup).not.toMatch(/reminder/i);
    expect(invoiceActions(invoice)).toEqual(["view", "edit", "mark-paid", "void", "delete"]);
    expect(invoiceActions({ ...invoice, status: "PAID" })).toEqual(["view", "delete"]);
  });
});

describe("Roles, organizations and operators views", () => {
  // Roles: the persisted governance view replaced RolesView (task 1.5); its assertions (system cards, "grants
  // nothing by itself", system roles cannot be deleted, empty and error states) live in super-admin-roles.test.tsx.


  it("organizations: plan names, seats, row actions and bulk selection", () => {
    const markup = renderToStaticMarkup(
      <OrganizationsView
        state={{ status: "ready", data: [org] }}
        summary={{ status: "ready", data: { total_orgs: 1, active_orgs: 1, trial_orgs: 0, suspended_orgs: 0, total_mrr: null } }}
        search=""
        status="ALL"
        onSearchChange={noop}
        onStatusChange={noop}
        onRetry={noop}
        onOpen={noop}
        detail={null}
        onCloseDetail={noop}
        onRetryDetail={noop}
        plans={[plan]}
        onPlanChange={noop}
        onCreate={noop}
        onAction={noop}
        onExport={noop}
        selectedIds={["o1"]}
        onSelectedIdsChange={noop}
        onBulkSuspend={noop}
      />,
    );
    expect(markup).toContain("Team");
    expect(markup).toContain("3 / 10");
    expect(markup).toContain("Create Organization");
    expect(markup).toContain("Suspend selected");
    expect(organizationActions(org)).toEqual(["view", "edit", "suspend", "delete"]);
    expect(organizationActions({ ...org, status: "SUSPENDED" })).toEqual(["view", "edit", "reactivate", "delete"]);
  });

  it("operators: error state with Retry and no invented rows", () => {
    const markup = renderToStaticMarkup(
      <OperatorsView
        state={{ status: "error", message: "Cannot reach the ProWise server." }}
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
        onCreate={noop}
      />,
    );
    expect(markup).toContain("Cannot reach the ProWise server.");
    expect(markup).toContain("Retry");
    expect(markup).toContain("Invite Operator");
    expect(markup).not.toContain("<tbody");
  });
});

/* ------------------------------------------------------------------ source guards */

describe("no demo store, seed data or simulated requests in these pages", () => {
  const root = resolve(__dirname, "../src");
  const files = [
    "app/(platform)/super-admin/organizations/page.tsx",
    "app/(platform)/super-admin/plans/page.tsx",
    "app/(platform)/super-admin/subscriptions/page.tsx",
    "app/(platform)/super-admin/payments/page.tsx",
    "app/(platform)/super-admin/invoices/page.tsx",
    "app/(platform)/super-admin/roles-permissions/page.tsx",
    "app/(platform)/super-admin/roles/page.tsx",
    "app/(platform)/super-admin/operators/page.tsx",
    "components/super-admin/OrganizationsView.tsx",
    "components/super-admin/OperatorsView.tsx",
    "components/super-admin/commercial/mutation.tsx",
    "components/super-admin/commercial/shared.tsx",
    "components/super-admin/commercial/PlansView.tsx",
    "components/super-admin/commercial/SubscriptionsView.tsx",
    "components/super-admin/commercial/PaymentsView.tsx",
    "components/super-admin/commercial/InvoicesView.tsx",
    "components/super-admin/roles/RolesGovernanceView.tsx",
    "components/super-admin/roles/RoleDialogs.tsx",
    "components/super-admin/roles/role-model.ts",
    "lib/admin-api/commercial.ts",
  ];

  it.each(files)("%s", (file) => {
    const source = readFileSync(resolve(root, file), "utf8");
    expect(source).not.toMatch(/useSuperAdminStore|_store\/|_data\/seed|withSimulatedRequest|super-admin-service|localStorage\.setItem/);
    expect(source).not.toMatch(/ComparisonBarChart|SuperAdminCharts/);
  });
});

describe("organization form reference lists", () => {
  it("offers real countries, IANA time zones (UTC first) and keeps an older free-text value", async () => {
    const { countryNames, timeZones, selectOptions, INDUSTRIES } = await import("../src/lib/reference-options");
    const countries = countryNames();
    expect(countries).toContain("India");
    expect(countries).toContain("United States");
    expect(countries).not.toContain("European Union");
    expect(countries).not.toContain("Pseudo-Accents");
    expect(countries.length).toBeGreaterThan(190);
    expect(timeZones()[0]).toBe("UTC");
    expect(timeZones()).toContain("Asia/Kolkata");
    expect(INDUSTRIES).toContain("Other");
    const opts = selectOptions(INDUSTRIES, "Space Mining", "Select industry");
    expect(opts[0]).toEqual({ label: "Select industry", value: "" });
    expect(opts.at(-1)).toEqual({ label: "Space Mining", value: "Space Mining" });
  });
});

describe("plan templates", () => {
  it("offer the four starting points with consistent pricing and never store anything by themselves", async () => {
    const { PLAN_TEMPLATES, validatePlanForm, planBodyFromForm } = await import("../src/components/super-admin/commercial/PlansView");
    expect(PLAN_TEMPLATES.map((t) => t.values.code)).toEqual(["FREE", "STARTER", "PROFESSIONAL", "ENTERPRISE"]);
    for (const t of PLAN_TEMPLATES) {
      const values = { ...t.values, features: [...t.values.features] };
      expect(validatePlanForm(values, true)).toEqual({});
      const body = planBodyFromForm(values);
      expect(body.limits).not.toBeNull();
      expect(body.features!.length).toBeGreaterThan(0);
    }
    const pro = PLAN_TEMPLATES.find((t) => t.key === "professional")!;
    expect(pro.values.is_popular).toBe(true);
    expect(planBodyFromForm({ ...pro.values, features: [...pro.values.features] }).monthly_price).toBe(1299);
  });
});
