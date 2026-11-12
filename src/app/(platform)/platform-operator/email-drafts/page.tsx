"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Edit3,
  Eye,
  LayoutGrid,
  List,
  MailPlus,
  Monitor,
  Plus,
  Send,
  Smartphone,
  Trash2,
} from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { EmailTemplateDraft } from "../_types";
import { formatDateTime } from "../_services/operator-service";
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

const DRAFT_CATEGORY_THEMES: Record<EmailTemplateDraft["category"], DraftCategoryTheme> = {
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

function sanitizeDraftText(text: string): string {
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
  category: EmailTemplateDraft["category"];
  subject: string;
  headline: string;
  bodyText: string;
  ctaLabel: string;
}) {
  const theme = DRAFT_CATEGORY_THEMES[category] || DRAFT_CATEGORY_THEMES["Incident Notice"];
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
  const emailDrafts = usePlatformOperatorStore((s) => s.emailDrafts);
  const createEmailDraft = usePlatformOperatorStore((s) => s.createEmailDraft);
  const updateEmailDraft = usePlatformOperatorStore((s) => s.updateEmailDraft);
  const deleteEmailDraft = usePlatformOperatorStore((s) => s.deleteEmailDraft);
  const submitEmailDraftForApproval = usePlatformOperatorStore((s) => s.submitEmailDraftForApproval);
  const bulkSubmitEmailDrafts = usePlatformOperatorStore((s) => s.bulkSubmitEmailDrafts);
  const bulkDeleteEmailDrafts = usePlatformOperatorStore((s) => s.bulkDeleteEmailDrafts);
  const { can } = useOperatorPermissions();
  const canManage = can("communications.draft");

  const [viewMode, setViewMode] = useState<"CARDS" | "TABLE">("CARDS");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<DraftSortField>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Editor Modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<"DESKTOP" | "MOBILE">("DESKTOP");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<EmailTemplateDraft["category"]>("Incident Notice");
  const [subject, setSubject] = useState("");
  const [headline, setHeadline] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Preview Modal
  const [previewDraft, setPreviewDraft] = useState<EmailTemplateDraft | null>(null);
  const [standaloneDevice, setStandaloneDevice] = useState<"DESKTOP" | "MOBILE">("DESKTOP");

  // Confirm Modals
  const [submitTarget, setSubmitTarget] = useState<EmailTemplateDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplateDraft | null>(null);
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = emailDrafts.filter((d) => {
      const matchesQ =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.subject.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || d.status === statusFilter;
      return matchesQ && matchesStatus;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "category") cmp = a.category.localeCompare(b.category);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [emailDrafts, search, statusFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

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

  const openCreate = () => {
    closeOverlays();
    setEditingId(null);
    setPreviewDevice("DESKTOP");
    setName("");
    setCategory("Incident Notice");
    setSubject("");
    setHeadline("");
    setBodyText("");
    setCtaLabel("");
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (draft: EmailTemplateDraft) => {
    closeOverlays();
    setEditingId(draft.id);
    setPreviewDevice("MOBILE");
    setName(draft.name);
    setCategory(draft.category);
    setSubject(sanitizeDraftText(draft.subject));
    setHeadline(sanitizeDraftText(draft.headline));
    setBodyText(sanitizeDraftText(draft.bodyText));
    setCtaLabel(draft.ctaLabel);
    setFormError(null);
    setEditorOpen(true);
  };

  const openPreview = (draft: EmailTemplateDraft) => {
    closeOverlays();
    setStandaloneDevice("DESKTOP");
    setPreviewDraft(draft);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3 || subject.trim().length < 3 || bodyText.trim().length < 10) {
      setFormError("Please fill in draft name, email subject, and message content.");
      return;
    }
    if (editingId) {
      updateEmailDraft(editingId, {
        name: name.trim(),
        category,
        subject: subject.trim(),
        headline: headline.trim() || name.trim(),
        bodyText: bodyText.trim(),
        ctaLabel: ctaLabel.trim() || "Open ProWise",
      });
      toast.success("Email draft updated.");
    } else {
      createEmailDraft({
        name: name.trim(),
        category,
        subject: subject.trim(),
        headline: headline.trim() || name.trim(),
        bodyText: bodyText.trim(),
        ctaLabel: ctaLabel.trim() || "Open Workspace",
      });
      toast.success("Email draft saved. Submit to Super Admin when ready.");
    }
    setEditorOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Template Drafts"
        badge={`${emailDrafts.length} Drafts`}
        demoLabel="Draft -> Super Admin Approval"
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
                  { label: "Draft", value: "Draft" },
                  { label: "Submitted for Approval", value: "Submitted for Approval" },
                  { label: "Approved", value: "Approved" },
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

        {paginated.length === 0 ? (
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
                actions={
                  <>
                    <OpButton
                      variant="primary"
                      size="xs"
                      disabled={!canManage}
                      onClick={() => {
                        const count = bulkSubmitEmailDrafts(selectedIds);
                        if (count > 0) toast.success(`Submitted ${count} draft(s) for Super Admin review.`);
                        else toast.info("Selected drafts are already submitted or approved.");
                        setSelectedIds([]);
                      }}
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submit ({selectedIds.length})
                    </OpButton>
                    <OpButton
                      variant="danger"
                      size="xs"
                      disabled={!canManage}
                      onClick={() => setBulkDeleteOpen(true)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Selected
                    </OpButton>
                  </>
                }
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {paginated.map((draft, idx) => {
                const srNo = (safePage - 1) * pageSize + idx + 1;
                const isSelected = selectedSet.has(draft.id);
                const theme = DRAFT_CATEGORY_THEMES[draft.category];
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
                          <span className="font-semibold text-xs truncate">{draft.category}</span>
                        </div>
                        <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[10px] font-semibold shrink-0">
                          {draft.status}
                        </span>
                      </div>

                      <div className="p-4 space-y-2">
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{draft.name}</h3>
                        <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                          Subject: {sanitizeDraftText(draft.subject)}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2">
                          {sanitizeDraftText(draft.bodyText)}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-muted)]">
                          Updated {formatDateTime(draft.updatedAt)}
                        </p>
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
                          disabled={!canManage}
                          onClick={() => openEdit(draft)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </OpButton>
                        <OpButton
                          variant="ghost"
                          size="xs"
                          disabled={!canManage}
                          aria-label={`Delete ${draft.name}`}
                          onClick={() => {
                            closeOverlays();
                            setDeleteTarget(draft);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                        </OpButton>
                      </div>

                      {draft.status === "Draft" ? (
                        <OpButton
                          variant="primary"
                          size="xs"
                          disabled={!canManage}
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
                          {draft.status}
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
              actions={
                <>
                  <OpButton
                    variant="primary"
                    size="xs"
                    disabled={!canManage}
                    onClick={() => {
                      const count = bulkSubmitEmailDrafts(selectedIds);
                      if (count > 0) toast.success(`Submitted ${count} draft(s) for Super Admin review.`);
                      else toast.info("Selected drafts are already submitted or approved.");
                      setSelectedIds([]);
                    }}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Submit ({selectedIds.length})
                  </OpButton>
                  <OpButton
                    variant="danger"
                    size="xs"
                    disabled={!canManage}
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Selected
                  </OpButton>
                </>
              }
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
                    const theme = DRAFT_CATEGORY_THEMES[draft.category];
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
                            {draft.category}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 max-w-[240px] truncate text-[var(--color-text-secondary)]">
                          {sanitizeDraftText(draft.subject)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={draft.status} tone={getStatusTone(draft.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatDateTime(draft.updatedAt)}
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <OpButton variant="outline" size="xs" onClick={() => openPreview(draft)}>
                              Preview
                            </OpButton>
                            <OpButton
                              variant="outline"
                              size="xs"
                              disabled={!canManage}
                              onClick={() => openEdit(draft)}
                            >
                              Edit
                            </OpButton>
                            <OpButton
                              variant="ghost"
                              size="xs"
                              disabled={!canManage}
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
          totalItems={filtered.length}
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-6 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <OpInput
                  label="Draft Name *"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Scheduled Upgrade Notice"
                />
                <OpSelect
                  label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EmailTemplateDraft["category"])}
                  options={[
                    { label: "Incident Notice", value: "Incident Notice" },
                    { label: "Billing", value: "Billing" },
                    { label: "Onboarding", value: "Onboarding" },
                    { label: "Reminders", value: "Reminders" },
                  ]}
                />
              </div>

              <OpInput
                label="Email Subject Line *"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Scheduled Maintenance Window for Acme Health"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <OpInput
                  label="Email Main Headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Upcoming Platform Improvement"
                />
                <OpInput
                  label="Action Button Label"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="e.g. Open Service Status"
                />
              </div>

              <OpTextarea
                label="Message Content (Plain Text) *"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                placeholder="Type your clear, helpful message here in plain English..."
                rows={6}
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
            <OpButton type="submit" variant="primary" size="sm">
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
              category={previewDraft.category}
              subject={sanitizeDraftText(previewDraft.subject)}
              headline={sanitizeDraftText(previewDraft.headline)}
              bodyText={sanitizeDraftText(previewDraft.bodyText)}
              ctaLabel={previewDraft.ctaLabel}
            />

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <OpButton variant="outline" size="sm" disabled={!canManage} onClick={() => openEdit(previewDraft)}>
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
            submitEmailDraftForApproval(submitTarget.id);
            toast.success(`Submitted "${submitTarget.name}" for Super Admin approval.`);
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
            deleteEmailDraft(deleteTarget.id);
            toast.success("Email draft removed.");
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
        onConfirm={() => {
          const count = bulkDeleteEmailDrafts(selectedIds);
          toast.success(`Deleted ${count} email draft(s).`);
          setSelectedIds([]);
        }}
      />
    </div>
  );
}
