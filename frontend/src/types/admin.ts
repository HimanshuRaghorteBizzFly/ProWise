/**
 * Super Admin API shapes. Field names mirror the backend DTO records serialized with the global SNAKE_CASE naming
 * strategy (backend/src/main/resources/application.yml). Every type here is read from a real endpoint; nothing in
 * the UI fills these with sample values.
 */

/* ---------------------------------------------------------------- Platform keys (PlatformKeysDTOs) */

/** One server setting. `value` is always null for a secret; only whether it is configured is reported. */
export interface PlatformKeyItem {
  key: string;
  category: string;
  purpose: string;
  secret: boolean;
  required: boolean;
  configured: boolean;
  value: string | null;
}

export interface PlatformKeysResponse {
  keys: PlatformKeyItem[];
}

/* ---------------------------------------------------------------- Organizations (SuperAdminOrgDTOs) */

export interface AdminOrganization {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  industry: string | null;
  country: string | null;
  timezone: string | null;
  owner_name: string | null;
  owner_email: string | null;
  status: string;
  plan_id: string | null;
  seats_used: number;
  seats_limit: number;
  projects_count: number;
  storage_used_gb: number;
  mrr: number | null;
  created_at: string;
  last_activity_at: string | null;
  suspended_reason: string | null;
  notes: string | null;
}

export interface AdminOrganizationSummary {
  total_orgs: number;
  active_orgs: number;
  trial_orgs: number;
  suspended_orgs: number;
  total_mrr: number | null;
}

export interface AdminOrganizationQuery {
  status?: string;
  planId?: string;
  search?: string;
}

/* ---------------------------------------------------------------- Audit logs (AuditDTOs) */

export interface AdminAuditLog {
  id: string;
  category: string;
  action: string;
  summary: string;
  actor_name: string | null;
  actor_email: string | null;
  target_label: string | null;
  severity: string;
  timestamp: string;
}

/** Query parameters of GET /v1/admin/audit-logs; `fromDate`/`toDate` are ISO-8601 instants. */
export interface AdminAuditLogQuery {
  category?: string;
  severity?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
}

/* ---------------------------------------------------------------- Platform operators (OperatorDTOs) */

export interface AdminOperator {
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
  created_at: string;
}

export interface AdminOperatorPermission {
  module_key: string;
  action: string;
  /** DEPARTMENT_DEFAULT, INDIVIDUAL_GRANT or INDIVIDUAL_DENY. */
  state: string;
  effective_allowed: boolean;
}

export interface AdminOperatorPermissions {
  operator_id: string;
  operator_name: string;
  department: string | null;
  permissions: AdminOperatorPermission[];
  total_allowed_count: number;
  total_denied_count: number;
  total_grants_count: number;
}

export interface AdminOperatorQuery {
  search?: string;
  department?: string;
  roleId?: string;
  status?: string;
}

/** Statuses the backend accepts on PATCH /v1/admin/operators/{id}/status. */
export type AdminOperatorStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "INVITED";

/* ---------------------------------------------------------------- Announcements (AnnouncementDTOs) */

export interface AdminAnnouncement {
  id: string;
  title: string;
  message: string;
  type: string;
  target_audience: string | null;
  target_plans: string[] | null;
  target_org_ids: string[] | null;
  channels: string[] | null;
  status: string;
  scheduled_for: string | null;
  expires_at: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AdminAnnouncementQuery {
  status?: string;
  type?: string;
  search?: string;
}

/* ---------------------------------------------------------------- Email templates (EmailTemplateDTOs) */

export interface AdminEmailTemplate {
  id: string;
  key: string;
  code: string | null;
  name: string;
  category: string | null;
  trigger_description: string | null;
  header_badge: string | null;
  banner_color: string | null;
  sender_brand_name: string | null;
  show_highlight_box: boolean;
  footer_note: string | null;
  open_rate: number | null;
  click_rate: number | null;
  subject: string | null;
  headline: string | null;
  body_paragraphs: string | null;
  cta_label: string | null;
  cta_url: string | null;
  variables: string[] | null;
  status: string;
  updated_at: string | null;
  updated_by: string | null;
}

export interface AdminEmailTemplateQuery {
  category?: string;
  status?: string;
  search?: string;
}

/* ---------------------------------------------------------------- Roles and permissions (SuperAdminRoleDTOs) */

export interface AdminRoleAssignedUser {
  id: string;
  name: string;
  email: string;
  department: string | null;
  avatar_url: string | null;
}

export interface AdminRole {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Record component `isSystem`; older Jackson versions emit it as `system`. */
  is_system?: boolean;
  system?: boolean;
  scope: string | null;
  color: string | null;
  icon: string | null;
  permissions: string[];
  user_count: number;
  assigned_users: AdminRoleAssignedUser[] | null;
  hierarchy_rank: number | null;
  hierarchy_tier: string | null;
  hierarchy_title: string | null;
  is_active?: boolean;
  active?: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminPermission {
  key: string;
  module_id: string;
  action_id: string;
  label: string;
  description: string | null;
  risk_level: string | null;
  is_sensitive?: boolean;
  sensitive?: boolean;
  is_platform_only?: boolean;
  platform_only?: boolean;
}

/* ---------------------------------------------------------------- Billing (dormant): plans, subscriptions, invoices */

export interface AdminPlanLimits {
  max_seats: number;
  max_projects: number;
  max_workspaces: number;
  storage_gb: number;
  api_rate_limit_per_min: number;
}

export interface AdminPlan {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  monthly_price: number | null;
  annual_price: number | null;
  currency: string | null;
  status: string;
  is_popular?: boolean;
  popular?: boolean;
  badge_label: string | null;
  brand_color: string | null;
  ai_token_quota: string | null;
  trial_days: number;
  limits: AdminPlanLimits | null;
  features: string[] | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminSubscription {
  id: string;
  org_id: string;
  plan_id: string;
  billing_cycle: string;
  status: string;
  seats: number;
  amount: number | null;
  currency: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  auto_renew: boolean;
  cancel_at_period_end: boolean;
  payment_method_label: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminSubscriptionQuery {
  planId?: string;
  status?: string;
}

export interface AdminInvoiceLineItem {
  id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  total: number | null;
}

export interface AdminInvoice {
  id: string;
  invoice_number: string;
  org_id: string;
  subscription_id: string | null;
  payment_id: string | null;
  issue_date: string | null;
  due_date: string | null;
  status: string;
  subtotal: number | null;
  tax_rate: number | null;
  tax_amount: number | null;
  total: number | null;
  line_items: AdminInvoiceLineItem[] | null;
  notes: string | null;
  paid_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminInvoiceSummary {
  total_invoices: number;
  total_billed: number | null;
  total_paid: number | null;
  total_outstanding: number | null;
  overdue_count: number;
}

export interface AdminInvoiceQuery {
  orgId?: string;
  status?: string;
  search?: string;
}

/** GET /v1/admin/dashboard: live counts only. Revenue comes from ACTIVE subscriptions; no history or trends. */
export interface AdminDashboard {
  total_organizations: number;
  active_organizations: number;
  trial_organizations: number;
  suspended_organizations: number;
  total_mrr: number;
  total_arr: number;
  active_subscriptions: number;
  total_seats_allocated: number;
  active_operators: number;
  plan_distribution: { plan_name: string; count: number; percentage: number }[];
  recent_activity: AdminAuditLog[];
}
