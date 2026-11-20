import type { SystemRole } from "@/types";
import type { PermissionGrant } from "@/types/permission";
import { getMockPermissions } from "@/lib/prowise-mock-adapters";

/**
 * Development permission fixture derived from the single Prowise JSON mock.
 * The role template selects grants only; authorization still goes through each grant.
 */

export const FIXTURE_GRANTS: Record<SystemRole, PermissionGrant[]> = {
  SUPER_ADMIN: getMockPermissions("SUPER_ADMIN"),
  PLATFORM_OPERATOR: getMockPermissions("PLATFORM_OPERATOR"),
  ORGANIZATION_OWNER: getMockPermissions("ORGANIZATION_OWNER"),
  ORGANIZATION_ADMIN: getMockPermissions("ORGANIZATION_ADMIN"),
  PROJECT_MANAGER: getMockPermissions("PROJECT_MANAGER"),
  TEAM_LEAD: getMockPermissions("TEAM_LEAD"),
  DEVELOPER: getMockPermissions("DEVELOPER"),
  QA_REVIEWER: getMockPermissions("QA_REVIEWER"),
  VIEWER: getMockPermissions("VIEWER"),
};
