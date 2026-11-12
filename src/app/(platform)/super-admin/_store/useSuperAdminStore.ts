"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  AccessApprovalRequest,
  ActivityCategory,
  AdminRole,
  Announcement,
  ApiAlertRule,
  BillingCycle,
  BillingPlan,
  EmailDeliveryLog,
  EmailTemplate,
  GitHubInstallation,
  IncidentGovernanceItem,
  Invoice,
  InvoiceLineItem,
  PaymentMethodType,
  PaymentTransaction,
  PermissionKey,
  PlatformBrandingPreferences,
  PlatformIntegration,
  PlatformOperator,
  PlatformPolicySettings,
  SecurityAlert,
  SecurityPolicy,
  SmtpConfig,
  Subscription,
  SuperAdminAccountProfile,
  SuperAdminActivity,
  SupportEscalationTicket,
  TenantOrganization,
  WebhookEventRecord,
} from "../_types";
import {
  INITIAL_ACTIVITIES,
  SEED_ACCESS_APPROVALS,
  SEED_ACCOUNT_PROFILE,
  SEED_ANNOUNCEMENTS,
  SEED_API_ALERTS,
  SEED_BRANDING_PREFS,
  SEED_EMAIL_LOGS,
  SEED_EMAIL_TEMPLATES,
  SEED_GITHUB_INSTALLATIONS,
  SEED_INCIDENTS,
  SEED_INTEGRATIONS,
  SEED_INVOICES,
  SEED_OPERATORS,
  SEED_ORGANIZATIONS,
  SEED_PAYMENTS,
  SEED_PLANS,
  SEED_POLICY_SETTINGS,
  SEED_ROLES,
  SEED_SECURITY_ALERTS,
  SEED_SECURITY_POLICIES,
  SEED_SMTP_CONFIG,
  SEED_SUBSCRIPTIONS,
  SEED_SUPPORT_TICKETS,
  SEED_WEBHOOK_EVENTS,
} from "../_data/seed";
import { interpolateTemplate, slugify } from "../_services/super-admin-service";

export interface CreateOrgInput {
  name: string;
  slug?: string;
  domain: string;
  industry: string;
  country: string;
  timezone: string;
  ownerName: string;
  ownerEmail: string;
  planId: string;
  status: "ACTIVE" | "TRIAL";
  billingCycle: BillingCycle;
  notes?: string;
}

interface SuperAdminStoreState {
  organizations: TenantOrganization[];
  operators: PlatformOperator[];
  roles: AdminRole[];
  plans: BillingPlan[];
  subscriptions: Subscription[];
  payments: PaymentTransaction[];
  invoices: Invoice[];
  smtpConfig: SmtpConfig;
  emailLogs: EmailDeliveryLog[];
  emailTemplates: EmailTemplate[];
  announcements: Announcement[];
  activities: SuperAdminActivity[];

  // Integrations & API
  integrations: PlatformIntegration[];
  githubInstallations: GitHubInstallation[];
  webhookEvents: WebhookEventRecord[];
  apiAlertRules: ApiAlertRule[];

  // Security & Governance
  securityAlerts: SecurityAlert[];
  securityPolicies: SecurityPolicy[];
  accessApprovals: AccessApprovalRequest[];
  incidents: IncidentGovernanceItem[];

  // Platform Management
  policySettings: PlatformPolicySettings;
  brandingPrefs: PlatformBrandingPreferences;
  supportTickets: SupportEscalationTicket[];

  // Super Admin Personal Account
  accountProfile: SuperAdminAccountProfile;

  activeRoleId: string;
  activeOperatorId: string;
  sidebarCollapsed: boolean;

  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveRolePreview: (roleId: string) => void;

  logActivity: (
    category: ActivityCategory,
    action: string,
    summary: string,
    severity?: "INFO" | "WARNING" | "CRITICAL",
    targetLabel?: string
  ) => void;

  // Organizations
  createOrganization: (input: CreateOrgInput) => { ok: boolean; error?: string; org?: TenantOrganization };
  updateOrganization: (id: string, updates: Partial<TenantOrganization>) => { ok: boolean; error?: string };
  suspendOrganization: (id: string, reason: string) => void;
  reactivateOrganization: (id: string) => void;
  deleteOrganization: (id: string) => void;

  // Operators
  createOperator: (input: Omit<PlatformOperator, "id" | "createdAt" | "lastActiveAt">) => { ok: boolean; error?: string };
  updateOperator: (id: string, updates: Partial<PlatformOperator>) => { ok: boolean; error?: string };
  toggleOperatorStatus: (id: string) => { ok: boolean; error?: string };
  deleteOperator: (id: string) => { ok: boolean; error?: string };

  // Roles
  createRole: (input: Omit<AdminRole, "id" | "createdAt" | "updatedAt" | "isSystem" | "slug">) => { ok: boolean; error?: string };
  updateRole: (id: string, updates: Partial<AdminRole>) => { ok: boolean; error?: string };
  cloneRole: (id: string) => AdminRole | null;
  deleteRole: (id: string) => { ok: boolean; error?: string };

  // Plans
  createPlan: (input: Omit<BillingPlan, "id" | "createdAt" | "updatedAt">) => { ok: boolean; error?: string };
  updatePlan: (id: string, updates: Partial<BillingPlan>) => { ok: boolean; error?: string };
  togglePlanArchive: (id: string) => void;
  deletePlan: (id: string) => { ok: boolean; error?: string };

  // Subscriptions
  assignSubscription: (input: {
    orgId: string;
    planId: string;
    billingCycle: BillingCycle;
    seats: number;
    autoRenew: boolean;
    paymentMethodLabel: string;
  }) => { ok: boolean; error?: string };
  changeSubscriptionPlan: (subscriptionId: string, newPlanId: string, billingCycle: BillingCycle) => void;
  updateSubscription: (
    subscriptionId: string,
    updates: Partial<
      Pick<
        Subscription,
        | "planId"
        | "billingCycle"
        | "seats"
        | "amount"
        | "status"
        | "currentPeriodStart"
        | "currentPeriodEnd"
        | "autoRenew"
        | "cancelAtPeriodEnd"
        | "paymentMethodLabel"
      >
    >
  ) => void;
  deleteSubscription: (subscriptionId: string) => void;
  renewSubscription: (subscriptionId: string) => void;
  toggleAutoRenew: (subscriptionId: string) => void;
  cancelSubscription: (subscriptionId: string, immediate: boolean) => void;
  reactivateSubscription: (subscriptionId: string) => void;

  // Payments
  recordSimulatedPayment: (input: {
    orgId: string;
    subscriptionId?: string;
    invoiceId?: string;
    amount: number;
    method: PaymentMethodType;
    methodLast4: string;
    description: string;
  }) => PaymentTransaction;
  updatePayment: (
    paymentId: string,
    updates: Partial<
      Pick<
        PaymentTransaction,
        | "orgId"
        | "amount"
        | "method"
        | "methodLast4"
        | "status"
        | "description"
        | "gatewayLabel"
        | "failureReason"
      >
    >
  ) => void;
  deletePayment: (paymentId: string) => void;
  retryFailedPayment: (paymentId: string) => { ok: boolean; message: string };
  refundPayment: (paymentId: string, amount: number, reason: string) => { ok: boolean; error?: string };

  // Invoices
  generateInvoice: (input: {
    orgId: string;
    subscriptionId?: string;
    dueDate: string;
    taxRate: number;
    lineItems: Omit<InvoiceLineItem, "id" | "total">[];
    notes?: string;
    markPaidImmediately?: boolean;
  }) => Invoice;
  updateInvoice: (
    invoiceId: string,
    updates: {
      orgId?: string;
      dueDate?: string;
      taxRate?: number;
      status?: Invoice["status"];
      notes?: string;
      lineItems?: Omit<InvoiceLineItem, "id" | "total">[];
    }
  ) => void;
  deleteInvoice: (invoiceId: string) => void;
  markInvoicePaid: (invoiceId: string, method?: PaymentMethodType) => void;
  voidInvoice: (invoiceId: string) => void;
  sendInvoiceReminder: (invoiceId: string) => { ok: boolean; error?: string };

  // SMTP & Templates & Announcements
  saveSmtpConfig: (config: Partial<SmtpConfig>, newCredentialProvided?: boolean) => void;
  recordSmtpTestResult: (ok: boolean, message: string) => void;
  sendSimulatedEmail: (input: {
    recipient: string;
    subject: string;
    templateKey?: string;
    source: EmailDeliveryLog["source"];
    detail: string;
  }) => { ok: boolean; error?: string };
  deleteEmailLogs: (ids: string[]) => void;

  createEmailTemplate: (input: Omit<EmailTemplate, "id" | "updatedAt" | "updatedBy">) => { ok: boolean; error?: string };
  updateEmailTemplate: (id: string, updates: Partial<EmailTemplate>) => void;
  duplicateEmailTemplate: (id: string) => EmailTemplate | null;
  deleteEmailTemplate: (id: string) => void;
  sendTestTemplateEmail: (templateId: string, recipient: string, sampleVars: Record<string, string>) => { ok: boolean; error?: string };

  createAnnouncement: (input: Omit<Announcement, "id" | "createdAt" | "updatedAt" | "createdBy">) => Announcement;
  updateAnnouncement: (id: string, updates: Partial<Announcement>) => void;
  publishAnnouncement: (id: string) => void;
  unpublishAnnouncement: (id: string) => void;
  deleteAnnouncement: (id: string) => void;

  // Integrations & API Governance
  toggleIntegrationEnabled: (id: string) => void;
  updateIntegrationSettings: (id: string, updates: Partial<PlatformIntegration>, rotatedCredential?: boolean) => void;
  testIntegrationConnection: (id: string) => { ok: boolean; message: string };
  toggleGitHubSyncPause: (id: string) => void;
  syncGitHubInstallations: () => void;
  retryWebhookEvent: (id: string) => void;
  createApiAlertRule: (input: Omit<ApiAlertRule, "id" | "updatedAt" | "status">) => void;
  toggleApiAlertRule: (id: string) => void;
  deleteApiAlertRule: (id: string) => void;

