/**
 * The ONE typed client the Platform Operator console uses for its live pages.
 *
 * Transport: the operator session from `operatorAuthService` (access token in memory, sent as a Bearer header, plus
 * the HttpOnly `prowise_operator_access_token` / refresh cookies via `credentials: "include"`). A 401 triggers one
 * cookie-based operator refresh and a single retry. Every request carries X-Request-Id; every mutation carries an
 * Idempotency-Key that is reused when the same action (method + path + body) is retried after a network failure or a
 * 5xx, and dropped once the server has given a definite answer. Refusals become `ApiError` from `@/lib/api` with the
 * standard `{ code, message, request_id, field_errors }` shape, so `isStaleVersion()` works and a 409 STALE_VERSION is
 * never retried automatically.
 *
 * Endpoints: the shared operations client (`createOperationsApi`, also used by the Super Admin console) plus the
 * operator-only reads (dashboard, me, navigation, departments, workload, email delivery) and the retry endpoints.
 */
import { ApiError, IDEMPOTENCY_KEY_HEADER, REQUEST_ID_HEADER, newClientId, queryString, resolveApiBaseUrl } from "@/lib/api";
import { createOperationsApi, type OperationsTransport } from "@/lib/admin-api/operations";
import type { ApiErrorResponse } from "@/types/api";
import type { OpsBackgroundJob, OpsWebhookReceipt } from "@/types/admin-operations";
import type {
  OperatorActivityLogFilters,
  OperatorActivityLogItem,
  OperatorAnnouncementDraft,
  OperatorAnnouncementDraftInput,
  OperatorApiErrorFilters,
  OperatorApiErrorItem,
  OperatorApiErrorSummary,
  OperatorBackupList,
  OperatorDraftFilters,
  OperatorEmailDraft,
  OperatorEmailDraftInput,
  OperatorInvoiceDeliveryItem,
  OperatorOrganizationDetail,
  OperatorOrganizationItem,
  OperatorPage,
  OperatorPaging,
  OperatorPaymentFailureItem,
  OperatorSubscriptionItem,
  OperatorDashboardSummary,
  OperatorDepartmentItem,
  OperatorEffectivePermissions,
  OperatorEmailDeliveryLog,
  OperatorMessage,
  OperatorNavigation,
  OperatorProfile,
  OperatorWorkload,
} from "@/types/operator-console";
import { operatorAuthService } from "./operator-auth-service";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** What the transport needs from the operator session (tests pass a fake). */
export interface OperatorSession {
  getToken(): string | null;
  refresh(): Promise<unknown>;
}

export interface OperatorTransportOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  session?: OperatorSession;
  /** Called when the refresh cookie is refused: the operator has to sign in again. */
  onSessionExpired?: () => void;
}

async function toApiError(response: Response, sentRequestId: string): Promise<ApiError> {
  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? sentRequestId;
  let body: Partial<ApiErrorResponse> = {};
  try {
    body = (await response.json()) as Partial<ApiErrorResponse>;
  } catch {
    // Non-JSON gateway answers still become the standard client error.
  }
  return new ApiError(
    response.status,
    body.code ?? `HTTP_${response.status}`,
    body.message ?? `Request failed with status ${response.status}.`,
    body.request_id ?? requestId,
    body.field_errors ?? [],
  );
}

export function createOperatorTransport(options: OperatorTransportOptions = {}): OperationsTransport {
  const session = options.session ?? operatorAuthService;
  /** Idempotency keys of mutations that have not had a definite answer yet, by action signature. */
  const pendingKeys = new Map<string, string>();

  async function send(path: string, method: string, bodyText: string | undefined, idempotencyKey?: string) {
    const doFetch = options.fetch ?? globalThis.fetch;
    const baseUrl = options.baseUrl ?? resolveApiBaseUrl();
    const requestId = newClientId();
    const headers: Record<string, string> = { Accept: "application/json", [REQUEST_ID_HEADER]: requestId };
    if (bodyText !== undefined) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers[IDEMPOTENCY_KEY_HEADER] = idempotencyKey;
    const token = session.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    try {
      const response = await doFetch(`${baseUrl}${path}`, {
        method,
        headers,
        credentials: "include",
        body: bodyText,
      });
      return { response, requestId };
    } catch {
      throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the ProWise server. Check that the backend is running.", requestId);
    }
  }

  async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const method = (init.method ?? "GET").toUpperCase();
    const bodyText = init.body === undefined ? undefined : JSON.stringify(init.body);
    const isMutation = MUTATION_METHODS.has(method);
    const signature = `${method} ${path} ${bodyText ?? ""}`;
    let idempotencyKey: string | undefined;
    if (isMutation) {
      idempotencyKey = pendingKeys.get(signature) ?? newClientId();
      pendingKeys.set(signature, idempotencyKey);
    }

    let { response, requestId } = await send(path, method, bodyText, idempotencyKey);
    if (response.status === 401) {
      const refreshed = await session.refresh().then(
        () => true,
        () => false,
      );
      if (refreshed) {
        ({ response, requestId } = await send(path, method, bodyText, idempotencyKey));
      } else {
        options.onSessionExpired?.();
      }
    }

    if (!response.ok) {
      const error = await toApiError(response, requestId);
      // A definite refusal (4xx) ends the action; a 5xx keeps the key so a retry of the same action is safe.
      if (isMutation && response.status < 500) pendingKeys.delete(signature);
      throw error;
    }
    if (isMutation) pendingKeys.delete(signature);

    if (response.status === 202 || response.status === 204) return undefined as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  return { call };
}

