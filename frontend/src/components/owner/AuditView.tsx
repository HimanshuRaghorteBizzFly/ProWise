"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ScrollText } from "lucide-react";

import { OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { OwnerTable } from "@/components/owner/OwnerTable";
import { FilterBar, PageHeader } from "@/components/owner/primitives";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AuditRecord } from "@/types/org-admin";
import type { PermissionKey } from "@/types/permission";

export interface AuditViewProps {
  records: AuditRecord[];
  can: (key: PermissionKey) => boolean;
  basePath?: string;
}

const actionLabel = (action: string) => action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, " ");

function formatUtc(timestamp: string): string {
  return `${new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(new Date(timestamp))} UTC`;
}

export function AuditView({ records, can, basePath }: AuditViewProps) {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("ALL");
  const actions = useMemo(() => Array.from(new Set(records.map((record) => record.action))).sort(), [records]);
  const sorted = useMemo(() => [...records].sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [records]);
  const query = search.trim().toLowerCase();
  const visible = sorted.filter(
    (record) =>
      (action === "ALL" || record.action === action) &&
      (!query || record.actorEmail.toLowerCase().includes(query) || record.details.toLowerCase().includes(query)),
  );

  const header = (
    <PageHeader
      title="Audit & security"
      description="Restricted records of material decisions: who did what, to which object, and when (UTC). Secrets, tokens and private code are never recorded here."
      actions={<OwnerLaterBadge task="1.4" />}
    />
  );

  if (!can("audit.read")) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState state="forbidden" requiredPermission="audit.read" description="Audit records require audit.read." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}
      {records.length === 0 ? (
        <OwnerPageState state="empty" icon={ScrollText} title="No audit records" description="Material decisions will be recorded here." />
      ) : (
        <OwnerPanel title="Audit records" description={`${visible.length} of ${records.length} records, newest first`}>
          <div className="space-y-3">
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by actor or details"
              hasActiveFilters={search !== "" || action !== "ALL"}
              onResetFilters={() => {
                setSearch("");
                setAction("ALL");
              }}
              filters={
                <label className="flex items-center gap-2 text-xs text-app-text-secondary">
                  <span>Action</span>
                  <select
                    value={action}
                    onChange={(event) => setAction(event.target.value)}
                    className="h-9 min-w-0 rounded-lg border border-app-border bg-app-bg px-2 text-xs text-app-text-primary focus:outline-none focus:ring-2 focus:ring-app-accent sm:text-sm"
                  >
                    <option value="ALL">All</option>
                    {actions.map((value) => (
                      <option key={value} value={value}>
                        {actionLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
              }
            />
            {visible.length === 0 ? (
              <OwnerPageState state="empty" title="No audit records match your filters" description="Change the search or action filter." />
            ) : (
              <>
                <ul className="space-y-2 md:hidden">
                  {visible.map((record) => (
                    <li key={record.id} className="rounded-lg border border-app-border p-3 text-sm">
                      <p className="font-semibold text-app-text-primary">{basePath ? <Link href={`${basePath}/audit-logs/${record.id}`} className="rounded-sm hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:hover:text-blue-300">{actionLabel(record.action)}</Link> : actionLabel(record.action)}</p>
                      <p className="break-all text-caption text-app-text-secondary">{record.actorEmail}</p>
                      <p className="mt-1 text-app-text-secondary">{record.details}</p>
                      <p className="mt-1 text-caption text-app-text-muted">
                        {record.targetType} · {formatUtc(record.timestamp)}
                      </p>
                    </li>
                  ))}
                </ul>
                <div className="hidden md:block">
                  <OwnerTable label="Audit records">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time (UTC)</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Object</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="whitespace-nowrap">{formatUtc(record.timestamp)}</TableCell>
                          <TableCell className="break-all">
                            {record.actorEmail}
                            <span className="block text-caption text-app-text-muted">{record.actorRole}</span>
                          </TableCell>
                          <TableCell>{basePath ? <Link href={`${basePath}/audit-logs/${record.id}`} className="rounded-sm hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent dark:hover:text-blue-300">{actionLabel(record.action)}</Link> : actionLabel(record.action)}</TableCell>
                          <TableCell>{record.targetType}</TableCell>
                          <TableCell>{record.details}</TableCell>
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
