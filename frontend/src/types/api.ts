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


/* ---------------- Projects (Task 2.1) ---------------- */

export type ProjectMode = "INDIVIDUAL" | "STRUCTURED";
export type ProjectPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ProjectLifecycle = "PLANNED" | "ACTIVE" | "ON_HOLD" | "AWAITING_ACCEPTANCE" | "DELIVERED" | "CLOSED" | "CANCELLED";
export type ProjectHealth = "ON_TRACK" | "AT_RISK" | "DELAYED" | "OFF_TRACK" | "UNKNOWN";

export interface ProjectDateHistoryDto {
  id: string;
  oldTargetDate: string | null;
  newTargetDate: string;
  reason: string;
  actorId: string;
  changedAt: string;
}

export interface ProjectDto {
  id: string;
  orgId: string;
  key: string;
  name: string;
  description: string | null;
  mode: ProjectMode;
  lifecycle: ProjectLifecycle;
  priority: ProjectPriority;
  projectManagerId: string | null;
  accountableDeveloperId: string | null;
  teamIds: string[];
  memberIds: string[];
  startDate: string;
  targetDate: string | null;
  timezone: string;
  lastProgressPercent: number;
  health: ProjectHealth;
  archived: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  dateHistory?: ProjectDateHistoryDto[];
}

export interface CreateProjectRequestDto {
  name: string;
  key: string;
  description?: string;
  mode?: ProjectMode;
  priority?: ProjectPriority;
  lifecycle?: ProjectLifecycle;
  projectManagerId?: string;
  accountableDeveloperId?: string;
  memberIds?: string[];
  teamIds?: string[];
  startDate?: string;
  targetDate?: string;
  timezone?: string;
}

export interface UpdateProjectRequestDto {
  name?: string;
  description?: string;
  mode?: ProjectMode;
  priority?: ProjectPriority;
  lifecycle?: ProjectLifecycle;
  projectManagerId?: string;
  accountableDeveloperId?: string;
  memberIds?: string[];
  teamIds?: string[];
  startDate?: string;
  targetDate?: string;
  targetDateReason?: string;
  timezone?: string;
  expectedVersion: number;
}

