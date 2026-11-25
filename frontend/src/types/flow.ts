/**
 * Project delivery flow wire types (snake_case, as the backend serializes them).
 * Sources: com.prowise.work.{ProjectSetupService, ProjectFlowService, ProjectApprovers},
 * com.prowise.project.FileService, com.prowise.integration.github.GitHubService.
 */

export type DeliveryModeChoice = "SOLO" | "TEAM";

export interface SetupPersonDto {
  membership_id: string;
  user_id: string;
  name: string;
  email: string;
  role: string;
  open_tasks: number;
  active_projects: number;
}

export interface SetupLimitsDto {
  max_total_points: number;
  document_max_bytes: number;
  screenshot_max_bytes: number;
  max_phases: number;
  max_tasks: number;
}

export interface SetupOptionsDto {
  default_timezone: string;
  /** Today in the organization's time zone (YYYY-MM-DD): the earliest start date. */
  today: string;
  people: SetupPersonDto[];
  limits: SetupLimitsDto;
}

export interface SetupPhaseDto {
  ref: string;
  name: string;
}

export interface SetupTaskDto {
  ref: string;
  title: string;
  description?: string | null;
  phase_ref: string;
  points: number;
  depends_on_ref?: string | null;
  assignee_membership_id?: string | null;
}

export interface SetupRequestDto {
  name: string;
  key: string;
  description?: string | null;
  mode: DeliveryModeChoice;
  start_on: string;
  target_on: string;
  timezone?: string | null;
  priority?: string | null;
  team_lead_membership_id?: string | null;
  developer_membership_ids: string[];
  qa_membership_ids: string[];
  approver_membership_ids: string[];
  document_file_ids: string[];
  phases: SetupPhaseDto[];
  tasks: SetupTaskDto[];
}

export interface ApproverDto {
  membership_id: string;
  user_id: string;
  email: string;
  name: string | null;
  role_template: string;
}

export interface SetupResultDto {
  project: { id: string; key: string; name: string; mode: string };
  total_points: number;
  task_count: number;
  approvers: ApproverDto[];
}

export interface ApproversViewDto {
  approvers: ApproverDto[];
  caller_is_approver: boolean;
  can_edit: boolean;
  project_version: number;
}

export interface FileViewDto {
  id: string;
  name: string;
  size: number;
  content_type: string;
  kind: "PROJECT_DOCUMENT" | "SCREENSHOT" | "LEGACY" | string;
  project_id: string | null;
  work_item_id: string | null;
  uploaded_by_email: string | null;
  created_at: string;
  download_path: string;
}

export interface QueueItemDto {
  kind: "TASK" | "SOLO";
  id: string;
  /** What the review page opens: the work item id, or "checkin-<id>" for a Solo submission. */
  review_ref: string;
  project: { id: string; key: string; name: string; mode: string };
  key: string;
  title: string;
  points: number | null;
  reported_percent: number | null;
  note: string | null;
  submitted_by: string | null;
  submitted_at: string;
  revision: number | null;
}

export interface ActivityEntryDto {
  action: string;
  actor_email: string | null;
  occurred_at: string;
  reason: string | null;
  from_state: string | null;
  to_state: string | null;
}

export interface GitHubConnectionDto {
  connected: boolean;
  id: string | null;
  repository: string | null;
  status: string | null;
  connected_by: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  webhook_url: string | null;
  version: number;
  can_manage: boolean;
  /** Present only in the response that created or rotated it. */
  webhook_secret: string | null;
  /** Last 4 characters of the stored token; the token itself is never returned. */
  token_last4: string | null;
  repository_url: string | null;
  /** GITHUB_APP: through the organization's GitHub App installation (no token, no per-repo webhook). */
  provider?: "GITHUB_APP" | "GITHUB_TOKEN" | string | null;
  branch?: string | null;
  installation_id?: string | null;
  installation_account?: string | null;
  private_repository?: boolean | null;
  /** Imported commits and pull requests in the project's activity feed. */
  activity_count?: number;
}

/* ---- GitHub App: connect GitHub once per organization, then one repository per project ---- */

export interface GitHubInstallationDto {
  id: string;
  github_installation_id: number;
  account: string;
  account_type: "User" | "Organization" | "Enterprise" | string;
  repository_selection: "all" | "selected" | string | null;
  status: "ACTIVE" | "SUSPENDED" | string;
  version: number;
  connected_at: string;
  connected_by: string | null;
  project_count: number;
  /** Where the GitHub account owner changes which repositories the App can see. */
  manage_url: string;
}

export interface GitHubAppStatusDto {
  configured: boolean;
  app_slug: string | null;
  can_manage: boolean;
  installations: GitHubInstallationDto[];
}

