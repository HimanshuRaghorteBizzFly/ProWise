/**
 * Wire types for the Platform Operator console endpoints that `src/types/admin-operations.ts` does not already cover
 * (snake_case, as the backend's global SNAKE_CASE naming strategy writes them). Mirrors OperatorDTOs records.
 *
 * Incidents, tickets, access requests, maintenance, integrations, GitHub repositories, webhooks, jobs, alerts and
 * failed outbox events reuse the `Ops*` types from admin-operations.ts: both consoles read the same endpoints.
 */

export type {
  OpsAccessRequest,
  OpsAlert,
  OpsBackgroundJob,
  OpsDashboardStats,
  OpsFailedOutboxEvent,
  OpsGitHubRepository,
  OpsIncident,
  OpsIntegration,
  OpsMaintenanceWindow,
  OpsOperator,
  OpsSupportTicket,
  OpsWebhookReceipt,
  IncidentAssignment,
} from "@/types/admin-operations";

/** OperatorDTOs.OperatorResponse: the signed-in operator (GET /v1/operator/me) and rows of GET /v1/operators. */
export interface OperatorProfile {
  id: string;
  name: string;
  email: string;
  role_id: string | null;
  access_level: string | null;
  department: string | null;
  status: string;
  mfa_enabled: boolean;
  on_call: boolean;
  shift_name: string | null;
  active_sessions_count: number;
  total_permissions_count: number;
  last_active_at: string | null;
  created_at: string | null;
  version?: number | null;
}

/** OperatorDTOs.PermissionItem */
export interface OperatorPermissionItem {
  module_key: string;
  action: string;
  state: string;
  effective_allowed: boolean;
}

/** OperatorDTOs.EffectivePermissionsResponse (GET /v1/operator/me/permissions) */
export interface OperatorEffectivePermissions {
  operator_id: string;
  operator_name: string;
  department: string | null;
  permissions: OperatorPermissionItem[];
  total_allowed_count: number;
  total_denied_count: number;
  total_grants_count: number;
}

/** OperatorDTOs.OperatorNavigationResponse (GET /v1/operator/navigation) */
export interface OperatorNavigation {
  operator_id: string;
  department: string | null;
  sections: { title: string; items: { id: string; label: string; href: string; icon: string; authorized: boolean }[] }[];
}

/**
 * OperatorDTOs.OperatorDashboardResponse (GET /v1/operator/dashboard). Only `department`, `department_name` and
 * `authorized_modules` are real: the `kpis` and `department_data` values are fixed strings on the server today, so the
 * console never renders them as figures.
 */
export interface OperatorDashboardSummary {
  department: string;
  department_name: string;
  kpis: { label: string; value: string; change: string; tone: string }[];
  authorized_modules: string[];
  department_data: Record<string, unknown>;
}

/** OperatorDTOs.DepartmentResponse (GET /v1/departments) */
export interface OperatorDepartmentItem {
  id: string;
  name: string;
  description: string | null;
  default_permissions_count: number;
}

/** OperatorDTOs.OperatorWorkloadResponse (GET /v1/operator/team/workload) */
export interface OperatorWorkload {
  operator_id: string;
  operator_name: string;
  department_id: string | null;
  access_level: string | null;
  on_call: boolean;
  shift_name: string | null;
  open_incidents_count: number;
  open_tickets_count: number;
  last_active_at: string | null;
}

/** OperatorDTOs.EmailDeliveryLogResponse (GET /v1/operator/email/delivery) */
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
  created_at: string | null;
}

/** OperatorAuthDTOs.MessageResponse */
export interface OperatorMessage {
  message: string;
}

/* ------------------------------------------------------------------ operator console (ConsoleDTOs / DraftDTOs / BackupDTOs) */

/** ConsoleDTOs.Page: server pagination, `page` is 0-based, `size` 1..100 (default 25). */
export interface OperatorPage<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/** Paging params every console list accepts (0-based page). */
export interface OperatorPaging {
  page?: number;
  size?: number;
}

/** ConsoleDTOs.ActivityLogItem (GET /v1/operator/activity-logs) */
export interface OperatorActivityLogItem {
  id: string;
  /** ACTIVITY (operator_activity_logs) or AUDIT (operator_audit_logs) */
  source: string;
  operator_id: string | null;
  operator_name: string | null;
  department_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  module_key: string | null;
  details: string | null;
  ip_address: string | null;
  occurred_at: string;
}

export interface OperatorActivityLogFilters extends OperatorPaging {
  operator?: string;
  action?: string;
  source?: string;
  from?: string;
  to?: string;
  search?: string;
}

/** ConsoleDTOs.OrganizationItem (GET /v1/operator/organizations) */
export interface OperatorOrganizationItem {
  id: string;
  name: string;
  slug: string;
  state: string;
  created_at: string | null;
  member_count: number;
  project_count: number;
  owner_email: string | null;
  subscription_id: string | null;
  subscription_status: string | null;
  plan_id: string | null;
  plan_name: string | null;
}

export interface OperatorOrganizationSubscription {
  id: string;
  plan_id: string | null;
  plan_name: string | null;
  status: string;
  billing_cycle: string | null;
  seats: number;
  current_period_end: string | null;
  created_at: string | null;
}

/** ConsoleDTOs.OrganizationDetail (GET /v1/operator/organizations/{id}); read-only for operators. */
export interface OperatorOrganizationDetail {
  id: string;
  name: string;
  slug: string;
  state: string;
  timezone: string | null;
  suspended_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  owner_email: string | null;
  member_count: number;
  disabled_member_count: number;
  project_count: number;
  projects_by_lifecycle: Record<string, number>;
  subscriptions: OperatorOrganizationSubscription[];
  failed_payment_count: number;
  open_invoice_count: number;
}

