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
