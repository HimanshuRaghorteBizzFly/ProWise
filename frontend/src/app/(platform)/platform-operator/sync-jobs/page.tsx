"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import type { OpsBackgroundJob } from "@/types/operator-console";
import { useOperatorPermissions } from "../_services/operator-access";
import { operatorApi } from "../_services/operator-api";
import { formatDateTime } from "../_services/operator-service";
import {
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  humanizeCode,
  readyValue,
  rowsOf,
  useOperatorResource,
} from "../_components/OperatorLive";
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

const RETRY_REASON = "the server queues the job but no worker consumes it yet";
const PAUSE_REASON = "there is no pause or resume endpoint for jobs";

/** One background job as the table shows it (GET /v1/operator/jobs). */
interface SyncJobRow {
  id: string;
  jobCode: string;
  name: string;
  queue: string;
  orgName: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  retries: number;
  lastRunAt: string;
  note: string;
}

function toRow(j: OpsBackgroundJob): SyncJobRow {
  return {
    id: j.id,
    jobCode: j.id,
    name: j.job_name,
    queue: j.queue_name,
    orgName: "",
    status: humanizeCode(j.status),
    attempts: j.attempts,
    maxAttempts: j.max_attempts,
    retries: j.attempts,
    lastRunAt: j.completed_at ?? j.started_at ?? j.scheduled_at ?? j.created_at ?? "",
    note: j.error_details ?? "",
  };
}

export default function OperatorSyncJobsPage() {
  const { state, reload } = useOperatorResource(() => operatorApi.jobs(), "jobs");
  const syncJobs = useMemo(() => rowsOf(state).map(toRow), [state]);
  const queueOptions = useMemo(() => Array.from(new Set(syncJobs.map((j) => j.queue))).sort(), [syncJobs]);
  const { can } = useOperatorPermissions();
  const canManage = can("integrations.manage");

  const [search, setSearch] = useState("");
  const [queueFilter, setQueueFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<SyncSortField>("lastRunAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  // Pause / Resume has no endpoint: the confirmation stays in place but nothing opens it yet.
  const [pauseTarget, setPauseTarget] = useState<SyncJobRow | null>(null);

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
        badge={`${state.status === "ready" ? syncJobs.length : "-"} Jobs`}
        liveData
        description="Monitor background synchronization queues, retry stalled jobs, and pause or resume authorized queue workers."
        actions={
          <OpButton variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Queue Safeguard"
        description="Retrying failed jobs processes remaining items cleanly. Pause/Resume applies only to operational queue workers and never alters billing rules."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Running / Queued"
          value={readyValue(state, () => activeJobsCount)}
          sublabel="Currently processing items"
          icon={RefreshCw}
          tone="teal"
        />
        <KpiCard
          label="Failed Jobs"
          value={readyValue(state, () => failedJobsCount)}
          sublabel="Waiting for operator retry"
          icon={AlertTriangle}
          tone={failedJobsCount > 0 ? "rose" : "emerald"}
        />
        <KpiCard
          label="Completed Jobs"
          value={readyValue(state, () => completedJobsCount)}
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
                    ...queueOptions.map((q) => ({ label: q, value: q })),
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

        {state.status !== "ready" || state.data.length === 0 ? (
          <OperatorResourceStatus
            state={state}
            isEmpty={(d) => d.length === 0}
            onRetry={() => void reload()}
            emptyIcon={RefreshCw}
            emptyTitle="No background jobs"
            emptyDescription="The server has no queued, running or finished jobs to show."
          />
        ) : paginated.length === 0 ? (
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
                <NotAvailableButton variant="primary" size="xs" reason={RETRY_REASON} hideLabel>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Selected ({selectedIds.length})
                </NotAvailableButton>
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
                            {job.orgName || "—"}
                          </p>
                        </td>
                        <td className="py-3 px-3.5 min-w-[160px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-[var(--color-text-muted)]">
                              {/* Item counts are not reported by the server; attempts are. */}
                              <NotAvailableText reason="the server does not report processed item counts" />
                              <span>
                                {job.attempts} / {job.maxAttempts} attempts
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden" />
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={job.status} tone={getStatusTone(job.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {(job.status === "Failed" || job.status === "Queued") && (
                              <NotAvailableButton variant="primary" size="xs" reason={RETRY_REASON} hideLabel>
                                <RotateCcw className="w-3.5 h-3.5" />
                                Retry
                              </NotAvailableButton>
                            )}
                            {job.status !== "Completed" && (
                              <NotAvailableButton variant="outline" size="xs" reason={PAUSE_REASON} hideLabel>
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
                              </NotAvailableButton>
                            )}
                            {!canManage && <span className="sr-only">Your role cannot manage jobs.</span>}
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
          // No pause/resume endpoint exists; nothing is changed locally either.
          setPauseTarget(null);
        }}
      />
    </div>
  );
}
