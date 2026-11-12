"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { SyncJobItem } from "../_types";
import { formatDateTime } from "../_services/operator-service";
import {
  BulkSelectionBar,
  ConfirmModal,
  DemoDataBanner,
  EmptyState,
  FilterBar,
  KpiCard,
  OpButton,
  OpSelect,
  PageHeader,
  PaginationBar,
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";

type SyncSortField = "jobCode" | "queue" | "orgName" | "status" | "retries" | "lastRunAt";

export default function OperatorSyncJobsPage() {
  const syncJobs = usePlatformOperatorStore((s) => s.syncJobs);
  const retrySyncJob = usePlatformOperatorStore((s) => s.retrySyncJob);
  const toggleSyncJobPause = usePlatformOperatorStore((s) => s.toggleSyncJobPause);
  const bulkRetrySyncJobs = usePlatformOperatorStore((s) => s.bulkRetrySyncJobs);
  const { can } = useOperatorPermissions();
  const canManage = can("integrations.manage");

  const [search, setSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<SyncSortField>("lastRunAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [pauseTarget, setPauseTarget] = useState<SyncJobItem | null>(null);

  const activeJobsCount = useMemo(
    () => syncJobs.filter((j) => j.status === "Running" || j.status === "Queued").length,
    [syncJobs]
  );
  const failedJobsCount = useMemo(
    () => syncJobs.filter((j) => j.status === "Failed").length,
    [syncJobs]
  );
  const completedJobsCount = useMemo(
    () => syncJobs.filter((j) => j.status === "Completed").length,
    [syncJobs]
  );

  const handleSort = (field: SyncSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "lastRunAt" || field === "retries" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = syncJobs.filter((j) => {
      const matchesQ =
        !q ||
        j.jobCode.toLowerCase().includes(q) ||
        j.name.toLowerCase().includes(q) ||
        j.orgName.toLowerCase().includes(q) ||
        j.note.toLowerCase().includes(q);
      const matchesQueue = queueFilter === "ALL" || j.queue === queueFilter;
      const matchesStatus = statusFilter === "ALL" || j.status === statusFilter;
      return matchesQ && matchesQueue && matchesStatus;
    });

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "jobCode") cmp = a.jobCode.localeCompare(b.jobCode);
      else if (sortField === "queue") cmp = a.queue.localeCompare(b.queue);
      else if (sortField === "orgName") cmp = a.orgName.localeCompare(b.orgName);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else if (sortField === "retries") cmp = a.retries - b.retries;
      else cmp = new Date(a.lastRunAt).getTime() - new Date(b.lastRunAt).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [syncJobs, search, queueFilter, statusFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, queueFilter, statusFilter, pageSize]);

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
    filtered.map((j) => j.id),
    paginated.map((j) => j.id)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sync Jobs & Queues"
        badge={`${syncJobs.length} Jobs`}
        demoLabel="Demo Worker Queues"
        description="Monitor background synchronization queues, retry stalled jobs, and pause or resume authorized queue workers."
      />

      <DemoDataBanner
        title="Queue Safeguard"
        description="Retrying failed jobs processes remaining items cleanly. Pause/Resume applies only to operational queue workers and never alters billing rules."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Running / Queued"
          value={activeJobsCount}
          sublabel="Currently processing items"
          icon={RefreshCw}
          tone="teal"
        />
        <KpiCard
          label="Failed Jobs"
          value={failedJobsCount}
          sublabel="Waiting for operator retry"
          icon={AlertTriangle}
          tone={failedJobsCount > 0 ? "rose" : "emerald"}
        />
        <KpiCard
          label="Completed Jobs"
          value={completedJobsCount}
          sublabel="Processed cleanly"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search job code, name, or organization..."
          hasActiveFilters={Boolean(search || queueFilter !== "ALL" || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setQueueFilter("ALL");
            setStatusFilter("ALL");
          }}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-44">
                <OpSelect
                  value={queueFilter}
                  onChange={(e) => setQueueFilter(e.target.value)}
                  aria-label="Filter queue"
                  options={[
                    { label: "All Queues", value: "ALL" },
                    { label: "Webhook Ingestion", value: "Webhook Ingestion" },
                    { label: "GitHub Repo Sync", value: "GitHub Repo Sync" },
                    { label: "Invoice & Email Queue", value: "Invoice & Email Queue" },
                    { label: "Metrics Rollup", value: "Metrics Rollup" },
                  ]}
                />
              </div>
              <div className="w-36">
                <OpSelect
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter status"
                  options={[
                    { label: "All Statuses", value: "ALL" },
                    { label: "Running", value: "Running" },
                    { label: "Queued", value: "Queued" },
                    { label: "Completed", value: "Completed" },
                    { label: "Paused", value: "Paused" },
                    { label: "Failed", value: "Failed" },
                  ]}
                />
              </div>
            </div>
          }
        />

        {paginated.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="No sync jobs match your filter"
            description="Reset your search or queue filter."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((j) => j.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="primary"
                  size="xs"
                  disabled={!canManage}
                  onClick={() => {
                    const count = bulkRetrySyncJobs(selectedIds);
                    if (count > 0) toast.success(`Retried ${count} queued/failed sync job(s).`);
                    else toast.info("Selected jobs are already completed.");
                    setSelectedIds([]);
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Selected ({selectedIds.length})
                </OpButton>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[860px]">
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
                        aria-label="Select all sync jobs on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Job" active={sortField === "jobCode"} direction={sortDir} onSort={() => handleSort("jobCode")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Queue & Organization" active={sortField === "queue"} direction={sortDir} onSort={() => handleSort("queue")} />
                    </th>
                    <th className="py-2.5 px-3.5">Progress</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((job, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(job.id);
                    const pct = job.totalCount > 0 ? Math.round((job.processedCount / job.totalCount) * 100) : 100;
                    return (
                      <tr key={job.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(job.id)}
                            aria-label={`Select ${job.jobCode}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 max-w-[260px]">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-1.5 py-0.5 text-[10px] font-bold">
                              {job.jobCode}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-muted)]">
                              {formatDateTime(job.lastRunAt)}
                            </span>
                          </div>
                          <p className="font-semibold text-[var(--color-text-primary)] truncate">{job.name}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)] truncate">{job.note}</p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={job.queue} tone="neutral" />
                          <p className="text-[11px] font-medium text-[var(--color-text-secondary)] mt-1">
                            {job.orgName}
                          </p>
                        </td>
                        <td className="py-3 px-3.5 min-w-[160px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-[var(--color-text-muted)]">
                              <span>
                                {job.processedCount} / {job.totalCount} ({pct}%)
                              </span>
                              <span>{job.retries} retry</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                              <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={job.status} tone={getStatusTone(job.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {(job.status === "Failed" || job.status === "Queued") && (
                              <OpButton
                                variant="primary"
                                size="xs"
                                disabled={!canManage}
                                onClick={() => {
                                  retrySyncJob(job.id);
                                  toast.success(`Job ${job.jobCode} retried and completed (simulated).`);
                                }}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Retry
                              </OpButton>
                            )}
                            {job.status !== "Completed" && (
                              <OpButton
                                variant="outline"
                                size="xs"
                                disabled={!canManage}
                                onClick={() => setPauseTarget(job)}
                              >
                                {job.status === "Paused" ? (
                                  <>
                                    <PlayCircle className="w-3.5 h-3.5" />
                                    Resume
                                  </>
                                ) : (
                                  <>
                                    <PauseCircle className="w-3.5 h-3.5" />
                                    Pause
                                  </>
                                )}
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

      <ConfirmModal
        isOpen={Boolean(pauseTarget)}
        onClose={() => setPauseTarget(null)}
        title={
          pauseTarget?.status === "Paused"
            ? `Resume ${pauseTarget.jobCode}?`
            : `Pause ${pauseTarget?.jobCode}?`
        }
        description={
          pauseTarget?.status === "Paused"
            ? "Resuming places this queue job back into active processing."
            : "Pausing suspends processing on this background task until manually resumed."
        }
        confirmLabel={pauseTarget?.status === "Paused" ? "Resume Job" : "Pause Job"}
        variant={pauseTarget?.status === "Paused" ? "primary" : "danger"}
        onConfirm={() => {
          if (pauseTarget) {
            toggleSyncJobPause(pauseTarget.id);
            toast.success(`${pauseTarget.jobCode} ${pauseTarget.status === "Paused" ? "resumed" : "paused"}.`);
          }
        }}
      />
    </div>
  );
}
