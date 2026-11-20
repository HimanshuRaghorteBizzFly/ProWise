import type { PermissionGrant, PermissionKey, PermissionTarget } from "@/types/permission";

/** The 22 documented tenant keys, in docs/permission-matrix.md column order. */
export const PERMISSION_KEYS: readonly PermissionKey[] = [
  "org.manage",
  "member.invite",
  "member.disable",
  "role.manage",
  "team.manage",
  "project.create",
  "project.read",
  "project.edit",
  "project.archive",
  "project.mode.change",
  "project.scope.change",
  "project.deadline.edit",
  "project.progress.report",
  "project.progress.override",
  "task.create",
  "task.assign",
  "task.update",
  "task.review",
  "repo.connect",
  "repo.read",
  "report.export",
  "audit.read",
] as const;

const KEY_SET = new Set<string>(PERMISSION_KEYS);

export function isPermissionKey(value: string): value is PermissionKey {
  return KEY_SET.has(value);
}

/**
 * The API returns flat keys without scope (backend follow-up logged in docs/progress.md).
 * Until it does, every API key is treated as an ORG grant. Unknown keys are dropped.
 */
export function grantsFromApi(keys: readonly string[]): PermissionGrant[] {
  return keys.filter(isPermissionKey).map((key) => ({ key, scope: "ORG" as const }));
}

/**
 * Grants from GET /v1/me/permissions. Uses the scoped `grants` list when the API reports it
 * (PROJECT grants keep their project id); older responses fall back to ORG-only keys.
 */
export function grantsFromPermissionsResponse(response: {
  permissions: readonly string[];
  grants?: readonly { key: string; scope: string; scope_id: string | null }[];
}): { grants: PermissionGrant[]; scopeReported: boolean } {
  if (!response.grants) {
    return { grants: grantsFromApi(response.permissions), scopeReported: false };
  }
  const grants: PermissionGrant[] = [];
  for (const grant of response.grants) {
    if (!isPermissionKey(grant.key)) continue;
    if (grant.scope === "PROJECT" && grant.scope_id) {
      grants.push({ key: grant.key, scope: "PROJECT", scopeId: grant.scope_id });
    } else if (grant.scope === "ORG") {
      grants.push({ key: grant.key, scope: "ORG" });
    }
  }
  return { grants, scopeReported: true };
}

/** No target: only an ORG grant counts. With a project target: ORG grant or that project's grant. */
export function canWithGrants(
  grants: readonly PermissionGrant[],
  key: PermissionKey,
  target?: PermissionTarget,
): boolean {
  return grants.some(
    (grant) =>
      grant.key === key &&
      (grant.scope === "ORG" || (target !== undefined && grant.scopeId === target.projectId)),
  );
}

export function canAnyWithGrants(
  grants: readonly PermissionGrant[],
  keys: readonly PermissionKey[],
  target?: PermissionTarget,
): boolean {
  return keys.some((key) => canWithGrants(grants, key, target));
}

export interface PermissionEnv {
  nodeEnv: string | undefined;
  useMocks: string | undefined;
}

export function readPermissionEnv(): PermissionEnv {
  return { nodeEnv: process.env.NODE_ENV, useMocks: process.env.NEXT_PUBLIC_USE_MOCKS };
}

/** Fixture data is never allowed in a production build. */
export function mocksAllowed(env: PermissionEnv): boolean {
  return env.nodeEnv !== "production";
}

/** Fixture is used without calling the API only when explicitly requested outside production. */
export function mocksRequested(env: PermissionEnv, rolePreview = false): boolean {
  return mocksAllowed(env) && (env.useMocks === "true" || rolePreview);
}

/** Status 0 (network failure) or a gateway error from the Next.js /api proxy. 500 is a normal error. */
export function isBackendUnreachable(status: number): boolean {
  return status === 0 || status === 502 || status === 503 || status === 504;
}

export type FailureKind = "fixture" | "unauthenticated" | "forbidden" | "not-found" | "error";

/**
 * One rule for permissions and page data. Unreachable backend (network failure, missing base URL,
 * proxy 502/503/504) falls back to the typed fixture outside production only. 401/403/404 never do.
 */
export function classifyFailure(error: unknown, env: PermissionEnv): FailureKind {
  const status =
    typeof error === "object" && error !== null && "status" in error && typeof error.status === "number"
      ? error.status
      : 0;
  if (isBackendUnreachable(status)) return mocksAllowed(env) ? "fixture" : "error";
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  return "error";
}
