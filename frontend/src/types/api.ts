export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  request_id: string;
  field_errors: Array<{
    field: string;
    message: string;
  }>;
}

export interface HealthResponse {
  status: "ok";
  request_id: string;
  profile: string;
}

export interface MeResponse {
  id: string;
  email: string;
  memberships: Array<{
    id: string;
    org_id: string;
    role_template: string;
    status: string;
    name: string;
    slug: string;
    timezone: string;
    work_calendar: string;
  }>;
}

export interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  calendar: string;
  state: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiFilterParams {
  search?: string;
  page?: number;
  limit?: number;
  status?: string;
  role?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}


/** GET /v1/me/permissions?org={orgId}. Keys are flat; the API does not report scope yet. */
export interface MyPermissionsResponse {
  organizationId?: string;
  organization_id?: string;
  /** Keys granted at ORG scope. */
  permissions: string[];
  /** Every effective grant with its scope (task 1.3). PROJECT grants carry the project id. */
  grants?: ApiGrant[];
}

/** One effective grant as returned by GET /v1/me/permissions (snake_case wire format). */
export interface ApiGrant {
  key: string;
  scope: "ORG" | "PROJECT";
  scope_id: string | null;
}

/* ---------------- Roles, members and grants (task 1.3, snake_case wire format) ---------------- */

export interface RoleDto {
  id: string;
  name: string;
  template: boolean;
  owner_only: boolean;
  version: number;
  grant_count: number;
  permission_keys: string[];
}

export interface RoleRequestDto {
  name: string;
  permission_keys: string[];
  expected_version: number;
}

export interface RoleHolderDto {
  grant_id: string;
  membership_id: string;
  email: string;
  status: string;
  scope: "ORG" | "PROJECT";
  scope_id: string | null;
  expires_at: string | null;
  version: number;
}

export interface MemberDto {
  id: string;
  display_name: string;
  email: string;
  status: string;
  role_template: string;
  /** Membership version for expected_version on status changes (task 1.4). */
  version?: number;
}

export interface GrantDto {
  id: string;
  membership_id: string;
  template_role_id: string | null;
  org_role_id: string | null;
  role_name: string;
  scope: "ORG" | "PROJECT";
  scope_id: string | null;
  expires_at: string | null;
  version: number;
}

export interface GrantRequestDto {
  membership_id: string;
  template_role_id?: string | null;
  org_role_id?: string | null;
  scope: "ORG" | "PROJECT";
  scope_id?: string | null;
  expires_at?: string | null;
}

/** GET /v1/organizations/{orgId}/members (requires role.manage). */
export interface OrgMemberResponse {
  id: string;
  displayName: string;
  email: string;
  status: string;
}

/** GET /v1/organizations/{orgId}/roles (requires role.manage). */
export interface OrgRoleResponse {
  id: string;
  name: string;
  template: boolean;
  version: number;
  permissionKeys: string[];
}

/* ---- Task 1.2: invitations, teams, member changes, handover and ownership (snake_case wire format) ---- */

export type InvitationStatus = "PENDING" | "EXPIRED" | "ACCEPTED" | "REVOKED";

/** An invitation as listed for admins. The secret link is never part of any response. */
export interface InvitationDto {
  id: string;
  email: string;
  template_role_id: string;
  role_name: string;
  team_id: string | null;
  team_name: string | null;
  status: InvitationStatus;
  expires_at: string;
  invited_by_email: string;
  created_at: string;
  last_sent_at: string;
  send_count: number;
  accepted_at: string | null;
  revoked_at: string | null;
  version: number;
}

export interface CreateInvitationDto {
  email: string;
  template_role_id: string;
  team_id?: string | null;
  expires_in_days?: number;
}

export interface InvitationPreviewDto {
  organization_id: string;
  organization_name: string;
  role_name: string;
  team_name: string | null;
  invited_by_email: string;
  expires_at: string;
}

export interface AcceptInvitationDto {
  organization_id: string;
  organization_name: string;
  membership_id: string;
  role_template: string;
}

export interface TeamMemberDto {
  membership_id: string;
  email: string;
  status: string;
  role_template: string;
  added_at: string;
}

