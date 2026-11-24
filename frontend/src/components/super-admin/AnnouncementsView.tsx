"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Archive,
  Bell,
  CalendarClock,
  Clock,
  Edit3,
  Eye,
  FileEdit,
  Globe,
  LayoutGrid,
  List,
  Mail,
  Megaphone,
  MessageSquareReply,
  Monitor,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import type { PlatformApi } from "@/lib/admin-api/platform";
import type { AnnouncementInput, PlatformAnnouncement } from "@/types/admin-platform";
import {
  AdminButton,
  BulkSelectionBar,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  ConfirmActionModal,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { ResourceStatus, formatInstant, humanize, type ResourceState } from "./admin-resource";
import {
  MutationErrorBanner,
  TabBar,
  fromLocalInputValue,
  toLocalInputValue,
  useMutation,
  type MutationFailure,
} from "./platform-shared";

export type AnnouncementsApi = Pick<PlatformApi, "announcements">;

interface TypeMeta {
  label: string;
  icon: React.ElementType;
  gradient: string;
  badge: string;
}

export const ANNOUNCEMENT_TYPE_META: Record<string, TypeMeta> = {
  INFO: {
    label: "Platform Info",
    icon: Bell,
    gradient: "bg-gradient-to-r from-sky-600 to-blue-600",
    badge: "border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  RELEASE: {
    label: "Product Release",
    icon: Sparkles,
    gradient: "bg-gradient-to-r from-indigo-600 to-violet-600",
    badge: "border-violet-500/35 bg-violet-500/15 text-violet-700 dark:text-violet-300",
  },
  MAINTENANCE: {
    label: "Maintenance",
    icon: Wrench,
    gradient: "bg-gradient-to-r from-amber-600 to-orange-500",
    badge: "border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-300",
  },
  CRITICAL: {
    label: "Critical Alert",
    icon: AlertTriangle,
    gradient: "bg-gradient-to-r from-rose-600 to-red-600",
    badge: "border-rose-500/35 bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
};

function typeMeta(type: string): TypeMeta {
  return ANNOUNCEMENT_TYPE_META[type] ?? { ...ANNOUNCEMENT_TYPE_META.INFO, label: humanize(type) };
}

const CHANNEL_META: Record<string, { label: string; icon: React.ElementType; badge: string }> = {
  IN_APP_BANNER: {
    label: "In-App Banner",
    icon: Monitor,
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
  EMAIL_BROADCAST: {
    label: "Email Broadcast",
    icon: Mail,
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
};

const AUDIENCE_LABELS: Record<string, string> = {
  ALL_ORGS: "All organizations",
  BY_PLAN: "Organizations on selected plans",
  SPECIFIC_ORGS: "Selected organizations",
  OPERATORS_ONLY: "Platform operators only",
};

export const ANNOUNCEMENT_STATUS_OPTIONS = ["DRAFT", "SCHEDULED", "PUBLISHED", "ARCHIVED"];

/** Operator-submitted drafts awaiting a Super Admin decision (publish or request changes). */
export const PENDING_REVIEW = "PENDING_REVIEW";
/** Status filter choices: the admin statuses plus the operator review states. */
export const ANNOUNCEMENT_FILTER_STATUS_OPTIONS = [...ANNOUNCEMENT_STATUS_OPTIONS, PENDING_REVIEW, "CHANGES_REQUESTED"];

export const isPendingReview = (a: Pick<PlatformAnnouncement, "status">) => a.status === PENDING_REVIEW;

export function pendingReviewCount(rows: PlatformAnnouncement[]): number {
  return rows.filter(isPendingReview).length;
}

/** The operator who submitted a draft, as stored by the server (never guessed). */
export function operatorAuthor(a: PlatformAnnouncement): string | null {
  return a.submitted_by || a.created_by || null;
}

/** Request changes needs a note for the author; returns the validation message or null. */
export function reviewNoteError(note: string): string | null {
  return note.trim() ? null : "Tell the author what to change.";
}

export interface NamedOption {
  id: string;
  name: string;
}

/** Audience text from the stored targeting only (no estimated reach). */
export function audienceLabel(a: PlatformAnnouncement): string {
  const aud = a.target_audience ?? "ALL_ORGS";
  if (aud === "BY_PLAN") return `${(a.target_plans ?? []).length} plan(s)`;
  if (aud === "SPECIFIC_ORGS") return `${(a.target_org_ids ?? []).length} selected organization(s)`;
  return AUDIENCE_LABELS[aud] ?? humanize(aud);
}

/**
 * Names behind the audience count, resolved from the plan / organization lists the server returned. Ids the lists do
 * not contain are left out (never guessed); returns "" when nothing resolves.
 */
export function audienceNames(a: PlatformAnnouncement, plans: NamedOption[], organizations: NamedOption[], max = 3): string {
  const aud = a.target_audience ?? "ALL_ORGS";
  const source = aud === "BY_PLAN" ? plans : aud === "SPECIFIC_ORGS" ? organizations : [];
  const ids = aud === "BY_PLAN" ? a.target_plans ?? [] : aud === "SPECIFIC_ORGS" ? a.target_org_ids ?? [] : [];
  const names = ids.map((id) => source.find((o) => o.id === id)?.name).filter((n): n is string => Boolean(n));
  if (names.length === 0) return "";
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown} +${names.length - max} more` : shown;
}

/** Body of POST /bulk-delete for the selected rows: each id with the version this page read. */
export function bulkDeleteItems(rows: PlatformAnnouncement[], selectedIds: string[]) {
  return rows.filter((r) => selectedIds.includes(r.id)).map((r) => ({ id: r.id, version: r.version }));
}

/** Publish is allowed from every state except Published (the server accepts Draft, Scheduled and Archived). */
export const canPublish = (status: string) => status !== "PUBLISHED";

export function announcementCounts(rows: PlatformAnnouncement[]) {
  const by = (s: string) => rows.filter((r) => r.status === s).length;
  return { total: rows.length, published: by("PUBLISHED"), scheduled: by("SCHEDULED"), draft: by("DRAFT"), archived: by("ARCHIVED") };
}

/** Maps server field names (snake_case) to form field keys. */
function fieldError(failure: MutationFailure | null, field: string): string | undefined {
  return failure?.fieldErrors[field];
}

interface FormState {
  title: string;
  message: string;
  type: string;
  audience: string;
  plans: string[];
  orgs: string[];
  channels: string[];
  status: string;
  scheduledFor: string;
  expiresAt: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  message: "",
  type: "INFO",
  audience: "ALL_ORGS",
  plans: [],
  orgs: [],
  channels: ["IN_APP_BANNER"],
  status: "DRAFT",
  scheduledFor: "",
  expiresAt: "",
};

function formFrom(a: PlatformAnnouncement): FormState {
  return {
    title: a.title,
    message: a.message,
    type: a.type,
    audience: a.target_audience ?? "ALL_ORGS",
    plans: [...(a.target_plans ?? [])],
    orgs: [...(a.target_org_ids ?? [])],
    channels: [...(a.channels ?? [])],
    status: a.status,
    scheduledFor: toLocalInputValue(a.scheduled_for),
    expiresAt: toLocalInputValue(a.expires_at),
  };
}

/** Body sent for create and update (update adds expected_version in the client). */
export function announcementInput(form: FormState): AnnouncementInput {
  return {
    title: form.title.trim(),
    message: form.message.trim(),
    type: form.type,
    target_audience: form.audience,
    target_plans: form.audience === "BY_PLAN" ? form.plans : [],
    target_org_ids: form.audience === "SPECIFIC_ORGS" ? form.orgs : [],
    channels: form.channels,
    status: form.status,
    scheduled_for: form.status === "SCHEDULED" ? fromLocalInputValue(form.scheduledFor) : null,
    expires_at: fromLocalInputValue(form.expiresAt),
  };
}

function validate(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.title.trim()) errors.title = "A headline is required.";
  if (!form.message.trim()) errors.message = "A message is required.";
  if (form.channels.length === 0) errors.channels = "Choose at least one channel.";
  if (form.audience === "BY_PLAN" && form.plans.length === 0) errors.target_plans = "Choose at least one plan.";
  if (form.audience === "SPECIFIC_ORGS" && form.orgs.length === 0) errors.target_org_ids = "Choose at least one organization.";
  if (form.status === "SCHEDULED" && !form.scheduledFor) errors.scheduled_for = "Choose when to publish.";
  return errors;
}

function ChannelChips({ channels }: { channels: string[] | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {(channels ?? []).map((ch) => {
        const cm = CHANNEL_META[ch] ?? { label: humanize(ch), icon: Megaphone, badge: CHANNEL_META.IN_APP_BANNER.badge };
        const Icon = cm.icon;
        return (
          <span key={ch} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${cm.badge}`}>
            <Icon className="w-3 h-3" />
            {cm.label}
          </span>
        );
      })}
    </div>
  );
}

