import { useMemo } from "react";

import { useFixtureResource } from "@/hooks/useOrgResource";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuthStore } from "@/store/auth-store";
import type { PermissionGrant, PermissionKey } from "@/types/permission";

export function useManagerResource<T>({
  routeOrgId,
  name,
  permission,
  fixture,
}: {
  routeOrgId: string;
  name: string;
  permission: PermissionKey;
  fixture: (orgId: string, grants: readonly PermissionGrant[]) => T;
}) {
  const activeOrgId = useAuthStore((state) => state.currentOrg.id);
  const permissionState = usePermissions();
  const orgMatches = Boolean(routeOrgId && activeOrgId && routeOrgId === activeOrgId);
  const projectScopedAccess =
    permission === "project.read" &&
    permissionState.grants.some(
      (grant) =>
        grant.key === permission &&
        grant.scope === "PROJECT" &&
        permissionState.can(permission, { projectId: grant.scopeId }),
    );
  const allowed = permissionState.can(permission) || projectScopedAccess;
  const enabled = orgMatches &&
    permissionState.status === "ready" &&
    allowed;

  const fixtureForActiveOrg = useMemo(
    () => (orgId: string) => fixture(orgId, permissionState.grants),
    [fixture, permissionState.grants],
  );
  const resource = useFixtureResource({
    name,
    orgId: orgMatches ? activeOrgId : "",
    enabled,
    fixture: fixtureForActiveOrg,
  });

  const hasProjectScopedRead = permissionState.grants.some(
    (grant) => grant.key === "project.read" && grant.scope === "PROJECT",
  );

  return {
    ...resource,
    orgMatches,
    permission: allowed,
    permissionStatus: permissionState.status,
    permissionRetry: permissionState.retry,
    can: permissionState.can,
    canAny: permissionState.canAny,
    grants: permissionState.grants,
    scopeReported: permissionState.scopeReported,
    partialVisibility: hasProjectScopedRead && !permissionState.can("project.read"),
    orgId: activeOrgId,
  };
}
