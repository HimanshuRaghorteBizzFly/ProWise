"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  HardDrive,
  LayoutGrid,
  List,
  Plus,
  RotateCcw,
} from "lucide-react";
import type { OperatorBackupList, OperatorBackupRun } from "@/types/operator-console";
import { operatorApi } from "../_services/operator-api";
import { useOperatorPermissions } from "../_services/operator-access";
import { exportRowsToCsv, formatDateTime } from "../_services/operator-service";
import {
  MutationNotice,
  NOT_AVAILABLE,
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  formatBytes,
  toServerPaging,
  useOperatorMutation,
  useOperatorResource,
} from "../_components/OperatorLive";
import {
  BulkSelectionBar,
  DemoDataBanner,
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
import { BACKUP_CODE_MESSAGES, BACKUP_NOT_CONFIGURED_MESSAGE, BACKUP_POLL_MS } from "./backup-messages";

type BackupSortField = "snapshotCode" | "scope" | "sizeGb" | "status" | "createdAt";

function statusLabel(status: string): string {
  if (status === "SUCCEEDED") return "Succeeded";
  if (status === "NOT_CONFIGURED") return "Not configured";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function durationOf(run: OperatorBackupRun): string | null {
  if (!run.started_at || !run.finished_at) return null;
  const sec = Math.max(0, Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000));
  return `${sec}s`;
}

/**
 * Real database backups (GET/POST /v1/operator/backups): runs pg_dump on the server into PROWISE_BACKUP_DIR. The list
 * is re-read every 5 seconds while a run is in progress. There is no download or restore endpoint, so those controls
 * stay visible but disabled ("Not available yet").
 */
export default function OperatorBackupsPage() {
  const { can } = useOperatorPermissions();
  const canManage = can("system.manage");

  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [sortField, setSortField] = useState<BackupSortField>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Run backup modal
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backupScope, setBackupScope] = useState("Primary Database");

  // Restore request modal (kept for the restore flow; no restore endpoint exists, so it never opens)
  const [restoreTarget, setRestoreTarget] = useState<OperatorBackupRun | null>(null);
  const [restoreReason, setRestoreReason] = useState("");
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const paging = toServerPaging(page, pageSize);
  const { state, reload } = useOperatorResource(
    () => operatorApi.backups.list(paging),
    `backups:${paging.page}:${paging.size}`,
  );

  /** Keep the last answer on screen while a poll re-reads the list (no flicker to the skeleton). */
  const [last, setLast] = useState<OperatorBackupList | null>(null);
  useEffect(() => {
    if (state.status === "ready") setLast(state.data);
  }, [state]);
  const data: OperatorBackupList | null = state.status === "ready" ? state.data : state.status === "loading" ? last : null;
  const running = Boolean(data?.running);
  const configured = data ? data.configured : true;

  // Poll every 5s while a run is in progress; stops as soon as the server says nothing is running.
  useEffect(() => {
    if (state.status !== "ready" || !state.data.running) return;
    const timer = setTimeout(() => void reload(), BACKUP_POLL_MS);
    return () => clearTimeout(timer);
  }, [state, reload]);

  const runMutation = useOperatorMutation(reload, BACKUP_CODE_MESSAGES);

  const items = useMemo(() => data?.items ?? [], [data]);
  const total = data?.total ?? 0;

  const verifiedCount = useMemo(() => items.filter((b) => b.status === "SUCCEEDED").length, [items]);
  const totalBytes = useMemo(() => items.reduce((sum, b) => sum + (b.size_bytes ?? 0), 0), [items]);

  const handleSort = (field: BackupSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "sizeGb" || field === "createdAt" ? "desc" : "asc");
    }
  };

  /** Search and sort apply to the runs the server returned for this page. */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = items.filter(
      (b) =>
        !q ||
        (b.file_name ?? "").toLowerCase().includes(q) ||
        (b.triggered_by ?? "").toLowerCase().includes(q) ||
        b.status.toLowerCase().includes(q) ||
        (b.error_message ?? "").toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "snapshotCode") cmp = (a.file_name ?? a.id).localeCompare(b.file_name ?? b.id);
      else if (sortField === "sizeGb") cmp = (a.size_bytes ?? 0) - (b.size_bytes ?? 0);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else if (sortField === "createdAt")
        cmp = new Date(a.started_at ?? 0).getTime() - new Date(b.started_at ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [items, search, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

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
    filtered.map((b) => b.id)
  );

  const handleRunBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await runMutation.run("run-backup", () => operatorApi.backups.run(), "Backup started. This list refreshes until it finishes.");
    if (ok) setBackupModalOpen(false);
  };

  const handleSubmitRestore = (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreError(`${NOT_AVAILABLE}: there is no restore endpoint.`);
  };

  const toRows = (list: OperatorBackupRun[]) =>
    list.map((b, i) => [
      i + 1,
      b.file_name ?? b.id,
      b.size_bytes ?? "",
      b.status,
      b.triggered_by ?? "",
      b.started_at ?? "",
      b.finished_at ?? "",
      b.error_message ?? "",
    ]);
  const CSV_HEADER = ["Sr No", "File", "Size (bytes)", "Status", "Triggered By", "Started At", "Finished At", "Error"];

  const handleExportCsv = () => {
    exportRowsToCsv(`prowise-backups-${new Date().toISOString().slice(0, 10)}.csv`, CSV_HEADER, toRows(filtered));
    toast.success(`Exported ${filtered.length} backup record(s).`);
  };

  const runButtonDisabled = !canManage || running || runMutation.busy !== null;
  const runButtonTitle = !canManage
    ? "You do not have permission for this."
    : running
      ? "A backup is already running."
      : undefined;

  const restoreButton = (snap: OperatorBackupRun) => (
    <span className="inline-flex items-center gap-1.5">
      <NotAvailableButton variant="outline" size="xs" reason="no backup download endpoint" hideLabel>
        <Download className="w-3.5 h-3.5" />
        Download
      </NotAvailableButton>
      <NotAvailableButton variant="outline" size="xs" reason="no restore endpoint" wrapperClassName="items-end" aria-label={`Request restore of ${snap.file_name ?? snap.id}`}>
        <RotateCcw className="w-3.5 h-3.5" />
        Request Restore
      </NotAvailableButton>
    </span>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Backup Monitoring"
        badge={data ? `${verifiedCount} Verified` : undefined}
        liveData
        description="Monitor automated database and file backups, trigger on-demand safety snapshots, and submit guided restore requests."
        actions={
          <OpButton
            variant="primary"
            size="sm"
            disabled={runButtonDisabled}
            title={runButtonTitle}
            isLoading={running}
            onClick={() => {
              setRestoreTarget(null);
              runMutation.clearNotice();
              setBackupModalOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            {running ? "Backup Running..." : "Run Snapshot Now"}
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Recovery Safeguard"
        description="On-demand snapshots run cleanly in simulated local state. Database restores require a documented reason and dual validation before production execution."
      />

      {data && !configured && (
        <div
          role="status"
          data-backup-not-configured="true"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-200"
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{BACKUP_NOT_CONFIGURED_MESSAGE}</p>
        </div>
      )}

      {running && (
        <div role="status" className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-3.5 text-xs text-teal-800 dark:text-teal-200">
          A backup is running on the server. This list refreshes every 5 seconds until it finishes.
        </div>
      )}

      <MutationNotice notice={runMutation.notice} onReload={() => void reload()} onDismiss={runMutation.clearNotice} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Verified Snapshots"
          value={data ? verifiedCount : "-"}
          sublabel="Succeeded runs in the list shown"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Total Snapshot Footprint"
          value={data ? formatBytes(totalBytes) : "-"}
          sublabel="Size of the backup files in the list shown"
          icon={HardDrive}
          tone="teal"
        />
        <KpiCard
          label="Active Restore Requests"
          value={NOT_AVAILABLE}
          sublabel="Not available yet: there is no restore endpoint"
          icon={DatabaseBackup}
          tone="slate"
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
            <div className="w-48" title={`${NOT_AVAILABLE}: every backup is a full database dump`}>
              <OpSelect
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value)}
                aria-label="Filter backup scope"
                disabled
                title={`${NOT_AVAILABLE}: every backup is a full database dump`}
                options={[
                  { label: "All Scopes", value: "ALL" },
                  { label: "Primary Database", value: "Primary Database" },
                  { label: "Workspace Attachments", value: "Workspace Attachments" },
                  { label: "Audit Archive", value: "Audit Archive" },
                ]}
              />
              <span className="text-[10px] text-[var(--color-text-muted)]">{NOT_AVAILABLE}</span>
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

        {!data || filtered.length === 0 ? (
          <OperatorResourceStatus
            state={data ? { status: "ready", data: filtered } : state.status === "error" ? state : { status: "loading" }}
            isEmpty={(rows) => rows.length === 0}
            onRetry={() => void reload()}
            emptyIcon={DatabaseBackup}
            emptyTitle="No backup snapshots found"
            emptyDescription={
              configured
                ? "No backup has run yet, or nothing matches your search."
                : "No backup has run yet. Configure backups on the server first."
            }
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
                    const chosen = items.filter((b) => selectedSet.has(b.id));
                    exportRowsToCsv(
                      `prowise-selected-backups-${new Date().toISOString().slice(0, 10)}.csv`,
                      CSV_HEADER,
                      toRows(chosen)
                    );
                    toast.success(`Exported ${chosen.length} backup record(s).`);
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
                  {filtered.map((snap, idx) => {
                    const srNo = (page - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(snap.id);
                    return (
                      <tr key={snap.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(snap.id)}
                            aria-label={`Select ${snap.file_name ?? snap.id}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5">
                          <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2 py-0.5 text-[11px] font-semibold break-all">
                            {snap.file_name ?? snap.id.slice(0, 8)}
                          </span>
                          {snap.error_message && (
                            <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-1 max-w-[260px] break-words">
                              {snap.error_message}
                            </p>
                          )}
                          {snap.triggered_by && (
                            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">by {snap.triggered_by}</p>
                          )}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label="Primary Database" tone="info" />
                          <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                            <NotAvailableText reason="region and retention are not recorded" />
                          </p>
                        </td>
                        <td className="py-3 px-3.5 font-semibold tabular-nums whitespace-nowrap">
                          {formatBytes(snap.size_bytes)}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={statusLabel(snap.status)} tone={getStatusTone(snap.status === "SUCCEEDED" ? "Completed" : snap.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          {snap.started_at ? formatDateTime(snap.started_at) : "-"}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">{restoreButton(snap)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((snap, idx) => {
              const srNo = (page - 1) * pageSize + idx + 1;
              const duration = durationOf(snap);
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
                      <span className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] font-semibold break-all">
                        {snap.file_name ?? snap.id.slice(0, 8)}
                      </span>
                      <StatusBadge label={statusLabel(snap.status)} tone={getStatusTone(snap.status === "SUCCEEDED" ? "Completed" : snap.status)} dot />
                      <StatusBadge label="Primary Database" tone="info" />
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-[var(--color-text-primary)]">
                      Size: {formatBytes(snap.size_bytes)} · Region: <NotAvailableText /> · Retention:{" "}
                      <NotAvailableText />
                    </p>
                    {snap.error_message && <p className="text-xs text-rose-700 dark:text-rose-300">{snap.error_message}</p>}
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {duration ? `Completed in ${duration}` : snap.status === "RUNNING" ? "Running" : "Not finished"} ·{" "}
                      {snap.started_at ? formatDateTime(snap.started_at) : "-"}
                      {snap.triggered_by ? ` · by ${snap.triggered_by}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">{restoreButton(snap)}</div>
                </div>
              );
            })}
          </div>
        )}

        <PaginationBar
          currentPage={page}
          totalItems={total}
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
          <div title={`${NOT_AVAILABLE}: the server always dumps the whole database`}>
            <OpSelect
              label="Backup Scope"
              value={backupScope}
              onChange={(e) => setBackupScope(e.target.value)}
              disabled
              options={[
                { label: "Primary Database", value: "Primary Database" },
                { label: "Workspace Attachments", value: "Workspace Attachments" },
                { label: "Audit Archive", value: "Audit Archive" },
              ]}
            />
            <span className="text-[10px] text-[var(--color-text-muted)]">
              {NOT_AVAILABLE}: the server always dumps the whole database (pg_dump).
            </span>
          </div>
          <MutationNotice notice={runMutation.notice} onReload={() => void reload()} onDismiss={runMutation.clearNotice} />
          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
            <OpButton type="button" variant="outline" size="sm" onClick={() => setBackupModalOpen(false)}>
              Cancel
            </OpButton>
            <OpButton
              type="submit"
              variant="primary"
              size="sm"
              disabled={runButtonDisabled}
              title={runButtonTitle}
              isLoading={runMutation.busy === "run-backup"}
            >
              Start Backup
            </OpButton>
          </div>
        </form>
      </OpModal>

      {/* Restore Request Modal */}
      <OpModal
        isOpen={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        title={restoreTarget ? `Request Restore — ${restoreTarget.file_name ?? restoreTarget.id}` : "Request Restore"}
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
            <NotAvailableButton variant="danger" size="sm" reason="no restore endpoint">
              Submit Restore Request
            </NotAvailableButton>
          </div>
        </form>
      </OpModal>
    </div>
  );
}
