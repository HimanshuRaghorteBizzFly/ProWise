"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Mail, UserX, UsersRound } from "lucide-react";

import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { FilterBar, PageHeader, StatusBadge, type StatusTone } from "@/components/owner/primitives";
import type { OrgNavFamily } from "@/components/owner/org-nav";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { OrgMember } from "@/lib/fixtures/org-admin";
import type { PermissionKey } from "@/types/permission";

export interface MembersViewProps {
  family: OrgNavFamily;
  orgId: string;
  members: OrgMember[];
  source: "api" | "fixture";
  can: (key: PermissionKey) => boolean;
  isCurrentOwner: boolean;
}

const STATUS_TONES: Record<string, StatusTone> = {
  ACTIVE: "success",
  INVITED: "info",
  PENDING: "info",
  SUSPENDED: "warning",
  DISABLED: "neutral",
  REMOVED: "neutral",
};

const statusLabel = (status: string) => status.charAt(0) + status.slice(1).toLowerCase();


export function MembersView({ family, orgId, members, source, can, isCurrentOwner }: MembersViewProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const statuses = useMemo(() => Array.from(new Set(members.map((member) => member.status))).sort(), [members]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter(
      (member) =>
        (status === "ALL" || member.status === status) &&
        (!query || member.displayName.toLowerCase().includes(query) || member.email.toLowerCase().includes(query)),
    );
  }, [members, search, status]);

  const canInvite = can("member.invite");
  const canDisable = can("member.disable");
  const canTransfer = family === "owner" && isCurrentOwner && can("org.manage");
  const showRole = members.some((member) => member.roleLabel);

  const header = (
    <PageHeader
      title="Members"
      description="People with a membership in this organization. Changes are not available yet; the list is read-only."
      simulationLabel={source === "fixture" ? "Sample data" : undefined}
      actions={
        canInvite ? (
          family === "owner" ? (
            <Link
              href={`/org/${orgId}/${family}/invitations/new`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#1A73E8] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1557B0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
            >
              <Mail aria-hidden="true" className="h-3.5 w-3.5" />
              Invite member
            </Link>
          ) : (
            <LaterActionButton>Invite member</LaterActionButton>
          )
        ) : undefined
      }
    />
  );

  if (!can("role.manage")) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState
          state="forbidden"
          requiredPermission="role.manage"
          description="The member list is only returned to memberships holding role.manage."
        />
      </div>
    );
  }

  const memberName = (member: OrgMember) => family === "owner" ? (
    <Link href={`/org/${orgId}/${family}/members/${member.id}`} className="rounded-sm hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:hover:text-blue-300">
      {member.displayName}
    </Link>
  ) : member.displayName;

  const rowActions = canDisable ? (
    <span className="flex items-center gap-2">
      <LaterActionButton title="Available when task 1.2 ships">
        Disable
      </LaterActionButton>
    </span>
  ) : null;

  return (
    <div className="space-y-4">
      {header}

      {members.length === 0 ? (
        <OwnerPageState
          state="empty"
          icon={UsersRound}
          title="No members yet"
          description="Members appear here once invitations are accepted."
        />
      ) : (
        <OwnerPanel
          title="Directory"
          description={`${visible.length} of ${members.length} members`}
          actions={canDisable ? <OwnerLaterBadge task="1.2" icon={<UserX aria-hidden="true" className="h-3.5 w-3.5" />} /> : undefined}
        >
          <div className="space-y-3">
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search members by name or email"
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
                    onChange={(event) => setStatus(event.target.value)}
                    className="h-9 rounded-lg border border-app-border bg-app-bg px-2 text-xs text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent sm:text-sm"
                  >
                    <option value="ALL">All</option>
                    {statuses.map((value) => (
                      <option key={value} value={value}>
                        {statusLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
              }
            />

            {visible.length === 0 ? (
              <OwnerPageState state="empty" title="No members match your filters" description="Change the search or status filter." />
            ) : (
              <>
                <ul className="space-y-2 md:hidden">
                  {visible.map((member) => (
                    <li key={member.id} className="rounded-lg border border-app-border p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-app-text-primary">{memberName(member)}</p>
                          <p className="truncate text-caption text-app-text-secondary">{member.email}</p>
                          {member.roleLabel && <p className="mt-1 text-caption text-app-text-muted">{member.roleLabel}</p>}
                        </div>
                        <StatusBadge label={statusLabel(member.status)} tone={STATUS_TONES[member.status] ?? "neutral"} />
                      </div>
                      {rowActions && <div className="mt-2">{rowActions}</div>}
                    </li>
                  ))}
                </ul>
                <div className="hidden md:block">
                  <OwnerTable label="Organization members">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        {showRole && <TableHead>Role template</TableHead>}
                        <TableHead>Status</TableHead>
                        {rowActions && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium text-app-text-primary">{memberName(member)}</TableCell>
                          <TableCell className="break-all">{member.email}</TableCell>
                          {showRole && <TableCell>{member.roleLabel ?? "Not reported"}</TableCell>}
                          <TableCell>
                            <StatusBadge label={statusLabel(member.status)} tone={STATUS_TONES[member.status] ?? "neutral"} />
                          </TableCell>
                          {rowActions && <TableCell>{rowActions}</TableCell>}
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

      {canTransfer && (
        <OwnerPanel
          title="Ownership"
          description="Transfer ownership to an eligible active member after confirmation. Exactly one owner must remain, and you cannot demote yourself while you are the last owner."
          actions={<OwnerLaterBadge task="1.2" />}
        >
          <LaterActionButton>
            Transfer ownership
          </LaterActionButton>
        </OwnerPanel>
      )}
    </div>
  );
}
