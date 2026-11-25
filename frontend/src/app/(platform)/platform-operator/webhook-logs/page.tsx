"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Eye,
  RefreshCw,
  RotateCcw,
  Webhook,
} from "lucide-react";
import type { OpsWebhookReceipt } from "@/types/operator-console";
import { useOperatorPermissions } from "../_services/operator-access";
import { operatorApi } from "../_services/operator-api";
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
  PageHeader,
  PaginationBar,
  SortableHeader,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  getStatusTone,
  useTableSelection,
} from "../_components/OperatorPrimitives";
import {
  NotAvailableButton,
  NotAvailableText,
  OperatorResourceStatus,
  humanizeCode,
  readyValue,
  rowsOf,
  useOperatorResource,
} from "../_components/OperatorLive";

type WebhookSortField = "referenceId" | "orgName" | "source" | "status" | "attempts" | "timestamp";

/**
 * POST /v1/operator/webhooks/{id}/retry exists but only marks the receipt PROCESSED: nothing is re-delivered, so a
 * "retry" would report a success that did not happen. The retry controls stay visible and disabled.
 */
const RETRY_REASON = "the server only marks the receipt processed; nothing is re-delivered";

/** One webhook receipt as the table shows it (the payload is never rendered: it can carry private data). */
interface WebhookRow {
  id: string;
  referenceId: string;
  source: string;
  eventTitle: string;
  orgName: string;
  status: string;
  attempts: number;
  friendlyReason: string;
  timestamp: string;
  lastRetryAt: string | null;
}

function displayStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === "PROCESSED" || s === "DELIVERED") return "Delivered";
  return humanizeCode(status);
}

function toRow(w: OpsWebhookReceipt): WebhookRow {
  return {
    id: w.id,
    referenceId: w.webhook_id ?? w.id,
    source: humanizeCode(w.source),
    eventTitle: w.event_type,
    orgName: "",
    status: displayStatus(w.status),
    attempts: w.attempts,
    friendlyReason: w.error_message ?? "No delivery error recorded.",
    timestamp: w.received_at ?? "",
    lastRetryAt: w.last_retry_at,
  };
}

