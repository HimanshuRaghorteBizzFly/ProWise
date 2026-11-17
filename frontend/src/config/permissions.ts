import { SystemRole, PermissionAction } from "@/types";

export const ROLE_PERMISSIONS: Record<SystemRole, PermissionAction[]> = {
  SUPER_ADMIN: [
    "org:create",
    "org:update",
    "org:delete",
    "report:export",
    "billing:manage",
  ],
  PLATFORM_OPERATOR: [
    "report:export",
  ],
  ORGANIZATION_OWNER: [
    "org:update",
    "org:transfer",
    "member:invite",
    "member:remove",
    "member:role_change",
    "project:create",
    "project:edit_scope",
    "project:delete",
    "project:view",
    "work_item:create",
    "work_item:edit",
    "work_item:delete",
    "work_item:review",
    "delivery:accept",
    "report:export",
    "billing:manage",
  ],
  ORGANIZATION_ADMIN: [
    "member:invite",
    "member:remove",
    "member:role_change",
    "project:create",
    "project:view",
    "work_item:create",
    "work_item:edit",
    "report:export",
  ],
  PROJECT_MANAGER: [
    "project:create",
    "project:edit_scope",
    "project:view",
    "work_item:create",
    "work_item:edit",
    "work_item:delete",
    "work_item:review",
    "checkin:verify",
    "delivery:request",
    "delivery:accept",
    "report:export",
  ],
  TEAM_LEAD: [
    "project:view",
    "work_item:create",
    "work_item:edit",
    "work_item:review",
    "report:export",
  ],
  DEVELOPER: [
    "project:view",
    "work_item:edit",
    "checkin:create",
    "delivery:request",
  ],
  QA_REVIEWER: [
    "project:view",
    "work_item:review",
    "report:export",
  ],
  VIEWER: [
    "project:view",
    "report:export",
  ],
};

export function hasPermission(role: SystemRole, action: PermissionAction): boolean {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(action);
}

