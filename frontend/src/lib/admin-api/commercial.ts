/**
 * Typed Super Admin client for organizations, billing (dormant), roles and platform operators. Every call goes
 * through `apiClient.call` (auth header, token refresh, Idempotency-Key on mutations, ApiError on failure).
 *
 * Optimistic locking: updates and state changes send `expected_version` (the `version` of the record as last read)
 * in the JSON body, DELETE sends `?expectedVersion=<n>`. A stale value comes back as 409 STALE_VERSION and is never
 * retried or overwritten automatically. Creates send no version.
 */
import { apiClient, queryString } from "@/lib/api";
import type { AdminOperatorPermissions } from "@/types/admin";
import type {
  AssignSubscriptionBody,
  CloneRoleBody,
  CommercialInvoice,
  CommercialInvoiceSummary,
  CommercialOperator,
  CommercialOrganization,
  CommercialOrganizationSummary,
  CommercialPayment,
  CommercialPermission,
  CommercialPlan,
  CommercialRole,
  CommercialSubscription,
  CreateInvoiceBody,
  CreateOperatorBody,
  CreateOrganizationBody,
  CreatePlanBody,
  CreateRoleBody,
  OperatorDepartment,
  OperatorRoleOption,
  PaymentQuery,
  PaymentSummary,
  RecordPaymentBody,
  RefundPaymentBody,
  UpdateInvoiceBody,
  UpdateOperatorBody,
  UpdateOrganizationBody,
  UpdatePaymentBody,
  UpdatePlanBody,
  UpdateRoleBody,
  UpdateSubscriptionBody,
} from "@/types/admin-commercial";
import type { CompareResult, HolderMatch, ResyncResult, RoleHistoryEntry, RoleHolder } from "@/types/admin-roles";

export interface CallInit {
  method?: string;
  body?: unknown;
  /** Reused when the person retries the same change, so the server applies it at most once. */
  idempotencyKey?: string;
}

export type CallFn = <T>(path: string, init?: CallInit) => Promise<T>;

/** Body of an update or state change: the fields plus the version the client last read. */
export function withVersion<B extends object>(body: B, version: number): B & { expected_version: number } {
  return { ...body, expected_version: version };
}

const enc = encodeURIComponent;

/** A record of a bulk operation: its ID and the version the client read. */
export interface VersionedId {
  id: string;
  version: number;
}

function versionedItems(items: VersionedId[]) {
  return items.map((i) => ({ id: i.id, expected_version: i.version }));
}

