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
  role: SystemRole | null;
  preview: boolean;
  status: PermissionStatus;
  source: PermissionSource;
  /** False when grants came from the API, which does not report scope yet (all treated as ORG). */
  scopeReported: boolean;
  grants: PermissionGrant[];
  load: (orgId: string, role: SystemRole, options?: { force?: boolean; preview?: boolean }) => Promise<void>;
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
    const applyFixture = (role: SystemRole, preview: boolean) =>
      set({
        role,
        preview,
        status: "ready",
        source: "fixture",
        scopeReported: true,
        grants: FIXTURE_GRANTS[role] ?? [],
      });

    async function run(orgId: string, role: SystemRole, seq: number, preview: boolean): Promise<void> {
      if (mocksRequested(deps.env, preview)) {
        applyFixture(role, preview);
        return;
      }
      try {
        const response = await deps.fetchPermissions(orgId);
        if (seq !== requestSeq) return;
        set({
          role,
          preview,
          status: "ready",
          source: "api",
          scopeReported: false,
          grants: grantsFromApi(response.permissions),
        });
      } catch (error) {
        if (seq !== requestSeq) return;
        const kind = classifyFailure(error, deps.env);
        if (kind === "fixture") applyFixture(role, preview);
        else if (kind === "unauthenticated") set({ role, preview, status: "unauthenticated", ...EMPTY });
        // Losing membership of the org (403/404) means the whole workspace is gone, not one object.
        else if (kind === "forbidden" || kind === "not-found") set({ role, preview, status: "access-lost", ...EMPTY });
        else set({ role, preview, status: "error", ...EMPTY });
      }
    }

    return {
      orgId: "",
      role: null,
      preview: false,
      status: "idle",
      ...EMPTY,
      load: (orgId, role, options = {}) => {
        if (!orgId) {
          requestSeq += 1;
          inflight = null;
          loadedKey = "";
          set({ orgId: "", role: null, preview: false, status: "access-lost", ...EMPTY });
          return Promise.resolve();
        }
        const key = `${orgId}|${role}|${options.preview ? "preview" : "live"}`;
        if (!options.force) {
          if (inflight?.key === key) return inflight.promise;
          if (loadedKey === key && get().status !== "idle") return Promise.resolve();
        }
        const seq = ++requestSeq;
        loadedKey = key;
        set({ orgId, role, preview: options.preview ?? false, status: "loading", ...EMPTY });
        const promise = run(orgId, role, seq, options.preview ?? false).finally(() => {
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
