import { apiClient } from "@/lib/api";
import { clearWorkspaceCaches } from "@/lib/workspace-switch";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { MeResponse } from "@/types/api";
import type { Organization, SystemRole, User } from "@/types";

/**
 * The signed-in session as the server reports it (GET /v1/me). The landing page, the active organization and the
 * role used to pick a dashboard all come from here: never from a hard-coded role, a fixture or a default.
 */

const ROLES: readonly SystemRole[] = [
  "SUPER_ADMIN", "PLATFORM_OPERATOR", "ORGANIZATION_OWNER", "ORGANIZATION_ADMIN",
  "PROJECT_MANAGER", "TEAM_LEAD", "DEVELOPER", "QA_REVIEWER", "VIEWER",
];

export const NO_WORKSPACE_PATH = "/no-workspace";
export const SELECT_WORKSPACE_PATH = "/select-workspace";

export function toSystemRole(role: string | null | undefined): SystemRole | null {
  return role && ROLES.includes(role as SystemRole) ? (role as SystemRole) : null;
}

export interface SessionSnapshot {
  user: User;
  organizations: Organization[];
  /** Active organization id ("" when none is selected). */
  activeOrgId: string;
  /** Role used to pick the dashboard. Access itself is still decided by the server's permissions. */
  role: SystemRole;
  /** The page this session should land on. */
  target: string;
  platform: boolean;
}

function parseCalendar(value: string) {
  try {
    const calendar = JSON.parse(value) as { workDays?: number[]; dailyHours?: number; holidays?: string[] };
    return { workDays: calendar.workDays || [], dailyHours: calendar.dailyHours || 0, holidays: calendar.holidays || [] };
  } catch {
    return { workDays: [], dailyHours: 0, holidays: [] };
  }
}

/** Pure mapping from GET /v1/me to the client session (easy to test). */
export function sessionFromMe(me: MeResponse): SessionSnapshot {
  const organizations = me.memberships.map((membership): Organization => ({
    id: membership.org_id,
    slug: membership.slug,
    name: membership.name,
    ownerId: "",
    timezone: membership.timezone,
    workCalendar: parseCalendar(membership.work_calendar),
    createdAt: "",
    plan: "FREE",
    status: membership.status === "ACTIVE" ? "ACTIVE" : "SUSPENDED",
  }));
  const platform = Boolean(me.platform_account);
  const activeOrgId = !platform && me.organization_id ? me.organization_id : "";
  const role = toSystemRole(me.role)
    ?? toSystemRole(me.memberships.find((membership) => membership.org_id === activeOrgId)?.role_template)
    ?? "VIEWER";
  let target = me.target_dashboard_url;
  if (!target) {
    if (me.memberships.length === 0 && !platform) target = NO_WORKSPACE_PATH;
    else target = SELECT_WORKSPACE_PATH;
  }
  return {
    user: {
      id: me.id,
      email: me.email,
      name: me.name || me.email.split("@")[0],
      timezone: organizations.find((org) => org.id === activeOrgId)?.timezone || "UTC",
      createdAt: "",
    },
    organizations,
    activeOrgId,
    role,
    target,
    platform,
  };
}

/** Loads the server session into the client stores and returns where it should land. */
export async function establishSession(): Promise<SessionSnapshot> {
  // Page load or reload: the access token is only in memory, so first get one silently from the httpOnly refresh
  // cookie. Pages wait for this (sessionStatus "checking") before showing sign-in or "Access restricted".
  await apiClient.ensureAccessToken().catch(() => null);
  const snapshot = sessionFromMe(await apiClient.me());
  clearWorkspaceCaches();
  useAuthStore.getState().hydrate(snapshot.user, snapshot.organizations, snapshot.role, snapshot.activeOrgId);
  const workspace = useWorkspaceStore.getState();
  workspace.setOrganizations(snapshot.organizations);
  if (snapshot.activeOrgId) workspace.setCurrentOrgId(snapshot.activeOrgId);
  return snapshot;
}
