import { useCallback, useEffect, useState } from "react";

import { mockApi } from "@/lib/mock-api";
import { mocksAllowed, readPermissionEnv, type PermissionEnv } from "@/lib/permissions";
import { useSampleDataNotice } from "@/store/sample-data-store";
import { Project, User } from "@/types";

export type OwnerDashboardLoadState =
  | { status: "loading"; orgId: string }
  | { status: "ready"; orgId: string; projects: Project[]; users: User[]; loadedAt?: string }
  | { status: "error"; orgId: string; message: string }
  /** Production build: dashboard data needs tasks 2.1 / 5.3, and fixtures are never shown. */
  | { status: "unavailable"; orgId: string };

/** Where loading starts: fixtures are allowed only outside production. */
export function getOwnerDashboardStart(orgId: string, env: PermissionEnv = readPermissionEnv()): OwnerDashboardLoadState {
  return mocksAllowed(env) ? { status: "loading", orgId } : { status: "unavailable", orgId };
}

export function getOwnerDashboardStateForOrg(
  state: OwnerDashboardLoadState,
  orgId: string,
): OwnerDashboardLoadState {
  return state.orgId === orgId ? state : getOwnerDashboardStart(orgId);
}

export function useOwnerDashboard(orgId: string) {
  const [state, setState] = useState<OwnerDashboardLoadState>(() => getOwnerDashboardStart(orgId));
  const [requestNumber, setRequestNumber] = useState(0);

  useEffect(() => {
    let active = true;

    if (getOwnerDashboardStart(orgId).status === "unavailable") {
      setState({ status: "unavailable", orgId });
      return;
    }

    if (!orgId) {
      setState({ status: "error", orgId, message: "The active organization is unavailable." });
      return () => {
        active = false;
      };
    }

    setState({ status: "loading", orgId });
    Promise.all([mockApi.projects.list(orgId), mockApi.users.list()])
      .then(([projects, users]) => {
        if (!active) return;
        const projectMemberIds = new Set(projects.flatMap((project) => project.memberIds));
        setState({
          status: "ready",
          orgId,
          projects,
          users: users.filter((user) => projectMemberIds.has(user.id)),
          loadedAt: new Date().toISOString(),
        });
      })
      .catch(() => {
        if (active) {
          setState({
            status: "error",
            orgId,
            message: "Owner dashboard fixture data could not be loaded. Please try again.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [orgId, requestNumber]);

  const retry = useCallback(() => setRequestNumber((number) => number + 1), []);

  const current = getOwnerDashboardStateForOrg(state, orgId);
  // Dashboard data always comes from mockApi fixtures until tasks 2.1 and 5.3 provide the API.
  useSampleDataNotice("owner-dashboard", current.status === "ready");

  return { state: current, retry };
}
