"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, GitBranch, Info, Plug, RefreshCw, Send, Webhook } from "lucide-react";
import type {
  OpsFailedOutboxEvent,
  OpsGitHubRepository,
  OpsIntegration,
  OpsWebhookReceipt,
} from "@/types/admin-operations";
import {
  AdminButton,
  AdminSelect,
  FilterBar,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getStatusTone,
} from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import { AdminTable, ResourceStatus, cellClass, formatInstant, humanize, mutedCellClass, type ResourceState } from "../admin-resource";
import { CountKpi, MutationNotice, matchesSearch, paginate, type MutationNoticeState } from "./shared";
import { usePagedRows } from "../use-paged-rows";

/** Plain information note (not a simulation notice: everything on these pages is server data). */
export function InfoNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div role="note" className="flex items-start gap-2.5 rounded-xl border border-blue-500/25 bg-blue-500/10 px-3.5 py-2.5 text-xs text-blue-800 dark:text-blue-200">
      <Info className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="min-w-0">
        <span className="font-semibold">{title}: </span>
        <span>{children}</span>
      </div>
    </div>
  );
}

const healthy = (i: OpsIntegration) => (i.health ?? "").toUpperCase() === "HEALTHY" && i.error_count === 0;

/* ------------------------------------------------------------------ Integration Overview */

export function IntegrationsOverviewView({
  integrations,
  repositories,
  onRetryIntegrations,
  onRetryRepositories,
}: {
  integrations: ResourceState<OpsIntegration[]>;
  repositories: ResourceState<OpsGitHubRepository[]>;
  onRetryIntegrations: () => void;
  onRetryRepositories: () => void;
}) {
  const installations = useMemo(() => (integrations.status === "ready" ? integrations.data : []), [integrations]);
  const installationPage = usePagedRows(installations);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Overview"
        description="Integration installations recorded on the platform and their reported health. Queue diagnostics stay in the Platform Operator workspace."
        actions={
          <Link href="/super-admin/integration-settings" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
            Integration settings
          </Link>
        }
      />

      <InfoNote title="GitHub connection">
        Connecting a GitHub App is delivered in a later phase, so installations cannot be added from this console yet. GitHub
        activity is evidence only and never sets project progress.
      </InfoNote>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CountKpi state={integrations} count={(d) => d.length} label="Installations" sublabel="Recorded integration installations" icon={Plug} tone="blue" />
        <CountKpi state={integrations} count={(d) => d.filter(healthy).length} label="Healthy" sublabel="Reported healthy, no errors" icon={CheckCircle2} tone="emerald" />
        <CountKpi state={integrations} count={(d) => d.filter((i) => !healthy(i)).length} label="Attention Needed" sublabel="Degraded health or errors" icon={AlertTriangle} tone="amber" />
        <CountKpi state={repositories} count={(d) => d.length} label="Linked Repositories" sublabel="GitHub repositories linked" icon={GitBranch} tone="violet" />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Installations</h3>
        </div>
        <ResourceStatus
          state={integrations}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetryIntegrations}
          emptyIcon={Plug}
          emptyTitle="No integrations installed"
          emptyDescription="No integration installation has been recorded on the platform yet."
        />
        {integrations.status === "ready" && integrations.data.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 sm:p-5">
            {installationPage.pageRows.map((i) => (
              <div key={i.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{i.name}</h4>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{humanize(i.type)}</p>
                  </div>
                  <StatusBadge label={humanize(i.status)} tone={getStatusTone(i.status)} dot />
                </div>
                <dl className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <dt className="text-[var(--color-text-muted)]">Health</dt>
                    <dd>
                      <StatusBadge label={humanize(i.health)} tone={getStatusTone(i.health)} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--color-text-muted)]">Errors</dt>
                    <dd className={i.error_count > 0 ? "font-semibold text-rose-600 dark:text-rose-400" : "text-[var(--color-text-primary)]"}>{i.error_count}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[var(--color-text-muted)]">Last synced</dt>
                    <dd className="text-[var(--color-text-primary)]">{formatInstant(i.last_synced_at)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}
        {installations.length > 0 && <PaginationBar {...installationPage.barProps} />}
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Repositories</h3>
          <Link href="/super-admin/github-integrations" className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
            View all
          </Link>
        </div>
        <ResourceStatus
          state={repositories}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetryRepositories}
          emptyIcon={GitBranch}
          emptyTitle="No repositories linked"
          emptyDescription="Repositories appear here once a GitHub installation links them."
        />
        {repositories.status === "ready" && repositories.data.length > 0 && <RepositoryTable rows={repositories.data.slice(0, 5)} />}
      </SurfaceCard>
    </div>
  );
}