/** ConsoleDTOs.SubscriptionItem (GET /v1/operator/subscriptions) */
export interface OperatorSubscriptionItem {
  id: string;
  org_id: string;
  org_name: string | null;
  org_slug: string | null;
  plan_id: string | null;
  plan_code: string | null;
  plan_name: string | null;
  billing_cycle: string | null;
  status: string;
  seats: number;
  seats_used: number;
  amount: number | null;
  currency: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  auto_renew: boolean;
  cancel_at_period_end: boolean;
  created_at: string | null;
}

/** ConsoleDTOs.PaymentFailureItem (GET /v1/operator/payments/failures); billing is dormant, nothing is retried. */
export interface OperatorPaymentFailureItem {
  id: string;
  transaction_ref: string | null;
  org_id: string | null;
  org_name: string | null;
  subscription_id: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_status: string | null;
  amount: number | null;
  currency: string | null;
  method: string | null;
  method_last4: string | null;
  gateway_label: string | null;
  description: string | null;
  failure_reason: string | null;
  failed_at: string | null;
  updated_at: string | null;
}

/** ConsoleDTOs.InvoiceDeliveryItem (GET /v1/operator/invoices/delivery); nothing is sent from the console. */
export interface OperatorInvoiceDeliveryItem {
  invoice_id: string;
  invoice_number: string | null;
  org_id: string | null;
  org_name: string | null;
  invoice_status: string | null;
  total: number | null;
  /** Local date (YYYY-MM-DD). */
  issue_date: string | null;
  due_date: string | null;
  /** NOT_SENT, SMTP_ACCEPTED, FAILED, ... */
  delivery_status: string;
  recipient_email: string | null;
  delivery_attempts: number;
  last_attempt_at: string | null;
  last_sent_at: string | null;
  last_error_code: string | null;
}

/** ConsoleDTOs.ApiErrorItem (GET /v1/operator/api-errors) */
export interface OperatorApiErrorItem {
  id: string;
  occurred_at: string;
  request_id: string | null;
  method: string;
  path: string;
  status: number;
  error_code: string | null;
  actor_type: string | null;
  actor_id: string | null;
  org_id: string | null;
}

export interface OperatorApiErrorFilters extends OperatorPaging {
  status_class?: string;
  status?: number | string;
  path?: string;
  code?: string;
  from?: string;
  to?: string;
}

/** ConsoleDTOs.ApiErrorSummary (GET /v1/operator/api-errors/summary; default window = last 24h) */
export interface OperatorApiErrorSummary {
  from: string;
  to: string;
  total: number;
  client_errors: number;
  server_errors: number;
  by_status: { status: number; count: number }[];
  by_path: { method: string; path: string; count: number; server_errors: number }[];
  by_code: { error_code: string | null; count: number }[];
}

/** DraftDTOs.AnnouncementDraft */
export interface OperatorAnnouncementDraft {
  id: string;
  title: string;
  message: string;
  type: string | null;
  target_audience: string | null;
  target_plans: string[] | null;
  target_org_ids: string[] | null;
  channels: string[] | null;
  /** DRAFT, PENDING_REVIEW, CHANGES_REQUESTED, PUBLISHED, ARCHIVED */
  status: string;
  scheduled_for: string | null;
  expires_at: string | null;
  published_at: string | null;
  author_type: string | null;
  author_id: string | null;
  created_by: string | null;
  submitted_at: string | null;
  submitted_by: string | null;
  reviewer_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  version: number;
}

/** DraftDTOs.AnnouncementDraftRequest (expected_version is added by the client on PUT). */
export interface OperatorAnnouncementDraftInput {
  title: string;
  message: string;
  type?: string | null;
  target_audience?: string | null;
  target_plans?: string[];
  target_org_ids?: string[];
  channels?: string[];
  scheduled_for?: string | null;
  expires_at?: string | null;
}

/** DraftDTOs.EmailDraft */
export interface OperatorEmailDraft {
  id: string;
  name: string;
  category: string | null;
  subject: string;
  headline: string | null;
  body_text: string;
  body_html: string | null;
  cta_label: string | null;
  audience_description: string | null;
  /** DRAFT, SUBMITTED, APPROVED, REJECTED */
  status: string;
  author_type: string | null;
  created_by: string | null;
  created_by_email: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_note: string | null;
  created_at: string | null;
  updated_at: string | null;
  version: number;
}

/** DraftDTOs.EmailDraftRequest (expected_version is added by the client on PUT). */
export interface OperatorEmailDraftInput {
  name: string;
  subject: string;
  body_text: string;
  category?: string | null;
  headline?: string | null;
  body_html?: string | null;
  cta_label?: string | null;
  audience_description?: string | null;
}

export interface OperatorDraftFilters extends OperatorPaging {
  status?: string;
  search?: string;
}

/** BackupDTOs.BackupRun */
export interface OperatorBackupRun {
  id: string;
  /** RUNNING, SUCCEEDED, FAILED, NOT_CONFIGURED */
  status: string;
  started_at: string | null;
  finished_at: string | null;
  size_bytes: number | null;
  file_name: string | null;
  triggered_by: string | null;
  error_message: string | null;
}

/** BackupDTOs.BackupList (GET /v1/operator/backups) */
export interface OperatorBackupList extends OperatorPage<OperatorBackupRun> {
  /** PROWISE_BACKUP_DIR is set and pg_dump was found. */
  configured: boolean;
  running: boolean;
}
