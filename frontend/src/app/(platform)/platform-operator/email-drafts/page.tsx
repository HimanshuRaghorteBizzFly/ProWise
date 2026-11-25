"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Edit3,
  Eye,
  LayoutGrid,
  List,
  MailPlus,
  MessageSquareWarning,
  Monitor,
  Plus,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useDebounced } from "@/components/super-admin/admin-resource";
import type { OperatorEmailDraft, OperatorEmailDraftInput } from "@/types/operator-console";
import { operatorApi } from "../_services/operator-api";
import { useOperatorPermissions } from "../_services/operator-access";
import { formatDateTime } from "../_services/operator-service";
import {
  FieldErrorText,
  MutationNotice,
  NotAvailableButton,
  OperatorResourceStatus,
  humanizeCode,
  pageItemsOf,
  pageTotalOf,
  toServerPaging,
  useOperatorMutation,
  useOperatorResource,
} from "../_components/OperatorLive";
import {
  BulkSelectionBar,
  ConfirmModal,
  DemoDataBanner,
  EmptyState,
  FilterBar,
  OpButton,
  OpInput,
  OpModal,
  OpSelect,
  OpTextarea,
  PageHeader,
  PaginationBar,
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type DraftCategoryTheme = {
  gradient: string;
  badge: string;
  border: string;
  cta: string;
};

const DRAFT_CATEGORY_THEMES: Record<string, DraftCategoryTheme> = {
  "Incident Notice": {
    gradient: "bg-gradient-to-r from-rose-600 to-orange-500",
    badge: "border-rose-500/35 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    border: "border-rose-500/35 hover:border-rose-500/65",
    cta: "bg-rose-600",
  },
  Billing: {
    gradient: "bg-gradient-to-r from-violet-600 to-indigo-600",
    badge: "border-violet-500/35 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    border: "border-violet-500/35 hover:border-violet-500/65",
    cta: "bg-violet-600",
  },
  Onboarding: {
    gradient: "bg-gradient-to-r from-teal-600 to-emerald-600",
    badge: "border-teal-500/35 bg-teal-500/15 text-teal-700 dark:text-teal-300",
    border: "border-teal-500/35 hover:border-teal-500/65",
    cta: "bg-[#0D9488]",
  },
  Reminders: {
    gradient: "bg-gradient-to-r from-amber-600 to-orange-500",
    badge: "border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    border: "border-amber-500/35 hover:border-amber-500/65",
    cta: "bg-amber-600",
  },
};

/** Category is free text on the server (max 60); unknown categories use the first theme. */
function categoryTheme(category: string | null | undefined): DraftCategoryTheme {
  return DRAFT_CATEGORY_THEMES[category ?? ""] || DRAFT_CATEGORY_THEMES["Incident Notice"];
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted for Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? humanizeCode(status);
}

/** The server only accepts changes (edit, delete, submit) in these states (409 INVALID_STATE otherwise). */
const EDITABLE_STATUSES = new Set(["DRAFT", "REJECTED"]);
const isEditable = (d: OperatorEmailDraft) => EDITABLE_STATUSES.has(d.status);
const LOCKED_REASON = "Only drafts in Draft or Rejected can be changed.";

/** Placeholder substitution for previews only; saved text is never changed by it. */
function sanitizeDraftText(text: string | null | undefined): string {
  return (text || "")
    .replaceAll("{{org_name}}", "Acme Health Technologies")
    .replaceAll("{{recipient_name}}", "Sarah Chen");
}

function DraftEmailPreviewCard({
  device,
  category,
  subject,
  headline,
  bodyText,
  ctaLabel,
}: {
  device: "DESKTOP" | "MOBILE";
  category: string;
  subject: string;
  headline: string;
  bodyText: string;
  ctaLabel: string;
}) {
  const theme = categoryTheme(category);
  const isMobile = device === "MOBILE";

  return (
    <div
      className={`w-full mx-auto bg-[var(--color-surface)] overflow-hidden shadow-lg transition-all ${
        isMobile
          ? "max-w-[325px] rounded-[28px] border-[3px] border-slate-700 dark:border-slate-500"
          : "max-w-[540px] rounded-2xl border border-[var(--color-border)]"
      }`}
    >
      {!isMobile ? (
        <div className="bg-[var(--color-sidebar)] border-b border-[var(--color-border)] px-4 py-2 flex items-center gap-2">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="text-[11px] font-medium text-[var(--color-text-muted)] ml-1 truncate">
            ProWise — Desktop Mail Preview
          </span>
        </div>
      ) : (
        <div className="bg-[var(--color-sidebar)] border-b border-[var(--color-border)] px-4 pt-2.5 pb-2 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold text-[var(--color-text-primary)]">
            <span>9:41</span>
            <span className="h-3 w-14 rounded-full bg-slate-950 border border-slate-800 inline-block" aria-hidden="true" />
            <span className="text-[9px] text-[var(--color-text-secondary)]">5G • 100%</span>
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-teal-600 dark:text-teal-400">&lsaquo; Inbox</span>
            <span className="text-[10px] text-[var(--color-text-muted)]">Today, 9:41 AM</span>
          </div>
        </div>
      )}

      <div className={`${theme.gradient} px-5 py-3.5 flex items-center justify-between gap-2 text-white`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-7 w-7 rounded-lg bg-white/20 border border-white/25 flex items-center justify-center font-extrabold text-xs shrink-0">
            PW
          </span>
          <span className="font-bold text-sm tracking-tight truncate">ProWise</span>
        </div>
        <span className="inline-flex items-center rounded-full bg-white/20 border border-white/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shrink-0">
          {category}
        </span>
      </div>

      <div className="p-5 space-y-3.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
          {subject.trim() || "Subject line will preview here..."}
        </p>
        <h4 className="text-base font-extrabold text-[var(--color-text-primary)] leading-snug">
          {headline.trim() || "Your Email Headline"}
        </h4>
        <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed space-y-2">
          {bodyText.trim() ? (
            sanitizeDraftText(bodyText)
              .split(/\n+/)
              .filter(Boolean)
              .map((p, idx) => <p key={idx}>{p}</p>)
          ) : (
            <p className="italic text-[var(--color-text-muted)]">
              (Start typing your message on the left to preview the live customer email.)
            </p>
          )}
        </div>
        {ctaLabel.trim() && (
          <div className="pt-1 flex justify-center">
            <span
              className={`inline-flex items-center justify-center rounded-full px-5 py-2 text-xs font-semibold text-white ${theme.cta} ${
                isMobile ? "w-full" : ""
              }`}
            >
              {ctaLabel}
            </span>
          </div>
        )}
      </div>

      <div className="border-t border-[var(--color-border)] bg-[var(--color-app-bg)] px-4 py-2.5 text-center text-[10px] text-[var(--color-text-muted)]">
        Prepared by Platform Operations · Subject to Super Admin approval before delivery
      </div>
    </div>
  );
}

type DraftSortField = "name" | "category" | "status" | "updatedAt";

export default function OperatorEmailDraftsPage() {
  const { can } = useOperatorPermissions();
  const canManage = can("communications.draft");

  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<DraftSortField>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const debouncedSearch = useDebounced(search);

  const paging = toServerPaging(page, pageSize);
  const { state, reload } = useOperatorResource(
    () => operatorApi.emailDrafts.list({ status: statusFilter, search: debouncedSearch, ...paging }),
    `email-drafts:${statusFilter}:${debouncedSearch}:${paging.page}:${paging.size}`,
  );
  const reloadList = useCallback(() => void reload(), [reload]);
  const { busy, notice, fieldErrors, clearNotice, run } = useOperatorMutation(reloadList);
  const emailDrafts = useMemo(() => pageItemsOf(state), [state]);
  const total = pageTotalOf(state);

  // Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<OperatorEmailDraft | null>(null);
  const editingId = editing?.id ?? null;
  const [previewDevice, setPreviewDevice] = useState<"DESKTOP" | "MOBILE">("DESKTOP");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Incident Notice");
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [audienceDescription, setAudienceDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Preview Modal
  const [previewDraft, setPreviewDraft] = useState<OperatorEmailDraft | null>(null);
  const [standaloneDevice, setStandaloneDevice] = useState<"DESKTOP" | "MOBILE">("DESKTOP");

  // Confirm Modals
  const [submitTarget, setSubmitTarget] = useState<OperatorEmailDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OperatorEmailDraft | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const closeOverlays = () => {
    setEditorOpen(false);
    setPreviewDraft(null);
    setSubmitTarget(null);
    setDeleteTarget(null);
    setBulkDeleteOpen(false);
  };

  const handleSort = (field: DraftSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "updatedAt" ? "desc" : "asc");
    }
  };

  /** The server filters (status, search) and pages; sorting reorders the loaded page only. */
  const filtered = useMemo(() => {
    return [...emailDrafts].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "category") cmp = (a.category ?? "").localeCompare(b.category ?? "");
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else cmp = new Date(a.updated_at ?? 0).getTime() - new Date(b.updated_at ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [emailDrafts, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, pageSize]);

  const safePage = page;
  const paginated = filtered;

  const {
    selectedIds,
    setSelectedIds,
    selectedSet,
    allPageSelected,
    somePageSelected,
    toggleSelectPage,
    toggleSelectOne,
  } = useTableSelection(
    filtered.map((d) => d.id),
    paginated.map((d) => d.id)
  );

  const selectedRows = emailDrafts.filter((d) => selectedSet.has(d.id));

  const openCreate = () => {
    closeOverlays();
    clearNotice();
    setEditing(null);
    setPreviewDevice("DESKTOP");
    setName("");
    setCategory("Incident Notice");
    setSubject("");
    setHeadline("");
    setBodyText("");
    setBodyHtml("");
    setCtaLabel("");
    setAudienceDescription("");
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (draft: OperatorEmailDraft) => {
    if (!isEditable(draft)) return;
    closeOverlays();
    clearNotice();
    setEditing(draft);
    setPreviewDevice("MOBILE");
    setName(draft.name);
    setCategory(draft.category ?? "Incident Notice");
    // The stored text is edited as-is (placeholders are only filled in previews).
    setSubject(draft.subject);
    setHeadline(draft.headline ?? "");
    setBodyText(draft.body_text);
    setBodyHtml(draft.body_html ?? "");
    setCtaLabel(draft.cta_label ?? "");
    setAudienceDescription(draft.audience_description ?? "");
    setFormError(null);
    setEditorOpen(true);
  };

  const openPreview = (draft: OperatorEmailDraft) => {
    closeOverlays();
    setStandaloneDevice("DESKTOP");
    setPreviewDraft(draft);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3 || subject.trim().length < 3 || bodyText.trim().length < 10) {
      setFormError("Please fill in draft name, email subject, and message content.");
      return;
    }
    setFormError(null);
    const body: OperatorEmailDraftInput = {
      name: name.trim(),
      category,
      subject: subject.trim(),
      headline: headline.trim() || name.trim(),
      body_text: bodyText.trim(),
      body_html: bodyHtml.trim() || null,
      cta_label: ctaLabel.trim() || (editing ? "Open ProWise" : "Open Workspace"),
      audience_description: audienceDescription.trim() || null,
    };
    // A failed save (unsafe HTML, stale version, permission) keeps the editor open with the server's message.
    const ok = editing
      ? await run(
          `save-${editing.id}`,
          () => operatorApi.emailDrafts.update(editing.id, body, editing.version),
          editing.status === "REJECTED" ? "Email draft updated and returned to Draft." : "Email draft updated.",
        )
      : await run(
          "create",
          () => operatorApi.emailDrafts.create(body),
          "Email draft saved. Submit to Super Admin when ready.",
        );
    if (ok) setEditorOpen(false);
  };

  /** One request per draft (there is no bulk endpoint); each sends that draft's own expected_version. */
  const bulkSubmit = () => {
    const eligible = selectedRows.filter(isEditable);
    if (eligible.length === 0) {
      toast.info("Selected drafts are already submitted or approved.");
      return;
    }
    void run(
      "bulk-submit",
      async () => {
        for (const d of eligible) await operatorApi.emailDrafts.submit(d.id, d.version);
      },
      `Submitted ${eligible.length} draft(s) for Super Admin review.`,
    ).then((ok) => ok && setSelectedIds([]));
  };

  const bulkDelete = () => {
    const eligible = selectedRows.filter(isEditable);
    if (eligible.length === 0) {
      toast.info("Only drafts in Draft or Rejected can be deleted.");
      return;
    }
    void run(
      "bulk-delete",
      async () => {
        for (const d of eligible) await operatorApi.emailDrafts.remove(d.id, d.version);
      },
      `Deleted ${eligible.length} email draft(s).`,
    ).then((ok) => ok && setSelectedIds([]));
  };

  const bulkActions = (
    <>
      <OpButton
        variant="primary"
        size="xs"
        disabled={!canManage}
        isLoading={busy === "bulk-submit"}
        onClick={bulkSubmit}
      >
        <Send className="w-3.5 h-3.5" />
        Submit ({selectedIds.length})
      </OpButton>
      <OpButton
        variant="danger"
        size="xs"
        disabled={!canManage}
        isLoading={busy === "bulk-delete"}
        onClick={() => setBulkDeleteOpen(true)}
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete Selected
      </OpButton>
    </>
  );

  const editTitle = (d: OperatorEmailDraft) => (isEditable(d) ? undefined : LOCKED_REASON);

  const reviewerNote = (d: OperatorEmailDraft) =>
    d.status === "REJECTED" && d.reviewer_note ? (
      <div className="flex items-start gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] text-rose-700 dark:text-rose-300">
        <MessageSquareWarning className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          <span className="font-semibold">Rejected by Super Admin:</span> {d.reviewer_note}
        </span>
      </div>
    ) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Template Drafts"
        badge={state.status === "ready" ? `${total} Drafts` : undefined}
        liveData
        description="Write customer-ready email drafts in plain English, preview on Desktop & Mobile, and submit for Super Admin approval."
        actions={
          <OpButton variant="primary" size="sm" disabled={!canManage} onClick={openCreate}>
            <Plus className="w-4 h-4" />
            New Email Draft
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Approval Boundary"
        description="Operators prepare and edit email drafts without curly-brace syntax or technical templates. Super Admin holds final approval to publish live templates."
      />

      {!editorOpen && <MutationNotice notice={notice} onReload={reloadList} onDismiss={clearNotice} />}

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search draft name, subject, or category..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
          filters={
            <div className="w-48">
              <OpSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter draft status"
                options={[
                  { label: "All States", value: "ALL" },
                  { label: "Draft", value: "DRAFT" },
                  { label: "Submitted for Approval", value: "SUBMITTED" },
                  { label: "Approved", value: "APPROVED" },
                  { label: "Rejected", value: "REJECTED" },
                ]}
              />
            </div>
          }
          rightActions={
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("CARDS")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "CARDS"
                    ? "bg-[#0D9488] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setViewMode("TABLE")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "TABLE"
                    ? "bg-[#0D9488] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                Table
              </button>
            </div>
          }
        />

        {state.status !== "ready" ? (
          <OperatorResourceStatus
            state={state}
            isEmpty={() => false}
            onRetry={reloadList}
            emptyIcon={MailPlus}
            emptyTitle="No email template drafts found"
            emptyDescription="Create a plain-English customer notification draft for Super Admin review."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={MailPlus}
            title="No email template drafts found"
            description="Create a plain-English customer notification draft for Super Admin review."
            actionLabel={canManage ? "New Email Draft" : undefined}
            onAction={canManage ? openCreate : undefined}
          />
        ) : viewMode === "CARDS" ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-elevated)]/40 overflow-hidden">
              <div className="px-4 py-2 flex items-center justify-between text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = somePageSelected;
                    }}
                    onChange={toggleSelectPage}
                    aria-label="Select all email drafts on this page"
                    className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                  />
                  <span>Select all on page ({paginated.length})</span>
                </label>
              </div>
              <BulkSelectionBar
                selectedCount={selectedIds.length}
                totalFilteredCount={filtered.length}
                onSelectAllMatching={() => setSelectedIds(filtered.map((d) => d.id))}
                onClear={() => setSelectedIds([])}
                actions={bulkActions}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {paginated.map((draft, idx) => {
                const srNo = (safePage - 1) * pageSize + idx + 1;
                const isSelected = selectedSet.has(draft.id);
                const theme = categoryTheme(draft.category);
                const editable = isEditable(draft);
                return (
                  <div
                    key={draft.id}
                    className={`rounded-xl border bg-[var(--color-app-bg)] overflow-hidden flex flex-col justify-between transition-all ${
                      isSelected ? "border-teal-500 ring-1 ring-teal-500" : theme.border
                    }`}
                  >
                    <div>
                      <div className={`${theme.gradient} px-4 py-2.5 flex items-center justify-between gap-2 text-white`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(draft.id)}
                            aria-label={`Select ${draft.name}`}
                            className="h-4 w-4 rounded border-white/50 accent-white cursor-pointer"
                          />
                          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                            #{srNo}
                          </span>
                          <span className="font-semibold text-xs truncate">{draft.category ?? "Uncategorized"}</span>
                        </div>
                        <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[10px] font-semibold shrink-0">
                          {statusLabel(draft.status)}
                        </span>
                      </div>

                      <div className="p-4 space-y-2">
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{draft.name}</h3>
                        <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                          Subject: {sanitizeDraftText(draft.subject)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                          {sanitizeDraftText(draft.body_text)}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          Updated {formatDateTime(draft.updated_at ?? draft.created_at ?? "")}
                        </p>
                        {reviewerNote(draft)}
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <OpButton variant="outline" size="xs" onClick={() => openPreview(draft)}>
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </OpButton>
                        <OpButton
                          variant="outline"
                          size="xs"
                          disabled={!canManage || !editable}
                          title={editTitle(draft)}
                          onClick={() => openEdit(draft)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </OpButton>
                        <OpButton
                          variant="ghost"
                          size="xs"
                          disabled={!canManage || !editable}
                          title={editTitle(draft)}
                          aria-label={`Delete ${draft.name}`}
                          onClick={() => {
                            closeOverlays();
                            setDeleteTarget(draft);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </OpButton>
                      </div>

                      {editable ? (
                        <OpButton
                          variant="primary"
                          size="xs"
                          disabled={!canManage}
                          isLoading={busy === `submit-${draft.id}`}
                          onClick={() => {
                            closeOverlays();
                            setSubmitTarget(draft);
                          }}
                        >
                          <Send className="w-3.5 h-3.5" />
                          Submit for Approval
                        </OpButton>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {statusLabel(draft.status)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((d) => d.id))}
              onClear={() => setSelectedIds([])}
              actions={bulkActions}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[820px]">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-elevated)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    <th className="py-2.5 px-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = somePageSelected;
                        }}
                        onChange={toggleSelectPage}
                        aria-label="Select all email drafts on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Draft Name" active={sortField === "name"} direction={sortDir} onSort={() => handleSort("name")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Category" active={sortField === "category"} direction={sortDir} onSort={() => handleSort("category")} />
                    </th>
                    <th className="py-2.5 px-3.5">Subject</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Updated" active={sortField === "updatedAt"} direction={sortDir} onSort={() => handleSort("updatedAt")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((draft, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(draft.id);
                    const theme = categoryTheme(draft.category);
                    const editable = isEditable(draft);
                    return (
                      <tr key={draft.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(draft.id)}
                            aria-label={`Select ${draft.name}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 font-semibold text-[var(--color-text-primary)]">{draft.name}</td>
                        <td className="py-3 px-3.5">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${theme.badge}`}>
                            {draft.category ?? "Uncategorized"}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 max-w-[240px] truncate text-[var(--color-text-secondary)]">
                          {sanitizeDraftText(draft.subject)}
                          {draft.status === "REJECTED" && draft.reviewer_note && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-300 truncate" title={draft.reviewer_note}>
                              Reviewer: {draft.reviewer_note}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={statusLabel(draft.status)} tone={getStatusTone(statusLabel(draft.status))} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatDateTime(draft.updated_at ?? draft.created_at ?? "")}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <OpButton variant="outline" size="xs" onClick={() => openPreview(draft)}>
                              Preview
                            </OpButton>
                            <OpButton
                              variant="outline"
                              size="xs"
                              disabled={!canManage || !editable}
                              title={editTitle(draft)}
                              onClick={() => openEdit(draft)}
                            >
                              Edit
                            </OpButton>
                            <OpButton
                              variant="ghost"
                              size="xs"
                              disabled={!canManage || !editable}
                              title={editTitle(draft)}
                              aria-label={`Delete ${draft.name}`}
                              onClick={() => {
                                closeOverlays();
                                setDeleteTarget(draft);
                              }}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                            </OpButton>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      </SurfaceCard>

      {/* Visual Plain-English Draft Builder Modal */}
      <OpModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={editingId ? "Edit Email Template Draft" : "Create New Email Notification Draft"}
        description="Write customer-friendly email copy below. Live preview updates automatically on Desktop & Mobile."
        maxWidth="5xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}
          <MutationNotice notice={notice} onReload={reloadList} onDismiss={clearNotice} />
          {editing && reviewerNote(editing)}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <OpInput
                  label="Draft Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Scheduled Upgrade Notice"
                  error={fieldErrors.name}
                />
                <OpSelect
                  label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  options={[
                    { label: "Incident Notice", value: "Incident Notice" },
                    { label: "Billing", value: "Billing" },
                    { label: "Onboarding", value: "Onboarding" },
                    { label: "Reminders", value: "Reminders" },
                    ...(["Incident Notice", "Billing", "Onboarding", "Reminders"].includes(category)
                      ? []
                      : [{ label: category, value: category }]),
                  ]}
                />
              </div>

              <OpInput
                label="Email Subject Line *"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Scheduled Maintenance Window for Acme Health"
                error={fieldErrors.subject}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <OpInput
                  label="Email Main Headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Upcoming Platform Improvement"
                  error={fieldErrors.headline}
                />
                <OpInput
                  label="Action Button Label"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="e.g. Open Service Status"
                  error={fieldErrors.cta_label}
                />
              </div>

              <OpTextarea
                label="Message Content (Plain Text) *"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Type your clear, helpful message here in plain English..."
                rows={6}
                error={fieldErrors.body_text}
              />

              <div>
                <OpTextarea
                  label="HTML Body (optional)"
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  placeholder="Optional HTML version. Scripts, iframes, event handlers and javascript: links are refused by the server."
                  rows={4}
                />
                <FieldErrorText errors={fieldErrors} field="body_html" />
              </div>

              <OpInput
                label="Audience Description"
                value={audienceDescription}
                onChange={(e) => setAudienceDescription(e.target.value)}
                placeholder="e.g. Workspace owners on the Enterprise plan"
                error={fieldErrors.audience_description}
              />
            </div>

            <div className="lg:col-span-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-3 flex flex-col">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-[var(--color-text-primary)]">
                  Live Real-Time Preview
                </span>
                <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("DESKTOP")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium ${
                      previewDevice === "DESKTOP"
                        ? "bg-[#0D9488] text-white"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("MOBILE")}
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium ${
                      previewDevice === "MOBILE"
                        ? "bg-[#0D9488] text-white"
                        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Mobile
                  </button>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center py-1 overflow-y-auto">
                <DraftEmailPreviewCard
                  device={previewDevice}
                  category={category}
                  subject={subject}
                  headline={headline}
                  bodyText={bodyText}
                  ctaLabel={ctaLabel}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setEditorOpen(false)}>
              Cancel
            </OpButton>
            <OpButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={!canManage}
              isLoading={busy === "create" || (editingId !== null && busy === `save-${editingId}`)}
            >
              {editingId ? "Save Changes" : "Save Draft"}
            </OpButton>
          </div>
        </form>
      </OpModal>

      {/* Customer Preview Modal */}
      <OpModal
        isOpen={Boolean(previewDraft)}
        onClose={() => setPreviewDraft(null)}
        title={previewDraft ? `Preview: ${previewDraft.name}` : "Preview"}
        description="Responsive Desktop and Mobile view of this notification draft."
        maxWidth="2xl"
      >
        {previewDraft && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStandaloneDevice("DESKTOP")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium ${
                    standaloneDevice === "DESKTOP"
                      ? "bg-[#0D9488] text-white"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setStandaloneDevice("MOBILE")}
                  className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium ${
                    standaloneDevice === "MOBILE"
                      ? "bg-[#0D9488] text-white"
                      : "text-[var(--color-text-secondary)]"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  Mobile
                </button>
              </div>
            </div>

            <DraftEmailPreviewCard
              device={standaloneDevice}
              category={previewDraft.category ?? "Incident Notice"}
              subject={sanitizeDraftText(previewDraft.subject)}
              headline={sanitizeDraftText(previewDraft.headline)}
              bodyText={sanitizeDraftText(previewDraft.body_text)}
              ctaLabel={previewDraft.cta_label ?? ""}
            />

            {reviewerNote(previewDraft)}

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <NotAvailableButton
                variant="outline"
                size="sm"
                reason="nothing is sent from the operator console; drafts are reviewed by a Super Admin"
              >
                Send Test Email
              </NotAvailableButton>
              <OpButton
                variant="outline"
                size="sm"
                disabled={!canManage || !isEditable(previewDraft)}
                title={editTitle(previewDraft)}
                onClick={() => openEdit(previewDraft)}
              >
                Edit Draft
              </OpButton>
              <OpButton variant="primary" size="sm" onClick={() => setPreviewDraft(null)}>
                Close Preview
              </OpButton>
            </div>
          </div>
        )}
      </OpModal>

      <ConfirmModal
        isOpen={Boolean(submitTarget)}
        onClose={() => setSubmitTarget(null)}
        title="Submit Email Draft for Approval?"
        description={
          submitTarget
            ? `Send "${submitTarget.name}" to Super Admin for final review before it can be activated for customer delivery?`
            : ""
        }
        confirmLabel="Submit to Super Admin"
        variant="primary"
        onConfirm={() => {
          if (submitTarget) {
            const target = submitTarget;
            void run(
              `submit-${target.id}`,
              () => operatorApi.emailDrafts.submit(target.id, target.version),
              `Submitted "${target.name}" for Super Admin approval.`,
            );
          }
        }}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Email Draft?"
        description={deleteTarget ? `Remove "${deleteTarget.name}" from operator drafts?` : ""}
        confirmLabel="Delete Draft"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) {
            const target = deleteTarget;
            void run(
              `delete-${target.id}`,
              () => operatorApi.emailDrafts.remove(target.id, target.version),
              "Email draft removed.",
            );
          }
        }}
      />

      <ConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.length} Selected Draft(s)?`}
        description="Removes all selected drafts from the Platform Operator draft list."
        confirmLabel={`Delete ${selectedIds.length} Draft(s)`}
        variant="danger"
        onConfirm={bulkDelete}
      />
    </div>
  );
}