function RepositoryTable({ rows }: { rows: OpsGitHubRepository[] }) {
  return (
    <AdminTable label="Linked GitHub repositories" headers={["Repository", "Installation", "Default branch", "Webhook", "Last event", "Linked"]}>
      {rows.map((r) => (
        <tr key={r.id}>
          <td className={`${cellClass} font-semibold`}>{r.repo_full_name}</td>
          <td className={mutedCellClass}>{r.installation_id || "-"}</td>
          <td className={mutedCellClass}>{r.default_branch || "-"}</td>
          <td className={cellClass}>
            <StatusBadge label={r.webhook_active ? "Active" : "Inactive"} tone={r.webhook_active ? "success" : "neutral"} dot />
          </td>
          <td className={mutedCellClass}>{formatInstant(r.last_event_at)}</td>
          <td className={mutedCellClass}>{formatInstant(r.created_at)}</td>
        </tr>
      ))}
    </AdminTable>
  );
}

/* ------------------------------------------------------------------ GitHub Integration */

export function GitHubRepositoriesView({ repositories, onRetry }: { repositories: ResourceState<OpsGitHubRepository[]>; onRetry: () => void }) {
  const [search, setSearch] = useState("");
  const [webhookFilter, setWebhookFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const rows = useMemo(() => (repositories.status === "ready" ? repositories.data : []), [repositories]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          matchesSearch(search, r.repo_full_name, r.installation_id, r.default_branch) &&
          (webhookFilter === "ALL" || (webhookFilter === "ACTIVE" ? r.webhook_active : !r.webhook_active)),
      ),
    [rows, search, webhookFilter],
  );
  const pageData = paginate(filtered, page, pageSize);

  return (
    <div className="space-y-6">
      <PageHeader title="GitHub Integration" description="Repositories linked to the platform through GitHub App installations and their webhook state." />

      <InfoNote title="Connecting GitHub">
        The GitHub App connect flow is delivered in a later phase. This page lists the repository links stored on the server.
      </InfoNote>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CountKpi state={repositories} count={(d) => new Set(d.map((r) => r.installation_id).filter(Boolean)).size} label="App Installations" sublabel="Distinct installations with links" icon={GitBranch} tone="blue" />
        <CountKpi state={repositories} count={(d) => d.length} label="Linked Repositories" sublabel="Stored repository links" icon={CheckCircle2} tone="emerald" />
        <CountKpi state={repositories} count={(d) => d.filter((r) => r.webhook_active).length} label="Webhooks Active" sublabel="Receiving repository events" icon={Webhook} tone="emerald" />
        <CountKpi state={repositories} count={(d) => d.filter((r) => !r.webhook_active).length} label="Webhooks Inactive" sublabel="No events being received" icon={AlertTriangle} tone="amber" />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder="Search repository, installation, or branch..."
            hasActiveFilters={Boolean(search || webhookFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setWebhookFilter("ALL");
              setPage(1);
            }}
            filters={
              <div className="w-40">
                <AdminSelect
                  value={webhookFilter}
                  onChange={(e) => {
                    setWebhookFilter(e.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter webhook state"
                  options={[
                    { label: "All Webhooks", value: "ALL" },
                    { label: "Active", value: "ACTIVE" },
                    { label: "Inactive", value: "INACTIVE" },
                  ]}
                />
              </div>
            }
          />
        </div>
        <ResourceStatus
          state={repositories}
          isEmpty={(d) => d.length === 0}
          onRetry={onRetry}
          emptyIcon={GitBranch}
          emptyTitle="No repositories linked"
          emptyDescription="No GitHub repository has been linked to the platform yet."
        />
        {repositories.status === "ready" && repositories.data.length > 0 && (
          <>
            {pageData.rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--color-text-secondary)]">No repositories match your filters.</p>
            ) : (
              <RepositoryTable rows={pageData.rows} />
            )}
            <PaginationBar
              currentPage={pageData.page}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </>
        )}
      </SurfaceCard>
    </div>
  );
}

/* ------------------------------------------------------------------ Webhooks & Events */

export interface WebhooksViewProps {
  receipts: ResourceState<OpsWebhookReceipt[]>;
  outbox: ResourceState<OpsFailedOutboxEvent[]>;
  onRetryReceipts: () => void;
  onRetryOutboxList: () => void;
  onRetryEvent: (eventId: string) => void;
  busy: string | null;
  notice: MutationNoticeState | null;
  onReload: () => void;
  onDismissNotice: () => void;
}

