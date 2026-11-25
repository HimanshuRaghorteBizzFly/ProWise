/**
 * Wire types (snake_case JSON) for the Super Admin platform modules: audit, announcements, email templates,
 * feature flags, licenses, policies, branding and the reports overview. They mirror the backend DTOs in
 * backend/src/main/java/com/prowise/superadmin/*. `version` is the record's optimistic-lock version; every update,
 * state change and delete sends it back as `expected_version` (body) or `?expectedVersion=` (DELETE).
 */

export type { AdminAuditLog as PlatformAuditLog, AdminAuditLogQuery as PlatformAuditLogQuery } from "./admin";

/** A record id with the version the client last read (bulk operations). */
export interface VersionedRef {
  id: string;
  version: number;
}

/* ---------------------------------------------------------------- announcements (AnnouncementDTOs) */

export type AnnouncementType = "INFO" | "RELEASE" | "MAINTENANCE" | "CRITICAL";
export type AnnouncementAudience = "ALL_ORGS" | "BY_PLAN" | "SPECIFIC_ORGS" | "OPERATORS_ONLY";
export type AnnouncementStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type AnnouncementChannel = "IN_APP_BANNER" | "EMAIL_BROADCAST";

export interface PlatformAnnouncement {
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
  version: number;
  /**
   * Review fields of operator-submitted drafts (DraftDTOs.AnnouncementDraft). The admin list may omit them; a
   * PENDING_REVIEW status alone marks an operator draft awaiting review.
   */
  author_type?: string | null;
  author_id?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  reviewer_note?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

/** Statuses of the operator review workflow (operator drafts share the announcements table). */
export type AnnouncementReviewStatus = "PENDING_REVIEW" | "CHANGES_REQUESTED";

export interface AnnouncementInput {
  title: string;
  message: string;
  type: string;
  target_audience: string;
  target_plans: string[];
  target_org_ids: string[];
  channels: string[];
  status: string;
  /** ISO-8601 instants (UTC). */
  scheduled_for: string | null;
  expires_at: string | null;
}

/* ---------------------------------------------------------------- email templates (EmailTemplateDTOs) */

export interface PlatformEmailTemplate {
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
  subject: string | null;
  headline: string | null;
  body_paragraphs: string | null;
  cta_label: string | null;
  cta_url: string | null;
  variables: string[] | null;
  status: string;
  updated_at: string | null;
  updated_by: string | null;
  version: number;
}

/** Body of PUT /v1/admin/email-templates/{id} (key and code are fixed after creation). */
export interface EmailTemplateUpdateInput {
  name: string;
  category: string;
  trigger_description: string | null;
  header_badge: string | null;
  banner_color: string | null;
  sender_brand_name: string | null;
  show_highlight_box: boolean;
  footer_note: string | null;
  subject: string;
  headline: string;
  body_paragraphs: string;
  cta_label: string | null;
  cta_url: string | null;
  variables: string[];
  status: string;
}

export interface EmailTemplateCreateInput extends EmailTemplateUpdateInput {
  key: string;
  code: string | null;
}

/* ---------------------------------------------------------------- operator email drafts (DraftDTOs.EmailDraft) */

export type OperatorEmailDraftStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

/** An operator-authored email template draft, reviewed by a Super Admin (GET /v1/admin/email-drafts). Nothing is sent. */
export interface AdminEmailDraft {
  id: string;
  name: string;
  category: string | null;
  subject: string;
  headline: string | null;
  body_text: string;
  body_html: string | null;
  cta_label: string | null;
  audience_description: string | null;
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

/** Server pagination of the console lists: `page` is 0-based, `size` 1..100 (default 25). */
export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface AdminEmailDraftQuery {
  status?: string;
  search?: string;
  page?: number;
  size?: number;
}

/* ---------------------------------------------------------------- feature flags (FeatureFlagDTOs) */

export interface PlatformFeatureFlag {
  id: string;
  flag_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  audience: string | null;
  created_at: string | null;
  updated_at: string | null;
  version: number;
}

export interface FeatureFlagCreateInput {
  flag_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  audience: string;
}

export interface FeatureFlagUpdateInput {
  label: string;
  description: string | null;
  audience: string;
}

/* ---------------------------------------------------------------- licenses (LicenseDTOs) */

export interface PlatformLicense {
  id: string;
  license_key: string;
  org_id: string | null;
  plan_id: string | null;
  status: string;
  max_seats: number;
  issued_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
  version: number;
}

export interface LicenseGenerateInput {
  org_id: string | null;
  plan_id: string | null;
  max_seats: number;
  validity_days: number | null;
}

/* ---------------------------------------------------------------- policies and branding (PolicyDTOs) */

export interface PlatformPolicies {
  checkin_grace_working_days: number;
  stale_webhook_minutes: number;
  audit_retention_days: number;
  enforce_mfa_for_operators: boolean;
  auto_suspend_after_past_due_days: number;
  default_trial_days: number;
  max_attachment_mb: number;
  maintenance_banner_mode: boolean;
  feature_flags: PlatformFeatureFlag[];
  updated_at: string | null;
  version: number;
}

export type PoliciesInput = Omit<PlatformPolicies, "feature_flags" | "updated_at" | "version">;

export interface PlatformBranding {
  platform_name: string;
  support_email: string;
  status_page_url: string | null;
  default_timezone: string | null;
  default_language: string | null;
  date_format: string | null;
  currency_display: string | null;
  compact_density: boolean;
  updated_at: string | null;
  version: number;
}

export type BrandingInput = Omit<PlatformBranding, "updated_at" | "version">;

/* ---------------------------------------------------------------- reports overview */

export interface MonthCount {
  /** yyyy-MM */
  month: string;
  count: number;
}

export interface DayCount {
  /** yyyy-MM-dd */
  date: string;
  count: number;
}

export interface ReportsOverview {
  range: { from: string; to: string };
  organizations: {
    total: number;
    active: number;
    trial: number;
    suspended: number;
    created_by_month: MonthCount[];
  };
  users: {
    total: number;
    active: number;
    pending: number;
    disabled: number;
    created_by_month: MonthCount[];
  };
  subscriptions: {
    by_status: { status: string; count: number }[];
    by_plan: { plan_id: string; plan_name: string; count: number }[];
    mrr: number;
    arr: number;
  };
  invoices: {
    by_status: { status: string; count: number; total: number }[];
    billed_total: number;
    paid_total: number;
    outstanding_total: number;
  };
  payments: {
    succeeded_total: number;
    refunded_total: number;
    failed_count: number;
  };
  audit: {
    by_category: { category: string; count: number }[];
    by_day: DayCount[];
  };
  logins: {
    by_day: { date: string; succeeded: number; failed: number }[];
  };
}
