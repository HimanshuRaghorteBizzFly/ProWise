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
  retryOnUnauthorized?: boolean;
  /** Reuse a key to make a user-level retry of the same change safe; otherwise one is generated per call. */
  idempotencyKey?: string;
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
  role: string;
  department?: string;
  organization_id?: string;
  organization_name?: string;
  must_change_password: boolean;
}

export interface AuthLoginResponse {
  access_token: string;
  refresh_token: string;
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
}

export function createApiClient(options: ApiClientOptions = {}) {
  const fetcher = options.fetch ?? globalThis.fetch;
  const isRolePreview = options.isRolePreview ?? (() => useAuthStore.getState().isRolePreview);
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
      requestOptions.idempotencyKey ?? (MUTATION_METHODS.has(method) ? newClientId() : undefined);
    const requestId = newClientId();

    let response: Response;
    try {
      const headers = new Headers({ Accept: "application/json" });
      if (requestOptions.headers) {
        Object.entries(requestOptions.headers).forEach(([k, v]) => headers.set(k, v));
      }
      if (requestOptions.body !== undefined) headers.set("Content-Type", "application/json");
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      headers.set(REQUEST_ID_HEADER, requestId);
      if (idempotencyKey) headers.set(IDEMPOTENCY_KEY_HEADER, idempotencyKey);
      response = await fetcher(`${resolveApiBaseUrl(options.baseUrl)}${path}`, {
        method,
        headers,
        credentials: "include",
        body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
      });
    } catch (error) {
      throw new ApiError(
        0,
        "NETWORK_ERROR",
        error instanceof Error ? error.message : "Network request failed.",
        requestId,
      );
    }

    if (response.status === 401 && requestOptions.retryOnUnauthorized !== false) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return request(path, { ...requestOptions, idempotencyKey, retryOnUnauthorized: false });
      }
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

  async function refreshAccessToken(): Promise<string | null> {
    if (!refreshing) {
      refreshing = json<{ access_token: string }>("/v1/auth/refresh", {
        method: "POST",
      })
        .then((tokens) => {
          accessToken = tokens.access_token;
          return accessToken;
        })
        .catch(() => {
          accessToken = null;
          return null;
        })
        .finally(() => {
          refreshing = null;
        });
    }
    return refreshing;
  }

  return {
    health,
    signup: (body: { email: string; password: string; name?: string }) =>
      json<{ access_token: string }>("/v1/auth/signup", { method: "POST", body }).then((tokens) => {
        accessToken = tokens.access_token;
        return tokens;
      }),
    signin: (body: { email: string; password: string }) =>
      json<{ access_token: string }>("/v1/auth/signin", { method: "POST", body }).then((tokens) => {
        accessToken = tokens.access_token;
        return tokens;
      }),
    login: (body: { email: string; password: string }) =>
      json<AuthLoginResponse>("/api/auth/login", { method: "POST", body }).then((res) => {
        accessToken = res.access_token;
        return res;
      }),
    changePassword: (body: { currentPassword?: string; newPassword: string }) =>
      json<{ access_token: string; refresh_token: string }>("/api/auth/change-password", {
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
    members: (orgId: string) => json<import("@/types/api").MemberDto[]>(`${orgPath(orgId)}/members`),
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
