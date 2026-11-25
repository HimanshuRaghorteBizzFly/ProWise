"use client";

import React, { useCallback } from "react";
import { useParams } from "next/navigation";
import { PageSkeleton } from "@/components/delivery/DeliveryUI";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionKey } from "@/types/permission";
import type { OrgFamily } from "./role-rules";
import { orgPath } from "./org-nav-config";
import { AccessDeniedState, AccessLostState, PermissionsErrorState, SessionExpiredState } from "./AccessStates";

/** Builds links inside the Owner or Admin route family. */
export function useOrgHref(family: OrgFamily) {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  return useCallback((path = "dashboard") => orgPath(family, orgId, path), [family, orgId]);
}

/**
 * Page needs are written in the console's vocabulary; access is always decided on the real
 * permission keys from docs/permissions.md, loaded from GET /v1/me/permissions (task 1.3).
 */
const NEED_TO_KEY = {
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
} as const satisfies Record<string, PermissionKey>;

/** A page need in the console vocabulary; it always maps to one real permission key. */
export type PermissionId = keyof typeof NEED_TO_KEY;

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
