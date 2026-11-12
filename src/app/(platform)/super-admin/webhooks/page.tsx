"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  RefreshCw,
  Webhook,
} from "lucide-react";
import { toast } from "sonner";
import { WebhookEventRecord } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { exportRowsToCsv, formatDateTime } from "../_services/super-admin-service";
import {
  AdminButton,
  BulkSelectionBar,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  SimulationNotice,
  SlideOverDrawer,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  useTableSelection,
} from "../_components/SuperAdminPrimitives";

function getWebhookSourceBadgeClass(source: string): string {
  const key = source.toLowerCase();
  if (key.includes("github")) {
    return "border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300";
  }
  if (key.includes("billing") || key.includes("stripe") || key.includes("payment")) {
    return "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  }
  return "border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300";
}

export default function SuperAdminWebhooksPage() {
  const webhookEvents = useSuperAdminStore((s) => s.webhookEvents);
  const retryWebhookEvent = useSuperAdminStore((s) => s.retryWebhookEvent);

  const { can } = useAdminPermissions();
  const canManage = can("integrations.manage");

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [selectedEvent, setSelectedEvent] = useState<WebhookEventRecord | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return webhookEvents.filter((w) => {
      if (sourceFilter !== "ALL" && w.source !== sourceFilter) return false;
      if (statusFilter !== "ALL" && w.status !== statusFilter) return false;
      if (q) {
        const hit =
          w.eventRef.toLowerCase().includes(q) ||
          w.eventTitle.toLowerCase().includes(q) ||
          w.orgName.toLowerCase().includes(q) ||
          w.summary.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [webhookEvents, search, sourceFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, sourceFilter, statusFilter, pageSize]);

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
    filtered.map((w) => w.id),
    paginated.map((w) => w.id)
  );

  const deliveredCount = webhookEvents.filter((w) => w.status === "Delivered").length;
  const failedCount = webhookEvents.filter((w) => w.status === "Failed").length;
  const avgLatency =
    webhookEvents.length > 0
      ? Math.round(webhookEvents.reduce((s, w) => s + w.latencyMs, 0) / webhookEvents.length)
      : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Webhooks & Events"
        description="High-level event delivery oversight across GitHub, Billing, and Email Relay channels."
        simulationLabel="Simulated Event Delivery"
      />

      <SimulationNotice
        title="Plain-Language Event Oversight"
        description="Event details are summarized in readable fields for governance oversight. Retry simulates re-delivering failed events."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="Tracked Events" value={webhookEvents.length} sublabel="Recent inbound & outbound events" icon={Webhook} tone="blue" />
        <KpiCard label="Delivered" value={deliveredCount} sublabel="Successfully processed" icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Failed Deliveries" value={failedCount} sublabel="Available for manual retry" icon={AlertTriangle} tone={failedCount > 0 ? "rose" : "slate"} />
        <KpiCard label="Avg Processing Time" value={`${avgLatency} ms`} sublabel="Across all event sources" icon={RefreshCw} tone="violet" />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search event ID, organization, or summary..."
            hasActiveFilters={Boolean(search || sourceFilter !== "ALL" || statusFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setSourceFilter("ALL");
              setStatusFilter("ALL");
            }}
            onExportCsv={() => {
              if (!can("system.export")) {
                toast.error("Missing export permission");
                return;
              }
              exportRowsToCsv(
                "prowise-webhook-events.csv",
                ["Reference", "Source", "Event", "Organization", "Status", "Attempts", "Latency (ms)", "Received"],
                filtered.map((w) => [
                  w.eventRef,
                  w.source,
                  w.eventTitle,
                  w.orgName,
                  w.status,
                  w.attempts,
                  w.latencyMs,
                  w.receivedAt,
                ])
              );
              toast.success("Exported webhook events CSV");
            }}
            exportDisabled={!can("system.export") || filtered.length === 0}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  aria-label="Filter event source"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Sources</option>
                  <option value="GitHub">GitHub</option>
                  <option value="Billing">Billing</option>
                  <option value="Email Relay">Email Relay</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter delivery status"
                  className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Failed">Failed</option>
                  <option value="Retrying">Retrying</option>
                </select>
              </div>
            }
          />
        </div>

        <BulkSelectionBar
          selectedCount={selectedIds.length}
          totalFilteredCount={filtered.length}
          onSelectAllMatching={() => setSelectedIds(filtered.map((w) => w.id))}
          onClear={() => setSelectedIds([])}
          actions={
            <>
              <AdminButton
                variant="subtle"
                size="xs"
                permissionLocked={!canManage}
                onClick={() => {
                  let count = 0;
                  for (const id of selectedIds) {
                    const ev = webhookEvents.find((w) => w.id === id);
                    if (ev && ev.status === "Failed") {
                      retryWebhookEvent(id);
                      count++;
                    }
                  }
                  if (count === 0) toast.info("No failed events in selection.");
                  else {
                    toast.success(`Retried ${count} failed webhook event${count === 1 ? "" : "s"}`);
                    setSelectedIds([]);
                  }
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Failed
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!can("system.export")}
                onClick={() => {
                  const targets = webhookEvents.filter((w) => selectedSet.has(w.id));
                  exportRowsToCsv(
                    "prowise-webhook-events-selected.csv",
                    ["Sr. No.", "Ref", "Event", "Source", "Organization", "Status", "HTTP", "Received"],
                    targets.map((w, idx) => [
                      idx + 1,
                      w.eventRef,
                      w.eventTitle,
                      w.source,
                      w.orgName,
                      w.status,
                      w.httpCode,
                      w.receivedAt,
                    ])
                  );
                  toast.success(`Exported ${targets.length} webhook event${targets.length === 1 ? "" : "s"}`);
                }}
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </AdminButton>
            </>
          }
        />

        {paginated.length === 0 ? (
          <EmptyStateView
            icon={Webhook}
            title="No events match your filters"
            description="Adjust search or filter options to inspect event history."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--color-border)] bg-[var(--color-sidebar)] text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = somePageSelected;
                      }}
                      onChange={toggleSelectPage}
                      aria-label="Select all webhook events on this page"
                      className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 w-16 whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3 hidden md:table-cell">Organization</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Received</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {paginated.map((w, idx) => {
                  const serialNumber = (safePage - 1) * pageSize + idx + 1;
                  const isSelected = selectedSet.has(w.id);
                  return (
                    <tr
                      key={w.id}
                      className={`hover:bg-[var(--color-hover)] transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(w.id)}
                          aria-label={`Select event ${w.eventRef}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[var(--color-text-primary)] flex flex-wrap items-center gap-1.5">
                          <span>{w.eventTitle}</span>
                          <span className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                            {w.eventRef}
                          </span>
                        </div>
                        <div className="text-[11px] text-[var(--color-text-secondary)] line-clamp-1 mt-0.5">
                          {w.summary}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${getWebhookSourceBadgeClass(
                            w.source
                          )}`}
                        >
                          {w.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {getOrgInitials(w.orgName)}
                          </div>
                          <span className="font-medium text-[var(--color-text-primary)]">{w.orgName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={w.status}
                          tone={w.status === "Delivered" ? "success" : w.status === "Failed" ? "danger" : "warning"}
                          dot
                        />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-text-muted)] whitespace-nowrap">
                        {formatDateTime(w.receivedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <AdminButton variant="ghost" size="xs" onClick={() => setSelectedEvent(w)}>
                            <Eye className="w-3.5 h-3.5" />
                          </AdminButton>
                          {w.status === "Failed" && (
                            <AdminButton
                              variant="subtle"
                              size="xs"
                              permissionLocked={!canManage}
                              onClick={() => {
                                retryWebhookEvent(w.id);
                                toast.success(`Simulated retry succeeded for ${w.eventRef}`);
                              }}
                            >
                              <RefreshCw className="w-3 h-3" />
                              Retry
                            </AdminButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar
          currentPage={safePage}
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </SurfaceCard>

      <SlideOverDrawer
        isOpen={Boolean(selectedEvent)}
        onClose={() => setSelectedEvent(null)}
        title={selectedEvent ? `${selectedEvent.eventTitle} (${selectedEvent.eventRef})` : ""}
        subtitle={selectedEvent ? `${selectedEvent.source} • ${selectedEvent.orgName}` : undefined}
      >
        {selectedEvent && (
          <div className="space-y-4 text-xs">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <StatusBadge
                  label={selectedEvent.status}
                  tone={selectedEvent.status === "Delivered" ? "success" : "danger"}
                  dot
                />
                <span className="text-[var(--color-text-muted)]">
                  Response Code: <strong className="text-[var(--color-text-primary)]">{selectedEvent.httpCode}</strong>
                </span>
              </div>
              <p className="text-[var(--color-text-primary)] leading-relaxed">{selectedEvent.summary}</p>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--color-border)]">
                <div>
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Delivery Attempts</span>
                  <p className="font-semibold text-[var(--color-text-primary)] mt-0.5">{selectedEvent.attempts}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Processing Time</span>
                  <p className="font-semibold text-[var(--color-text-primary)] mt-0.5">{selectedEvent.latencyMs} ms</p>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] uppercase text-[var(--color-text-muted)]">Received At</span>
                  <p className="font-semibold text-[var(--color-text-primary)] mt-0.5">
                    {formatDateTime(selectedEvent.receivedAt)}
                  </p>
                </div>
              </div>
            </div>

            {selectedEvent.status === "Failed" && (
              <AdminButton
                variant="primary"
                size="sm"
                className="w-full"
                permissionLocked={!canManage}
                onClick={() => {
                  retryWebhookEvent(selectedEvent.id);
                  setSelectedEvent(null);
                  toast.success(`Retried ${selectedEvent.eventRef} successfully`);
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry Event Delivery (Simulated)
              </AdminButton>
            )}
          </div>
        )}
      </SlideOverDrawer>
    </div>
  );
}
