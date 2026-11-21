"use client";

import React, { useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Lock } from "lucide-react";
import { useOrgConsoleStore } from "@/store/org-console-store";
import { ORG_NOW, type AuditEvent, type InviteStatus, type MemberStatus, type PermissionId, type RoleDef, type SyncStatus } from "@/mocks/org-console";
import { PageSkeleton, StatusBadge } from "@/components/delivery/DeliveryUI";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionKey } from "@/types/permission";
import type { OrgFamily } from "./role-rules";
import { orgPath } from "./org-nav-config";
import { AccessDeniedState, AccessLostState, PermissionsErrorState, SessionExpiredState } from "./AccessStates";

/** Builds links inside the Owner or Admin route family. */
export function useOrgHref(family: OrgFamily) {
  const params = useParams();
  const orgId = (params?.orgId as string) || "org-acme";
  return useCallback((path = "dashboard") => orgPath(family, orgId, path), [family, orgId]);
}

/** Id lookups over the org console store. */
export function useOrgLookups() {
  const members = useOrgConsoleStore((s) => s.members);
  const teams = useOrgConsoleStore((s) => s.teams);
  const roles = useOrgConsoleStore((s) => s.roles);
  const projects = useOrgConsoleStore((s) => s.projects);
  return useMemo(() => {
    const mm = new Map(members.map((m) => [m.id, m]));
    const tm = new Map(teams.map((t) => [t.id, t]));
    const rm = new Map(roles.map((r) => [r.id, r]));
    const pm = new Map(projects.map((p) => [p.id, p]));
    return {
      member: (id?: string | null) => (id ? mm.get(id) ?? null : null),
      team: (id?: string | null) => (id ? tm.get(id) ?? null : null),
      role: (id?: string | null) => (id ? rm.get(id) ?? null : null),
      project: (id?: string | null) => (id ? pm.get(id) ?? null : null),
    };
  }, [members, teams, roles, projects]);
}

/**
 * Page needs are written in the console's vocabulary; access is always decided on the real
 * permission keys from docs/permissions.md, loaded from GET /v1/me/permissions (task 1.3).
 */
const NEED_TO_KEY: Record<PermissionId, PermissionKey> = {
  "org.manage": "org.manage",
  "org.ownership.transfer": "org.manage", // the API also requires the caller to be the current owner (task 1.2)
  "org.privacy.manage": "org.manage",
  "member.invite": "member.invite",
  "member.disable": "member.disable",
  "role.manage": "role.manage",
  "role.create": "role.manage",
  "team.manage": "team.manage",
  "project.create": "project.create",
  "project.read": "project.read",
  "project.edit": "project.edit",
  "project.archive": "project.archive",
  "project.scope.approve": "project.scope.change",
  "task.create": "task.create",
  "task.assign": "task.assign",
  "task.update": "task.update",
  "progress.report": "project.progress.report",
  "task.review": "task.review",
  "repo.connect": "repo.connect",
  "repo.read": "repo.read",
  "report.view": "project.read",
  "report.export": "report.export",
  "audit.read": "audit.read",
  "integration.manage": "org.manage",
  "notification.manage": "org.manage",
};

/**
 * Page-level permission gate for the Owner and Admin route families. It reads the caller's effective grants
 * (never a role-name map) and renders loading, access-lost, session-expired, error or 403 states. The server
 * enforces the same rules on every API call; this only keeps hidden pages from rendering.
 */
export function OrgGate({ family, need, children }: { family: OrgFamily; need?: PermissionId; children: React.ReactNode }) {
  const { status, can, retry } = usePermissions();
  const href = useOrgHref(family);
  if (status === "loading") return <PageSkeleton variant="detail" />;
  if (status === "access-lost") return <AccessLostState />;
  if (status === "unauthenticated") return <SessionExpiredState />;
  if (status === "error") return <PermissionsErrorState onRetry={retry} />;
  const key = need ? NEED_TO_KEY[need] : undefined;
  if (key && !can(key)) return <AccessDeniedState permission={key} backHref={href()} />;
  return <>{children}</>;
}

export function timeAgo(instant: string) {
  const mins = Math.max(0, Math.round((new Date(ORG_NOW).getTime() - new Date(instant).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const MEMBER: Record<MemberStatus, [string, "success" | "warning" | "danger" | "neutral"]> = {
  ACTIVE: ["Active", "success"],
  INVITED: ["Invited", "warning"],
  SUSPENDED: ["Suspended", "danger"],
  DISABLED: ["Disabled", "neutral"],
};
export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  const [l, t] = MEMBER[status];
  return <StatusBadge label={l} tone={t} dot />;
}

const INVITE: Record<InviteStatus, [string, "success" | "warning" | "danger" | "neutral"]> = {
  PENDING: ["Pending", "warning"],
  ACCEPTED: ["Accepted", "success"],
  EXPIRED: ["Expired", "danger"],
  REVOKED: ["Revoked", "neutral"],
};
export function InviteStatusBadge({ status }: { status: InviteStatus }) {
  const [l, t] = INVITE[status];
  return <StatusBadge label={l} tone={t} dot />;
}

const SYNC: Record<SyncStatus, [string, "success" | "info" | "danger" | "warning"]> = {
  HEALTHY: ["Healthy", "success"],
  SYNCING: ["Syncing", "info"],
  FAILED: ["Failed", "danger"],
  PAUSED: ["Paused", "warning"],
};
export const SYNC_COLOR: Record<SyncStatus, string> = { HEALTHY: "#10B981", SYNCING: "#3B82F6", FAILED: "#EF4444", PAUSED: "#F59E0B" };
export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  const [l, t] = SYNC[status];
  return <StatusBadge label={l} tone={t} dot />;
}

export function AuditSeverityBadge({ severity }: { severity: AuditEvent["severity"] }) {
  return <StatusBadge label={severity === "INFO" ? "Info" : severity === "WARNING" ? "Warning" : "Critical"} tone={severity === "INFO" ? "info" : severity === "WARNING" ? "warning" : "danger"} />;
}

export function RoleChip({ role }: { role?: RoleDef | null }) {
  if (!role) return <span className="text-[var(--color-text-muted)]">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ borderColor: `${role.color}55`, backgroundColor: `${role.color}1F`, color: role.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: role.color }} />
      {role.name}
    </span>
  );
}

export function LockNote({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-300">
      <Lock className="w-3 h-3 shrink-0" />
      {reason}
    </span>
  );
}
