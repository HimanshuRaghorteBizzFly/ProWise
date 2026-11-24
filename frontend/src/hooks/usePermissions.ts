import { useCallback, useEffect } from "react";
import { useStore } from "zustand";

import { canAnyWithGrants, canWithGrants, previewEnabled } from "@/lib/permissions";
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
<<<<<<< HEAD
  // Role preview counts only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true): it never overrides a real session.
  const isRolePreview = useAuthStore((state) => state.isRolePreview) && previewEnabled();
  const sessionStatus = useAuthStore((state) => state.sessionStatus);
=======
>>>>>>> 29db595 (Initial ProWise project upload)
  const state = useStore(permissionStore);
  const { load } = state;
  // Until the server session is known, the identity in the store is only a default, so nothing is judged yet:
  // right after sign-up or sign-in the gate shows "checking access", never "restricted access".
  const sessionChecking = !isRolePreview && sessionStatus === "checking";
  const sessionMissing = !isRolePreview && sessionStatus === "anonymous";

  useEffect(() => {
<<<<<<< HEAD
    if (sessionChecking || sessionMissing) return;
    void load(orgId, roleTemplate, { preview: isRolePreview });
  }, [load, orgId, roleTemplate, isRolePreview, sessionChecking, sessionMissing]);

  // Grants loaded for another organization are never used.
  const stateMatchesRole =
    state.role === roleTemplate && state.preview === isRolePreview;
  const stateMatchesRequest = state.orgId === orgId && stateMatchesRole;
  // While checking, nothing new is loaded; grants already loaded for exactly this org and role (only possible after
  // a real session, since establishing a session clears them) stay usable.
  const loadedForThis = stateMatchesRequest && state.status === "ready";
  const grants = !sessionMissing && loadedForThis ? state.grants : NO_GRANTS;
  const status = sessionMissing ? "unauthenticated"
    : sessionChecking ? (loadedForThis ? "ready" : "loading")
      : stateMatchesRequest || !orgId ? state.status : "loading";
=======
    void load(orgId, roleTemplate);
  }, [load, orgId, roleTemplate]);

  // Grants loaded for another organization are never used.
  const stateMatchesRequest = state.orgId === orgId && state.role === roleTemplate;
  const grants = stateMatchesRequest && state.status === "ready" ? state.grants : NO_GRANTS;
  const status = stateMatchesRequest || !orgId ? state.status : "loading";
>>>>>>> 29db595 (Initial ProWise project upload)

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
