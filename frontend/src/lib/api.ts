import type { ApiErrorResponse, HealthResponse } from "@/types/api";
import type * as Dto from "@/types/api";
import { mocksAllowed, readPermissionEnv } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth-store";

export const REQUEST_ID_HEADER = "X-Request-Id";
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
export const EXPECTED_VERSION_FIELD = "expectedVersion";
export const STALE_VERSION_CODE = "STALE_VERSION";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

type FetchLike = typeof globalThis.fetch;

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  retryOnUnauthorized?: boolean;
  /** Reuse a key to make a user-level retry of the same change safe; otherwise one is generated per call. */
  idempotencyKey?: string;
  /** Raw bytes (file upload): sent as-is with this content type, without an Idempotency-Key (the server
   *  replay cache holds 1 MB at most; uploads are drafts that only count once the project is created). */
  raw?: { data: Blob | ArrayBuffer; contentType: string };
}

/** Random id for X-Request-Id and Idempotency-Key (UUID when available, safe characters only). */
export function newClientId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** True when the server refused a write because someone else changed the record first. */
export function isStaleVersion(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409 && error.code === STALE_VERSION_CODE;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string;
  readonly fieldErrors: ApiErrorResponse["field_errors"];

  constructor(
    status: number,
    code: string,
    message: string,
    requestId: string,
    fieldErrors: ApiErrorResponse["field_errors"] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.fieldErrors = fieldErrors;
  }
}

export interface AuthUserSummary {
  id: string;
  email: string;
  name: string;
  /** Null when no workspace is selected yet (workspace picker or no workspace). */
  role: string | null;
  department?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  must_change_password: boolean;
}

/** The refresh token never appears here: it only travels in the httpOnly refresh cookie. */
export interface AuthLoginResponse {
  access_token: string;
  expires_in: number;
  must_change_password: boolean;
  target_dashboard_url: string;
  user: AuthUserSummary;
}

export interface SuperAdminUserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  phone?: string | null;
  status: "ACTIVE" | "DISABLED" | string;
  must_change_password: boolean;
  last_login_at?: string | null;
  created_at: string;
  temp_password?: string | null;
  email_delivery_status?: string | null;
  email_delivery_message?: string | null;
}

export interface SuperAdminUserPageResponse {
  content: SuperAdminUserItem[];
  total_elements: number;
  total_pages: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface CreateSuperAdminUserPayload {
  name: string;
  email: string;
  role: string;
  department?: string;
  organization_id?: string;
  phone?: string;
  send_email?: boolean;
  custom_password?: string;
}

export interface UpdateSuperAdminUserPayload {
  name?: string;
  role?: string;
  department?: string;
  organization_id?: string;
  phone?: string;
}

export interface ResetPasswordResult {
  user_id: string;
  email: string;
  temp_password?: string;
  email_delivery_status: string;
  email_delivery_message?: string;
}

export interface UserLoginHistoryItem {
  id: string;
  user_id: string;
  email: string;
  ip_address?: string;
  user_agent?: string;
  status: "SUCCESS" | "FAILED" | string;
  failure_reason?: string;
  created_at: string;
}

export function resolveApiBaseUrl(configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL): string {
  if (!configuredUrl?.trim()) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is required; see frontend/.env.example.");
  }
  return configuredUrl.replace(/\/+$/, "");
}

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: FetchLike;
  isRolePreview?: () => boolean;
  /** Called when a request stays 401 after a refresh attempt (default: a window event). */
  onSessionExpired?: () => void;
}

/** Fired on window when the session can no longer be refreshed. */
export const SESSION_EXPIRED_EVENT = "prowise:session-expired";

/** Routes that start a session: the old access token is never sent to them. */
const PUBLIC_AUTH_PATH = /^\/(?:api\/)?(?:v1\/)?auth\/(?:signup|signin|login|refresh|forgot-password|reset-password|password-reset)/;