export function WebhooksView(props: WebhooksViewProps) {
  const { receipts, outbox, busy } = props;
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const rows = useMemo(() => (receipts.status === "ready" ? receipts.data : []), [receipts]);
  const sources = useMemo(() => Array.from(new Set(rows.map((r) => r.source))).sort(), [rows]);
  const statuses = useMemo(() => Array.from(new Set(rows.map((r) => r.status))).sort(), [rows]);
  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          matchesSearch(search, r.id, r.webhook_id, r.event_type, r.source, r.error_message) &&
          (sourceFilter === "ALL" || r.source === sourceFilter) &&
          (statusFilter === "ALL" || r.status === statusFilter),
      ),
    [rows, search, sourceFilter, statusFilter],
  );
  const pageData = paginate(filtered, page, pageSize);
  const outboxRows = useMemo(() => (outbox.status === "ready" ? outbox.data : []), [outbox]);
  const outboxPage = usePagedRows(outboxRows);

  return (
    <div className="space-y-6">
      <PageHeader title="Webhooks & Events" description="Inbound webhook receipts and outbound platform events that ran out of delivery retries." />

      <MutationNotice notice={props.notice} onReload={props.onReload} onDismiss={props.onDismissNotice} />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <CountKpi state={receipts} count={(d) => d.length} label="Webhook Receipts" sublabel="Inbound events recorded" icon={Webhook} tone="blue" />
        <CountKpi state={receipts} count={(d) => d.filter((r) => r.status === "PROCESSED").length} label="Processed" sublabel="Handled by the platform" icon={CheckCircle2} tone="emerald" />
        <CountKpi state={receipts} count={(d) => d.filter((r) => r.status !== "PROCESSED").length} label="Not Processed" sublabel="Failed or still retrying" icon={AlertTriangle} tone="amber" />
        <CountKpi state={outbox} count={(d) => d.length} label="Failed Outbound Events" sublabel="Delivery retries exhausted" icon={Send} tone="rose" />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Failed outbound events</h3>
          <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
            Events whose delivery failed after every automatic retry. Retry re-queues the event for the dispatcher; payloads are never shown.
          </p>
        </div>
        <ResourceStatus
          state={outbox}
          isEmpty={(d) => d.length === 0}
          onRetry={props.onRetryOutboxList}
          emptyIcon={Send}
          emptyTitle="No failed outbound events"
          emptyDescription="Every outbound event has been delivered or is still within its automatic retries."
        />
        {outbox.status === "ready" && outbox.data.length > 0 && (
          <AdminTable label="Failed outbound events" headers={["Event", "Aggregate", "Attempts", "Last error", "Failed", ""]}>
            {outboxPage.pageRows.map((e) => (
              <tr key={e.event_id}>
                <td className={cellClass}>
                  <p className="font-semibold">{e.event_type}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">{e.event_id}</p>
                </td>
                <td className={mutedCellClass}>{e.aggregate_type}</td>
                <td className={mutedCellClass}>{e.attempts}</td>
                <td className={`${mutedCellClass} max-w-xs break-words`}>{e.last_error || "-"}</td>
                <td className={mutedCellClass}>{formatInstant(e.failed_at)}</td>
                <td className={cellClass}>
                  <AdminButton size="xs" variant="outline" disabled={Boolean(busy)} isLoading={busy === `outbox:${e.event_id}`} onClick={() => props.onRetryEvent(e.event_id)}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Retry delivery
                  </AdminButton>
                </td>
              </tr>
            ))}
          </AdminTable>
        )}
        {outboxRows.length > 0 && <PaginationBar {...outboxPage.barProps} />}
      </SurfaceCard>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[var(--color-border)] space-y-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Inbound webhook receipts</h3>
          <FilterBar
            search={search}
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            searchPlaceholder="Search event type, source, or error..."
            hasActiveFilters={Boolean(search || sourceFilter !== "ALL" || statusFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setSourceFilter("ALL");
              setStatusFilter("ALL");
              setPage(1);
            }}
            filters={
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-36">
                  <AdminSelect
                    value={sourceFilter}
                    onChange={(e) => {
                      setSourceFilter(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Filter event source"
                    options={[{ label: "All Sources", value: "ALL" }, ...sources.map((s) => ({ label: humanize(s), value: s }))]}
                  />
                </div>
                <div className="w-36">
                  <AdminSelect
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    aria-label="Filter delivery status"
                    options={[{ label: "All Statuses", value: "ALL" }, ...statuses.map((s) => ({ label: humanize(s), value: s }))]}
                  />
                </div>
              </div>
            }
          />
        </div>
        <ResourceStatus
          state={receipts}
          isEmpty={(d) => d.length === 0}
          onRetry={props.onRetryReceipts}
          emptyIcon={Webhook}
          emptyTitle="No webhook receipts"
          emptyDescription="No inbound webhook has been received yet."
        />
        {receipts.status === "ready" && receipts.data.length > 0 && (
          <>
            {pageData.rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-[var(--color-text-secondary)]">No receipts match your filters.</p>
            ) : (
              <AdminTable label="Inbound webhook receipts" headers={["Event", "Source", "Status", "Attempts", "Error", "Received", "Last retry"]}>
                {pageData.rows.map((r) => (
                  <tr key={r.id}>
                    <td className={cellClass}>
                      <p className="font-semibold">{r.event_type}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{r.webhook_id || r.id}</p>
                    </td>
                    <td className={mutedCellClass}>{humanize(r.source)}</td>
                    <td className={cellClass}>
                      <StatusBadge label={humanize(r.status)} tone={r.status === "PROCESSED" ? "success" : getStatusTone(r.status)} dot />
                    </td>
                    <td className={mutedCellClass}>{r.attempts}</td>
                    <td className={`${mutedCellClass} max-w-xs break-words`}>{r.error_message || "-"}</td>
                    <td className={mutedCellClass}>{formatInstant(r.received_at)}</td>
                    <td className={mutedCellClass}>{formatInstant(r.last_retry_at)}</td>
                  </tr>
                ))}
              </AdminTable>
            )}
            <PaginationBar
              currentPage={pageData.page}
              totalItems={filtered.length}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
            />
          </>
        )}
      </SurfaceCard>
    </div>
  );
}