export interface GitHubCallbackResultDto {
  installation_id: string;
  account: string;
  status: string;
  return_to: string | null;
}

export interface GitHubRepoChoiceDto {
  full_name: string;
  default_branch: string;
  private_repository: boolean;
  description: string | null;
  /** Another project of this organization already connected to it. */
  used_by_project: string | null;
}

export interface GitHubChoiceDto {
  installation_id: string;
  repository: string;
  branch: string;
  expected_version?: number;
}

export interface GitHubCheckDto {
  key: "repository_access" | "branch" | "commits" | "pull_requests" | "webhook" | "not_in_use" | string;
  label: string;
  ok: boolean;
  detail: string;
  required: boolean;
}

export interface GitHubValidationDto {
  ok: boolean;
  repository: string;
  repository_url: string;
  private_repository: boolean;
  default_branch: string;
  branch: string;
  account: string;
  installation_id: string;
  checks: GitHubCheckDto[];
}

export interface GitHubConnectResultDto {
  connection: GitHubConnectionDto;
  imported: SyncResultDto;
}

export interface GitHubFeedItemDto {
  id: string;
  type: "COMMIT" | "PULL_REQUEST" | string;
  sha: string | null;
  pr_number: number | null;
  title: string;
  message: string | null;
  author: string;
  branch: string | null;
  base_branch: string | null;
  state: string | null;
  url: string | null;
  occurred_at: string;
  additions: number | null;
  deletions: number | null;
  files_changed: number | null;
  task_keys: string[];
  source: string | null;
}

export interface GitHubFeedPageDto {
  connected: boolean;
  repository: string | null;
  repository_url: string | null;
  branch: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  items: GitHubFeedItemDto[];
  total: number;
  page: number;
  size: number;
  branches: string[];
  authors: string[];
}

export interface GitHubFeedQuery {
  type?: "COMMIT" | "PULL_REQUEST" | "";
  branch?: string;
  author?: string;
  q?: string;
  page?: number;
  size?: number;
}

export interface GitHubActivityDto {
  id: string;
  type: "COMMIT" | "PULL_REQUEST" | string;
  author: string;
  title: string;
  message: string | null;
  sha: string | null;
  pr_number: number | null;
  branch: string | null;
  state: string | null;
  task_key: string | null;
  url: string | null;
  occurred_at: string;
  source: string | null;
  match_reason: string | null;
  repository: string;
}

export interface SyncResultDto {
  connected: boolean;
  ok: boolean;
  linked: number;
  problem: string | null;
}

export interface ProgressRowDto {
  project_id: string;
  key: string;
  name: string;
  mode: "INDIVIDUAL" | "STRUCTURED" | string;
  lifecycle: string;
  /** Approved figure only; null = Not reported / Not measurable. */
  percent: number | null;
  label: string;
  method_label: string | null;
  approved_points: number | null;
  total_points: number | null;
  /** Solo: reported, not yet approved (never part of percent). */
  pending_percent: number | null;
  todo: number;
  in_progress: number;
  in_review: number;
  done: number;
  open_blockers: number;
  target_on: string | null;
  updated_at: string;
}

export interface ProgressPageDto {
  items: ProgressRowDto[];
  next_cursor: string | null;
  has_more: boolean;
}

export type ProgressSort = "name" | "progress" | "target" | "updated";

/** Multi-step Create Project: the caller's own draft (never listed as a project until activated). */
export interface DraftViewDto {
  id: string;
  status: "DRAFT" | "ACTIVATED" | "DISCARDED";
  version: number;
  name: string;
  key: string;
  description: string | null;
  mode: DeliveryModeChoice;
  start_on: string;
  target_on: string;
  documents: FileViewDto[];
  phases: SetupPhaseDto[];
  tasks: SetupTaskDto[];
  team_lead_membership_id: string | null;
  developer_membership_ids: string[];
  qa_membership_ids: string[];
  approver_membership_ids: string[];
  repository: {
    connected: boolean; repository: string | null; token_last4: string | null; url: string | null;
    provider?: "GITHUB_APP" | "GITHUB_TOKEN" | string | null; branch?: string | null;
    installation_id?: string | null; account?: string | null;
  };
  can_connect_repository: boolean;
  project_id: string | null;
}

export interface DraftSummaryDto {
  id: string;
  name: string;
  key: string;
  mode: DeliveryModeChoice;
  updated_at: string;
  version: number;
}

export interface DraftBasicsDto {
  name: string;
  key: string;
  description?: string | null;
  mode: DeliveryModeChoice;
  start_on: string;
  target_on: string;
}

/** Where a repository is being chosen: an existing project, or the caller's own Create Project draft. */
export type GitHubTarget = { projectId: string } | { draftId: string };