export function createApiClient(options: ApiClientOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const isRolePreview = options.isRolePreview ?? (() => useAuthStore.getState().isRolePreview);
  const onSessionExpired = options.onSessionExpired ?? (() => {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  });
  // The access token lives in memory only (never localStorage or a readable cookie). On a reload it is gone and
  // the first request or establishSession() gets a new one from the httpOnly refresh cookie.
  let accessToken: string | null = null;
  let refreshing: Promise<string | null> | null = null;

  async function health(): Promise<HealthResponse> {
    const response = await request("/v1/health", { retryOnUnauthorized: false });
    return (await response.json()) as HealthResponse;
  }

  async function request(
    path: string,
    requestOptions: RequestOptions = {},
  ): Promise<Response> {
    const previewAllowed = path === "/v1/health" || path === "/v1/auth/signout";
    if (isRolePreview() && mocksAllowed(readPermissionEnv()) && !previewAllowed) {
      throw new ApiError(0, "ROLE_PREVIEW", "API requests are disabled during role preview.", "");
    }

    const method = (requestOptions.method ?? "GET").toUpperCase();
    // Task 1.4: one key per logical mutation, reused when the request is retried after a token refresh,
    // so the server returns the earlier result instead of applying the change twice.
    const idempotencyKey =
      requestOptions.raw ? undefined
        : requestOptions.idempotencyKey ?? (MUTATION_METHODS.has(method) ? newClientId() : undefined);
    const requestId = newClientId();

    let response: Response;
    let sentWith: string | null = null;
    try {
      const headers = new Headers({ Accept: "application/json" });
      if (requestOptions.headers) {
        Object.entries(requestOptions.headers).forEach(([k, v]) => headers.set(k, v));
      }
      if (requestOptions.raw) headers.set("Content-Type", requestOptions.raw.contentType || "application/octet-stream");
      else if (requestOptions.body !== undefined) headers.set("Content-Type", "application/json");
      // Never send the (possibly stale) access token to sign-up, sign-in or refresh: those start a new session.
      sentWith = accessToken && !PUBLIC_AUTH_PATH.test(path) ? accessToken : null;
      if (sentWith) headers.set("Authorization", `Bearer ${sentWith}`);
      headers.set(REQUEST_ID_HEADER, requestId);
      if (idempotencyKey) headers.set(IDEMPOTENCY_KEY_HEADER, idempotencyKey);
      response = await fetcher(`${resolveApiBaseUrl(options.baseUrl)}${path}`, {
        method,
        headers,
        credentials: "include",
        body: requestOptions.raw ? requestOptions.raw.data
          : requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
      });
    } catch (error) {
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        error instanceof Error ? error.message : "Network request failed.",
        requestId,
      );
    }

    if (response.status === 401 && requestOptions.retryOnUnauthorized !== false && !PUBLIC_AUTH_PATH.test(path)) {
      // Another request already got a new token while this one was in flight: retry with it, no second refresh.
      // Otherwise refresh once (shared by every waiting request) and retry. Exactly one retry per request: no loops.
      const current = accessToken && accessToken !== sentWith ? accessToken : await refreshAccessToken();
      if (current) {
        return request(path, { ...requestOptions, idempotencyKey, retryOnUnauthorized: false });
      }
      // Only a failed refresh ends the session: let the app send the user to sign in.
      onSessionExpired();
    }
    if (!response.ok) {
      throw await toApiError(response, requestId);
    }
    return response;
  }

  async function json<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    const response = await request(path, requestOptions);
    return (await response.json()) as T;
  }

  /**
   * One refresh at a time: requests that hit 401 meanwhile wait for the same promise. Across tabs a Web Lock (when
   * the browser has one) serializes refreshes so two tabs never present the same cookie at once.
   */
  async function refreshAccessToken(): Promise<string | null> {
    if (!refreshing) {
      const run = () =>
        // retryOnUnauthorized: false — a 401 from refresh must not trigger another refresh (it would wait on itself).
        json<{ access_token: string }>("/v1/auth/refresh", { method: "POST", retryOnUnauthorized: false })
          .then((tokens) => {
            accessToken = tokens.access_token;
            return accessToken;
          })
          .catch(() => {
            accessToken = null;
            return null;
          });
      const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
      const pending: Promise<string | null> = locks ? (locks.request("prowise-session-refresh", run) as unknown as Promise<string | null>) : run();
      refreshing = pending.finally(() => {
        refreshing = null;
      });
    }
    return refreshing;
  }

  /** Page load or reload: get an access token from the refresh cookie before any page decides access. */
  async function ensureAccessToken(): Promise<string | null> {
    return accessToken ?? refreshAccessToken();
  }

  return {
    health,
    signup: (body: {
      email: string;
      password: string;
      name: string;
      organization: {
        name: string;
        slug: string;
        timezone: string;
        calendar: { workDays: number[]; dailyHours: number; holidays: string[] };
      };
    }) =>
      // The server decides role and organization (the new user is the Owner) and binds the session to it.
      json<{ access_token: string; organization_id?: string; role?: string; target_dashboard_url?: string }>(
        "/v1/auth/signup", { method: "POST", body },
      ).then((tokens) => {
        accessToken = tokens.access_token;
        return tokens;
      }),
    signin: (body: { email: string; password: string }) =>
      json<{ access_token: string }>("/v1/auth/signin", { method: "POST", body }).then((tokens) => {
        accessToken = tokens.access_token;
        return tokens;
      }),
    login: (body: { email: string; password: string }) =>
      // /v1 path: the base URL is "/api" and only /api/v1/* is proxied ("/api/auth/login" became /api/api/... = 404).
      json<AuthLoginResponse>("/v1/auth/login", { method: "POST", body }).then((res) => {
        accessToken = res.access_token;
        return res;
      }),
    changePassword: (body: { currentPassword?: string; newPassword: string }) =>
      // /v1 path: the base URL is "/api" and only /api/v1/* is proxied to the backend.
      json<{ access_token: string }>("/v1/auth/change-password", {
        method: "POST",
        body: {
          current_password: body.currentPassword,
          new_password: body.newPassword,
        },
      }).then((tokens) => {
        accessToken = tokens.access_token;
        return tokens;
      }),
    refresh: refreshAccessToken,
    ensureAccessToken,
    /** Log out on every device: revokes all sessions of this user and clears the refresh cookie. */
    signoutEverywhere: async () => {
      await request("/v1/auth/logout-all", { method: "POST" });
      accessToken = null;
    },
    /** A request through the session-aware client (Bearer + refresh on 401) for older helpers that build their own paths. */
    call: (path: string, init: { method?: string; body?: unknown } = {}) => request(path, init),
    signout: async () => {
      // /v1 path: the base URL is "/api" and only /api/v1/* is proxied to the backend; also the one sign-out
      // path allowed during role preview.
      await request("/v1/auth/signout", { method: "POST" });
      accessToken = null;
    },
    me: () => json<import("@/types/api").MeResponse>("/v1/me"),
    myPermissions: (orgId: string) =>
      json<import("@/types/api").MyPermissionsResponse>(
        `/v1/me/permissions?org=${encodeURIComponent(orgId)}`,
      ),
    orgMembers: (orgId: string) =>
      json<import("@/types/api").OrgMemberResponse[]>(`/v1/organizations/${encodeURIComponent(orgId)}/members`),
    orgRoles: (orgId: string) =>
      json<import("@/types/api").OrgRoleResponse[]>(`/v1/organizations/${encodeURIComponent(orgId)}/roles`),

    /* ---- Task 1.3: roles, grants and organization switch (snake_case wire format) ---- */
    roles: (orgId: string) => json<import("@/types/api").RoleDto[]>(`${orgPath(orgId)}/roles`),
    role: (orgId: string, roleId: string) =>
      json<import("@/types/api").RoleDto>(`${orgPath(orgId)}/roles/${encodeURIComponent(roleId)}`),
    roleHolders: (orgId: string, roleId: string) =>
      json<import("@/types/api").RoleHolderDto[]>(`${orgPath(orgId)}/roles/${encodeURIComponent(roleId)}/grants`),
    createRole: (orgId: string, body: import("@/types/api").RoleRequestDto) =>
      json<import("@/types/api").RoleDto>(`${orgPath(orgId)}/roles`, { method: "POST", body }),
    updateRole: (orgId: string, roleId: string, body: import("@/types/api").RoleRequestDto) =>
      json<import("@/types/api").RoleDto>(`${orgPath(orgId)}/roles/${encodeURIComponent(roleId)}`, { method: "PATCH", body }),
    deleteRole: (orgId: string, roleId: string, expectedVersion: number) =>
      request(`${orgPath(orgId)}/roles/${encodeURIComponent(roleId)}?expectedVersion=${expectedVersion}`, { method: "DELETE" }),
    members: (orgId: string, cursor?: string) => {
      const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
      return json<Dto.MemberDto[]>(`${orgPath(orgId)}/members${suffix}`);
    },
    memberGrants: (orgId: string, membershipId: string) =>
      json<import("@/types/api").GrantDto[]>(`${orgPath(orgId)}/members/${encodeURIComponent(membershipId)}/grants`),
    grantRole: (orgId: string, body: import("@/types/api").GrantRequestDto) =>
      json<import("@/types/api").GrantDto>(`${orgPath(orgId)}/grants`, { method: "POST", body }),
    revokeGrant: (orgId: string, grantId: string, expectedVersion: number) =>
      request(`${orgPath(orgId)}/grants/${encodeURIComponent(grantId)}?expectedVersion=${expectedVersion}`, { method: "DELETE" }),
    /* ---- Task 1.2: invitations, teams, member changes, handover and ownership ---- */
    invitations: (orgId: string) => json<Dto.InvitationDto[]>(`${orgPath(orgId)}/invitations`),
    invitation: (orgId: string, invitationId: string) =>
      json<Dto.InvitationDto>(`${orgPath(orgId)}/invitations/${encodeURIComponent(invitationId)}`),
    createInvitation: (orgId: string, body: Dto.CreateInvitationDto) =>
      json<Dto.InvitationDto>(`${orgPath(orgId)}/invitations`, { method: "POST", body }),
    resendInvitation: (orgId: string, invitationId: string, expectedVersion: number) =>
      json<Dto.InvitationDto>(`${orgPath(orgId)}/invitations/${encodeURIComponent(invitationId)}/resend`, {
        method: "POST",
        body: { expected_version: expectedVersion },
      }),
    revokeInvitation: (orgId: string, invitationId: string, expectedVersion: number) =>
      json<Dto.InvitationDto>(`${orgPath(orgId)}/invitations/${encodeURIComponent(invitationId)}/revoke`, {
        method: "POST",
        body: { expected_version: expectedVersion },
      }),
    /** The token goes in the body, never in a URL. */
    previewInvitation: (token: string) =>
      json<Dto.InvitationPreviewDto>("/v1/invitations/preview", { method: "POST", body: { token } }),
    acceptInvitation: (token: string) =>
      json<Dto.AcceptInvitationDto>("/v1/invitations/accept", { method: "POST", body: { token } }),
    teams: (orgId: string) => json<Dto.TeamDto[]>(`${orgPath(orgId)}/teams`),
    team: (orgId: string, teamId: string) => json<Dto.TeamDto>(`${orgPath(orgId)}/teams/${encodeURIComponent(teamId)}`),
    createTeam: (orgId: string, body: { name: string; description?: string | null; lead_membership_id?: string | null }) =>
      json<Dto.TeamDto>(`${orgPath(orgId)}/teams`, { method: "POST", body }),
    updateTeam: (orgId: string, teamId: string, body: { name: string; description?: string | null; expected_version: number }) =>
      json<Dto.TeamDto>(`${orgPath(orgId)}/teams/${encodeURIComponent(teamId)}`, { method: "PATCH", body }),
    archiveTeam: (orgId: string, teamId: string, expectedVersion: number) =>
      json<Dto.TeamDto>(`${orgPath(orgId)}/teams/${encodeURIComponent(teamId)}/archive`, {
        method: "POST",
        body: { expected_version: expectedVersion },
      }),
    addTeamMember: (orgId: string, teamId: string, membershipId: string, expectedVersion: number) =>
      json<Dto.TeamDto>(`${orgPath(orgId)}/teams/${encodeURIComponent(teamId)}/members`, {
        method: "POST",
        body: { membership_id: membershipId, expected_version: expectedVersion },
      }),
    removeTeamMember: (orgId: string, teamId: string, membershipId: string, expectedVersion: number) =>
      json<Dto.TeamDto>(
        `${orgPath(orgId)}/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(membershipId)}?expectedVersion=${expectedVersion}`,
        { method: "DELETE" },
      ),
    changeTeamLead: (orgId: string, teamId: string, leadMembershipId: string | null, expectedVersion: number) =>
      json<Dto.TeamDto>(`${orgPath(orgId)}/teams/${encodeURIComponent(teamId)}/lead`, {
        method: "PUT",
        body: { lead_membership_id: leadMembershipId, expected_version: expectedVersion },
      }),
    changeMemberRole: (orgId: string, membershipId: string, templateRoleId: string, expectedVersion: number) =>
      json<Dto.MemberChangeDto>(`${orgPath(orgId)}/members/${encodeURIComponent(membershipId)}/role`, {
        method: "PATCH",
        body: { template_role_id: templateRoleId, expected_version: expectedVersion },
      }),
    changeMemberStatus: (orgId: string, membershipId: string, body: Dto.MemberStatusRequestDto) =>
      json<Dto.MemberChangeDto>(`${orgPath(orgId)}/members/${encodeURIComponent(membershipId)}/status`, {
        method: "PATCH",
        body,
      }),
    memberOwnership: (orgId: string, membershipId: string) =>
      json<Dto.MemberOwnershipDto>(`${orgPath(orgId)}/members/${encodeURIComponent(membershipId)}/ownership`),
    handoverItems: (orgId: string) => json<Dto.HandoverItemDto[]>(`${orgPath(orgId)}/handover-items`),
    resolveHandover: (orgId: string, itemId: string, replacementMembershipId: string, expectedVersion: number) =>
      json<Dto.HandoverItemDto>(`${orgPath(orgId)}/handover-items/${encodeURIComponent(itemId)}/resolve`, {
        method: "POST",
        body: { replacement_membership_id: replacementMembershipId, expected_version: expectedVersion },
      }),
    ownership: (orgId: string) => json<Dto.OwnershipDto>(`${orgPath(orgId)}/ownership`),
    transferOwnership: (orgId: string, body: Dto.TransferOwnershipDto) =>
      json<Dto.TransferResultDto>(`${orgPath(orgId)}/ownership/transfer`, { method: "POST", body }),
    /* ---- Task 2.1: project records ---- */
    projects: (orgId: string, query: Dto.ProjectListQuery = {}) => {
      const params = new URLSearchParams();
      for (const [name, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") params.set(name, String(value));
      }
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return json<Dto.CursorPageDto<Dto.ProjectDto>>(`${orgPath(orgId)}/projects${suffix}`);
    },
    project: (orgId: string, projectId: string) =>
      json<Dto.ProjectDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}`),
    projectOptions: (orgId: string) => json<Dto.ProjectOptionsDto>(`${orgPath(orgId)}/projects/options`),
    projectDateHistory: (orgId: string, projectId: string) =>
      json<Dto.ProjectDateChangeDto[]>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/date-history`),
    createProject: (orgId: string, body: Dto.CreateProjectDto) =>
      json<Dto.ProjectDto>(`${orgPath(orgId)}/projects`, { method: "POST", body }),
    updateProject: (orgId: string, projectId: string, body: Dto.UpdateProjectDto) =>
      json<Dto.ProjectDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}`, { method: "PATCH", body }),
    // Super Admin (platform accounts only; the server requires PLATFORM_SUPER_ADMIN): stored platform data.
    adminDashboard: () => json<Dto.AdminDashboardDto>("/v1/admin/dashboard"),
    adminOrganizations: (search?: string) =>
      json<Dto.AdminOrganizationDto[]>(`/v1/admin/organizations${search ? `?search=${encodeURIComponent(search)}` : ""}`),
    // Task 3.1: Create Project setup, breakdown, assignment, work types and project documents.
    uploadProjectDocument: (orgId: string, file: File) =>
      json<Dto.ProjectDocumentDto>(`${orgPath(orgId)}/project-documents?file_name=${encodeURIComponent(file.name)}`,
        { method: "POST", raw: { data: file, contentType: file.type || "application/octet-stream" } }),
    createConfiguredProject: (orgId: string, body: Dto.ConfiguredProjectRequestDto) =>
      json<Dto.ConfiguredProjectDto>(`${orgPath(orgId)}/projects/configured`, { method: "POST", body }),
    projectDocuments: (orgId: string, projectId: string) =>
      json<Dto.ProjectDocumentDto[]>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/documents`),
    downloadProjectDocument: (orgId: string, projectId: string, documentId: string) =>
      request(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(documentId)}`)
        .then((response) => response.blob()),
    workItems: (orgId: string, projectId: string) =>
      json<Dto.WorkItemDto[]>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/work-items`),
    addWorkItem: (orgId: string, projectId: string, body: Dto.AddWorkItemDto) =>
      json<Dto.WorkItemDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/work-items`, { method: "POST", body }),
    updateWorkItem: (orgId: string, projectId: string, itemId: string, body: Dto.UpdateWorkItemDto) =>
      json<Dto.WorkItemDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(itemId)}`,
        { method: "PATCH", body }),
    retireWorkItem: (orgId: string, projectId: string, itemId: string, expectedVersion: number) =>
      json<Dto.WorkItemDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(itemId)}/retire`,
        { method: "POST", body: { expected_version: expectedVersion } }),
    assignWorkItem: (orgId: string, projectId: string, itemId: string, body: Dto.AssignmentDto) =>
      json<Dto.WorkItemDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(itemId)}/assignment`,
        { method: "POST", body }),
    assignmentHistory: (orgId: string, projectId: string, itemId: string) =>
      json<Dto.AssignmentChangeDto[]>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(itemId)}/assignment-history`),
    projectAssignees: (orgId: string, projectId: string) =>
      json<Dto.WorkPersonDto[]>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/assignees`),
    assignableWork: (orgId: string) => json<Dto.AssignableItemDto[]>(`${orgPath(orgId)}/work-items/assignable`),
    workTypes: (orgId: string) => json<Dto.WorkTypeDto[]>(`${orgPath(orgId)}/work-types`),
    createWorkType: (orgId: string, body: { name: string; description?: string }) =>
      json<Dto.WorkTypeDto>(`${orgPath(orgId)}/work-types`, { method: "POST", body }),
    updateWorkType: (orgId: string, typeId: string, body: { name?: string; description?: string; expected_version: number }) =>
      json<Dto.WorkTypeDto>(`${orgPath(orgId)}/work-types/${encodeURIComponent(typeId)}`, { method: "PATCH", body }),
    retireWorkType: (orgId: string, typeId: string, expectedVersion: number) =>
      json<Dto.WorkTypeDto>(`${orgPath(orgId)}/work-types/${encodeURIComponent(typeId)}/retire`,
        { method: "POST", body: { expected_version: expectedVersion } }),
    // Task 3.2: scope versions.
    scopeVersions: (orgId: string, projectId: string) =>
      json<Dto.ScopeVersionDto[]>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/scope-versions`),
    createScopeDraft: (orgId: string, projectId: string, body: Dto.ScopeDraftDto) =>
      json<Dto.ScopeVersionDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/scope-versions`, { method: "POST", body }),
    approveScopeVersion: (orgId: string, projectId: string, versionId: string, expectedVersion: number) =>
      json<Dto.ScopeVersionDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/scope-versions/${encodeURIComponent(versionId)}/approve`,
        { method: "POST", body: { expected_version: expectedVersion } }),
    // Tasks 3.3 and 3.5: review and rework, accepted-work progress.
    myTasks: (orgId: string) => json<Dto.ReviewTaskDto[]>(`${orgPath(orgId)}/my-tasks`),
    reviewQueue: (orgId: string) => json<Dto.ReviewTaskDto[]>(`${orgPath(orgId)}/review-queue`),
    submitTask: (orgId: string, projectId: string, itemId: string, body: Dto.SubmitTaskDto) =>
      json<Dto.ReviewTaskDto>(`${workItemPath(orgId, projectId, itemId)}/submit`, { method: "POST", body }),
    approveTask: (orgId: string, projectId: string, itemId: string, body: Dto.ReviewDecisionDto) =>
      json<Dto.ReviewTaskDto>(`${workItemPath(orgId, projectId, itemId)}/approve`, { method: "POST", body }),
    requestTaskChanges: (orgId: string, projectId: string, itemId: string, body: Dto.ReviewDecisionDto) =>
      json<Dto.ReviewTaskDto>(`${workItemPath(orgId, projectId, itemId)}/request-changes`, { method: "POST", body }),
    reopenTask: (orgId: string, projectId: string, itemId: string, body: { reason: string; expected_version: number }) =>
      json<Dto.ReviewTaskDto>(`${workItemPath(orgId, projectId, itemId)}/reopen`, { method: "POST", body }),
    setTaskChecks: (orgId: string, projectId: string, itemId: string, body: { labels: string[]; expected_version: number }) =>
      json<Dto.ReviewTaskDto>(`${workItemPath(orgId, projectId, itemId)}/checks`, { method: "PUT", body }),
    reviewTask: (orgId: string, projectId: string, itemId: string) =>
      json<Dto.ReviewTaskDto>(`${workItemPath(orgId, projectId, itemId)}/review`),
    taskReviews: (orgId: string, projectId: string, itemId: string) =>
      json<Dto.ReviewEventDto[]>(`${workItemPath(orgId, projectId, itemId)}/reviews`),
    structuredProgress: (orgId: string, projectId: string) =>
      json<Dto.StructuredProgressDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/progress`),
    // Task 3.4: blockers across projects.
    orgBlockers: (orgId: string) => json<Dto.OrgBlockerDto[]>(`${orgPath(orgId)}/blockers`),
    orgBlocker: (orgId: string, blockerId: string) => json<Dto.OrgBlockerDto>(`${orgPath(orgId)}/blockers/${encodeURIComponent(blockerId)}`),
    // Task 3.2: scope versions across projects.
    orgScopeVersions: (orgId: string, status?: string) =>
      json<Dto.ProjectScopeVersionDto[]>(`${orgPath(orgId)}/scope-versions${status ? `?status=${encodeURIComponent(status)}` : ""}`),
    orgScopeVersion: (orgId: string, versionId: string) =>
      json<Dto.ProjectScopeVersionDto>(`${orgPath(orgId)}/scope-versions/${encodeURIComponent(versionId)}`),
    // Task 3.1: cross-project work items and team work.
    orgWorkItems: (orgId: string, query: { project_id?: string; assignee?: string; state?: string } = {}) => {
      const params = new URLSearchParams();
      for (const [name, value] of Object.entries(query)) if (value) params.set(name, value);
      const suffix = params.toString() ? `?${params.toString()}` : "";
      return json<Dto.AssignableItemDto[]>(`${orgPath(orgId)}/work-items${suffix}`);
    },
    orgWorkItem: (orgId: string, itemId: string) => json<Dto.AssignableItemDto>(`${orgPath(orgId)}/work-items/${encodeURIComponent(itemId)}`),
    myTeams: (orgId: string) => json<Dto.TeamWorkDto[]>(`${orgPath(orgId)}/my-teams`),
    itemBlockers: (orgId: string, projectId: string, itemId: string) => json<Dto.BlockerDto[]>(`${workItemPath(orgId, projectId, itemId)}/blockers`),
    // Task 2.3: work calendar, cadence and due occurrences.
    orgCalendar: (orgId: string) => json<Dto.OrgCalendarDto>(`${orgPath(orgId)}/calendar`),
    updateOrgCalendar: (orgId: string, body: Dto.UpdateOrgCalendarDto) =>
      json<Dto.OrgCalendarDto>(`${orgPath(orgId)}/calendar`, { method: "PUT", body }),
    projectCadence: (orgId: string, projectId: string) => json<Dto.ProjectCadenceDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/cadence`),
    updateProjectCadence: (orgId: string, projectId: string, body: Dto.UpdateCadenceDto) =>
      json<Dto.ProjectCadenceDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/cadence`, { method: "PUT", body }),
    projectSchedule: (orgId: string, projectId: string) => json<Dto.ProjectScheduleDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/schedule`),
    // Task 3.4: dependencies and blockers.
    dependencyBoard: (orgId: string, projectId: string) => json<Dto.DependencyBoardDto>(`${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/dependencies`),
    linkDependency: (orgId: string, projectId: string, successorId: string, body: { predecessor_id: string; expected_version: number }) =>
      json<Dto.DependencyChangeDto>(`${workItemPath(orgId, projectId, successorId)}/dependencies`, { method: "POST", body }),
    removeDependency: (orgId: string, projectId: string, successorId: string, linkId: string, expectedVersion: number) =>
      json<Dto.DependencyChangeDto>(`${workItemPath(orgId, projectId, successorId)}/dependencies/${encodeURIComponent(linkId)}/remove`,
        { method: "POST", body: { expected_version: expectedVersion } }),
    releaseDependencies: (orgId: string, projectId: string, itemId: string, body: { treatment: "DROP" | "BRIDGE"; expected_version: number }) =>
      json<Dto.DependencyChangeDto>(`${workItemPath(orgId, projectId, itemId)}/dependencies/release`, { method: "POST", body }),
    clearDependencyFlag: (orgId: string, projectId: string, itemId: string, expectedVersion: number) =>
      json<Dto.DependencyItemRefDto>(`${workItemPath(orgId, projectId, itemId)}/dependency-flag/clear`, { method: "POST", body: { expected_version: expectedVersion } }),
    raiseBlocker: (orgId: string, projectId: string, itemId: string, body: Dto.RaiseBlockerDto) =>
      json<Dto.RaisedBlockerDto>(`${workItemPath(orgId, projectId, itemId)}/blockers`, { method: "POST", body }),
    resolveBlocker: (orgId: string, projectId: string, itemId: string, blockerId: string, body: { resolution: string; expected_version: number }) =>
      json<Dto.RaisedBlockerDto>(`${workItemPath(orgId, projectId, itemId)}/blockers/${encodeURIComponent(blockerId)}/resolve`, { method: "POST", body }),
    // Task 2.2: check-ins use the org-bound token (no org in the path).
    progressSummary: (projectId: string) =>
      json<Dto.ProgressSummaryDto>(`/v1/projects/${encodeURIComponent(projectId)}/checkins/summary`),
    progressHistory: (projectId: string) =>
      json<Dto.CheckInDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/progress-history`),
    projectGitHubActivity: (projectId: string) =>
      json<Dto.GitHubActivityDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/github-activity`),
    /** Pass the same idempotencyKey when retrying one submission: the server returns the first result. */
    submitCheckIn: (projectId: string, body: Dto.CheckInRequestDto, idempotencyKey?: string) =>
      json<Dto.CheckInDto>(`/v1/projects/${encodeURIComponent(projectId)}/checkins`, { method: "POST", body, idempotencyKey }),
    decideCheckIn: (checkinId: string, body: Dto.CheckInDecisionDto) =>
      json<Dto.CheckInDto>(`/v1/checkins/${encodeURIComponent(checkinId)}/decision`, { method: "POST", body }),
    pendingReviews: (orgId: string) => json<Dto.PendingReviewDto[]>(`/v1/organizations/${encodeURIComponent(orgId)}/reviews/pending`),
    /* Task 2.4: implemented delivery lifecycle routes. */
    deliveryStatus: (projectId: string) =>
      json<Dto.ProjectDeliveryStatusDto>(`/v1/projects/${encodeURIComponent(projectId)}/delivery-status`),
    acceptanceRequests: (projectId: string) =>
      json<Dto.AcceptanceRequestDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/acceptance-requests`),
    requestDeliveryAcceptance: (projectId: string, body: Dto.AcceptanceSubmissionRequestDto) =>
      json<Dto.AcceptanceRequestDto>(`/v1/projects/${encodeURIComponent(projectId)}/acceptance-requests`, {
        method: "POST",
        body,
      }),
    decideDeliveryAcceptance: (requestId: string, body: Dto.AcceptanceDecisionRequestDto) =>
      json<Dto.AcceptanceDecisionDto>(`/v1/acceptance-requests/${encodeURIComponent(requestId)}/decisions`, {
        method: "POST",
        body,
      }),
    closeProjectLifecycle: (projectId: string, body: Dto.CloseProjectRequestDto) =>
      json<Dto.ProjectClosureDto>(`/v1/projects/${encodeURIComponent(projectId)}/close`, { method: "POST", body }),
    reopenProjectLifecycle: (projectId: string, body: Dto.ReopenProjectRequestDto) =>
      json<Dto.ProjectDeliveryStatusDto>(`/v1/projects/${encodeURIComponent(projectId)}/reopen`, { method: "POST", body }),
    transitionProjectLifecycle: (projectId: string, body: Dto.TransitionLifecycleRequestDto) =>
      json<Dto.ProjectDeliveryStatusDto>(`/v1/projects/${encodeURIComponent(projectId)}/lifecycle`, { method: "POST", body }),
    projectBlockers: (projectId: string) =>
      json<Dto.ProjectBlockerDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/blockers`),
    createProjectBlocker: (projectId: string, body: Dto.CreateBlockerRequestDto) =>
      json<Dto.ProjectBlockerDto>(`/v1/projects/${encodeURIComponent(projectId)}/blockers`, { method: "POST", body }),
    waiveProjectBlocker: (projectId: string, blockerId: string, body: Dto.CreateWaiverRequestDto) =>
      json<Dto.ProjectBlockerDto>(
        `/v1/projects/${encodeURIComponent(projectId)}/blockers/${encodeURIComponent(blockerId)}/waiver`,
        { method: "POST", body },
      ),
    resolveProjectBlocker: (projectId: string, blockerId: string) =>
      json<Dto.ProjectBlockerDto>(
        `/v1/projects/${encodeURIComponent(projectId)}/blockers/${encodeURIComponent(blockerId)}/resolve`,
        { method: "POST" },
      ),
    projectLifecycleHistory: (projectId: string) =>
      json<Dto.ProjectLifecycleHistoryDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/lifecycle-history`),
    projectClosures: (projectId: string) =>
      json<Dto.ProjectClosureDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/closures`),
    codeReviews: (type: "assigned" | "authored" = "assigned") =>
      json<Dto.CodeReviewDto[]>(`/v1/developer/reviews?type=${encodeURIComponent(type)}`),
    /** Selects the active workspace; the old token is revoked server-side and replaced here. */
    switchOrganization: (orgId: string) =>
      json<{ access_token: string }>(`/v1/me/organizations/${encodeURIComponent(orgId)}/switch`, { method: "POST" }).then(
        (tokens) => {
          accessToken = tokens.access_token;
          return tokens;
        },
      ),
    requestPasswordReset: (email: string) =>
      request("/v1/auth/password-reset/request", { method: "POST", body: { email } }),
    confirmPasswordReset: (token: string, password: string) =>
      request("/v1/auth/password-reset/confirm", { method: "POST", body: { token, password } }),
    createOrganization: (body: {
      name: string;
      slug: string;
      timezone: string;
      calendar: unknown;
    }) => json<import("@/types/api").OrganizationResponse>("/v1/organizations", { method: "POST", body }),
    superAdminUsers: {
      list: (params?: {
        search?: string;
        role?: string;
        department?: string;
        status?: string;
        organizationId?: string;
        page?: number;
        size?: number;
      }) => {
        const query = new URLSearchParams();
        if (params?.search) query.set("search", params.search);
        if (params?.role) query.set("role", params.role);
        if (params?.department) query.set("department", params.department);
        if (params?.status) query.set("status", params.status);
        if (params?.organizationId) query.set("organizationId", params.organizationId);
        if (params?.page !== undefined) query.set("page", String(params.page));
        if (params?.size !== undefined) query.set("size", String(params.size));
        const qs = query.toString() ? `?${query.toString()}` : "";
        return json<SuperAdminUserPageResponse>(`/api/super-admin/users${qs}`);
      },
      get: (id: string) => json<SuperAdminUserItem>(`/api/super-admin/users/${id}`),
      create: (body: CreateSuperAdminUserPayload) =>
        json<SuperAdminUserItem>("/api/super-admin/users", { method: "POST", body }),
      update: (id: string, body: UpdateSuperAdminUserPayload) =>
        json<SuperAdminUserItem>(`/api/super-admin/users/${id}`, { method: "PUT", body }),
      updateStatus: (id: string, status: "ACTIVE" | "DISABLED", reason?: string) =>
        request(`/api/super-admin/users/${id}/status`, {
          method: "PATCH",
          body: { status, reason },
        }),
      resetPassword: (id: string) =>
        json<ResetPasswordResult>(`/api/super-admin/users/${id}/reset-password`, {
          method: "POST",
        }),
      resendInvitation: (id: string) =>
        json<ResetPasswordResult>(`/api/super-admin/users/${id}/resend-invitation`, {
          method: "POST",
        }),
      loginHistory: (id: string) =>
        json<UserLoginHistoryItem[]>(`/api/super-admin/users/${id}/login-history`),
    },
  };
}

export const apiClient = createApiClient();

function orgPath(orgId: string): string {
  return `/v1/organizations/${encodeURIComponent(orgId)}`;
}

function workItemPath(orgId: string, projectId: string, itemId: string): string {
  return `${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(itemId)}`;
}

async function toApiError(response: Response, sentRequestId = ""): Promise<ApiError> {
  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? sentRequestId;
  let body: Partial<ApiErrorResponse> = {};
  try {
    body = (await response.json()) as Partial<ApiErrorResponse>;
  } catch {
    // Non-JSON gateway responses still become the standard client error.
  }

  return new ApiError(
    response.status,
    body.code ?? `HTTP_${response.status}`,
    body.message ?? `Request failed with status ${response.status}.`,
    body.request_id ?? requestId,
    body.field_errors ?? [],
  );
}
