"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Eye,
  Globe,
  LayoutGrid,
  List,
  Mail,
  Megaphone,
  Monitor,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  Announcement,
  AnnouncementAudience,
  AnnouncementStatus,
  AnnouncementType,
} from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { formatDateTime } from "../_services/super-admin-service";
import {
  AdminButton,
  AdminInput,
  AdminModal,
  AdminSelect,
  AdminTextarea,
  BulkSelectionBar,
  ConfirmActionModal,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/SuperAdminPrimitives";

type AnnouncementChannel = "IN_APP_BANNER" | "EMAIL_BROADCAST";

interface TypeThemeMeta {
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  gradient: string;
  cardBorder: string;
  badge: string;
  bannerPreview: string;
  avatarBg: string;
}

const ANNOUNCEMENT_TYPE_META: Record<AnnouncementType, TypeThemeMeta> = {
  INFO: {
    label: "Platform Info",
    shortLabel: "Info",
    description: "General product tips & updates",
    icon: Bell,
    gradient: "bg-gradient-to-r from-sky-600 to-blue-600",
    cardBorder: "border-sky-500/35 hover:border-sky-500/65",
    badge: "border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    bannerPreview: "border-sky-500/40 bg-sky-500/15 text-sky-800 dark:text-sky-200",
    avatarBg: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  RELEASE: {
    label: "Product Release",
    shortLabel: "Release",
    description: "New capabilities & launches",
    icon: Sparkles,
    gradient: "bg-gradient-to-r from-indigo-600 to-violet-600",
    cardBorder: "border-violet-500/35 hover:border-violet-500/65",
    badge: "border-violet-500/35 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    bannerPreview: "border-violet-500/40 bg-violet-500/15 text-violet-800 dark:text-violet-200",
    avatarBg: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
  },
  MAINTENANCE: {
    label: "Maintenance",
    shortLabel: "Maintenance",
    description: "Scheduled infrastructure windows",
    icon: Wrench,
    gradient: "bg-gradient-to-r from-amber-600 to-orange-500",
    cardBorder: "border-amber-500/35 hover:border-amber-500/65",
    badge: "border-amber-500/35 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    bannerPreview: "border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200",
    avatarBg: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30",
  },
  CRITICAL: {
    label: "Critical Alert",
    shortLabel: "Critical",
    description: "Urgent action or incident notice",
    icon: AlertTriangle,
    gradient: "bg-gradient-to-r from-rose-600 to-red-600",
    cardBorder: "border-rose-500/35 hover:border-rose-500/65",
    badge: "border-rose-500/35 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    bannerPreview: "border-rose-500/40 bg-rose-500/15 text-rose-800 dark:text-rose-200",
    avatarBg: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
};

const CHANNEL_META: Record<
  AnnouncementChannel,
  { label: string; description: string; badge: string; icon: React.ComponentType<{ className?: string }> }
> = {
  IN_APP_BANNER: {
    label: "In-App Banner",
    description: "Shown at the top of workspaces",
    badge: "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    icon: Monitor,
  },
  EMAIL_BROADCAST: {
    label: "Email Broadcast",
    description: "Sent to workspace admins & owners",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    icon: Mail,
  },
};

const STATUS_DISPLAY: Record<AnnouncementStatus, string> = {
  PUBLISHED: "Published",
  SCHEDULED: "Scheduled",
  DRAFT: "Draft",
  ARCHIVED: "Archived",
};

const TYPE_OPTIONS: AnnouncementType[] = ["INFO", "RELEASE", "MAINTENANCE", "CRITICAL"];

export default function SuperAdminAnnouncementsPage() {
  const announcements = useSuperAdminStore((s) => s.announcements);
  const organizations = useSuperAdminStore((s) => s.organizations);
  const plans = useSuperAdminStore((s) => s.plans);
  const operators = useSuperAdminStore((s) => s.operators);

  const createAnnouncement = useSuperAdminStore((s) => s.createAnnouncement);
  const updateAnnouncement = useSuperAdminStore((s) => s.updateAnnouncement);
  const publishAnnouncement = useSuperAdminStore((s) => s.publishAnnouncement);
  const unpublishAnnouncement = useSuperAdminStore((s) => s.unpublishAnnouncement);
  const deleteAnnouncement = useSuperAdminStore((s) => s.deleteAnnouncement);

  const { can } = useAdminPermissions();
  const canManage = can("announcements.manage");

  const [viewMode, setViewMode] = useState<"CARDS" | "LIST">("CARDS");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AnnouncementStatus>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | AnnouncementType>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Compose / Edit form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState<AnnouncementType>("INFO");
  const [audience, setAudience] = useState<AnnouncementAudience>("ALL_ORGS");
  const [targetPlans, setTargetPlans] = useState<string[]>([]);
  const [targetOrgIds, setTargetOrgIds] = useState<string[]>([]);
  const [channels, setChannels] = useState<AnnouncementChannel[]>(["IN_APP_BANNER"]);
  const [statusMode, setStatusMode] = useState<AnnouncementStatus>("PUBLISHED");
  const [scheduledFor, setScheduledFor] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setMessage("");
    setType("INFO");
    setAudience("ALL_ORGS");
    setTargetPlans([]);
    setTargetOrgIds([]);
    setChannels(["IN_APP_BANNER"]);
    setStatusMode("PUBLISHED");
    setScheduledFor("");
    setExpiresAt("");
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (anc: Announcement) => {
    setPreviewTarget(null);
    setEditing(anc);
    setTitle(anc.title);
    setMessage(anc.message);
    setType(anc.type);
    setAudience(anc.targetAudience);
    setTargetPlans([...anc.targetPlans]);
    setTargetOrgIds([...anc.targetOrgIds]);
    setChannels([...anc.channels]);
    setStatusMode(anc.status);
    setScheduledFor(anc.scheduledFor ? anc.scheduledFor.slice(0, 16) : "");
    setExpiresAt(anc.expiresAt ? anc.expiresAt.slice(0, 16) : "");
    setErrors({});
    setModalOpen(true);
  };

  const computeAudienceReach = (
    aud: AnnouncementAudience,
    selPlans: string[],
    selOrgs: string[]
  ): { count: number; label: string } => {
    if (aud === "ALL_ORGS") {
      const active = organizations.filter((o) => o.status !== "SUSPENDED").length;
      return { count: active, label: `All ${active} active workspaces` };
    }
    if (aud === "BY_PLAN") {
      const matched = organizations.filter((o) => selPlans.includes(o.planId)).length;
      const planNames = plans
        .filter((p) => selPlans.includes(p.id))
        .map((p) => p.name)
        .join(", ");
      return {
        count: matched,
        label: planNames ? `${planNames} (${matched} orgs)` : `${matched} orgs on ${selPlans.length} plan(s)`,
      };
    }
    if (aud === "SPECIFIC_ORGS") {
      return { count: selOrgs.length, label: `${selOrgs.length} selected organization(s)` };
    }
    const activeOps = operators.filter((o) => o.status === "ACTIVE").length;
    return { count: activeOps, label: `${activeOps} platform operators` };
  };

  const draftReach = computeAudienceReach(audience, targetPlans, targetOrgIds);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!title.trim() || title.trim().length < 4) errs.title = "Title must be at least 4 characters.";
    if (!message.trim() || message.trim().length < 10) errs.message = "Message must be at least 10 characters.";
    if (audience === "BY_PLAN" && targetPlans.length === 0) errs.audience = "Select at least one plan tier.";
    if (audience === "SPECIFIC_ORGS" && targetOrgIds.length === 0) errs.audience = "Select at least one organization.";
    if (channels.length === 0) errs.channels = "Select at least one delivery channel.";
    if (statusMode === "SCHEDULED" && !scheduledFor) errs.scheduledFor = "Choose a future schedule date & time.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      title: title.trim(),
      message: message.trim(),
      type,
      targetAudience: audience,
      targetPlans: audience === "BY_PLAN" ? targetPlans : [],
      targetOrgIds: audience === "SPECIFIC_ORGS" ? targetOrgIds : [],
      channels,
      status: statusMode,
      scheduledFor: statusMode === "SCHEDULED" && scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    };

    if (editing) {
      updateAnnouncement(editing.id, payload);
      toast.success(`Updated announcement "${payload.title}"`);
    } else {
      createAnnouncement(payload);
      toast.success(
        payload.status === "PUBLISHED"
          ? `Published announcement "${payload.title}"`
          : payload.status === "SCHEDULED"
          ? `Scheduled announcement "${payload.title}"`
          : `Saved draft "${payload.title}"`
      );
    }
    setModalOpen(false);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return announcements.filter((a) => {
      if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && a.type !== typeFilter) return false;
      if (q) {
        const hit =
          a.title.toLowerCase().includes(q) ||
          a.message.toLowerCase().includes(q) ||
          a.createdBy.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [announcements, search, statusFilter, typeFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, typeFilter, pageSize]);

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
    filtered.map((a) => a.id),
    paginated.map((a) => a.id)
  );

  const selectedAnnouncements = useMemo(
    () => announcements.filter((a) => selectedSet.has(a.id)),
    [announcements, selectedSet]
  );

  const handleBulkPublish = () => {
    let count = 0;
    selectedAnnouncements.forEach((anc) => {
      if (anc.status !== "PUBLISHED") {
        publishAnnouncement(anc.id);
        count++;
      }
    });
    if (count > 0) toast.success(`Published ${count} announcement(s)`);
    else toast.info("Selected announcements are already published");
    setSelectedIds([]);
  };

  const handleBulkUnpublish = () => {
    let count = 0;
    selectedAnnouncements.forEach((anc) => {
      if (anc.status === "PUBLISHED") {
        unpublishAnnouncement(anc.id);
        count++;
      }
    });
    if (count > 0) toast.info(`Unpublished ${count} announcement(s)`);
    else toast.info("No published announcements in selection");
    setSelectedIds([]);
  };

  const handleConfirmBulkDelete = () => {
    const count = selectedIds.length;
    selectedIds.forEach((id) => deleteAnnouncement(id));
    toast.success(`Deleted ${count} announcement(s)`);
    setSelectedIds([]);
  };

  const publishedCount = announcements.filter((a) => a.status === "PUBLISHED").length;
  const scheduledCount = announcements.filter((a) => a.status === "SCHEDULED").length;
  const draftCount = announcements.filter((a) => a.status === "DRAFT").length;

  const activeTheme = ANNOUNCEMENT_TYPE_META[type];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Announcements"
        description="Compose, target, schedule, and broadcast workspace banners and email notices across tenants."
        simulationLabel="Simulated Broadcast Engine"
        actions={
          <AdminButton
            variant="primary"
            size="sm"
            permissionLocked={!canManage}
            onClick={openCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            New Announcement
          </AdminButton>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Published Banners" value={publishedCount} sublabel="Live in target workspaces" icon={Globe} tone="emerald" />
        <KpiCard label="Scheduled" value={scheduledCount} sublabel="Queued for future window" icon={CalendarClock} tone="blue" />
        <KpiCard label="Drafts" value={draftCount} sublabel="Awaiting review" icon={Bell} tone="amber" />
        <KpiCard label="Total Notices" value={announcements.length} sublabel="Across all channels" icon={Megaphone} tone="slate" />
      </div>

      {/* Filter Toolbar with Card / List Switcher */}
      <SurfaceCard className="p-4">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search announcement title, message, or author..."
              hasActiveFilters={Boolean(search || statusFilter !== "ALL" || typeFilter !== "ALL")}
              onResetFilters={() => {
                setSearch("");
                setStatusFilter("ALL");
                setTypeFilter("ALL");
              }}
              filters={
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "ALL" | AnnouncementStatus)}
                    aria-label="Filter announcement status"
                    className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="DRAFT">Draft</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as "ALL" | AnnouncementType)}
                    aria-label="Filter announcement type"
                    className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                  >
                    <option value="ALL">All Types</option>
                    <option value="INFO">Platform Info</option>
                    <option value="RELEASE">Product Release</option>
                    <option value="MAINTENANCE">Maintenance</option>
                    <option value="CRITICAL">Critical Alert</option>
                  </select>
                </div>
              }
            />
          </div>
          <div className="inline-flex self-start xl:self-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("CARDS")}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                viewMode === "CARDS"
                  ? "bg-blue-600 text-white shadow-sm"
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
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
          </div>
        </div>
      </SurfaceCard>

      {paginated.length === 0 ? (
        <SurfaceCard className="p-6">
          <EmptyStateView
            icon={Megaphone}
            title="No announcements match"
            description="Create a platform broadcast or clear your active filters."
            actionLabel={canManage ? "New Announcement" : undefined}
            onAction={canManage ? openCreate : undefined}
          />
        </SurfaceCard>
      ) : viewMode === "CARDS" ? (
        <div className="space-y-3.5">
          {/* Card View Quick Select Bar + Bulk Bar */}
          <SurfaceCard className="overflow-hidden">
            <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-[var(--color-elevated)]/40">
              <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[var(--color-text-secondary)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = somePageSelected;
                  }}
                  onChange={toggleSelectPage}
                  aria-label="Select all announcements on this page"
                  className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                />
                <span>
                  Select all on this page ({paginated.length})
                </span>
              </label>
              <span className="text-[11px] text-[var(--color-text-muted)]">
                Showing {(safePage - 1) * pageSize + 1}–{(safePage - 1) * pageSize + paginated.length} of{" "}
                {filtered.length} notices
              </span>
            </div>
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((a) => a.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <>
                  <AdminButton
                    variant="outline"
                    size="xs"
                    permissionLocked={!canManage}
                    onClick={handleBulkPublish}
                  >
                    <Send className="w-3 h-3" />
                    Publish Selected
                  </AdminButton>
                  <AdminButton
                    variant="outline"
                    size="xs"
                    permissionLocked={!canManage}
                    onClick={handleBulkUnpublish}
                  >
                    <Archive className="w-3 h-3" />
                    Unpublish Selected
                  </AdminButton>
                  <AdminButton
                    variant="danger"
                    size="xs"
                    permissionLocked={!canManage}
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete Selected ({selectedIds.length})
                  </AdminButton>
                </>
              }
            />
          </SurfaceCard>

          {/* Colorful Announcements Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paginated.map((anc, idx) => {
              const globalIdx = (safePage - 1) * pageSize + idx;
              const serialNumber = globalIdx + 1;
              const isSelected = selectedSet.has(anc.id);
              const meta = ANNOUNCEMENT_TYPE_META[anc.type];
              const TypeIcon = meta.icon;
              const reach = computeAudienceReach(anc.targetAudience, anc.targetPlans, anc.targetOrgIds);

              return (
                <SurfaceCard
                  key={anc.id}
                  className={`overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    isSelected ? "ring-2 ring-blue-500 border-blue-500" : meta.cardBorder
                  }`}
                >
                  <div>
                    {/* Vibrant Colored Header Strip */}
                    <div className={`${meta.gradient} px-4 py-3 flex items-center justify-between gap-2 text-white`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(anc.id)}
                          aria-label={`Select announcement ${anc.title}`}
                          className="h-4 w-4 rounded border-white/50 bg-white/15 cursor-pointer accent-white shrink-0"
                        />
                        <span className="inline-flex items-center justify-center rounded-md bg-white/20 border border-white/25 px-1.5 py-0.5 text-[10px] font-bold tabular-nums shrink-0">
                          #{serialNumber}
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-bold text-xs tracking-tight truncate">
                          <TypeIcon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{meta.label}</span>
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/20 border border-white/20 px-2 py-0.5 text-[10px] font-semibold shrink-0">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            anc.status === "PUBLISHED"
                              ? "bg-emerald-300"
                              : anc.status === "SCHEDULED"
                              ? "bg-amber-300"
                              : "bg-slate-200"
                          }`}
                        />
                        {STATUS_DISPLAY[anc.status]}
                      </span>
                    </div>

                    {/* Card Body */}
                    <div className="p-4 space-y-3">
                      <h3 className="text-sm font-bold text-[var(--color-text-primary)] leading-snug line-clamp-2">
                        {anc.title}
                      </h3>
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed line-clamp-3">
                        {anc.message}
                      </p>

                      {/* Target Audience & Friendly Channel Chips */}
                      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-2.5 space-y-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
                          <Users className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="text-[var(--color-text-muted)]">Audience:</span>
                          <span className="font-semibold text-[var(--color-text-primary)] truncate">
                            {reach.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {anc.channels.map((ch) => {
                            const cm = CHANNEL_META[ch];
                            const ChIcon = cm.icon;
                            return (
                              <span
                                key={ch}
                                className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${cm.badge}`}
                              >
                                <ChIcon className="w-3 h-3" />
                                {cm.label}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Author & Date */}
                      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--color-text-muted)] pt-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`h-6 w-6 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${meta.avatarBg}`}
                          >
                            {getOrgInitials(anc.createdBy)}
                          </span>
                          <span className="truncate font-medium text-[var(--color-text-secondary)]">
                            {anc.createdBy}
                          </span>
                        </div>
                        <span className="shrink-0 truncate">
                          {anc.scheduledFor && anc.status === "SCHEDULED" ? (
                            <span className="text-blue-600 dark:text-blue-400 font-semibold">
                              For {formatDateTime(anc.scheduledFor)}
                            </span>
                          ) : anc.publishedAt ? (
                            formatDateTime(anc.publishedAt)
                          ) : (
                            formatDateTime(anc.updatedAt)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-app-bg)]/40 flex flex-wrap items-center justify-between gap-1.5">
                    {anc.status !== "PUBLISHED" ? (
                      <AdminButton
                        variant="primary"
                        size="xs"
                        permissionLocked={!canManage}
                        onClick={() => {
                          publishAnnouncement(anc.id);
                          toast.success(`Published "${anc.title}"`);
                        }}
                      >
                        <Send className="w-3 h-3" />
                        Publish
                      </AdminButton>
                    ) : (
                      <AdminButton
                        variant="outline"
                        size="xs"
                        permissionLocked={!canManage}
                        onClick={() => {
                          unpublishAnnouncement(anc.id);
                          toast.info(`Unpublished "${anc.title}"`);
                        }}
                      >
                        <Archive className="w-3 h-3" />
                        Unpublish
                      </AdminButton>
                    )}

                    <div className="flex items-center gap-1">
                      <AdminButton
                        variant="outline"
                        size="xs"
                        onClick={() => setPreviewTarget(anc)}
                        title="Preview announcement"
                      >
                        <Eye className="w-3 h-3" />
                        Preview
                      </AdminButton>
                      <AdminButton
                        variant="outline"
                        size="xs"
                        permissionLocked={!canManage}
                        onClick={() => openEdit(anc)}
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </AdminButton>
                      <AdminButton
                        variant="ghost"
                        size="xs"
                        permissionLocked={!canManage}
                        className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                        onClick={() => setDeleteTarget(anc)}
                        title="Delete announcement"
                        aria-label={`Delete ${anc.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </AdminButton>
                    </div>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        </div>
      ) : (
        /* List / Table View */
        <SurfaceCard className="overflow-hidden">
          <BulkSelectionBar
            selectedCount={selectedIds.length}
            totalFilteredCount={filtered.length}
            onSelectAllMatching={() => setSelectedIds(filtered.map((a) => a.id))}
            onClear={() => setSelectedIds([])}
            actions={
              <>
                <AdminButton
                  variant="outline"
                  size="xs"
                  permissionLocked={!canManage}
                  onClick={handleBulkPublish}
                >
                  <Send className="w-3 h-3" />
                  Publish Selected
                </AdminButton>
                <AdminButton
                  variant="outline"
                  size="xs"
                  permissionLocked={!canManage}
                  onClick={handleBulkUnpublish}
                >
                  <Archive className="w-3 h-3" />
                  Unpublish Selected
                </AdminButton>
                <AdminButton
                  variant="danger"
                  size="xs"
                  permissionLocked={!canManage}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 className="w-3 h-3" />
                  Delete Selected ({selectedIds.length})
                </AdminButton>
              </>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-elevated)]/60 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected;
                      }}
                      onChange={toggleSelectPage}
                      aria-label="Select all announcements on this page"
                      className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 w-16 whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3">Announcement</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Audience & Channels</th>
                  <th className="px-4 py-3 hidden md:table-cell">Author & Timeline</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {paginated.map((anc, idx) => {
                  const globalIdx = (safePage - 1) * pageSize + idx;
                  const serialNumber = globalIdx + 1;
                  const isSelected = selectedSet.has(anc.id);
                  const meta = ANNOUNCEMENT_TYPE_META[anc.type];
                  const TypeIcon = meta.icon;
                  const reach = computeAudienceReach(anc.targetAudience, anc.targetPlans, anc.targetOrgIds);

                  return (
                    <tr
                      key={anc.id}
                      className={`hover:bg-[var(--color-hover)] transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(anc.id)}
                          aria-label={`Select announcement ${anc.title}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-4 py-3 max-w-[300px]">
                        <div className="flex items-start gap-2.5">
                          <div
                            className={`h-8 w-8 rounded-lg ${meta.gradient} flex items-center justify-center text-white shrink-0 mt-0.5`}
                          >
                            <TypeIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-[var(--color-text-primary)] truncate">
                              {anc.title}
                            </div>
                            <p className="text-[11px] text-[var(--color-text-muted)] line-clamp-1">
                              {anc.message}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}
                        >
                          <TypeIcon className="w-3 h-3" />
                          {meta.shortLabel}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="space-y-1">
                          <div className="text-[11px] font-medium text-[var(--color-text-secondary)]">
                            {reach.label}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {anc.channels.map((ch) => {
                              const cm = CHANNEL_META[ch];
                              return (
                                <span
                                  key={ch}
                                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${cm.badge}`}
                                >
                                  {cm.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-6 w-6 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 ${meta.avatarBg}`}
                          >
                            {getOrgInitials(anc.createdBy)}
                          </span>
                          <div>
                            <div className="font-medium text-[var(--color-text-primary)]">{anc.createdBy}</div>
                            <div className="text-[10px] text-[var(--color-text-muted)]">
                              {anc.scheduledFor && anc.status === "SCHEDULED" ? (
                                <span className="text-blue-600 dark:text-blue-400 font-medium">
                                  Scheduled {formatDateTime(anc.scheduledFor)}
                                </span>
                              ) : anc.publishedAt ? (
                                `Published ${formatDateTime(anc.publishedAt)}`
                              ) : (
                                `Updated ${formatDateTime(anc.updatedAt)}`
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge
                          label={STATUS_DISPLAY[anc.status]}
                          tone={getStatusTone(anc.status)}
                          dot
                        />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1">
                          {anc.status !== "PUBLISHED" ? (
                            <AdminButton
                              variant="primary"
                              size="xs"
                              permissionLocked={!canManage}
                              onClick={() => {
                                publishAnnouncement(anc.id);
                                toast.success(`Published "${anc.title}"`);
                              }}
                            >
                              <Send className="w-3 h-3" />
                              Publish
                            </AdminButton>
                          ) : (
                            <AdminButton
                              variant="outline"
                              size="xs"
                              permissionLocked={!canManage}
                              onClick={() => {
                                unpublishAnnouncement(anc.id);
                                toast.info(`Unpublished "${anc.title}"`);
                              }}
                            >
                              <Archive className="w-3 h-3" />
                              Unpublish
                            </AdminButton>
                          )}
                          <AdminButton
                            variant="outline"
                            size="xs"
                            onClick={() => setPreviewTarget(anc)}
                            title="Preview announcement"
                          >
                            <Eye className="w-3 h-3" />
                          </AdminButton>
                          <AdminButton
                            variant="outline"
                            size="xs"
                            permissionLocked={!canManage}
                            onClick={() => openEdit(anc)}
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </AdminButton>
                          <AdminButton
                            variant="ghost"
                            size="xs"
                            permissionLocked={!canManage}
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                            onClick={() => setDeleteTarget(anc)}
                            title="Delete announcement"
                            aria-label={`Delete ${anc.title}`}
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

      {/* Preview Announcement Modal */}
      <AdminModal
        isOpen={Boolean(previewTarget)}
        onClose={() => setPreviewTarget(null)}
        title={previewTarget?.title || "Announcement Preview"}
        description="Live workspace banner and delivery overview."
        maxWidth="lg"
      >
        {previewTarget && (() => {
          const meta = ANNOUNCEMENT_TYPE_META[previewTarget.type];
          const TypeIcon = meta.icon;
          const reach = computeAudienceReach(
            previewTarget.targetAudience,
            previewTarget.targetPlans,
            previewTarget.targetOrgIds
          );
          return (
            <div className="space-y-4">
              <div className={`${meta.gradient} rounded-xl p-4 text-white space-y-2 shadow-sm`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold">
                    <TypeIcon className="w-3.5 h-3.5" />
                    {meta.label}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-black/20 px-2.5 py-0.5 text-[11px] font-semibold">
                    {STATUS_DISPLAY[previewTarget.status]}
                  </span>
                </div>
                <h3 className="text-base font-bold leading-snug">{previewTarget.title}</h3>
                <p className="text-xs text-white/90 leading-relaxed">{previewTarget.message}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Target Audience
                  </span>
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--color-text-primary)]">
                    <Building2 className="w-3.5 h-3.5 text-blue-500" />
                    {reach.label}
                  </div>
                </div>
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    Delivery Channels
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {previewTarget.channels.map((ch) => {
                      const cm = CHANNEL_META[ch];
                      const ChIcon = cm.icon;
                      return (
                        <span
                          key={ch}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${cm.badge}`}
                        >
                          <ChIcon className="w-3 h-3" />
                          {cm.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[var(--color-border)]">
                <span className="text-[11px] text-[var(--color-text-muted)]">
                  Created by <strong className="text-[var(--color-text-secondary)]">{previewTarget.createdBy}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <AdminButton
                    variant="outline"
                    size="sm"
                    permissionLocked={!canManage}
                    onClick={() => openEdit(previewTarget)}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Notice
                  </AdminButton>
                  <AdminButton variant="primary" size="sm" onClick={() => setPreviewTarget(null)}>
                    Close
                  </AdminButton>
                </div>
              </div>
            </div>
          );
        })()}
      </AdminModal>

      {/* Polished User-Friendly Create / Edit Announcement Modal */}
      <AdminModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit Announcement: ${editing.title}` : "Compose Platform Announcement"}
        description="Choose a notice color theme, pick who should see it, and publish or schedule in seconds."
        maxWidth="2xl"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Colorful Notice Type Picker */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[var(--color-text-secondary)]">
              Notice Style & Color
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TYPE_OPTIONS.map((t) => {
                const tm = ANNOUNCEMENT_TYPE_META[t];
                const TIcon = tm.icon;
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`rounded-xl border p-2.5 text-left transition-all ${
                      active
                        ? `${tm.cardBorder} bg-[var(--color-app-bg)] ring-2 ring-blue-500/70 shadow-sm`
                        : "border-[var(--color-border)] bg-[var(--color-app-bg)]/60 hover:bg-[var(--color-hover)]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span
                        className={`h-6 w-6 rounded-lg ${tm.gradient} flex items-center justify-center text-white shrink-0`}
                      >
                        <TIcon className="w-3.5 h-3.5" />
                      </span>
                      {active && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                    </div>
                    <div className="text-xs font-semibold text-[var(--color-text-primary)]">{tm.label}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] line-clamp-1">{tm.description}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <AdminInput
            label="Announcement Headline *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Scheduled API Maintenance Window"
            error={errors.title}
          />

          <AdminTextarea
            label="Message to Organizations *"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write a clear, friendly message for workspace admins and team members..."
            error={errors.message}
          />

          {/* Audience Targeting */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                Target Audience
              </span>
              <StatusBadge label={`Reach: ${draftReach.label}`} tone="info" />
            </div>

            <AdminSelect
              value={audience}
              onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
              options={[
                { label: "All Active & Trial Organizations", value: "ALL_ORGS" },
                { label: "Customers on Specific Plans", value: "BY_PLAN" },
                { label: "Selected Organizations Only", value: "SPECIFIC_ORGS" },
                { label: "Internal Platform Operators Only", value: "OPERATORS_ONLY" },
              ]}
            />

            {audience === "BY_PLAN" && (
              <div className="flex flex-wrap gap-2">
                {plans.map((p) => {
                  const checked = targetPlans.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                        checked
                          ? "border-blue-500/45 bg-blue-500/15 text-[var(--color-text-primary)] font-medium"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setTargetPlans(
                            e.target.checked
                              ? [...targetPlans, p.id]
                              : targetPlans.filter((id) => id !== p.id)
                          )
                        }
                        className="accent-blue-600"
                      />
                      {p.name}
                    </label>
                  );
                })}
              </div>
            )}

            {audience === "SPECIFIC_ORGS" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {organizations.map((org) => {
                  const checked = targetOrgIds.includes(org.id);
                  return (
                    <label
                      key={org.id}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                        checked
                          ? "border-blue-500/45 bg-blue-500/15 text-[var(--color-text-primary)] font-medium"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)]"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          setTargetOrgIds(
                            e.target.checked
                              ? [...targetOrgIds, org.id]
                              : targetOrgIds.filter((id) => id !== org.id)
                          )
                        }
                        className="accent-blue-600"
                      />
                      <span className="truncate">{org.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {errors.audience && <p className="text-[11px] text-rose-500">{errors.audience}</p>}
          </div>

          {/* Delivery Channels */}
          <div className="space-y-1.5">
            <span className="block text-xs font-medium text-[var(--color-text-secondary)]">
              Where to Deliver This Notice *
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {(["IN_APP_BANNER", "EMAIL_BROADCAST"] as const).map((chId) => {
                const cm = CHANNEL_META[chId];
                const ChIcon = cm.icon;
                const checked = channels.includes(chId);
                return (
                  <label
                    key={chId}
                    className={`flex items-start gap-2.5 rounded-xl border p-3 cursor-pointer transition-colors ${
                      checked
                        ? "border-blue-500/50 bg-blue-500/10"
                        : "border-[var(--color-border)] bg-[var(--color-app-bg)]/60 hover:bg-[var(--color-hover)]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setChannels(
                          e.target.checked
                            ? [...channels, chId]
                            : channels.filter((c) => c !== chId)
                        )
                      }
                      className="mt-0.5 h-4 w-4 rounded accent-blue-600"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-text-primary)]">
                        <ChIcon className="w-3.5 h-3.5 text-blue-500" />
                        {cm.label}
                      </div>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{cm.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
            {errors.channels && <p className="text-[11px] text-rose-500">{errors.channels}</p>}
          </div>

          {/* Publishing Status & Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AdminSelect
              label="Publish Option"
              value={statusMode}
              onChange={(e) => setStatusMode(e.target.value as AnnouncementStatus)}
              options={[
                { label: "Publish Immediately", value: "PUBLISHED" },
                { label: "Schedule for Later", value: "SCHEDULED" },
                { label: "Save as Draft", value: "DRAFT" },
                { label: "Archive Notice", value: "ARCHIVED" },
              ]}
            />
            <AdminInput
              label="Scheduled Date & Time"
              type="datetime-local"
              value={scheduledFor}
              disabled={statusMode !== "SCHEDULED"}
              onChange={(e) => setScheduledFor(e.target.value)}
              error={errors.scheduledFor}
            />
            <AdminInput
              label="Auto-Hide Date (Optional)"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>

          {/* Live Banner Preview */}
          {(title || message) && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Live Workspace Banner Preview
              </span>
              <div className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2.5 ${activeTheme.bannerPreview}`}>
                <activeTheme.icon className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <strong className="block font-semibold">{title || "Announcement Headline"}</strong>
                  <span className="opacity-90">{message || "Broadcast message preview..."}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <AdminButton type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </AdminButton>
            <AdminButton type="submit" variant="primary">
              {editing ? "Save Changes" : statusMode === "PUBLISHED" ? "Publish Announcement" : "Save Announcement"}
            </AdminButton>
          </div>
        </form>
      </AdminModal>

      {/* Single Delete Modal */}
      <ConfirmActionModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete announcement "${deleteTarget?.title || ""}"?`}
        description="This immediately removes the broadcast from all targeted workspaces."
        confirmLabel="Delete Announcement"
        variant="danger"
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteAnnouncement(deleteTarget.id);
          toast.success("Announcement deleted");
        }}
      />

      {/* Bulk Delete Modal */}
      <ConfirmActionModal
        isOpen={bulkDeleteOpen}
        onClose={() => setBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.length} selected announcement(s)?`}
        description="This will remove every selected announcement banner and scheduled notice from the platform."
        confirmLabel={`Delete ${selectedIds.length} Notice(s)`}
        variant="danger"
        onConfirm={handleConfirmBulkDelete}
      />
    </div>
  );
}
