import { apiClient } from "@/lib/api";
import { toSystemRole } from "@/lib/auth-session";
import { useAuthStore, getRoleDashboardPath } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { MeResponse } from "@/types/api";
import type { Organization, SystemRole } from "@/types";

function parseCalendar(value: string | null | undefined): Organization["workCalendar"] {
  try {
    const parsed = JSON.parse(value || "{}") as Partial<Organization["workCalendar"]>;
    return {
      workDays: Array.isArray(parsed.workDays) ? parsed.workDays : [],
      dailyHours: typeof parsed.dailyHours === "number" ? parsed.dailyHours : 0,
      holidays: Array.isArray(parsed.holidays) ? parsed.holidays : [],
    };
  } catch {
    return { workDays: [], dailyHours: 0, holidays: [] };
  }
}

export interface SessionSnapshot {
  target: string;
  role: SystemRole;
  platform: boolean;
  user: { id: string; email: string; name: string };
}

function applyMeResponse(me: MeResponse): SessionSnapshot {
  const organizations: Organization[] = (me.memberships ?? [])
    .filter((membership) => membership.status === "ACTIVE")
    .map((membership) => ({
      id: membership.org_id,
      slug: membership.slug,
      name: membership.name,
      ownerId: "",
      timezone: membership.timezone || "UTC",
      workCalendar: parseCalendar(membership.work_calendar),
      createdAt: "",
      plan: "FREE",
      status: "ACTIVE",
    }));

  let activeOrganization = me.organization_id
    ? organizations.find((organization) => organization.id === me.organization_id)
    : undefined;
  if (!activeOrganization && me.organization_id) {
    activeOrganization = {
      id: me.organization_id,
      slug: "",
      name: me.organization_name || "Organization",
      ownerId: "",
      timezone: "UTC",
      workCalendar: { workDays: [], dailyHours: 0, holidays: [] },
      createdAt: "",
      plan: "FREE",
      status: "ACTIVE",
    };
    organizations.unshift(activeOrganization);
  }

  const membership = (me.memberships ?? []).find((item) => item.org_id === activeOrganization?.id);
  const role: SystemRole = toSystemRole(membership?.role_template ?? me.role) ?? "VIEWER";
  const user = {
    id: me.id,
    email: me.email,
    name: me.name || me.email.split("@")[0],
    timezone: activeOrganization?.timezone || "UTC",
    createdAt: "",
    role,
  };

  useAuthStore.getState().hydrate(user, organizations, role);
  if (activeOrganization) useAuthStore.getState().setCurrentOrg(activeOrganization);
  useWorkspaceStore.getState().setOrganizations(organizations);
  if (activeOrganization) useWorkspaceStore.getState().setCurrentOrgId(activeOrganization.id);

  return {
    target: me.target_dashboard_url || getRoleDashboardPath(role, activeOrganization?.id ?? ""),
    role,
    // Platform accounts have a platform role and no organization bound to the session.
    platform: Boolean(me.platform_account) || (!me.organization_id && (me.role === "SUPER_ADMIN" || me.role === "PLATFORM_OPERATOR")),
    user: { id: user.id, email: user.email, name: user.name },
  };
}

/** Refreshes the in-memory identity from the authenticated /v1/me response. */
export async function establishSession(): Promise<SessionSnapshot> {
  return applyMeResponse(await apiClient.me());
}
