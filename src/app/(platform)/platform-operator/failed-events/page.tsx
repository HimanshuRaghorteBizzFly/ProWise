"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
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

type FailedSortField = "referenceId" | "orgName" | "source" | "status" | "attempts" | "timestamp";

export default function OperatorFailedEventsPage() {
  const webhooks = usePlatformOperatorStore((s) => s.webhooks);
  const retryWebhookEvent = usePlatformOperatorStore((s) => s.retryWebhookEvent);
  const retryAllFailedWebhooks = usePlatformOperatorStore((s) => s.retryAllFailedWebhooks);
  const bulkRetryWebhooks = usePlatformOperatorStore((s) => s.bulkRetryWebhooks);
  const { can } = useOperatorPermissions();
  const canRetry = can("integrations.manage");

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [sortField, setSortField] = useState<FailedSortField>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [confirmBatchOpen, setConfirmBatchOpen] = useState(false);

  const failedAndRetrying = useMemo(
    () => webhooks.filter((w) => w.status === "Failed" || w.status === "Retrying"),
    [webhooks]
  );

  const recentlyRecovered = useMemo(
    () => webhooks.filter((w) => w.status === "Delivered" && w.syncedJobCode),
    [webhooks]
  );

  const handleSort = (field: FailedSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "timestamp" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = failedAndRetrying.filter((w) => {
      const matchesQ =
        !q ||
        w.referenceId.toLowerCase().includes(q) ||
        w.eventTitle.toLowerCase().includes(q) ||
        w.orgName.toLowerCase().includes(q) ||
        w.friendlyReason.toLowerCase().includes(q);
      const matchesSource = sourceFilter === "ALL" || w.source === sourceFilter;
      return matchesQ && matchesSource;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "referenceId") cmp = a.referenceId.localeCompare(b.referenceId);
      else if (sortField === "orgName") cmp = a.orgName.localeCompare(b.orgName);
      else if (sortField === "source") cmp = a.source.localeCompare(b.source);
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else if (sortField === "attempts") cmp = a.attempts - b.attempts;
      else cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [failedAndRetrying, search, sourceFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, sourceFilter, pageSize]);

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
    filtered.map((w) => w.id),
    paginated.map((w) => w.id)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Failed Events & Retries"
        badge={`${failedAndRetrying.length} Pending`}
        demoLabel="Demo Retry Queue"
        description="Inspect undelivered webhook events, understand why delivery stopped in plain language, and trigger duplicate-safe replays."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/platform-operator/sync-jobs">
              <OpButton variant="outline" size="sm">
                <RefreshCw className="w-3.5 h-3.5" />
                View Sync Jobs
              </OpButton>
            </Link>
            <OpButton
              variant="primary"
              size="sm"
              disabled={!canRetry || failedAndRetrying.length === 0}
              onClick={() => setConfirmBatchOpen(true)}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry All ({failedAndRetrying.length})
            </OpButton>
          </div>
        }
      />

      <DemoDataBanner
        title="Webhook Failure -> Retry -> Sync"
        description="Retrying an event automatically schedules and completes a deduplicated Sync Job so downstream workspaces catch up safely without duplicate records."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Failed Events"
          value={webhooks.filter((w) => w.status === "Failed").length}
          sublabel="Requires manual or scheduled replay"
          icon={AlertCircle}
          tone="rose"
        />
        <KpiCard
          label="Automatic Backoff Queue"
          value={webhooks.filter((w) => w.status === "Retrying").length}
          sublabel="Retrying on next scheduled interval"
          icon={RotateCcw}
          tone="amber"
        />
        <KpiCard
          label="Recovered via Replay"
          value={recentlyRecovered.length}
          sublabel="Completed cleanly through sync queue"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search failed reference, event, or tenant..."
          hasActiveFilters={Boolean(search || sourceFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setSourceFilter("ALL");
          }}
          filters={
            <div className="w-40">
              <OpSelect
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                aria-label="Filter event source"
                options={[
                  { label: "All Sources", value: "ALL" },
                  { label: "GitHub", value: "GitHub" },
                  { label: "Billing", value: "Billing" },
                  { label: "Email Relay", value: "Email Relay" },
                ]}
              />
            </div>
          }
        />

        {paginated.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="All failed events cleared"
            description="No failed or retrying webhook events are currently waiting in the queue."
            actionLabel="Check Sync Jobs"
            onAction={() => {
              window.location.href = "/platform-operator/sync-jobs";
            }}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((w) => w.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <OpButton
                  variant="primary"
                  size="xs"
                  disabled={!canRetry}
                  onClick={() => {
                    const count = bulkRetryWebhooks(selectedIds);
                    toast.success(`Replayed ${count} failed event(s).`);
                    setSelectedIds([]);
                  }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Selected ({selectedIds.length})
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
                        aria-label="Select all failed events on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Reference" active={sortField === "referenceId"} direction={sortDir} onSort={() => handleSort("referenceId")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Organization & Summary" active={sortField === "orgName"} direction={sortDir} onSort={() => handleSort("orgName")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Source" active={sortField === "source"} direction={sortDir} onSort={() => handleSort("source")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Status" active={sortField === "status"} direction={sortDir} onSort={() => handleSort("status")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Attempts" active={sortField === "attempts"} direction={sortDir} onSort={() => handleSort("attempts")} />
                    </th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)] text-xs">
                  {paginated.map((item, idx) => {
                    const srNo = (safePage - 1) * pageSize + idx + 1;
                    const isSelected = selectedSet.has(item.id);
                    return (
                      <tr key={item.id} className={isSelected ? "bg-teal-500/5" : "hover:bg-[var(--color-hover)]/50"}>
                        <td className="py-3 px-3.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectOne(item.id)}
                            aria-label={`Select ${item.referenceId}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span className="rounded border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2 py-0.5 text-[11px] font-semibold">
                            {item.referenceId}
                          </span>
                          <span className="block text-[10px] text-[var(--color-text-muted)] mt-1">
                            {formatDateTime(item.timestamp)}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 min-w-[240px]">
                          <p className="font-semibold text-[var(--color-text-primary)]">
                            {item.eventTitle} — {item.orgName}
                          </p>
                          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{item.friendlyReason}</p>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={item.source} tone="neutral" />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={item.status} tone={getStatusTone(item.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          HTTP {item.httpStatus} · {item.attempts} try
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <OpButton
                            variant="primary"
                            size="xs"
                            disabled={!canRetry}
                            onClick={() => {
                              const jobCode = retryWebhookEvent(item.id);
                              toast.success(`Replayed ${item.referenceId} cleanly via ${jobCode} (simulated).`);
                            }}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Retry & Sync Now
                          </OpButton>
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

      {recentlyRecovered.length > 0 && (
        <SurfaceCard className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Recently Replayed & Synced
            </h3>
            <Link href="/platform-operator/sync-jobs">
              <OpButton variant="ghost" size="xs">
                Open Sync Queue <ArrowRight className="w-3 h-3" />
              </OpButton>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentlyRecovered.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-[var(--color-text-primary)]">
                    {item.referenceId} — {item.orgName}
                  </strong>
                  <StatusBadge label={item.syncedJobCode || "Synced"} tone="success" />
                </div>
                <p className="text-[var(--color-text-secondary)]">{item.friendlyReason}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      )}

      <ConfirmModal
        isOpen={confirmBatchOpen}
        onClose={() => setConfirmBatchOpen(false)}
        title="Replay All Pending & Failed Events?"
        description={`This will trigger a deduplicated batch replay across ${failedAndRetrying.length} event(s) and create a corresponding Sync Job record.`}
        confirmLabel="Replay All Now"
        variant="primary"
        onConfirm={() => {
          const count = retryAllFailedWebhooks();
          toast.success(`Batch replay completed for ${count} event(s) (simulated).`);
        }}
      />
    </div>
  );
}
