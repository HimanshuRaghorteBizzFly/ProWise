"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  GitBranch,
  PauseCircle,
  PlayCircle,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { GitHubInstallation } from "../_types";
import { useAdminPermissions, useSuperAdminStore } from "../_store/useSuperAdminStore";
import { exportRowsToCsv, formatDateTime } from "../_services/super-admin-service";
import {
  AdminButton,
  BulkSelectionBar,
  ConfirmActionModal,
  EmptyStateView,
  FilterBar,
  KpiCard,
  PageHeader,
  PaginationBar,
  StatusBadge,
  SurfaceCard,
  getOrgInitials,
  useTableSelection,
} from "../_components/SuperAdminPrimitives";

export default function SuperAdminGitHubIntegrationsPage() {
  const githubInstallations = useSuperAdminStore((s) => s.githubInstallations);
  const toggleGitHubSyncPause = useSuperAdminStore((s) => s.toggleGitHubSyncPause);
  const syncGitHubInstallations = useSuperAdminStore((s) => s.syncGitHubInstallations);

  const { can } = useAdminPermissions();
  const canManage = can("integrations.manage");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [syncing, setSyncing] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<GitHubInstallation | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return githubInstallations.filter((g) => {
      if (statusFilter !== "ALL" && g.syncStatus !== statusFilter) return false;
      if (q) {
        const hit =
          g.orgName.toLowerCase().includes(q) ||
          g.githubAccount.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [githubInstallations, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

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
    filtered.map((g) => g.id),
    paginated.map((g) => g.id)
  );

  const totalRepos = githubInstallations.reduce((s, g) => s + g.reposCount, 0);
  const healthyCount = githubInstallations.filter((g) => g.syncStatus === "Healthy").length;
  const attentionCount = githubInstallations.filter((g) => g.syncStatus === "Attention Needed").length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="GitHub Integration"
        description="Govern tenant GitHub App installations, connected repository counts, and organization sync authorization."
        simulationLabel="Simulated GitHub Oversight"
        actions={
          <AdminButton
            variant="primary"
            size="sm"
            isLoading={syncing}
            permissionLocked={!canManage}
            onClick={() => {
              setSyncing(true);
              setTimeout(() => {
                syncGitHubInstallations();
                setSyncing(false);
                toast.success("Refreshed GitHub App installation statuses");
              }, 350);
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Sync State
          </AdminButton>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard label="App Installations" value={githubInstallations.length} sublabel="Authorized tenant orgs" icon={GitBranch} tone="blue" />
        <KpiCard label="Connected Repositories" value={totalRepos} sublabel="Metadata & PR sync active" icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Healthy Sync" value={healthyCount} sublabel="Within API rate budget" icon={CheckCircle2} tone="emerald" />
        <KpiCard label="Attention Needed" value={attentionCount} sublabel="High usage or paused" icon={AlertTriangle} tone={attentionCount > 0 ? "amber" : "slate"} />
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="p-4 border-b border-[var(--color-border)]">
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search organization or GitHub account..."
            hasActiveFilters={Boolean(search || statusFilter !== "ALL")}
            onResetFilters={() => {
              setSearch("");
              setStatusFilter("ALL");
            }}
            onExportCsv={() => {
              if (!can("system.export")) {
                toast.error("Missing export permission");
                return;
              }
              exportRowsToCsv(
                "prowise-github-installations.csv",
                ["Organization", "GitHub Account", "Repositories", "Sync Status", "Hourly Quota Used", "Last Synced"],
                filtered.map((g) => [
                  g.orgName,
                  g.githubAccount,
                  g.reposCount,
                  g.syncStatus,
                  `${g.rateLimitUsed}/${g.rateLimitMax}`,
                  g.lastSyncedAt,
                ])
              );
              toast.success("Exported GitHub installations CSV");
            }}
            exportDisabled={!can("system.export") || filtered.length === 0}
            filters={
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter sync status"
                className="h-9 rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] px-2.5 text-xs text-[var(--color-text-primary)] [color-scheme:light] dark:[color-scheme:dark]"
              >
                <option value="ALL">All Statuses</option>
                <option value="Healthy">Healthy</option>
                <option value="Attention Needed">Attention Needed</option>
                <option value="Paused">Paused</option>
              </select>
            }
          />
        </div>

        <BulkSelectionBar
          selectedCount={selectedIds.length}
          totalFilteredCount={filtered.length}
          onSelectAllMatching={() => setSelectedIds(filtered.map((g) => g.id))}
          onClear={() => setSelectedIds([])}
          actions={
            <>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!canManage}
                onClick={() => {
                  let count = 0;
                  for (const id of selectedIds) {
                    const inst = githubInstallations.find((g) => g.id === id);
                    if (inst && inst.syncStatus !== "Paused") {
                      toggleGitHubSyncPause(id);
                      count++;
                    }
                  }
                  if (count === 0) toast.info("Selected installations are already paused.");
                  else {
                    toast.warning(`Paused sync for ${count} installation${count === 1 ? "" : "s"}`);
                    setSelectedIds([]);
                  }
                }}
              >
                <PauseCircle className="w-3.5 h-3.5" />
                Pause Selected
              </AdminButton>
              <AdminButton
                variant="subtle"
                size="xs"
                permissionLocked={!canManage}
                onClick={() => {
                  let count = 0;
                  for (const id of selectedIds) {
                    const inst = githubInstallations.find((g) => g.id === id);
                    if (inst && inst.syncStatus === "Paused") {
                      toggleGitHubSyncPause(id);
                      count++;
                    }
                  }
                  if (count === 0) toast.info("Selected installations are already active.");
                  else {
                    toast.success(`Resumed sync for ${count} installation${count === 1 ? "" : "s"}`);
                    setSelectedIds([]);
                  }
                }}
              >
                <PlayCircle className="w-3.5 h-3.5" />
                Resume Selected
              </AdminButton>
              <AdminButton
                variant="outline"
                size="xs"
                permissionLocked={!can("system.export")}
                onClick={() => {
                  const targets = githubInstallations.filter((g) => selectedSet.has(g.id));
                  exportRowsToCsv(
                    "prowise-github-installations-selected.csv",
                    ["Sr. No.", "Organization", "GitHub Account", "Repos", "Status", "Last Synced"],
                    targets.map((g, idx) => [
                      idx + 1,
                      g.orgName,
                      `@${g.githubAccount}`,
                      g.reposCount,
                      g.syncStatus,
                      g.lastSyncedAt,
                    ])
                  );
                  toast.success(`Exported ${targets.length} installation${targets.length === 1 ? "" : "s"}`);
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
            icon={GitBranch}
            title="No GitHub installations match"
            description="Adjust search or sync status filters."
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
                      aria-label="Select all installations on this page"
                      className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="px-4 py-3 w-16 whitespace-nowrap">Sr. No.</th>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">GitHub Account</th>
                  <th className="px-4 py-3">Repos</th>
                  <th className="px-4 py-3 hidden md:table-cell">Hourly API Quota</th>
                  <th className="px-4 py-3">Sync Status</th>
                  <th className="px-4 py-3 hidden lg:table-cell">Last Synced</th>
                  <th className="px-4 py-3 text-right">Governance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {paginated.map((inst, idx) => {
                  const pct = Math.min(100, Math.round((inst.rateLimitUsed / inst.rateLimitMax) * 100));
                  const serialNumber = (safePage - 1) * pageSize + idx + 1;
                  const isSelected = selectedSet.has(inst.id);
                  return (
                    <tr
                      key={inst.id}
                      className={`hover:bg-[var(--color-hover)] transition-colors ${
                        isSelected ? "bg-blue-500/5" : ""
                      }`}
                    >
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(inst.id)}
                          aria-label={`Select ${inst.orgName}`}
                          className="h-4 w-4 rounded border-[var(--color-border)] bg-[var(--color-app-bg)] text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-[var(--color-text-muted)] tabular-nums whitespace-nowrap">
                        {serialNumber}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full border border-violet-500/30 bg-violet-500/15 text-violet-700 dark:text-violet-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                            {getOrgInitials(inst.orgName)}
                          </div>
                          <div>
                            <div className="font-semibold text-[var(--color-text-primary)]">{inst.orgName}</div>
                            <div className="text-[11px] text-[var(--color-text-muted)]">{inst.accessScope}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                          @{inst.githubAccount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-text-primary)] font-semibold tabular-nums">
                        {inst.reposCount} repos
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell min-w-[140px]">
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="font-medium text-[var(--color-text-primary)]">{inst.rateLimitUsed.toLocaleString()}</span>
                          <span className="text-[var(--color-text-muted)]">/ {inst.rateLimitMax.toLocaleString()}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--color-elevated)] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${pct > 80 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={inst.syncStatus}
                          tone={
                            inst.syncStatus === "Healthy"
                              ? "success"
                              : inst.syncStatus === "Attention Needed"
                              ? "warning"
                              : "neutral"
                          }
                          dot
                        />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-[var(--color-text-muted)] whitespace-nowrap">
                        {formatDateTime(inst.lastSyncedAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <AdminButton
                          variant={inst.syncStatus === "Paused" ? "subtle" : "outline"}
                          size="xs"
                          permissionLocked={!canManage}
                          onClick={() => setToggleTarget(inst)}
                        >
                          {inst.syncStatus === "Paused" ? (
                            <>
                              <PlayCircle className="w-3.5 h-3.5" /> Resume
                            </>
                          ) : (
                            <>
                              <PauseCircle className="w-3.5 h-3.5" /> Pause
                            </>
                          )}
                        </AdminButton>
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

      <ConfirmActionModal
        isOpen={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        title={
          toggleTarget?.syncStatus === "Paused"
            ? `Resume GitHub sync for ${toggleTarget?.orgName}?`
            : `Pause GitHub sync for ${toggleTarget?.orgName}?`
        }
        description="Pausing stops automated commit and pull request updates for this organization until resumed."
        confirmLabel={toggleTarget?.syncStatus === "Paused" ? "Resume Sync" : "Pause Sync"}
        variant={toggleTarget?.syncStatus === "Paused" ? "primary" : "danger"}
        onConfirm={() => {
          if (!toggleTarget) return;
          toggleGitHubSyncPause(toggleTarget.id);
          toast.info(`Updated GitHub sync status for ${toggleTarget.orgName}`);
        }}
      />
    </div>
  );
}
