import { SystemRole } from "./auth";

export type PermissionAction =
  | "org:create"
  | "org:update"
  | "org:delete"
  | "org:transfer"
  | "member:invite"
  | "member:remove"
  | "member:role_change"
  | "project:create"
  | "project:edit_scope"
  | "project:delete"
  | "project:view"
  | "work_item:create"
  | "work_item:edit"
  | "work_item:delete"
  | "work_item:review"
  | "checkin:create"
  | "checkin:verify"
  | "delivery:request"
  | "delivery:accept"
  | "report:export"
  | "billing:manage";

export interface RolePermissionConfig {
  role: SystemRole;
  allowedActions: PermissionAction[];
  isPlatformLevel: boolean;
}


/**
 * Documented tenant permission keys (docs/permissions.md, docs/permission-matrix.md).
 * The legacy colon-style `PermissionAction` above is kept for untouched consumers only.
 */
export type PermissionKey =
  | "org.manage"
  | "member.invite"
  | "member.disable"
  | "role.manage"
  | "team.manage"
  | "project.create"
  | "project.read"
  | "project.edit"
  | "project.archive"
  | "project.mode.change"
  | "project.scope.change"
  | "project.deadline.edit"
  | "project.progress.report"
  | "project.progress.override"
  | "task.create"
  | "task.assign"
  | "task.update"
  | "task.review"
  | "repo.connect"
  | "repo.read"
  | "report.export"
  | "audit.read";

export type PermissionScope = "ORG" | "PROJECT";

export type PermissionGrant =
  | { key: PermissionKey; scope: "ORG" }
  | { key: PermissionKey; scope: "PROJECT"; scopeId: string };

export interface PermissionTarget {
  projectId: string;
}
