import React from "react";
import Link from "next/link";
import { GitBranch, Unplug } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { PageHeader, StatusBadge, SurfaceCard, type StatusTone } from "@/components/owner/primitives";
import type { OrgNavFamily } from "@/components/owner/org-nav";
import { formatUtcDate } from "@/components/owner/project-format";
import type { RepositoryRow } from "@/lib/fixtures/org-admin";
import type { PermissionKey } from "@/types/permission";

export interface IntegrationsViewProps {
  family: OrgNavFamily;
  repositories: RepositoryRow[];
  source: "api" | "fixture";
  can: (key: PermissionKey) => boolean;
  basePath?: string;
}

const SYNC: Record<RepositoryRow["syncStatus"], { label: string; tone: StatusTone }> = {
  SYNCED: { label: "Synced", tone: "success" },
  SYNCING: { label: "Syncing", tone: "info" },
  FAILED: { label: "Failed", tone: "danger" },
  DISCONNECTED: { label: "Disconnected", tone: "neutral" },
};

export function IntegrationsView({ family, repositories, source, can, basePath }: IntegrationsViewProps) {
  const canConnect = can("repo.connect");
  // The owner approves integrations (blueprint section 3); there is no separate key, so org.manage gates it.
  const canApprove = family === "owner" && can("org.manage");

  const header = (
    <PageHeader
      title="Integrations (GitHub)"
      description="Selected GitHub repositories linked to this organization. Repository activity is evidence only and never sets completion."
      simulationLabel={source === "fixture" ? "Sample data" : undefined}
      actions={
        canConnect || canApprove ? (
          <>
            {canConnect && (basePath ? (
              <Link href={`${basePath}/integrations/connect`} className="inline-flex min-h-9 items-center rounded-lg border border-app-border px-3 text-xs font-medium text-app-text-secondary hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent">Connect repositories</Link>
            ) : <LaterActionButton>Connect repositories</LaterActionButton>)}
            {canApprove && <LaterActionButton>Approve integration</LaterActionButton>}
            <OwnerLaterBadge task="4.1" />
          </>
        ) : undefined
      }
    />
  );

  if (!can("repo.read")) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState state="forbidden" requiredPermission="repo.read" description="Viewing repositories requires repo.read." />
      </div>
    );
  }

  if (repositories.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState
          state="empty"
          icon={Unplug}
          title="GitHub disconnected"
          description="No GitHub installation is linked to this organization yet."
        />
      </div>
    );
  }

  const failing = repositories.filter((repository) => repository.syncStatus === "FAILED" || repository.syncStatus === "DISCONNECTED");

  return (
    <div className="space-y-4">
      {header}
      {failing.length > 0 && (
        <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          {failing.length} repositor{failing.length === 1 ? "y needs" : "ies need"} attention. Event replay and reconciliation arrive with task 4.2.
        </p>
      )}
      <OwnerPanel title="Linked repositories" description={`${repositories.length} repositories`}>
        <ul className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {repositories.map((repository) => (
            <li key={repository.id} className="min-w-0">
              <SurfaceCard className="flex h-full flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-app-text-primary">
                    <GitBranch aria-hidden="true" className="h-4 w-4 shrink-0 text-app-text-muted" />
                    {basePath ? <Link href={`${basePath}/integrations/${repository.id}`} className="break-all rounded-sm hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:hover:text-blue-300">{repository.fullName}</Link> : <span className="break-all">{repository.fullName}</span>}
                  </p>
                  <StatusBadge label={SYNC[repository.syncStatus].label} tone={SYNC[repository.syncStatus].tone} dot />
                </div>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-caption">
                  <dt className="text-app-text-muted">Default branch</dt>
                  <dd className="text-app-text-primary">{repository.defaultBranch}</dd>
                  <dt className="text-app-text-muted">Last sync</dt>
                  <dd className="text-app-text-primary">{repository.lastSuccessfulSync ? `${formatUtcDate(repository.lastSuccessfulSync)} (UTC)` : "Never"}</dd>
                  <dt className="text-app-text-muted">Projects</dt>
                  <dd className="text-app-text-primary">{repository.linkedProjectKeys.join(", ") || "Not linked"}</dd>
                </dl>
                {repository.lastFailureReason && <p className="text-caption text-rose-700 dark:text-rose-300">{repository.lastFailureReason}</p>}
              </SurfaceCard>
            </li>
          ))}
        </ul>
      </OwnerPanel>
    </div>
  );
}
