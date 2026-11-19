import { useCallback, useEffect, useMemo, useState } from "react";

import { classifyFailure, mocksAllowed, mocksRequested, readPermissionEnv } from "@/lib/permissions";
import { useAuthStore } from "@/store/auth-store";
import { useSampleDataNotice } from "@/store/sample-data-store";

export type OrgResourceState<T> =
  | { status: "idle" | "loading" | "error" | "forbidden" | "access-lost" | "unauthenticated" | "unavailable"; orgId: string }
  | { status: "ready"; orgId: string; data: T; source: "api" | "fixture"; loadedAt: string };

interface Options<T> {
  /** Unique name shown to the Sample data registry. */
  name: string;
  orgId: string;
  /** False when the caller lacks the permission: nothing is fetched. */
  enabled: boolean;
  fetch: (orgId: string) => Promise<T>;
  fixture: (orgId: string) => T;
}

/**
 * Org-scoped read with the same fallback rule as permissions: fixture only when
 * NEXT_PUBLIC_USE_MOCKS=true or the backend is unreachable, never in production,
 * never on 401/403/404. Responses for a previous org are discarded.
 */
export function useOrgResource<T>({ name, orgId, enabled, fetch, fixture }: Options<T>) {
  const [state, setState] = useState<OrgResourceState<T>>({ status: "idle", orgId });
  const [attempt, setAttempt] = useState(0);
  const isRolePreview = useAuthStore((auth) => auth.isRolePreview);

  useEffect(() => {
    let active = true;
    if (!orgId) {
      setState({ status: "access-lost", orgId });
      return;
    }
    if (!enabled) {
      setState({ status: "idle", orgId });
      return;
    }
    const env = readPermissionEnv();
    const ready = (data: T, source: "api" | "fixture") =>
      active && setState({ status: "ready", orgId, data, source, loadedAt: new Date().toISOString() });

    setState({ status: "loading", orgId });
    if (mocksRequested(env, isRolePreview)) {
      ready(fixture(orgId), "fixture");
      return () => {
        active = false;
      };
    }
    fetch(orgId)
      .then((data) => ready(data, "api"))
      .catch((error: unknown) => {
        if (!active) return;
        const kind = classifyFailure(error, env);
        if (kind === "fixture") ready(fixture(orgId), "fixture");
        else if (kind === "not-found") setState({ status: "access-lost", orgId });
        else setState({ status: kind, orgId });
      });
    return () => {
      active = false;
    };
    // fetch/fixture are module-level functions supplied by callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, enabled, attempt, isRolePreview]);

  const current: OrgResourceState<T> = state.orgId === orgId ? state : { status: "loading", orgId };
  useSampleDataNotice(name, current.status === "ready" && current.source === "fixture");
  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { state: current, retry };
}

const noop = () => undefined;

/**
 * Read for a screen whose backend task is not built yet. Outside production it serves the typed
 * fixture (and lights the Sample data badge); in a production build it reports "unavailable" so the
 * page shows its Later state instead of fake data.
 */
export function useFixtureResource<T>({
  name,
  orgId,
  enabled,
  fixture,
}: Omit<Options<T>, "fetch">): { state: OrgResourceState<T>; retry: () => void } {
  const allowed = mocksAllowed(readPermissionEnv());
  const status = !orgId ? "access-lost" : !enabled ? "idle" : allowed ? "ready" : "unavailable";
  const state = useMemo<OrgResourceState<T>>(
    () =>
      status === "ready"
        ? { status, orgId, data: fixture(orgId), source: "fixture", loadedAt: new Date().toISOString() }
        : { status, orgId },
    // fixture is a module-level function supplied by callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, orgId],
  );
  useSampleDataNotice(name, status === "ready");
  return { state, retry: noop };
}
