"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  Eye,
  LayoutGrid,
  Mail,
  Monitor,
  Plus,
  Send,
  Smartphone,
  Table2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { EmailBannerColor, EmailTemplate, EmailTemplateCategory } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import {
  exportRowsToCsv,
  extractTemplateVariables,
  formatDateTime,
  interpolateTemplate,
  isValidEmail,
} from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  BulkSelectionBar,
  ConfirmActionModal,
  EmptyStateView,
  FilterBar,
  PageHeader,
  PaginationBar,
  SimulationNotice,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/SuperAdminPrimitives";
import {
  EMAIL_BANNER_THEMES,
  ProWiseEmailPreviewCard,
  RichEmailEditor,
  inferEmailBannerColor,
} from "../_components/RichEmailEditor";

const CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  AUTH: "Authentication",
  BILLING: "Billing",
  DELIVERY: "Delivery",
  ALERTS: "Alerts",
  ANNOUNCEMENTS: "System Notice",
};

function getTemplateVisualMeta(tpl: EmailTemplate, indexHint = 0) {
  const bannerColor = inferEmailBannerColor(tpl);
  const theme = EMAIL_BANNER_THEMES[bannerColor];
  const code = tpl.code || `TPL-${1001 + indexHint}`;
  const headerBadge =
    tpl.headerBadge ||
    (tpl.category === "AUTH"
      ? "ACCOUNT READY"
      : tpl.category === "BILLING"
        ? "BILLING NOTICE"
        : tpl.category === "DELIVERY"
          ? "DELIVERY READY"
          : tpl.category === "ALERTS"
            ? "SECURITY ALERT"
            : "OPS NOTICE");
  const triggerDescription =
    tpl.triggerDescription ||
    `Automated ${CATEGORY_LABELS[tpl.category].toLowerCase()} email dispatched to tenant contacts.`;
  const openRate = tpl.openRate ?? Number((64 + ((indexHint * 7) % 28)).toFixed(1));
  const clickRate = tpl.clickRate ?? Number((26 + ((indexHint * 9) % 41)).toFixed(1));

  return {
    bannerColor,
    theme,
    code,
    headerBadge,
    triggerDescription,
    openRate,
    clickRate,
  };
}

