"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  GitBranch,
  LayoutGrid,
  List,
  PauseCircle,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import type { OpsGitHubRepository, OpsIntegration } from "@/types/operator-console";
import { useOperatorPermissions } from "../_services/operator-access";
import { operatorApi } from "../_services/operator-api";
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

type GitHubSortField = "orgName" | "reposCount" | "rateLimitUsed" | "syncState" | "lastSyncedAt";

const SYNC_REASON = "there is no sync endpoint for GitHub installations";
const PAUSE_REASON = "there is no pause or resume endpoint for GitHub sync";

/**
 * One GitHub App installation as the page shows it, built from the real linked repositories
 * (GET /v1/operator/github/repositories) grouped by installation, named from GET /v1/operator/integrations when the
 * installation id matches. Sync state and API quota are not reported by the server.
 */
interface InstallationRow {
  id: string;
  orgName: string;
  githubAccount: string;
  reposCount: number;
  repoNames: string[];
  inactiveWebhooks: number;
  webhookHealth: string;
  syncState: string;
  lastSyncedAt: string;
}

function buildRows(repos: OpsGitHubRepository[], integrations: OpsIntegration[]): InstallationRow[] {
  const groups = new Map<string, OpsGitHubRepository[]>();
  for (const repo of repos) {
    const key = repo.installation_id ?? "unlinked";
    groups.set(key, [...(groups.get(key) ?? []), repo]);
  }
  return Array.from(groups.entries()).map(([installationId, list]) => {
    const integration = integrations.find((i) => i.id === installationId);
    const owners = Array.from(new Set(list.map((r) => r.repo_full_name.split("/")[0]).filter(Boolean)));
    const inactive = list.filter((r) => !r.webhook_active).length;
    const lastEvent = list
      .map((r) => r.last_event_at)
      .filter((v): v is string => Boolean(v))
      .sort()
      .pop();
    return {
      id: installationId,
      orgName: integration?.name ?? (installationId === "unlinked" ? "Not linked to an installation" : installationId),
      githubAccount: owners.join(", ") || "—",
      reposCount: list.length,
      repoNames: list.map((r) => `${r.repo_full_name}${r.default_branch ? ` (${r.default_branch})` : ""}`),
      inactiveWebhooks: inactive,
      webhookHealth: inactive === 0 ? "Active" : `${inactive} Inactive`,
      syncState: integration ? humanizeCode(integration.health) : "",
      lastSyncedAt: lastEvent ?? "",
    };
  });
}