  // Security & Governance
  updateSecurityAlertStatus: (id: string, status: SecurityAlert["status"]) => void;
  toggleSecurityPolicy: (id: string) => void;
  requestSupportAccess: (input: {
    operatorName: string;
    operatorEmail: string;
    targetOrgId: string;
    ticketRef: string;
    reason: string;
    expiresInHours: number;
  }) => void;
  decideAccessApproval: (id: string, decision: "APPROVED" | "DENIED", customHours?: number) => void;
  revokeAccessApproval: (id: string) => void;
  createIncident: (input: Omit<IncidentGovernanceItem, "id" | "incidentCode" | "createdAt" | "updatedAt">) => void;
  updateIncident: (id: string, updates: Partial<IncidentGovernanceItem>) => void;

  // Platform Management
  savePolicySettings: (updates: Partial<PlatformPolicySettings>) => void;
  toggleFeatureFlag: (flagId: string) => void;
  saveBrandingPrefs: (updates: Partial<PlatformBrandingPreferences>) => void;
  createSupportTicket: (input: {
    orgId: string;
    subject: string;
    description: string;
    priority: SupportEscalationTicket["priority"];
    assignedOperatorId: string;
    requesterEmail: string;
  }) => void;
  updateSupportTicket: (id: string, updates: Partial<SupportEscalationTicket>) => void;

  // Super Admin Account
  updateAccountProfile: (updates: Partial<Pick<SuperAdminAccountProfile, "name" | "title" | "email" | "timezone">>) => void;
  changeAccountPassword: () => void;
  toggleAccountMfa: (method?: SuperAdminAccountProfile["mfaMethod"]) => void;
  revokeAdminSession: (sessionId: string) => void;
  updateAccountNotifications: (updates: Partial<SuperAdminAccountProfile["notifications"]>) => void;

  resetAllData: () => void;
}

const getInitialSnapshot = () => ({
  organizations: SEED_ORGANIZATIONS,
  operators: SEED_OPERATORS,
  roles: SEED_ROLES,
  plans: SEED_PLANS,
  subscriptions: SEED_SUBSCRIPTIONS,
  payments: SEED_PAYMENTS,
  invoices: SEED_INVOICES,
  smtpConfig: SEED_SMTP_CONFIG,
  emailLogs: SEED_EMAIL_LOGS,
  emailTemplates: SEED_EMAIL_TEMPLATES,
  announcements: SEED_ANNOUNCEMENTS,
  activities: INITIAL_ACTIVITIES,
  integrations: SEED_INTEGRATIONS,
  githubInstallations: SEED_GITHUB_INSTALLATIONS,
  webhookEvents: SEED_WEBHOOK_EVENTS,
  apiAlertRules: SEED_API_ALERTS,
  securityAlerts: SEED_SECURITY_ALERTS,
  securityPolicies: SEED_SECURITY_POLICIES,
  accessApprovals: SEED_ACCESS_APPROVALS,
  incidents: SEED_INCIDENTS,
  policySettings: SEED_POLICY_SETTINGS,
  brandingPrefs: SEED_BRANDING_PREFS,
  supportTickets: SEED_SUPPORT_TICKETS,
  accountProfile: SEED_ACCOUNT_PROFILE,
  activeRoleId: "role-super-admin",
  activeOperatorId: "op-1",
  sidebarCollapsed: false,
});

