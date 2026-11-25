/**
 * Super Admin commercial and access-control API shapes (organizations, plans, subscriptions, payments, invoices,
 * roles, platform operators). Field names mirror the backend DTO records serialized with the global SNAKE_CASE
 * naming strategy. Every record carries `version` (JPA @Version): the client sends it back as `expected_version`
 * on updates and state changes (and as `?expectedVersion=` on DELETE); a stale value is refused with
 * 409 STALE_VERSION. Creates send no version.
 */
import type {
  AdminInvoice,
  AdminInvoiceSummary,
  AdminOperator,
  AdminOrganization,
  AdminOrganizationSummary,
  AdminPlan,
  AdminPlanLimits,
  AdminSubscription,
} from "./admin";
import type { CapabilityCatalog, CloneRoleBody, CreateRoleBody, GovernanceRole, UpdateRoleBody } from "./admin-roles";

/** Every record read from these endpoints carries its optimistic-locking version. */
export interface Versioned {
  version: number;
}

/* ---------------------------------------------------------------- Organizations (SuperAdminOrgDTOs) */

export type CommercialOrganization = AdminOrganization & Versioned;
export type CommercialOrganizationSummary = AdminOrganizationSummary;

/** CreateOrgRequest: name, slug, owner_name, owner_email (valid email) are required. */
export interface CreateOrganizationBody {
  name: string;
  slug: string;
  domain?: string | null;
  industry?: string | null;
  country?: string | null;
  timezone?: string | null;
  owner_name: string;
  owner_email: string;
  plan_id?: string | null;
  seats_limit?: number | null;
  notes?: string | null;
}

/** UpdateOrgRequest: every field optional (null keeps the stored value). */
export interface UpdateOrganizationBody {
  name?: string | null;
  domain?: string | null;
  industry?: string | null;
  country?: string | null;
  timezone?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  plan_id?: string | null;
  seats_limit?: number | null;
  notes?: string | null;
}

/* ---------------------------------------------------------------- Plans (PlanDTOs) */

export type CommercialPlan = AdminPlan & Versioned;
export type PlanLimits = AdminPlanLimits;

export interface CreatePlanBody {
  code?: string | null;
  name: string;
  tagline?: string | null;
  monthly_price?: number | null;
  annual_price?: number | null;
  currency?: string | null;
  status?: string | null;
  is_popular?: boolean | null;
  badge_label?: string | null;
  brand_color?: string | null;
  ai_token_quota?: string | null;
  trial_days?: number | null;
  limits?: PlanLimits | null;
  features?: string[] | null;
}

/** UpdatePlanRequest: the code is immutable once created. */
export type UpdatePlanBody = Omit<CreatePlanBody, "code" | "currency" | "name"> & { name?: string | null };

/* ---------------------------------------------------------------- Subscriptions (SubscriptionDTOs) */

export type CommercialSubscription = AdminSubscription & Versioned;

export interface AssignSubscriptionBody {
  org_id: string;
  plan_id: string;
  billing_cycle?: string | null;
  seats?: number | null;
  auto_renew?: boolean | null;
  payment_method_label?: string | null;
}

export interface UpdateSubscriptionBody {
  plan_id?: string | null;
  billing_cycle?: string | null;
  status?: string | null;
  seats?: number | null;
  amount?: number | null;
  current_period_start?: string | null;
  current_period_end?: string | null;
  auto_renew?: boolean | null;
  cancel_at_period_end?: boolean | null;
  payment_method_label?: string | null;
}

/* ---------------------------------------------------------------- Payments (BillingDTOs) */

export interface CommercialPayment extends Versioned {
  id: string;
  transaction_ref: string;
  org_id: string;
  subscription_id: string | null;
  invoice_id: string | null;
  amount: number;
  refunded_amount: number | null;
  currency: string | null;
  status: string;
  method: string | null;
  method_last4: string | null;
  gateway_label: string | null;
  description: string | null;
  failure_reason: string | null;
  refund_reason: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaymentSummary {
  total_transactions: number;
  total_volume: number | null;
  refunded_volume: number | null;
  successful_count: number;
  failed_count: number;
}

export interface PaymentQuery {
  orgId?: string;
  status?: string;
  search?: string;
}

/** RecordPaymentRequest: org_id, amount (>= 0.01) and description are required. */
export interface RecordPaymentBody {
  org_id: string;
  subscription_id?: string | null;
  invoice_id?: string | null;
  amount: number;
  currency?: string | null;
  method?: string | null;
  method_last4?: string | null;
  gateway_label?: string | null;
  description: string;
}

export interface UpdatePaymentBody {
  org_id?: string | null;
  amount?: number | null;
  status?: string | null;
  method?: string | null;
  method_last4?: string | null;
  gateway_label?: string | null;
  description?: string | null;
  failure_reason?: string | null;
}

/** RefundPaymentRequest: amount (>= 0.01) and reason are required. */
export interface RefundPaymentBody {
  amount: number;
  reason: string;
}

/* ---------------------------------------------------------------- Invoices (InvoiceDTOs) */

export type CommercialInvoice = AdminInvoice & Versioned;
export type CommercialInvoiceSummary = AdminInvoiceSummary;

/** LineItemDTO: description required, quantity required, unit_price >= 0. */
export interface InvoiceLineItemBody {
  id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
}

/** CreateInvoiceRequest: org_id and at least one line item are required. Dates are date-only (YYYY-MM-DD). */
export interface CreateInvoiceBody {
  org_id: string;
  subscription_id?: string | null;
  issue_date?: string | null;
  due_date?: string | null;
  tax_rate?: number | null;
  notes?: string | null;
  line_items: InvoiceLineItemBody[];
}

export interface UpdateInvoiceBody {
  issue_date?: string | null;
  due_date?: string | null;
  status?: string | null;
  tax_rate?: number | null;
  notes?: string | null;
  line_items?: InvoiceLineItemBody[] | null;
}

/* ---------------------------------------------------------------- Roles (SuperAdminRoleDTOs) */

/** Roles & Permissions Governance (task 1.5): the persisted role model, see `./admin-roles`. */
export type CommercialRole = GovernanceRole;
export type CommercialPermission = CapabilityCatalog;
export type { CreateRoleBody, UpdateRoleBody, CloneRoleBody };

/* ---------------------------------------------------------------- Platform operators (OperatorDTOs) */

export type CommercialOperator = AdminOperator & Versioned;

export interface OperatorDepartment {
  id: string;
  name: string;
  description: string | null;
  default_permissions_count: number;
}

export interface OperatorRoleOption {
  id: string;
  name: string;
  description: string | null;
}

export type OperatorAccessLevel = "MAIN_PLATFORM_OPERATOR" | "DEPARTMENT_OPERATOR";

/** CreateOperatorRequest: a valid email is required; a department operator needs a department. */
export interface CreateOperatorBody {
  name: string;
  email: string;
  role_id?: string | null;
  access_level?: OperatorAccessLevel | null;
  department?: string | null;
  mfa_enabled?: boolean | null;
  on_call?: boolean | null;
  shift_name?: string | null;
}

export interface UpdateOperatorBody {
  name?: string | null;
  email?: string | null;
  role_id?: string | null;
  access_level?: OperatorAccessLevel | null;
  department?: string | null;
  mfa_enabled?: boolean | null;
  on_call?: boolean | null;
  shift_name?: string | null;
}
