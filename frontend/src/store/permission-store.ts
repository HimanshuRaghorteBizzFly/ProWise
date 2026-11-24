import { createStore, type StoreApi } from "zustand/vanilla";

import { apiClient } from "@/lib/api";
import { classifyFailure, grantsFromPermissionsResponse } from "@/lib/permissions";
import type { SystemRole } from "@/types";
import type { MyPermissionsResponse } from "@/types/api";
import type { PermissionGrant } from "@/types/permission";

export type PermissionStatus = "idle" | "loading" | "ready" | "error" | "access-lost" | "unauthenticated";
export type PermissionSource = "api" | null;

export interface PermissionState {
  orgId: string;
  role: SystemRole | null;
  status: PermissionStatus;
  source: PermissionSource;
  /** False when grants came from the API, which does not report scope yet (all treated as ORG). */
  scopeReported: boolean;
  grants: PermissionGrant[];
  load: (orgId: string, role: SystemRole, options?: { force?: boolean }) => Promise<void>;
  /** Forget everything loaded for the previous workspace (organization switch). */
  reset: () => void;
}

export interface PermissionStoreDeps {
  fetchPermissions: (orgId: string) => Promise<MyPermissionsResponse>;
}

const EMPTY = { source: null, scopeReported: false, grants: [] as PermissionGrant[] };

export function createPermissionStore(deps: PermissionStoreDeps): StoreApi<PermissionState> {
  // Keyed by org + role template so a role change in the same organization reloads; the role grants nothing itself.
  let inflight: { key: string; promise: Promise<void> } | null = null;
  let loadedKey = "";
  let requestSeq = 0;

  return createStore<PermissionState>((set, get) => {
    async function run(orgId: string, role: SystemRole, seq: number): Promise<void> {
      try {
        const response = await deps.fetchPermissions(orgId);
        if (seq !== requestSeq) return;
        const { grants, scopeReported } = grantsFromPermissionsResponse(response);
        set({ role, status: "ready", source: "api", scopeReported, grants });
      } catch (error) {
        if (seq !== requestSeq) return;
        const kind = classifyFailure(error);
        if (kind === "unauthenticated") set({ role, status: "unauthenticated", ...EMPTY });
        // Losing membership of the org (403/404) means the whole workspace is gone, not one object.
        else if (kind === "forbidden" || kind === "not-found") set({ role, status: "access-lost", ...EMPTY });
        else set({ role, status: "error", ...EMPTY });
      }
    }

    return {
      orgId: "",
      role: null,
      status: "idle",
      ...EMPTY,
      load: (orgId, role, options = {}) => {
        if (!orgId) {
          requestSeq += 1;
          inflight = null;
          loadedKey = "";
          set({ orgId: "", role: null, status: "access-lost", ...EMPTY });
          return Promise.resolve();
        }
        const key = `${orgId}|${role}`;
        if (!options.force) {
          if (inflight?.key === key) return inflight.promise;
          if (loadedKey === key && get().status !== "idle") return Promise.resolve();
        }
        const seq = ++requestSeq;
        loadedKey = key;
        set({ orgId, role, status: "loading", ...EMPTY });
        const promise = run(orgId, role, seq).finally(() => {
          if (inflight?.promise === promise) inflight = null;
        });
        inflight = { key, promise };
        return promise;
      },
      reset: () => {
        requestSeq += 1;
        inflight = null;
        loadedKey = "";
        set({ orgId: "", role: null, status: "idle", ...EMPTY });
      },
    };
  });
}

export const permissionStore = createPermissionStore({
  fetchPermissions: (orgId) => apiClient.myPermissions(orgId),
});
