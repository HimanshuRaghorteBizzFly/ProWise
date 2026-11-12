"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { useOperatorPermissions, usePlatformOperatorStore } from "../_store/usePlatformOperatorStore";
import { GitHubAppInstallation } from "../_types";
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

type GitHubSortField = "orgName" | "reposCount" | "rateLimitUsed" | "syncState" | "lastSyncedAt";

export default function OperatorGitHubMonitoringPage() {
  const githubApps = usePlatformOperatorStore((s) => s.githubApps);
  const syncGitHubInstallation = usePlatformOperatorStore((s) => s.syncGitHubInstallation);
  const toggleGitHubPause = usePlatformOperatorStore((s) => s.toggleGitHubPause);
  const { can } = useOperatorPermissions();
  const canManage = can("integrations.manage");

  const [viewMode, setViewMode] = useState<"TABLE" | "CARDS">("TABLE");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("ALL");
  const [sortField, setSortField] = useState<GitHubSortField>("syncState");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [pauseTarget, setPauseTarget] = useState<GitHubAppInstallation | null>(null);

  const syncedCount = useMemo(
    () => githubApps.filter((g) => g.syncState === "Synced").length,
    [githubApps]
  );
  const attentionCount = useMemo(
    () => githubApps.filter((g) => g.syncState !== "Synced").length,
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
        g.githubAccount.toLowerCase().includes(q);
      const matchesState = stateFilter === "ALL" || g.syncState === stateFilter;
      return matchesQ && matchesState;
    });
    const stateRank: Record<string, number> = { "Attention Needed": 0, Delayed: 1, Paused: 2, Synced: 3 };
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "orgName") cmp = a.orgName.localeCompare(b.orgName);
      else if (sortField === "reposCount") cmp = a.reposCount - b.reposCount;
      else if (sortField === "rateLimitUsed") cmp = a.rateLimitUsed - b.rateLimitUsed;
      else if (sortField === "lastSyncedAt") cmp = new Date(a.lastSyncedAt).getTime() - new Date(b.lastSyncedAt).getTime();
      else cmp = (stateRank[a.syncState] ?? 9) - (stateRank[b.syncState] ?? 9);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="GitHub App Monitoring"
        badge={`${githubApps.length} Installations`}
        demoLabel="Demo Sync Status"
        description="Monitor organization repository sync health, API quota usage, and run catch-up synchronization when delays occur."
      />

      <DemoDataBanner
        title="Simulated Repository Sync"
        description="Shows connection status and quota headroom without exposing installation access tokens. Triggering Sync Now clears simulated backlog delays."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          label="Synced Installations"
          value={`${syncedCount} / ${githubApps.length}`}
          sublabel="Up-to-date commit and PR ingestion"
          icon={CheckCircle2}
          tone={syncedCount === githubApps.length ? "emerald" : "amber"}
        />
        <KpiCard
          label="Connected Repositories"
          value={totalRepos}
          sublabel="Tracked across customer organizations"
          icon={GitBranch}
          tone="teal"
        />
        <KpiCard
          label="Attention Needed"
          value={attentionCount}
          sublabel="Delayed, paused, or retrying webhooks"
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
                  { label: "Synced", value: "Synced" },
                  { label: "Delayed", value: "Delayed" },
                  { label: "Attention Needed", value: "Attention Needed" },
                  { label: "Paused", value: "Paused" },
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
                <OpButton
                  variant="primary"
                  size="xs"
                  disabled={!canManage}
                  onClick={() => {
                    selectedIds.forEach((id) => syncGitHubInstallation(id));
                    toast.success(`Triggered catch-up sync for ${selectedIds.length} installation(s).`);
                    setSelectedIds([]);
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Sync Selected ({selectedIds.length})
                </OpButton>
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
                    const quotaPct = Math.min(100, Math.round((item.rateLimitUsed / item.rateLimitMax) * 100));
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
                              {item.lastErrorSummary && (
                                <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                                  {item.lastErrorSummary}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 font-semibold tabular-nums">{item.reposCount}</td>
                        <td className="py-3 px-3.5 min-w-[160px]">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-[var(--color-text-muted)]">
                              <span>{item.rateLimitUsed.toLocaleString()}</span>
                              <span>{quotaPct}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                              <div
                                className={`h-full rounded-full ${quotaPct > 80 ? "bg-amber-500" : "bg-teal-500"}`}
                                style={{ width: `${quotaPct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <div className="space-y-1">
                            <StatusBadge label={item.syncState} tone={getStatusTone(item.syncState)} dot />
                            <div>
                              <StatusBadge label={`Webhook: ${item.webhookHealth}`} tone={getStatusTone(item.webhookHealth)} />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3.5 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <OpButton
                              variant="primary"
                              size="xs"
                              disabled={!canManage}
                              onClick={() => {
                                syncGitHubInstallation(item.id);
                                toast.success(`Completed catch-up sync for ${item.orgName} (simulated).`);
                              }}
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Sync Now
                            </OpButton>
                            <OpButton
                              variant="outline"
                              size="xs"
                              disabled={!canManage}
                              onClick={() => setPauseTarget(item)}
                            >
                              {item.syncState === "Paused" ? "Resume" : "Pause"}
                            </OpButton>
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
              const quotaPct = Math.min(100, Math.round((item.rateLimitUsed / item.rateLimitMax) * 100));
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
                      <StatusBadge label={item.syncState} tone={getStatusTone(item.syncState)} dot />
                      <StatusBadge label={`Webhook: ${item.webhookHealth}`} tone={getStatusTone(item.webhookHealth)} />
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      GitHub Account: <strong>@{item.githubAccount}</strong> · {item.reposCount} repositories · Last synced {formatDateTime(item.lastSyncedAt)}
                    </p>
                    {item.lastErrorSummary && (
                      <p className="text-xs text-amber-700 dark:text-amber-300">{item.lastErrorSummary}</p>
                    )}
                    <div className="max-w-sm pt-1">
                      <div className="flex justify-between text-[11px] text-[var(--color-text-muted)] mb-1">
                        <span>Hourly API Usage</span>
                        <span>
                          {item.rateLimitUsed.toLocaleString()} / {item.rateLimitMax.toLocaleString()} ({quotaPct}%)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                        <div className="h-full rounded-full bg-teal-500" style={{ width: `${quotaPct}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <OpButton
                      variant="primary"
                      size="xs"
                      disabled={!canManage}
                      onClick={() => {
                        syncGitHubInstallation(item.id);
                        toast.success(`Completed catch-up sync for ${item.orgName} (simulated).`);
                      }}
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Sync Now
                    </OpButton>
                    <OpButton
                      variant="outline"
                      size="xs"
                      disabled={!canManage}
                      onClick={() => setPauseTarget(item)}
                    >
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
                    </OpButton>
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
          if (pauseTarget) {
            toggleGitHubPause(pauseTarget.id);
            toast.success(
              `${pauseTarget.orgName} GitHub sync ${pauseTarget.syncState === "Paused" ? "resumed" : "paused"}.`
            );
          }
        }}
      />
    </div>
  );
}