const id = (value: string) => encodeURIComponent(value);

export function createOperatorConsoleApi(transport: OperationsTransport) {
  const call = transport.call;
  const shared = createOperationsApi(transport);
  return {
    ...shared,

    /** Department, name and authorized modules are real; its KPI values are fixed server strings and are not shown. */
    dashboard: () => call<OperatorDashboardSummary>("/v1/operator/dashboard"),
    me: () => call<OperatorProfile>("/v1/operator/me"),
    myPermissions: () => call<OperatorEffectivePermissions>("/v1/operator/me/permissions"),
    navigation: () => call<OperatorNavigation>("/v1/operator/navigation"),
    departments: () => call<OperatorDepartmentItem[]>("/v1/departments"),
    operatorProfiles: () => call<OperatorProfile[]>("/v1/operators"),
    teamWorkload: () => call<OperatorWorkload[]>("/v1/operator/team/workload"),

    /**
     * Server truth (kept here so the contract is visible): this only marks the receipt PROCESSED, nothing is
     * re-delivered. The console keeps its retry buttons disabled ("Not available yet") instead of calling it.
     */
    retryWebhook: (receiptId: string) =>
      call<OpsWebhookReceipt>(`/v1/operator/webhooks/${id(receiptId)}/retry`, { method: "POST" }),
    /** Server truth: sets the job QUEUED but nothing consumes that queue yet. Not called by the console. */
    retryJob: (jobId: string) => call<OpsBackgroundJob>(`/v1/operator/jobs/${id(jobId)}/retry`, { method: "POST" }),

    emailDelivery: {
      list: (status?: string) =>
        call<OperatorEmailDeliveryLog[]>(`/v1/operator/email/delivery${queryString({ status })}`),
      /** Server truth: always 409 EMAIL_RETRY_UNAVAILABLE (single-use links cannot be re-sent). Not called. */
      retry: (logId: string) =>
        call<OperatorEmailDeliveryLog>(`/v1/operator/email/${id(logId)}/retry`, { method: "POST" }),
    },

    /** Operator activity + audit trail (audit.activity_logs:view). Paged, 0-based `page`. */
    activityLogs: (filters: OperatorActivityLogFilters = {}) =>
      call<OperatorPage<OperatorActivityLogItem>>(`/v1/operator/activity-logs${queryString(filters)}`),

    /** Read-only organization status (operations.org_status:view). Suspension stays a Super Admin action. */
    organizations: {
      list: (filters: { search?: string; state?: string } & OperatorPaging = {}) =>
        call<OperatorPage<OperatorOrganizationItem>>(`/v1/operator/organizations${queryString(filters)}`),
      get: (orgId: string) => call<OperatorOrganizationDetail>(`/v1/operator/organizations/${id(orgId)}`),
    },

    /** Billing is dormant in V1: these reads never change anything (no retry, no sending). */
    subscriptions: (filters: { status?: string; plan?: string; search?: string } & OperatorPaging = {}) =>
      call<OperatorPage<OperatorSubscriptionItem>>(`/v1/operator/subscriptions${queryString(filters)}`),
    paymentFailures: (filters: { search?: string; from?: string; to?: string } & OperatorPaging = {}) =>
      call<OperatorPage<OperatorPaymentFailureItem>>(`/v1/operator/payments/failures${queryString(filters)}`),
    invoiceDelivery: (
      filters: { delivery_status?: string; invoice_status?: string; search?: string } & OperatorPaging = {},
    ) => call<OperatorPage<OperatorInvoiceDeliveryItem>>(`/v1/operator/invoices/delivery${queryString(filters)}`),

    apiErrors: {
      list: (filters: OperatorApiErrorFilters = {}) =>
        call<OperatorPage<OperatorApiErrorItem>>(`/v1/operator/api-errors${queryString(filters)}`),
      /** Default window on the server: the last 24 hours. */
      summary: (window: { from?: string; to?: string } = {}) =>
        call<OperatorApiErrorSummary>(`/v1/operator/api-errors/summary${queryString(window)}`),
    },

    /** Operator announcement drafts: operators draft and submit; only a Super Admin publishes. */
    announcementDrafts: {
      list: (filters: OperatorDraftFilters = {}) =>
        call<OperatorPage<OperatorAnnouncementDraft>>(`/v1/operator/announcement-drafts${queryString(filters)}`),
      get: (draftId: string) => call<OperatorAnnouncementDraft>(`/v1/operator/announcement-drafts/${id(draftId)}`),
      create: (body: OperatorAnnouncementDraftInput) =>
        call<OperatorAnnouncementDraft>("/v1/operator/announcement-drafts", { method: "POST", body }),
      update: (draftId: string, body: OperatorAnnouncementDraftInput, expectedVersion: number) =>
        call<OperatorAnnouncementDraft>(`/v1/operator/announcement-drafts/${id(draftId)}`, {
          method: "PUT",
          body: { ...body, expected_version: expectedVersion },
        }),
      remove: (draftId: string, expectedVersion: number) =>
        call<void>(`/v1/operator/announcement-drafts/${id(draftId)}${queryString({ expectedVersion })}`, {
          method: "DELETE",
        }),
      submit: (draftId: string, expectedVersion: number) =>
        call<OperatorAnnouncementDraft>(`/v1/operator/announcement-drafts/${id(draftId)}/submit`, {
          method: "POST",
          body: { expected_version: expectedVersion },
        }),
    },

    /** Operator email template drafts: reviewed by a Super Admin; nothing is sent from here. */
    emailDrafts: {
      list: (filters: OperatorDraftFilters = {}) =>
        call<OperatorPage<OperatorEmailDraft>>(`/v1/operator/email-drafts${queryString(filters)}`),
      get: (draftId: string) => call<OperatorEmailDraft>(`/v1/operator/email-drafts/${id(draftId)}`),
      create: (body: OperatorEmailDraftInput) =>
        call<OperatorEmailDraft>("/v1/operator/email-drafts", { method: "POST", body }),
      update: (draftId: string, body: OperatorEmailDraftInput, expectedVersion: number) =>
        call<OperatorEmailDraft>(`/v1/operator/email-drafts/${id(draftId)}`, {
          method: "PUT",
          body: { ...body, expected_version: expectedVersion },
        }),
      remove: (draftId: string, expectedVersion: number) =>
        call<void>(`/v1/operator/email-drafts/${id(draftId)}${queryString({ expectedVersion })}`, { method: "DELETE" }),
      submit: (draftId: string, expectedVersion: number) =>
        call<OperatorEmailDraft>(`/v1/operator/email-drafts/${id(draftId)}/submit`, {
          method: "POST",
          body: { expected_version: expectedVersion },
        }),
    },

    /** Database backups (system.backups view / execute). There is no download or restore endpoint. */
    backups: {
      list: (paging: OperatorPaging = {}) => call<OperatorBackupList>(`/v1/operator/backups${queryString(paging)}`),
      /** 202 (run started, RUNNING); 503 BACKUP_NOT_CONFIGURED; 409 BACKUP_RUNNING. */
      run: () => call<void>("/v1/operator/backups", { method: "POST" }),
    },

    session: {
      /** Revokes every session of the signed-in operator, this one included. */
      logoutAll: () => call<OperatorMessage>("/v1/auth/operator/logout-all", { method: "POST" }),
      /**
       * Changes the signed-in operator's password. Every earlier session ends (this one included); the response
       * carries the fresh access token, which the caller must adopt. The refresh token arrives only as a cookie.
       * 400: INVALID_CURRENT_PASSWORD, PASSWORD_REUSE, CURRENT_PASSWORD_REQUIRED, VALIDATION_FAILED (new_password).
       */
      changePassword: (currentPassword: string, newPassword: string) =>
        call<{ access_token: string }>("/v1/auth/operator/change-password", {
          method: "POST",
          body: { current_password: currentPassword, new_password: newPassword },
        }),
      /** Sends a password reset link to the operator's own address. */
      requestPasswordReset: (email: string) =>
        call<OperatorMessage>("/v1/auth/operator/forgot-password", { method: "POST", body: { email } }),
    },
  };
}

export type OperatorConsoleApi = ReturnType<typeof createOperatorConsoleApi>;

/** Sends the operator back to sign in once the session cannot be refreshed. */
function redirectToOperatorLogin() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/platform-operator/login") || window.location.pathname.startsWith("/operator/login")) return;
  window.location.assign("/operator/login");
}

export const operatorApi: OperatorConsoleApi = createOperatorConsoleApi(
  createOperatorTransport({ onSessionExpired: redirectToOperatorLogin }),
);