export default function SuperAdminEmailTemplatesPage() {
  const emailTemplates = useSuperAdminStore((s) => s.emailTemplates);
  const organizations = useSuperAdminStore((s) => s.organizations);
  const plans = useSuperAdminStore((s) => s.plans);
  const smtpConfig = useSuperAdminStore((s) => s.smtpConfig);
  const createEmailTemplate = useSuperAdminStore((s) => s.createEmailTemplate);
  const updateEmailTemplate = useSuperAdminStore((s) => s.updateEmailTemplate);
  const duplicateEmailTemplate = useSuperAdminStore((s) => s.duplicateEmailTemplate);
  const deleteEmailTemplate = useSuperAdminStore((s) => s.deleteEmailTemplate);
  const sendTestTemplateEmail = useSuperAdminStore((s) => s.sendTestTemplateEmail);

  const { can } = useAdminPermissions();
  const canManage = can("templates.manage");

  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");
  const [search, setSearch] = useState("");
  const [targetOrgFilter, setTargetOrgFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | EmailTemplateCategory>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "DRAFT">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  // Modals
  const [previewTarget, setPreviewTarget] = useState<EmailTemplate | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"DESKTOP" | "MOBILE">("DESKTOP");
  const [previewOrgId, setPreviewOrgId] = useState<string>(organizations[0]?.id || "");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTpl, setEditingTpl] = useState<EmailTemplate | null>(null);
  const [testTarget, setTestTarget] = useState<EmailTemplate | null>(null);
  const [testRecipient, setTestRecipient] = useState("superadmin@prowise.io");
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Editor form state
  const [keyCode, setKeyCode] = useState("");
  const [displayCode, setDisplayCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<EmailTemplateCategory>("BILLING");
  const [status, setStatus] = useState<"ACTIVE" | "DRAFT">("ACTIVE");
  const [triggerDescription, setTriggerDescription] = useState("");
  const [headerBadge, setHeaderBadge] = useState("PROWISE NOTICE");
  const [bannerColor, setBannerColor] = useState<EmailBannerColor>("indigo");
  const [senderBrandName, setSenderBrandName] = useState("ProWise");
  const [showHighlightBox, setShowHighlightBox] = useState(true);
  const [footerNote, setFooterNote] = useState("Sent via ProWise Secure Enterprise Delivery");
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [bodyParagraphs, setBodyParagraphs] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("https://app.prowise.io/workspace");
  const [sampleVars, setSampleVars] = useState<Record<string, string>>({
    user_name: "Sarah Chen",
    organization_name: organizations[0]?.name || "Acme Health Technologies",
    inviter_name: "Arthur Pendelton",
    plan_name: "Enterprise",
    invoice_number: "INV-2026-095",
    amount: "$1,500.00",
    due_date: "Nov 25, 2026",
    expiry_date: "Nov 19, 2026",
    project_name: "Clinical Decision Support API",
    maintenance_window: "Sunday, Nov 15 • 02:00–03:30 UTC",
    action_url: "https://app.prowise.io/workspace",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const closeAllModals = () => {
    setPreviewTarget(null);
    setEditorOpen(false);
    setTestTarget(null);
    setDeleteTarget(null);
    setBulkDeleteOpen(false);
  };

  const buildSampleVarsForOrg = (orgIdToUse?: string): Record<string, string> => {
    const chosen =
      organizations.find((o) => o.id === orgIdToUse) || organizations[0];
    const plan = chosen ? plans.find((p) => p.id === chosen.planId) : undefined;
    return {
      user_name: chosen?.ownerName || "Sarah Chen",
      organization_name: chosen?.name || "Acme Health Technologies",
      inviter_name: "Arthur Pendelton",
      plan_name: plan?.name || "Enterprise",
      invoice_number: "INV-2026-095",
      amount: chosen?.mrr ? `$${chosen.mrr.toLocaleString()}.00` : "$1,500.00",
      due_date: "Nov 25, 2026",
      expiry_date: "Nov 19, 2026",
      project_name: "Clinical Decision Support API",
      maintenance_window: "Sunday, Nov 15 • 02:00–03:30 UTC",
      action_url: chosen ? `https://${chosen.domain}/workspace` : "https://app.prowise.io",
    };
  };

  const openPreview = (tpl: EmailTemplate, idxHint = 0) => {
    closeAllModals();
    const initialOrgId =
      targetOrgFilter !== "ALL"
        ? targetOrgFilter
        : organizations[idxHint % Math.max(1, organizations.length)]?.id || organizations[0]?.id || "";
    setPreviewOrgId(initialOrgId);
    setPreviewDevice("DESKTOP");
    setPreviewTarget(tpl);
  };

  const openCreate = () => {
    closeAllModals();
    const defaults = buildSampleVarsForOrg(targetOrgFilter !== "ALL" ? targetOrgFilter : undefined);
    setEditingTpl(null);
    setKeyCode("");
    setDisplayCode(`TPL-${1001 + emailTemplates.length}`);
    setName("");
    setCategory("AUTH");
    setStatus("ACTIVE");
    setTriggerDescription("");
    setHeaderBadge("");
    setBannerColor("indigo");
    setSenderBrandName("");
    setShowHighlightBox(true);
    setFooterNote("");
    setSubject("");
    setHeadline("");
    setBodyParagraphs("");
    setCtaLabel("");
    setCtaUrl("");
    setSampleVars({ ...defaults, organization_name: "" });
    setErrors({});
    setEditorOpen(true);
  };

  const openEdit = (tpl: EmailTemplate, idxHint = 0) => {
    closeAllModals();
    const visual = getTemplateVisualMeta(tpl, idxHint);
    const defaults = buildSampleVarsForOrg(targetOrgFilter !== "ALL" ? targetOrgFilter : undefined);
    setEditingTpl(tpl);
    setKeyCode(tpl.key);
    setDisplayCode(visual.code);
    setName(tpl.name);
    setCategory(tpl.category);
    setStatus(tpl.status);
    setTriggerDescription(visual.triggerDescription);
    setHeaderBadge(visual.headerBadge);
    setBannerColor(visual.bannerColor);
    setSenderBrandName(tpl.senderBrandName || "ProWise");
    setShowHighlightBox(tpl.showHighlightBox !== false);
    setFooterNote(tpl.footerNote || "Sent via ProWise Secure Enterprise Delivery");
    setSubject(interpolateTemplate(tpl.subject, defaults));
    setHeadline(interpolateTemplate(tpl.headline, defaults));
    setBodyParagraphs(interpolateTemplate(tpl.bodyParagraphs, defaults));
    setCtaLabel(interpolateTemplate(tpl.ctaLabel, defaults));
    setCtaUrl(
      tpl.ctaUrl === "{{action_url}}" || tpl.ctaUrl === "[Action Link]"
        ? "https://app.prowise.io/workspace"
        : interpolateTemplate(tpl.ctaUrl, defaults)
    );
    setSampleVars(defaults);
    setErrors({});
    setEditorOpen(true);
  };

  const detectedVars = useMemo(
    () => extractTemplateVariables(`${subject} ${headline} ${bodyParagraphs} ${ctaLabel} ${ctaUrl}`),
    [subject, headline, bodyParagraphs, ctaLabel, ctaUrl]
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Template name is required.";
    if (!keyCode.trim()) errs.keyCode = "Template code is required.";
    if (!subject.trim()) errs.subject = "Subject line cannot be empty.";
    if (!bodyParagraphs.trim()) errs.body = "Message content cannot be empty.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const visualExtras = {
      code: displayCode.trim() || undefined,
      triggerDescription: triggerDescription.trim() || undefined,
      headerBadge: headerBadge.trim() || undefined,
      bannerColor,
      senderBrandName: senderBrandName.trim() || "ProWise",
      showHighlightBox,
      footerNote: footerNote.trim() || undefined,
    };

    if (editingTpl) {
      updateEmailTemplate(editingTpl.id, {
        ...visualExtras,
        name: name.trim(),
        category,
        status,
        subject: subject.trim(),
        headline: headline.trim() || name.trim(),
        bodyParagraphs: bodyParagraphs.trim(),
        ctaLabel: ctaLabel.trim(),
        ctaUrl: ctaUrl.trim(),
        variables: detectedVars,
      });
      toast.success(`Saved template "${name.trim()}"`);
      setEditorOpen(false);
    } else {
      const res = createEmailTemplate({
        ...visualExtras,
        key: keyCode.trim(),
        name: name.trim(),
        category,
        status,
        subject: subject.trim(),
        headline: headline.trim() || name.trim(),
        bodyParagraphs: bodyParagraphs.trim(),
        ctaLabel: ctaLabel.trim(),
        ctaUrl: ctaUrl.trim(),
        variables: detectedVars,
        openRate: 0,
        clickRate: 0,
      });
      if (!res.ok) {
        setErrors({ keyCode: res.error || "Could not create template" });
        return;
      }
      toast.success(`Created template "${name.trim()}"`);
      setEditorOpen(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return emailTemplates.filter((t, idx) => {
      const visual = getTemplateVisualMeta(t, idx);
      if (categoryFilter !== "ALL" && t.category !== categoryFilter) return false;
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false;
      if (q) {
        const hit =
          t.name.toLowerCase().includes(q) ||
          t.key.toLowerCase().includes(q) ||
          visual.code.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [emailTemplates, search, categoryFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    filtered.map((t) => t.id),
    paginated.map((t) => t.id)
  );

  const handleSendTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTarget) return;
    if (!isValidEmail(testRecipient)) {
      toast.error("Please enter a valid recipient email address.");
      return;
    }
    const vars = buildSampleVarsForOrg(targetOrgFilter !== "ALL" ? targetOrgFilter : previewOrgId);
    const res = sendTestTemplateEmail(testTarget.id, testRecipient.trim(), vars);
    if (res.ok) {
      toast.success(`Simulated test email logged for ${testRecipient}`);
      setTestTarget(null);
    } else {
      toast.error(res.error || "Could not send test email");
    }
  };

  const previewOrg =
    organizations.find((o) => o.id === previewOrgId) || organizations[0];
  const previewVars = useMemo(
    () => buildSampleVarsForOrg(previewOrg?.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewOrg?.id, plans, organizations]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Email Templates"
        description="Manage ProWise customer notification cards with responsive Desktop & Mobile email previews and test dispatches."
        simulationLabel={`SMTP Relay: ${smtpConfig.provider} (${smtpConfig.connectionStatus})`}
        actions={
          <AdminButton
            variant="primary"
            size="sm"
            permissionLocked={!canManage}
            onClick={openCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            New Template
          </AdminButton>
        }
      />

      <SimulationNotice
        title="Connected to SMTP Email Settings"
        description="Templates preview in responsive Desktop and Mobile layouts for any ProWise tenant organization and dispatch simulated tests to your email log."
      />

      {/* Filter Toolbar + Table | Cards View Switcher */}
      <SurfaceCard className="p-4 space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search ID, template name, or subject..."
              hasActiveFilters={Boolean(
                search ||
                  targetOrgFilter !== "ALL" ||
                  categoryFilter !== "ALL" ||
                  statusFilter !== "ALL"
              )}
              onResetFilters={() => {
                setSearch("");
                setTargetOrgFilter("ALL");
                setCategoryFilter("ALL");
                setStatusFilter("ALL");
              }}
              filters={
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={targetOrgFilter}
                    onChange={(e) => setTargetOrgFilter(e.target.value)}
                    aria-label="Target company preview filter"
                    className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="ALL">Target Org: All Organizations</option>
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        Target Org: {org.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value as "ALL" | EmailTemplateCategory)}
                    aria-label="Filter template category"
                    className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="ALL">Category: All Categories</option>
                    <option value="AUTH">Authentication</option>
                    <option value="BILLING">Billing</option>
                    <option value="DELIVERY">Delivery</option>
                    <option value="ALERTS">Alerts</option>
                    <option value="ANNOUNCEMENTS">Announcements</option>
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "DRAFT")}
                    aria-label="Filter template status"
                    className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="ALL">Status: All Statuses</option>
                    <option value="ACTIVE">Active</option>
                    <option value="DRAFT">Draft</option>
                  </select>
                </div>
              }
            />
          </div>

          <div className="inline-flex self-start xl:self-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("TABLE")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                viewMode === "TABLE"
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("CARDS")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                viewMode === "CARDS"
                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Cards
            </button>
          </div>
        </div>
      </SurfaceCard>

      {paginated.length === 0 ? (
        <SurfaceCard className="p-6">
          <EmptyStateView
            icon={Mail}
            title="No email templates found"
            description="Create a new ProWise email template or clear search filters."
            actionLabel={canManage ? "New Template" : undefined}
            onAction={canManage ? openCreate : undefined}
          />
        </SurfaceCard>
      ) : viewMode === "CARDS" ? (
        /* Cards Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {paginated.map((tpl, idx) => {
            const globalIdx = (safePage - 1) * pageSize + idx;
            const visual = getTemplateVisualMeta(tpl, globalIdx);
            const sampleOrg =
              targetOrgFilter !== "ALL"
                ? organizations.find((o) => o.id === targetOrgFilter)
                : organizations[globalIdx % Math.max(1, organizations.length)];
            const cardVars = buildSampleVarsForOrg(sampleOrg?.id);
            const cardSubject = interpolateTemplate(tpl.subject, cardVars);

            return (
              <SurfaceCard
                key={tpl.id}
                className={`overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${visual.theme.cardBorder}`}
              >
                <div>
                  {/* Branded Banner Top Strip */}
                  <div
                    className={`${visual.theme.gradient} px-4 py-3 flex items-center justify-between gap-2 text-white`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-7 w-7 rounded-lg bg-white/20 border border-white/25 flex items-center justify-center font-extrabold text-xs shrink-0">
                        PW
                      </span>
                      <span className="font-bold text-sm tracking-tight truncate">ProWise</span>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-white/20 border border-white/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
                      {visual.headerBadge}
                    </span>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${visual.theme.categoryBadge}`}
                      >
                        {CATEGORY_LABELS[tpl.category]}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">
                        {visual.code}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-snug">
                        {tpl.name}
                      </h3>
                      {sampleOrg && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)] max-w-full">
                          <Building2 className="w-3 h-3 text-blue-500 shrink-0" />
                          <span className="truncate">{sampleOrg.name}</span>
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                      {visual.triggerDescription}
                    </p>

                    {/* Subject Preview Box */}
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5 space-y-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">
                        Subject
                      </span>
                      <p className="text-xs font-medium text-[var(--color-text-primary)] truncate">
                        {cardSubject}
                      </p>
                    </div>

                    {/* Engagement & Status Box */}
                    <div className="grid grid-cols-3 gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5 text-center sm:text-left">
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">
                          Open Rate
                        </span>
                        <span className={`text-xs font-extrabold tabular-nums ${visual.theme.rate}`}>
                          {visual.openRate}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">
                          Click Rate
                        </span>
                        <span className="text-xs font-extrabold tabular-nums text-[var(--color-text-primary)]">
                          {visual.clickRate}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">
                          Status
                        </span>
                        <div className="mt-0.5">
                          <StatusBadge label={tpl.status} tone={getStatusTone(tpl.status)} dot />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-4 pb-4 pt-2 border-t border-[var(--color-border)] space-y-2">
                  <div className="flex items-center gap-1.5">
                    <AdminButton
                      variant="outline"
                      size="xs"
                      className="flex-1"
                      onClick={() => openPreview(tpl, globalIdx)}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Preview
                    </AdminButton>
                    <AdminButton
                      variant="primary"
                      size="xs"
                      className="flex-1"
                      permissionLocked={!canManage}
                      onClick={() => openEdit(tpl, globalIdx)}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </AdminButton>
                    <AdminButton
                      variant="ghost"
                      size="xs"
                      permissionLocked={!canManage}
                      onClick={() => {
                        closeAllModals();
                        setTestTarget(tpl);
                        setTestRecipient("superadmin@prowise.io");
                      }}
                      title="Send simulated test email"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </AdminButton>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--color-text-muted)]">
                    <span className="truncate">Updated {formatDateTime(tpl.updatedAt)}</span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <AdminButton
                        variant="ghost"
                        size="xs"
                        permissionLocked={!canManage}
                        onClick={() => {
                          const dup = duplicateEmailTemplate(tpl.id);
                          if (dup) toast.success(`Duplicated "${tpl.name}"`);
                        }}
                        title="Duplicate template"
                      >
                        <Copy className="w-3 h-3" />
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        size="xs"
                        permissionLocked={!canManage}
                        className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                        onClick={() => {
                          closeAllModals();
                          setDeleteTarget(tpl);
                        }}
                        title="Delete template"
                      >
                        <Trash2 className="w-3 h-3" />
                      </AdminButton>
                    </div>
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      ) : (
        /* Table View with Starting Checkboxes & Sr. No. */
        <SurfaceCard className="overflow-hidden">
          <BulkSelectionBar
            selectedCount={selectedIds.length}
            totalFilteredCount={filtered.length}
            onSelectAllMatching={() => setSelectedIds(filtered.map((t) => t.id))}
            onClear={() => setSelectedIds([])}
            actions={
              <>
                <AdminButton
                  variant="subtle"
                  size="xs"
                  permissionLocked={!canManage}
                  onClick={() => {
                    let count = 0;
                    for (const id of selectedIds) {
                      const t = emailTemplates.find((item) => item.id === id);
                      if (t && t.status !== "ACTIVE") {
                        updateEmailTemplate(id, { status: "ACTIVE" });
                        count++;
                      }
                    }
                    if (count === 0) toast.info("Selected templates are already Active.");
                    else {
                      toast.success(`Activated ${count} template${count === 1 ? "" : "s"}`);
                      setSelectedIds([]);
                    }
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Activate
                </AdminButton>
                <AdminButton
                  variant="outline"
                  size="xs"
                  permissionLocked={!can("system.export")}
                  onClick={() => {
                    const targets = filtered.filter((t) => selectedSet.has(t.id));
                    exportRowsToCsv(
                      "prowise-email-templates.csv",
                      ["Sr. No.", "Code", "Key", "Name", "Category", "Status", "Subject"],
                      targets.map((t, idx) => [
                        idx + 1,
                        t.code || `TPL-${1001 + idx}`,
                        t.key,
                        t.name,
                        t.category,
                        t.status,
                        t.subject,
                      ])
                    );
                    toast.success(`Exported ${targets.length} template${targets.length === 1 ? "" : "s"}`);
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </AdminButton>
                <AdminButton
                  variant="danger"
                  size="xs"
                  permissionLocked={!canManage}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected
                </AdminButton>
              </>
            }
          />

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected;
                      }}
                      onChange={toggleSelectPage}
                      aria-label="Select all templates on this page"
                      className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 w-16 whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 hidden md:table-cell">Subject</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Engagement</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {paginated.map((tpl, idx) => {
                  const globalIdx = (safePage - 1) * pageSize + idx;
                  const visual = getTemplateVisualMeta(tpl, globalIdx);
                  const serialNumber = globalIdx + 1;
                  const isSelected = selectedSet.has(tpl.id);
                  const rowOrg =
                    targetOrgFilter !== "ALL"
                      ? organizations.find((o) => o.id === targetOrgFilter)
                      : organizations[globalIdx % Math.max(1, organizations.length)];
                  const rowSubject = interpolateTemplate(tpl.subject, buildSampleVarsForOrg(rowOrg?.id));

                  return (
                    <tr
                      key={tpl.id}
                      className={`hover:bg-[var(--color-hover)] transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(tpl.id)}
                          aria-label={`Select template ${tpl.name}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`h-8 w-8 rounded-lg ${visual.theme.gradient} flex items-center justify-center font-bold text-[10px] text-white shrink-0`}
                          >
                            {getOrgInitials(tpl.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                              <span className="truncate">{tpl.name}</span>
                              <span className="font-mono text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                {visual.code}
                              </span>
                            </div>
                            <p className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[240px]">
                              {visual.triggerDescription}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${visual.theme.categoryBadge}`}
                        >
                          {CATEGORY_LABELS[tpl.category]}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-[var(--color-text-secondary)] max-w-[260px] truncate">
                        {rowSubject}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-[11px] whitespace-nowrap">
                        <span className={`font-bold ${visual.theme.rate}`}>{visual.openRate}%</span>{" "}
                        <span className="text-[var(--color-text-muted)]">open •</span>{" "}
                        <span className="font-semibold text-[var(--color-text-primary)]">{visual.clickRate}%</span>{" "}
                        <span className="text-[var(--color-text-muted)]">click</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={tpl.status} tone={getStatusTone(tpl.status)} dot />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <AdminButton
                            variant="outline"
                            size="xs"
                            onClick={() => openPreview(tpl, globalIdx)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Preview
                          </AdminButton>
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canManage}
                            onClick={() => openEdit(tpl, globalIdx)}
                            title="Edit template"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </AdminButton>
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canManage}
                            onClick={() => {
                              closeAllModals();
                              setTestTarget(tpl);
                              setTestRecipient("superadmin@prowise.io");
                            }}
                            title="Send test"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </AdminButton>
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canManage}
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            onClick={() => {
                              closeAllModals();
                              setDeleteTarget(tpl);
                            }}
                            title="Delete template"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </AdminButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      )}

      <SurfaceCard className="overflow-hidden">
        <PaginationBar
          currentPage={safePage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </SurfaceCard>

      {/* Standalone Responsive Email Preview Modal (Desktop & Mobile) */}
      <AdminModal
        isOpen={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        title={previewTarget?.name || "Email Preview"}
        description={
          previewTarget
            ? `Sender: ProWise • For: ${previewOrg?.name || "Tenant Workspace"}`
            : undefined
        }
        maxWidth="2xl"
      >
        {previewTarget && (() => {
          const visual = getTemplateVisualMeta(previewTarget);
          const renderedSubject = interpolateTemplate(previewTarget.subject, previewVars);
          const renderedHeadline = interpolateTemplate(previewTarget.headline, previewVars);
          const renderedBody = interpolateTemplate(previewTarget.bodyParagraphs, previewVars);
          const renderedCta = interpolateTemplate(previewTarget.ctaLabel, previewVars);

          return (
            <div className="space-y-4">
              {/* Top Mode Switcher & Org Selector */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3">
                <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("DESKTOP")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                      previewDevice === "DESKTOP"
                        ? "bg-blue-600 text-white"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("MOBILE")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
                      previewDevice === "MOBILE"
                        ? "bg-blue-600 text-white"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Mobile
                  </button>
                </div>

                <select
                  value={previewOrg?.id || ""}
                  onChange={(e) => setPreviewOrgId(e.target.value)}
                  aria-label="Preview for organization"
                  className="h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      Preview Org: {org.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email Envelope Metadata */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] px-4 py-3 text-xs space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-[var(--color-text-muted)] w-14">From:</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-text-primary)]">
                    <span className="h-4 w-4 rounded bg-blue-600 text-white inline-flex items-center justify-center text-[9px] font-extrabold">
                      P
                    </span>
                    ProWise
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    &lt;{smtpConfig.fromEmail || "noreply@prowise.io"}&gt;
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-[var(--color-text-muted)] w-14">To:</span>
                  <span className="text-[var(--color-text-primary)] font-medium">
                    {previewOrg?.ownerName || "Sarah Chen"}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    &lt;{previewOrg?.ownerEmail || "owner@company.com"}&gt;
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-[var(--color-text-muted)] w-14">Subject:</span>
                  <span className="font-semibold text-[var(--color-text-primary)]">{renderedSubject}</span>
                </div>
              </div>

              {/* Desktop / Mobile Framed Preview Canvas */}
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 sm:p-6">
                <ProWiseEmailPreviewCard
                  device={previewDevice}
                  bannerColor={visual.bannerColor}
                  senderBrandName={previewTarget.senderBrandName || "ProWise"}
                  headerBadge={visual.headerBadge}
                  eyebrowLabel={`WELCOME TO ${(previewTarget.senderBrandName || "PROWISE").toUpperCase()} • ${CATEGORY_LABELS[previewTarget.category].toUpperCase()}`}
                  renderedHeadline={renderedHeadline}
                  renderedBody={renderedBody}
                  renderedCtaLabel={renderedCta}
                  accountEmail={previewOrg?.ownerEmail || "owner@company.com"}
                  organizationName={previewVars.organization_name}
                  planName={previewVars.plan_name}
                  showHighlightBox={previewTarget.showHighlightBox !== false}
                  footerTimestamp={
                    previewTarget.footerNote ||
                    `Sent via ${previewTarget.senderBrandName || "ProWise"} Mail Relay (${smtpConfig.provider})`
                  }
                />
              </div>

              {/* Footer Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                <AdminButton
                  variant="outline"
                  size="sm"
                  permissionLocked={!canManage}
                  onClick={() => openEdit(previewTarget)}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Template
                </AdminButton>
                <div className="flex flex-wrap items-center gap-2">
                  <AdminButton
                    variant="outline"
                    size="sm"
                    permissionLocked={!canManage}
                    onClick={() => {
                      const recipient = previewOrg?.ownerEmail || "superadmin@prowise.io";
                      const res = sendTestTemplateEmail(previewTarget.id, recipient, previewVars);
                      if (res.ok) toast.success(`Sent simulated test email to ${recipient}`);
                      else toast.error(res.error || "Could not send test");
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Send Live Test to Inbox
                  </AdminButton>
                  <AdminButton variant="primary" size="sm" onClick={() => setPreviewTarget(null)}>
                    Close Preview
                  </AdminButton>
                </div>
              </div>
            </div>
          );
        })()}
      </AdminModal>

      {/* Visual Template Builder Modal */}
      <AdminModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingTpl ? `Visual Template Builder: ${editingTpl.name}` : "Create New Email Notification Template"}
        description={
          editingTpl
            ? "Update notification copy and options with instant real-time live preview."
            : "Fill in key parameters below. Real-time preview updates instantly on the right."
        }
        maxWidth="5xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <RichEmailEditor
            isEditing={Boolean(editingTpl)}
            name={name}
            onNameChange={(val) => {
              setName(val);
              if (!editingTpl) {
                setKeyCode(
                  val
                    .toUpperCase()
                    .replace(/[^A-Z0-9]+/g, "_")
                    .replace(/^_+|_+$/g, "")
                );
              }
            }}
            category={category}
            onCategoryChange={setCategory}
            status={status}
            onStatusChange={setStatus}
            displayCode={displayCode}
            onDisplayCodeChange={setDisplayCode}
            keyCode={keyCode}
            onKeyCodeChange={setKeyCode}
            senderBrandName={senderBrandName}
            onSenderBrandNameChange={setSenderBrandName}
            bannerColor={bannerColor}
            onBannerColorChange={setBannerColor}
            headerBadge={headerBadge}
            onHeaderBadgeChange={setHeaderBadge}
            triggerDescription={triggerDescription}
            onTriggerDescriptionChange={setTriggerDescription}
            showHighlightBox={showHighlightBox}
            onShowHighlightBoxChange={setShowHighlightBox}
            footerNote={footerNote}
            onFooterNoteChange={setFooterNote}
            subject={subject}
            onSubjectChange={setSubject}
            headline={headline}
            onHeadlineChange={setHeadline}
            bodyParagraphs={bodyParagraphs}
            onBodyParagraphsChange={setBodyParagraphs}
            ctaLabel={ctaLabel}
            onCtaLabelChange={setCtaLabel}
            ctaUrl={ctaUrl}
            onCtaUrlChange={setCtaUrl}
            sampleVars={sampleVars}
            onSampleVarsChange={setSampleVars}
            organizationSuggestions={organizations.map((o) => o.name)}
            errors={errors}
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--color-border)]">
            {editingTpl ? (
              <AdminButton
                type="button"
                variant="outline"
                onClick={() => {
                  const target = editingTpl;
                  setEditorOpen(false);
                  setTestTarget(target);
                }}
              >
                <Send className="w-3.5 h-3.5" />
                Send Test Email
              </AdminButton>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <AdminButton type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="primary">
                {editingTpl ? "Save Template" : "Create Template"}
              </AdminButton>
            </div>
          </div>
        </form>
      </AdminModal>

      {/* Send Test Email Modal */}
      <AdminModal
        isOpen={Boolean(testTarget)}
        onClose={() => setTestTarget(null)}
        title={`Send Test Email — ${testTarget?.name || ""}`}
        description={`Simulates sending through your ${smtpConfig.provider} mail relay`}
        maxWidth="md"
      >
        {testTarget && (
          <form onSubmit={handleSendTest} className="space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs space-y-1">
              <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
                <Eye className="w-3.5 h-3.5" /> Subject Preview
              </div>
              <p className="font-semibold text-[var(--color-text-primary)]">
                [TEST] {interpolateTemplate(testTarget.subject, sampleVars)}
              </p>
            </div>
            <AdminInput
              label="Test Recipient Email"
              type="email"
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <AdminButton type="button" variant="outline" onClick={() => setTestTarget(null)}>
                Cancel
              </AdminButton>
              <AdminButton type="submit" variant="primary">
                <Send className="w-3.5 h-3.5" /> Send Simulated Test
              </AdminButton>
            </div>
          </form>
        )}
      </AdminModal>

      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete template "${deleteTarget?.name || ""}"?`}
        description="Automated notifications using this template will stop until reassigned."
        confirmLabel="Delete Template"
        variant="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteEmailTemplate(deleteTarget.id);
          toast.success(`Deleted template "${deleteTarget.name}"`);
        }}
      />

      <ConfirmActionModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.length} selected template${selectedIds.length === 1 ? "" : "s"}?`}
        description="Selected email templates will be removed from the workspace."
        confirmLabel="Delete Selected"
        variant="danger"
        onConfirm={() => {
          const count = selectedIds.length;
          for (const id of selectedIds) deleteEmailTemplate(id);
          toast.success(`Deleted ${count} email template${count === 1 ? "" : "s"}`);
          setSelectedIds([]);
        }}
      />
    </div>
  );
}
