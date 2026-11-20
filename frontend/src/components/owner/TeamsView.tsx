"use client";

import React, { useState } from "react";
import Link from "next/link";
import { UsersRound } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { PageHeader, StatusBadge, SurfaceCard } from "@/components/owner/primitives";
import type { TeamRow } from "@/lib/fixtures/org-admin";
import type { PermissionKey } from "@/types/permission";

export interface TeamsViewProps {
  teams: TeamRow[];
  source: "api" | "fixture";
  can: (key: PermissionKey) => boolean;
  basePath?: string;
}

const MAX_NAMES = 4;

export function TeamsView({ teams, source, can, basePath }: TeamsViewProps) {
  const [showArchived, setShowArchived] = useState(false);
  const canManage = can("team.manage");
  const visible = teams.filter((team) => showArchived || !team.archived);
  const archivedCount = teams.filter((team) => team.archived).length;

  const header = (
    <PageHeader
      title="Teams"
      description="Teams group people for assignment and workload. A team lead manages only their own team's work."
      simulationLabel={source === "fixture" ? "Sample data" : undefined}
      actions={
        canManage ? (
          basePath ? (
            <Link
              href={`${basePath}/teams/new`}
              className="inline-flex min-h-9 items-center rounded-lg bg-[#1A73E8] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1557B0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Create team
            </Link>
          ) : <><LaterActionButton>Create team</LaterActionButton><OwnerLaterBadge task="1.2" /></>
        ) : undefined
      }
    />
  );

  if (!canManage) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState state="forbidden" requiredPermission="team.manage" description="Viewing and managing teams requires team.manage." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      {teams.length === 0 ? (
        <OwnerPageState state="empty" icon={UsersRound} title="No teams yet" description="Create a team to group members for assignment." />
      ) : (
        <>
          {archivedCount > 0 && (
            <label className="inline-flex items-center gap-2 text-sm text-app-text-secondary">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
                className="h-4 w-4 rounded border-app-border focus-visible:ring-2 focus-visible:ring-app-accent"
              />
              Show archived teams ({archivedCount})
            </label>
          )}
          {visible.length === 0 ? (
            <OwnerPageState state="empty" title="All teams are archived" description="Turn on archived teams to see them." />
          ) : (
            <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((team) => {
                const extra = team.memberNames.length - MAX_NAMES;
                return (
                  <li key={team.id} className="min-w-0">
                    <SurfaceCard className="flex h-full flex-col gap-3 p-4 transition-shadow hover:shadow-floating motion-reduce:transition-none">
                      <div className="flex items-start justify-between gap-2">
                        {basePath ? <Link href={`${basePath}/teams/${team.id}`} className="min-w-0 truncate rounded-sm text-sm font-semibold text-app-text-primary hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:hover:text-blue-300">{team.name}</Link> : <h2 className="min-w-0 truncate text-sm font-semibold text-app-text-primary">{team.name}</h2>}
                        {team.archived && <StatusBadge label="Archived" tone="neutral" />}
                      </div>
                      {team.description && <p className="text-caption text-app-text-secondary">{team.description}</p>}
                      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-caption">
                        <dt className="text-app-text-muted">Lead</dt>
                        <dd className="truncate text-app-text-primary">{team.leadName}</dd>
                        <dt className="text-app-text-muted">Members</dt>
                        <dd className="text-app-text-primary">
                          {team.memberNames.length} member{team.memberNames.length === 1 ? "" : "s"}
                        </dd>
                      </dl>
                      <p className="text-caption text-app-text-secondary">
                        {team.memberNames.slice(0, MAX_NAMES).join(", ")}
                        {extra > 0 ? ` and ${extra} more` : ""}
                      </p>
                      <div className="mt-auto flex flex-wrap gap-2 pt-1">
                        {basePath ? <Link href={`${basePath}/teams/${team.id}/edit`} className="inline-flex min-h-8 items-center rounded-lg border border-app-border px-3 text-xs font-medium text-app-text-secondary hover:bg-app-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent">Edit team</Link> : <LaterActionButton>Edit</LaterActionButton>}
                        {!team.archived && <LaterActionButton>Archive</LaterActionButton>}
                      </div>
                    </SurfaceCard>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
