import type { ApiErrorResponse, HealthResponse } from "@/types/api";
import type * as Dto from "@/types/api";
import type * as W from "@/types/work";
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
  /** Null while a person with several organizations has not chosen one yet. */
  role: string | null;
  department?: string;
  organization_id?: string | null;
  organization_name?: string | null;
  must_change_password: boolean;
}

export interface AuthLoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  must_change_password: boolean;
  target_dashboard_url: string;
  user: AuthUserSummary;
  /** True when the person belongs to several organizations and must choose one (see organizations). */
  requires_organization_selection?: boolean;
  organizations?: OrganizationChoice[];
}

/** An organization the signed-in person can open, with the role and dashboard it gives them. */
export interface OrganizationChoice {
  organization_id: string;
  name: string;
  role: string;
  target_dashboard_url: string;
}

/** One signed-in device of the current person ("My sessions"). */
export interface SessionView {
  id: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  user_agent: string | null;
  ip_address: string | null;
  organization_name: string | null;
  current: boolean;
}

/** What an invitation link is for, readable before signing in. */
export interface PublicInvitationPreview {
  organization_name: string;
  role_name: string;
  team_name: string | null;
  invited_by_email: string;
  email: string;
  expires_at: string;
  account_exists: boolean;
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
  status: "ACTIVE" | "DISABLED" | "PENDING_ACTIVATION" | string;
  must_change_password: boolean;
  last_login_at?: string | null;
  created_at: string;
  /** Latest setup email for a pending account: DELIVERED, FAILED, NOT_SENT or NOT_REQUESTED. Never a credential. */
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
}

export interface UpdateSuperAdminUserPayload {
  name?: string;
  role?: string;
  department?: string;
  organization_id?: string;
  phone?: string;
}

