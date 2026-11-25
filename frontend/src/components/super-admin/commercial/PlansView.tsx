"use client";

import React, { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Check, Edit3, Layers, Plus, RefreshCw, Sparkles, Trash2, Users, X } from "lucide-react";
import type { CommercialPlan, CommercialSubscription, CreatePlanBody, UpdatePlanBody } from "@/types/admin-commercial";
import {
  AdminButton,
  AdminInput,
  EmptyStateView,
  ErrorBanner,
  PageHeader,
  StatusBadge,
  SurfaceCard,
  TableSkeleton,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { BillingDormantNotice, formatMoney, type ResourceState } from "../admin-resource";
import { flag } from "../resource-columns";
import {
  Checkbox,
  CommercialFormModal,
  fieldError,
  optionalText,
  parseOptionalNumber,
  type FieldErrors,
  type MutationFailure,
} from "./mutation";

/* ---------------------------------------------------------------- brand themes (from the stored brand_color) */

export const PLAN_BRAND_COLORS = ["sky", "blue", "violet", "emerald", "amber", "rose"] as const;

const THEMES: Record<string, { stripe: string; badge: string; border: string; ring: string; swatch: string }> = {
  sky: { stripe: "bg-sky-500", badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30", border: "border-sky-500/40", ring: "ring-1 ring-sky-500/35", swatch: "bg-sky-500" },
  blue: { stripe: "bg-blue-500", badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30", border: "border-blue-500/40", ring: "ring-1 ring-blue-500/35", swatch: "bg-blue-500" },
  violet: { stripe: "bg-violet-500", badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30", border: "border-violet-500/40", ring: "ring-1 ring-violet-500/35", swatch: "bg-violet-500" },
  emerald: { stripe: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30", border: "border-emerald-500/40", ring: "ring-1 ring-emerald-500/35", swatch: "bg-emerald-500" },
  amber: { stripe: "bg-amber-500", badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30", border: "border-amber-500/40", ring: "ring-1 ring-amber-500/35", swatch: "bg-amber-500" },
  rose: { stripe: "bg-rose-500", badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30", border: "border-rose-500/40", ring: "ring-1 ring-rose-500/35", swatch: "bg-rose-500" },
  neutral: { stripe: "bg-slate-400", badge: "bg-[var(--color-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)]", border: "border-[var(--color-border)]", ring: "", swatch: "bg-slate-400" },
};

export function planTheme(plan: Pick<CommercialPlan, "brand_color">) {
  return THEMES[plan.brand_color ?? ""] ?? THEMES.neutral;
}

export function isPlanPopular(plan: CommercialPlan): boolean {
  return flag(plan as unknown as Record<string, unknown>, "is_popular", "popular");
}

/* ---------------------------------------------------------------- view */

export type BillingView = "MONTHLY" | "ANNUAL";

export interface PlansViewProps {
  state: ResourceState<CommercialPlan[]>;
  /** Used only to count each plan's stored subscriptions; while unavailable no count is shown. */
  subscriptions: ResourceState<CommercialSubscription[]>;
  billingView: BillingView;
  showArchived: boolean;
  onBillingViewChange: (v: BillingView) => void;
  onToggleArchived: () => void;
  onRetry: () => void;
  onCreate: () => void;
  onEdit: (plan: CommercialPlan) => void;
  onArchive: (plan: CommercialPlan) => void;
  onDelete: (plan: CommercialPlan) => void;
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5 min-w-0">
      <span className="text-[var(--color-text-muted)] block">{label}</span>
      <strong className="text-[var(--color-text-primary)] truncate block">{value}</strong>
    </div>
  );
}

const limitText = (n: number | null | undefined, suffix = "") =>
  n === null || n === undefined ? "Not set" : `${n.toLocaleString()}${suffix}`;

export function PlansView(props: PlansViewProps) {
  const { state, subscriptions, billingView, showArchived, onBillingViewChange, onToggleArchived, onRetry, onCreate, onEdit, onArchive, onDelete } =
    props;
  const plans = state.status === "ready" ? state.data : [];
  const visible = plans.filter((p) => showArchived || p.status !== "ARCHIVED");
  const archivedCount = plans.filter((p) => p.status === "ARCHIVED").length;
  const subs = subscriptions.status === "ready" ? subscriptions.data : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Commercial Plans"
        description="Pricing, quotas, brand colour and feature entitlements of each plan stored on the server."
        badge={state.status === "ready" ? `${plans.length} plan${plans.length === 1 ? "" : "s"}` : undefined}
        actions={
          <>
            <div role="group" aria-label="Price view" className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-xs">
              {(["MONTHLY", "ANNUAL"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={billingView === mode}
                  onClick={() => onBillingViewChange(mode)}
                  className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                    billingView === mode
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {mode === "MONTHLY" ? "Monthly" : "Annual"}
                </button>
              ))}
            </div>
            <AdminButton variant="outline" size="sm" onClick={onToggleArchived}>
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? "Hide Archived" : `Show Archived${state.status === "ready" ? ` (${archivedCount})` : ""}`}
            </AdminButton>
            <AdminButton variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={onCreate}>
              <Plus className="w-3.5 h-3.5" />
              Create Plan
            </AdminButton>
          </>
        }
      />

      <BillingDormantNotice editable />

      {state.status === "loading" && (
        <div role="status" aria-label="Loading">
          <TableSkeleton rows={3} />
        </div>
      )}
      {state.status === "error" && <ErrorBanner message={state.message} onRetry={onRetry} />}
      {state.status === "ready" && visible.length === 0 && (
        <SurfaceCard className="p-6">
          <EmptyStateView
            icon={Layers}
            title={plans.length === 0 ? "No plans stored" : "Only archived plans"}
            description={
              plans.length === 0
                ? "The server has no plan records. Create one to assign subscriptions."
                : "Every stored plan is archived. Use Show Archived to see them."
            }
            actionLabel={plans.length === 0 ? "Create Plan" : undefined}
            onAction={plans.length === 0 ? onCreate : undefined}
          />
        </SurfaceCard>
      )}

      {visible.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {visible.map((plan) => {
            const theme = planTheme(plan);
            const popular = isPlanPopular(plan);
            const highlight = plan.badge_label || (popular ? "Popular" : "");
            const price = billingView === "ANNUAL" ? plan.annual_price : plan.monthly_price;
            const monthly = plan.monthly_price ?? null;
            const annual = plan.annual_price ?? null;
            const savePct =
              monthly !== null && annual !== null && monthly > 0 ? Math.round(((monthly * 12 - annual) / (monthly * 12)) * 100) : 0;
            const linked = subs ? subs.filter((s) => s.plan_id === plan.id && s.status !== "CANCELLED").length : null;
            const archived = plan.status === "ARCHIVED";
            return (
              <SurfaceCard
                key={plan.id}
                className={`p-5 pt-6 flex flex-col justify-between gap-4 relative overflow-hidden ${theme.border} ${highlight ? theme.ring : ""} ${archived ? "opacity-70" : ""}`}
              >
                <span className={`absolute inset-x-0 top-0 h-1 ${theme.stripe}`} aria-hidden="true" />
                <div className="space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${theme.badge}`}>{plan.code}</span>
                      {highlight && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-300">
                          <Sparkles className="w-2.5 h-2.5" /> {highlight}
                        </span>
                      )}
                      {archived && <StatusBadge label="Archived" tone="neutral" />}
                    </div>
                    <h3 className="text-base font-bold text-[var(--color-text-primary)] mt-1.5">{plan.name}</h3>
                    {plan.tagline && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{plan.tagline}</p>}
                  </div>

                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold text-[var(--color-text-primary)]">{formatMoney(price, plan.currency)}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">/{billingView === "ANNUAL" ? "year" : "mo"}</span>
                      </div>
                      {savePct > 0 && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Save {savePct}% yearly
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                      {billingView === "ANNUAL"
                        ? `Monthly plan: ${formatMoney(monthly, plan.currency)}/mo`
                        : `Annual plan: ${formatMoney(annual, plan.currency)}/yr`}
                    </p>
                    <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-500" />
                        {linked === null ? "Subscriptions: -" : `${linked} subscription${linked === 1 ? "" : "s"}`}
                      </span>
                      <span>{plan.trial_days > 0 ? `${plan.trial_days}-day trial` : "No trial"}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <Tile label="Seats" value={limitText(plan.limits?.max_seats)} />
                    <Tile label="Projects" value={limitText(plan.limits?.max_projects)} />
                    <Tile label="Storage" value={limitText(plan.limits?.storage_gb, " GB")} />
                    <Tile label="API RPM" value={limitText(plan.limits?.api_rate_limit_per_min)} />
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-[var(--color-border)]">
                    {(plan.features ?? []).length === 0 ? (
                      <p className="text-xs text-[var(--color-text-muted)]">No features listed.</p>
                    ) : (
                      (plan.features ?? []).map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
                  <AdminButton variant="outline" size="xs" className="flex-1" onClick={() => onEdit(plan)}>
                    <Edit3 className="w-3.5 h-3.5" /> Customize
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    size="xs"
                    onClick={() => onArchive(plan)}
                    title={archived ? "Restore plan" : "Archive plan"}
                    aria-label={archived ? `Restore ${plan.name}` : `Archive ${plan.name}`}
                  >
                    {archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    {archived ? "Restore" : "Archive"}
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    size="xs"
                    className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                    onClick={() => onDelete(plan)}
                    title="Delete plan"
                    aria-label={`Delete ${plan.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </AdminButton>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- create / customize form */

export interface PlanFormValues {
  name: string;
  code: string;
  tagline: string;
  monthly_price: string;
  annual_price: string;
  trial_days: string;
  badge_label: string;
  is_popular: boolean;
  brand_color: string;
  ai_token_quota: string;
  max_seats: string;
  max_projects: string;
  max_workspaces: string;
  storage_gb: string;
  api_rate_limit_per_min: string;
  features: string[];
}

export function planFormValues(plan: CommercialPlan | null): PlanFormValues {
  const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
  return {
    name: plan?.name ?? "",
    code: plan?.code ?? "",
    tagline: plan?.tagline ?? "",
    monthly_price: s(plan?.monthly_price),
    annual_price: s(plan?.annual_price),
    trial_days: plan ? String(plan.trial_days ?? 0) : "0",
    badge_label: plan?.badge_label ?? "",
    is_popular: plan ? isPlanPopular(plan) : false,
    brand_color: plan?.brand_color ?? "blue",
    ai_token_quota: plan?.ai_token_quota ?? "",
    max_seats: s(plan?.limits?.max_seats),
    max_projects: s(plan?.limits?.max_projects),
    max_workspaces: s(plan?.limits?.max_workspaces),
    storage_gb: s(plan?.limits?.storage_gb),
    api_rate_limit_per_min: s(plan?.limits?.api_rate_limit_per_min),
    features: [...(plan?.features ?? [])],
  };
}

const LIMIT_FIELDS = ["max_seats", "max_projects", "max_workspaces", "storage_gb", "api_rate_limit_per_min"] as const;

/**
 * Starting points for the Create Plan form only. Nothing is stored until the Super Admin reviews the filled form and
 * clicks Create; these are never inserted automatically.
 */
export const PLAN_TEMPLATES: readonly { key: string; label: string; values: Omit<PlanFormValues, "features"> & { features: readonly string[] } }[] = [
  {
    key: "free",
    label: "Free Sandbox",
    values: {
      name: "Free Sandbox", code: "FREE", tagline: "Evaluation workspace for small delivery trials",
      monthly_price: "0", annual_price: "0", trial_days: "0", badge_label: "", is_popular: false, brand_color: "sky",
      ai_token_quota: "", max_seats: "5", max_projects: "3", max_workspaces: "1", storage_gb: "5", api_rate_limit_per_min: "120",
      features: ["Up to 3 active projects", "Individual & structured modes", "7-day audit log retention", "Community forum support"],
    },
  },
  {
    key: "starter",
    label: "Starter",
    values: {
      name: "Starter", code: "STARTER", tagline: "For boutique engineering consultancies & startups",
      monthly_price: "499", annual_price: "4990", trial_days: "14", badge_label: "", is_popular: false, brand_color: "blue",
      ai_token_quota: "", max_seats: "25", max_projects: "15", max_workspaces: "3", storage_gb: "50", api_rate_limit_per_min: "600",
      features: ["Up to 25 active seats", "15 concurrent delivery projects", "GitHub App commit & PR sync", "90-day immutable audit retention", "Standard email support (8h SLA)"],
    },
  },
  {
    key: "professional",
    label: "Professional",
    values: {
      name: "Professional", code: "PROFESSIONAL", tagline: "For scaling venture-backed engineering organizations",
      monthly_price: "1299", annual_price: "12990", trial_days: "14", badge_label: "", is_popular: true, brand_color: "violet",
      ai_token_quota: "", max_seats: "100", max_projects: "60", max_workspaces: "10", storage_gb: "250", api_rate_limit_per_min: "2400",
      features: ["Up to 100 active seats", "Unlimited GitHub repositories", "Scope baseline change-control", "Priority SLA (2h response)", "Safe CSV & executive exports"],
    },
  },
  {
    key: "enterprise",
    label: "Enterprise",
    values: {
      name: "Enterprise", code: "ENTERPRISE", tagline: "For regulated healthcare & financial institutions",
      monthly_price: "4999", annual_price: "49990", trial_days: "30", badge_label: "", is_popular: false, brand_color: "amber",
      ai_token_quota: "", max_seats: "500", max_projects: "250", max_workspaces: "50", storage_gb: "2000", api_rate_limit_per_min: "10000",
      features: ["Up to 500 seats & 50 workspaces", "Dedicated tenant encryption keys", "Enterprise SSO & directory sync", "HIPAA & SOC 2 Type II compliance pack", "15-minute 24/7 incident SLA"],
    },
  },
];

/** Client checks matching the backend (name required, unique code, numeric fields); the server re-checks all. */
export function validatePlanForm(v: PlanFormValues, isCreate: boolean): FieldErrors {
  const errors: FieldErrors = {};
  if (!v.name.trim()) errors.name = "Plan name is required.";
  if (isCreate && v.code.trim() && !/^[A-Za-z0-9_]+$/.test(v.code.trim())) {
    errors.code = "Use letters, digits and underscores only.";
  }
  for (const key of ["monthly_price", "annual_price"] as const) {
    const n = parseOptionalNumber(v[key]);
    if (n !== null && (Number.isNaN(n) || n < 0)) errors[key] = "Enter a price of 0 or more.";
  }
  const trial = parseOptionalNumber(v.trial_days);
  if (trial !== null && (!Number.isInteger(trial) || trial < 0)) errors.trial_days = "Whole days, 0 or more.";
  const anyLimit = LIMIT_FIELDS.some((k) => v[k].trim() !== "");
  for (const key of LIMIT_FIELDS) {
    const n = parseOptionalNumber(v[key]);
    if (anyLimit && n === null) errors[key] = "Required when any limit is set.";
    else if (n !== null && (!Number.isInteger(n) || n < 0)) errors[key] = "Whole number, 0 or more.";
  }
  return errors;
}

export function planBodyFromForm(v: PlanFormValues): CreatePlanBody {
  const anyLimit = LIMIT_FIELDS.some((k) => v[k].trim() !== "");
  return {
    code: optionalText(v.code)?.toUpperCase() ?? null,
    name: v.name.trim(),
    tagline: optionalText(v.tagline),
    monthly_price: parseOptionalNumber(v.monthly_price),
    annual_price: parseOptionalNumber(v.annual_price),
    trial_days: parseOptionalNumber(v.trial_days),
    badge_label: optionalText(v.badge_label),
    is_popular: v.is_popular,
    brand_color: v.brand_color,
    ai_token_quota: optionalText(v.ai_token_quota),
    limits: anyLimit
      ? {
          max_seats: Number(v.max_seats),
          max_projects: Number(v.max_projects),
          max_workspaces: Number(v.max_workspaces),
          storage_gb: Number(v.storage_gb),
          api_rate_limit_per_min: Number(v.api_rate_limit_per_min),
        }
      : null,
    features: v.features.map((f) => f.trim()).filter(Boolean),
  };
}

/** The update body: everything but the code (immutable on the server). */
export function planUpdateBody(body: CreatePlanBody): UpdatePlanBody {
  return {
    name: body.name,
    tagline: body.tagline,
    monthly_price: body.monthly_price,
    annual_price: body.annual_price,
    is_popular: body.is_popular,
    badge_label: body.badge_label,
    brand_color: body.brand_color,
    ai_token_quota: body.ai_token_quota,
    trial_days: body.trial_days,
    limits: body.limits,
    features: body.features,
  };
}

export function PlanFormModal({
  isOpen,
  plan,
  busy,
  failure,
  onReload,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  /** null = create a new plan. */
  plan: CommercialPlan | null;
  busy: boolean;
  failure: MutationFailure | null;
  onReload: () => void;
  onClose: () => void;
  onSubmit: (body: CreatePlanBody) => void;
}) {
  const [v, setV] = useState<PlanFormValues>(() => planFormValues(plan));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [feature, setFeature] = useState("");

  useEffect(() => {
    if (isOpen) {
      setV(planFormValues(plan));
      setErrors({});
      setFeature("");
    }
  }, [isOpen, plan]);

  const set = <K extends keyof PlanFormValues>(key: K, value: PlanFormValues[K]) => setV((prev) => ({ ...prev, [key]: value }));
  const err = (field: string) => fieldError(failure, errors, field);
  const addFeature = () => {
    const f = feature.trim();
    if (!f) return;
    set("features", [...v.features, f]);
    setFeature("");
  };

  return (
    <CommercialFormModal
      isOpen={isOpen}
      title={plan ? `Customize ${plan.name}` : "Create Plan"}
      description="Pricing, quotas, brand colour and features. The server validates every value again."
      maxWidth="2xl"
      busy={busy}
      failure={failure}
      onReload={onReload}
      onClose={onClose}
      submitLabel={plan ? "Save Plan" : "Create Plan"}
      onSubmit={() => {
        const found = validatePlanForm(v, !plan);
        setErrors(found);
        if (Object.keys(found).length === 0) onSubmit(planBodyFromForm(v));
      }}
    >
      {!plan && (
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-3 space-y-2">
          <p className="text-xs font-medium text-[var(--color-text-secondary)]">
            Start from a template (fills the form; nothing is saved until you click Create Plan)
          </p>
          <div className="flex flex-wrap gap-2">
            {PLAN_TEMPLATES.map((t) => (
              <AdminButton
                key={t.key}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setV({ ...t.values, features: [...t.values.features] });
                  setErrors({});
                }}
              >
                {t.label}
              </AdminButton>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-6">
          <AdminInput label="Plan name *" placeholder="e.g. Professional" value={v.name} onChange={(e) => set("name", e.target.value)} error={err("name")} />
        </div>
        <div className="sm:col-span-4">
          <AdminInput
            label="Plan code"
            value={v.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            disabled={Boolean(plan)}
            helperText={plan ? "The code cannot change." : "Optional; derived from the name when empty."}
            error={err("code")}
          />
        </div>
        <div className="sm:col-span-2">
          <AdminInput label="Trial days" type="number" min={0} value={v.trial_days} onChange={(e) => set("trial_days", e.target.value)} error={err("trial_days")} />
        </div>
      </div>
      <AdminInput label="Tagline" value={v.tagline} onChange={(e) => set("tagline", e.target.value)} error={err("tagline")} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <AdminInput label="Monthly price" type="number" min={0} step="0.01" value={v.monthly_price} onChange={(e) => set("monthly_price", e.target.value)} error={err("monthly_price")} />
        <AdminInput label="Annual price" type="number" min={0} step="0.01" value={v.annual_price} onChange={(e) => set("annual_price", e.target.value)} error={err("annual_price")} />
        <AdminInput label="AI token quota" value={v.ai_token_quota} onChange={(e) => set("ai_token_quota", e.target.value)} error={err("ai_token_quota")} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium text-[var(--color-text-secondary)]">Limits</legend>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <AdminInput label="Seats" type="number" min={0} value={v.max_seats} onChange={(e) => set("max_seats", e.target.value)} error={err("max_seats")} />
          <AdminInput label="Projects" type="number" min={0} value={v.max_projects} onChange={(e) => set("max_projects", e.target.value)} error={err("max_projects")} />
          <AdminInput label="Workspaces" type="number" min={0} value={v.max_workspaces} onChange={(e) => set("max_workspaces", e.target.value)} error={err("max_workspaces")} />
          <AdminInput label="Storage GB" type="number" min={0} value={v.storage_gb} onChange={(e) => set("storage_gb", e.target.value)} error={err("storage_gb")} />
          <AdminInput label="API RPM" type="number" min={0} value={v.api_rate_limit_per_min} onChange={(e) => set("api_rate_limit_per_min", e.target.value)} error={err("api_rate_limit_per_min")} />
        </div>
      </fieldset>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <AdminInput label="Badge label" value={v.badge_label} onChange={(e) => set("badge_label", e.target.value)} placeholder="e.g. Most popular" error={err("badge_label")} />
        <Checkbox label="Mark as popular" checked={v.is_popular} onChange={(c) => set("is_popular", c)} />
      </div>
      <div className="space-y-1.5">
        <span className="block text-xs font-medium text-[var(--color-text-secondary)]">Brand colour</span>
        <div className="flex flex-wrap gap-2">
          {PLAN_BRAND_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={v.brand_color === c}
              aria-label={`Brand colour ${c}`}
              onClick={() => set("brand_color", c)}
              className={`h-7 w-7 rounded-full ${THEMES[c].swatch} ${v.brand_color === c ? "ring-2 ring-offset-2 ring-[var(--color-text-primary)]" : ""}`}
            />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <span className="block text-xs font-medium text-[var(--color-text-secondary)]">Features</span>
        <div className="flex gap-2">
          <AdminInput
            aria-label="New feature"
            value={feature}
            onChange={(e) => setFeature(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addFeature();
              }
            }}
            placeholder="e.g. SSO / SAML"
          />
          <AdminButton type="button" variant="outline" size="sm" onClick={addFeature}>
            <Plus className="w-3.5 h-3.5" /> Add
          </AdminButton>
        </div>
        {v.features.length > 0 && (
          <ul className="space-y-1">
            {v.features.map((f, idx) => (
              <li key={`${f}-${idx}`} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-1.5 text-xs">
                <span className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  {f}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${f}`}
                  onClick={() => set("features", v.features.filter((_, i) => i !== idx))}
                  className="text-[var(--color-text-muted)] hover:text-rose-500"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CommercialFormModal>
  );
}
