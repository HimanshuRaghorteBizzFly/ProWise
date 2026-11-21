import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User, SystemRole, Organization } from "@/types";

const DEFAULT_ORG: Organization = {
  id: "org-acme",
  slug: "acme-health",
  name: "Acme Health Technologies",
  ownerId: "usr-owner",
  timezone: "America/New_York",
  workCalendar: { workDays: [1, 2, 3, 4, 5], dailyHours: 8, holidays: [] },
  createdAt: "2026-02-15T09:00:00Z",
  plan: "ENTERPRISE",
  status: "ACTIVE",
};

const DEFAULT_USER: User = {
  id: "usr-viewer",
  email: "jordan.lee@acmehealth.com",
  name: "Jordan Lee (Viewer)",
  timezone: "America/New_York",
  createdAt: "2026-02-25T16:00:00Z",
};

const EMPTY_USER: User = DEFAULT_USER;
const EMPTY_ORG: Organization = DEFAULT_ORG;

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
  isRolePreview: boolean;
  setCurrentUser: (user: User) => void;
  setCurrentRole: (role: SystemRole) => void;
  setCurrentOrg: (org: Organization) => void;
  switchRole: (role: SystemRole) => void;
  switchOrg: (orgId: string) => void;
  login: (email: string, role?: SystemRole) => void;
  switchRoleAndNavigate: (role: SystemRole, routerPush: (url: string) => void) => void;
  switchUserAndRole: (userId: string, routerPush: (url: string) => void) => void;
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
      activeRole: "ORGANIZATION_OWNER",
      activeOrgId: "",
      isAuthenticated: false,
      isRolePreview: false,

      setCurrentUser: (user) => set({ currentUser: user }),
      setCurrentRole: (role) => set({ currentRole: role, activeRole: role }),
      setCurrentOrg: (org) => set({ currentOrg: org, activeOrgId: org.id }),

      switchRole: (role) =>
        set({
          currentRole: role,
          activeRole: role,
          isRolePreview: process.env.NODE_ENV !== "production",
        }),

      switchOrg: (orgId) => {
        if (get().currentOrg.id === orgId) return;
      },

      login: (email, role) => {
        const targetRole = role || "VIEWER";
        set((state) => ({
          currentRole: targetRole,
          activeRole: targetRole,
          isAuthenticated: true,
          isRolePreview: false,
          currentUser: {
            ...state.currentUser,
            email: email || state.currentUser.email,
            name: state.currentUser.name || (email ? email.split("@")[0] : state.currentUser.name),
          },
        }));
      },

      switchRoleAndNavigate: (role, routerPush) => {
        const { currentOrg } = get();
        const safeOrgId = currentOrg?.id && currentOrg.id.trim() !== "" ? currentOrg.id : "org-acme";
        set({
          currentRole: role,
          activeRole: role,
          isRolePreview: process.env.NODE_ENV !== "production",
        });
        const targetUrl = getRoleDashboardPath(role, safeOrgId);
        routerPush(targetUrl);
      },

      switchUserAndRole: (userId, routerPush) => {
        const { currentOrg, currentRole } = get();
        const safeOrgId = currentOrg?.id && currentOrg.id.trim() !== "" ? currentOrg.id : "org-acme";
        routerPush(getRoleDashboardPath(currentRole, safeOrgId));
      },

      logout: () => {
        set({
          currentUser: DEFAULT_USER,
          currentOrg: DEFAULT_ORG,
          activeOrgId: "org-acme",
          isAuthenticated: false,
          isRolePreview: false,
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
          isRolePreview: false,
        });
      },
    }),
    {
      name: "prowise-auth-store",
    }
  )
);
