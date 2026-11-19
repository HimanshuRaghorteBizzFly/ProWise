"use client";

import React from "react";
import Link from "next/link";
import { Check, Minus, ShieldCheck } from "lucide-react";

import { PERMISSION_DESCRIPTIONS, PERMISSION_GROUPS } from "@/components/owner/AccessMapView";
import { LaterActionButton, OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPageState } from "@/components/owner/OwnerPageState";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { PageHeader, StatusBadge } from "@/components/owner/primitives";
import { isPermissionKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { OrgRoleResponse } from "@/types/api";
import type { PermissionGrant } from "@/types/permission";

export interface RolesViewProps {
  roles: OrgRoleResponse[];
  source: "api" | "fixture";
  canManageRoles: boolean;
  /** The viewer's own grants: nobody can grant a key they do not hold. */
  heldGrants: readonly PermissionGrant[];
  basePath?: string;
}


export function RolesView({ roles, source, canManageRoles, heldGrants, basePath }: RolesViewProps) {
  const selected = roles[0];
  const held = new Set(heldGrants.filter((grant) => grant.scope === "ORG").map((grant) => grant.key));

  const header = (
    <PageHeader
      title="Roles & permissions"
      description="Role templates are starting points only; a role name grants nothing by itself. This page is read-only."
      simulationLabel={source === "fixture" ? "Sample data" : undefined}
      actions={
        canManageRoles ? (
          <Link
            href={basePath ? `${basePath}/roles-permissions/new` : "roles-permissions/new"}
            className="inline-flex min-h-9 items-center rounded-lg bg-[#1A73E8] px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1557B0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 motion-reduce:transition-none"
          >
              Create custom role
          </Link>
        ) : undefined
      }
    />
  );

  if (!canManageRoles) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState state="forbidden" requiredPermission="role.manage" description="Viewing roles requires role.manage." />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="space-y-4">
        {header}
        <OwnerPageState state="empty" icon={ShieldCheck} title="No roles defined" description="This organization has no role templates or custom roles yet." />
      </div>
    );
  }

  const roleKeys = new Set(selected.permissionKeys);
  const unknownKeys = selected.permissionKeys.filter((key) => !isPermissionKey(key));
  const notGrantable = selected.permissionKeys.filter((key) => isPermissionKey(key) && !held.has(key));

  return (
    <div className="space-y-4">
      {header}

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <OwnerPanel title="Roles" description={`${roles.length} roles`}>
          <ul className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap" aria-label="Select a role">
            {roles.map((role) => {
              const active = role.id === selected.id;
              return (
                <li key={role.id} className="lg:w-full">
                  <Link
                    href={basePath ? `${basePath}/roles-permissions/${role.id}` : `./${role.id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent motion-reduce:transition-none",
                      active
                        ? "border-blue-500/40 bg-blue-500/15 font-semibold text-blue-700 dark:text-blue-300"
                        : "border-app-border text-app-text-secondary hover:bg-app-hover hover:text-app-text-primary",
                    )}
                  >
                    <span className="truncate">{role.name}</span>
                    <span className="shrink-0 text-[11px] font-medium text-app-text-muted">{role.template ? "Template" : "Custom"}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </OwnerPanel>

        <OwnerPanel
          title={selected.name}
          description={`${selected.template ? "Template" : "Custom"} role · version ${selected.version} · ${roleKeys.size} keys`}
          actions={
            <>
              {!selected.template && (
                <LaterActionButton>
                  Edit role
                </LaterActionButton>
              )}
              <LaterActionButton>
                Grant role
              </LaterActionButton>
              <OwnerLaterBadge task="1.4" after />
            </>
          }
        >
          {notGrantable.length > 0 && (
            <p role="note" className="mb-4 rounded-lg border border-app-border bg-app-bg px-3 py-2 text-caption text-app-text-secondary">
              You cannot grant this role: it includes {notGrantable.length} key{notGrantable.length === 1 ? "" : "s"} you do
              not hold ({notGrantable.join(", ")}).
            </p>
          )}
          <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
            {PERMISSION_GROUPS.map((group) => (
              <section key={group.title} aria-label={group.title} className="min-w-0">
                <h3 className="mb-2 text-caption font-semibold uppercase tracking-wider text-app-text-muted">{group.title}</h3>
                <ul className="space-y-1.5">
                  {group.keys.map((key) => {
                    const included = roleKeys.has(key);
                    return (
                      <li key={key} className="flex items-start gap-2 text-sm">
                        {included ? (
                          <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Minus aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-app-text-muted" />
                        )}
                        <span className="min-w-0">
                          <span className={included ? "text-app-text-primary" : "text-app-text-muted"}>
                            {PERMISSION_DESCRIPTIONS[key]}
                          </span>
                          <span className="sr-only">{included ? " (included)" : " (not included)"}</span>
                          <code className="block break-all text-[11px] text-app-text-muted">{key}</code>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
          {unknownKeys.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-caption text-app-text-muted">Keys not in the documented list:</span>
              {unknownKeys.map((key) => (
                <StatusBadge key={key} label={key} tone="warning" />
              ))}
            </div>
          )}
        </OwnerPanel>
      </div>
    </div>
  );
}
