/**
 * Typed client for the platform operations endpoints used by the Super Admin console (incidents, support, access
 * approvals, maintenance, integrations, webhooks, alerts, security overview, integration settings).
 *
 * Every call goes through `apiClient.call` from `@/lib/api`: bearer token, refresh on 401, X-Request-Id and an
 * Idempotency-Key on each mutation, and an `ApiError` (with `.status` / `.code`) on any refusal. Changes to versioned
 * records send `expected_version`; a stale one comes back as 409 STALE_VERSION and is never retried automatically.
 */
import { apiClient, queryString } from "@/lib/api";
import type {
  CreateIncidentBody,
  CreateMaintenanceBody,
  IncidentAssignment,
  IntegrationSettings,
  OpsAccessRequest,
  OpsAlert,
  OpsBackgroundJob,
  OpsDashboardStats,
  OpsFailedOutboxEvent,
  OpsGitHubRepository,
  OpsIncident,
  OpsIntegration,
  OpsMaintenanceWindow,
  OpsOperator,
  OpsSupportTicket,
  OpsWebhookReceipt,
  SecurityOverview,
  UpdateIncidentBody,
  UpdateIntegrationSettingsBody,
  UpdateMaintenanceBody,
  UpdateTicketBody,
} from "@/types/admin-operations";

type CallFn = <T>(path: string, init?: { method?: string; body?: unknown }) => Promise<T>;

/** Anything with the `call` helper of `createApiClient()` (tests pass a client built on a mocked fetch). */
export interface OperationsTransport {
  call: CallFn;
}

const id = (value: string) => encodeURIComponent(value);

/** `{ expected_version }` when the record carries a version; nothing otherwise. */
function versioned<T extends object>(body: T, expectedVersion: number | null | undefined): T & { expected_version?: number } {
  return expectedVersion === null || expectedVersion === undefined ? body : { ...body, expected_version: expectedVersion };
}

