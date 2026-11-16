import { create } from "zustand";
import { User, SystemRole, Organization } from "@/types";

const EMPTY_USER: User = {
  id: "",
  email: "",
  name: "",
  timezone: "UTC",
  createdAt: "",
};

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

export function getRoleDashboardPath(role: SystemRole, orgId = ""): string {
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin/dashboard";
    case "PLATFORM_OPERATOR":
      return "/platform-operator/dashboard";
    case "ORGANIZATION_OWNER":
      return `/org/${orgId}/owner/dashboard`;
    case "ORGANIZATION_ADMIN":
      return `/org/${orgId}/admin/dashboard`;
    case "PROJECT_MANAGER":
      return `/org/${orgId}/manager/dashboard`;
    case "TEAM_LEAD":
      return `/org/${orgId}/lead/dashboard`;
    case "DEVELOPER":
      return `/org/${orgId}/developer/dashboard`;
    case "QA_REVIEWER":
      return `/org/${orgId}/reviewer/dashboard`;
    case "VIEWER":
      return `/org/${orgId}/viewer/dashboard`;
    default:
      return `/org/${orgId}/viewer/dashboard`;
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
  switchRole: (role: SystemRole) => void;
  switchOrg: (orgId: string) => void;
  login: (email: string, role?: SystemRole) => void;
  switchRoleAndNavigate: (role: SystemRole, routerPush: (url: string) => void) => void;
  switchUserAndRole: (userId: string, routerPush: (url: string) => void) => void;
  logout: () => void;
  hydrate: (user: User, organizations: Organization[], role: SystemRole) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: EMPTY_USER,
  currentRole: "VIEWER",
  currentOrg: EMPTY_ORG,
  organizations: [],
  activeRole: "ORGANIZATION_OWNER",
  activeOrgId: "",
  isAuthenticated: false,

  setCurrentUser: (user) => set({ currentUser: user }),
  setCurrentRole: (role) => set({ currentRole: role, activeRole: role }),
  setCurrentOrg: (org) => set({ currentOrg: org, activeOrgId: org.id }),

  switchRole: (role) => set({ currentRole: role, activeRole: role }),

  switchOrg: (orgId) => {
    if (get().currentOrg.id === orgId) return;
  },

  login: (_email, role) => set({ currentRole: role || "VIEWER", activeRole: role || "VIEWER", isAuthenticated: true }),

  switchRoleAndNavigate: (role, routerPush) => {
    const { currentOrg } = get();
    set({ currentRole: role, activeRole: role });
    const targetUrl = getRoleDashboardPath(role, currentOrg.id);
    routerPush(targetUrl);
  },

  switchUserAndRole: (userId, routerPush) => {
    if (userId && get().currentOrg.id) routerPush(getRoleDashboardPath(get().currentRole, get().currentOrg.id));
  },

  logout: () => {
    set({ currentUser: EMPTY_USER, currentOrg: EMPTY_ORG, activeOrgId: "", isAuthenticated: false });
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
}));