export function createCommercialApi(call: CallFn) {
  const get = <T>(path: string) => call<T>(path);
  const post = <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    call<T>(path, { method: "POST", body, idempotencyKey });
  const put = <T>(path: string, body: unknown, idempotencyKey?: string) =>
    call<T>(path, { method: "PUT", body, idempotencyKey });
  const patch = <T>(path: string, body: unknown, idempotencyKey?: string) =>
    call<T>(path, { method: "PATCH", body, idempotencyKey });
  const del = (path: string, version: number, idempotencyKey?: string) =>
    call<void>(`${path}?expectedVersion=${enc(String(version))}`, { method: "DELETE", idempotencyKey });

  return {
    organizations: {
      list: (params: { status?: string; planId?: string; search?: string } = {}) =>
        get<CommercialOrganization[]>(`/v1/admin/organizations${queryString(params)}`),
      get: (id: string) => get<CommercialOrganization>(`/v1/admin/organizations/${enc(id)}`),
      summary: () => get<CommercialOrganizationSummary>("/v1/admin/organizations/summary"),
      create: (body: CreateOrganizationBody, key?: string) =>
        post<CommercialOrganization>("/v1/admin/organizations", body, key),
      update: (id: string, version: number, body: UpdateOrganizationBody, key?: string) =>
        put<CommercialOrganization>(`/v1/admin/organizations/${enc(id)}`, withVersion(body, version), key),
      suspend: (id: string, version: number, reason: string, key?: string) =>
        post<CommercialOrganization>(`/v1/admin/organizations/${enc(id)}/suspend`, withVersion({ reason }, version), key),
      reactivate: (id: string, version: number, key?: string) =>
        post<CommercialOrganization>(`/v1/admin/organizations/${enc(id)}/reactivate`, withVersion({}, version), key),
      remove: (id: string, version: number, key?: string) => del(`/v1/admin/organizations/${enc(id)}`, version, key),
      /** All-or-nothing: one stale or unknown item refuses the whole batch. */
      bulkSuspend: (items: VersionedId[], reason: string, key?: string) =>
        post<void>("/v1/admin/organizations/bulk-suspend", { items: versionedItems(items), reason }, key),
    },
    plans: {
      list: () => get<CommercialPlan[]>("/v1/admin/plans"),
      get: (id: string) => get<CommercialPlan>(`/v1/admin/plans/${enc(id)}`),
      create: (body: CreatePlanBody, key?: string) => post<CommercialPlan>("/v1/admin/plans", body, key),
      update: (id: string, version: number, body: UpdatePlanBody, key?: string) =>
        patch<CommercialPlan>(`/v1/admin/plans/${enc(id)}`, withVersion(body, version), key),
      /** Toggles ACTIVE <-> ARCHIVED on the server. */
      toggleArchive: (id: string, version: number, key?: string) =>
        post<CommercialPlan>(`/v1/admin/plans/${enc(id)}/archive`, withVersion({}, version), key),
      remove: (id: string, version: number, key?: string) => del(`/v1/admin/plans/${enc(id)}`, version, key),
    },
    subscriptions: {
      list: (params: { planId?: string; status?: string } = {}) =>
        get<CommercialSubscription[]>(`/v1/admin/subscriptions${queryString(params)}`),
      get: (id: string) => get<CommercialSubscription>(`/v1/admin/subscriptions/${enc(id)}`),
      assign: (body: AssignSubscriptionBody, key?: string) =>
        post<CommercialSubscription>("/v1/admin/subscriptions", body, key),
      update: (id: string, version: number, body: UpdateSubscriptionBody, key?: string) =>
        patch<CommercialSubscription>(`/v1/admin/subscriptions/${enc(id)}`, withVersion(body, version), key),
      renew: (id: string, version: number, key?: string) =>
        post<CommercialSubscription>(`/v1/admin/subscriptions/${enc(id)}/renew`, withVersion({}, version), key),
      cancel: (id: string, version: number, immediate: boolean, key?: string) =>
        post<CommercialSubscription>(`/v1/admin/subscriptions/${enc(id)}/cancel`, withVersion({ immediate }, version), key),
      reactivate: (id: string, version: number, key?: string) =>
        post<CommercialSubscription>(`/v1/admin/subscriptions/${enc(id)}/reactivate`, withVersion({}, version), key),
      remove: (id: string, version: number, key?: string) => del(`/v1/admin/subscriptions/${enc(id)}`, version, key),
    },
    payments: {
      list: (params: PaymentQuery = {}) => get<CommercialPayment[]>(`/v1/admin/payments${queryString(params)}`),
      get: (id: string) => get<CommercialPayment>(`/v1/admin/payments/${enc(id)}`),
      summary: () => get<PaymentSummary>("/v1/admin/payments/summary"),
      record: (body: RecordPaymentBody, key?: string) => post<CommercialPayment>("/v1/admin/payments", body, key),
      update: (id: string, version: number, body: UpdatePaymentBody, key?: string) =>
        put<CommercialPayment>(`/v1/admin/payments/${enc(id)}`, withVersion(body, version), key),
      retry: (id: string, version: number, key?: string) =>
        post<CommercialPayment>(`/v1/admin/payments/${enc(id)}/retry`, withVersion({}, version), key),
      refund: (id: string, version: number, body: RefundPaymentBody, key?: string) =>
        post<CommercialPayment>(`/v1/admin/payments/${enc(id)}/refund`, withVersion(body, version), key),
      remove: (id: string, version: number, key?: string) => del(`/v1/admin/payments/${enc(id)}`, version, key),
      /** All-or-nothing: one stale or unknown item refuses the whole batch. */
      bulkDelete: (items: VersionedId[], key?: string) =>
        post<void>("/v1/admin/payments/bulk-delete", { items: versionedItems(items) }, key),
    },
    invoices: {
      list: (params: { orgId?: string; status?: string; search?: string } = {}) =>
        get<CommercialInvoice[]>(`/v1/admin/invoices${queryString(params)}`),
      get: (id: string) => get<CommercialInvoice>(`/v1/admin/invoices/${enc(id)}`),
      summary: () => get<CommercialInvoiceSummary>("/v1/admin/invoices/summary"),
      create: (body: CreateInvoiceBody, key?: string) => post<CommercialInvoice>("/v1/admin/invoices", body, key),
      update: (id: string, version: number, body: UpdateInvoiceBody, key?: string) =>
        put<CommercialInvoice>(`/v1/admin/invoices/${enc(id)}`, withVersion(body, version), key),
      markPaid: (id: string, version: number, paymentId?: string | null, key?: string) =>
        post<CommercialInvoice>(
          `/v1/admin/invoices/${enc(id)}/mark-paid`,
          withVersion({ payment_id: paymentId ?? null }, version),
          key,
        ),
      voidInvoice: (id: string, version: number, key?: string) =>
        post<CommercialInvoice>(`/v1/admin/invoices/${enc(id)}/void`, withVersion({}, version), key),
      remove: (id: string, version: number, key?: string) => del(`/v1/admin/invoices/${enc(id)}`, version, key),
    },
    /** Roles & Permissions Governance (task 1.5). Super Admin only. */
    roles: {
      list: () => get<CommercialRole[]>("/v1/admin/roles"),
      get: (id: string) => get<CommercialRole>(`/v1/admin/roles/${enc(id)}`),
      /** Capability catalog grouped by module. */
      permissions: () => get<CommercialPermission>("/v1/admin/permissions"),
      holders: (id: string) => get<RoleHolder[]>(`/v1/admin/roles/${enc(id)}/holders`),
      holderSearch: (q: string) => get<HolderMatch[]>(`/v1/admin/roles/holder-search${queryString({ q })}`),
      history: (id: string) => get<RoleHistoryEntry[]>(`/v1/admin/roles/${enc(id)}/history`),
      auditLog: () => get<RoleHistoryEntry[]>("/v1/admin/roles/audit-log"),
      compare: (ids: string[]) => get<CompareResult>(`/v1/admin/roles/compare?ids=${ids.map(enc).join(",")}`),
      create: (body: CreateRoleBody, key?: string) => post<CommercialRole>("/v1/admin/roles", body, key),
      update: (id: string, version: number, body: UpdateRoleBody, key?: string) =>
        put<CommercialRole>(`/v1/admin/roles/${enc(id)}`, withVersion(body, version), key),
      updatePermissions: (id: string, version: number, permissions: string[], key?: string) =>
        put<CommercialRole>(`/v1/admin/roles/${enc(id)}/permissions`, withVersion({ permissions }, version), key),
      resetBaseline: (id: string, version: number, key?: string) =>
        post<CommercialRole>(`/v1/admin/roles/${enc(id)}/reset-baseline`, withVersion({}, version), key),
      /** Every system role with the version the client read; one stale entry refuses the whole re-sync. */
      resyncSystem: (items: VersionedId[], key?: string) =>
        post<ResyncResult>("/v1/admin/roles/system/resync", { items: versionedItems(items) }, key),
      /** Creates a new role from the source; the source is not changed, so no version is sent. */
      clone: (id: string, body: CloneRoleBody, key?: string) =>
        post<CommercialRole>(`/v1/admin/roles/${enc(id)}/clone`, body, key),
      toggleActive: (id: string, version: number, key?: string) =>
        post<CommercialRole>(`/v1/admin/roles/${enc(id)}/toggle-active`, withVersion({}, version), key),
      remove: (id: string, version: number, key?: string) => del(`/v1/admin/roles/${enc(id)}`, version, key),
    },
    operators: {
      list: (params: { search?: string; department?: string; roleId?: string; status?: string } = {}) =>
        get<CommercialOperator[]>(`/v1/operators${queryString(params)}`),
      get: (id: string) => get<CommercialOperator>(`/v1/operators/${enc(id)}`),
      permissions: (id: string) => get<AdminOperatorPermissions>(`/v1/operators/${enc(id)}/permissions`),
      departments: () => get<OperatorDepartment[]>("/v1/departments"),
      roles: () => get<OperatorRoleOption[]>("/v1/operator-roles"),
      create: (body: CreateOperatorBody, key?: string) => post<CommercialOperator>("/v1/operators", body, key),
      update: (id: string, version: number, body: UpdateOperatorBody, key?: string) =>
        patch<CommercialOperator>(`/v1/operators/${enc(id)}`, withVersion(body, version), key),
      setStatus: (id: string, version: number, status: string, key?: string) =>
        patch<CommercialOperator>(`/v1/operators/${enc(id)}/status`, withVersion({ status }, version), key),
      /** Sends a new invitation email; no operator field changes, so no version. */
      resendInvite: (id: string, key?: string) => post<void>(`/v1/operators/${enc(id)}/resend-invite`, undefined, key),
      /** Ends the operator's sessions; the operator record is unchanged, so no version. */
      revokeSessions: (id: string, key?: string) =>
        post<void>(`/v1/operators/${enc(id)}/revoke-sessions`, undefined, key),
      remove: (id: string, version: number, key?: string) => del(`/v1/operators/${enc(id)}`, version, key),
    },
  };
}

export type CommercialApi = ReturnType<typeof createCommercialApi>;

/** Client bound to the shared authenticated API client. */
export const commercialApi: CommercialApi = createCommercialApi(<T>(path: string, init: CallInit = {}) =>
  apiClient.call<T>(path, init),
);
