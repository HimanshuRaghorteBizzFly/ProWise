"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  PlayCircle,
  Plus,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { MaintenanceWindow } from "../_types";
import { formatDateTime } from "../_services/operator-service";
import {
  BulkSelectionBar,
  ConfirmModal,
  DemoDataBanner,
  EmptyState,
  FilterBar,
  KpiCard,
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

type MaintSortField = "title" | "affectedArea" | "impactLevel" | "scheduledStart" | "durationMinutes" | "status";

export default function OperatorMaintenancePage() {
  const maintenanceWindows = usePlatformOperatorStore((s) => s.maintenanceWindows);
  const createMaintenanceWindow = usePlatformOperatorStore((s) => s.createMaintenanceWindow);
  const updateMaintenanceWindow = usePlatformOperatorStore((s) => s.updateMaintenanceWindow);
  const deleteMaintenanceWindow = usePlatformOperatorStore((s) => s.deleteMaintenanceWindow);
  const { can } = useOperatorPermissions();
  const canManage = can("system.manage");

  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<MaintSortField>("scheduledStart");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Schedule Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [affectedArea, setAffectedArea] = useState("Database & Analytics");
  const [impactLevel, setImpactLevel] = useState<MaintenanceWindow["impactLevel"]>("No Downtime");
  const [scheduledStart, setScheduledStart] = useState("2026-11-17T03:00");
  const [durationMinutes, setDurationMinutes] = useState(20);
  const [notifyCustomers, setNotifyCustomers] = useState(true);
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<MaintenanceWindow | null>(null);

  const closeOverlays = () => {
    setModalOpen(false);
    setCancelTarget(null);
  };

  const scheduledCount = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "Scheduled").length,
    [maintenanceWindows]
  );
  const activeCount = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "In Progress").length,
    [maintenanceWindows]
  );
  const completedCount = useMemo(
    () => maintenanceWindows.filter((m) => m.status === "Completed").length,
    [maintenanceWindows]
  );

  const handleSort = (field: MaintSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "scheduledStart" || field === "durationMinutes" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = maintenanceWindows.filter((m) => {
      const matchesQ =
        !q ||
        m.title.toLowerCase().includes(q) ||
        m.affectedArea.toLowerCase().includes(q) ||
        (m.notes || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "ALL" || m.status === statusFilter;
      return matchesQ && matchesStatus;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "title") cmp = a.title.localeCompare(b.title);
      else if (sortField === "affectedArea") cmp = a.affectedArea.localeCompare(b.affectedArea);
      else if (sortField === "impactLevel") cmp = a.impactLevel.localeCompare(b.impactLevel);
      else if (sortField === "durationMinutes") cmp = a.durationMinutes - b.durationMinutes;
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else cmp = a.scheduledStart.localeCompare(b.scheduledStart);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [maintenanceWindows, search, statusFilter, sortField, sortDir]);

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
    filtered.map((m) => m.id),
    paginated.map((m) => m.id)
  );

  const openModal = () => {
    closeOverlays();
    setTitle("");
    setAffectedArea("Database & Analytics");
    setImpactLevel("No Downtime");
    setScheduledStart("2026-11-17T03:00");
    setDurationMinutes(20);
    setNotifyCustomers(true);
    setNotes("");
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5) {
      setFormError("Please enter a clear maintenance window title.");
      return;
    }
    if (durationMinutes < 5 || durationMinutes > 480) {
      setFormError("Duration must be between 5 minutes and 8 hours (480 minutes).");
      return;
    }
    createMaintenanceWindow({
      title: title.trim(),
      affectedArea,
      impactLevel,
      scheduledStart,
      durationMinutes,
      notifyCustomers,
      notes: notes.trim() || undefined,
    });
    toast.success("Maintenance window scheduled.");
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance Operations"
        badge={`${scheduledCount} Upcoming`}
        demoLabel="Demo Maintenance Schedule"
        description="Plan infrastructure upgrades, track active maintenance windows, and record completion status."
        actions={
          <OpButton variant="primary" size="sm" disabled={!canManage} onClick={openModal}>
            <Plus className="w-4 h-4" />
            Schedule Maintenance
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Coordinated Customer Notices"
        description="Scheduling maintenance tracks operational readiness locally. Customer-facing banners are published after Super Admin approval."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Scheduled Windows"
          value={scheduledCount}
          sublabel="Upcoming planned updates"
          icon={Clock}
          tone="teal"
        />
        <KpiCard
          label="Currently In Progress"
          value={activeCount}
          sublabel="Active engineering work"
          icon={Wrench}
          tone={activeCount > 0 ? "amber" : "slate"}
        />
        <KpiCard
          label="Completed Cleanly"
          value={completedCount}
          sublabel="Finished without rollback"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search maintenance title or affected area..."
          hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("ALL");
          }}
          filters={
            <div className="w-44">
              <OpSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter maintenance status"
                options={[
                  { label: "All Statuses", value: "ALL" },
                  { label: "Scheduled", value: "Scheduled" },
                  { label: "In Progress", value: "In Progress" },
                  { label: "Completed", value: "Completed" },
                  { label: "Cancelled", value: "Cancelled" },
                ]}
              />
            </div>
          }
          rightActions={
            <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-0.5 text-xs">
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
            </div>
          }
        />

        {paginated.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="No maintenance windows found"
            description="Schedule a planned upgrade or reset your filters."
            actionLabel={canManage ? "Schedule Maintenance" : undefined}
            onAction={canManage ? openModal : undefined}
          />
        ) : viewMode === "TABLE" ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((m) => m.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="danger"
                  size="xs"
                  disabled={!canManage}
                  onClick={() => {
                    selectedIds.forEach((id) => deleteMaintenanceWindow(id));
                    toast.success(`Removed ${selectedIds.length} maintenance window(s).`);
                    setSelectedIds([]);
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Selected ({selectedIds.length})
                </OpButton>
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
                        aria-label="Select all maintenance windows on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Window" active={sortField === "title"} direction={sortDir} onSort={() => handleSort("title")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Impact" active={sortField === "impactLevel"} direction={sortDir} onSort={() => handleSort("impactLevel")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Scheduled" active={sortField === "scheduledStart"} direction={sortDir} onSort={() => handleSort("scheduledStart")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((win, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(win.id);
                    return (
                      <tr key={win.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(win.id)}
                            aria-label={`Select ${win.title}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 max-w-[260px]">
                          <p className="font-semibold text-[var(--color-text-primary)]">{win.title}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)]">{win.affectedArea}</p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge
                            label={win.impactLevel}
                            tone={win.impactLevel === "No Downtime" ? "success" : "warning"}
                          />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span>{formatDateTime(win.scheduledStart)}</span>
                          <span className="block text-[10px] text-[var(--color-text-muted)]">
                            {win.durationMinutes} min
                          </span>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={win.status} tone={getStatusTone(win.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {win.status === "Scheduled" && (
                              <>
                                <OpButton
                                  variant="primary"
                                  size="xs"
                                  disabled={!canManage}
                                  onClick={() => {
                                    updateMaintenanceWindow(win.id, { status: "In Progress" });
                                    toast.success(`Started "${win.title}".`);
                                  }}
                                >
                                  Start
                                </OpButton>
                                <OpButton
                                  variant="outline"
                                  size="xs"
                                  disabled={!canManage}
                                  onClick={() => {
                                    closeOverlays();
                                    setCancelTarget(win);
                                  }}
                                >
                                  Cancel
                                </OpButton>
                              </>
                            )}
                            {win.status === "In Progress" && (
                              <OpButton
                                variant="primary"
                                size="xs"
                                disabled={!canManage}
                                onClick={() => {
                                  updateMaintenanceWindow(win.id, { status: "Completed" });
                                  toast.success(`Marked "${win.title}" as Completed.`);
                                }}
                              >
                                Complete
                              </OpButton>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {paginated.map((win, idx) => {
              const srNo = (safePage - 1) * pageSize + idx + 1;
              return (
                <div
                  key={win.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
                        #{srNo}
                      </span>
                      <StatusBadge label={win.status} tone={getStatusTone(win.status)} dot />
                      <StatusBadge
                        label={win.impactLevel}
                        tone={win.impactLevel === "No Downtime" ? "success" : "warning"}
                      />
                      <StatusBadge label={`${win.durationMinutes} min`} tone="neutral" />
                      {win.notifyCustomers && (
                        <StatusBadge label="Customer Notice Flagged" tone="info" />
                      )}
                    </div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{win.title}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Area: <strong>{win.affectedArea}</strong> · Start: {formatDateTime(win.scheduledStart)}
                    </p>
                    {win.notes && <p className="text-xs text-[var(--color-text-muted)]">{win.notes}</p>}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {win.status === "Scheduled" && (
                      <>
                        <OpButton
                          variant="primary"
                          size="xs"
                          disabled={!canManage}
                          onClick={() => {
                            updateMaintenanceWindow(win.id, { status: "In Progress" });
                            toast.success(`Started "${win.title}".`);
                          }}
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          Start Window
                        </OpButton>
                        <OpButton
                          variant="outline"
                          size="xs"
                          disabled={!canManage}
                          onClick={() => {
                            closeOverlays();
                            setCancelTarget(win);
                          }}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Cancel
                        </OpButton>
                      </>
                    )}
                    {win.status === "In Progress" && (
                      <OpButton
                        variant="primary"
                        size="xs"
                        disabled={!canManage}
                        onClick={() => {
                          updateMaintenanceWindow(win.id, { status: "Completed" });
                          toast.success(`Marked "${win.title}" as Completed.`);
                        }}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Completed
                      </OpButton>
                    )}
                  </div>
                </div>
              );
            })}
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

      <OpModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Schedule Maintenance Window"
        description="Plan an upcoming service update and expected customer impact."
        maxWidth="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          )}

          <OpInput
            label="Maintenance Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Regional Email Relay Certificate Renewal"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OpSelect
              label="Affected Area"
              value={affectedArea}
              onChange={(e) => setAffectedArea(e.target.value)}
              options={[
                { label: "Database & Analytics", value: "Database & Analytics" },
                { label: "GitHub App & Event Delivery", value: "GitHub App & Event Delivery" },
                { label: "Email & Billing Relay", value: "Email & Billing Relay" },
                { label: "Authentication Gateway", value: "Authentication Gateway" },
              ]}
            />
            <OpSelect
              label="Expected Customer Impact"
              value={impactLevel}
              onChange={(e) => setImpactLevel(e.target.value as MaintenanceWindow["impactLevel"])}
              options={[
                { label: "No Downtime", value: "No Downtime" },
                { label: "Brief Slowdown", value: "Brief Slowdown" },
                { label: "Planned Downtime", value: "Planned Downtime" },
              ]}
            />
            <OpInput
              label="Scheduled Start"
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
            />
            <OpInput
              label="Estimated Duration (Minutes)"
              type="number"
              min={5}
              max={480}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
            />
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={notifyCustomers}
              onChange={(e) => setNotifyCustomers(e.target.checked)}
              className="rounded border-[var(--color-border)] accent-teal-600"
            />
            <span className="text-[var(--color-text-primary)] font-medium">
              Coordinate customer notice via Announcement Drafts
            </span>
          </label>

          <OpTextarea
            label="Operational Notes (Optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Include rollback readiness or coordination details..."
            rows={2}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setModalOpen(false)}>
              Cancel
            </OpButton>
            <OpButton type="submit" variant="primary" size="sm">
              Schedule Window
            </OpButton>
          </div>
        </form>
      </OpModal>

      <ConfirmModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancel Maintenance Window?"
        description={
          cancelTarget
            ? `Cancel "${cancelTarget.title}" scheduled for ${formatDateTime(cancelTarget.scheduledStart)}?`
            : ""
        }
        confirmLabel="Cancel Window"
        variant="danger"
        onConfirm={() => {
          if (cancelTarget) {
            updateMaintenanceWindow(cancelTarget.id, { status: "Cancelled" });
            toast.success("Maintenance window cancelled.");
          }
        }}
      />
    </div>
  );
}