export interface ProjectMemberDto {
  id: string;
  projectId: string;
  membershipId: string;
  userId: string | null;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

export interface ProjectMemberRequestDto {
  membershipId: string;
  role?: string;
}

export interface ProjectListResponseDto {
  projects: ProjectDto[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

/* ---------------- Task 2.2: Developer Progress & Verification (snake_case wire format) ---------------- */

export interface EvidenceItemDto {
  type: "COMMIT" | "PULL_REQUEST" | "DOCUMENT" | "OTHER" | string;
  sha?: string;
  title?: string;
  url?: string;
  repo_name?: string;
}

export interface CheckInSubmissionRequestDto {
  percent: number;
  accomplished: string;
  next_steps: string;
  blockers?: string;
  projected_finish?: string;
  evidence?: string;
  evidence_items?: EvidenceItemDto[];
  downward_reason?: string;
}

export interface VerificationDecisionRequestDto {
  decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT" | string;
  comment?: string;
}

export interface CheckInDto {
  id: string;
  project_id: string;
  project_key: string;
  project_name: string;
  author_id: string;
  author_name: string;
  revision_of: string | null;
  revision_seq: number;
  percent: number;
  accomplished: string;
  next_steps: string;
  blockers: string | null;
  projected_finish: string | null;
  evidence_summary: string | null;
  evidence_items: EvidenceItemDto[];
  downward_reason: string | null;
  status: "PENDING" | "PENDING_VERIFICATION" | "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED" | string;
  method: string;
  verified_by: string | null;
  verified_by_name: string | null;
  review_comment: string | null;
  reviewed_at: string | null;
  captured_at: string;
  created_at: string;
}

export interface ProgressSummaryDto {
  project_id: string;
  project_key: string;
  project_name: string;
  mode: string;
  current_percent: number;
  current_method: string;
  last_reported_at: string | null;
  require_verification: boolean;
  latest_accepted_checkin: CheckInDto | null;
  pending_checkin: CheckInDto | null;
  history: CheckInDto[];
}

export interface PendingReviewDto {
  checkin: CheckInDto;
  project_id: string;
  project_key: string;
  project_name: string;
  mode: string;
  author_name: string;
  author_email: string | null;
  current_project_percent: number;
  submitted_at: string;
}

export interface GitHubActivityItemDto {
  id: string;
  org_id: string;
  project_id: string | null;
  repository_name: string;
  event_type: string;
  actor: string;
  title: string;
  sha: string | null;
  url: string | null;
  created_at: string;
}

/* ---------------- Task 2.4: Deliver, Close, Archive & Restore (Lifecycle) ---------------- */

export interface DeliveryChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  notes?: string;
}

export interface DeliveryEvidenceItem {
  type: string;
  title: string;
  url: string;
  reference?: string;
}

export interface AcceptanceSubmissionRequestDto {
  bound_checkin_id?: string;
  checklist: DeliveryChecklistItem[];
  evidence_summary?: string;
  evidence_items?: DeliveryEvidenceItem[];
}

export interface AcceptanceDecisionRequestDto {
  decision: "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED";
  reason: string;
  expected_project_version: number;
}

export interface AcceptanceDecisionDto {
  id: string;
  request_id: string;
  project_id: string;
  decision: string;
  actor_id: string;
  actor_name: string | null;
  reason: string | null;
  decided_at: string;
}

export interface AcceptanceRequestDto {
  id: string;
  org_id: string;
  project_id: string;
  bound_checkin_id: string | null;
  checklist: DeliveryChecklistItem[];
  evidence_summary: string | null;
  evidence_items: DeliveryEvidenceItem[];
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "CHANGES_REQUESTED" | string;
  version: number;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  decisions: AcceptanceDecisionDto[];
}

export interface ProjectBlockerWaiverDto {
  id: string;
  project_id: string;
  blocker_ref: string;
  actor_id: string;
  actor_name: string | null;
  reason: string;
  waived_at: string;
}

export interface ProjectBlockerDto {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  severity: "NORMAL" | "CRITICAL";
  status: "OPEN" | "RESOLVED" | "WAIVED";
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
  waiver: ProjectBlockerWaiverDto | null;
}

export interface ProjectClosureDto {
  id: string;
  project_id: string;
  actor_id: string;
  actor_name: string | null;
  handover_note: string;
  reason: string;
  closed_at: string;
}

export interface ProjectLifecycleHistoryDto {
  id: string;
  project_id: string;
  previous_lifecycle: string | null;
  new_lifecycle: string;
  reason: string | null;
  actor_id: string;
  actor_name: string | null;
  created_at: string;
}

export interface ProjectDeliveryStatusDto {
  project_id: string;
  lifecycle: ProjectLifecycle;
  previous_lifecycle: string | null;
  archived: boolean;
  progress_percent: number;
  version: number;
  latest_acceptance_request: AcceptanceRequestDto | null;
  latest_closure: ProjectClosureDto | null;
  open_critical_blockers_count: number;
  open_unwaived_critical_blockers_count: number;
  can_submit_delivery: boolean;
  can_approve_delivery: boolean;
  can_close: boolean;
  can_archive: boolean;
  can_restore: boolean;
}

export interface CreateBlockerRequestDto {
  title: string;
  description?: string;
  severity: "NORMAL" | "CRITICAL";
}

export interface CreateWaiverRequestDto {
  reason: string;
}

export interface CloseProjectRequestDto {
  handover_note: string;
  reason: string;
  expected_project_version: number;
}

export interface ReopenProjectRequestDto {
  reason: string;
  expected_project_version: number;
}

export interface TransitionLifecycleRequestDto {
  target_lifecycle: "ON_HOLD" | "ACTIVE";
  reason: string;
  expected_project_version: number;
}
