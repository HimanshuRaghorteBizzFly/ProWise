import React from "react";
import { Check, Info, Minus } from "lucide-react";

import { OwnerLaterBadge } from "@/components/owner/OwnerLaterBadge";
import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { PageHeader, StatusBadge } from "@/components/owner/primitives";
import type { OrgNavFamily } from "@/components/owner/org-nav";
import { PERMISSION_KEYS, canWithGrants } from "@/lib/permissions";
import type { PermissionGrant, PermissionKey } from "@/types/permission";

export const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "org.manage": "Organization policy and settings",
  "member.invite": "Invite members",
  "member.disable": "Disable members",
  "role.manage": "Manage roles and grants",
  "team.manage": "Manage teams",
  "project.create": "Create projects",
  "project.read": "View projects",
  "project.edit": "Edit project records",
  "project.archive": "Archive and restore projects",
  "project.mode.change": "Change delivery mode",
  "project.scope.change": "Change approved scope",
  "project.deadline.edit": "Edit deadlines",
  "project.progress.report": "Report Individual progress (accountable developer)",
  "project.progress.verify": "Approve or reject Individual check-ins (team lead)",
  "project.progress.override": "Override progress",
  "task.create": "Create tasks",
  "task.assign": "Assign tasks",
  "task.update": "Update tasks",
  "task.review": "Review submitted work",
  "repo.connect": "Connect GitHub repositories",
  "repo.read": "View repository activity",
  "report.export": "Export reports (CSV)",
  "audit.read": "Read restricted audit records",
};

export const PERMISSION_GROUPS: { title: string; keys: PermissionKey[] }[] = [
  { title: "Organization and people", keys: PERMISSION_KEYS.slice(0, 5) },
  { title: "Projects and scope", keys: PERMISSION_KEYS.filter((key) => key.startsWith("project.") && !key.includes("progress")) },
  { title: "Work and progress", keys: PERMISSION_KEYS.filter((key) => key.includes("progress") || key.startsWith("task.")) },
  { title: "Private resources", keys: ["repo.connect", "repo.read", "report.export", "audit.read"] },
];

const ALWAYS_DENIED: Partial<Record<PermissionKey, string>> = {
  "project.progress.override": "Denied to every role. Corrections use a separate decision entry.",
};

export interface AccessMapViewProps {
  family: OrgNavFamily;
  grants: readonly PermissionGrant[];
  source: "api" | "fixture" | null;
  scopeReported: boolean;
  isCurrentOwner: boolean;
}

function describeScope(grants: readonly PermissionGrant[], key: PermissionKey, scopeReported: boolean): string {
  const matching = grants.filter((grant) => grant.key === key);
  if (matching.some((grant) => grant.scope === "ORG")) {
    return scopeReported ? "Whole organization" : "Organization (scope not reported by API)";
  }
  const projects = matching.flatMap((grant) => (grant.scope === "PROJECT" ? [grant.scopeId] : []));
  return projects.length === 1 ? `Project: ${projects[0]}` : `Projects: ${projects.join(", ")}`;
}

function AccessRow({ title, code, allowed, detail, extra }: {
  title: string;
  code?: string;
  allowed: boolean;
  detail: string;
  extra?: React.ReactNode;
}) {
  return (
    <li className="grid grid-cols-1 gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-app-text-primary">{title}</p>
        {code && <code className="mt-0.5 block break-all text-caption text-app-text-muted">{code}</code>}
        <p className="mt-1 text-caption text-app-text-secondary">{detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {extra}
        <StatusBadge label={allowed ? "Allowed" : "Denied"} tone={allowed ? "success" : "neutral"} />
        <span className="sr-only">{allowed ? "allowed" : "denied"}</span>
        {allowed ? (
          <Check aria-hidden="true" className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Minus aria-hidden="true" className="h-4 w-4 text-app-text-muted" />
        )}
      </div>
    </li>
  );
}

export function AccessMapView({ family, grants, source, scopeReported, isCurrentOwner }: AccessMapViewProps) {
  const held = (key: PermissionKey) => grants.some((grant) => grant.key === key);
  const allowedCount = PERMISSION_KEYS.filter(held).length;
  const canTransfer = family === "owner" && isCurrentOwner && canWithGrants(grants, "org.manage");

  return (
    <div className="space-y-4">
      <PageHeader
        title="What can I do?"
        description="Every documented permission for your active membership in this organization, with its scope and the reason for anything denied. The server checks every request again."
        simulationLabel={source === "fixture" ? "Sample data" : undefined}
      />

      <div className="flex flex-wrap items-center gap-2" aria-label="Access summary">
        <StatusBadge label={`${allowedCount} allowed`} tone="success" dot />
        <StatusBadge label={`${PERMISSION_KEYS.length - allowedCount} denied`} tone="neutral" dot />
        <span className="text-caption text-app-text-muted">of {PERMISSION_KEYS.length} documented keys</span>
      </div>

      {!scopeReported && (
        <div role="note" className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong className="font-semibold">Scope not reported by API.</strong> The permissions service returns keys
            without their organization or project scope yet, so each key is shown as organization-wide. Project-only
            grants may appear broader here than they are; the server still enforces the real scope.
          </p>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => (
          <OwnerPanel key={group.title} title={group.title}>
            <ul className="divide-y divide-app-border">
              {group.keys.map((key) => {
                const allowed = held(key);
                const detail = allowed
                  ? describeScope(grants, key, scopeReported)
                  : ALWAYS_DENIED[key] ?? "Not granted to your active membership. Ask someone with role.manage.";
                return <AccessRow key={key} title={PERMISSION_DESCRIPTIONS[key]} code={key} allowed={allowed} detail={detail} />;
              })}
            </ul>
          </OwnerPanel>
        ))}

        <OwnerPanel title="Restricted actions" description="Actions with extra rules beyond a single permission key.">
          <ul className="divide-y divide-app-border">
            <AccessRow
              title="Transfer ownership"
              allowed={canTransfer}
              detail={
                canTransfer
                  ? "You are the current owner. Transfer goes to an eligible active member after confirmation."
                  : "Only the current owner with org.manage can transfer ownership. Exactly one owner must remain."
              }
              extra={canTransfer ? <OwnerLaterBadge task="1.2" /> : undefined}
            />
            <AccessRow
              title="Grant permissions beyond your own"
              allowed={false}
              detail="You cannot grant permissions you do not hold, whatever your role template."
            />
          </ul>
        </OwnerPanel>
      </div>
    </div>
  );
}
