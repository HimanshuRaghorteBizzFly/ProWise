import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "@/lib/safe-storage";
import { User, SystemRole, Organization } from "@/types";

/** Placeholder until the backend (/v1/me or a sign-in answer) supplies the real person and organization. */
const EMPTY_ORG: Organization = {
  id: "",
  slug: "",
  name: "",
  ownerId: "",
  timezone: "UTC",
  workCalendar: { workDays: [], dailyHours: 0, holidays: [] },
  createdAt: "",
  plan: "FREE",
  status: "ACTIVE",
};

const EMPTY_USER: User = {
  id: "",
  email: "",
  name: "",
  timezone: "UTC",
  createdAt: "",
};

export function getRoleDashboardPath(role: SystemRole, orgId = ""): string {
  const hasOrg = orgId.trim() !== "";
  const workspacePath = hasOrg ? `/org/${orgId}` : "/select-workspace";

  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin/dashboard";

    case "PLATFORM_OPERATOR":
      return "/platform-operator/dashboard";

    case "ORGANIZATION_OWNER":
      return hasOrg ? `${workspacePath}/owner/dashboard` : workspacePath;

    case "ORGANIZATION_ADMIN":
      return hasOrg ? `${workspacePath}/admin/dashboard` : workspacePath;

    case "PROJECT_MANAGER":
      return hasOrg ? `${workspacePath}/manager/dashboard` : workspacePath;

    case "TEAM_LEAD":
      return hasOrg ? `${workspacePath}/lead/dashboard` : workspacePath;

    case "DEVELOPER":
      return hasOrg ? `${workspacePath}/developer/dashboard` : workspacePath;

    case "QA_REVIEWER":
      return hasOrg ? `${workspacePath}/reviewer/dashboard` : workspacePath;

    case "VIEWER":
      return hasOrg ? `${workspacePath}/viewer/dashboard` : workspacePath;

    default:
      return workspacePath;
  }
}

interface AuthState {
  currentUser: User;
  currentRole: SystemRole;
  currentOrg: Organization;
  organizations: Organization[];
  activeRole: SystemRole;
  activeOrgId: string;
  isAuthenticated: boolean;
  setCurrentUser: (user: User) => void;
  setCurrentRole: (role: SystemRole) => void;
  setCurrentOrg: (org: Organization) => void;
  switchOrg: (orgId: string) => void;
  login: (email: string, role?: SystemRole) => void;
  logout: () => void;
  hydrate: (user: User, organizations: Organization[], role: SystemRole) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: EMPTY_USER,
      currentRole: "VIEWER",
      currentOrg: EMPTY_ORG,
      organizations: [],
      activeRole: "VIEWER",
      activeOrgId: "",
      isAuthenticated: false,

      setCurrentUser: (user) => set({ currentUser: user }),
      setCurrentRole: (role) => set({ currentRole: role, activeRole: role }),
      setCurrentOrg: (org) => set({ currentOrg: org, activeOrgId: org.id }),

      switchOrg: (orgId) => {
        if (get().currentOrg.id === orgId) return;
        const next = get().organizations.find((org) => org.id === orgId);
        if (next) set({ currentOrg: next, activeOrgId: next.id });
      },

      login: (email, role) => {
        const targetRole = role || "VIEWER";
        set((state) => ({
          currentRole: targetRole,
          activeRole: targetRole,
          isAuthenticated: true,
          currentUser: {
            ...state.currentUser,
            email: email || state.currentUser.email,
            name: state.currentUser.name || (email ? email.split("@")[0] : state.currentUser.name),
          },
        }));
      },

      logout: () => {
        set({
          currentUser: EMPTY_USER,
          currentRole: "VIEWER",
          activeRole: "VIEWER",
          currentOrg: EMPTY_ORG,
          organizations: [],
          activeOrgId: "",
          isAuthenticated: false,
        });
      },

      hydrate: (user, organizations, role) => {
        const organization = organizations[0] || EMPTY_ORG;
        set({
          currentUser: user,
          currentOrg: organization,
          organizations,
          currentRole: role,
          activeRole: role,
          activeOrgId: organization.id,
          isAuthenticated: true,
        });
      },
    }),
    {
      name: "prowise-auth-store",
      // Version 2 discards state persisted by older builds (which could hold sample personas); the backend re-supplies it.
      version: 2,
      migrate: () => ({}) as AuthState,
      storage: safeJSONStorage,
      skipHydration: true,
    }
  )
);
