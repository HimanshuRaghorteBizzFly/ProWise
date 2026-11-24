/**
 * Wire types for the platform operations endpoints the Super Admin console reads (snake_case, as the backend's
 * global SNAKE_CASE naming strategy writes them). Mirrors OperatorDTOs records, OutboxOperationsController.FailedEvent
 * and the admin security / integration-settings endpoints.
 *
 * `version` is the record's optimistic-lock version. Writes send it back as `expected_version`; a stale value is
 * refused with 409 STALE_VERSION.
 */

export type IncidentSeverity = "SEV_1" | "SEV_2" | "SEV_3" | "SEV_4";
export type IncidentStatus = "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";
export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED";
export type AccessRequestStatus = "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "EXPIRED" | "REVOKED";
export type MaintenanceStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface OpsIncident {
  id: string;
  title: string;
  severity: IncidentSeverity | string;
  status: IncidentStatus | string;
  department_id: string | null;
  department_name: string | null;
  assigned_operator_id: string | null;
  assigned_operator_name: string | null;
  description: string | null;
  root_cause: string | null;
  mitigation_steps: string | null;
  resolved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  version?: number | null;
}

export interface CreateIncidentBody {
  title: string;
  severity: IncidentSeverity;
  department_id?: string;
  assigned_operator_id?: string;
  description?: string;
}

export interface UpdateIncidentBody {
  title?: string;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  department_id?: string;
  description?: string;
  root_cause?: string;
  mitigation_steps?: string;
}

export interface IncidentAssignment {
  id: string;
  incident_id: string;
  assigned_by: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  notes: string | null;
  created_at: string | null;
}

export interface OpsSupportTicket {
  id: string;
  subject: string;
  customer_name: string | null;
  customer_email: string | null;
  department_id: string | null;
  department_name: string | null;
  assigned_operator_id: string | null;
  assigned_operator_name: string | null;
  priority: TicketPriority | string;
  status: TicketStatus | string;
  description: string | null;
  created_at: string | null;
  updated_at: string | null;
  version?: number | null;
}

export interface UpdateTicketBody {
  priority?: TicketPriority;
  status?: TicketStatus;
}

export interface OpsAccessRequest {
  id: string;
  ticket_id: string | null;
  requester_email: string | null;
  org_id: string | null;
  reason: string | null;
  status: AccessRequestStatus | string;
  approved_by: string | null;
  approved_at: string | null;
  expires_at: string | null;
  created_at: string | null;
  version?: number | null;
}

export interface OpsIntegration {
  id: string;
  name: string;
  type: string;
  status: string;
  health: string;
  last_synced_at: string | null;
  error_count: number;
  created_at: string | null;
  updated_at: string | null;
  /** Returned by the server but never rendered: it may carry provider configuration. */
  config_json?: string | null;
}

export interface OpsGitHubRepository {
  id: string;
  repo_full_name: string;
  installation_id: string | null;
  default_branch: string | null;
  webhook_active: boolean;
  last_event_at: string | null;
  created_at: string | null;
}

export interface OpsWebhookReceipt {
  id: string;
  webhook_id: string | null;
  source: string;
  event_type: string;
  status: string;
  attempts: number;
  error_message: string | null;
  /** Returned by the server but never rendered: payloads can carry private data. */
  payload?: string | null;
  received_at: string | null;
  last_retry_at: string | null;
}

export interface OpsBackgroundJob {
  id: string;
  job_name: string;
  queue_name: string;
  status: string;
  attempts: number;
  max_attempts: number;
  error_details: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string | null;
}

export interface OpsMaintenanceWindow {
  id: string;
  title: string;
  description: string | null;
  department_id: string | null;
  status: MaintenanceStatus | string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  version?: number | null;
}

export interface CreateMaintenanceBody {
  title: string;
  description?: string;
  department_id?: string;
  scheduled_start: string;
  scheduled_end: string;
}

export interface UpdateMaintenanceBody {
  title?: string;
  description?: string;
  status?: MaintenanceStatus;
  scheduled_start?: string;
  scheduled_end?: string;
}

export interface OpsAlert {
  id: string;
  severity: string;
  title: string;
  message: string | null;
  source_module: string | null;
  department_id: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  created_at: string | null;
}

export interface OpsFailedOutboxEvent {
  event_id: string;
  organization_id: string | null;
  aggregate_type: string;
  event_type: string;
  attempts: number;
  last_error: string | null;
  failed_at: string | null;
}

export interface OpsOperator {
  id: string;
  name: string;
  email: string;
  access_level: string | null;
  department: string | null;
  status: string;
}

/**
 * The operator dashboard counters. The server writes these keys in camelCase (a Map, not a record). Only the counts
 * are used; the server's "health score" string is not a measured figure and is never shown.
 */
export interface OpsDashboardStats {
  openIncidents?: number;
  openTickets?: number;
  pendingWebhooks?: number;
  failedJobs?: number;
  unacknowledgedAlerts?: number;
  pendingAccessRequests?: number;
  failedOutboxEvents?: number;
  failedEmailDeliveries24h?: number;
  activeMaintenanceWindows?: number;
  organizationsByState?: Record<string, number>;
  /** Not measured by the server: always null today ("Not available yet"). */
  systemHealthScore?: number | null;
  /** Not measured by the server: always null today ("Not available yet"). */
  operationalStatus?: string | null;
}

export interface SecurityFailedLogin {
  email_masked: string;
  ip_address: string | null;
  at: string;
  reason: string | null;
}

export interface SecurityOverview {
  failed_logins_24h: number;
  failed_logins_7d: number;
  locked_accounts: number;
  users_must_change_password: number;
  active_user_sessions: number;
  active_operator_sessions: number;
  super_admin_count: number;
  operators_locked: number;
  recent_failed_logins: SecurityFailedLogin[];
  published_seed_credential_accounts?: number | null;
}

export interface IntegrationSettings {
  github_app_slug: string | null;
  github_client_id: string | null;
  webhook_max_retries: number;
  webhook_timeout_seconds: number;
  webhook_signature_required: boolean;
  allowed_event_types: string[];
  updated_at: string | null;
  updated_by: string | null;
  version: number;
}

/** Editable fields only. There are deliberately no secret fields: secrets live in the server environment. */
export interface UpdateIntegrationSettingsBody {
  github_app_slug: string | null;
  github_client_id: string | null;
  webhook_max_retries: number;
  webhook_timeout_seconds: number;
  webhook_signature_required: boolean;
  allowed_event_types: string[];
  expected_version: number;
}
