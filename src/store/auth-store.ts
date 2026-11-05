import { create } from "zustand";
import { User, SystemRole, Organization } from "@/types";
import { SEEDED_USERS, SEEDED_ORGS, SEEDED_MEMBERSHIPS } from "@/lib/mock-data";

export function getRoleDashboardPath(role: SystemRole, orgId: string = "org-1"): string {
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
}

export const useAuthStore = create<AuthState>((set, get) => ({
  currentUser: SEEDED_USERS[2], // Default Sarah Chen (Owner)
  currentRole: "ORGANIZATION_OWNER",
  currentOrg: SEEDED_ORGS[0], // Acme Health Technologies
  activeRole: "ORGANIZATION_OWNER",
  activeOrgId: SEEDED_ORGS[0].id,
  isAuthenticated: true,

  setCurrentUser: (user) => set({ currentUser: user }),
  setCurrentRole: (role) => set({ currentRole: role, activeRole: role }),
  setCurrentOrg: (org) => set({ currentOrg: org, activeOrgId: org.id }),

  switchRole: (role) => set({ currentRole: role, activeRole: role }),

  switchOrg: (orgId) => {
    const found = SEEDED_ORGS.find((o) => o.id === orgId) || SEEDED_ORGS[0];
    set({ currentOrg: found, activeOrgId: found.id });
  },

  login: (email, role) => {
    const user = SEEDED_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase()) || SEEDED_USERS[0];
    const r = role || (user.id === "usr-superadmin" ? "SUPER_ADMIN" : "ORGANIZATION_OWNER");
    set({ currentUser: user, currentRole: r, activeRole: r, isAuthenticated: true });
  },

  switchRoleAndNavigate: (role, routerPush) => {
    const { currentOrg } = get();
    set({ currentRole: role, activeRole: role });
    const targetUrl = getRoleDashboardPath(role, currentOrg.id);
    routerPush(targetUrl);
  },

  switchUserAndRole: (userId, routerPush) => {
    const user = SEEDED_USERS.find((u) => u.id === userId) || SEEDED_USERS[0];
    const membership = SEEDED_MEMBERSHIPS.find((m) => m.userId === user.id);
    let role: SystemRole = "DEVELOPER";

    if (user.id === "usr-superadmin") role = "SUPER_ADMIN";
    else if (user.id === "usr-operator") role = "PLATFORM_OPERATOR";
    else if (membership) role = membership.role;

    const { currentOrg } = get();
    set({ currentUser: user, currentRole: role, activeRole: role });
    const targetUrl = getRoleDashboardPath(role, currentOrg.id);
    routerPush(targetUrl);
  },

  logout: () => {
    set({ isAuthenticated: false });
  },
}));
