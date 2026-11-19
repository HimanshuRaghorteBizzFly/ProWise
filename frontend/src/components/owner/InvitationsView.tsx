"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { MailPlus } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { FilterBar, PageHeader, StatusBadge, type StatusTone } from "@/components/owner/primitives";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvitationRow } from "@/lib/fixtures/org-admin";
import type { PermissionKey } from "@/types/permission";

export interface InvitationsViewProps {
  invitations: InvitationRow[];
  source: "api" | "fixture";
  can: (key: PermissionKey) => boolean;
  basePath?: string;
  /** Injected for tests; defaults to the current time. */
  now?: string;
}

type EffectiveStatus = InvitationRow["status"];

const TONES: Record<EffectiveStatus, StatusTone> = {
  PENDING: "info",
  ACCEPTED: "success",
  EXPIRED: "neutral",
  REVOKED: "warning",
};

const label = (status: string) => status.charAt(0) + status.slice(1).toLowerCase();

function effectiveStatus(invitation: InvitationRow, nowMs: number): EffectiveStatus {
  return invitation.status === "PENDING" && Date.parse(invitation.expiresAt) <= nowMs ? "EXPIRED" : invitation.status;
}

function expiryText(invitation: InvitationRow, status: EffectiveStatus, nowMs: number): string {
  const date = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(invitation.expiresAt),
  );
  if (status !== "PENDING") return status === "EXPIRED" ? `Expired ${date}` : "—";
  const days = Math.ceil((Date.parse(invitation.expiresAt) - nowMs) / 86_400_000);
  return days <= 1 ? `Expires within a day (${date} UTC)` : `Expires in ${days} days`;
}

export function InvitationsView({ invitations, source, can, basePath, now }: InvitationsViewProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | EffectiveStatus>("ALL");
  const nowMs = Date.parse(now ?? new Date().toISOString());

  const rows = useMemo(
    () => invitations.map((invitation) => ({ invitation, status: effectiveStatus(invitation, nowMs) })),
    [invitations, nowMs],
  );
  const visible = rows.filter(
    (row) =>
      (status === "ALL" || row.status === status) &&
      (!search.trim() || row.invitation.email.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const canInvite = can("member.invite");

  const header = (
    <PageHeader
      title="Invitations"
      description="Single-use invitations by email. Resending rotates the invitation link and revoking takes effect immediately once available."
      simulationLabel={source === "fixture" ? "Sample data" : undefined}
      actions={
        canInvite ? (
          basePath ? (
            <Link
              href={`${basePath}/invitations/new`}
              className="inline-flex min-h-9 items-center rounded-lg bg-[#1A73E8] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1557B0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              Invite member
            </Link>
          ) : <><LaterActionButton>Invite member</LaterActionButton><OwnerLaterBadge task="1.2" /></>
        ) : undefined
      }
    />
  );

  if (!canInvite) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState state="forbidden" requiredPermission="member.invite" description="Managing invitations requires member.invite." />
      </div>
    );
  }

  const actionsFor = (rowStatus: EffectiveStatus) =>
    rowStatus === "PENDING" || rowStatus === "EXPIRED" ? (
      <span className="flex flex-wrap gap-2">
        <LaterActionButton title="Rotates the link; available when task 1.2 ships">Resend</LaterActionButton>
        {rowStatus === "PENDING" && <LaterActionButton title="Available when task 1.2 ships">Revoke</LaterActionButton>}
      </span>
    ) : null;

  return (
    <div className="space-y-4">
      {header}
      {invitations.length === 0 ? (
        <OwnerPageState state="empty" icon={MailPlus} title="No invitations yet" description="Invitations you send will appear here with their expiry." />
      ) : (
        <OwnerPanel title="Sent invitations" description={`${visible.length} of ${invitations.length} invitations`}>
          <div className="space-y-3">
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search invitations by email"
              hasActiveFilters={search !== "" || status !== "ALL"}
              onResetFilters={() => {
                setSearch("");
                setStatus("ALL");
              }}
              filters={
                <label className="flex items-center gap-2 text-xs text-app-text-secondary">
                  <span>Status</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as typeof status)}
                    className="h-9 rounded-lg border border-app-border bg-app-bg px-2 text-xs text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent sm:text-sm"
                  >
                    <option value="ALL">All</option>
                    {(Object.keys(TONES) as EffectiveStatus[]).map((value) => (
                      <option key={value} value={value}>
                        {label(value)}
                      </option>
                    ))}
                  </select>
                </label>
              }
            />
            {visible.length === 0 ? (
              <OwnerPageState state="empty" title="No invitations match your filters" description="Change the search or status filter." />
            ) : (
              <>
                <ul className="space-y-2 md:hidden">
                  {visible.map(({ invitation, status: rowStatus }) => (
                    <li key={invitation.id} className="rounded-lg border border-app-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {basePath ? <Link href={`${basePath}/invitations/${invitation.id}`} className="block break-all rounded-sm text-sm font-semibold text-app-text-primary hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:hover:text-blue-300">{invitation.email}</Link> : <p className="break-all text-sm font-semibold text-app-text-primary">{invitation.email}</p>}
                          <p className="text-caption text-app-text-secondary">
                            {invitation.roleLabel}
                            {invitation.teamName ? ` · ${invitation.teamName}` : ""}
                          </p>
                          <p className="mt-1 text-caption text-app-text-muted">{expiryText(invitation, rowStatus, nowMs)}</p>
                        </div>
                        <StatusBadge label={label(rowStatus)} tone={TONES[rowStatus]} />
                      </div>
                      {actionsFor(rowStatus) && <div className="mt-2">{actionsFor(rowStatus)}</div>}
                    </li>
                  ))}
                </ul>
                <div className="hidden md:block">
                  <OwnerTable label="Invitations">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Role template</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Invited by</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map(({ invitation, status: rowStatus }) => (
                        <TableRow key={invitation.id}>
                          <TableCell className="break-all font-medium text-app-text-primary">{basePath ? <Link href={`${basePath}/invitations/${invitation.id}`} className="rounded-sm hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:hover:text-blue-300">{invitation.email}</Link> : invitation.email}</TableCell>
                          <TableCell>{invitation.roleLabel}</TableCell>
                          <TableCell>{invitation.teamName ?? "No team"}</TableCell>
                          <TableCell>{invitation.invitedByName}</TableCell>
                          <TableCell>{expiryText(invitation, rowStatus, nowMs)}</TableCell>
                          <TableCell>
                            <StatusBadge label={label(rowStatus)} tone={TONES[rowStatus]} />
                          </TableCell>
                          <TableCell>{actionsFor(rowStatus) ?? <span className="text-app-text-muted">—</span>}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </OwnerTable>
                </div>
              </>
            )}
          </div>
        </OwnerPanel>
      )}
    </div>
  );
}