export function createOperationsApi(client: OperationsTransport) {
  const call = client.call;
  return {
    dashboardStats: () => call<OpsDashboardStats>("/v1/operator/dashboard/stats"),
    operators: () => call<OpsOperator[]>("/v1/operators"),

    incidents: {
      list: (filters: { status?: string; severity?: string } = {}) =>
        call<OpsIncident[]>(`/v1/operator/incidents${queryString(filters)}`),
      get: (incidentId: string) => call<OpsIncident>(`/v1/operator/incidents/${id(incidentId)}`),
      create: (body: CreateIncidentBody) => call<OpsIncident>("/v1/operator/incidents", { method: "POST", body }),
      update: (incidentId: string, body: UpdateIncidentBody, expectedVersion: number | null | undefined) =>
        call<OpsIncident>(`/v1/operator/incidents/${id(incidentId)}`, {
          method: "PATCH",
          body: versioned(body, expectedVersion),
        }),
      assign: (incidentId: string, operatorId: string, notes: string, expectedVersion: number | null | undefined) =>
        call<OpsIncident>(`/v1/operator/incidents/${id(incidentId)}/assign`, {
          method: "POST",
          body: versioned({ assigned_to_operator_id: operatorId, notes }, expectedVersion),
        }),
      resolve: (
        incidentId: string,
        body: { root_cause: string; mitigation_steps: string },
        expectedVersion: number | null | undefined,
      ) =>
        call<OpsIncident>(`/v1/operator/incidents/${id(incidentId)}/resolve`, {
          method: "POST",
          body: versioned(body, expectedVersion),
        }),
      assignments: (incidentId: string) =>
        call<IncidentAssignment[]>(`/v1/operator/incidents/${id(incidentId)}/assignments`),
    },

    tickets: {
      list: (filters: { status?: string; priority?: string } = {}) =>
        call<OpsSupportTicket[]>(`/v1/operator/support/tickets${queryString(filters)}`),
      get: (ticketId: string) => call<OpsSupportTicket>(`/v1/operator/support/tickets/${id(ticketId)}`),
      assign: (ticketId: string, operatorId: string, notes: string, expectedVersion: number | null | undefined) =>
        call<OpsSupportTicket>(`/v1/operator/support/tickets/${id(ticketId)}/assign`, {
          method: "POST",
          body: versioned({ assigned_operator_id: operatorId, notes }, expectedVersion),
        }),
      update: (ticketId: string, body: UpdateTicketBody, expectedVersion: number | null | undefined) =>
        call<OpsSupportTicket>(`/v1/operator/support/tickets/${id(ticketId)}`, {
          method: "PATCH",
          body: versioned(body, expectedVersion),
        }),
    },

    accessRequests: {
      list: (status?: string) => call<OpsAccessRequest[]>(`/v1/operator/support/access-requests${queryString({ status })}`),
      approve: (requestId: string, expectedVersion: number | null | undefined) =>
        call<OpsAccessRequest>(`/v1/operator/support/access-requests/${id(requestId)}/approve`, {
          method: "POST",
          body: versioned({}, expectedVersion),
        }),
      reject: (requestId: string, expectedVersion: number | null | undefined) =>
        call<OpsAccessRequest>(`/v1/operator/support/access-requests/${id(requestId)}/reject`, {
          method: "POST",
          body: versioned({}, expectedVersion),
        }),
    },

    integrations: () => call<OpsIntegration[]>("/v1/operator/integrations"),
    githubRepositories: (installationId?: string) =>
      call<OpsGitHubRepository[]>(`/v1/operator/github/repositories${queryString({ installationId })}`),
    webhooks: (filters: { source?: string; status?: string } = {}) =>
      call<OpsWebhookReceipt[]>(`/v1/operator/webhooks${queryString(filters)}`),
    jobs: (filters: { queue?: string; status?: string } = {}) =>
      call<OpsBackgroundJob[]>(`/v1/operator/jobs${queryString(filters)}`),

    maintenance: {
      list: (status?: string) => call<OpsMaintenanceWindow[]>(`/v1/operator/maintenance${queryString({ status })}`),
      create: (body: CreateMaintenanceBody) =>
        call<OpsMaintenanceWindow>("/v1/operator/maintenance", { method: "POST", body }),
      update: (windowId: string, body: UpdateMaintenanceBody, expectedVersion: number | null | undefined) =>
        call<OpsMaintenanceWindow>(`/v1/operator/maintenance/${id(windowId)}`, {
          method: "PATCH",
          body: versioned(body, expectedVersion),
        }),
    },

    alerts: {
      list: (acknowledged?: boolean) =>
        call<OpsAlert[]>(`/v1/operator/monitoring/alerts${queryString({ acknowledged })}`),
      acknowledge: (alertId: string) =>
        call<OpsAlert>(`/v1/operator/monitoring/alerts/${id(alertId)}/ack`, { method: "POST" }),
    },

    outbox: {
      failed: () => call<OpsFailedOutboxEvent[]>("/v1/operator/outbox/failed"),
      /**
       * The server answers 202 with an empty body. A refusal is already an ApiError; an empty-body parse failure
       * after a successful status means the retry was accepted.
       */
      retry: async (eventId: string): Promise<void> => {
        try {
          await call<unknown>(`/v1/operator/outbox/${id(eventId)}/retry`, { method: "POST" });
        } catch (error) {
          if (error instanceof SyntaxError) return;
          throw error;
        }
      },
    },

    security: {
      overview: () => call<SecurityOverview>("/v1/admin/security/overview"),
    },

    integrationSettings: {
      get: () => call<IntegrationSettings>("/v1/admin/integration-settings"),
      update: (body: UpdateIntegrationSettingsBody) =>
        call<IntegrationSettings>("/v1/admin/integration-settings", { method: "PUT", body }),
    },
  };
}

export type OperationsApi = ReturnType<typeof createOperationsApi>;

export const operationsApi: OperationsApi = createOperationsApi(apiClient);
