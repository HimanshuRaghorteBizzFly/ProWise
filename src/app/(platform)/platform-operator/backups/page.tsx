"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  DatabaseBackup,
  HardDrive,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
} from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { BackupSnapshot } from "../_types";
import { exportRowsToCsv, formatDateTime } from "../_services/operator-service";
import {
  BulkSelectionBar,
  DemoDataBanner,
  EmptyState,
  FilterBar,
  KpiCard,
  OpButton,
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

type BackupSortField = "snapshotCode" | "scope" | "sizeGb" | "status" | "createdAt";

export default function OperatorBackupsPage() {
  const backups = usePlatformOperatorStore((s) => s.backups);
  const triggerManualBackup = usePlatformOperatorStore((s) => s.triggerManualBackup);
  const requestBackupRestore = usePlatformOperatorStore((s) => s.requestBackupRestore);
  const { can } = useOperatorPermissions();
  const canManage = can("system.manage");

  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [sortField, setSortField] = useState<BackupSortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  // Run backup modal
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupScope, setBackupScope] = useState<BackupSnapshot["scope"]>("Primary Database");

  // Restore request modal
  const [restoreTarget, setRestoreTarget] = useState<BackupSnapshot | null>(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const closeOverlays = () => {
    setBackupModalOpen(false);
    setRestoreTarget(null);
  };

  const verifiedCount = useMemo(
    () => backups.filter((b) => b.status === "Verified").length,
    [backups]
  );
  const totalStorageGb = useMemo(
    () => backups.reduce((sum, b) => sum + b.sizeGb, 0).toFixed(1),
    [backups]
  );
  const pendingRestores = useMemo(
    () => backups.filter((b) => b.restoreStatus === "Restore Requested").length,
    [backups]
  );

  const handleSort = (field: BackupSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "sizeGb" || field === "createdAt" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = backups.filter((b) => {
      const matchesQ =
        !q ||
        b.snapshotCode.toLowerCase().includes(q) ||
        b.scope.toLowerCase().includes(q) ||
        b.region.toLowerCase().includes(q) ||
        (b.note || "").toLowerCase().includes(q);
      const matchesScope = scopeFilter === "ALL" || b.scope === scopeFilter;
      return matchesQ && matchesScope;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "snapshotCode") cmp = a.snapshotCode.localeCompare(b.snapshotCode);
      else if (sortField === "scope") cmp = a.scope.localeCompare(b.scope);
      else if (sortField === "sizeGb") cmp = a.sizeGb - b.sizeGb;
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [backups, search, scopeFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, scopeFilter, pageSize]);

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
    filtered.map((b) => b.id),
    paginated.map((b) => b.id)
  );

  const handleRunBackup = (e: React.FormEvent) => {
    e.preventDefault();
    triggerManualBackup(backupScope);
    toast.success(`Verified ${backupScope} snapshot completed (simulated).`);
    setBackupModalOpen(false);
  };

  const handleSubmitRestore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreTarget) return;
    if (restoreReason.trim().length < 10) {
      setRestoreError("Please provide a clear recovery justification (at least 10 characters).");
      return;
    }
    requestBackupRestore(restoreTarget.id, restoreReason.trim());
    toast.success(`Restore request submitted for ${restoreTarget.snapshotCode}.`);
    setRestoreTarget(null);
  };

  const handleExportCsv = () => {
    exportRowsToCsv(
      `prowise-backups-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Snapshot Code", "Scope", "Size (GB)", "Region", "Retention (Days)", "Status", "Restore Status", "Created At"],
      filtered.map((b, i) => [
        i + 1,
        b.snapshotCode,
        b.scope,
        b.sizeGb,
        b.region,
        b.retentionDays,
        b.status,
        b.restoreStatus,
        b.createdAt,
      ])
    );
    toast.success(`Exported ${filtered.length} snapshot record(s).`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backup Monitoring"
        badge={`${verifiedCount} Verified`}
        demoLabel="Simulated Snapshots"
        description="Monitor automated database and file backups, trigger on-demand safety snapshots, and submit guided restore requests."
        actions={
          <OpButton
            variant="primary"
            size="sm"
            disabled={!canManage}
            onClick={() => {
              closeOverlays();
              setBackupModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            Run Snapshot Now
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Recovery Safeguard"
        description="On-demand snapshots run cleanly in simulated local state. Database restores require a documented reason and dual validation before production execution."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Verified Snapshots"
          value={verifiedCount}
          sublabel="Passed checksum verification"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Total Snapshot Footprint"
          value={`${totalStorageGb} GB`}
          sublabel="Across multi-region encrypted storage"
          icon={HardDrive}
          tone="teal"
        />
        <KpiCard
          label="Active Restore Requests"
          value={pendingRestores}
          sublabel="Awaiting recovery validation"
          icon={DatabaseBackup}
          tone={pendingRestores > 0 ? "amber" : "slate"}
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search snapshot code, scope, or region..."
          hasActiveFilters={Boolean(search || scopeFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setScopeFilter("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={filtered.length === 0}
          filters={
            <div className="w-48">
              <OpSelect
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                aria-label="Filter backup scope"
                options={[
                  { label: "All Scopes", value: "ALL" },
                  { label: "Primary Database", value: "Primary Database" },
                  { label: "Workspace Attachments", value: "Workspace Attachments" },
                  { label: "Audit Archive", value: "Audit Archive" },
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
            icon={DatabaseBackup}
            title="No backup snapshots found"
            description="No snapshot records match your search or scope filter."
          />
        ) : viewMode === "TABLE" ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((b) => b.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="outline"
                  size="xs"
                  onClick={() => {
                    const chosen = backups.filter((b) => selectedSet.has(b.id));
                    exportRowsToCsv(
                      `prowise-selected-backups-${new Date().toISOString().slice(0, 10)}.csv`,
                      ["Snapshot Code", "Scope", "Size GB", "Region", "Status", "Created At"],
                      chosen.map((b) => [b.snapshotCode, b.scope, b.sizeGb, b.region, b.status, b.createdAt])
                    );
                    toast.success(`Exported ${chosen.length} snapshot record(s).`);
                  }}
                >
                  Export Selected ({selectedIds.length})
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
                        aria-label="Select all snapshots on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Snapshot" active={sortField === "snapshotCode"} direction={sortDir} onSort={() => handleSort("snapshotCode")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Scope & Region" active={sortField === "scope"} direction={sortDir} onSort={() => handleSort("scope")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Size" active={sortField === "sizeGb"} direction={sortDir} onSort={() => handleSort("sizeGb")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Created" active={sortField === "createdAt"} direction={sortDir} onSort={() => handleSort("createdAt")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((snap, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(snap.id);
                    return (
                      <tr key={snap.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(snap.id)}
                            aria-label={`Select ${snap.snapshotCode}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2 py-0.5 text-[11px] font-semibold">
                            {snap.snapshotCode}
                          </span>
                          {snap.note && (
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-1 max-w-[200px] truncate">
                              {snap.note}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={snap.scope} tone="info" />
                          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                            {snap.region} · {snap.retentionDays}d retention
                          </p>
                        </td>
                        <td className="py-3 px-3.5 font-semibold tabular-nums whitespace-nowrap">
                          {snap.sizeGb} GB
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={snap.status} tone={getStatusTone(snap.status)} dot />
                          {snap.restoreStatus === "Restore Requested" && (
                            <div className="mt-1">
                              <StatusBadge label="Restore Requested" tone="warning" />
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {formatDateTime(snap.createdAt)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          {snap.restoreStatus === "None" ? (
                            <OpButton
                              variant="outline"
                              size="xs"
                              disabled={!canManage}
                              onClick={() => {
                                closeOverlays();
                                setRestoreTarget(snap);
                                setRestoreReason("");
                                setRestoreError(null);
                              }}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Request Restore
                            </OpButton>
                          ) : (
                            <span className="text-[11px] text-amber-600 dark:text-amber-300 font-medium">
                              Queued
                            </span>
                          )}
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
            {paginated.map((snap, idx) => {
              const srNo = (safePage - 1) * pageSize + idx + 1;
              return (
                <div
                  key={snap.id}
                  className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
                        #{srNo}
                      </span>
                      <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold">
                        {snap.snapshotCode}
                      </span>
                      <StatusBadge label={snap.status} tone={getStatusTone(snap.status)} dot />
                      <StatusBadge label={snap.scope} tone="info" />
                      {snap.restoreStatus === "Restore Requested" && (
                        <StatusBadge label="Restore Requested" tone="warning" />
                      )}
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-[var(--color-text-primary)]">
                      Size: {snap.sizeGb} GB · Region: {snap.region} · Retention: {snap.retentionDays} days
                    </p>
                    {snap.note && <p className="text-xs text-[var(--color-text-secondary)]">{snap.note}</p>}
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      Completed in {snap.durationSec}s · {formatDateTime(snap.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {snap.restoreStatus === "None" && (
                      <OpButton
                        variant="outline"
                        size="xs"
                        disabled={!canManage}
                        onClick={() => {
                          closeOverlays();
                          setRestoreTarget(snap);
                          setRestoreReason("");
                          setRestoreError(null);
                        }}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Request Restore
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

      {/* Run Backup Modal */}
      <OpModal
        isOpen={backupModalOpen}
        onClose={() => setBackupModalOpen(false)}
        title="Trigger On-Demand Safety Snapshot"
        description="Select which platform storage scope to verify and archive."
        maxWidth="sm"
      >
        <form onSubmit={handleRunBackup} className="space-y-4">
          <OpSelect
            label="Backup Scope"
            value={backupScope}
            onChange={(e) => setBackupScope(e.target.value as BackupSnapshot["scope"])}
            options={[
              { label: "Primary Database", value: "Primary Database" },
              { label: "Workspace Attachments", value: "Workspace Attachments" },
              { label: "Audit Archive", value: "Audit Archive" },
            ]}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setBackupModalOpen(false)}>
              Cancel
            </OpButton>
            <OpButton type="submit" variant="primary" size="sm">
              Start Backup (Sim)
            </OpButton>
          </div>
        </form>
      </OpModal>

      {/* Restore Request Modal */}
      <OpModal
        isOpen={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        title={restoreTarget ? `Request Restore — ${restoreTarget.snapshotCode}` : "Request Restore"}
        description="Submit a documented recovery request for validation."
        maxWidth="md"
      >
        <form onSubmit={handleSubmitRestore} className="space-y-4">
          {restoreError && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {restoreError}
            </div>
          )}
          <OpTextarea
            label="Recovery Reason & Target Environment"
            value={restoreReason}
            onChange={(e) => setRestoreReason(e.target.value)}
            placeholder="Describe whether this is a staging verification restore or incident rollback and link the ticket..."
            rows={3}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setRestoreTarget(null)}>
              Cancel
            </OpButton>
            <OpButton type="submit" variant="danger" size="sm">
              Submit Restore Request
            </OpButton>
          </div>
        </form>
      </OpModal>
    </div>
  );
}