export default function OperatorWebhookLogsPage() {
  const { state, reload } = useOperatorResource(() => operatorApi.webhooks(), "webhooks");
  const webhooks = useMemo(() => rowsOf(state).map(toRow), [state]);
  const sourceOptions = useMemo(() => Array.from(new Set(webhooks.map((w) => w.source))).sort(), [webhooks]);
  const { can } = useOperatorPermissions();
  const canRetry = can("integrations.manage");

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortField, setSortField] = useState<WebhookSortField>("timestamp");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [selected, setSelected] = useState<WebhookRow | null>(null);

  const deliveredCount = useMemo(
    () => webhooks.filter((w) => w.status === "Delivered").length,
    [webhooks]
  );
  const retryingCount = useMemo(
    () => webhooks.filter((w) => w.status === "Retrying").length,
    [webhooks]
  );
  const failedCount = useMemo(
    () => webhooks.filter((w) => w.status === "Failed").length,
    [webhooks]
  );

  const handleSort = (field: WebhookSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "timestamp" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = webhooks.filter((w) => {
      const matchesQ =
        !q ||
        w.referenceId.toLowerCase().includes(q) ||
        w.eventTitle.toLowerCase().includes(q) ||
        w.orgName.toLowerCase().includes(q) ||
        w.friendlyReason.toLowerCase().includes(q);
      const matchesSource = sourceFilter === "ALL" || w.source === sourceFilter;
      const matchesStatus = statusFilter === "ALL" || w.status === statusFilter;
      return matchesQ && matchesSource && matchesStatus;
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
  }, [webhooks, search, sourceFilter, statusFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, sourceFilter, statusFilter, pageSize]);

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

  const handleExportCsv = () => {
    // Exports the rows already loaded from the server; fields the server does not send are left empty.
    exportRowsToCsv(
      `prowise-webhook-deliveries-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Sr No", "Reference", "Source", "Event", "Organization", "Status", "HTTP Code", "Attempts", "Latency (ms)", "Summary", "Timestamp"],
      filtered.map((w, i) => [
        i + 1,
        w.referenceId,
        w.source,
        w.eventTitle,
        w.orgName,
        w.status,
        "",
        w.attempts,
        "",
        w.friendlyReason,
        w.timestamp,
      ])
    );
    toast.success(`Exported ${filtered.length} webhook delivery record(s) to CSV.`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Webhook Delivery Logs"
        badge={`${state.status === "ready" ? webhooks.length : "-"} Events`}
        liveData
        description="Track incoming and outgoing webhook notifications in plain language, inspect delivery delays, and trigger safe duplicate-free retries."
        actions={
          <OpButton variant="outline" size="sm" onClick={() => void reload()}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Human-Readable Event Summaries"
        description="Raw webhook payloads and headers are kept internal for security. Operators see verified event summaries, attempt counts, and clear delivery statuses."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Delivered Cleanly"
          value={readyValue(state, () => deliveredCount)}
          sublabel="Accepted without duplicate work items"
          icon={CheckCircle2}
          tone="emerald"
        />
        <KpiCard
          label="Retrying in Backoff"
          value={readyValue(state, () => retryingCount)}
          sublabel="Scheduled automatic retry"
          icon={RotateCcw}
          tone="amber"
        />
        <KpiCard
          label="Failed Deliveries"
          value={readyValue(state, () => failedCount)}
          sublabel="Ready for manual operator replay"
          icon={Webhook}
          tone={failedCount > 0 ? "rose" : "emerald"}
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search reference, event title, or organization..."
          hasActiveFilters={Boolean(search || sourceFilter !== "ALL" || statusFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setSourceFilter("ALL");
            setStatusFilter("ALL");
          }}
          onExportCsv={handleExportCsv}
          exportDisabled={filtered.length === 0}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-36">
                <OpSelect
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  aria-label="Filter source"
                  options={[
                    { label: "All Sources", value: "ALL" },
                    ...sourceOptions.map((s) => ({ label: s, value: s })),
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
                    { label: "Delivered", value: "Delivered" },
                    { label: "Retrying", value: "Retrying" },
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
            emptyIcon={Webhook}
            emptyTitle="No webhook deliveries yet"
            emptyDescription="The server has not received any webhook events."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="No webhook deliveries match your filter"
            description="Reset your search or status filter to view all delivery records."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((w) => w.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <NotAvailableButton variant="primary" size="xs" reason={RETRY_REASON} hideLabel>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Retry Selected ({selectedIds.length})
                </NotAvailableButton>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[840px]">
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
                        aria-label="Select all webhook logs on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Event" active={sortField === "referenceId"} direction={sortDir} onSort={() => handleSort("referenceId")} />
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
                          <span className="font-semibold text-[var(--color-text-primary)]">{item.referenceId}</span>
                          <span className="block text-[11px] text-[var(--color-text-muted)]">
                            {formatDateTime(item.timestamp)}
                          </span>
                        </td>
                        <td className="py-3 px-3.5 min-w-[240px]">
                          <div className="flex items-start gap-2">
                            <span className="h-6 w-6 rounded bg-teal-500/15 text-[10px] font-bold text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                              {getOrgInitials(item.orgName || item.source)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[var(--color-text-primary)] truncate">
                                {item.eventTitle} — {item.orgName || "—"}
                              </p>
                              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">
                                {item.friendlyReason}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={item.source} tone="neutral" />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <StatusBadge label={item.status} tone={getStatusTone(item.status)} dot />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-[var(--color-text-secondary)] tabular-nums">
                          {item.attempts} try · — ms
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <OpButton variant="outline" size="xs" onClick={() => setSelected(item)}>
                              <Eye className="w-3.5 h-3.5" />
                              Inspect
                            </OpButton>
                            {item.status !== "Delivered" && (
                              <NotAvailableButton variant="primary" size="xs" reason={RETRY_REASON} hideLabel>
                                <RotateCcw className="w-3.5 h-3.5" />
                                Retry
                              </NotAvailableButton>
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
        {!canRetry && <span className="sr-only">Your role cannot retry webhook events.</span>}
      </SurfaceCard>

      {/* Webhook Event Detail Modal (Centered) */}
      <OpModal
        isOpen={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.referenceId} — Delivery Summary` : "Webhook Event"}
        description={selected ? `${selected.source} · ${selected.orgName || "—"}` : undefined}
        maxWidth="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label={selected.status} tone={getStatusTone(selected.status)} dot />
              <StatusBadge label="Response Code —" tone="neutral" />
              {selected.lastRetryAt && (
                <StatusBadge label={`Last retry ${formatDateTime(selected.lastRetryAt)}`} tone="neutral" />
              )}
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 text-xs space-y-2">
              <p className="font-semibold text-[var(--color-text-primary)] text-sm">{selected.eventTitle}</p>
              <p className="text-[var(--color-text-secondary)] leading-relaxed">{selected.friendlyReason}</p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--color-border)]">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] block">Delivery Attempts</span>
                  <strong className="text-[var(--color-text-primary)]">{selected.attempts}</strong>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-[var(--color-text-muted)] block">Response Time</span>
                  <NotAvailableText reason="the server does not record response times" />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
              <OpButton
                variant="outline"
                size="sm"
                onClick={() => setSelected(null)}
                className="w-full sm:w-auto"
              >
                Close
              </OpButton>
              {selected.status !== "Delivered" && (
                <NotAvailableButton
                  variant="primary"
                  size="sm"
                  reason={RETRY_REASON}
                  className="w-full sm:w-auto gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Replay Event & Sync Now</span>
                </NotAvailableButton>
              )}
            </div>
          </div>
        )}
      </OpModal>
    </div>
  );
}
