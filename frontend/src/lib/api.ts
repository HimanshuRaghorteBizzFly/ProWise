import type { ApiErrorResponse, HealthResponse } from "@/types/api";
import { mocksAllowed, readPermissionEnv } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth-store";

export const REQUEST_ID_HEADER = "X-Request-Id";
export const IDEMPOTENCY_KEY_HEADER = "Idempotency-Key";
export const EXPECTED_VERSION_FIELD = "expectedVersion";

type FetchLike = typeof globalThis.fetch;

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
    requestOptions: { method?: string; body?: unknown; headers?: Record<string, string>; retryOnUnauthorized?: boolean } = {},
  ): Promise<Response> {
    const previewAllowed = path === "/v1/health" || path === "/v1/auth/signout";
    if (isRolePreview() && mocksAllowed(readPermissionEnv()) && !previewAllowed) {
      throw new ApiError(0, "ROLE_PREVIEW", "API requests are disabled during role preview.", "");
    }

    let response: Response;
    try {
      const headers = new Headers({ Accept: "application/json" });
      if (requestOptions.headers) {
        Object.entries(requestOptions.headers).forEach(([k, v]) => headers.set(k, v));
      }
      if (requestOptions.body !== undefined) headers.set("Content-Type", "application/json");
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      response = await fetcher(`${resolveApiBaseUrl(options.baseUrl)}${path}`, {
        method: requestOptions.method ?? "GET",
        headers,
        credentials: "include",
        body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
      });
    } catch (error) {
      throw new ApiError(0, "NETWORK_ERROR", error instanceof Error ? error.message : "Network request failed.", "");
    }

    if (response.status === 401 && requestOptions.retryOnUnauthorized !== false) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return request(path, { ...requestOptions, retryOnUnauthorized: false });
      }
    }
    if (!response.ok) {
      throw await toApiError(response);
    }
    return response;
  }

  async function json<T>(
    path: string,
    requestOptions: { method?: string; body?: unknown; headers?: Record<string, string> } = {}
  ): Promise<T> {
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
    /* Projects (Task 2.1) */
    projects: (
      orgId: string,
      params?: {
        search?: string;
        owner?: string;
        team?: string;
        health?: string;
        status?: string;
        mode?: string;
        archived?: boolean;
        cursor?: string;
        limit?: number;
      },
    ) => {
      const query = new URLSearchParams();
      if (params?.search) query.set("search", params.search);
      if (params?.owner) query.set("owner", params.owner);
      if (params?.team) query.set("team", params.team);
      if (params?.health) query.set("health", params.health);
      if (params?.status) query.set("status", params.status);
      if (params?.mode) query.set("mode", params.mode);
      if (params?.archived !== undefined) query.set("archived", String(params.archived));
      if (params?.cursor) query.set("cursor", params.cursor);
      if (params?.limit !== undefined) query.set("limit", String(params.limit));
      const qs = query.toString() ? `?${query.toString()}` : "";
      return json<import("@/types/api").ProjectListResponseDto>(`${orgPath(orgId)}/projects${qs}`);
    },
    project: (projectId: string, orgId?: string) => {
      const path = orgId ? `${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}` : `/v1/projects/${encodeURIComponent(projectId)}`;
      return json<import("@/types/api").ProjectDto>(path);
    },
    createProject: (orgId: string, body: import("@/types/api").CreateProjectRequestDto) =>
      json<import("@/types/api").ProjectDto>(`${orgPath(orgId)}/projects`, { method: "POST", body }),
    updateProject: (projectId: string, body: import("@/types/api").UpdateProjectRequestDto, orgId?: string) => {
      const path = orgId ? `${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}` : `/v1/projects/${encodeURIComponent(projectId)}`;
      return json<import("@/types/api").ProjectDto>(path, { method: "PATCH", body });
    },
    archiveProject: (projectId: string, expectedVersion: number, orgId?: string) => {
      const path = orgId ? `${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/archive` : `/v1/projects/${encodeURIComponent(projectId)}/archive`;
      return json<import("@/types/api").ProjectDto>(path, { method: "POST", body: { expectedVersion } });
    },
    restoreProject: (projectId: string, expectedVersion: number, orgId?: string) => {
      const path = orgId ? `${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/restore` : `/v1/projects/${encodeURIComponent(projectId)}/restore`;
      return json<import("@/types/api").ProjectDto>(path, { method: "POST", body: { expectedVersion } });
    },
    projectMembers: (projectId: string, orgId?: string) => {
      const path = orgId ? `${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/members` : `/v1/projects/${encodeURIComponent(projectId)}/members`;
      return json<import("@/types/api").ProjectMemberDto[]>(path);
    },
    addProjectMember: (projectId: string, body: import("@/types/api").ProjectMemberRequestDto, orgId?: string) => {
      const path = orgId ? `${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/members` : `/v1/projects/${encodeURIComponent(projectId)}/members`;
      return json<import("@/types/api").ProjectMemberDto>(path, { method: "POST", body });
    },
    removeProjectMember: (projectId: string, membershipId: string, orgId?: string) => {
      const path = orgId
        ? `${orgPath(orgId)}/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(membershipId)}`
        : `/v1/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(membershipId)}`;
      return request(path, { method: "DELETE" });
    },
    /* ---- Task 2.2: Developer Progress & Team Lead Verification ---- */
    projectCheckIns: (projectId: string) =>
      json<import("@/types/api").CheckInDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/checkins`),
    projectProgressSummary: (projectId: string) =>
      json<import("@/types/api").ProgressSummaryDto>(`/v1/projects/${encodeURIComponent(projectId)}/checkins/summary`),
    submitCheckIn: (
      projectId: string,
      body: import("@/types/api").CheckInSubmissionRequestDto,
      idempotencyKey?: string,
    ) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers[IDEMPOTENCY_KEY_HEADER] = idempotencyKey;
      }
      return json<import("@/types/api").CheckInDto>(
        `/v1/projects/${encodeURIComponent(projectId)}/checkins`,
        { method: "POST", body, headers },
      );
    },
    verifyCheckIn: (
      checkinId: string,
      body: import("@/types/api").VerificationDecisionRequestDto,
    ) =>
      json<import("@/types/api").CheckInDto>(
        `/v1/checkins/${encodeURIComponent(checkinId)}/verify`,
        { method: "POST", body },
      ),
    pendingReviews: (orgId: string) =>
      json<import("@/types/api").PendingReviewDto[]>(
        `/v1/organizations/${encodeURIComponent(orgId)}/reviews/pending`,
      ),
    projectGitHubActivity: (projectId: string) =>
      json<import("@/types/api").GitHubActivityItemDto[]>(
        `/v1/projects/${encodeURIComponent(projectId)}/github-activity`,
      ),
    setProjectVerificationSetting: (projectId: string, requireVerification: boolean) =>
      json<import("@/types/api").ProjectDto>(
        `/v1/projects/${encodeURIComponent(projectId)}/settings/verification`,
        { method: "PUT", body: { require_verification: requireVerification } },
      ),
    attachRepositoryLink: (projectId: string, repoName: string, defaultBranch?: string) =>
      json<{ id: string; project_id: string; repo_name: string; default_branch: string }>(
        `/v1/projects/${encodeURIComponent(projectId)}/repositories`,
        { method: "POST", body: { repo_name: repoName, default_branch: defaultBranch } },
      ),
    /* ---- Task 2.4: Deliver, Close, Archive & Restore ---- */
    deliveryStatus: (projectId: string) =>
      json<import("@/types/api").ProjectDeliveryStatusDto>(`/v1/projects/${encodeURIComponent(projectId)}/delivery-status`),
    acceptanceRequests: (projectId: string) =>
      json<import("@/types/api").AcceptanceRequestDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/acceptance-requests`),
    requestDeliveryAcceptance: (projectId: string, body: import("@/types/api").AcceptanceSubmissionRequestDto) =>
      json<import("@/types/api").AcceptanceRequestDto>(`/v1/projects/${encodeURIComponent(projectId)}/acceptance-requests`, {
        method: "POST",
        body,
      }),
    decideDeliveryAcceptance: (requestId: string, body: import("@/types/api").AcceptanceDecisionRequestDto) =>
      json<import("@/types/api").AcceptanceDecisionDto>(`/v1/acceptance-requests/${encodeURIComponent(requestId)}/decisions`, {
        method: "POST",
        body,
      }),
    closeProjectLifecycle: (projectId: string, body: import("@/types/api").CloseProjectRequestDto) =>
      json<import("@/types/api").ProjectClosureDto>(`/v1/projects/${encodeURIComponent(projectId)}/close`, {
        method: "POST",
        body,
      }),
    reopenProjectLifecycle: (projectId: string, body: import("@/types/api").ReopenProjectRequestDto) =>
      json<import("@/types/api").ProjectDeliveryStatusDto>(`/v1/projects/${encodeURIComponent(projectId)}/reopen`, {
        method: "POST",
        body,
      }),
    transitionProjectLifecycle: (projectId: string, body: import("@/types/api").TransitionLifecycleRequestDto) =>
      json<import("@/types/api").ProjectDeliveryStatusDto>(`/v1/projects/${encodeURIComponent(projectId)}/lifecycle`, {
        method: "POST",
        body,
      }),
    projectBlockers: (projectId: string) =>
      json<import("@/types/api").ProjectBlockerDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/blockers`),
    createProjectBlocker: (projectId: string, body: import("@/types/api").CreateBlockerRequestDto) =>
      json<import("@/types/api").ProjectBlockerDto>(`/v1/projects/${encodeURIComponent(projectId)}/blockers`, {
        method: "POST",
        body,
      }),
    waiveProjectBlocker: (projectId: string, blockerId: string, body: import("@/types/api").CreateWaiverRequestDto) =>
      json<import("@/types/api").ProjectBlockerDto>(
        `/v1/projects/${encodeURIComponent(projectId)}/blockers/${encodeURIComponent(blockerId)}/waiver`,
        { method: "POST", body },
      ),
    resolveProjectBlocker: (projectId: string, blockerId: string) =>
      json<import("@/types/api").ProjectBlockerDto>(
        `/v1/projects/${encodeURIComponent(projectId)}/blockers/${encodeURIComponent(blockerId)}/resolve`,
        { method: "POST" },
      ),
    projectLifecycleHistory: (projectId: string) =>
      json<import("@/types/api").ProjectLifecycleHistoryDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/lifecycle-history`),
    projectClosures: (projectId: string) =>
      json<import("@/types/api").ProjectClosureDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/closures`),
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

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get(REQUEST_ID_HEADER) ?? "";
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
