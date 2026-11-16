"use client";

import React, { useState } from "react";
import {
  Archive,
  Check,
  Edit3,
  Layers,
  Plus,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { BillingPlan, PlanBrandColor } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { formatCurrency } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  ConfirmActionModal,
  EmptyStateView,
  PageHeader,
  StatusBadge,
  SurfaceCard,
} from "../_components/SuperAdminPrimitives";

interface BrandThemeTokens {
  label: string;
  swatch: string;
  ring: string;
  stripe: string;
  border: string;
  badge: string;
  chip: string;
  cardRing: string;
  icon: string;
}

const PLAN_BRAND_THEMES: Record<PlanBrandColor, BrandThemeTokens> = {
  sky: {
    label: "Sky",
    swatch: "bg-sky-500",
    ring: "ring-sky-500",
    stripe: "bg-sky-500",
    border: "border-sky-500/45 hover:border-sky-500/70",
    badge: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30",
    chip: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    cardRing: "ring-1 ring-sky-500/35",
    icon: "text-sky-500",
  },
  blue: {
    label: "Blue",
    swatch: "bg-blue-500",
    ring: "ring-blue-500",
    stripe: "bg-blue-500",
    border: "border-blue-500/45 hover:border-blue-500/70",
    badge: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30",
    chip: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    cardRing: "ring-1 ring-blue-500/35",
    icon: "text-blue-500",
  },
  amber: {
    label: "Amber",
    swatch: "bg-amber-500",
    ring: "ring-amber-500",
    stripe: "bg-amber-500",
    border: "border-amber-500/45 hover:border-amber-500/70",
    badge: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    cardRing: "ring-1 ring-amber-500/35",
    icon: "text-amber-500",
  },
  violet: {
    label: "Violet",
    swatch: "bg-violet-500",
    ring: "ring-violet-500",
    stripe: "bg-violet-500",
    border: "border-violet-500/45 hover:border-violet-500/70",
    badge: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-500/30",
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    cardRing: "ring-1 ring-violet-500/35",
    icon: "text-violet-500",
  },
  emerald: {
    label: "Emerald",
    swatch: "bg-emerald-500",
    ring: "ring-emerald-500",
    stripe: "bg-emerald-500",
    border: "border-emerald-500/45 hover:border-emerald-500/70",
    badge: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    cardRing: "ring-1 ring-emerald-500/35",
    icon: "text-emerald-500",
  },
  rose: {
    label: "Rose",
    swatch: "bg-rose-500",
    ring: "ring-rose-500",
    stripe: "bg-rose-500",
    border: "border-rose-500/45 hover:border-rose-500/70",
    badge: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30",
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    cardRing: "ring-1 ring-rose-500/35",
    icon: "text-rose-500",
  },
};

const BRAND_COLOR_ORDER: PlanBrandColor[] = ["sky", "blue", "amber", "violet", "emerald", "rose"];

const PLATFORM_FEATURE_CATALOG = [
  "Unlimited workspaces",
  "Priority 24/7 support",
  "Custom SMTP & Branding",
  "Audit logs (1 year)",
  "GitHub App real-time sync",
  "Role-based access control",
  "SAML SSO & SCIM provisioning",
  "Webhook retry automation",
  "CSV & PDF invoice export",
  "Automated billing alerts",
  "Dedicated onboarding manager",
  "99.99% enterprise SLA",
];

function inferPlanBrandColor(plan: Pick<BillingPlan, "code" | "name" | "brandColor">): PlanBrandColor {
  if (plan.brandColor && PLAN_BRAND_THEMES[plan.brandColor]) {
    return plan.brandColor;
  }
  const key = `${plan.code} ${plan.name}`.toUpperCase();
  if (key.includes("ENTERPRISE")) return "amber";
  if (key.includes("PRO")) return "violet";
  if (key.includes("GROWTH")) return "emerald";
  if (key.includes("STARTER") || key.includes("FREE")) return "sky";
  return "blue";
}

function getPlanTheme(plan: Pick<BillingPlan, "code" | "name" | "brandColor">): BrandThemeTokens {
  return PLAN_BRAND_THEMES[inferPlanBrandColor(plan)];
}

