"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Edit3,
  Eye,
  LayoutGrid,
  List,
  Megaphone,
  MessageSquareWarning,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { useDebounced } from "@/components/super-admin/admin-resource";
import { instantToLocalInput, localInputToInstant } from "@/components/super-admin/operations/shared";
import {
  ANNOUNCEMENT_MESSAGE_MIN,
  ANNOUNCEMENT_MESSAGE_MIN_WORDS,
  validateAnnouncementDraft,
} from "../_services/announcement-draft-validation";
import type { OperatorAnnouncementDraft, OperatorAnnouncementDraftInput } from "@/types/operator-console";
import { operatorApi } from "../_services/operator-api";
import { useOperatorPermissions } from "../_services/operator-access";
import { formatDateTime } from "../_services/operator-service";
import {
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

type NoticeTheme = { gradient: string; badge: string; border: string; icon: React.ComponentType<{ className?: string }> };

/** Notice types an operator proposes (server codes: letters and underscores). */
const NOTICE_TYPE_THEMES: Record<string, NoticeTheme & { label: string }> = {
  MAINTENANCE: {
    label: "Maintenance",
    gradient: "bg-gradient-to-r from-amber-600 to-orange-500",
    badge: "border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    border: "border-amber-500/35 hover:border-amber-500/65",
    icon: Wrench,
  },
  PRODUCT_UPDATE: {
    label: "Product Update",
    gradient: "bg-gradient-to-r from-indigo-600 to-violet-600",
    badge: "border-violet-500/35 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    border: "border-violet-500/35 hover:border-violet-500/65",
    icon: Sparkles,
  },
  SERVICE_NOTICE: {
    label: "Service Notice",
    gradient: "bg-gradient-to-r from-teal-600 to-cyan-600",
    badge: "border-teal-500/35 bg-teal-500/15 text-teal-700 dark:text-teal-300",
    border: "border-teal-500/35 hover:border-teal-500/65",
    icon: Megaphone,
  },
};

function noticeTheme(type: string | null | undefined) {
  const key = (type ?? "").toUpperCase();
  return NOTICE_TYPE_THEMES[key] ?? { ...NOTICE_TYPE_THEMES.SERVICE_NOTICE, label: humanizeCode(type) };
}

/** Audience codes shared with the Super Admin announcements console. */
const AUDIENCE_LABELS: Record<string, string> = {
  ALL_ORGS: "All Organizations",
  BY_PLAN: "Enterprise Plans",
  SPECIFIC_ORGS: "Selected Tenants",
  OPERATORS_ONLY: "Platform Operators Only",
};

function audienceLabel(code: string | null | undefined): string {
  const key = (code ?? "ALL_ORGS").toUpperCase();
  return AUDIENCE_LABELS[key] ?? humanizeCode(code);
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Submitted for Approval",
  CHANGES_REQUESTED: "Changes Requested",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? humanizeCode(status);
}

/** The server only accepts changes (edit, delete, submit) in these states (409 INVALID_STATE otherwise). */
const EDITABLE_STATUSES = new Set(["DRAFT", "CHANGES_REQUESTED"]);
const isEditable = (d: OperatorAnnouncementDraft) => EDITABLE_STATUSES.has(d.status);
const LOCKED_REASON = "Only drafts in Draft or Changes Requested can be changed.";

function splitList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

type AnnDraftSortField = "title" | "type" | "audience" | "status" | "proposedScheduleAt";

export default function OperatorAnnouncementDraftsPage() {
  const { can } = useOperatorPermissions();
  const canManage = can("communications.draft");

  const [viewMode, setViewMode] = useState<"CARDS" | "LIST">("CARDS");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<AnnDraftSortField>("proposedScheduleAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const debouncedSearch = useDebounced(search);

  const paging = toServerPaging(page, pageSize);
  const { state, reload } = useOperatorResource(
    () => operatorApi.announcementDrafts.list({ status: statusFilter, search: debouncedSearch, ...paging }),
    `announcement-drafts:${statusFilter}:${debouncedSearch}:${paging.page}:${paging.size}`,
  );
  const reloadList = useCallback(() => void reload(), [reload]);
  const { busy, notice, fieldErrors, clearNotice, run } = useOperatorMutation(reloadList);

  const rows = useMemo(() => pageItemsOf(state), [state]);
  const total = pageTotalOf(state);

  // Modal state (non-overlapping)
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OperatorAnnouncementDraft | null>(null);
  const [title, setTitle] = useState("");
  const [audience, setAudience] = useState("ALL_ORGS");
  const [targets, setTargets] = useState("");
  const [type, setType] = useState("MAINTENANCE");
  const [proposedScheduleAt, setProposedScheduleAt] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  const [previewTarget, setPreviewTarget] = useState<OperatorAnnouncementDraft | null>(null);
  const [submitTarget, setSubmitTarget] = useState<OperatorAnnouncementDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OperatorAnnouncementDraft | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const closeOverlays = () => {
    setModalOpen(false);
    setPreviewTarget(null);
    setSubmitTarget(null);
    setDeleteTarget(null);
    setBulkDeleteOpen(false);
  };

  const handleSort = (field: AnnDraftSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "proposedScheduleAt" ? "desc" : "asc");
    }
  };

  /** The server filters (status, search) and pages; sorting reorders the loaded page only. */
  const filtered = useMemo(() => {
    return [...rows].sort((a, b) => {
      let cmp = 0;
      if (sortField === "title") cmp = a.title.localeCompare(b.title);
      else if (sortField === "type") cmp = (a.type ?? "").localeCompare(b.type ?? "");
      else if (sortField === "audience") cmp = (a.target_audience ?? "").localeCompare(b.target_audience ?? "");
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else cmp = (a.scheduled_for ?? a.created_at ?? "").localeCompare(b.scheduled_for ?? b.created_at ?? "");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortField, sortDir]);

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
    filtered.map((a) => a.id),
    paginated.map((a) => a.id)
  );

  const selectedRows = rows.filter((r) => selectedSet.has(r.id));

  const openCreate = () => {
    closeOverlays();
    clearNotice();
    setEditing(null);
    setTitle("");
    setAudience("ALL_ORGS");
    setTargets("");
    setType("MAINTENANCE");
    setProposedScheduleAt("");
    setMessage("");
    setFormError(null);
    setClientErrors({});
    setModalOpen(true);
  };

  const openEdit = (item: OperatorAnnouncementDraft) => {
    if (!isEditable(item)) return;
    closeOverlays();
    clearNotice();
    setEditing(item);
    setTitle(item.title);
    setAudience((item.target_audience ?? "ALL_ORGS").toUpperCase());
    setTargets(
      ((item.target_audience ?? "").toUpperCase() === "BY_PLAN" ? item.target_plans ?? [] : item.target_org_ids ?? []).join(", "),
    );
    setType((item.type ?? "MAINTENANCE").toUpperCase());
    setProposedScheduleAt(instantToLocalInput(item.scheduled_for));
    setMessage(item.message);
    setFormError(null);
    setClientErrors({});
    setModalOpen(true);
  };

  /** Errors shown under each field: the client checks first, then the server's field_errors for the same keys. */
  const errorFor = (field: string) => clientErrors[field] ?? fieldErrors[field];
  const clearFieldError = (field: string) =>
    setClientErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateAnnouncementDraft({ title, message, audience, targets, proposedScheduleAt });
    setClientErrors(errors);
    if (Object.keys(errors).length > 0) {
      setFormError("Please fix the highlighted fields before saving.");
      return;
    }
    setFormError(null);
    const body: OperatorAnnouncementDraftInput = {
      title: title.trim(),
      message: message.trim(),
      type,
      target_audience: audience,
      target_plans: audience === "BY_PLAN" ? splitList(targets) : [],
      target_org_ids: audience === "SPECIFIC_ORGS" ? splitList(targets) : [],
      channels: ["IN_APP_BANNER"],
      scheduled_for: localInputToInstant(proposedScheduleAt),
    };
    const ok = editing
      ? await run(
          `save-${editing.id}`,
          () => operatorApi.announcementDrafts.update(editing.id, body, editing.version),
          "Announcement proposal updated.",
        )
      : await run("create", () => operatorApi.announcementDrafts.create(body), "Announcement draft created.");
    if (ok) setModalOpen(false);
  };

  /** One request per draft (there is no bulk endpoint); each sends that draft's own expected_version. */
  const bulkSubmit = () => {
    const eligible = selectedRows.filter(isEditable);
    if (eligible.length === 0) {
      toast.info("Selected proposals are already submitted or approved.");
      return;
    }
    void run(
      "bulk-submit",
      async () => {
        for (const d of eligible) await operatorApi.announcementDrafts.submit(d.id, d.version);
      },
      `Submitted ${eligible.length} proposal(s) to Super Admin.`,
    ).then((ok) => ok && setSelectedIds([]));
  };

  const bulkDelete = () => {
    const eligible = selectedRows.filter(isEditable);
    if (eligible.length === 0) {
      toast.info("Only drafts in Draft or Changes Requested can be deleted.");
      return;
    }
    void run(
      "bulk-delete",
      async () => {
        for (const d of eligible) await operatorApi.announcementDrafts.remove(d.id, d.version);
      },
      `Deleted ${eligible.length} announcement draft(s).`,
    ).then((ok) => ok && setSelectedIds([]));
  };

  const editTitle = (item: OperatorAnnouncementDraft) => (isEditable(item) ? undefined : LOCKED_REASON);

  const reviewerNote = (item: OperatorAnnouncementDraft) =>
    item.status === "CHANGES_REQUESTED" && item.reviewer_note ? (
      <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
        <MessageSquareWarning className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>
          <span className="font-semibold">Super Admin requested changes:</span> {item.reviewer_note}
        </span>
      </div>
    ) : null;

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
        onClick={() => {
          closeOverlays();
          setBulkDeleteOpen(true);
        }}
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete Selected
      </OpButton>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcement Drafts"
        badge={state.status === "ready" ? `${total} Proposals` : undefined}
        liveData
        description="Prepare colorful maintenance notices and service updates with proposed publish times for Super Admin review."
        actions={
          <OpButton variant="primary" size="sm" disabled={!canManage} onClick={openCreate}>
            <Plus className="w-4 h-4" />
            New Announcement Proposal
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Publishing Governance"
        description="Operators draft and propose schedule windows for service notices. Super Admin holds final authority to publish customer-wide announcements."
      />

      {!modalOpen && <MutationNotice notice={notice} onReload={reloadList} onDismiss={clearNotice} />}

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search proposal title, audience, or text..."
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
                aria-label="Filter announcement status"
                options={[
                  { label: "All States", value: "ALL" },
                  { label: "Draft", value: "DRAFT" },
                  { label: "Submitted for Approval", value: "PENDING_REVIEW" },
                  { label: "Changes Requested", value: "CHANGES_REQUESTED" },
                  { label: "Approved", value: "PUBLISHED" },
                  { label: "Archived", value: "ARCHIVED" },
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
                onClick={() => setViewMode("LIST")}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "LIST"
                    ? "bg-[#0D9488] text-white"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                }`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
            </div>
          }
        />

        {state.status !== "ready" ? (
          <OperatorResourceStatus
            state={state}
            isEmpty={() => false}
            onRetry={reloadList}
            emptyIcon={Megaphone}
            emptyTitle="No announcement drafts found"
            emptyDescription="Draft a maintenance or service notice proposal to submit to Super Admin."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="No announcement drafts found"
            description="Draft a maintenance or service notice proposal to submit to Super Admin."
            actionLabel={canManage ? "New Announcement Proposal" : undefined}
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
                    aria-label="Select all announcement proposals on this page"
                    className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                  />
                  <span>Select all on page ({paginated.length})</span>
                </label>
              </div>
              <BulkSelectionBar
                selectedCount={selectedIds.length}
                totalFilteredCount={filtered.length}
                onSelectAllMatching={() => setSelectedIds(filtered.map((a) => a.id))}
                onClear={() => setSelectedIds([])}
                actions={bulkActions}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginated.map((item, idx) => {
                const srNo = (safePage - 1) * pageSize + idx + 1;
                const isSelected = selectedSet.has(item.id);
                const theme = noticeTheme(item.type);
                const TypeIcon = theme.icon;
                const editable = isEditable(item);
                return (
                  <div
                    key={item.id}
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
                            onChange={() => toggleSelectOne(item.id)}
                            aria-label={`Select ${item.title}`}
                            className="h-4 w-4 rounded border-white/50 accent-white cursor-pointer"
                          />
                          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                            #{srNo}
                          </span>
                          <TypeIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-semibold text-xs truncate">{theme.label}</span>
                        </div>
                        <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[10px] font-semibold shrink-0">
                          {statusLabel(item.status)}
                        </span>
                      </div>

                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <StatusBadge label={audienceLabel(item.target_audience)} tone="neutral" />
                          <span className="text-[11px] text-[var(--color-text-muted)]">
                            Proposed: {item.scheduled_for ? formatDateTime(item.scheduled_for) : "Not scheduled"}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-[var(--color-text-primary)]">{item.title}</h3>
                        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">
                          {item.message}
                        </p>
                        {reviewerNote(item)}
                      </div>
                    </div>

                    <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <OpButton
                          variant="outline"
                          size="xs"
                          onClick={() => {
                            closeOverlays();
                            setPreviewTarget(item);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Preview
                        </OpButton>
                        <OpButton
                          variant="outline"
                          size="xs"
                          disabled={!canManage || !editable}
                          title={editTitle(item)}
                          onClick={() => openEdit(item)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Edit
                        </OpButton>
                        <OpButton
                          variant="ghost"
                          size="xs"
                          disabled={!canManage || !editable}
                          title={editTitle(item)}
                          aria-label={`Delete ${item.title}`}
                          onClick={() => {
                            closeOverlays();
                            setDeleteTarget(item);
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
                          isLoading={busy === `submit-${item.id}`}
                          onClick={() => {
                            closeOverlays();
                            setSubmitTarget(item);
                          }}
                        >
                          <Send className="w-3.5 h-3.5" />
                          Submit for Approval
                        </OpButton>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {statusLabel(item.status)}
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
              onSelectAllMatching={() => setSelectedIds(filtered.map((a) => a.id))}
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
                        aria-label="Select all announcement proposals on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Proposal" active={sortField === "title"} direction={sortDir} onSort={() => handleSort("title")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Type" active={sortField === "type"} direction={sortDir} onSort={() => handleSort("type")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Audience" active={sortField === "audience"} direction={sortDir} onSort={() => handleSort("audience")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Schedule" active={sortField === "proposedScheduleAt"} direction={sortDir} onSort={() => handleSort("proposedScheduleAt")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((item, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(item.id);
                    const theme = noticeTheme(item.type);
                    const editable = isEditable(item);
                    return (
                      <tr key={item.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(item.id)}
                            aria-label={`Select ${item.title}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 max-w-[260px]">
                          <p className="font-semibold text-[var(--color-text-primary)] truncate">{item.title}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)] truncate">{item.message}</p>
                          {item.status === "CHANGES_REQUESTED" && item.reviewer_note && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 truncate" title={item.reviewer_note}>
                              Reviewer: {item.reviewer_note}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold ${theme.badge}`}>
                            {theme.label}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">{audienceLabel(item.target_audience)}</td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {item.scheduled_for ? formatDateTime(item.scheduled_for) : "Not scheduled"}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={statusLabel(item.status)} tone={getStatusTone(statusLabel(item.status))} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1">
                            <OpButton
                              variant="outline"
                              size="xs"
                              onClick={() => {
                                closeOverlays();
                                setPreviewTarget(item);
                              }}
                            >
                              Preview
                            </OpButton>
                            <OpButton
                              variant="outline"
                              size="xs"
                              disabled={!canManage || !editable}
                              title={editTitle(item)}
                              onClick={() => openEdit(item)}
                            >
                              Edit
                            </OpButton>
                            <OpButton
                              variant="ghost"
                              size="xs"
                              disabled={!canManage || !editable}
                              title={editTitle(item)}
                              aria-label={`Delete ${item.title}`}
                              onClick={() => {
                                closeOverlays();
                                setDeleteTarget(item);
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

      {/* Preview Modal */}
      <OpModal
        isOpen={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        title={previewTarget?.title || "Proposal Preview"}
        description="Banner appearance once approved by Super Admin."
        maxWidth="lg"
      >
        {previewTarget && (() => {
          const theme = noticeTheme(previewTarget.type);
          const TypeIcon = theme.icon;
          return (
            <div className="space-y-4">
              <div className={`${theme.gradient} rounded-xl p-4 text-white space-y-2`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold">
                    <TypeIcon className="w-3.5 h-3.5" />
                    {theme.label}
                  </span>
                  <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[11px] font-semibold">
                    {audienceLabel(previewTarget.target_audience)}
                  </span>
                </div>
                <h3 className="text-base font-bold">{previewTarget.title}</h3>
                <p className="text-xs text-white/90 leading-relaxed">{previewTarget.message}</p>
              </div>
              {reviewerNote(previewTarget)}
              <div className="flex flex-wrap justify-end gap-2">
                <NotAvailableButton
                  variant="outline"
                  size="sm"
                  reason="operators cannot publish; a Super Admin publishes after review"
                >
                  Publish
                </NotAvailableButton>
                <OpButton
                  variant="outline"
                  size="sm"
                  disabled={!canManage || !isEditable(previewTarget)}
                  title={editTitle(previewTarget)}
                  onClick={() => openEdit(previewTarget)}
                >
                  Edit Proposal
                </OpButton>
                <OpButton variant="primary" size="sm" onClick={() => setPreviewTarget(null)}>
                  Close
                </OpButton>
              </div>
            </div>
          );
        })()}
      </OpModal>

      <OpModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Announcement Proposal" : "New Announcement Proposal"}
        description="Draft customer-visible notice details and suggest a publish date and time."
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}
          <MutationNotice notice={notice} onReload={reloadList} onDismiss={clearNotice} />
          {editing && reviewerNote(editing)}

          <OpInput
            label="Announcement Headline"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              clearFieldError("title");
            }}
            placeholder="e.g. Scheduled Database Index Upgrade"
            maxLength={255}
            error={errorFor("title")}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <OpSelect
              label="Target Audience"
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value);
                clearFieldError("target_plans");
                clearFieldError("target_org_ids");
              }}
              options={[
                { label: "All Organizations", value: "ALL_ORGS" },
                { label: "Enterprise Plans", value: "BY_PLAN" },
                { label: "Selected Tenants", value: "SPECIFIC_ORGS" },
              ]}
            />
            <OpSelect
              label="Notice Type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[
                { label: "Maintenance", value: "MAINTENANCE" },
                { label: "Service Notice", value: "SERVICE_NOTICE" },
                { label: "Product Update", value: "PRODUCT_UPDATE" },
              ]}
            />
            <OpInput
              label="Proposed Publish Time"
              type="datetime-local"
              value={proposedScheduleAt}
              min={instantToLocalInput(new Date().toISOString())}
              onChange={(e) => {
                setProposedScheduleAt(e.target.value);
                clearFieldError("scheduled_for");
              }}
              error={errorFor("scheduled_for")}
            />
          </div>

          {audience !== "ALL_ORGS" && (
            <OpInput
              label={audience === "BY_PLAN" ? "Target Plans (comma separated plan ids or codes)" : "Target Organization IDs (comma separated)"}
              value={targets}
              onChange={(e) => {
                setTargets(e.target.value);
                clearFieldError(audience === "BY_PLAN" ? "target_plans" : "target_org_ids");
              }}
              error={errorFor(audience === "BY_PLAN" ? "target_plans" : "target_org_ids")}
            />
          )}

          <OpTextarea
            label="Customer Announcement Message"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              clearFieldError("message");
            }}
            placeholder="Write a reassuring, non-technical message explaining what customers should expect..."
            rows={4}
            error={errorFor("message")}
          />
          <p className="-mt-2 text-right text-[11px] text-[var(--color-text-muted)]">
            {message.trim().length} characters · at least {ANNOUNCEMENT_MESSAGE_MIN} characters and {ANNOUNCEMENT_MESSAGE_MIN_WORDS} words
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </OpButton>
            <OpButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={!canManage}
              isLoading={busy === "create" || (editing !== null && busy === `save-${editing.id}`)}
            >
              Save Proposal
            </OpButton>
          </div>
        </form>
      </OpModal>

      <ConfirmModal
        isOpen={Boolean(submitTarget)}
        onClose={() => setSubmitTarget(null)}
        title="Submit Announcement Proposal?"
        description={
          submitTarget
            ? `Send "${submitTarget.title}" to Super Admin to review and schedule for customer display?`
            : ""
        }
        confirmLabel="Submit to Super Admin"
        variant="primary"
        onConfirm={() => {
          if (submitTarget) {
            const target = submitTarget;
            void run(
              `submit-${target.id}`,
              () => operatorApi.announcementDrafts.submit(target.id, target.version),
              `Submitted "${target.title}" for Super Admin approval.`,
            );
          }
        }}
      />

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Announcement Proposal?"
        description={deleteTarget ? `Delete draft "${deleteTarget.title}"?` : ""}
        confirmLabel="Delete Draft"
        variant="danger"
        onConfirm={() => {
          if (deleteTarget) {
            const target = deleteTarget;
            void run(
              `delete-${target.id}`,
              () => operatorApi.announcementDrafts.remove(target.id, target.version),
              "Announcement draft deleted.",
            );
          }
        }}
      />

      <ConfirmModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.length} Selected Proposal(s)?`}
        description="Deletes all checked announcement proposals."
        confirmLabel={`Delete ${selectedIds.length} Proposal(s)`}
        variant="danger"
        onConfirm={bulkDelete}
      />
    </div>
  );
}