export interface TeamDto {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "ARCHIVED";
  lead_membership_id: string | null;
  lead_email: string | null;
  members: TeamMemberDto[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface HandoverItemDto {
  id: string;
  departed_membership_id: string;
  departed_email: string;
  subject_type: "TEAM_LEAD" | "PROJECT_OWNER" | "PROJECT_MANAGER" | "MEMBER";
  subject_id: string;
  subject_label: string;
  status: "NEEDS_OWNER" | "RESOLVED";
  replacement_membership_id: string | null;
  replacement_email: string | null;
  created_at: string;
  resolved_at: string | null;
  version: number;
}

export interface MemberChangeDto {
  id: string;
  status: string;
  version: number;
  open_handover_items: HandoverItemDto[];
}

export interface MemberStatusRequestDto {
  status: "ACTIVE" | "DISABLED";
  reason?: string | null;
  expected_version: number;
  replacement_membership_id?: string | null;
  emergency?: boolean;
}

export interface OwnedItemDto {
  subject_type: HandoverItemDto["subject_type"];
  subject_id: string;
  label: string;
}

export interface MemberOwnershipDto {
  id: string;
  email: string;
  status: string;
  role_template: string;
  version: number;
  owned: OwnedItemDto[];
}

export interface OwnershipDto {
  owner_membership_id: string;
  owner_email: string;
  organization_slug: string;
  version: number;
  caller_is_owner: boolean;
  eligible: { membership_id: string; email: string; role_template: string }[];
}

export interface TransferOwnershipDto {
  new_owner_membership_id: string;
  confirmation: string;
  reason?: string | null;
  expected_version: number;
}

export interface TransferResultDto {
  organization_id: string;
  owner_membership_id: string;
  previous_owner_membership_id: string;
  version: number;
}

/* ---- Task 2.1: project records (snake_case wire format) ---- */

export type ProjectModeDto = "INDIVIDUAL" | "STRUCTURED";
export type ProjectLifecycleDto =
  | "PLANNED"
  | "ACTIVE"
  | "ON_HOLD"
  | "AWAITING_ACCEPTANCE"
  | "DELIVERED"
  | "CLOSED"
  | "CANCELLED";
export type ProjectPriorityDto = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface PersonRefDto {
  membership_id: string;
  email: string;
}

/** percent stays null until someone reports progress; label is then "Not reported". */
export interface ProjectProgressDto {
  percent: number | null;
  label: string;
  reported_at: string | null;
}

export interface ProjectDto {
  id: string;
  key: string;
  name: string;
  description: string | null;
  mode: ProjectModeDto;
  lifecycle: ProjectLifecycleDto;
  archived: boolean;
  priority: ProjectPriorityDto;
  project_manager: PersonRefDto | null;
  accountable: PersonRefDto | null;
  members: PersonRefDto[];
  team_id: string | null;
  team_name: string | null;
  /** Local dates (YYYY-MM-DD) in the project time zone. */
  start_on: string | null;
  target_on: string | null;
  timezone: string;
  active_baseline_id: string | null;
  task_count: number;
  progress: ProjectProgressDto;
  can_edit: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CursorPageDto<T> {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface ProjectListQuery {
  q?: string;
  owner?: string;
  team?: string;
  status?: string;
  mode?: string;
  from?: string;
  to?: string;
  cursor?: string | null;
  limit?: number;
}

export interface CreateProjectDto {
  name: string;
  key: string;
  description?: string | null;
  mode: ProjectModeDto;
  status?: "PLANNED" | "ACTIVE";
  priority?: ProjectPriorityDto;
  project_manager_membership_id?: string | null;
  accountable_membership_id?: string | null;
  member_membership_ids?: string[];
  team_id?: string | null;
  start_on?: string | null;
  target_on?: string | null;
  timezone?: string | null;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string | null;
  priority?: ProjectPriorityDto;
  project_manager_membership_id?: string | null;
  accountable_membership_id?: string | null;
  member_membership_ids?: string[];
  team_id?: string | null;
  start_on?: string | null;
  target_on?: string | null;
  previous_target_on?: string | null;
  target_date_reason?: string | null;
  timezone?: string;
  lifecycle?: ProjectLifecycleDto;
  lifecycle_reason?: string | null;
  expected_version: number;
}

export interface ProjectOptionsDto {
  members: { membership_id: string; email: string; role_template: string }[];
  teams: { id: string; name: string }[];
  default_timezone: string;
}

export interface ProjectDateChangeDto {
  previous_target_on: string | null;
  new_target_on: string | null;
  reason: string;
  actor_email: string | null;
  occurred_at: string;
}