function addDaysIso(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export const useSuperAdminStore = create<SuperAdminStoreState>()(
  persist(
    (set, get) => ({
      ...getInitialSnapshot(),

      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setActiveRolePreview: (roleId) => {
        const role = get().roles.find((r) => r.id === roleId);
        if (!role) return;
        set({ activeRoleId: roleId });
        get().logActivity(
          "ROLE",
          "ROLE_PREVIEW_SWITCHED",
          `Switched active permission preview to ${role.name}`,
          "INFO",
          role.name
        );
      },

      logActivity: (category, action, summary, severity = "INFO", targetLabel) => {
        const state = get();
        const actor = state.operators.find((o) => o.id === state.activeOperatorId) || state.operators[0];
        const entry: SuperAdminActivity = {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          category,
          action,
          summary,
          actorName: state.accountProfile?.name || actor?.name || "Arthur Pendelton",
          actorEmail: state.accountProfile?.email || actor?.email || "superadmin@prowise.io",
          targetLabel,
          severity,
          timestamp: new Date().toISOString(),
        };
        set((s) => ({ activities: [entry, ...s.activities].slice(0, 120) }));
      },

      createOrganization: (input) => {
        const state = get();
        const normalizedSlug = slugify(input.slug || input.name);
        if (!normalizedSlug) {
          return { ok: false, error: "Workspace URL identifier is required." };
        }
        if (state.organizations.some((o) => o.slug.toLowerCase() === normalizedSlug)) {
          return { ok: false, error: `Workspace identifier "${normalizedSlug}" is already assigned.` };
        }
        const plan = state.plans.find((p) => p.id === input.planId);
        if (!plan) {
          return { ok: false, error: "Selected plan does not exist." };
        }

        const now = new Date().toISOString();
        const today = now.split("T")[0];
        const orgId = `org-${Date.now()}`;
        const monthlyMrr =
          input.status === "TRIAL"
            ? 0
            : input.billingCycle === "ANNUAL"
            ? Math.round(plan.annualPrice / 12)
            : plan.monthlyPrice;

        const newOrg: TenantOrganization = {
          id: orgId,
          name: input.name.trim(),
          slug: normalizedSlug,
          domain: input.domain.trim(),
          industry: input.industry.trim() || "Technology",
          country: input.country.trim() || "United States",
          timezone: input.timezone || "UTC",
          ownerName: input.ownerName.trim(),
          ownerEmail: input.ownerEmail.trim(),
          status: input.status,
          planId: plan.id,
          seatsUsed: 1,
          seatsLimit: plan.limits.maxSeats,
          projectsCount: 0,
          storageUsedGb: 0.2,
          mrr: monthlyMrr,
          createdAt: now,
          lastActivityAt: now,
          notes: input.notes,
        };

        const cycleDays =
          input.status === "TRIAL"
            ? Math.max(plan.trialDays, state.policySettings.defaultTrialDays || 14)
            : input.billingCycle === "ANNUAL"
            ? 365
            : 30;
        const chargeAmount =
          input.status === "TRIAL" ? 0 : input.billingCycle === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice;

        const subId = `sub-${Date.now()}`;
        const newSub: Subscription = {
          id: subId,
          orgId,
          planId: plan.id,
          billingCycle: input.billingCycle,
          status: input.status === "TRIAL" ? "TRIALING" : "ACTIVE",
          seats: Math.min(10, plan.limits.maxSeats),
          amount: chargeAmount,
          currentPeriodStart: today,
          currentPeriodEnd: addDaysIso(today, cycleDays),
          autoRenew: true,
          cancelAtPeriodEnd: false,
          paymentMethodLabel: chargeAmount > 0 ? "Stripe Visa •••• 4242 (Simulated)" : "No Card Required",
          updatedAt: now,
        };

        let nextInvoices = state.invoices;
        let nextPayments = state.payments;

        if (chargeAmount > 0) {
          const invNumber = `INV-2026-${String(100 + state.invoices.length + 1).padStart(3, "0")}`;
          const invId = `inv-${Date.now()}`;
          const payId = `pay-${Date.now()}`;
          const newPayment: PaymentTransaction = {
            id: payId,
            transactionRef: `TXN-2026-${9100 + state.payments.length + 1}`,
            orgId,
            subscriptionId: subId,
            invoiceId: invId,
            amount: chargeAmount,
            refundedAmount: 0,
            currency: "USD",
            status: "SUCCEEDED",
            method: "CARD",
            methodLast4: "4242",
            gatewayLabel: "Stripe (Simulated)",
            description: `${plan.name} (${input.billingCycle}) — Initial Provisioning`,
            createdAt: now,
          };
          const newInvoice: Invoice = {
            id: invId,
            invoiceNumber: invNumber,
            orgId,
            subscriptionId: subId,
            paymentId: payId,
            issueDate: today,
            dueDate: addDaysIso(today, 14),
            status: "PAID",
            subtotal: chargeAmount,
            taxRate: 0,
            taxAmount: 0,
            total: chargeAmount,
            lineItems: [
              {
                id: `li-${Date.now()}`,
                description: `${plan.name} — ${input.billingCycle} Subscription`,
                quantity: 1,
                unitPrice: chargeAmount,
                total: chargeAmount,
              },
            ],
            paidAt: now,
            createdAt: now,
          };
          nextInvoices = [newInvoice, ...state.invoices];
          nextPayments = [newPayment, ...state.payments];
        }

        set({
          organizations: [newOrg, ...state.organizations],
          subscriptions: [newSub, ...state.subscriptions],
          invoices: nextInvoices,
          payments: nextPayments,
        });

        get().logActivity(
          "ORGANIZATION",
          "ORG_PROVISIONED",
          `Provisioned ${newOrg.name} on ${plan.name} (${input.status})`,
          "INFO",
          newOrg.slug
        );

        return { ok: true, org: newOrg };
      },

      updateOrganization: (id, updates) => {
        const state = get();
        if (updates.slug) {
          const cleanSlug = slugify(updates.slug);
          if (state.organizations.some((o) => o.id !== id && o.slug === cleanSlug)) {
            return { ok: false, error: `Workspace identifier "${cleanSlug}" is already in use.` };
          }
          updates.slug = cleanSlug;
        }
        set((s) => ({
          organizations: s.organizations.map((o) =>
            o.id === id ? { ...o, ...updates, lastActivityAt: new Date().toISOString() } : o
          ),
        }));
        const org = get().organizations.find((o) => o.id === id);
        if (org) {
          get().logActivity("ORGANIZATION", "ORG_UPDATED", `Updated details for ${org.name}`, "INFO", org.slug);
        }
        return { ok: true };
      },

      suspendOrganization: (id, reason) => {
        const org = get().organizations.find((o) => o.id === id);
        if (!org) return;
        set((s) => ({
          organizations: s.organizations.map((o) =>
            o.id === id ? { ...o, status: "SUSPENDED", suspendedReason: reason, mrr: 0 } : o
          ),
          subscriptions: s.subscriptions.map((sub) =>
            sub.orgId === id && sub.status === "ACTIVE"
              ? { ...sub, status: "PAST_DUE", autoRenew: false, updatedAt: new Date().toISOString() }
              : sub
          ),
        }));
        get().logActivity("ORGANIZATION", "ORG_SUSPENDED", `Suspended ${org.name}: ${reason}`, "CRITICAL", org.slug);
      },

      reactivateOrganization: (id) => {
        const state = get();
        const org = state.organizations.find((o) => o.id === id);
        if (!org) return;
        const sub = state.subscriptions.find((s) => s.orgId === id);
        const plan = state.plans.find((p) => p.id === (sub?.planId || org.planId));
        const restoredMrr = plan
          ? sub?.billingCycle === "ANNUAL"
            ? Math.round(plan.annualPrice / 12)
            : plan.monthlyPrice
          : org.mrr;

        set((s) => ({
          organizations: s.organizations.map((o) =>
            o.id === id
              ? { ...o, status: "ACTIVE", suspendedReason: undefined, mrr: restoredMrr, lastActivityAt: new Date().toISOString() }
              : o
          ),
          subscriptions: s.subscriptions.map((sItem) =>
            sItem.orgId === id && sItem.status !== "CANCELLED"
              ? { ...sItem, status: "ACTIVE", autoRenew: true, updatedAt: new Date().toISOString() }
              : sItem
          ),
        }));
        get().logActivity("ORGANIZATION", "ORG_REACTIVATED", `Reactivated tenant ${org.name}`, "INFO", org.slug);
      },

      deleteOrganization: (id) => {
        const org = get().organizations.find((o) => o.id === id);
        set((s) => ({
          organizations: s.organizations.filter((o) => o.id !== id),
          subscriptions: s.subscriptions.filter((sub) => sub.orgId !== id),
          invoices: s.invoices.filter((inv) => inv.orgId !== id),
          payments: s.payments.filter((p) => p.orgId !== id),
        }));
        if (org) {
          get().logActivity("ORGANIZATION", "ORG_DELETED", `Decommissioned tenant ${org.name}`, "CRITICAL", org.slug);
        }
      },

      createOperator: (input) => {
        const state = get();
        const normalizedEmail = input.email.trim().toLowerCase();
        if (state.operators.some((op) => op.email.toLowerCase() === normalizedEmail)) {
          return { ok: false, error: `Operator with email ${normalizedEmail} already exists.` };
        }
        const now = new Date().toISOString();
        const op: PlatformOperator = {
          ...input,
          email: normalizedEmail,
          id: `op-${Date.now()}`,
          createdAt: now,
          lastActiveAt: now,
        };
        set({ operators: [op, ...state.operators] });
        const role = state.roles.find((r) => r.id === op.roleId);
        get().logActivity(
          "OPERATOR",
          "OPERATOR_CREATED",
          `Added operator ${op.name} (${role?.name || op.roleId})`,
          "INFO",
          op.email
        );
        return { ok: true };
      },

      updateOperator: (id, updates) => {
        const state = get();
        if (updates.email) {
          const normalized = updates.email.trim().toLowerCase();
          if (state.operators.some((o) => o.id !== id && o.email.toLowerCase() === normalized)) {
            return { ok: false, error: `Email ${normalized} is already assigned.` };
          }
          updates.email = normalized;
        }
        set((s) => ({
          operators: s.operators.map((op) => (op.id === id ? { ...op, ...updates } : op)),
        }));
        const op = get().operators.find((o) => o.id === id);
        if (op) {
          get().logActivity("OPERATOR", "OPERATOR_UPDATED", `Updated operator ${op.name}`, "INFO", op.email);
        }
        return { ok: true };
      },

      toggleOperatorStatus: (id) => {
        const state = get();
        const target = state.operators.find((o) => o.id === id);
        if (!target) return { ok: false, error: "Operator not found." };
        if (target.id === state.activeOperatorId && target.status === "ACTIVE") {
          return { ok: false, error: "You cannot deactivate your own active session operator." };
        }
        const activeSuperAdmins = state.operators.filter(
          (o) => o.roleId === "role-super-admin" && o.status === "ACTIVE"
        );
        if (target.roleId === "role-super-admin" && target.status === "ACTIVE" && activeSuperAdmins.length <= 1) {
          return { ok: false, error: "At least one active Super Administrator is required." };
        }
        const nextStatus = target.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
        set((s) => ({
          operators: s.operators.map((o) => (o.id === id ? { ...o, status: nextStatus } : o)),
        }));
        get().logActivity(
          "OPERATOR",
          nextStatus === "ACTIVE" ? "OPERATOR_ACTIVATED" : "OPERATOR_DEACTIVATED",
          `${nextStatus === "ACTIVE" ? "Activated" : "Deactivated"} operator ${target.name}`,
          nextStatus === "INACTIVE" ? "WARNING" : "INFO",
          target.email
        );
        return { ok: true };
      },

      deleteOperator: (id) => {
        const state = get();
        const target = state.operators.find((o) => o.id === id);
        if (!target) return { ok: false, error: "Operator not found." };
        if (target.id === state.activeOperatorId) {
          return { ok: false, error: "Cannot delete the currently signed-in Super Admin." };
        }
        const activeSuperAdmins = state.operators.filter(
          (o) => o.roleId === "role-super-admin" && o.status === "ACTIVE"
        );
        if (target.roleId === "role-super-admin" && target.status === "ACTIVE" && activeSuperAdmins.length <= 1) {
          return { ok: false, error: "Cannot remove the last active Super Administrator." };
        }
        set((s) => ({ operators: s.operators.filter((o) => o.id !== id) }));
        get().logActivity("OPERATOR", "OPERATOR_REMOVED", `Removed operator ${target.name}`, "WARNING", target.email);
        return { ok: true };
      },

      createRole: (input) => {
        const state = get();
        const slug = slugify(input.name);
        if (state.roles.some((r) => r.slug === slug)) {
          return { ok: false, error: `Role "${input.name}" already exists.` };
        }
        const now = new Date().toISOString();
        const role: AdminRole = {
          ...input,
          id: `role-${Date.now()}`,
          slug,
          isSystem: false,
          createdAt: now,
          updatedAt: now,
        };
        set({ roles: [...state.roles, role] });
        get().logActivity(
          "ROLE",
          "ROLE_CREATED",
          `Created role "${role.name}" with ${role.permissions.length} permissions`,
          "INFO",
          role.name
        );
        return { ok: true };
      },

      updateRole: (id, updates) => {
        const state = get();
        const existing = state.roles.find((r) => r.id === id);
        if (!existing) return { ok: false, error: "Role not found." };
        if (existing.id === "role-super-admin" && updates.permissions && !updates.permissions.includes("roles.manage")) {
          return { ok: false, error: "Super Administrator must retain Role Management permission to prevent lockout." };
        }
        set((s) => ({
          roles: s.roles.map((r) =>
            r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r
          ),
        }));
        get().logActivity(
          "ROLE",
          "ROLE_UPDATED",
          `Updated permissions/metadata for role "${updates.name || existing.name}"`,
          "INFO",
          existing.name
        );
        return { ok: true };
      },

      cloneRole: (id) => {
        const existing = get().roles.find((r) => r.id === id);
        if (!existing) return null;
        const now = new Date().toISOString();
        const cloned: AdminRole = {
          ...existing,
          id: `role-${Date.now()}`,
          name: `${existing.name} Copy`,
          slug: `${existing.slug}-copy-${Date.now().toString().slice(-4)}`,
          isSystem: false,
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ roles: [...s.roles, cloned] }));
        get().logActivity("ROLE", "ROLE_CLONED", `Cloned role "${existing.name}" -> "${cloned.name}"`, "INFO", cloned.name);
        return cloned;
      },

      deleteRole: (id) => {
        const state = get();
        const role = state.roles.find((r) => r.id === id);
        if (!role) return { ok: false, error: "Role not found." };
        if (role.isSystem) return { ok: false, error: "System-defined roles cannot be deleted." };
        const assignedCount = state.operators.filter((o) => o.roleId === id).length;
        if (assignedCount > 0) {
          return { ok: false, error: `Cannot delete role while ${assignedCount} operator(s) remain assigned.` };
        }
        set((s) => ({
          roles: s.roles.filter((r) => r.id !== id),
          activeRoleId: s.activeRoleId === id ? "role-super-admin" : s.activeRoleId,
        }));
        get().logActivity("ROLE", "ROLE_DELETED", `Deleted custom role "${role.name}"`, "WARNING", role.name);
        return { ok: true };
      },

      createPlan: (input) => {
        const state = get();
        const code = input.code.trim().toUpperCase();
        if (state.plans.some((p) => p.code.toUpperCase() === code)) {
          return { ok: false, error: `Plan code "${code}" already exists.` };
        }
        const now = new Date().toISOString();
        const plan: BillingPlan = {
          ...input,
          code,
          id: `plan-${Date.now()}`,
          createdAt: now,
          updatedAt: now,
        };
        set({ plans: [...state.plans, plan] });
        get().logActivity("PLAN", "PLAN_CREATED", `Created billing plan "${plan.name}" ($${plan.monthlyPrice}/mo)`, "INFO", plan.code);
        return { ok: true };
      },

      updatePlan: (id, updates) => {
        const now = new Date().toISOString();
        set((s) => {
          const nextPlans = s.plans.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: now } : p));
          const updatedPlan = nextPlans.find((p) => p.id === id);
          const nextOrgs = updatedPlan
            ? s.organizations.map((o) =>
                o.planId === id
                  ? {
                      ...o,
                      seatsLimit: updatedPlan.limits.maxSeats,
                      mrr: o.status === "ACTIVE" ? updatedPlan.monthlyPrice : o.mrr,
                    }
                  : o
              )
            : s.organizations;
          return { plans: nextPlans, organizations: nextOrgs };
        });
        const plan = get().plans.find((p) => p.id === id);
        if (plan) {
          get().logActivity("PLAN", "PLAN_UPDATED", `Updated commercial plan "${plan.name}"`, "INFO", plan.code);
        }
        return { ok: true };
      },

      togglePlanArchive: (id) => {
        const plan = get().plans.find((p) => p.id === id);
        if (!plan) return;
        const nextStatus = plan.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
        set((s) => ({
          plans: s.plans.map((p) =>
            p.id === id ? { ...p, status: nextStatus, updatedAt: new Date().toISOString() } : p
          ),
        }));
        get().logActivity("PLAN", `PLAN_${nextStatus}`, `${nextStatus === "ARCHIVED" ? "Archived" : "Restored"} plan "${plan.name}"`, "INFO", plan.code);
      },

      deletePlan: (id) => {
        const state = get();
        const activeSubCount = state.subscriptions.filter((s) => s.planId === id && s.status !== "CANCELLED").length;
        if (activeSubCount > 0) {
          return {
            ok: false,
            error: `Cannot delete plan with ${activeSubCount} active subscription(s). Migrate or archive it instead.`,
          };
        }
        const plan = state.plans.find((p) => p.id === id);
        set((s) => ({ plans: s.plans.filter((p) => p.id !== id) }));
        if (plan) {
          get().logActivity("PLAN", "PLAN_DELETED", `Deleted billing plan "${plan.name}"`, "WARNING", plan.code);
        }
        return { ok: true };
      },

      assignSubscription: ({ orgId, planId, billingCycle, seats, autoRenew, paymentMethodLabel }) => {
        const state = get();
        const org = state.organizations.find((o) => o.id === orgId);
        const plan = state.plans.find((p) => p.id === planId);
        if (!org || !plan) return { ok: false, error: "Organization or plan not found." };

        const now = new Date().toISOString();
        const today = now.split("T")[0];
        const amount = billingCycle === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice;
        const periodEnd = addDaysIso(today, billingCycle === "ANNUAL" ? 365 : 30);
        const monthlyMrr = billingCycle === "ANNUAL" ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice;

        const existingSub = state.subscriptions.find((s) => s.orgId === orgId);
        let nextSubs: Subscription[];
        let subId: string;

        if (existingSub) {
          subId = existingSub.id;
          nextSubs = state.subscriptions.map((s) =>
            s.id === existingSub.id
              ? {
                  ...s,
                  planId,
                  billingCycle,
                  status: "ACTIVE",
                  seats,
                  amount,
                  currentPeriodStart: today,
                  currentPeriodEnd: periodEnd,
                  autoRenew,
                  cancelAtPeriodEnd: false,
                  paymentMethodLabel,
                  updatedAt: now,
                }
              : s
          );
        } else {
          subId = `sub-${Date.now()}`;
          nextSubs = [
            {
              id: subId,
              orgId,
              planId,
              billingCycle,
              status: "ACTIVE",
              seats,
              amount,
              currentPeriodStart: today,
              currentPeriodEnd: periodEnd,
              autoRenew,
              cancelAtPeriodEnd: false,
              paymentMethodLabel,
              updatedAt: now,
            },
            ...state.subscriptions,
          ];
        }

        set({
          subscriptions: nextSubs,
          organizations: state.organizations.map((o) =>
            o.id === orgId
              ? { ...o, planId, status: "ACTIVE", mrr: monthlyMrr, seatsLimit: plan.limits.maxSeats }
              : o
          ),
        });

        if (amount > 0) {
          get().generateInvoice({
            orgId,
            subscriptionId: subId,
            dueDate: addDaysIso(today, 14),
            taxRate: 0,
            lineItems: [{ description: `${plan.name} (${billingCycle}) — Assigned Plan`, quantity: 1, unitPrice: amount }],
            notes: "Generated upon subscription assignment.",
            markPaidImmediately: true,
          });
        }

        get().logActivity(
          "SUBSCRIPTION",
          "SUBSCRIPTION_ASSIGNED",
          `Assigned ${plan.name} (${billingCycle}) to ${org.name}`,
          "INFO",
          org.slug
        );
        return { ok: true };
      },

      changeSubscriptionPlan: (subscriptionId, newPlanId, billingCycle) => {
        const state = get();
        const sub = state.subscriptions.find((s) => s.id === subscriptionId);
        const newPlan = state.plans.find((p) => p.id === newPlanId);
        if (!sub || !newPlan) return;
        const org = state.organizations.find((o) => o.id === sub.orgId);
        const oldPlan = state.plans.find((p) => p.id === sub.planId);

        const now = new Date().toISOString();
        const today = now.split("T")[0];
        const newAmount = billingCycle === "ANNUAL" ? newPlan.annualPrice : newPlan.monthlyPrice;
        const monthlyMrr = billingCycle === "ANNUAL" ? Math.round(newPlan.annualPrice / 12) : newPlan.monthlyPrice;
        const diff = newAmount - sub.amount;

        set((s) => ({
          subscriptions: s.subscriptions.map((item) =>
            item.id === subscriptionId
              ? {
                  ...item,
                  planId: newPlanId,
                  billingCycle,
                  amount: newAmount,
                  status: "ACTIVE",
                  cancelAtPeriodEnd: false,
                  updatedAt: now,
                }
              : item
          ),
          organizations: s.organizations.map((o) =>
            o.id === sub.orgId
              ? { ...o, planId: newPlanId, mrr: monthlyMrr, seatsLimit: newPlan.limits.maxSeats, status: o.status === "TRIAL" ? "ACTIVE" : o.status }
              : o
          ),
        }));

        if (diff > 0) {
          get().generateInvoice({
            orgId: sub.orgId,
            subscriptionId: sub.id,
            dueDate: addDaysIso(today, 7),
            taxRate: 0,
            lineItems: [
              {
                description: `Upgrade Adjustment (${oldPlan?.name || "Previous"} -> ${newPlan.name}, ${billingCycle})`,
                quantity: 1,
                unitPrice: diff,
              },
            ],
            notes: "Simulated plan upgrade proration invoice.",
            markPaidImmediately: true,
          });
        }

        get().logActivity(
          "SUBSCRIPTION",
          diff >= 0 ? "SUBSCRIPTION_UPGRADED" : "SUBSCRIPTION_DOWNGRADED",
          `${diff >= 0 ? "Upgraded" : "Changed"} ${org?.name || sub.orgId} from ${oldPlan?.name || sub.planId} to ${newPlan.name}`,
          "INFO",
          org?.slug
        );
      },

      renewSubscription: (subscriptionId) => {
        const state = get();
        const sub = state.subscriptions.find((s) => s.id === subscriptionId);
        if (!sub) return;
        const org = state.organizations.find((o) => o.id === sub.orgId);
        const plan = state.plans.find((p) => p.id === sub.planId);
        const now = new Date().toISOString();
        const newStart = sub.currentPeriodEnd;
        const newEnd = addDaysIso(newStart, sub.billingCycle === "ANNUAL" ? 365 : 30);

        set((s) => ({
          subscriptions: s.subscriptions.map((item) =>
            item.id === subscriptionId
              ? {
                  ...item,
                  status: "ACTIVE",
                  currentPeriodStart: newStart,
                  currentPeriodEnd: newEnd,
                  cancelAtPeriodEnd: false,
                  updatedAt: now,
                }
              : item
          ),
          organizations: s.organizations.map((o) =>
            o.id === sub.orgId && plan
              ? {
                  ...o,
                  status: "ACTIVE",
                  mrr: sub.billingCycle === "ANNUAL" ? Math.round(plan.annualPrice / 12) : plan.monthlyPrice,
                }
              : o
          ),
        }));

        if (sub.amount > 0) {
          get().generateInvoice({
            orgId: sub.orgId,
            subscriptionId: sub.id,
            dueDate: addDaysIso(now.split("T")[0], 14),
            taxRate: 0,
            lineItems: [
              {
                description: `${plan?.name || "Subscription"} Renewal (${newStart} to ${newEnd})`,
                quantity: 1,
                unitPrice: sub.amount,
              },
            ],
            notes: "Manual renewal triggered by Super Admin (Simulated).",
            markPaidImmediately: true,
          });
        }

        get().logActivity(
          "SUBSCRIPTION",
          "SUBSCRIPTION_RENEWED",
          `Renewed subscription for ${org?.name || sub.orgId} through ${newEnd}`,
          "INFO",
          org?.slug
        );
      },

      toggleAutoRenew: (subscriptionId) => {
        const sub = get().subscriptions.find((s) => s.id === subscriptionId);
        if (!sub) return;
        set((s) => ({
          subscriptions: s.subscriptions.map((item) =>
            item.id === subscriptionId
              ? { ...item, autoRenew: !item.autoRenew, updatedAt: new Date().toISOString() }
              : item
          ),
        }));
        const org = get().organizations.find((o) => o.id === sub.orgId);
        get().logActivity(
          "SUBSCRIPTION",
          "AUTO_RENEW_TOGGLED",
          `${!sub.autoRenew ? "Enabled" : "Disabled"} auto-renew for ${org?.name || sub.orgId}`,
          "INFO",
          org?.slug
        );
      },

      cancelSubscription: (subscriptionId, immediate) => {
        const sub = get().subscriptions.find((s) => s.id === subscriptionId);
        if (!sub) return;
        const org = get().organizations.find((o) => o.id === sub.orgId);
        const now = new Date().toISOString();

        set((s) => ({
          subscriptions: s.subscriptions.map((item) =>
            item.id === subscriptionId
              ? {
                  ...item,
                  status: immediate ? "CANCELLED" : item.status,
                  autoRenew: false,
                  cancelAtPeriodEnd: !immediate,
                  updatedAt: now,
                }
              : item
          ),
          organizations: immediate
            ? s.organizations.map((o) => (o.id === sub.orgId ? { ...o, mrr: 0 } : o))
            : s.organizations,
        }));

        get().logActivity(
          "SUBSCRIPTION",
          immediate ? "SUBSCRIPTION_CANCELLED" : "SUBSCRIPTION_SCHEDULED_CANCEL",
          `${immediate ? "Immediately cancelled" : "Scheduled end-of-period cancellation for"} ${org?.name || sub.orgId}`,
          "WARNING",
          org?.slug
        );
      },

      reactivateSubscription: (subscriptionId) => {
        const state = get();
        const sub = state.subscriptions.find((s) => s.id === subscriptionId);
        if (!sub) return;
        const org = state.organizations.find((o) => o.id === sub.orgId);
        const plan = state.plans.find((p) => p.id === sub.planId);
        const restoredMrr = plan
          ? sub.billingCycle === "ANNUAL"
            ? Math.round(plan.annualPrice / 12)
            : plan.monthlyPrice
          : 0;

        set((s) => ({
          subscriptions: s.subscriptions.map((item) =>
            item.id === subscriptionId
              ? { ...item, status: "ACTIVE", autoRenew: true, cancelAtPeriodEnd: false, updatedAt: new Date().toISOString() }
              : item
          ),
          organizations: s.organizations.map((o) =>
            o.id === sub.orgId ? { ...o, status: "ACTIVE", mrr: restoredMrr } : o
          ),
        }));
        get().logActivity("SUBSCRIPTION", "SUBSCRIPTION_REACTIVATED", `Reactivated subscription for ${org?.name || sub.orgId}`, "INFO", org?.slug);
      },

      updateSubscription: (subscriptionId, updates) => {
        const state = get();
        const sub = state.subscriptions.find((s) => s.id === subscriptionId);
        if (!sub) return;
        const org = state.organizations.find((o) => o.id === sub.orgId);
        const now = new Date().toISOString();
        const nextStatus = updates.status ?? sub.status;
        const nextCycle = updates.billingCycle ?? sub.billingCycle;
        const nextAmount = updates.amount ?? sub.amount;
        const nextPlanId = updates.planId ?? sub.planId;
        const nextSeats = updates.seats ?? sub.seats;
        const derivedMrr =
          nextStatus === "CANCELLED"
            ? 0
            : nextCycle === "ANNUAL"
              ? Math.round(nextAmount / 12)
              : nextAmount;

        set((s) => ({
          subscriptions: s.subscriptions.map((item) =>
            item.id === subscriptionId
              ? { ...item, ...updates, updatedAt: now }
              : item
          ),
          organizations: s.organizations.map((o) =>
            o.id === sub.orgId
              ? {
                  ...o,
                  planId: nextPlanId,
                  seatsLimit: Math.max(o.seatsLimit, nextSeats),
                  mrr: derivedMrr,
                }
              : o
          ),
        }));

        get().logActivity(
          "SUBSCRIPTION",
          "SUBSCRIPTION_UPDATED",
          `Updated subscription details for ${org?.name || sub.orgId}`,
          "INFO",
          org?.slug
        );
      },

      deleteSubscription: (subscriptionId) => {
        const state = get();
        const sub = state.subscriptions.find((s) => s.id === subscriptionId);
        if (!sub) return;
        const org = state.organizations.find((o) => o.id === sub.orgId);
        set((s) => ({
          subscriptions: s.subscriptions.filter((item) => item.id !== subscriptionId),
        }));
        get().logActivity(
          "SUBSCRIPTION",
          "SUBSCRIPTION_DELETED",
          `Removed subscription record for ${org?.name || sub.orgId}`,
          "WARNING",
          org?.slug
        );
      },

      recordSimulatedPayment: ({ orgId, subscriptionId, invoiceId, amount, method, methodLast4, description }) => {
        const state = get();
        const now = new Date().toISOString();
        const payment: PaymentTransaction = {
          id: `pay-${Date.now()}`,
          transactionRef: `TXN-2026-${9100 + state.payments.length + 1}`,
          orgId,
          subscriptionId,
          invoiceId,
          amount,
          refundedAmount: 0,
          currency: "USD",
          status: "SUCCEEDED",
          method,
          methodLast4: methodLast4 || "4242",
          gatewayLabel: method === "ACH" ? "ACH Direct (Simulated)" : method === "WIRE" ? "Simulated Wire Settlement" : "Stripe (Simulated)",
          description,
          createdAt: now,
        };

        set((s) => ({
          payments: [payment, ...s.payments],
          invoices: invoiceId
            ? s.invoices.map((inv) =>
                inv.id === invoiceId ? { ...inv, status: "PAID", paymentId: payment.id, paidAt: now } : inv
              )
            : s.invoices,
        }));

        const org = state.organizations.find((o) => o.id === orgId);
        get().logActivity(
          "PAYMENT",
          "PAYMENT_RECORDED",
          `Recorded simulated ${method} charge of $${amount.toFixed(2)} for ${org?.name || orgId}`,
          "INFO",
          payment.transactionRef
        );

        return payment;
      },

      retryFailedPayment: (paymentId) => {
        const state = get();
        const payment = state.payments.find((p) => p.id === paymentId);
        if (!payment) return { ok: false, message: "Payment record not found." };
        const now = new Date().toISOString();
        const org = state.organizations.find((o) => o.id === payment.orgId);

        set((s) => ({
          payments: s.payments.map((p) =>
            p.id === paymentId ? { ...p, status: "SUCCEEDED", failureReason: undefined } : p
          ),
          invoices: payment.invoiceId
            ? s.invoices.map((inv) =>
                inv.id === payment.invoiceId ? { ...inv, status: "PAID", paidAt: now } : inv
              )
            : s.invoices,
          subscriptions: payment.subscriptionId
            ? s.subscriptions.map((sub) =>
                sub.id === payment.subscriptionId && sub.status === "PAST_DUE"
                  ? { ...sub, status: "ACTIVE", updatedAt: now }
                  : sub
              )
            : s.subscriptions,
        }));

        get().logActivity(
          "PAYMENT",
          "PAYMENT_RETRY_SUCCEEDED",
          `Simulated retry succeeded for ${payment.transactionRef} (${org?.name || payment.orgId})`,
          "INFO",
          payment.transactionRef
        );
        return { ok: true, message: `Transaction ${payment.transactionRef} succeeded on retry.` };
      },

      refundPayment: (paymentId, amount, reason) => {
        const state = get();
        const payment = state.payments.find((p) => p.id === paymentId);
        if (!payment) return { ok: false, error: "Payment transaction not found." };
        const remaining = Number((payment.amount - payment.refundedAmount).toFixed(2));
        if (amount <= 0 || amount > remaining) {
          return { ok: false, error: `Refund amount must be between $0.01 and $${remaining.toFixed(2)}.` };
        }
        const totalRefunded = Number((payment.refundedAmount + amount).toFixed(2));
        const isFull = totalRefunded >= payment.amount;
        const org = state.organizations.find((o) => o.id === payment.orgId);

        set((s) => ({
          payments: s.payments.map((p) =>
            p.id === paymentId
              ? {
                  ...p,
                  refundedAmount: totalRefunded,
                  status: isFull ? "REFUNDED" : "PARTIALLY_REFUNDED",
                  refundReason: reason,
                }
              : p
          ),
          invoices:
            isFull && payment.invoiceId
              ? s.invoices.map((inv) =>
                  inv.id === payment.invoiceId ? { ...inv, status: "REFUNDED" } : inv
                )
              : s.invoices,
        }));

        get().logActivity(
          "PAYMENT",
          isFull ? "PAYMENT_REFUNDED" : "PAYMENT_PARTIAL_REFUND",
          `Issued simulated $${amount.toFixed(2)} refund on ${payment.transactionRef} (${org?.name || ""}): ${reason}`,
          "WARNING",
          payment.transactionRef
        );

        return { ok: true };
      },

      updatePayment: (paymentId, updates) => {
        const state = get();
        const payment = state.payments.find((p) => p.id === paymentId);
        if (!payment) return;
        const org = state.organizations.find((o) => o.id === (updates.orgId ?? payment.orgId));
        set((s) => ({
          payments: s.payments.map((p) =>
            p.id === paymentId ? { ...p, ...updates } : p
          ),
        }));
        get().logActivity(
          "PAYMENT",
          "PAYMENT_UPDATED",
          `Updated transaction ${payment.transactionRef} (${org?.name || payment.orgId})`,
          "INFO",
          payment.transactionRef
        );
      },

      deletePayment: (paymentId) => {
        const state = get();
        const payment = state.payments.find((p) => p.id === paymentId);
        if (!payment) return;
        set((s) => ({
          payments: s.payments.filter((p) => p.id !== paymentId),
        }));
        get().logActivity(
          "PAYMENT",
          "PAYMENT_DELETED",
          `Deleted transaction ${payment.transactionRef} from local ledger`,
          "WARNING",
          payment.transactionRef
        );
      },

      generateInvoice: ({ orgId, subscriptionId, dueDate, taxRate, lineItems, notes, markPaidImmediately }) => {
        const state = get();
        const now = new Date().toISOString();
        const today = now.split("T")[0];
        const invId = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        const invoiceNumber = `INV-2026-${String(95 + state.invoices.length + 1).padStart(3, "0")}`;

        const normalizedItems: InvoiceLineItem[] = lineItems.map((li, idx) => ({
          id: `li-${Date.now()}-${idx}`,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          total: Number((li.quantity * li.unitPrice).toFixed(2)),
        }));

        const subtotal = Number(normalizedItems.reduce((acc, item) => acc + item.total, 0).toFixed(2));
        const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(2));
        const total = Number((subtotal + taxAmount).toFixed(2));

        let paymentId: string | undefined;
        let nextPayments = state.payments;

        if (markPaidImmediately && total > 0) {
          const payId = `pay-${Date.now()}`;
          paymentId = payId;
          const payment: PaymentTransaction = {
            id: payId,
            transactionRef: `TXN-2026-${9100 + state.payments.length + 1}`,
            orgId,
            subscriptionId,
            invoiceId: invId,
            amount: total,
            refundedAmount: 0,
            currency: "USD",
            status: "SUCCEEDED",
            method: "CARD",
            methodLast4: "4242",
            gatewayLabel: "Stripe (Simulated)",
            description: `Invoice ${invoiceNumber} Settlement`,
            createdAt: now,
          };
          nextPayments = [payment, ...state.payments];
        }

        const invoice: Invoice = {
          id: invId,
          invoiceNumber,
          orgId,
          subscriptionId,
          paymentId,
          issueDate: today,
          dueDate,
          status: markPaidImmediately ? "PAID" : "OPEN",
          subtotal,
          taxRate,
          taxAmount,
          total,
          lineItems: normalizedItems,
          notes,
          paidAt: markPaidImmediately ? now : undefined,
          createdAt: now,
        };

        set({
          invoices: [invoice, ...state.invoices],
          payments: nextPayments,
        });

        const org = state.organizations.find((o) => o.id === orgId);
        get().logActivity(
          "INVOICE",
          "INVOICE_GENERATED",
          `Generated ${invoiceNumber} ($${total.toFixed(2)}) for ${org?.name || orgId}`,
          "INFO",
          invoiceNumber
        );

        return invoice;
      },

      markInvoicePaid: (invoiceId, method = "CARD") => {
        const state = get();
        const inv = state.invoices.find((i) => i.id === invoiceId);
        if (!inv || inv.status === "PAID" || inv.status === "VOID") return;
        const org = state.organizations.find((o) => o.id === inv.orgId);

        get().recordSimulatedPayment({
          orgId: inv.orgId,
          subscriptionId: inv.subscriptionId,
          invoiceId: inv.id,
          amount: inv.total,
          method,
          methodLast4: method === "ACH" ? "6710" : method === "WIRE" ? "0882" : "4242",
          description: `Settlement for ${inv.invoiceNumber}`,
        });

        if (inv.subscriptionId) {
          set((s) => ({
            subscriptions: s.subscriptions.map((sub) =>
              sub.id === inv.subscriptionId && sub.status === "PAST_DUE"
                ? { ...sub, status: "ACTIVE", updatedAt: new Date().toISOString() }
                : sub
            ),
          }));
        }

        get().logActivity(
          "INVOICE",
          "INVOICE_PAID",
          `Marked ${inv.invoiceNumber} ($${inv.total.toFixed(2)}) as PAID for ${org?.name || inv.orgId}`,
          "INFO",
          inv.invoiceNumber
        );
      },

      voidInvoice: (invoiceId) => {
        const inv = get().invoices.find((i) => i.id === invoiceId);
        if (!inv) return;
        set((s) => ({
          invoices: s.invoices.map((i) => (i.id === invoiceId ? { ...i, status: "VOID" } : i)),
        }));
        get().logActivity("INVOICE", "INVOICE_VOIDED", `Voided invoice ${inv.invoiceNumber}`, "WARNING", inv.invoiceNumber);
      },

      updateInvoice: (invoiceId, updates) => {
        const state = get();
        const inv = state.invoices.find((i) => i.id === invoiceId);
        if (!inv) return;

        const nextLineItems: InvoiceLineItem[] = updates.lineItems
          ? updates.lineItems.map((li, idx) => ({
              id: `li-${Date.now()}-${idx}`,
              description: li.description,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              total: Number((li.quantity * li.unitPrice).toFixed(2)),
            }))
          : inv.lineItems;

        const nextTaxRate = updates.taxRate ?? inv.taxRate;
        const subtotal = Number(nextLineItems.reduce((acc, item) => acc + item.total, 0).toFixed(2));
        const taxAmount = Number(((subtotal * nextTaxRate) / 100).toFixed(2));
        const total = Number((subtotal + taxAmount).toFixed(2));
        const nextStatus = updates.status ?? inv.status;

        set((s) => ({
          invoices: s.invoices.map((item) =>
            item.id === invoiceId
              ? {
                  ...item,
                  orgId: updates.orgId ?? item.orgId,
                  dueDate: updates.dueDate ?? item.dueDate,
                  taxRate: nextTaxRate,
                  taxAmount,
                  subtotal,
                  total,
                  status: nextStatus,
                  notes: updates.notes !== undefined ? updates.notes : item.notes,
                  lineItems: nextLineItems,
                  paidAt:
                    nextStatus === "PAID" && !item.paidAt
                      ? new Date().toISOString()
                      : item.paidAt,
                }
              : item
          ),
        }));

        get().logActivity(
          "INVOICE",
          "INVOICE_UPDATED",
          `Updated ${inv.invoiceNumber} ($${total.toFixed(2)})`,
          "INFO",
          inv.invoiceNumber
        );
      },

      deleteInvoice: (invoiceId) => {
        const state = get();
        const inv = state.invoices.find((i) => i.id === invoiceId);
        if (!inv) return;
        set((s) => ({
          invoices: s.invoices.filter((item) => item.id !== invoiceId),
        }));
        get().logActivity(
          "INVOICE",
          "INVOICE_DELETED",
          `Deleted invoice ${inv.invoiceNumber}`,
          "WARNING",
          inv.invoiceNumber
        );
      },

      sendInvoiceReminder: (invoiceId) => {
        const state = get();
        const inv = state.invoices.find((i) => i.id === invoiceId);
        if (!inv) return { ok: false, error: "Invoice not found." };
        const org = state.organizations.find((o) => o.id === inv.orgId);
        if (!org) return { ok: false, error: "Organization not found." };

        const template =
          state.emailTemplates.find((t) =>
            inv.status === "OVERDUE" ? t.key === "PAYMENT_FAILED" : t.key === "INVOICE_RECEIPT"
          ) || state.emailTemplates[0];

        const plan = state.plans.find((p) => p.id === org.planId);
        const subject = template
          ? interpolateTemplate(template.subject, {
              organization_name: org.name,
              invoice_number: inv.invoiceNumber,
              amount: `$${inv.total.toFixed(2)}`,
              due_date: inv.dueDate,
              user_name: org.ownerName,
              plan_name: plan?.name || "ProWise",
            })
          : `Reminder for Invoice ${inv.invoiceNumber}`;

        return get().sendSimulatedEmail({
          recipient: org.ownerEmail,
          subject,
          templateKey: template?.key,
          source: "INVOICE_REMINDER",
          detail: `Simulated invoice notice sent for ${inv.invoiceNumber} ($${inv.total.toFixed(2)})`,
        });
      },

      saveSmtpConfig: (config, newCredentialProvided) => {
        const now = new Date().toISOString();
        set((s) => ({
          smtpConfig: {
            ...s.smtpConfig,
            ...config,
            hasPasswordConfigured: newCredentialProvided ? true : s.smtpConfig.hasPasswordConfigured,
            passwordLastRotatedAt: newCredentialProvided ? now : s.smtpConfig.passwordLastRotatedAt,
            updatedAt: now,
          },
        }));
        get().logActivity(
          "COMMUNICATION",
          newCredentialProvided ? "SMTP_CREDENTIAL_ROTATED" : "SMTP_UPDATED",
          `Updated outbound email gateway settings (${config.provider || get().smtpConfig.provider})`,
          newCredentialProvided ? "WARNING" : "INFO",
          config.host || get().smtpConfig.host
        );
      },

      recordSmtpTestResult: (ok, message) => {
        const now = new Date().toISOString();
        set((s) => ({
          smtpConfig: {
            ...s.smtpConfig,
            connectionStatus: ok ? "CONNECTED" : "FAILED",
            lastTestedAt: now,
            lastTestMessage: message,
          },
        }));
        get().logActivity(
          "COMMUNICATION",
          ok ? "SMTP_TEST_PASSED" : "SMTP_TEST_FAILED",
          message,
          ok ? "INFO" : "WARNING",
          get().smtpConfig.host
        );
      },

      sendSimulatedEmail: ({ recipient, subject, templateKey, source, detail }) => {
        const state = get();
        if (!state.smtpConfig.host || !state.smtpConfig.fromEmail) {
          return { ok: false, error: "Mail server host and sender email must be configured first." };
        }
        const ok = state.smtpConfig.connectionStatus !== "FAILED";
        const logEntry: EmailDeliveryLog = {
          id: `eml-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          recipient,
          subject,
          templateKey,
          source,
          status: ok ? "DELIVERED_SIMULATED" : "FAILED_SIMULATED",
          provider: state.smtpConfig.provider,
          detail: ok ? `${detail} (simulated)` : "Blocked: Mail relay connection check failed",
          sentAt: new Date().toISOString(),
        };
        set((s) => ({ emailLogs: [logEntry, ...s.emailLogs].slice(0, 60) }));
        if (!ok) {
          return { ok: false, error: "Simulated delivery blocked because SMTP connection status is Failed." };
        }
        return { ok: true };
      },

      deleteEmailLogs: (ids) => {
        const idSet = new Set(ids);
        if (idSet.size === 0) return;
        set((s) => ({
          emailLogs: s.emailLogs.filter((entry) => !idSet.has(entry.id)),
        }));
        get().logActivity(
          "COMMUNICATION",
          "EMAIL_LOGS_CLEARED",
          `Removed ${idSet.size} email delivery log entr${idSet.size === 1 ? "y" : "ies"}`,
          "WARNING"
        );
      },

      createEmailTemplate: (input) => {
        const state = get();
        const normalizedKey = input.key.trim().toUpperCase().replace(/[^A-Z0-9_]+/g, "_");
        if (!normalizedKey) return { ok: false, error: "Template identifier is required." };
        if (state.emailTemplates.some((t) => t.key === normalizedKey)) {
          return { ok: false, error: `Template identifier "${normalizedKey}" already exists.` };
        }
        const actor = state.operators.find((o) => o.id === state.activeOperatorId);
        const tpl: EmailTemplate = {
          ...input,
          key: normalizedKey,
          id: `tpl-${Date.now()}`,
          updatedAt: new Date().toISOString(),
          updatedBy: state.accountProfile.name || actor?.name || "Super Admin",
        };
        set({ emailTemplates: [tpl, ...state.emailTemplates] });
        get().logActivity("COMMUNICATION", "TEMPLATE_CREATED", `Created email template "${tpl.name}"`, "INFO", tpl.key);
        return { ok: true };
      },

      updateEmailTemplate: (id, updates) => {
        const state = get();
        set((s) => ({
          emailTemplates: s.emailTemplates.map((t) =>
            t.id === id
              ? {
                  ...t,
                  ...updates,
                  updatedAt: new Date().toISOString(),
                  updatedBy: state.accountProfile.name || "Super Admin",
                }
              : t
          ),
        }));
        const tpl = get().emailTemplates.find((t) => t.id === id);
        if (tpl) {
          get().logActivity("COMMUNICATION", "TEMPLATE_UPDATED", `Updated email template "${tpl.name}"`, "INFO", tpl.key);
        }
      },

      duplicateEmailTemplate: (id) => {
        const existing = get().emailTemplates.find((t) => t.id === id);
        if (!existing) return null;
        const copy: EmailTemplate = {
          ...existing,
          id: `tpl-${Date.now()}`,
          key: `${existing.key}_COPY_${Date.now().toString().slice(-3)}`,
          name: `${existing.name} (Copy)`,
          status: "DRAFT",
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ emailTemplates: [copy, ...s.emailTemplates] }));
        get().logActivity("COMMUNICATION", "TEMPLATE_DUPLICATED", `Duplicated template "${existing.name}"`, "INFO", copy.key);
        return copy;
      },

      deleteEmailTemplate: (id) => {
        const existing = get().emailTemplates.find((t) => t.id === id);
        set((s) => ({ emailTemplates: s.emailTemplates.filter((t) => t.id !== id) }));
        if (existing) {
          get().logActivity("COMMUNICATION", "TEMPLATE_DELETED", `Deleted email template "${existing.name}"`, "WARNING", existing.key);
        }
      },

      sendTestTemplateEmail: (templateId, recipient, sampleVars) => {
        const tpl = get().emailTemplates.find((t) => t.id === templateId);
        if (!tpl) return { ok: false, error: "Template not found." };
        const renderedSubject = `[TEST] ${interpolateTemplate(tpl.subject, sampleVars)}`;
        const result = get().sendSimulatedEmail({
          recipient,
          subject: renderedSubject,
          templateKey: tpl.key,
          source: "TEMPLATE_TEST",
          detail: `Rendered template "${tpl.name}" with sample merge fields`,
        });
        if (result.ok) {
          get().logActivity(
            "COMMUNICATION",
            "TEMPLATE_TEST_SENT",
            `Sent simulated test email for "${tpl.name}" to ${recipient}`,
            "INFO",
            tpl.key
          );
        }
        return result;
      },

      createAnnouncement: (input) => {
        const state = get();
        const now = new Date().toISOString();
        const anc: Announcement = {
          ...input,
          id: `anc-${Date.now()}`,
          createdBy: state.accountProfile.name || "Super Admin",
          createdAt: now,
          updatedAt: now,
          publishedAt: input.status === "PUBLISHED" ? now : undefined,
        };
        set({ announcements: [anc, ...state.announcements] });
        if (anc.status === "PUBLISHED" && anc.channels.includes("EMAIL_BROADCAST")) {
          get().sendSimulatedEmail({
            recipient: `audience:${anc.targetAudience}`,
            subject: `[ProWise Notice] ${anc.title}`,
            source: "ANNOUNCEMENT",
            detail: `Simulated broadcast to ${anc.targetAudience}`,
          });
        }
        get().logActivity(
          "COMMUNICATION",
          `ANNOUNCEMENT_${anc.status}`,
          `${anc.status === "PUBLISHED" ? "Published" : anc.status === "SCHEDULED" ? "Scheduled" : "Saved draft"} announcement "${anc.title}"`,
          anc.type === "CRITICAL" ? "WARNING" : "INFO",
          anc.id
        );
        return anc;
      },

      updateAnnouncement: (id, updates) => {
        const now = new Date().toISOString();
        set((s) => ({
          announcements: s.announcements.map((a) => (a.id === id ? { ...a, ...updates, updatedAt: now } : a)),
        }));
        const anc = get().announcements.find((a) => a.id === id);
        if (anc) {
          get().logActivity("COMMUNICATION", "ANNOUNCEMENT_UPDATED", `Updated announcement "${anc.title}"`, "INFO", anc.id);
        }
      },

      publishAnnouncement: (id) => {
        const anc = get().announcements.find((a) => a.id === id);
        if (!anc) return;
        const now = new Date().toISOString();
        set((s) => ({
          announcements: s.announcements.map((a) =>
            a.id === id ? { ...a, status: "PUBLISHED", publishedAt: now, updatedAt: now } : a
          ),
        }));
        if (anc.channels.includes("EMAIL_BROADCAST")) {
          get().sendSimulatedEmail({
            recipient: `audience:${anc.targetAudience}`,
            subject: `[ProWise Notice] ${anc.title}`,
            source: "ANNOUNCEMENT",
            detail: `Simulated broadcast on publish`,
          });
        }
        get().logActivity("COMMUNICATION", "ANNOUNCEMENT_PUBLISHED", `Published announcement "${anc.title}"`, "INFO", anc.id);
      },

      unpublishAnnouncement: (id) => {
        const anc = get().announcements.find((a) => a.id === id);
        if (!anc) return;
        set((s) => ({
          announcements: s.announcements.map((a) =>
            a.id === id ? { ...a, status: "ARCHIVED", updatedAt: new Date().toISOString() } : a
          ),
        }));
        get().logActivity("COMMUNICATION", "ANNOUNCEMENT_UNPUBLISHED", `Unpublished announcement "${anc.title}"`, "INFO", anc.id);
      },

      deleteAnnouncement: (id) => {
        const anc = get().announcements.find((a) => a.id === id);
        set((s) => ({ announcements: s.announcements.filter((a) => a.id !== id) }));
        if (anc) {
          get().logActivity("COMMUNICATION", "ANNOUNCEMENT_DELETED", `Deleted announcement "${anc.title}"`, "WARNING", anc.id);
        }
      },

      // Integrations & API Governance
      toggleIntegrationEnabled: (id) => {
        const target = get().integrations.find((i) => i.id === id);
        if (!target) return;
        const nextEnabled = !target.enabled;
        set((s) => ({
          integrations: s.integrations.map((i) =>
            i.id === id
              ? {
                  ...i,
                  enabled: nextEnabled,
                  healthStatus: nextEnabled ? "Healthy" : "Disabled",
                  lastCheckedAt: new Date().toISOString(),
                }
              : i
          ),
        }));
        get().logActivity(
          "INTEGRATION",
          nextEnabled ? "INTEGRATION_ENABLED" : "INTEGRATION_DISABLED",
          `${nextEnabled ? "Enabled" : "Disabled"} integration "${target.name}"`,
          nextEnabled ? "INFO" : "WARNING",
          target.key
        );
      },

      updateIntegrationSettings: (id, updates, rotatedCredential) => {
        const now = new Date().toISOString();
        set((s) => ({
          integrations: s.integrations.map((i) =>
            i.id === id
              ? {
                  ...i,
                  ...updates,
                  credentialConfigured: rotatedCredential ? true : i.credentialConfigured,
                  credentialUpdatedAt: rotatedCredential ? now : i.credentialUpdatedAt,
                  lastCheckedAt: now,
                }
              : i
          ),
        }));
        const target = get().integrations.find((i) => i.id === id);
        if (target) {
          get().logActivity(
            "INTEGRATION",
            rotatedCredential ? "INTEGRATION_CREDENTIAL_ROTATED" : "INTEGRATION_CONFIGURED",
            `${rotatedCredential ? "Rotated credential and updated" : "Updated"} settings for ${target.name}`,
            rotatedCredential ? "WARNING" : "INFO",
            target.key
          );
        }
      },

      testIntegrationConnection: (id) => {
        const target = get().integrations.find((i) => i.id === id);
        if (!target) return { ok: false, message: "Integration not found." };
        if (!target.enabled) {
          return { ok: false, message: `${target.name} is currently disabled. Enable it before testing.` };
        }
        const now = new Date().toISOString();
        const message = `${target.name} connectivity verified successfully (simulated).`;
        set((s) => ({
          integrations: s.integrations.map((i) =>
            i.id === id ? { ...i, healthStatus: "Healthy", lastCheckedAt: now, lastTestSummary: message } : i
          ),
        }));
        get().logActivity("INTEGRATION", "INTEGRATION_TESTED", message, "INFO", target.key);
        return { ok: true, message };
      },

      toggleGitHubSyncPause: (id) => {
        const target = get().githubInstallations.find((g) => g.id === id);
        if (!target) return;
        const nextStatus = target.syncStatus === "Paused" ? "Healthy" : "Paused";
        set((s) => ({
          githubInstallations: s.githubInstallations.map((g) =>
            g.id === id
              ? { ...g, syncStatus: nextStatus, lastSyncedAt: new Date().toISOString() }
              : g
          ),
        }));
        get().logActivity(
          "INTEGRATION",
          nextStatus === "Paused" ? "GITHUB_SYNC_PAUSED" : "GITHUB_SYNC_RESUMED",
          `${nextStatus === "Paused" ? "Paused" : "Resumed"} GitHub App governance sync for ${target.orgName}`,
          "WARNING",
          target.githubAccount
        );
      },

      syncGitHubInstallations: () => {
        const now = new Date().toISOString();
        set((s) => ({
          githubInstallations: s.githubInstallations.map((g) =>
            g.syncStatus === "Attention Needed"
              ? { ...g, syncStatus: "Healthy", rateLimitUsed: Math.min(g.rateLimitUsed, 500), lastSyncedAt: now }
              : g.syncStatus === "Healthy"
              ? { ...g, lastSyncedAt: now }
              : g
          ),
        }));
        get().logActivity("INTEGRATION", "GITHUB_STATE_SYNCED", "Refreshed GitHub App installation statuses (simulated)", "INFO");
      },

      retryWebhookEvent: (id) => {
        const target = get().webhookEvents.find((w) => w.id === id);
        if (!target) return;
        set((s) => ({
          webhookEvents: s.webhookEvents.map((w) =>
            w.id === id
              ? {
                  ...w,
                  status: "Delivered",
                  httpCode: 200,
                  attempts: w.attempts + 1,
                  summary: `${w.summary} (Simulated retry succeeded)`,
                }
              : w
          ),
        }));
        get().logActivity(
          "INTEGRATION",
          "WEBHOOK_RETRIED",
          `Retried webhook event ${target.eventRef} (${target.orgName}) — Delivered`,
          "INFO",
          target.eventRef
        );
      },

      createApiAlertRule: (input) => {
        const rule: ApiAlertRule = {
          ...input,
          id: `alrt-${Date.now()}`,
          status: "Normal",
          updatedAt: new Date().toISOString(),
        };
        set((s) => ({ apiAlertRules: [rule, ...s.apiAlertRules] }));
        get().logActivity("INTEGRATION", "API_ALERT_CREATED", `Created API alert rule "${rule.name}"`, "INFO", rule.name);
      },

      toggleApiAlertRule: (id) => {
        const target = get().apiAlertRules.find((r) => r.id === id);
        if (!target) return;
        set((s) => ({
          apiAlertRules: s.apiAlertRules.map((r) =>
            r.id === id
              ? { ...r, enabled: !r.enabled, status: !r.enabled ? r.status : "Normal", updatedAt: new Date().toISOString() }
              : r
          ),
        }));
        get().logActivity(
          "INTEGRATION",
          "API_ALERT_TOGGLED",
          `${!target.enabled ? "Enabled" : "Disabled"} API threshold rule "${target.name}"`,
          "INFO",
          target.name
        );
      },

      deleteApiAlertRule: (id) => {
        const target = get().apiAlertRules.find((r) => r.id === id);
        set((s) => ({ apiAlertRules: s.apiAlertRules.filter((r) => r.id !== id) }));
        if (target) {
          get().logActivity("INTEGRATION", "API_ALERT_DELETED", `Removed API alert rule "${target.name}"`, "WARNING", target.name);
        }
      },

      // Security & Governance
      updateSecurityAlertStatus: (id, status) => {
        const target = get().securityAlerts.find((a) => a.id === id);
        set((s) => ({
          securityAlerts: s.securityAlerts.map((a) => (a.id === id ? { ...a, status } : a)),
        }));
        if (target) {
          get().logActivity("SECURITY", "SECURITY_ALERT_UPDATED", `Marked security alert "${target.title}" as ${status}`, "INFO", target.affectedTarget);
        }
      },

      toggleSecurityPolicy: (id) => {
        const target = get().securityPolicies.find((p) => p.id === id);
        if (!target) return;
        set((s) => ({
          securityPolicies: s.securityPolicies.map((p) =>
            p.id === id ? { ...p, enabled: !p.enabled, updatedAt: new Date().toISOString() } : p
          ),
        }));
        get().logActivity(
          "SECURITY",
          "SECURITY_POLICY_TOGGLED",
          `${!target.enabled ? "Enabled" : "Paused"} security policy "${target.title}"`,
          "WARNING",
          target.title
        );
      },

      requestSupportAccess: ({ operatorName, operatorEmail, targetOrgId, ticketRef, reason, expiresInHours }) => {
        const org = get().organizations.find((o) => o.id === targetOrgId);
        const req: AccessApprovalRequest = {
          id: `appr-${Date.now()}`,
          operatorName,
          operatorEmail,
          targetOrgId,
          targetOrgName: org?.name || targetOrgId,
          ticketRef: ticketRef.trim().toUpperCase(),
          reason: reason.trim(),
          requestedAt: new Date().toISOString(),
          expiresInHours,
          status: "PENDING",
        };
        set((s) => ({ accessApprovals: [req, ...s.accessApprovals] }));
        get().logActivity(
          "SECURITY",
          "ACCESS_REQUEST_SUBMITTED",
          `Logged support access request ${req.ticketRef} for ${req.targetOrgName}`,
          "INFO",
          req.ticketRef
        );
      },

      decideAccessApproval: (id, decision, customHours) => {
        const target = get().accessApprovals.find((a) => a.id === id);
        const reviewer = get().accountProfile.name || "Arthur Pendelton";
        set((s) => ({
          accessApprovals: s.accessApprovals.map((a) =>
            a.id === id
              ? {
                  ...a,
                  status: decision,
                  expiresInHours: customHours ?? a.expiresInHours,
                  reviewedBy: reviewer,
                  reviewedAt: new Date().toISOString(),
                }
              : a
          ),
        }));
        if (target) {
          get().logActivity(
            "SECURITY",
            `ACCESS_REQUEST_${decision}`,
            `${decision === "APPROVED" ? "Approved" : "Denied"} support access for ${target.operatorName} on ${target.targetOrgName}`,
            decision === "APPROVED" ? "WARNING" : "INFO",
            target.ticketRef
          );
        }
      },

      revokeAccessApproval: (id) => {
        const target = get().accessApprovals.find((a) => a.id === id);
        const reviewer = get().accountProfile.name || "Arthur Pendelton";
        set((s) => ({
          accessApprovals: s.accessApprovals.map((a) =>
            a.id === id ? { ...a, status: "REVOKED", reviewedBy: reviewer, reviewedAt: new Date().toISOString() } : a
          ),
        }));
        if (target) {
          get().logActivity(
            "SECURITY",
            "ACCESS_REVOKED",
            `Revoked active support access (${target.ticketRef}) for ${target.operatorName}`,
            "CRITICAL",
            target.ticketRef
          );
        }
      },

      createIncident: (input) => {
        const state = get();
        const now = new Date().toISOString();
        const inc: IncidentGovernanceItem = {
          ...input,
          id: `inc-${Date.now()}`,
          incidentCode: `INC-2026-${String(42 + state.incidents.length).padStart(3, "0")}`,
          createdAt: now,
          updatedAt: now,
        };
        set({ incidents: [inc, ...state.incidents] });
        get().logActivity(
          "SECURITY",
          "INCIDENT_DECLARED",
          `Declared ${inc.severity} incident ${inc.incidentCode}: ${inc.title}`,
          inc.severity === "Critical" ? "CRITICAL" : "WARNING",
          inc.incidentCode
        );
      },

      updateIncident: (id, updates) => {
        const target = get().incidents.find((i) => i.id === id);
        set((s) => ({
          incidents: s.incidents.map((i) =>
            i.id === id ? { ...i, ...updates, updatedAt: new Date().toISOString() } : i
          ),
        }));
        if (target) {
          get().logActivity(
            "SECURITY",
            "INCIDENT_UPDATED",
            `Updated incident ${target.incidentCode} (${updates.status || target.status})`,
            updates.status === "Resolved" ? "INFO" : "WARNING",
            target.incidentCode
          );
        }
      },

      // Platform Management
      savePolicySettings: (updates) => {
        set((s) => ({
          policySettings: { ...s.policySettings, ...updates, updatedAt: new Date().toISOString() },
        }));
        get().logActivity("PLATFORM", "PLATFORM_CONFIG_UPDATED", "Updated global system limits and governance policies", "INFO");
      },

      toggleFeatureFlag: (flagId) => {
        const flag = get().policySettings.featureFlags.find((f) => f.id === flagId);
        if (!flag) return;
        set((s) => ({
          policySettings: {
            ...s.policySettings,
            featureFlags: s.policySettings.featureFlags.map((f) =>
              f.id === flagId ? { ...f, enabled: !f.enabled } : f
            ),
            updatedAt: new Date().toISOString(),
          },
        }));
        get().logActivity(
          "PLATFORM",
          "FEATURE_FLAG_TOGGLED",
          `${!flag.enabled ? "Enabled" : "Disabled"} feature "${flag.label}"`,
          "INFO",
          flag.id
        );
      },

      saveBrandingPrefs: (updates) => {
        set((s) => ({
          brandingPrefs: { ...s.brandingPrefs, ...updates, updatedAt: new Date().toISOString() },
        }));
        get().logActivity("PLATFORM", "PLATFORM_PREFERENCES_SAVED", "Updated platform branding and localization preferences", "INFO");
      },

      createSupportTicket: ({ orgId, subject, description, priority, assignedOperatorId, requesterEmail }) => {
        const state = get();
        const org = state.organizations.find((o) => o.id === orgId);
        const now = new Date().toISOString();
        const ticket: SupportEscalationTicket = {
          id: `sup-${Date.now()}`,
          ticketNumber: `SUP-${1043 + state.supportTickets.length}`,
          orgId,
          orgName: org?.name || orgId,
          subject: subject.trim(),
          description: description.trim(),
          priority,
          status: "Open",
          assignedOperatorId,
          slaTargetMinutes: priority === "Critical" ? 30 : priority === "High" ? 60 : 180,
          slaState: "On Track",
          requesterEmail: requesterEmail.trim(),
          createdAt: now,
          updatedAt: now,
        };
        set({ supportTickets: [ticket, ...state.supportTickets] });
        get().logActivity("PLATFORM", "SUPPORT_TICKET_CREATED", `Logged escalation ${ticket.ticketNumber} for ${ticket.orgName}`, "INFO", ticket.ticketNumber);
      },

      updateSupportTicket: (id, updates) => {
        const target = get().supportTickets.find((t) => t.id === id);
        set((s) => ({
          supportTickets: s.supportTickets.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        }));
        if (target) {
          get().logActivity(
            "PLATFORM",
            "SUPPORT_TICKET_UPDATED",
            `Updated support escalation ${target.ticketNumber} (${updates.status || target.status})`,
            updates.status === "Escalated" ? "WARNING" : "INFO",
            target.ticketNumber
          );
        }
      },

      // Super Admin Personal Account
      updateAccountProfile: (updates) => {
        set((s) => ({
          accountProfile: { ...s.accountProfile, ...updates },
        }));
        get().logActivity("SECURITY", "ADMIN_PROFILE_UPDATED", "Updated Super Admin account profile", "INFO");
      },

      changeAccountPassword: () => {
        set((s) => ({
          accountProfile: { ...s.accountProfile, passwordLastChangedAt: new Date().toISOString() },
        }));
        get().logActivity("SECURITY", "ADMIN_PASSWORD_CHANGED", "Completed Super Admin password rotation (simulated)", "WARNING");
      },

      toggleAccountMfa: (method) => {
        const current = get().accountProfile;
        const nextEnabled = !current.mfaEnabled;
        set((s) => ({
          accountProfile: {
            ...s.accountProfile,
            mfaEnabled: nextEnabled,
            mfaMethod: method || s.accountProfile.mfaMethod,
          },
        }));
        get().logActivity(
          "SECURITY",
          nextEnabled ? "ADMIN_MFA_ENABLED" : "ADMIN_MFA_DISABLED",
          `${nextEnabled ? "Enabled" : "Disabled"} multi-factor authentication on Super Admin account`,
          nextEnabled ? "INFO" : "CRITICAL"
        );
      },

      revokeAdminSession: (sessionId) => {
        const sess = get().accountProfile.sessions.find((s) => s.id === sessionId);
        set((s) => ({
          accountProfile: {
            ...s.accountProfile,
            sessions: s.accountProfile.sessions.filter((item) => item.id !== sessionId),
          },
        }));
        if (sess) {
          get().logActivity("SECURITY", "SESSION_REVOKED", `Signed out remote session on ${sess.device} (${sess.location})`, "WARNING", sess.device);
        }
      },

      updateAccountNotifications: (updates) => {
        set((s) => ({
          accountProfile: {
            ...s.accountProfile,
            notifications: { ...s.accountProfile.notifications, ...updates },
          },
        }));
        get().logActivity("SECURITY", "NOTIFICATION_PREFS_UPDATED", "Updated Super Admin alert preferences", "INFO");
      },

      resetAllData: () => {
        set(getInitialSnapshot());
      },
    }),
    {
      name: "prowise-super-admin-store-v2",
      skipHydration: true,
      partialize: (state) => ({
        organizations: state.organizations,
        operators: state.operators,
        roles: state.roles,
        plans: state.plans,
        subscriptions: state.subscriptions,
        payments: state.payments,
        invoices: state.invoices,
        smtpConfig: state.smtpConfig,
        emailLogs: state.emailLogs,
        emailTemplates: state.emailTemplates,
        announcements: state.announcements,
        activities: state.activities,
        integrations: state.integrations,
        githubInstallations: state.githubInstallations,
        webhookEvents: state.webhookEvents,
        apiAlertRules: state.apiAlertRules,
        securityAlerts: state.securityAlerts,
        securityPolicies: state.securityPolicies,
        accessApprovals: state.accessApprovals,
        incidents: state.incidents,
        policySettings: state.policySettings,
        brandingPrefs: state.brandingPrefs,
        supportTickets: state.supportTickets,
        accountProfile: state.accountProfile,
        activeRoleId: state.activeRoleId,
        activeOperatorId: state.activeOperatorId,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);

export function useAdminPermissions() {
  const roles = useSuperAdminStore((s) => s.roles);
  const activeRoleId = useSuperAdminStore((s) => s.activeRoleId);
  const activeRole = roles.find((r) => r.id === activeRoleId) || roles[0];

  const can = (permission: PermissionKey): boolean => {
    if (!activeRole) return false;
    return activeRole.permissions.includes(permission);
  };

  return {
    activeRole,
    permissions: activeRole?.permissions || [],
    can,
  };
}