export default function SuperAdminPlansPage() {
  const plans = useSuperAdminStore((s) => s.plans);
  const subscriptions = useSuperAdminStore((s) => s.subscriptions);
  const organizations = useSuperAdminStore((s) => s.organizations);
  const createPlan = useSuperAdminStore((s) => s.createPlan);
  const updatePlan = useSuperAdminStore((s) => s.updatePlan);
  const togglePlanArchive = useSuperAdminStore((s) => s.togglePlanArchive);
  const deletePlan = useSuperAdminStore((s) => s.deletePlan);

  const { can } = useAdminPermissions();
  const canManage = can("plans.manage");

  const [billingView, setBillingView] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [showArchived, setShowArchived] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BillingPlan | null>(null);

  // Customization form state
  const [code, setCode] = useState("");
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("499");
  const [annualPrice, setAnnualPrice] = useState("4990");
  const [trialDays, setTrialDays] = useState("14");
  const [isPopular, setIsPopular] = useState(false);
  const [badgeLabel, setBadgeLabel] = useState("");
  const [brandColor, setBrandColor] = useState<PlanBrandColor>("blue");
  const [aiTokenQuota, setAiTokenQuota] = useState("250,000 / mo");
  const [maxSeats, setMaxSeats] = useState("50");
  const [maxProjects, setMaxProjects] = useState("30");
  const [maxWorkspaces, setMaxWorkspaces] = useState("5");
  const [storageGb, setStorageGb] = useState("100");
  const [apiRateLimitPerMin, setApiRateLimitPerMin] = useState("1200");
  const [features, setFeatures] = useState<string[]>([
    "Priority 24/7 support",
    "GitHub App real-time sync",
  ]);
  const [newFeature, setNewFeature] = useState("");
  const [catalogSelection, setCatalogSelection] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openCreate = () => {
    setEditingPlan(null);
    setCode("");
    setCodeManuallyEdited(false);
    setName("");
    setTagline("");
    setMonthlyPrice("499");
    setAnnualPrice("4790");
    setTrialDays("14");
    setIsPopular(false);
    setBadgeLabel("");
    setBrandColor("blue");
    setAiTokenQuota("250,000 / mo");
    setMaxSeats("50");
    setMaxProjects("30");
    setMaxWorkspaces("5");
    setStorageGb("100");
    setApiRateLimitPerMin("1200");
    setFeatures([
      "GitHub App real-time sync",
      "Role-based access control",
      "Audit logs (1 year)",
    ]);
    setNewFeature("");
    setCatalogSelection("");
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (plan: BillingPlan) => {
    setEditingPlan(plan);
    setCode(plan.code);
    setCodeManuallyEdited(true);
    setName(plan.name);
    setTagline(plan.tagline);
    setMonthlyPrice(String(plan.monthlyPrice));
    setAnnualPrice(String(plan.annualPrice));
    setTrialDays(String(plan.trialDays));
    setIsPopular(plan.isPopular);
    setBadgeLabel(plan.badgeLabel ?? (plan.isPopular ? "Popular" : ""));
    setBrandColor(inferPlanBrandColor(plan));
    setAiTokenQuota(
      plan.aiTokenQuota ||
        (plan.code.includes("ENTERPRISE")
          ? "Unlimited"
          : plan.code.includes("PRO")
            ? "500,000 / mo"
            : plan.code.includes("GROWTH")
              ? "200,000 / mo"
              : "50,000 / mo")
    );
    setMaxSeats(String(plan.limits.maxSeats));
    setMaxProjects(String(plan.limits.maxProjects));
    setMaxWorkspaces(String(plan.limits.maxWorkspaces));
    setStorageGb(String(plan.limits.storageGb));
    setApiRateLimitPerMin(String(plan.limits.apiRateLimitPerMin));
    setFeatures([...plan.features]);
    setNewFeature("");
    setCatalogSelection("");
    setErrors({});
    setModalOpen(true);
  };

  const addFeatureValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (features.some((f) => f.toLowerCase() === trimmed.toLowerCase())) {
      toast.info(`"${trimmed}" is already included`);
      return false;
    }
    setFeatures((prev) => [...prev, trimmed]);
    setErrors((prev) => {
      if (!prev.features) return prev;
      const next = { ...prev };
      delete next.features;
      return next;
    });
    return true;
  };

  const addFeatureLine = () => {
    if (addFeatureValue(newFeature)) {
      setNewFeature("");
    }
  };

  const handleTierNameChange = (val: string) => {
    setName(val);
    if (!editingPlan && !codeManuallyEdited) {
      const derived = val
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 18);
      setCode(derived);
    }
  };

  // Real-time annual pricing calculations for the customization modal
  const parsedMonthly = Math.max(0, Number(monthlyPrice) || 0);
  const parsedAnnual = Math.max(0, Number(annualPrice) || 0);
  const standardTwelveMonth = parsedMonthly * 12;
  const annualSavings = standardTwelveMonth - parsedAnnual;
  const savingsPercent =
    standardTwelveMonth > 0 ? Math.round((annualSavings / standardTwelveMonth) * 100) : 0;
  const twentyPercentTarget = Math.round(standardTwelveMonth * 0.8);
  const twoMonthsFreeTarget = Math.round(parsedMonthly * 10);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!code.trim() || code.trim().length < 2) errs.code = "Plan code is required (e.g. BUSINESS).";
    if (!name.trim()) errs.name = "Plan tier name is required.";
    if (!tagline.trim()) errs.tagline = "Provide a concise tagline or purpose.";
    const mPrice = Number(monthlyPrice);
    const aPrice = Number(annualPrice);
    if (Number.isNaN(mPrice) || mPrice < 0) errs.monthlyPrice = "Enter a valid non-negative price.";
    if (Number.isNaN(aPrice) || aPrice < 0) errs.annualPrice = "Enter a valid non-negative price.";
    if (features.length === 0) errs.features = "Add at least one included feature.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const cleanBadge = badgeLabel.trim();
    const payload = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      tagline: tagline.trim(),
      monthlyPrice: mPrice,
      annualPrice: aPrice,
      currency: "USD" as const,
      status: editingPlan ? editingPlan.status : ("ACTIVE" as const),
      isPopular: isPopular || Boolean(cleanBadge),
      badgeLabel: cleanBadge || undefined,
      brandColor,
      aiTokenQuota: aiTokenQuota.trim() || undefined,
      trialDays: Math.max(0, Number(trialDays) || 0),
      limits: {
        maxSeats: Math.max(1, Number(maxSeats) || 1),
        maxProjects: Math.max(1, Number(maxProjects) || 1),
        maxWorkspaces: Math.max(1, Number(maxWorkspaces) || 1),
        storageGb: Math.max(1, Number(storageGb) || 1),
        apiRateLimitPerMin: Math.max(60, Number(apiRateLimitPerMin) || 60),
      },
      features,
    };

    if (editingPlan) {
      updatePlan(editingPlan.id, payload);
      toast.success(`Saved changes to "${payload.name}"`);
      setModalOpen(false);
    } else {
      const res = createPlan(payload);
      if (!res.ok) {
        setErrors({ code: res.error || "Failed to create plan" });
        return;
      }
      toast.success(`Created commercial plan "${payload.name}"`);
      setModalOpen(false);
    }
  };

  const visiblePlans = plans.filter((p) => (showArchived ? true : p.status === "ACTIVE"));
  const activeModalTheme = PLAN_BRAND_THEMES[brandColor];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Commercial Plans"
        description="Customize monthly & annual pricing formulas, quota allocations, tier brand colors, and feature entitlements."
        actions={
          <>
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-xs">
              {(["MONTHLY", "ANNUAL"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBillingView(mode)}
                  className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                    billingView === mode
                      ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {mode === "MONTHLY" ? "Monthly View" : "Annual View"}
                </button>
              ))}
            </div>

            <AdminButton
              variant="outline"
              size="sm"
              onClick={() => setShowArchived((v) => !v)}
            >
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? "Hide Archived" : "Show Archived"}
            </AdminButton>

            <AdminButton
              variant="primary"
              size="sm"
              permissionLocked={!canManage}
              onClick={openCreate}
            >
              <Plus className="w-3.5 h-3.5" />
              Create Plan
            </AdminButton>
          </>
        }
      />

      {visiblePlans.length === 0 ? (
        <SurfaceCard className="p-6">
          <EmptyStateView
            icon={Layers}
            title="No plans available"
            description="Create a pricing plan to assign subscriptions to organizations."
            actionLabel={canManage ? "Create Plan" : undefined}
            onAction={canManage ? openCreate : undefined}
          />
        </SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {visiblePlans.map((plan) => {
            const linkedSubs = subscriptions.filter(
              (s) => s.planId === plan.id && s.status !== "CANCELLED"
            );
            const planMrr = organizations
              .filter((o) => o.planId === plan.id)
              .reduce((sum, o) => sum + o.mrr, 0);
            const price = billingView === "ANNUAL" ? plan.annualPrice : plan.monthlyPrice;
            const stdAnnual = plan.monthlyPrice * 12;
            const cardSave = stdAnnual - plan.annualPrice;
            const cardSavePct = stdAnnual > 0 ? Math.round((cardSave / stdAnnual) * 100) : 0;
            const monthlyEquivalent = Math.round(plan.annualPrice / 12);
            const theme = getPlanTheme(plan);
            const displayHighlight = plan.badgeLabel || (plan.isPopular ? "Popular" : "");

            return (
              <SurfaceCard
                key={plan.id}
                className={`p-5 pt-6 flex flex-col justify-between gap-4 relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${theme.border} ${
                  displayHighlight ? theme.cardRing : ""
                } ${plan.status === "ARCHIVED" ? "opacity-70" : ""}`}
              >
                <span className={`absolute inset-x-0 top-0 h-1 ${theme.stripe}`} aria-hidden="true" />
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${theme.badge}`}
                        >
                          {plan.code}
                        </span>
                        {displayHighlight && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-300">
                            <Sparkles className="w-2.5 h-2.5" /> {displayHighlight}
                          </span>
                        )}
                        {plan.status === "ARCHIVED" && (
                          <StatusBadge label="Archived" tone="neutral" />
                        )}
                      </div>
                      <h3 className="text-base font-bold text-[var(--color-text-primary)] mt-1.5">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                        {plan.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Price Block */}
                  <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-extrabold text-[var(--color-text-primary)]">
                          {formatCurrency(price)}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          /{billingView === "ANNUAL" ? "year" : "mo"}
                        </span>
                      </div>
                      {cardSavePct > 0 && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Save {cardSavePct}% yr
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                      {billingView === "ANNUAL"
                        ? `${formatCurrency(monthlyEquivalent)}/mo billed annually (${formatCurrency(
                            plan.monthlyPrice
                          )}/mo monthly)`
                        : `Annual plan: ${formatCurrency(plan.annualPrice)}/yr`}
                    </p>
                    <div className="mt-2 pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-[11px] text-[var(--color-text-secondary)]">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-500" />
                        {linkedSubs.length} active orgs
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(planMrr)}/mo MRR
                      </span>
                    </div>
                  </div>

                  {/* Quotas */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5">
                      <span className="text-[var(--color-text-muted)] block">Seats</span>
                      <strong className="text-[var(--color-text-primary)]">{plan.limits.maxSeats}</strong>
                    </div>
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5">
                      <span className="text-[var(--color-text-muted)] block">Projects</span>
                      <strong className="text-[var(--color-text-primary)]">{plan.limits.maxProjects}</strong>
                    </div>
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5">
                      <span className="text-[var(--color-text-muted)] block">Storage</span>
                      <strong className="text-[var(--color-text-primary)]">{plan.limits.storageGb} GB</strong>
                    </div>
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 py-1.5">
                      <span className="text-[var(--color-text-muted)] block">
                        {plan.aiTokenQuota ? "AI Quota" : "API RPM"}
                      </span>
                      <strong className="text-[var(--color-text-primary)] truncate block">
                        {plan.aiTokenQuota || plan.limits.apiRateLimitPerMin.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-1.5 pt-2 border-t border-[var(--color-border)]">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-[var(--color-text-secondary)]">
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-[var(--color-border)] flex items-center justify-between gap-2">
                  <AdminButton
                    variant="outline"
                    size="xs"
                    className="flex-1"
                    permissionLocked={!canManage}
                    onClick={() => openEdit(plan)}
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Customize Plan
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    size="xs"
                    permissionLocked={!canManage}
                    onClick={() => {
                      togglePlanArchive(plan.id);
                      toast.info(
                        `${plan.status === "ACTIVE" ? "Archived" : "Restored"} plan "${plan.name}"`
                      );
                    }}
                    title={plan.status === "ACTIVE" ? "Archive plan" : "Restore plan"}
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </AdminButton>
                  <AdminButton
                    variant="ghost"
                    size="xs"
                    permissionLocked={!canManage}
                    className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                    onClick={() => setDeleteTarget(plan)}
                    title="Delete plan"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </AdminButton>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}

      {/* Customize / Create Plan Tier Modal */}
      <AdminModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingPlan ? `Edit ${editingPlan.name} Tier` : "Create New Plan Tier"}
        description="Configure pricing formulas, monthly & annual discounts, quotas, and tenant features."
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Tier Identity */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-6">
              <AdminInput
                label="Plan Tier Name *"
                value={name}
                onChange={(e) => handleTierNameChange(e.target.value)}
                placeholder="e.g. Business"
                error={errors.name}
              />
            </div>
            <div className="sm:col-span-4">
              <AdminInput
                label="Plan Code *"
                value={code}
                onChange={(e) => {
                  setCodeManuallyEdited(true);
                  setCode(e.target.value.toUpperCase());
                }}
                placeholder="BUSINESS"
                error={errors.code}
                disabled={Boolean(editingPlan)}
              />
            </div>
            <div className="sm:col-span-2">
              <AdminInput
                label="Trial Days"
                type="number"
                min={0}
                value={trialDays}
                onChange={(e) => setTrialDays(e.target.value)}
              />
            </div>
          </div>

          <AdminInput
            label="Tagline / Purpose *"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="For high-velocity companies requiring dedicated AI quotas."
            error={errors.tagline}
          />

          {/* Monthly & Annual Pricing + Real-Time Annual Breakdown */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AdminInput
                label="Monthly Price (USD $) *"
                type="number"
                min={0}
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                error={errors.monthlyPrice}
              />
              <AdminInput
                label="Annual Price (USD $) *"
                type="number"
                min={0}
                value={annualPrice}
                onChange={(e) => setAnnualPrice(e.target.value)}
                error={errors.annualPrice}
              />
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                  Real-Time Annual Breakdown:
                </span>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(parsedAnnual)} / yr
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Standard 12 mo:{" "}
                  <span className="font-medium text-[var(--color-text-primary)]">
                    {formatCurrency(standardTwelveMonth)}
                  </span>{" "}
                  |{" "}
                  {annualSavings > 0 ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Saves: {formatCurrency(annualSavings)}/yr ({savingsPercent}% off)
                    </span>
                  ) : annualSavings === 0 ? (
                    <span className="text-[var(--color-text-muted)]">No annual discount (0% off)</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">
                      +{formatCurrency(Math.abs(annualSavings))}/yr above monthly rate
                    </span>
                  )}
                </p>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAnnualPrice(String(twentyPercentTarget))}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      parsedAnnual === twentyPercentTarget && parsedMonthly > 0
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]"
                    }`}
                  >
                    Apply 20% Off
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnualPrice(String(twoMonthsFreeTarget))}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      parsedAnnual === twoMonthsFreeTarget && parsedMonthly > 0
                        ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:bg-[var(--color-hover)]"
                    }`}
                  >
                    2 Mo Free
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnnualPrice(String(standardTwelveMonth))}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                      parsedAnnual === standardTwelveMonth && parsedMonthly > 0
                        ? "border-blue-500/40 bg-blue-500/15 text-blue-700 dark:text-blue-300"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"
                    }`}
                  >
                    Full 12 Mo
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quotas Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AdminInput
              label="AI Token Quota"
              value={aiTokenQuota}
              onChange={(e) => setAiTokenQuota(e.target.value)}
              placeholder="250,000 / mo"
            />
            <AdminInput
              label="Seats Allocation"
              type="number"
              min={1}
              value={maxSeats}
              onChange={(e) => setMaxSeats(e.target.value)}
            />
            <AdminInput
              label="Storage Limit (GB)"
              type="number"
              min={1}
              value={storageGb}
              onChange={(e) => setStorageGb(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AdminInput
              label="Max Projects"
              type="number"
              min={1}
              value={maxProjects}
              onChange={(e) => setMaxProjects(e.target.value)}
            />
            <AdminInput
              label="Workspaces"
              type="number"
              min={1}
              value={maxWorkspaces}
              onChange={(e) => setMaxWorkspaces(e.target.value)}
            />
            <AdminInput
              label="API Rate Limit (Req/Min)"
              type="number"
              min={60}
              value={apiRateLimitPerMin}
              onChange={(e) => setApiRateLimitPerMin(e.target.value)}
            />
          </div>

          {/* Highlight Badge & Tier Brand Color */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
            <div className="sm:col-span-6 space-y-1.5">
              <AdminInput
                label="Highlight Badge (Optional)"
                value={badgeLabel}
                onChange={(e) => {
                  setBadgeLabel(e.target.value);
                  if (e.target.value.trim()) setIsPopular(true);
                }}
                placeholder="e.g. Best Value, Most Popular"
              />
            </div>

            <div className="sm:col-span-6 space-y-1.5">
              <span className="block text-xs font-medium text-[var(--color-text-secondary)]">
                Tier Brand Color
              </span>
              <div className="flex flex-wrap items-center gap-2.5 h-9">
                {BRAND_COLOR_ORDER.map((colorKey) => {
                  const palette = PLAN_BRAND_THEMES[colorKey];
                  const selected = brandColor === colorKey;
                  return (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setBrandColor(colorKey)}
                      aria-label={`Select ${palette.label} brand color`}
                      title={palette.label}
                      className={`h-6 w-6 rounded-full ${palette.swatch} transition-transform ${
                        selected
                          ? `ring-2 ${palette.ring} ring-offset-2 ring-offset-[var(--color-surface)] scale-110`
                          : "opacity-80 hover:opacity-100 hover:scale-105"
                      }`}
                    />
                  );
                })}
                <span
                  className={`ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-semibold ${activeModalTheme.badge}`}
                >
                  <span className={`h-2 w-2 rounded-sm ${activeModalTheme.swatch}`} />
                  {activeModalTheme.label}
                </span>
              </div>
            </div>
          </div>

          {/* Included Plan Features Catalog + Removable Chips */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                Included Plan Features *
              </span>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {features.length} feature{features.length === 1 ? "" : "s"} selected
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={catalogSelection}
                onChange={(e) => {
                  const picked = e.target.value;
                  if (picked) {
                    addFeatureValue(picked);
                    setCatalogSelection("");
                  }
                }}
                aria-label="Add feature from platform catalog"
                className="h-9 flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="">+ Add feature from platform catalog...</option>
                {PLATFORM_FEATURE_CATALOG.map((item) => {
                  const alreadyAdded = features.some(
                    (f) => f.toLowerCase() === item.toLowerCase()
                  );
                  return (
                    <option key={item} value={item} disabled={alreadyAdded}>
                      {item}
                      {alreadyAdded ? " (Added)" : ""}
                    </option>
                  );
                })}
              </select>

              <div className="flex gap-2 sm:w-64">
                <AdminInput
                  value={newFeature}
                  onChange={(e) => setNewFeature(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFeatureLine();
                    }
                  }}
                  placeholder="Custom feature..."
                />
                <AdminButton type="button" variant="outline" size="sm" onClick={addFeatureLine}>
                  Add
                </AdminButton>
              </div>
            </div>

            {errors.features && (
              <p className="text-[11px] text-red-500 dark:text-red-400">{errors.features}</p>
            )}

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 min-h-[64px]">
              {features.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Select a platform feature above or add a custom feature.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {features.map((f, idx) => (
                    <span
                      key={`${f}-${idx}`}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${activeModalTheme.chip}`}
                    >
                      <span>{f}</span>
                      <button
                        type="button"
                        onClick={() => setFeatures(features.filter((_, i) => i !== idx))}
                        className="opacity-70 hover:opacity-100 transition-opacity"
                        aria-label={`Remove feature ${f}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary">
              {editingPlan ? "Save Plan Changes" : "Create Plan Tier"}
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete plan "${deleteTarget?.name || ""}"?`}
        description="Plans with active or trialing subscriptions cannot be deleted until tenants are migrated to another tier."
        confirmLabel="Delete Plan"
        variant="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          const res = deletePlan(deleteTarget.id);
          if (!res.ok) toast.error(res.error);
          else toast.success(`Deleted plan "${deleteTarget.name}"`);
        }}
      />
    </div>
  );
}