/** Result of sending a setup or reset link. The API never returns a password. */
export interface CredentialDeliveryResult {
  user_id: string;
  email: string;
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
    /**
     * Public signup (approved decision D9). The account stays pending and no session is issued: the API emails a
     * single-use link, the owner opens it (verifyEmail), then signs in. The answer is the same for known addresses.
     */
    signup: (body: { email: string; password: string; name?: string }) =>
      json<{ message: string }>("/v1/auth/signup", { method: "POST", body }),
    /** Activates a self-registered account from the token in its emailed link. Single use. */
    verifyEmail: (token: string) => request("/v1/auth/verify-email", { method: "POST", body: { token } }),
    signin: (body: { email: string; password: string }) =>
      json<{ access_token: string }>("/v1/auth/signin", { method: "POST", body }).then((tokens) => {
        accessToken = tokens.access_token;
        return tokens;
      }),
    login: (body: { email: string; password: string; organization_id?: string }) =>
      json<AuthLoginResponse>("/v1/auth/login", { method: "POST", body }).then((res) => {
        accessToken = res.access_token;
        return res;
      }),
    changePassword: (body: { currentPassword?: string; newPassword: string }) =>
      json<{ access_token: string; refresh_token: string }>("/v1/auth/change-password", {
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
    /** Before signing in: what the emailed link is for, and whether the address already has an account. */
    publicInvitationPreview: (token: string) =>
      json<PublicInvitationPreview>("/v1/invitations/public-preview", { method: "POST", body: { token }, retryOnUnauthorized: false }),
    /** Creates the invited person's account with their own password and joins the organization (single-use link). */
    activateInvitation: (body: { token: string; password: string; name?: string }) =>
      json<Dto.AcceptInvitationDto>("/v1/invitations/activate", { method: "POST", body, retryOnUnauthorized: false }),
    mySessions: () => json<SessionView[]>("/v1/me/sessions"),
    revokeSession: (sessionId: string) => request(`/v1/me/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" }),
    revokeOtherSessions: () => json<{ revoked: number }>("/v1/me/sessions/revoke-others", { method: "POST" }),
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
    /** Authenticated JSON call for typed wrappers outside this file (developer-api.ts). Same headers, refresh and errors. */
    call: <T>(path: string, init: { method?: string; body?: unknown } = {}) =>
      request(path, init).then(async (r) => (r.status === 204 ? (undefined as T) : ((await r.json()) as T))),
    /* ---- Phase 3: structured work for the signed-in member (snake_case wire format) ---- */
    work: {
      mine: () => json<W.WorkItemDto[]>("/v1/me/work-items"),
      myBlockers: () => json<W.WorkBlockerDto[]>("/v1/me/blockers"),
      myFeedback: () => json<W.FeedbackViewDto[]>("/v1/me/review-feedback"),
      projectItems: (projectId: string) =>
        json<W.WorkItemDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/work-items`),
      get: (id: string) => json<W.WorkItemDto>(`/v1/work-items/${encodeURIComponent(id)}`),
      start: (id: string, expectedVersion: number) =>
        json<W.WorkItemDto>(`/v1/work-items/${encodeURIComponent(id)}/start`, {
          method: "POST",
          body: { expected_version: expectedVersion },
        }),
      submit: (id: string, body: { expected_version: number; note?: string; evidence: W.EvidenceItemDto[] }) =>
        json<W.WorkItemDto>(`/v1/work-items/${encodeURIComponent(id)}/submissions`, { method: "POST", body }),
      reviewHistory: (id: string) => json<W.ReviewHistoryDto>(`/v1/work-items/${encodeURIComponent(id)}/reviews`),
      markCheck: (id: string, checkKey: string, satisfied: boolean) =>
        json<W.CheckViewDto>(`/v1/work-items/${encodeURIComponent(id)}/checks/${encodeURIComponent(checkKey)}`, {
          method: "POST",
          body: { satisfied },
        }),
      dependencies: (id: string) =>
        json<W.DependencyViewDto>(`/v1/work-items/${encodeURIComponent(id)}/dependencies`),
      blockers: (id: string) => json<W.WorkBlockerDto[]>(`/v1/work-items/${encodeURIComponent(id)}/blockers`),
      raiseBlocker: (id: string, body: { reason: string; severity: "NORMAL" | "CRITICAL" }) =>
        json<W.WorkBlockerDto>(`/v1/work-items/${encodeURIComponent(id)}/blockers`, { method: "POST", body }),
      resolveBlocker: (blockerId: string, resolution?: string) =>
        json<W.WorkBlockerDto>(`/v1/blockers/${encodeURIComponent(blockerId)}/resolve`, {
          method: "POST",
          body: { resolution: resolution ?? null },
        }),
      projectBlockers: (projectId: string) =>
        json<W.WorkBlockerDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/work-item-blockers`),
      structuredProgress: (projectId: string) =>
        json<W.StructuredProgressDto>(`/v1/projects/${encodeURIComponent(projectId)}/structured-progress`),
      scopeVersions: (projectId: string) =>
        json<W.ScopeVersionSummaryDto[]>(`/v1/projects/${encodeURIComponent(projectId)}/scope-versions`),
    },
    /** Selects the active workspace; the old token is revoked server-side and replaced here. */
    switchOrganization: (orgId: string) =>
      json<{ access_token: string; role?: string; target_dashboard_url?: string }>(`/v1/me/organizations/${encodeURIComponent(orgId)}/switch`, { method: "POST" }).then(
        (tokens) => {
          accessToken = tokens.access_token;
          return tokens;
        },
      ),
    requestPasswordReset: (email: string) =>
      request("/v1/auth/password-reset/request", { method: "POST", body: { email } }),
    confirmPasswordReset: (token: string, password: string) =>
      request("/v1/auth/password-reset/confirm", { method: "POST", body: { token, password } }),
    /** First password for a pending account from its emailed setup link (setup links only). */
    activateAccount: (token: string, password: string) =>
      request("/v1/auth/activate-account", { method: "POST", body: { token, password } }),
    /** Super Admin SMTP administration. The password is write-only and never returned. */
    smtp: {
      settings: () => json<SmtpSettingsResponse>("/v1/admin/smtp/settings"),
      save: (body: UpdateSmtpSettingsRequest) =>
        json<SmtpSettingsResponse>("/v1/admin/smtp/settings", { method: "PUT", body }),
      testConnection: () => json<SmtpConnectionTestResponse>("/v1/admin/smtp/test-connection", { method: "POST" }),
      sendTestEmail: (recipient: string) =>
        json<SmtpTestEmailResponse>("/v1/admin/smtp/test-email", { method: "POST", body: { recipient } }),
      verifySender: (senderEmail?: string) =>
        json<SmtpVerifySenderResponse>("/v1/admin/smtp/verify-sender", {
          method: "POST",
          body: senderEmail ? { sender_email: senderEmail } : {},
        }),
      logs: (params: EmailLogQuery = {}) => {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
        });
        const qs = query.toString() ? `?${query.toString()}` : "";
        return json<EmailDeliveryLogPage>(`/v1/admin/smtp/logs${qs}`);
      },
    },
    /** Platform Operator console: read-only delivery logs. */
    operatorEmailDelivery: (status?: string) =>
      json<OperatorEmailDeliveryLog[]>(
        `/v1/operator/email/delivery${status && status !== "ALL" ? `?status=${encodeURIComponent(status)}` : ""}`,
      ),
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
        return json<SuperAdminUserPageResponse>(`/v1/admin/users${qs}`);
      },
      get: (id: string) => json<SuperAdminUserItem>(`/v1/admin/users/${id}`),
      create: (body: CreateSuperAdminUserPayload) =>
        json<SuperAdminUserItem>("/v1/admin/users", { method: "POST", body }),
      update: (id: string, body: UpdateSuperAdminUserPayload) =>
        json<SuperAdminUserItem>(`/v1/admin/users/${id}`, { method: "PUT", body }),
      updateStatus: (id: string, status: "ACTIVE" | "DISABLED", reason?: string) =>
        request(`/v1/admin/users/${id}/status`, {
          method: "PATCH",
          body: { status, reason },
        }),
      /** Emails a 30-minute reset link to an active account and signs it out everywhere. */
      sendResetLink: (id: string) =>
        json<CredentialDeliveryResult>(`/v1/admin/users/${id}/reset-password`, {
          method: "POST",
        }),
      /** Emails a new 72-hour setup link to a pending account; earlier links stop working. */
      resendSetupLink: (id: string) =>
        json<CredentialDeliveryResult>(`/v1/admin/users/${id}/resend-invitation`, {
          method: "POST",
        }),
      loginHistory: (id: string) =>
        json<UserLoginHistoryItem[]>(`/v1/admin/users/${id}/login-history`),
    },
  };
}

export const apiClient = createApiClient();

/* ---------------------------------------------------------------- SMTP (mirrors EmailProviderDTOs) */

export type SmtpConnectionStatus =
  | "NOT_TESTED"
  | "NOT_CONFIGURED"
  | "CONNECTED"
  | "DISCONNECTED"
  | "AUTHENTICATION_FAILED"
  | "TLS_FAILURE"
  | "CONNECTION_TIMEOUT"
  | "SERVER_UNAVAILABLE"
  | "SENDER_REJECTED"
  | "RECIPIENT_REJECTED"
  | "RATE_LIMITED";

export type EmailDeliveryStatus = "QUEUED" | "PROCESSING" | "SMTP_ACCEPTED" | "FAILED" | "RETRY_PENDING" | "NOT_SENT";

export interface SmtpSettingsResponse {
  provider: string;
  host: string;
  port: number;
  encryption: "TLS" | "SSL" | "NONE";
  username: string;
  credentials_configured: boolean;
  password_source: "DATABASE" | "ENVIRONMENT" | "NONE" | "UNREADABLE";
  password_updated_at: string | null;
  encryption_key_configured: boolean;
  settings_source: "DATABASE" | "ENVIRONMENT";
  from_name: string;
  from_email: string;
  reply_to_email: string;
  rate_limit_per_minute: number;
  retry_attempts: number;
  retry_wait_seconds: number;
  connection_status: SmtpConnectionStatus;
  last_tested_at: string | null;
  last_test_message: string | null;
  problem: string | null;
  updated_by: string | null;
  updated_at: string | null;
  version: number;
}

export interface UpdateSmtpSettingsRequest {
  provider: string;
  host: string;
  port: number;
  encryption: string;
  username: string;
  /** Write-only; omit to keep the stored password. */
  password?: string;
  from_name: string;
  from_email: string;
  reply_to_email: string;
  rate_limit_per_minute: number;
  retry_attempts: number;
  retry_wait_seconds: number;
  expected_version: number;
}

export interface SmtpConnectionTestResponse {
  status: SmtpConnectionStatus;
  latency_ms: number;
  server_response: string | null;
  detail: string;
  encrypted: boolean;
  host: string;
  port: number;
  encryption: string;
  tested_at: string;
}

export interface SmtpTestEmailResponse {
  accepted: boolean;
  status: EmailDeliveryStatus;
  recipient: string;
  sender: string | null;
  provider: string;
  attempted_at: string;
  message_id: string | null;
  smtp_response: string | null;
  error: string | null;
  attempts: number;
  log_id: string;
  note: string;
}

export interface SmtpVerifySenderResponse {
  sender_email: string;
  accepted: boolean;
  connection_status: SmtpConnectionStatus;
  smtp_response: string | null;
  detail: string;
  matches_authenticated_account: boolean;
  checked_at: string;
}

export interface EmailDeliveryLogItem {
  id: string;
  recipient: string;
  sender: string | null;
  subject: string;
  email_type: string | null;
  provider: string | null;
  status: EmailDeliveryStatus;
  attempts: number;
  smtp_response: string | null;
  error_code: string | null;
  error_message: string | null;
  message_id: string | null;
  created_at: string;
  sent_at: string | null;
}

export interface EmailDeliveryLogPage {
  items: EmailDeliveryLogItem[];
  page: number;
  size: number;
  total: number;
  total_pages: number;
}

export interface EmailLogQuery {
  page?: number;
  size?: number;
  q?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
}

export interface OperatorEmailDeliveryLog {
  id: string;
  recipient: string;
  subject: string;
  provider: string | null;
  status: string;
  attempts: number;
  error_code: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

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