/** "Pending review" marker plus the operator who submitted the draft. */
function PendingReviewBadge({ a }: { a: PlatformAnnouncement }) {
  if (!isPendingReview(a)) return null;
  const author = operatorAuthor(a);
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-pending-review="true">
      <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
        Pending review
      </span>
      <span className="text-[11px] text-[var(--color-text-secondary)]">
        Operator draft{author ? ` by ${author}` : ""}
        {a.submitted_at ? `, submitted ${formatInstant(a.submitted_at)}` : ""}
      </span>
    </div>
  );
}

export interface AnnouncementsViewProps {
  state: ResourceState<PlatformAnnouncement[]>;
  onRetry: () => void;
  api: AnnouncementsApi;
  plans: NamedOption[];
  organizations: NamedOption[];
}

export function AnnouncementsView({ state, onRetry, api, plans, organizations }: AnnouncementsViewProps) {
  const all = useMemo(() => (state.status === "ready" ? state.data : []), [state]);
  const ready = state.status === "ready";
  const counts = announcementCounts(all);

  const [viewMode, setViewMode] = useState<"CARDS" | "LIST">("CARDS");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [editing, setEditing] = useState<PlatformAnnouncement | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PlatformAnnouncement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlatformAnnouncement | null>(null);
  const [reviewTarget, setReviewTarget] = useState<PlatformAnnouncement | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewNoteMessage, setReviewNoteMessage] = useState<string | null>(null);
  const pendingCount = pendingReviewCount(all);

  const save = useMutation();
  const action = useMutation();
  const review = useMutation();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all.filter(
      (a) =>
        (statusFilter === "ALL" || a.status === statusFilter) &&
        (typeFilter === "ALL" || a.type === typeFilter) &&
        (!q || a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q)),
    );
  }, [all, search, statusFilter, typeFilter]);
  const hasFilters = search.trim() !== "" || statusFilter !== "ALL" || typeFilter !== "ALL";
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const selection = useTableSelection(
    filtered.map((a) => a.id),
    pageRows.map((a) => a.id),
  );
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const planName = (id: string) => plans.find((p) => p.id === id)?.name ?? id;
  const orgName = (id: string) => organizations.find((o) => o.id === id)?.name ?? id;

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setLocalErrors({});
    save.clear();
    setFormOpen(true);
  };
  const openEdit = (a: PlatformAnnouncement) => {
    setPreview(null);
    setEditing(a);
    setForm(formFrom(a));
    setLocalErrors({});
    save.clear();
    setFormOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate(form);
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) return;
    const input = announcementInput(form);
    const ok = await save.run(() =>
      editing ? api.announcements.update(editing.id, input, editing.version) : api.announcements.create(input),
    );
    if (ok) {
      toast.success(editing ? "Announcement updated." : "Announcement created.");
      setFormOpen(false);
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

  const openRequestChanges = (a: PlatformAnnouncement) => {
    setPreview(null);
    setReviewTarget(a);
    setReviewNote("");
    setReviewNoteMessage(null);
    review.clear();
  };

  const submitRequestChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = reviewTarget;
    if (!target) return;
    const message = reviewNoteError(reviewNote);
    setReviewNoteMessage(message);
    if (message) return;
    const ok = await review.run(() => api.announcements.requestChanges(target.id, target.version, reviewNote.trim()));
    if (ok) {
      toast.success(`Sent "${target.title}" back to its author.`);
      setReviewTarget(null);
      onRetry();
    }
  };

  const err = (field: string) => localErrors[field] ?? fieldError(save.failure, field);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const toggleIn = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const rowActions = (a: PlatformAnnouncement) => (
    <div className="flex flex-wrap items-center gap-1">
      {canPublish(a.status) && (
        <AdminButton
          variant="primary"
          size="xs"
          disabled={action.pending}
          onClick={() => runAction(`Published "${a.title}".`, () => api.announcements.publish(a.id, a.version))}
        >
          <Send className="w-3 h-3" />
          Publish
        </AdminButton>
      )}
      {isPendingReview(a) && (
        <AdminButton
          variant="outline"
          size="xs"
          disabled={action.pending || review.pending}
          onClick={() => openRequestChanges(a)}
          title="Send this operator draft back to its author with a note"
        >
          <MessageSquareReply className="w-3 h-3" />
          Request changes
        </AdminButton>
      )}
      {a.status === "PUBLISHED" && (
        <AdminButton
          variant="outline"
          size="xs"
          disabled={action.pending}
          onClick={() => runAction(`Archived "${a.title}".`, () => api.announcements.archive(a.id, a.version))}
        >
          <Archive className="w-3 h-3" />
          Archive
        </AdminButton>
      )}
      <AdminButton variant="outline" size="xs" onClick={() => setPreview(a)} title="Preview announcement">
        <Eye className="w-3 h-3" />
        Preview
      </AdminButton>
      <AdminButton variant="outline" size="xs" onClick={() => openEdit(a)}>
        <Edit3 className="w-3 h-3" />
        Edit
      </AdminButton>
      <AdminButton
        variant="ghost"
        size="xs"
        className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
        onClick={() => setDeleteTarget(a)}
        aria-label={`Delete ${a.title}`}
        title="Delete announcement"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </AdminButton>
    </div>
  );

  const when = (a: PlatformAnnouncement) =>
    a.status === "SCHEDULED" && a.scheduled_for
      ? `For ${formatInstant(a.scheduled_for)}`
      : formatInstant(a.published_at ?? a.created_at);
  const isScheduledDate = (a: PlatformAnnouncement) => a.status === "SCHEDULED" && Boolean(a.scheduled_for);

  const runBulkDelete = () => {
    const items = bulkDeleteItems(filtered, selection.selectedIds);
    if (items.length === 0) return;
    void (async () => {
      const ok = await action.run(() => api.announcements.bulkRemove(items));
      if (ok) {
        toast.success(`${items.length} announcement(s) deleted.`);
        selection.setSelectedIds([]);
        onRetry();
      }
    })();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        badge={ready ? `${counts.total} notices` : undefined}
        description="Compose platform notices, schedule them, publish or archive them. Every change is saved on the server."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </AdminButton>
            <AdminButton variant="primary" size="sm" onClick={openCreate}>
              <Plus className="w-3.5 h-3.5" />
              New Announcement
            </AdminButton>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard label="Published" value={ready ? counts.published : "-"} sublabel="Live notices" icon={Globe} tone="emerald" />
        <KpiCard label="Scheduled" value={ready ? counts.scheduled : "-"} sublabel="Queued for later" icon={CalendarClock} tone="blue" />
        <KpiCard label="Drafts" value={ready ? counts.draft : "-"} sublabel="Not yet published" icon={FileEdit} tone="amber" />
        <KpiCard label="Total notices" value={ready ? counts.total : "-"} sublabel={ready ? `${counts.archived} archived` : undefined} icon={Megaphone} tone="slate" />
      </div>

      <MutationErrorBanner failure={action.failure} onReload={() => { action.clear(); onRetry(); }} />

      <TabBar
        tabs={[
          { key: "ALL", label: "All notices", icon: Megaphone, badge: ready ? String(counts.total) : undefined },
          { key: PENDING_REVIEW, label: "Pending review", icon: Clock, badge: ready ? String(pendingCount) : undefined },
        ]}
        active={statusFilter === PENDING_REVIEW ? PENDING_REVIEW : "ALL"}
        onChange={(key) => {
          setStatusFilter(key);
          setPage(1);
        }}
      />

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          searchPlaceholder="Search title or message..."
          hasActiveFilters={hasFilters}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
            setTypeFilter("ALL");
            setPage(1);
          }}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <AdminSelect
                  aria-label="Filter announcement status"
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                  options={[{ label: "All statuses", value: "ALL" }, ...ANNOUNCEMENT_FILTER_STATUS_OPTIONS.map((s) => ({ label: humanize(s), value: s }))]}
                />
              </div>
              <div className="w-40">
                <AdminSelect
                  aria-label="Filter announcement type"
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                  options={[{ label: "All types", value: "ALL" }, ...Object.entries(ANNOUNCEMENT_TYPE_META).map(([k, m]) => ({ label: m.label, value: k }))]}
                />
              </div>
            </div>
          }
          rightActions={
            <div className="flex items-center rounded-lg border border-[var(--color-border)] p-0.5">
              <button type="button" aria-label="Card view" onClick={() => setViewMode("CARDS")} className={`p-1.5 rounded-md ${viewMode === "CARDS" ? "bg-[var(--color-elevated)] text-blue-600" : "text-[var(--color-text-muted)]"}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button type="button" aria-label="List view" onClick={() => setViewMode("LIST")} className={`p-1.5 rounded-md ${viewMode === "LIST" ? "bg-[var(--color-elevated)] text-blue-600" : "text-[var(--color-text-muted)]"}`}>
                <List className="w-4 h-4" />
              </button>
            </div>
          }
        />

        <ResourceStatus
          state={ready ? { status: "ready", data: filtered } : state}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={Megaphone}
          emptyTitle={hasFilters ? "No announcements match these filters" : "No announcements yet"}
          emptyDescription={hasFilters ? "Change or clear the filters to see more." : "Create the first platform notice with New Announcement."}
        />

        {pageRows.length > 0 && (
          <div className="rounded-xl border border-[var(--color-border)] overflow-hidden">
            <label className="flex items-center gap-2 px-4 py-2 text-xs text-[var(--color-text-secondary)] bg-[var(--color-sidebar)]">
              <input
                type="checkbox"
                aria-label="Select all announcements on this page"
                checked={selection.allPageSelected}
                ref={(el) => {
                  if (el) el.indeterminate = selection.somePageSelected;
                }}
                onChange={selection.toggleSelectPage}
              />
              Select all on this page
            </label>
            <BulkSelectionBar
              selectedCount={selection.selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => selection.setSelectedIds(filtered.map((a) => a.id))}
              onClear={() => selection.setSelectedIds([])}
              actions={
                <AdminButton variant="danger" size="xs" disabled={action.pending} onClick={() => setBulkDeleteOpen(true)}>
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete selected
                </AdminButton>
              }
            />
          </div>
        )}

        {pageRows.length > 0 && viewMode === "CARDS" && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pageRows.map((a, idx) => {
              const meta = typeMeta(a.type);
              const Icon = meta.icon;
              const index = (safePage - 1) * pageSize + idx + 1;
              const names = audienceNames(a, plans, organizations);
              const channels = a.channels ?? [];
              const selected = selection.selectedSet.has(a.id);
              return (
                <SurfaceCard key={a.id} className={`overflow-hidden flex flex-col ${selected ? "ring-2 ring-blue-500" : ""}`}>
                  <div className={`${meta.gradient} px-3.5 py-2.5 flex items-center justify-between gap-2 text-white`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        aria-label={`Select ${a.title}`}
                        checked={selected}
                        onChange={() => selection.toggleSelectOne(a.id)}
                        className="h-3.5 w-3.5 accent-white"
                      />
                      <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">#{index}</span>
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold truncate">
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        {meta.label}
                      </span>
                    </div>
                    <span className="rounded-full bg-white/20 border border-white/25 px-2 py-0.5 text-[10px] font-semibold shrink-0">{humanize(a.status)}</span>
                  </div>
                  <div className="p-4 space-y-3 flex-1">
                    <PendingReviewBadge a={a} />
                    <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-snug line-clamp-2">{a.title}</h3>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">{a.message}</p>
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5 space-y-2">
                      <div className="flex items-start gap-1.5 text-[11px]">
                        <Users className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-px" />
                        <div className="min-w-0">
                          <span className="text-[var(--color-text-muted)]">Audience: </span>
                          <span className="font-semibold text-[var(--color-text-primary)]">{audienceLabel(a)}</span>
                          {names && <p className="text-[var(--color-text-secondary)] truncate" title={names}>{names}</p>}
                        </div>
                      </div>
                      {channels.length > 0 && <ChannelChips channels={channels} />}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-muted)]">
                      {a.created_by ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-6 w-6 rounded-full border border-[var(--color-border)] bg-[var(--color-elevated)] flex items-center justify-center text-[10px] font-bold shrink-0">
                            {getOrgInitials(a.created_by)}
                          </span>
                          <span className="truncate">{a.created_by}</span>
                        </div>
                      ) : (
                        <span />
                      )}
                      <span className={`shrink-0 ${isScheduledDate(a) ? "font-semibold text-blue-600 dark:text-blue-400" : ""}`}>{when(a)}</span>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-t border-[var(--color-border)]">{rowActions(a)}</div>
                </SurfaceCard>
              );
            })}
          </div>
        )}

        {pageRows.length > 0 && viewMode === "LIST" && (
          <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
            <table className="w-full text-left text-xs border-collapse min-w-[860px]" aria-label="Announcements">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <th className="px-4 py-3 w-16">Sr. No.</th>
                  <th className="px-4 py-3">Announcement</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Audience &amp; Channels</th>
                  <th className="px-4 py-3">Author &amp; Timeline</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {pageRows.map((a, idx) => (
                  <tr key={a.id} className="hover:bg-[var(--color-hover)]">
                    <td className="px-4 py-3 text-[var(--color-text-muted)] tabular-nums">
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" aria-label={`Select ${a.title}`} checked={selection.selectedSet.has(a.id)} onChange={() => selection.toggleSelectOne(a.id)} />
                        {(safePage - 1) * pageSize + idx + 1}
                      </label>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-semibold text-[var(--color-text-primary)]">{a.title}</p>
                      <p className="text-[var(--color-text-secondary)] line-clamp-2">{a.message}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${typeMeta(a.type).badge}`}>{typeMeta(a.type).label}</span>
                    </td>
                    <td className="px-4 py-3 space-y-1.5">
                      <p className="text-[var(--color-text-secondary)]">{audienceLabel(a)}</p>
                      <ChannelChips channels={a.channels} />
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      <p>{a.created_by || "-"}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{when(a)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={humanize(a.status)} tone={getStatusTone(a.status)} dot />
                      <div className="mt-1">
                        <PendingReviewBadge a={a} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">{rowActions(a)}</div>
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
      <AdminModal isOpen={preview !== null} onClose={() => setPreview(null)} title={preview?.title || "Announcement Preview"} description="How the notice reads, with its stored targeting." maxWidth="lg">
        {preview && (
          <div className="space-y-4">
            <div className={`${typeMeta(preview.type).gradient} rounded-xl p-4 text-white space-y-2 shadow-sm`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold">{typeMeta(preview.type).label}</span>
                <span className="rounded-full bg-black/20 px-2.5 py-0.5 text-[11px] font-semibold">{humanize(preview.status)}</span>
              </div>
              <h3 className="text-base font-bold leading-snug">{preview.title}</h3>
              <p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap">{preview.message}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Target audience</span>
                <p className="font-semibold text-[var(--color-text-primary)]">{AUDIENCE_LABELS[preview.target_audience ?? ""] ?? humanize(preview.target_audience)}</p>
                {(preview.target_plans ?? []).length > 0 && <p className="text-[var(--color-text-secondary)]">{(preview.target_plans ?? []).map(planName).join(", ")}</p>}
                {(preview.target_org_ids ?? []).length > 0 && <p className="text-[var(--color-text-secondary)]">{(preview.target_org_ids ?? []).map(orgName).join(", ")}</p>}
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Channels</span>
                <ChannelChips channels={preview.channels} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-[var(--color-text-secondary)]">
              <p>Scheduled: <strong>{formatInstant(preview.scheduled_for)}</strong></p>
              <p>Published: <strong>{formatInstant(preview.published_at)}</strong></p>
              <p>Expires: <strong>{formatInstant(preview.expires_at)}</strong></p>
            </div>
            {isPendingReview(preview) && <PendingReviewBadge a={preview} />}
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              {isPendingReview(preview) && (
                <AdminButton variant="outline" size="sm" onClick={() => openRequestChanges(preview)}>
                  <MessageSquareReply className="w-3.5 h-3.5" />
                  Request changes
                </AdminButton>
              )}
              <AdminButton variant="outline" size="sm" onClick={() => openEdit(preview)}>
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </AdminButton>
              <AdminButton variant="primary" size="sm" onClick={() => setPreview(null)}>Close</AdminButton>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Compose / edit */}
      <AdminModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit Announcement: ${editing.title}` : "Compose Platform Announcement"}
        description="Saved on the server. Times are entered in your browser's time zone and stored in UTC."
        maxWidth="2xl"
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <MutationErrorBanner failure={save.failure} onReload={() => { setFormOpen(false); save.clear(); onRetry(); }} />
          <AdminInput label="Announcement Headline *" placeholder="e.g. Scheduled maintenance on Sunday, 02:00 UTC" value={form.title} onChange={(e) => set({ title: e.target.value })} error={err("title")} maxLength={200} />
          <AdminTextarea label="Message *" rows={4} placeholder="Tell users what is happening, who is affected and what they need to do." value={form.message} onChange={(e) => set({ message: e.target.value })} error={err("message")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AdminSelect
              label="Type"
              value={form.type}
              onChange={(e) => set({ type: e.target.value })}
              error={err("type")}
              options={Object.entries(ANNOUNCEMENT_TYPE_META).map(([k, m]) => ({ label: m.label, value: k }))}
            />
            <AdminSelect
              label="Audience"
              value={form.audience}
              onChange={(e) => set({ audience: e.target.value })}
              error={err("target_audience")}
              options={Object.entries(AUDIENCE_LABELS).map(([k, l]) => ({ label: l, value: k }))}
            />
          </div>

          {form.audience === "BY_PLAN" && (
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-[var(--color-text-secondary)]">Plans</legend>
              {plans.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">No plans were returned by the server.</p>}
              <div className="flex flex-wrap gap-2">
                {plans.map((p) => (
                  <label key={p.id} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs">
                    <input type="checkbox" checked={form.plans.includes(p.id)} onChange={() => set({ plans: toggleIn(form.plans, p.id) })} />
                    {p.name}
                  </label>
                ))}
              </div>
              {err("target_plans") && <p className="text-[11px] text-rose-600">{err("target_plans")}</p>}
            </fieldset>
          )}

          {form.audience === "SPECIFIC_ORGS" && (
            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-[var(--color-text-secondary)]">Organizations</legend>
              {organizations.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">No organizations were returned by the server.</p>}
              <div className="max-h-40 overflow-y-auto flex flex-wrap gap-2">
                {organizations.map((o) => (
                  <label key={o.id} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs">
                    <input type="checkbox" checked={form.orgs.includes(o.id)} onChange={() => set({ orgs: toggleIn(form.orgs, o.id) })} />
                    {o.name}
                  </label>
                ))}
              </div>
              {err("target_org_ids") && <p className="text-[11px] text-rose-600">{err("target_org_ids")}</p>}
            </fieldset>
          )}

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-[var(--color-text-secondary)]">Channels</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CHANNEL_META).map(([k, m]) => (
                <label key={k} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-1 text-xs">
                  <input type="checkbox" checked={form.channels.includes(k)} onChange={() => set({ channels: toggleIn(form.channels, k) })} />
                  {m.label}
                </label>
              ))}
            </div>
            {err("channels") && <p className="text-[11px] text-rose-600">{err("channels")}</p>}
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <AdminSelect
              label="Publish option"
              value={form.status}
              onChange={(e) => set({ status: e.target.value })}
              error={err("status")}
              options={[
                { label: "Save as draft", value: "DRAFT" },
                { label: "Schedule", value: "SCHEDULED" },
                { label: "Publish now", value: "PUBLISHED" },
                ...(editing?.status === "ARCHIVED" ? [{ label: "Archived", value: "ARCHIVED" }] : []),
              ]}
            />
            <AdminInput
              label="Scheduled date & time"
              placeholder="Pick when to publish"
              type="datetime-local"
              value={form.scheduledFor}
              disabled={form.status !== "SCHEDULED"}
              onChange={(e) => set({ scheduledFor: e.target.value })}
              error={err("scheduled_for")}
            />
            <AdminInput label="Auto-hide (optional)" type="datetime-local" placeholder="Leave empty to keep it visible" value={form.expiresAt} onChange={(e) => set({ expiresAt: e.target.value })} error={err("expires_at")} />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setFormOpen(false)}>Cancel</AdminButton>
            <AdminButton type="submit" variant="primary" size="sm" isLoading={save.pending}>
              {editing ? "Save changes" : "Create announcement"}
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Request changes on an operator draft (note required, sent with the version this page read) */}
      <AdminModal
        isOpen={reviewTarget !== null}
        onClose={() => setReviewTarget(null)}
        title={`Request changes: ${reviewTarget?.title ?? ""}`}
        description="The draft goes back to its operator author as Changes requested, with your note. Nothing is published."
        maxWidth="lg"
      >
        <form onSubmit={submitRequestChanges} className="space-y-4" noValidate>
          <MutationErrorBanner failure={review.failure} onReload={() => { setReviewTarget(null); review.clear(); onRetry(); }} />
          {reviewTarget && (
            <p className="text-xs text-[var(--color-text-secondary)]">
              Author: <strong>{operatorAuthor(reviewTarget) ?? "-"}</strong>
            </p>
          )}
          <AdminTextarea
            label="Note for the author *"
            rows={4}
            placeholder="What should be changed before this can be published?"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            error={reviewNoteMessage ?? fieldError(review.failure, "reviewer_note")}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" size="sm" onClick={() => setReviewTarget(null)}>Cancel</AdminButton>
            <AdminButton type="submit" variant="primary" size="sm" isLoading={review.pending}>
              Request changes
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      <ConfirmActionModal
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={`Delete announcement "${deleteTarget?.title ?? ""}"?`}
        description="The announcement is removed from the server. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          const target = deleteTarget;
          if (target) void runAction("Announcement deleted.", () => api.announcements.remove(target.id, target.version));
        }}
      />

      <ConfirmActionModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selection.selectedIds.length} announcement(s)?`}
        description="The selected announcements are removed from the server in one step. If any of them was changed by someone else, nothing is deleted."
        confirmLabel="Delete selected"
        onConfirm={runBulkDelete}
      />
    </div>
  );
}
