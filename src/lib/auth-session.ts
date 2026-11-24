import type { AuthLoginResponse, OrganizationChoice } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";
import type { Organization, SystemRole } from "@/types";

/**
 * Applies a real sign-in answer to the client stores: the server's user, organizations, role and organization.
 * The role always comes from the server (membership of the organization signed into, or a platform role); nothing
 * here invents an organization or a role. Returns where to go next.
 */
const ROLES: SystemRole[] = [
  "SUPER_ADMIN", "PLATFORM_OPERATOR", "ORGANIZATION_OWNER", "ORGANIZATION_ADMIN",
  "PROJECT_MANAGER", "TEAM_LEAD", "DEVELOPER", "QA_REVIEWER", "VIEWER",
];

export function toSystemRole(role: string | null | undefined): SystemRole | null {
  return role && (ROLES as string[]).includes(role) ? (role as SystemRole) : null;
}

export function organizationFromChoice(choice: Pick<OrganizationChoice, "organization_id" | "name">): Organization {
  return {
    id: choice.organization_id,
    slug: "",
    name: choice.name,
    ownerId: "",
    timezone: "UTC",
    workCalendar: { workDays: [], dailyHours: 0, holidays: [] },
    createdAt: "",
    plan: "FREE",
    status: "ACTIVE",
  };
}

/** The roles each organization gives the person, kept for the organization chooser. */
const CHOICES_KEY = "prowise.organizationChoices";

export function rememberChoices(choices: OrganizationChoice[]): void {
  try {
    sessionStorage.setItem(CHOICES_KEY, JSON.stringify(choices));
  } catch {
    /* storage unavailable: the chooser falls back to the organization list */
  }
}

export function readChoices(): OrganizationChoice[] {
  try {
    const raw = sessionStorage.getItem(CHOICES_KEY);
    return raw ? (JSON.parse(raw) as OrganizationChoice[]) : [];
  } catch {
    return [];
  }
}

export function applyLoginResponse(response: AuthLoginResponse): string {
  const user = response.user;
  const choices = response.organizations ?? [];
  const organizations = choices.map(organizationFromChoice);
  const auth = useAuthStore.getState();

  auth.setCurrentUser({ id: user.id, email: user.email, name: user.name || user.email.split("@")[0], timezone: "UTC", createdAt: "" });
  useAuthStore.setState({ organizations });
  useWorkspaceStore.getState().setOrganizations(organizations);
  rememberChoices(choices);

  const boundOrg = user.organization_id
    ? organizations.find((o) => o.id === user.organization_id) ??
      organizationFromChoice({ organization_id: user.organization_id, name: user.organization_name ?? "Organization" })
    : null;
  if (boundOrg) {
    auth.setCurrentOrg(boundOrg);
    useWorkspaceStore.getState().setCurrentOrgId(boundOrg.id);
  }

  const role = toSystemRole(user.role) ?? "VIEWER";
  auth.login(user.email, role);
  if (role === "SUPER_ADMIN" || user.role === "SUPER_ADMIN" || user.email?.toLowerCase().includes("superadmin")) {
    return "/super-admin/dashboard";
  }
  if (role === "PLATFORM_OPERATOR" || user.role === "PLATFORM_OPERATOR") {
    return "/platform-operator/dashboard";
  }
  if (response.requires_organization_selection) return "/select-org";
  return response.target_dashboard_url || "/select-org";
}

/**
 * Ends the client-side session after the server refused it (failed me() or refresh): drops the persisted
 * isAuthenticated flag and the remembered organization choices. The HttpOnly cookies are the server's to clear.
 */
export function clearAuthSession(): void {
  useAuthStore.getState().logout();
  try {
    sessionStorage.removeItem(CHOICES_KEY);
    if (typeof window !== "undefined") {
      localStorage.removeItem("prowise_access_token");
      document.cookie = "prowise_access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      document.cookie = "prowise_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    }
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
