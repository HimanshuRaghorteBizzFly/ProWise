/**
 * Phase 3 structured-work wire types (snake_case, as the backend serializes them).
 * Sources: com.prowise.work.{WorkItemService, WorkflowService, DependencyService, BlockerService, ScopeService,
 * StructuredSnapshotService}.
 */

export type WorkItemState = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "CANCELLED";
export type WorkItemType = "MILESTONE" | "DELIVERABLE" | "TASK" | "SUBTASK";
export type PlanStatus = "DRAFT" | "ACTIVE" | "RETIRED";

export interface PersonSummaryDto {
  user_id: string;
  email: string | null;
}

export interface WorkItemDto {
  id: string;
  project_id: string;
  parent_id: string | null;
  type: WorkItemType | string;
  key: string;
  title: string;
  description: string | null;
  state: WorkItemState | string;
  plan_status: PlanStatus | string;
  blocked: boolean;
  criticality: string | null;
  criteria: string | null;
  criteria_version: number;
  weight: number | null;
  weight_unit: string | null;
  due_on: string | null;
  revision: number;
  submitted_revision: number | null;
  accepted_revision: number | null;
  review_required: boolean;
  primary_assignee: PersonSummaryDto | null;
  reviewer: PersonSummaryDto | null;
  collaborators: PersonSummaryDto[];
  depth: number;
  child_count: number;
  dependency_flag: string | null;
  retired_reason: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface EvidenceItemDto {
  type: "LINK" | "COMMIT" | "PULL_REQUEST" | "FILE" | "NOTE" | string;
  ref: string;
  label?: string | null;
}

export interface SubmissionViewDto {
  id: string;
  revision: number;
  criteria_version: number;
  evidence: EvidenceItemDto[] | null;
  note: string | null;
  status: string;
  submitted_at: string;
  submitted_by: string;
  submitted_by_email: string | null;
}

export interface ReviewViewDto {
  id: string;
  decision: "ACCEPTED" | "CHANGES_REQUESTED" | string;
  reason: string | null;
  evidence_ref: string | null;
  revision: number;
  decided_at: string;
  reviewer_id: string;
  reviewer_email: string | null;
}

export interface CheckViewDto {
  key: string;
  label: string;
  satisfied: boolean;
  satisfied_at: string | null;
}

export interface ReopenViewDto {
  reason: string;
  superseded_revision: number | null;
  occurred_at: string;
  actor_id: string;
  actor_email: string | null;
}

export interface ReviewHistoryDto {
  submissions: SubmissionViewDto[];
  reviews: ReviewViewDto[];
  checks: CheckViewDto[];
  reopen_events: ReopenViewDto[];
}

export interface FeedbackViewDto {
  id: string;
  work_item_id: string;
  key: string;
  title: string;
  project_id: string;
  state: string;
  decision: string;
  reason: string | null;
  revision: number;
  decided_at: string;
  reviewer_email: string | null;
}

export interface DependencyLinkDto {
  id: string;
  predecessor_id: string;
  predecessor_key: string;
  predecessor_title: string;
  predecessor_state: string;
  successor_id: string;
  successor_key: string;
  successor_title: string;
  successor_state: string;
  created_at: string;
}

export interface AffectedDto {
  work_item_id: string;
  key: string;
  title: string;
  state: string;
  distance: number;
}

export interface DependencyViewDto {
  blocked_by: DependencyLinkDto[];
  blocks: DependencyLinkDto[];
  affected: AffectedDto[];
}

export interface WorkBlockerDto {
  id: string;
  work_item_id: string;
  work_item_key: string;
  work_item_title: string;
  reason: string;
  severity: "NORMAL" | "CRITICAL" | string;
  owner: PersonSummaryDto | null;
  opened_by: string | null;
  resolved: boolean;
  resolution: string | null;
  opened_at: string;
  resolved_at: string | null;
  age_hours: number;
}

export interface LeafRowDto {
  work_item_id: string;
  key: string;
  title: string;
  weight: number | null;
  cancelled: boolean;
  state: string;
  accepted: boolean;
  suspended: boolean;
}

export interface ProgressSnapshotDto {
  id: string;
  taken_at: string;
  method: string;
  numerator: number | null;
  denominator: number | null;
  percent: number | null;
  missing_label: string | null;
  baseline_id: string | null;
  baseline_version: number | null;
  accepted_leaves: number;
  total_leaves: number;
  cause: string | null;
  transition_marker: boolean;
}

export interface StructuredProgressDto {
  project_id: string;
  mode: string;
  method: string;
  numerator: number | null;
  denominator: number | null;
  percent: number | null;
  label: string;
  explanation: string | null;
  accepted_leaves: number;
  total_leaves: number;
  baseline: { id: string; version_no: number; unit: string; approved_at: string } | null;
  leaves: LeafRowDto[];
  snapshots: ProgressSnapshotDto[];
}

export interface ScopeVersionSummaryDto {
  id: string;
  version_no: number | null;
  unit: string;
  status: string;
  reason: string | null;
  author_email: string | null;
  approver_email: string | null;
  leaf_count: number;
  total: number | null;
  base_version_id: string | null;
  created_at: string;
  approved_at: string | null;
}
