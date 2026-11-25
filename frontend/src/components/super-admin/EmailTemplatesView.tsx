"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  FileEdit,
  Info,
  LayoutGrid,
  Layers,
  List,
  Mail,
  Monitor,
  Plus,
  RefreshCw,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { PlatformApi } from "@/lib/admin-api/platform";
import type { SmtpSettingsResponse } from "@/lib/api";
import type { EmailTemplateUpdateInput, PlatformEmailTemplate } from "@/types/admin-platform";
import type { EmailBannerColor, EmailTemplateCategory } from "@/app/(platform)/super-admin/_types";
import {
  ProWiseEmailPreviewCard,
  RichEmailEditor,
  inferEmailBannerColor,
} from "@/app/(platform)/super-admin/_components/RichEmailEditor";
import { interpolateTemplate } from "@/app/(platform)/super-admin/_services/super-admin-service";
import {
  AdminButton,
  AdminModal,
  AdminSelect,
  ConfirmActionModal,
  FilterBar,
  KpiCard,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { ResourceStatus, formatInstant, humanize, type ResourceState } from "./admin-resource";
import { MutationErrorBanner, useMutation } from "./platform-shared";
import { EMAIL_TEMPLATE_PRESETS, type EmailTemplatePreset } from "./email-template-presets";

export type EmailTemplatesApi = Pick<PlatformApi, "emailTemplates">;

export const EMAIL_CATEGORY_LABELS: Record<string, string> = {
  AUTH: "Authentication",
  BILLING: "Billing",
  DELIVERY: "Delivery",
  ALERTS: "Alerts",
  ANNOUNCEMENTS: "System Notice",
  RENEWAL: "Renewal",
  SECURITY: "Security",
};

/** Card header gradient and category chip per category (unknown categories fall back to slate). */
const CATEGORY_THEME: Record<string, { gradient: string; chip: string }> = {
  AUTH: {
    gradient: "bg-gradient-to-r from-blue-600 to-indigo-600",
    chip: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  BILLING: {
    gradient: "bg-gradient-to-r from-violet-600 to-purple-600",
    chip: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  ALERTS: {
    gradient: "bg-gradient-to-r from-rose-600 to-red-600",
    chip: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  DELIVERY: {
    gradient: "bg-gradient-to-r from-teal-600 to-cyan-600",
    chip: "border-teal-500/30 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  ANNOUNCEMENTS: {
    gradient: "bg-gradient-to-r from-slate-700 to-slate-600",
    chip: "border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  RENEWAL: {
    gradient: "bg-gradient-to-r from-orange-500 to-amber-500",
    chip: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  SECURITY: {
    gradient: "bg-gradient-to-r from-emerald-600 to-green-600",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

const categoryTheme = (c: string | null) => CATEGORY_THEME[c ?? ""] ?? CATEGORY_THEME.ANNOUNCEMENTS;
const categoryLabel = (c: string | null) => (c ? EMAIL_CATEGORY_LABELS[c] ?? humanize(c) : "-");

function bannerOf(t: Pick<PlatformEmailTemplate, "category" | "banner_color">): EmailBannerColor {
  return inferEmailBannerColor({
    category: (t.category ?? "ANNOUNCEMENTS") as EmailTemplateCategory,
    bannerColor: (t.banner_color ?? undefined) as EmailBannerColor | undefined,
  });
}

function brandInitials(brand: string): string {
  return (
    brand
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "PW"
  );
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/** SMTP chip text built only from the server's SMTP settings response. */
export function smtpChipLabel(s: Pick<SmtpSettingsResponse, "host" | "provider" | "connection_status">): string {
  const where = s.host?.trim() || s.provider?.trim();
  return where ? `SMTP: ${where} (${s.connection_status})` : `SMTP (${s.connection_status})`;
}

function smtpChipTone(status: string): string {
  if (status === "CONNECTED") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "NOT_TESTED" || status === "NOT_CONFIGURED")
    return "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300";
  return "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300";
}

/** `{{name}}` placeholders used anywhere in the copy, in first-use order. */
export function extractVariables(...texts: string[]): string[] {
  const found: string[] = [];
  for (const text of texts) {
    for (const m of text.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)) {
      if (!found.includes(m[1])) found.push(m[1]);
    }
  }
  return found;
}

export function templateCounts(rows: PlatformEmailTemplate[]) {
  return {
    total: rows.length,
    active: rows.filter((t) => t.status === "ACTIVE").length,
    draft: rows.filter((t) => t.status === "DRAFT").length,
    categories: new Set(rows.map((t) => t.category).filter(Boolean)).size,
  };
}

export interface EditorState {
  name: string;
  category: EmailTemplateCategory;
  status: "ACTIVE" | "DRAFT";
  code: string;
  key: string;
  senderBrandName: string;
  bannerColor: EmailBannerColor;
  headerBadge: string;
  triggerDescription: string;
  showHighlightBox: boolean;
  footerNote: string;
  subject: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
}

export const EMPTY_EDITOR: EditorState = {
  name: "",
  category: "AUTH",
  status: "DRAFT",
  code: "",
  key: "",
  senderBrandName: "",
  bannerColor: "indigo",
  headerBadge: "",
  triggerDescription: "",
  showHighlightBox: true,
  footerNote: "",
  subject: "",
  headline: "",
  body: "",
  ctaLabel: "",
  ctaUrl: "",
};

function editorFrom(t: PlatformEmailTemplate): EditorState {
  return {
    name: t.name,
    category: (t.category ?? "AUTH") as EmailTemplateCategory,
    status: t.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
    code: t.code ?? "",
    key: t.key,
    senderBrandName: t.sender_brand_name ?? "",
    bannerColor: bannerOf(t),
    headerBadge: t.header_badge ?? "",
    triggerDescription: t.trigger_description ?? "",
    showHighlightBox: t.show_highlight_box,
    footerNote: t.footer_note ?? "",
    subject: t.subject ?? "",
    headline: t.headline ?? "",
    body: t.body_paragraphs ?? "",
    ctaLabel: t.cta_label ?? "",
    ctaUrl: t.cta_url ?? "",
  };
}

/**
 * Editor contents for a system preset. Pure: it only fills the form; the template is created on the server only
 * when the admin clicks "Create template". New templates start as drafts.
 */
export function editorFromPreset(p: EmailTemplatePreset): EditorState {
  return {
    ...EMPTY_EDITOR,
    name: p.name,
    category: p.category,
    status: "DRAFT",
    code: p.code,
    key: p.key,
    bannerColor: p.bannerColor,
    headerBadge: p.headerBadge.toUpperCase(),
    triggerDescription: p.triggerDescription,
    subject: p.subject,
    headline: p.headline,
    body: p.paragraphs.join("\n\n"),
    ctaLabel: p.ctaLabel ?? "",
    ctaUrl: p.ctaUrl ?? "",
  };
}

const orNull = (v: string) => (v.trim() ? v.trim() : null);

export function templateUpdateInput(e: EditorState): EmailTemplateUpdateInput {
  return {
    name: e.name.trim(),
    category: e.category,
    trigger_description: orNull(e.triggerDescription),
    header_badge: orNull(e.headerBadge),
    banner_color: e.bannerColor,
    sender_brand_name: orNull(e.senderBrandName),
    show_highlight_box: e.showHighlightBox,
    footer_note: orNull(e.footerNote),
    subject: e.subject.trim(),
    headline: e.headline.trim(),
    body_paragraphs: e.body.trim(),
    cta_label: orNull(e.ctaLabel),
    cta_url: orNull(e.ctaUrl),
    variables: extractVariables(e.subject, e.headline, e.body, e.ctaLabel, e.ctaUrl),
    status: e.status,
  };
}

function validateEditor(e: EditorState, creating: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!e.name.trim()) errors.name = "A template name is required.";
  if (creating && !e.key.trim()) errors.keyCode = "A template key is required.";
  if (!e.subject.trim()) errors.subject = "A subject is required.";
  if (!e.headline.trim()) errors.headline = "A headline is required.";
  if (!e.body.trim()) errors.body = "The email body is required.";
  return errors;
}

/** Server field names -> the error keys RichEmailEditor reads. */
const FIELD_ALIASES: Record<string, string> = { key: "keyCode", body_paragraphs: "body" };

/** "Start from a system template" choices. Clicking one only calls `onPick`; it never writes to the server. */
export function PresetPicker({ selected, onPick }: { selected: string | null; onPick: (p: EmailTemplatePreset | null) => void }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
        Start from a system template
      </div>
      <p className="text-[11px] text-[var(--color-text-muted)]">
        Picking one fills the editor below. Nothing is saved until you click Create template.
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onPick(null)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${selected === null ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"}`}
        >
          Blank
        </button>
        {EMAIL_TEMPLATE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={selected === p.id}
            onClick={() => onPick(p)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${selected === p.id ? "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]"}`}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface EmailTemplatesViewProps {
  state: ResourceState<PlatformEmailTemplate[]>;
  onRetry: () => void;
  api: EmailTemplatesApi;
  organizationNames: string[];
  /** Real SMTP settings for the header chip; omitted or failed -> no invented status. */
  smtp?: ResourceState<SmtpSettingsResponse>;
}

export function EmailTemplatesView({ state, onRetry, api, organizationNames, smtp }: EmailTemplatesViewProps) {
  const all = useMemo(() => (state.status === "ready" ? state.data : []), [state]);
  const ready = state.status === "ready";
  const counts = templateCounts(all);
  const categories = useMemo(
    () => Array.from(new Set([...Object.keys(EMAIL_CATEGORY_LABELS), ...all.map((t) => t.category ?? "").filter(Boolean)])),
    [all],
  );

  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformEmailTemplate | null>(null);
  const [form, setForm] = useState<EditorState>(EMPTY_EDITOR);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [sampleVars, setSampleVars] = useState<Record<string, string>>({});
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PlatformEmailTemplate | null>(null);
  const [device, setDevice] = useState<"DESKTOP" | "MOBILE">("DESKTOP");
  const [deleteTarget, setDeleteTarget] = useState<PlatformEmailTemplate | null>(null);

  const save = useMutation();
  const action = useMutation();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (t) =>
        (categoryFilter === "ALL" || t.category === categoryFilter) &&
        (statusFilter === "ALL" || t.status === statusFilter) &&
        (!q || [t.id, t.name, t.key, t.subject ?? "", t.code ?? ""].some((v) => v.toLowerCase().includes(q))),
    );
  }, [all, search, categoryFilter, statusFilter]);
  const hasFilters = search.trim() !== "" || categoryFilter !== "ALL" || statusFilter !== "ALL";
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_EDITOR);
    setPresetId(null);
    setSampleVars({});
    setLocalErrors({});
    save.clear();
    setEditorOpen(true);
  };
  const openEdit = (t: PlatformEmailTemplate) => {
    setPreview(null);
    setEditing(t);
    setForm(editorFrom(t));
    setPresetId(null);
    setSampleVars({});
    setLocalErrors({});
    save.clear();
    setEditorOpen(true);
  };
  const pickPreset = (p: EmailTemplatePreset | null) => {
    setPresetId(p?.id ?? null);
    setForm(p ? editorFromPreset(p) : EMPTY_EDITOR);
    setLocalErrors({});
    save.clear();
  };

  const serverErrors: Record<string, string> = {};
  for (const [field, message] of Object.entries(save.failure?.fieldErrors ?? {})) {
    serverErrors[FIELD_ALIASES[field] ?? field] = message;
  }
  const errors = { ...serverErrors, ...localErrors };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validateEditor(form, !editing);
    setLocalErrors(found);
    if (Object.keys(found).length > 0) return;
    const input = templateUpdateInput(form);
    const ok = await save.run(() =>
      editing
        ? api.emailTemplates.update(editing.id, input, editing.version)
        : api.emailTemplates.create({ ...input, key: form.key.trim(), code: orNull(form.code) }),
    );
    if (ok) {
      toast.success(editing ? "Template saved." : "Template created.");
      setEditorOpen(false);
      onRetry();
    }
  };

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    const ok = await action.run(fn);
    if (ok) {
      toast.success(label);
      onRetry();
    }
  };

  const set = <K extends keyof EditorState>(key: K) => (value: EditorState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const openPreview = (t: PlatformEmailTemplate) => {
    setDevice("DESKTOP");
    setPreview(t);
  };
  const cloneTemplate = (t: PlatformEmailTemplate) =>
    runAction(`Cloned "${t.name}" as a draft.`, () => api.emailTemplates.clone(t.id));

  const iconActions = (t: PlatformEmailTemplate) => (
    <>
      <AdminButton
        variant="ghost"
        size="xs"
        disabled={action.pending}
        title="Create a draft copy"
        aria-label={`Clone ${t.name}`}
        onClick={() => cloneTemplate(t)}
      >
        <Copy className="w-3.5 h-3.5" />
      </AdminButton>
      <AdminButton
        variant="ghost"
        size="xs"
        className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
        aria-label={`Delete ${t.name}`}
        title="Delete template"
        onClick={() => setDeleteTarget(t)}
      >
        <Trash2 className="w-3.5 h-3.5" />
      </AdminButton>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-[var(--color-text-primary)]">Email Templates</h2>
            {smtp?.status === "ready" && (
              <span
                data-testid="smtp-chip"
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${smtpChipTone(smtp.data.connection_status)}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {smtpChipLabel(smtp.data)}
              </span>
            )}
            {smtp?.status === "loading" && (
              <span className="inline-flex items-center rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11px] text-[var(--color-text-muted)]">
                SMTP: checking...
              </span>
            )}
            {smtp?.status === "error" && (
              <span className="inline-flex items-center rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-[11px] text-[var(--color-text-muted)]">
                SMTP status unavailable
              </span>
            )}
            {ready && (
              <span className="inline-flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-text-secondary)]">
                {counts.total} templates
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
            Design transactional notification emails with responsive desktop and mobile previews. Templates are stored on the server.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <AdminButton variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </AdminButton>
          <AdminButton variant="primary" size="sm" onClick={openCreate}>
            <Plus className="w-3.5 h-3.5" />
            New Template
          </AdminButton>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-200">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Templates are delivered through the platform SMTP connection. Configure the host, sender and credentials in{" "}
          <Link href="/super-admin/email-settings" className="font-semibold underline underline-offset-2">
            SMTP Email settings
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Templates" value={ready ? counts.total : "-"} sublabel="Stored on the server" icon={Mail} tone="blue" />
        <KpiCard label="Active" value={ready ? counts.active : "-"} sublabel="Used for sending" icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Drafts" value={ready ? counts.draft : "-"} sublabel="Not used yet" icon={FileEdit} tone="amber" />
        <KpiCard label="Categories" value={ready ? counts.categories : "-"} sublabel="In use" icon={Layers} tone="violet" />
      </div>

      <MutationErrorBanner failure={action.failure} onReload={() => { action.clear(); onRetry(); }} />

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          searchPlaceholder="Search ID, name or subject..."
          hasActiveFilters={hasFilters}
          onResetFilters={() => { setSearch(""); setCategoryFilter("ALL"); setStatusFilter("ALL"); setPage(1); }}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-44">
                <AdminSelect
                  aria-label="Filter template category"
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                  options={[{ label: "All categories", value: "ALL" }, ...categories.map((c) => ({ label: categoryLabel(c), value: c }))]}
                />
              </div>
              <div className="w-36">
                <AdminSelect
                  aria-label="Filter template status"
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  options={[
                    { label: "All statuses", value: "ALL" },
                    { label: "Active", value: "ACTIVE" },
                    { label: "Draft", value: "DRAFT" },
                  ]}
                />
              </div>
            </div>
          }
          rightActions={
            <div className="flex items-center rounded-lg border border-[var(--color-border)] p-0.5">
              <button
                type="button"
                aria-label="Table view"
                aria-pressed={viewMode === "TABLE"}
                onClick={() => setViewMode("TABLE")}
                className={`px-2 py-1 rounded-md text-xs inline-flex items-center gap-1 ${viewMode === "TABLE" ? "bg-[var(--color-elevated)] text-blue-600" : "text-[var(--color-text-muted)]"}`}
              >
                <List className="w-3.5 h-3.5" /> Table
              </button>
              <button
                type="button"
                aria-label="Cards view"
                aria-pressed={viewMode === "CARDS"}
                onClick={() => setViewMode("CARDS")}
                className={`px-2 py-1 rounded-md text-xs inline-flex items-center gap-1 ${viewMode === "CARDS" ? "bg-[var(--color-elevated)] text-blue-600" : "text-[var(--color-text-muted)]"}`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Cards
              </button>
            </div>
          }
        />

        <ResourceStatus
          state={ready ? { status: "ready", data: filtered } : state}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={Mail}
          emptyTitle={hasFilters ? "No templates match these filters" : "No email templates yet"}
          emptyDescription={hasFilters ? "Change or clear the filters to see more." : "Create the first template with New Template."}
        />

        {pageRows.length > 0 && viewMode === "CARDS" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {pageRows.map((t) => {
              const theme = categoryTheme(t.category);
              const brand = t.sender_brand_name || "ProWise";
              return (
                <SurfaceCard key={t.id} className="overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <div className={`${theme.gradient} px-3.5 py-3 flex items-center justify-between gap-2 text-white`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-7 w-7 rounded-lg bg-white/20 border border-white/25 flex items-center justify-center text-[11px] font-extrabold shrink-0">
                        {brandInitials(brand)}
                      </span>
                      <span className="font-bold text-sm tracking-tight truncate">{brand}</span>
                    </div>
                    {t.header_badge && (
                      <span className="inline-flex items-center rounded-full bg-white/20 border border-white/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 max-w-[50%] truncate">
                        {t.header_badge}
                      </span>
                    )}
                  </div>
                  <div className="p-3.5 space-y-2.5 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${theme.chip}`}>
                        {categoryLabel(t.category)}
                      </span>
                      <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate">{t.code || t.key}</span>
                    </div>
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-snug">{t.name}</h3>
                    {t.trigger_description && (
                      <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">{t.trigger_description}</p>
                    )}
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5 space-y-0.5">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">Subject</span>
                      <p className="text-xs font-medium text-[var(--color-text-primary)] truncate" title={t.subject ?? undefined}>{t.subject || "-"}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--color-border)] px-2.5 py-2">
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">Status</span>
                        <StatusBadge label={humanize(t.status)} tone={getStatusTone(t.status)} dot />
                      </div>
                      <div className="space-y-1 text-right">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--color-text-muted)] block">Variables</span>
                        <span className="text-xs font-semibold text-[var(--color-text-primary)]">{(t.variables ?? []).length}</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-3.5 pb-3.5 pt-2.5 border-t border-[var(--color-border)] space-y-2">
                    <div className="flex items-center gap-1.5">
                      <AdminButton variant="outline" size="xs" className="flex-1" onClick={() => openPreview(t)}>
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </AdminButton>
                      <AdminButton variant="primary" size="xs" className="flex-1" onClick={() => openEdit(t)}>
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </AdminButton>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-[var(--color-text-muted)] truncate" title={t.updated_by ? `by ${t.updated_by}` : undefined}>
                        Updated {formatDate(t.updated_at)}
                      </span>
                      <div className="flex items-center gap-0.5">{iconActions(t)}</div>
                    </div>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        )}

        {pageRows.length > 0 && viewMode === "TABLE" && (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-xs border-collapse min-w-[860px]" aria-label="Email templates">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <th className="px-4 py-3">ID / Code</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pageRows.map((t) => (
                  <tr key={t.id} className="hover:bg-[var(--color-hover)]">
                    <td className="px-4 py-3 font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">{t.code || t.key}</td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-semibold text-[var(--color-text-primary)]">{t.name}</p>
                      {t.trigger_description && <p className="text-[var(--color-text-secondary)] line-clamp-1">{t.trigger_description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${categoryTheme(t.category).chip}`}>{categoryLabel(t.category)}</span>
                    </td>
                    <td className="px-4 py-3 max-w-[240px] truncate text-[var(--color-text-secondary)]">{t.subject || "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge label={humanize(t.status)} tone={getStatusTone(t.status)} dot />
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      <p>{formatInstant(t.updated_at)}</p>
                      {t.updated_by && <p className="text-[11px] text-[var(--color-text-muted)]">{t.updated_by}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end items-center gap-1">
                        <AdminButton variant="outline" size="xs" onClick={() => openPreview(t)}>
                          <Eye className="w-3 h-3" />
                          Preview
                        </AdminButton>
                        <AdminButton variant="primary" size="xs" onClick={() => openEdit(t)}>
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </AdminButton>
                        {iconActions(t)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <PaginationBar
            currentPage={safePage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
          />
        )}
      </SurfaceCard>

      {/* Preview */}
      <AdminModal
        isOpen={preview !== null}
        onClose={() => setPreview(null)}
        title={preview?.name || "Email Preview"}
        description={preview ? `Subject: ${preview.subject ?? "-"}. Placeholders are shown in brackets.` : undefined}
        maxWidth="4xl"
      >
        {preview && (
          <div className="space-y-4">
            <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] p-0.5 w-fit">
              <button type="button" aria-label="Desktop preview" onClick={() => setDevice("DESKTOP")} className={`px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1 ${device === "DESKTOP" ? "bg-[var(--color-elevated)] text-blue-600" : "text-[var(--color-text-muted)]"}`}>
                <Monitor className="w-3.5 h-3.5" /> Desktop
              </button>
              <button type="button" aria-label="Mobile preview" onClick={() => setDevice("MOBILE")} className={`px-2.5 py-1 rounded-md text-xs inline-flex items-center gap-1 ${device === "MOBILE" ? "bg-[var(--color-elevated)] text-blue-600" : "text-[var(--color-text-muted)]"}`}>
                <Smartphone className="w-3.5 h-3.5" /> Mobile
              </button>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4">
              <ProWiseEmailPreviewCard
                device={device}
                bannerColor={bannerOf(preview)}
                senderBrandName={preview.sender_brand_name || "ProWise"}
                headerBadge={preview.header_badge || undefined}
                renderedHeadline={interpolateTemplate(preview.headline ?? "", {})}
                renderedBody={interpolateTemplate(preview.body_paragraphs ?? "", {})}
                renderedCtaLabel={interpolateTemplate(preview.cta_label ?? "", {})}
                showHighlightBox={preview.show_highlight_box}
                footerTimestamp={preview.footer_note || undefined}
              />
            </div>
            {(preview.variables ?? []).length > 0 && (
              <p className="text-[11px] text-[var(--color-text-muted)]">
                Placeholders: {(preview.variables ?? []).map((v) => `{{${v}}}`).join(", ")}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton variant="outline" size="sm" onClick={() => openEdit(preview)}>
                <Edit3 className="w-3.5 h-3.5" />
                Edit Template
              </AdminButton>
              <AdminButton variant="primary" size="sm" onClick={() => setPreview(null)}>Close Preview</AdminButton>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Editor */}
      <AdminModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editing ? `Visual Template Builder: ${editing.name}` : "Create New Email Notification Template"}
        description="The preview updates as you type. Saving writes the template to the server."
        maxWidth="5xl"
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <MutationErrorBanner failure={save.failure} onReload={() => { setEditorOpen(false); save.clear(); onRetry(); }} />
          {!editing && <PresetPicker selected={presetId} onPick={pickPreset} />}
          {errors.headline && (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              Headline: {errors.headline}
            </p>
          )}
          <RichEmailEditor
            isEditing={Boolean(editing)}
            name={form.name}
            onNameChange={(v) =>
              setForm((f) => ({
                ...f,
                name: v,
                key: editing ? f.key : v.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
              }))
            }
            category={form.category}
            onCategoryChange={set("category")}
            status={form.status}
            onStatusChange={set("status")}
            displayCode={form.code}
            onDisplayCodeChange={set("code")}
            keyCode={form.key}
            onKeyCodeChange={set("key")}
            senderBrandName={form.senderBrandName}
            onSenderBrandNameChange={set("senderBrandName")}
            bannerColor={form.bannerColor}
            onBannerColorChange={set("bannerColor")}
            headerBadge={form.headerBadge}
            onHeaderBadgeChange={set("headerBadge")}
            triggerDescription={form.triggerDescription}
            onTriggerDescriptionChange={set("triggerDescription")}
            showHighlightBox={form.showHighlightBox}
            onShowHighlightBoxChange={set("showHighlightBox")}
            footerNote={form.footerNote}
            onFooterNoteChange={set("footerNote")}
            subject={form.subject}
            onSubjectChange={set("subject")}
            headline={form.headline}
            onHeadlineChange={set("headline")}
            bodyParagraphs={form.body}
            onBodyParagraphsChange={set("body")}
            ctaLabel={form.ctaLabel}
            onCtaLabelChange={set("ctaLabel")}
            ctaUrl={form.ctaUrl}
            onCtaUrlChange={set("ctaUrl")}
            sampleVars={sampleVars}
            onSampleVarsChange={setSampleVars}
            organizationSuggestions={organizationNames}
            errors={errors}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setEditorOpen(false)}>Cancel</AdminButton>
            <AdminButton type="submit" variant="primary" size="sm" isLoading={save.pending}>
              {editing ? "Save template" : "Create template"}
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      <ConfirmActionModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Delete template "${deleteTarget?.name ?? ""}"?`}
        description="The template is removed from the server. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          const target = deleteTarget;
          if (target) void runAction("Template deleted.", () => api.emailTemplates.remove(target.id, target.version));
        }}
      />
    </div>
  );
}