export default function OperatorGitHubMonitoringPage() {
  const repos = useOperatorResource(() => operatorApi.githubRepositories(), "github-repositories");
  const integrations = useOperatorResource(() => operatorApi.integrations(), "integrations");
  const githubApps = useMemo(
    () => buildRows(rowsOf(repos.state), rowsOf(integrations.state)),
    [repos.state, integrations.state]
  );
  const { can } = useOperatorPermissions();
  const canManage = can("integrations.manage");

  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [sortField, setSortField] = useState<GitHubSortField>("syncState");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  // Pause / Resume has no endpoint: the confirmation stays in place but nothing opens it yet.
  const [pauseTarget, setPauseTarget] = useState<InstallationRow | null>(null);

  const attentionCount = useMemo(
    () => githubApps.filter((g) => g.inactiveWebhooks > 0).length,
    [githubApps]
  );
  const totalRepos = useMemo(
    () => githubApps.reduce((sum, g) => sum + g.reposCount, 0),
    [githubApps]
  );

  const handleSort = (field: GitHubSortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "reposCount" || field === "rateLimitUsed" ? "desc" : "asc");
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = githubApps.filter((g) => {
      const matchesQ =
        !q ||
        g.orgName.toLowerCase().includes(q) ||
        g.githubAccount.toLowerCase().includes(q) ||
        g.repoNames.some((r) => r.toLowerCase().includes(q));
      const matchesState =
        stateFilter === "ALL" ||
        (stateFilter === "ACTIVE" && g.inactiveWebhooks === 0) ||
        (stateFilter === "INACTIVE" && g.inactiveWebhooks > 0);
      return matchesQ && matchesState;
    });
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "orgName") cmp = a.orgName.localeCompare(b.orgName);
      else if (sortField === "reposCount") cmp = a.reposCount - b.reposCount;
      else if (sortField === "rateLimitUsed") cmp = 0;
      else if (sortField === "lastSyncedAt") cmp = new Date(a.lastSyncedAt || 0).getTime() - new Date(b.lastSyncedAt || 0).getTime();
      else cmp = b.inactiveWebhooks - a.inactiveWebhooks;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [githubApps, search, stateFilter, sortField, sortDir]);

  useEffect(() => {
    setPage(1);
  }, [search, stateFilter, pageSize]);

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
    filtered.map((g) => g.id),
    paginated.map((g) => g.id)
  );

  const reloadAll = () => {
    void repos.reload();
    void integrations.reload();
  };

  const syncStateBadge = (item: InstallationRow) =>
    item.syncState ? (
      <StatusBadge label={item.syncState} tone={getStatusTone(item.syncState)} dot />
    ) : (
      <NotAvailableText reason="the server does not report a sync state for this installation" />
    );

  return (
    <div className="space-y-6">
      <PageHeader
        title="GitHub App Monitoring"
        badge={`${repos.state.status === "ready" ? githubApps.length : "-"} Installations`}
        liveData
        description="Monitor organization repository sync health, API quota usage, and run catch-up synchronization when delays occur."
        actions={
          <OpButton variant="outline" size="sm" onClick={reloadAll}>
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </OpButton>
        }
      />

      <DemoDataBanner
        title="Simulated Repository Sync"
        description="Shows connection status and quota headroom without exposing installation access tokens. Triggering Sync Now clears simulated backlog delays."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Synced Installations"
          value="—"
          sublabel="Not available yet"
          icon={CheckCircle2}
          tone="slate"
        />
        <KpiCard
          label="Connected Repositories"
          value={readyValue(repos.state, () => totalRepos)}
          sublabel="Tracked across customer organizations"
          icon={GitBranch}
          tone="teal"
        />
        <KpiCard
          label="Attention Needed"
          value={readyValue(repos.state, () => attentionCount)}
          sublabel="Installations with an inactive repository webhook"
          icon={AlertCircle}
          tone={attentionCount > 0 ? "amber" : "emerald"}
        />
      </div>

      <SurfaceCard className="p-4 sm:p-5 space-y-4">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search organization or GitHub account..."
          hasActiveFilters={Boolean(search || stateFilter !== "ALL")}
          onResetFilters={() => {
            setSearch("");
            setStateFilter("ALL");
          }}
          filters={
            <div className="w-44">
              <OpSelect
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                aria-label="Filter sync state"
                options={[
                  { label: "All States", value: "ALL" },
                  { label: "Webhooks Active", value: "ACTIVE" },
                  { label: "Webhook Inactive", value: "INACTIVE" },
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

        {repos.state.status !== "ready" || repos.state.data.length === 0 ? (
          <OperatorResourceStatus
            state={repos.state}
            isEmpty={(d) => d.length === 0}
            onRetry={() => void repos.reload()}
            emptyIcon={GitBranch}
            emptyTitle="No GitHub installations found"
            emptyDescription="No repositories are linked to platform sync yet."
          />
        ) : paginated.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No GitHub installations found"
            description="Adjust your search or sync state filter."
          />
        ) : viewMode === "TABLE" ? (
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            <BulkSelectionBar
              selectedCount={selectedIds.length}
              totalFilteredCount={filtered.length}
              onSelectAllMatching={() => setSelectedIds(filtered.map((g) => g.id))}
              onClear={() => setSelectedIds([])}
              actions={
                <NotAvailableButton variant="primary" size="xs" reason={SYNC_REASON} hideLabel>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync Selected ({selectedIds.length})
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
                        aria-label="Select all GitHub installations on this page"
                        className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-2.5 px-3.5 w-16">Sr. No.</th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Organization & Account" active={sortField === "orgName"} direction={sortDir} onSort={() => handleSort("orgName")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Repos" active={sortField === "reposCount"} direction={sortDir} onSort={() => handleSort("reposCount")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="API Quota" active={sortField === "rateLimitUsed"} direction={sortDir} onSort={() => handleSort("rateLimitUsed")} />
                    </th>
                    <th className="py-2.5 px-3.5">
                      <SortableHeader label="Sync State" active={sortField === "syncState"} direction={sortDir} onSort={() => handleSort("syncState")} />
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
                            aria-label={`Select ${item.orgName}`}
                            className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] accent-teal-600 cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3.5 font-medium text-[var(--color-text-muted)] tabular-nums">
                          {srNo}
                        </td>
                        <td className="py-3 px-3.5">
                          <div className="flex items-start gap-2.5">
                            <span className="h-7 w-7 rounded-lg bg-teal-500/15 text-[10px] font-bold text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                              {getOrgInitials(item.orgName)}
                            </span>
                            <div>
                              <p className="font-semibold text-[var(--color-text-primary)]">{item.orgName}</p>
                              <p className="text-[11px] text-[var(--color-text-muted)]">
                                @{item.githubAccount} · {formatDateTime(item.lastSyncedAt)}
                              </p>
                              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                                {item.repoNames.join(", ")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 font-semibold tabular-nums">{item.reposCount}</td>
                        <td className="py-3 px-3.5 min-w-[160px]">
                          <NotAvailableText reason="the server does not report GitHub API rate-limit usage" />
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="space-y-1">
                            {syncStateBadge(item)}
                            <div>
                              <StatusBadge
                                label={`Webhook: ${item.webhookHealth}`}
                                tone={item.inactiveWebhooks === 0 ? "success" : "warning"}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <NotAvailableButton variant="primary" size="xs" reason={SYNC_REASON} hideLabel>
                              <RefreshCw className="w-3.5 h-3.5" />
                              Sync Now
                            </NotAvailableButton>
                            <NotAvailableButton variant="outline" size="xs" reason={PAUSE_REASON} hideLabel>
                              {item.syncState === "Paused" ? "Resume" : "Pause"}
                            </NotAvailableButton>
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
            {paginated.map((item, idx) => {
              const srNo = (safePage - 1) * pageSize + idx + 1;
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-[var(--color-border)] bg-[var(--color-app-bg)] p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-text-muted)] tabular-nums">
                        #{srNo}
                      </span>
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{item.orgName}</span>
                      {syncStateBadge(item)}
                      <StatusBadge
                        label={`Webhook: ${item.webhookHealth}`}
                        tone={item.inactiveWebhooks === 0 ? "success" : "warning"}
                      />
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      GitHub Account: <strong>@{item.githubAccount}</strong> · {item.reposCount} repositories · Last synced {formatDateTime(item.lastSyncedAt)}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{item.repoNames.join(", ")}</p>
                    <div className="max-w-sm pt-1">
                      <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mb-1">
                        <span>Hourly API Usage</span>
                        <NotAvailableText reason="the server does not report GitHub API rate-limit usage" />
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden" />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <NotAvailableButton variant="primary" size="xs" reason={SYNC_REASON}>
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sync Now
                    </NotAvailableButton>
                    <NotAvailableButton variant="outline" size="xs" reason={PAUSE_REASON}>
                      {item.syncState === "Paused" ? (
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
        {!canManage && <span className="sr-only">Your role cannot manage GitHub sync.</span>}
      </SurfaceCard>

      <ConfirmModal
        isOpen={Boolean(pauseTarget)}
        onClose={() => setPauseTarget(null)}
        title={
          pauseTarget?.syncState === "Paused"
            ? `Resume GitHub Sync for ${pauseTarget.orgName}?`
            : `Pause GitHub Sync for ${pauseTarget?.orgName}?`
        }
        description={
          pauseTarget?.syncState === "Paused"
            ? "Resuming restarts automatic repository pull-request and commit synchronization."
            : "Pausing holds repository event ingestion for this workspace until you resume it."
        }
        confirmLabel={pauseTarget?.syncState === "Paused" ? "Resume Sync" : "Pause Sync"}
        variant={pauseTarget?.syncState === "Paused" ? "primary" : "danger"}
        onConfirm={() => {
          // No pause/resume endpoint exists; nothing is changed locally either.
          setPauseTarget(null);
        }}
      />
    </div>
  );
}
