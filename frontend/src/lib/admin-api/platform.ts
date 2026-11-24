import { apiClient, queryString } from "@/lib/api";
import type * as P from "@/types/admin-platform";

/**
 * Typed client for the Super Admin platform modules. Every call goes through `apiClient.call` (bearer token,
 * refresh on 401, X-Request-Id, an Idempotency-Key on every mutation, ApiError with `.status` / `.code`).
 *
 * Optimistic locking: updates and state changes send the record's `version` as `expected_version` in the body;
 * deletes send it as `?expectedVersion=`. A stale write comes back as HTTP 409 `STALE_VERSION`; callers show the
 * reload message and never retry with a newer version on their own.
 */
export interface PlatformCaller {
  call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T>;
}

const enc = encodeURIComponent;

function withVersion(path: string, expectedVersion: number): string {
  return `${path}?expectedVersion=${enc(String(expectedVersion))}`;
}

export function createPlatformApi(client: PlatformCaller) {
  const get = <T>(path: string) => client.call<T>(path);
  const send = <T>(method: string, path: string, body?: unknown) => client.call<T>(path, { method, body });

  return {
    auditLogs: {
      list: (query: P.PlatformAuditLogQuery = {}) =>
        get<P.PlatformAuditLog[]>(`/v1/admin/audit-logs${queryString(query)}`),
    },

    announcements: {
      list: () => get<P.PlatformAnnouncement[]>("/v1/admin/announcements"),
      get: (id: string) => get<P.PlatformAnnouncement>(`/v1/admin/announcements/${enc(id)}`),
      create: (input: P.AnnouncementInput) => send<P.PlatformAnnouncement>("POST", "/v1/admin/announcements", input),
      update: (id: string, input: P.AnnouncementInput, expectedVersion: number) =>
        send<P.PlatformAnnouncement>("PUT", `/v1/admin/announcements/${enc(id)}`, {
          ...input,
          expected_version: expectedVersion,
        }),
      publish: (id: string, expectedVersion: number) =>
        send<P.PlatformAnnouncement>("POST", `/v1/admin/announcements/${enc(id)}/publish`, {
          expected_version: expectedVersion,
        }),
      archive: (id: string, expectedVersion: number) =>
        send<P.PlatformAnnouncement>("POST", `/v1/admin/announcements/${enc(id)}/archive`, {
          expected_version: expectedVersion,
        }),
      remove: (id: string, expectedVersion: number) =>
        send<void>("DELETE", withVersion(`/v1/admin/announcements/${enc(id)}`, expectedVersion)),
      /** Sends an operator draft awaiting review (PENDING_REVIEW) back to its author as CHANGES_REQUESTED. */
      requestChanges: (id: string, expectedVersion: number, reviewerNote: string) =>
        send<P.PlatformAnnouncement>("POST", `/v1/admin/announcements/${enc(id)}/request-changes`, {
          expected_version: expectedVersion,
          reviewer_note: reviewerNote,
        }),
      /** All-or-nothing: one stale item refuses the whole batch with 409 STALE_VERSION. */
      bulkRemove: (items: P.VersionedRef[]) =>
        send<void>("POST", "/v1/admin/announcements/bulk-delete", {
          items: items.map((i) => ({ id: i.id, expected_version: i.version })),
        }),
    },

    emailTemplates: {
      list: () => get<P.PlatformEmailTemplate[]>("/v1/admin/email-templates"),
      get: (id: string) => get<P.PlatformEmailTemplate>(`/v1/admin/email-templates/${enc(id)}`),
      create: (input: P.EmailTemplateCreateInput) =>
        send<P.PlatformEmailTemplate>("POST", "/v1/admin/email-templates", input),
      update: (id: string, input: P.EmailTemplateUpdateInput, expectedVersion: number) =>
        send<P.PlatformEmailTemplate>("PUT", `/v1/admin/email-templates/${enc(id)}`, {
          ...input,
          expected_version: expectedVersion,
        }),
      /** Creates a new draft copy; the source is not changed, so no version is needed. */
      clone: (id: string) => send<P.PlatformEmailTemplate>("POST", `/v1/admin/email-templates/${enc(id)}/clone`),
      remove: (id: string, expectedVersion: number) =>
        send<void>("DELETE", withVersion(`/v1/admin/email-templates/${enc(id)}`, expectedVersion)),
    },

    /** Operator email template drafts awaiting Super Admin review. Approving sends nothing. */
    emailDrafts: {
      list: (query: P.AdminEmailDraftQuery = {}) =>
        get<P.PagedResult<P.AdminEmailDraft>>(`/v1/admin/email-drafts${queryString(query)}`),
      approve: (id: string, expectedVersion: number, reviewerNote?: string) =>
        send<P.AdminEmailDraft>("POST", `/v1/admin/email-drafts/${enc(id)}/approve`, {
          expected_version: expectedVersion,
          ...(reviewerNote && reviewerNote.trim() ? { reviewer_note: reviewerNote.trim() } : {}),
        }),
      reject: (id: string, expectedVersion: number, reviewerNote: string) =>
        send<P.AdminEmailDraft>("POST", `/v1/admin/email-drafts/${enc(id)}/reject`, {
          expected_version: expectedVersion,
          reviewer_note: reviewerNote,
        }),
    },

    featureFlags: {
      list: () => get<P.PlatformFeatureFlag[]>("/v1/admin/feature-flags"),
      create: (input: P.FeatureFlagCreateInput) =>
        send<P.PlatformFeatureFlag>("POST", "/v1/admin/feature-flags", input),
      update: (id: string, input: P.FeatureFlagUpdateInput, expectedVersion: number) =>
        send<P.PlatformFeatureFlag>("PUT", `/v1/admin/feature-flags/${enc(id)}`, {
          ...input,
          expected_version: expectedVersion,
        }),
      toggle: (id: string, enabled: boolean, expectedVersion: number) =>
        send<P.PlatformFeatureFlag>("POST", `/v1/admin/feature-flags/${enc(id)}/toggle`, {
          enabled,
          expected_version: expectedVersion,
        }),
      remove: (id: string, expectedVersion: number) =>
        send<void>("DELETE", withVersion(`/v1/admin/feature-flags/${enc(id)}`, expectedVersion)),
    },

    licenses: {
      list: () => get<P.PlatformLicense[]>("/v1/admin/licenses"),
      generate: (input: P.LicenseGenerateInput) => send<P.PlatformLicense>("POST", "/v1/admin/licenses", input),
      revoke: (id: string, reason: string, expectedVersion: number) =>
        send<P.PlatformLicense>("POST", `/v1/admin/licenses/${enc(id)}/revoke`, {
          reason,
          expected_version: expectedVersion,
        }),
    },

    policies: {
      get: () => get<P.PlatformPolicies>("/v1/admin/policies"),
      update: (input: P.PoliciesInput, expectedVersion: number) =>
        send<P.PlatformPolicies>("PUT", "/v1/admin/policies", { ...input, expected_version: expectedVersion }),
    },

    branding: {
      get: () => get<P.PlatformBranding>("/v1/admin/branding"),
      update: (input: P.BrandingInput, expectedVersion: number) =>
        send<P.PlatformBranding>("PUT", "/v1/admin/branding", { ...input, expected_version: expectedVersion }),
    },

    reports: {
      /** `from` / `to` are calendar dates (yyyy-MM-dd), inclusive. */
      overview: (from: string, to: string) =>
        get<P.ReportsOverview>(`/v1/admin/reports/overview?from=${enc(from)}&to=${enc(to)}`),
    },
  };
}

export type PlatformApi = ReturnType<typeof createPlatformApi>;

export const platformApi: PlatformApi = createPlatformApi(apiClient);
