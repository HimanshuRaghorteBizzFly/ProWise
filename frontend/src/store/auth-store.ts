import { create } from "zustand";
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
  const workspacePath = orgId ? `/org/${orgId}` : "/select-workspace";
  switch (role) {
    case "SUPER_ADMIN":
      return "/super-admin/dashboard";
    case "PLATFORM_OPERATOR":
      return "/platform-operator/dashboard";
    case "ORGANIZATION_OWNER":
      return orgId ? `${workspacePath}/owner/dashboard` : workspacePath;
    case "ORGANIZATION_ADMIN":
      return orgId ? `${workspacePath}/admin/dashboard` : workspacePath;
    case "PROJECT_MANAGER":
      return orgId ? `${workspacePath}/manager/dashboard` : workspacePath;
    case "TEAM_LEAD":
      return orgId ? `${workspacePath}/lead/dashboard` : workspacePath;
    case "DEVELOPER":
      return orgId ? `${workspacePath}/developer/dashboard` : workspacePath;
    case "QA_REVIEWER":
      return orgId ? `${workspacePath}/reviewer/dashboard` : workspacePath;
    case "VIEWER":
      return orgId ? `${workspacePath}/viewer/dashboard` : workspacePath;
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
    const safeOrgId = currentOrg?.id && currentOrg.id.trim() !== "" ? currentOrg.id : "org-acme";
    set({ currentRole: role, activeRole: role });
    const targetUrl = getRoleDashboardPath(role, safeOrgId);
    routerPush(targetUrl);
  },

  switchUserAndRole: (userId, routerPush) => {
    const { currentOrg, currentRole } = get();
    const safeOrgId = currentOrg?.id && currentOrg.id.trim() !== "" ? currentOrg.id : "org-acme";
    routerPush(getRoleDashboardPath(currentRole, safeOrgId));
  },

  logout: () => {
    set({ currentUser: DEFAULT_USER, currentOrg: DEFAULT_ORG, activeOrgId: "org-acme", isAuthenticated: false });
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
