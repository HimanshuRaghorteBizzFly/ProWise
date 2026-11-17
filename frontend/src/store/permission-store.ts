import { createStore, type StoreApi } from "zustand/vanilla";

import { apiClient } from "@/lib/api";
import { FIXTURE_GRANTS } from "@/lib/fixtures/permissions";
import {
  classifyFailure,
  grantsFromApi,
  mocksRequested,
  readPermissionEnv,
  type PermissionEnv,
} from "@/lib/permissions";
import type { SystemRole } from "@/types";
import type { MyPermissionsResponse } from "@/types/api";
import type { PermissionGrant } from "@/types/permission";

export type PermissionStatus = "idle" | "loading" | "ready" | "error" | "access-lost" | "unauthenticated";
export type PermissionSource = "api" | "fixture" | null;

export interface PermissionState {
  orgId: string;
  status: PermissionStatus;
  source: PermissionSource;
  /** False when grants came from the API, which does not report scope yet (all treated as ORG). */
  scopeReported: boolean;
  grants: PermissionGrant[];
  load: (orgId: string, role: SystemRole, options?: { force?: boolean }) => Promise<void>;
}

export interface PermissionStoreDeps {
  fetchPermissions: (orgId: string) => Promise<MyPermissionsResponse>;
  env: PermissionEnv;
}

const EMPTY = { source: null, scopeReported: false, grants: [] as PermissionGrant[] };

export function createPermissionStore(deps: PermissionStoreDeps): StoreApi<PermissionState> {
  // Keyed by org + role template: the template selects the dev fixture response only.
  let inflight: { key: string; promise: Promise<void> } | null = null;
  let loadedKey = "";
  let requestSeq = 0;

  return createStore<PermissionState>((set, get) => {
    const applyFixture = (role: SystemRole) =>
      set({ status: "ready", source: "fixture", scopeReported: true, grants: FIXTURE_GRANTS[role] ?? [] });

    async function run(orgId: string, role: SystemRole, seq: number): Promise<void> {
      if (mocksRequested(deps.env)) {
        applyFixture(role);
        return;
      }
      try {
        const response = await deps.fetchPermissions(orgId);
        if (seq !== requestSeq) return;
        set({ status: "ready", source: "api", scopeReported: false, grants: grantsFromApi(response.permissions) });
      } catch (error) {
        if (seq !== requestSeq) return;
        const kind = classifyFailure(error, deps.env);
        if (kind === "fixture") applyFixture(role);
        else if (kind === "unauthenticated") set({ status: "unauthenticated", ...EMPTY });
        // Losing membership of the org (403/404) means the whole workspace is gone, not one object.
        else if (kind === "forbidden" || kind === "not-found") set({ status: "access-lost", ...EMPTY });
        else set({ status: "error", ...EMPTY });
      }
    }

    return {
      orgId: "",
      status: "idle",
      ...EMPTY,
      load: (orgId, role, options = {}) => {
        if (!orgId) {
          requestSeq += 1;
          inflight = null;
          loadedKey = "";
          set({ orgId: "", status: "access-lost", ...EMPTY });
          return Promise.resolve();
        }
        const key = `${orgId}|${role}`;
        if (!options.force) {
          if (inflight?.key === key) return inflight.promise;
          if (loadedKey === key && get().status !== "idle") return Promise.resolve();
        }
        const seq = ++requestSeq;
        loadedKey = key;
        set({ orgId, status: "loading", ...EMPTY });
        const promise = run(orgId, role, seq).finally(() => {
          if (inflight?.promise === promise) inflight = null;
        });
        inflight = { key, promise };
        return promise;
      },
    };
  });
}

export const permissionStore = createPermissionStore({
  fetchPermissions: (orgId) => apiClient.myPermissions(orgId),
  env: readPermissionEnv(),
});
