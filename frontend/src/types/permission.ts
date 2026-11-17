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

