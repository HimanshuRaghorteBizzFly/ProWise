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

/** Where the server says this session lands (never a client-side default). */
export type LandingKind = "PLATFORM" | "WORKSPACE" | "SELECT_WORKSPACE" | "NO_WORKSPACE";

export interface MeResponse {
  id: string;
  email: string;
<<<<<<< HEAD
  name?: string | null;
  /** Platform role for platform accounts, else the role template of the active workspace membership (or null). */
  role?: string | null;
  /** The organization this session's token is bound to (null: none selected yet). */
  organization_id?: string | null;
  organization_name?: string | null;
  must_change_password?: boolean;
  target_dashboard_url?: string;
  landing?: LandingKind | null;
  platform_account?: boolean;
=======
  name?: string;
  /** The role of this session: the membership role in the bound organization, or a platform role; null when unbound. */
  role?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  target_dashboard_url?: string;
  must_change_password?: boolean;
>>>>>>> 425eba1c2e8cca7686bf3db85b1311460d0d56e4
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

export interface CodeReviewDto {
  id: string;
  project_id: string;
  work_item_id: string | null;
  title: string;
  pr_number: number | null;
  pr_url: string | null;
  repository_name: string | null;
  branch: string | null;
  author_id: string;
  reviewer_id: string;
  status: string;
  inspected_revision: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  org_id?: string;
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
  include_archived?: boolean;
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
  mode?: ProjectModeDto;
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

/* Task 2.2: Individual check-ins and Team Lead approval (backend ProgressDTOs). */

export type CheckInStatusDto = "PENDING" | "APPROVED" | "REJECTED";

export interface CheckInPersonDto {
  user_id: string | null;
  email: string | null;
}

/** One append-only entry. The label is always "Developer reported", also after approval. */
export interface CheckInDto {
  id: string;
  project_id: string;
  revision_seq: number;
  revision_of: string | null;
  percent: number;
  accomplished: string;
  next_steps: string;
  blockers: string | null;
  projected_finish: string | null;
  evidence: string | null;
  downward_reason: string | null;
  status: CheckInStatusDto;
  method: "developer_reported";
  label: string;
  author: CheckInPersonDto;
  submitted_at: string;
  decided_by: CheckInPersonDto | null;
  decided_at: string | null;
  decision_reason: string | null;
  version: number;
}

/** The approved figure; percent null and label "Not reported" until an entry is approved. */
export interface ProgressFigureDto {
  percent: number | null;
  label: string;
  method: "developer_reported" | null;
  reported_at: string | null;
  approved_at: string | null;
  checkin_id: string | null;
}

export interface ProgressSummaryDto {
  project_id: string;
  project_key: string;
  project_name: string;
  mode: ProjectModeDto;
  lifecycle: ProjectLifecycleDto;
  archived: boolean;
  current: ProgressFigureDto;
  pending: CheckInDto | null;
  approver: CheckInPersonDto | null;
  approver_note: string | null;
  can_submit: boolean;
  can_decide: boolean;
  history: CheckInDto[];
}

export interface PendingReviewDto {
  project_id: string;
  project_key: string;
  project_name: string;
  current: ProgressFigureDto;
  checkin: CheckInDto;
}

export interface CheckInRequestDto {
  percent: number;
  accomplished: string;
  next_steps: string;
  blockers?: string;
  projected_finish?: string;
  evidence?: string;
  downward_reason?: string;
}

export interface CheckInDecisionDto {
  decision: "APPROVE" | "REJECT";
  reason?: string;
  expected_version: number;
}

/** GitHub activity is evidence only; these events never determine project progress. */
export interface GitHubActivityDto {
  id: string;
  repository_name: string;
  event_type: string;
  actor: string;
  title: string;
  detail: string | null;
  sha: string | null;
  pr_number: number | null;
  branch: string | null;
  status: string | null;
  linked_task_key: string | null;
  project_id: string | null;
  created_at: string;
  org_id: string | null;
}

/* Task 2.4: delivery lifecycle and blocker DTOs (backend DeliveryDTOs). */

export interface DeliveryChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  notes: string | null;
}

export interface DeliveryEvidenceItem {
  type: string;
  title: string | null;
  url: string | null;
  reference: string | null;
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
  actor_id: string | null;
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
  status: string;
  version: number | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  decisions: AcceptanceDecisionDto[];
}

export interface CreateBlockerRequestDto {
  title: string;
  description?: string;
  severity: "NORMAL" | "CRITICAL";
}

export interface CreateWaiverRequestDto {
  blocker_ref: string;
  reason: string;
}

export interface ProjectBlockerWaiverDto {
  id: string;
  project_id: string;
  blocker_ref: string;
  actor_id: string | null;
  actor_name: string | null;
  reason: string;
  waived_at: string;
}

export interface ProjectBlockerDto {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  severity: "NORMAL" | "CRITICAL" | string;
  status: string;
  created_by: string | null;
  created_at: string;
  resolved_at: string | null;
  waiver: ProjectBlockerWaiverDto | null;
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

export interface ProjectClosureDto {
  id: string;
  project_id: string;
  actor_id: string | null;
  actor_name: string | null;
  handover_note: string | null;
  reason: string | null;
  closed_at: string;
}

export interface ProjectLifecycleHistoryDto {
  id: string;
  project_id: string;
  previous_lifecycle: string | null;
  new_lifecycle: string;
  reason: string | null;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface ProjectDeliveryStatusDto {
  project_id: string;
  lifecycle: ProjectLifecycleDto;
  previous_lifecycle: string | null;
  archived: boolean;
  progress_percent: number | null;
  version: number | null;
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

/* Super Admin: stored platform data (no invented trends or history). */

export interface AdminOrganizationDto {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  industry: string | null;
  country: string | null;
  timezone: string | null;
  owner_name: string | null;
  owner_email: string | null;
  status: string | null;
  plan_id: string | null;
  seats_used: number;
  seats_limit: number;
  projects_count: number;
  created_at: string | null;
  last_activity_at: string | null;
}

export interface AdminDashboardDto {
  total_organizations: number;
  active_organizations: number;
  trial_organizations: number;
  suspended_organizations: number;
  active_operators: number;
  total_seats_allocated: number;
}

/* Task 3.1: Create Project setup, work breakdown, assignment, work types, project documents. */

export type WorkLevelDto = "MILESTONE" | "DELIVERABLE" | "TASK" | "SUBTASK";

export interface WorkPersonDto {
  membership_id: string;
  email: string | null;
}

export interface WorkItemDto {
  id: string;
  key: string;
  type: WorkLevelDto;
  parent_id: string | null;
  title: string;
  description: string | null;
  points: number;
  unit: string;
  work_type_id: string | null;
  work_type_name: string | null;
  assignee: WorkPersonDto | null;
  reviewer: WorkPersonDto | null;
  collaborators: WorkPersonDto[];
  state: string;
  position: number;
  leaf: boolean;
  version: number;
  created_at: string | null;
}

export interface ProjectDocumentDto {
  id: string;
  project_id: string | null;
  file_name: string;
  file_size: number;
  file_type: string;
  uploaded_by_email: string | null;
  uploaded_at: string;
}

export interface SetupTaskDto {
  title: string;
  points: number;
  reviewer_membership_id: string;
}

export interface SetupPhaseDto {
  title: string;
  tasks: SetupTaskDto[];
}

export interface ConfiguredProjectRequestDto {
  project: CreateProjectDto;
  document_ids: string[];
  phases: SetupPhaseDto[];
}

export interface ConfiguredProjectDto {
  project: ProjectDto;
  items: WorkItemDto[];
  documents: ProjectDocumentDto[];
}

export interface AddWorkItemDto {
  type: WorkLevelDto;
  parent_id?: string | null;
  title: string;
  description?: string | null;
  points?: number | null;
  work_type_id?: string | null;
  reviewer_membership_id?: string | null;
}

export interface UpdateWorkItemDto {
  title?: string;
  description?: string | null;
  work_type_id?: string | null;
  parent_id?: string | null;
  move_to_project_root?: boolean;
  expected_version: number;
}

export interface AssignmentDto {
  assignee_membership_id: string;
  reviewer_membership_id?: string | null;
  collaborator_membership_ids?: string[];
  reason?: string;
  expected_version: number;
}

export interface AssignmentChangeDto {
  previous_assignee: WorkPersonDto | null;
  new_assignee: WorkPersonDto | null;
  previous_reviewer: WorkPersonDto | null;
  new_reviewer: WorkPersonDto | null;
  reason: string | null;
  actor_email: string;
  occurred_at: string;
}

export interface AssignableItemDto {
  project_id: string;
  project_key: string;
  project_name: string;
  item: WorkItemDto;
}

export interface WorkTypeDto {
  id: string;
  name: string;
  description: string | null;
  retired: boolean;
  version: number;
}

/* Task 3.2: scope versions (points only). */

export type ScopeChangeKindDto = "ADD" | "REMOVE" | "CANCEL" | "SPLIT" | "REWEIGHT";

export interface ScopeLeafDto {
  work_item_id: string;
  key: string;
  title: string;
  points: number;
  cancelled: boolean;
}

export interface ScopeChangeViewDto {
  kind: ScopeChangeKindDto;
  work_item_id: string;
  key: string;
  title: string;
  previous_points: number | null;
  new_points: number | null;
  source_work_item_id: string | null;
}

export interface ScopeVersionDto {
  id: string;
  version_no: number;
  base_version_no: number;
  unit: "POINTS";
  status: "DRAFT" | "ACTIVE" | "SUPERSEDED";
  reason: string;
  author_email: string;
  approver_email: string | null;
  created_at: string;
  approved_at: string | null;
  superseded_at: string | null;
  total_points: number;
  leaves: ScopeLeafDto[];
  changes: ScopeChangeViewDto[];
  version: number;
}

export interface ScopeChangeRequestDto {
  kind: ScopeChangeKindDto;
  work_item_id?: string;
  points?: number;
  title?: string;
  parent_id?: string | null;
  parts?: { title: string; points: number }[];
}

export interface ScopeDraftDto {
  reason: string;
  expected_base_version: number;
  changes: ScopeChangeRequestDto[];
}

/* Tasks 3.3 and 3.5: review and rework, accepted-work progress. */
export interface ReviewCheckDto {
  id: string;
  label: string;
}

export interface ReviewTaskDto {
  project_id: string;
  project_key: string;
  project_name: string;
  item: WorkItemDto;
  current_revision: number;
  submitted_revision: number | null;
  accepted_revision: number | null;
  cancelled: boolean;
  checks: ReviewCheckDto[];
  /** Task 3.4: predecessors not accepted yet; the task cannot be submitted until this is empty. */
  waiting_on: DependencyItemRefDto[];
  blocked: boolean;
  dependency_flag: string | null;
}

export interface SubmitTaskDto {
  note?: string;
  expected_version: number;
}

export interface ReviewDecisionDto {
  reviewed_revision: number;
  passed_check_ids: string[];
  note?: string;
  expected_version: number;
}

export interface ReviewEventDto {
  kind: "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED" | "REOPENED";
  revision: number;
  note: string | null;
  actor_email: string;
  occurred_at: string;
}

export interface ProgressSnapshotDto {
  id: string;
  scope_version_no: number | null;
  numerator: number;
  denominator: number;
  percent: number | null;
  display_percent: number | null;
  method: string;
  cause: string;
  captured_at: string;
}

export interface StructuredProgressDto {
  numerator: number;
  denominator: number;
  percent: number | null;
  display_percent: number | null;
  label: string;
  method: string;
  scope_version_no: number | null;
  snapshots: ProgressSnapshotDto[];
}

/* Task 3.4: dependencies and blockers. */
export interface DependencyItemRefDto {
  id: string;
  key: string;
  title: string;
  state: string;
}

export interface DependencyLinkDto {
  id: string;
  predecessor_id: string;
  successor_id: string;
  created_at: string;
}

export interface DependencyFlagDto {
  work_item_id: string;
  reason: string;
  flagged_at: string;
}

export type BlockerSeverityDto = "NORMAL" | "CRITICAL";

export interface BlockerDto {
  id: string;
  work_item_id: string;
  work_item_key: string;
  reason: string;
  severity: BlockerSeverityDto;
  owner: WorkPersonDto | null;
  opened_by_email: string | null;
  opened_at: string;
  resolved_at: string | null;
  resolution: string | null;
  resolved_by_email: string | null;
  version: number;
}

export interface DependencyBoardDto {
  links: DependencyLinkDto[];
  flags: DependencyFlagDto[];
  blockers: BlockerDto[];
}

export interface DependencyChangeDto {
  link: DependencyLinkDto | null;
  affected: DependencyItemRefDto[];
}

export interface RaiseBlockerDto {
  reason: string;
  severity: BlockerSeverityDto;
  owner_membership_id: string;
  expected_version: number;
}

export interface RaisedBlockerDto {
  blocker: BlockerDto;
  affected: DependencyItemRefDto[];
}

/* Task 2.3: work calendar, cadence and due occurrences. */
export type WeekdayDto = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";
export type CadenceFrequencyDto = "DAILY" | "WEEKLY" | "FORTNIGHTLY";

export interface HolidayDto {
  date: string;
  name: string;
}

export interface OrgCalendarDto {
  workdays: WeekdayDto[];
  holidays: HolidayDto[];
  timezone: string;
  version: number;
  can_edit: boolean;
}

export interface UpdateOrgCalendarDto {
  workdays: WeekdayDto[];
  holidays: HolidayDto[];
  expected_version: number;
}

export interface CadenceChangeDto {
  previous_frequency: string | null;
  new_frequency: string;
  previous_grace: number | null;
  new_grace: number;
  previous_cutoff: string | null;
  new_cutoff: string;
  reason: string;
  changed_by_email: string | null;
  changed_at: string;
}

export interface ProjectCadenceDto {
  project_id: string;
  frequency: CadenceFrequencyDto;
  day_of_week: WeekdayDto;
  local_cutoff_time: string;
  grace_working_days: number;
  policy_version: number;
  paused: boolean;
  can_edit: boolean;
  history: CadenceChangeDto[];
}

export interface UpdateCadenceDto {
  frequency: CadenceFrequencyDto;
  day_of_week: WeekdayDto;
  local_cutoff_time: string;
  grace_working_days: number;
  reason: string;
  expected_version: number;
}

export type OccurrenceStatusDto = "OPEN" | "MET" | "MISSED" | "EXCUSED" | "SUPERSEDED" | "PAUSED";

export interface OccurrenceDto {
  id: string;
  kind: "CHECKIN" | "TARGET";
  due_local_date: string;
  grace_until_date: string;
  zone: string;
  cutoff_instant: string;
  grace_cutoff_instant: string;
  policy_version: number;
  status: OccurrenceStatusDto;
  /** UPCOMING | DUE_TODAY | IN_GRACE | MISSED | MET | PAUSED | EXCUSED | SUPERSEDED | ON_TIME | OVERDUE */
  display: string;
  superseded_reason: string | null;
}

export interface ComplianceDto {
  met: number;
  missed: number;
  eligible: number;
  pending: number;
  in_grace: number;
  excused: number;
  rate: number | null;
}

export interface ProjectScheduleDto {
  project_id: string;
  lifecycle: string;
  timezone: string;
  on_hold: boolean;
  target_date: string | null;
  target_overdue_from: string | null;
  target_display: string | null;
  next_check_in: OccurrenceDto | null;
  compliance: ComplianceDto;
  rough_pace: number | null;
  occurrences: OccurrenceDto[];
}

/* Task 3.1: team work for Team Leads and members. */
export interface MemberWorkDto {
  membership_id: string;
  email: string;
  lead: boolean;
  open_tasks: number;
  open_points: number;
  tasks: AssignableItemDto[];
}

export interface TeamWorkDto {
  id: string;
  name: string;
  lead_email: string | null;
  you_lead: boolean;
  members: MemberWorkDto[];
}

/* Task 3.2: a scope version with its project. */
export interface ProjectScopeVersionDto {
  project_id: string;
  project_key: string;
  project_name: string;
  can_approve: boolean;
  version: ScopeVersionDto;
  active: ScopeVersionDto | null;
}

/* Task 3.4: a blocker with its project and the work it holds up. */
export interface OrgBlockerDto {
  project_id: string;
  project_key: string;
  project_name: string;
  blocker: BlockerDto;
  affected: DependencyItemRefDto[];
  can_resolve: boolean;
}
