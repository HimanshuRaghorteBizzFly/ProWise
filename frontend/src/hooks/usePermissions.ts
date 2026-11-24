import { useCallback, useEffect } from "react";
import { useStore } from "zustand";

import { canAnyWithGrants, canWithGrants } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth-store";
import { permissionStore } from "@/store/permission-store";
import type { PermissionGrant, PermissionKey, PermissionTarget } from "@/types/permission";

const NO_GRANTS: readonly PermissionGrant[] = [];

/**
 * Effective permissions for the active membership, from GET /v1/me/permissions
 * only. Deny by default while loading or on any failure.
 * Never decide access from a role name: use `can` / `canAny`.
 */
export function usePermissions() {
  const orgId = useAuthStore((state) => state.currentOrg.id);
  // The role template only keys the cache (a role change reloads); it never grants anything.
  const roleTemplate = useAuthStore((state) => state.currentRole);
  const state = useStore(permissionStore);
  const { load } = state;

  useEffect(() => {
    void load(orgId, roleTemplate);
  }, [load, orgId, roleTemplate]);

  // Grants loaded for another organization are never used.
  const stateMatchesRequest = state.orgId === orgId && state.role === roleTemplate;
  const grants = stateMatchesRequest && state.status === "ready" ? state.grants : NO_GRANTS;
  const status = stateMatchesRequest || !orgId ? state.status : "loading";

  const can = useCallback(
    (key: PermissionKey, target?: PermissionTarget) => canWithGrants(grants, key, target),
    [grants],
  );
  const canAny = useCallback(
    (keys: readonly PermissionKey[], target?: PermissionTarget) => canAnyWithGrants(grants, keys, target),
    [grants],
  );
  const retry = useCallback(
    () => void load(orgId, roleTemplate, { force: true }),
    [load, orgId, roleTemplate],
  );

  return {
    status: status === "idle" ? ("loading" as const) : status,
    source: state.source,
    scopeReported: state.scopeReported,
    grants,
    can,
    canAny,
    retry,
  };
}
