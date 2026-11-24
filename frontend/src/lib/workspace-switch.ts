import type { QueryClient } from "@tanstack/react-query";

import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { permissionStore } from "@/store/permission-store";
import { useWorkspaceStore } from "@/store/workspace-store";

/**
 * Organization switch (task 1.3, T06). The server issues a token bound to the selected organization and revokes
 * the previous session, so old counts, lists and links cannot be re-read. Every client cache that may hold the
 * previous workspace's data is cleared before the new workspace renders.
 */

let queryClientRef: QueryClient | null = null;

export function registerQueryClient(client: QueryClient): void {
  queryClientRef = client;
}

/** Drops cached server data, effective permissions and workspace stores from the previous organization. */
export function clearWorkspaceCaches(): void {
  queryClientRef?.clear();
  permissionStore.getState().reset();
}

/** On success, the role the person holds in that organization and the dashboard to open (from the server). */
export type SwitchResult =
  | { ok: true; role?: string; targetDashboardUrl?: string }
  | { ok: false; status: number; message: string };

export async function switchWorkspace(orgId: string): Promise<SwitchResult> {
  let role: string | undefined;
  let targetDashboardUrl: string | undefined;
  try {
    const switched = await apiClient.switchOrganization(orgId);
    role = switched.role;
    targetDashboardUrl = switched.target_dashboard_url;
  } catch (error) {
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status: number }).status) : 0;
    return {
      ok: false,
      status,
      message: status === 404 ? "That workspace is not available to you." : "The workspace could not be switched. Try again.",
    };
  }

  clearWorkspaceCaches();
  const workspace = useWorkspaceStore.getState();
  workspace.setCurrentOrgId(orgId);
  const target = workspace.organizations.find((organization) => organization.id === orgId);
  const auth = useAuthStore.getState();
  auth.setCurrentOrg(target ?? { ...auth.currentOrg, id: orgId });
  if (role) auth.setCurrentRole(role as Parameters<typeof auth.setCurrentRole>[0]);
  return { ok: true, role, targetDashboardUrl };
}

/** Same page in the new workspace: /org/{old}/... becomes /org/{new}/... */
export function pathForWorkspace(pathname: string, orgId: string): string {
  return pathname.replace(/^\/org\/[^/]+/, `/org/${encodeURIComponent(orgId)}`);
}
