import { create } from "zustand";
import { persist } from "zustand/middleware";
import { safeJSONStorage } from "@/lib/safe-storage";
import { User, SystemRole, Organization } from "@/types";
import { previewEnabled } from "@/lib/permissions";

<<<<<<< HEAD
const SAMPLE_ORG: Organization = {
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

const SAMPLE_USER: User = {
  id: "usr-viewer",
  email: "jordan.lee@acmehealth.com",
  name: "Jordan Lee (Viewer)",
  timezone: "America/New_York",
  createdAt: "2026-02-25T16:00:00Z",
};

/** Until GET /v1/me answers there is no organization and no user: never a demo company or person. */
const BLANK_ORG: Organization = {
  id: "", slug: "", name: "", ownerId: "", timezone: "",
  workCalendar: { workDays: [], dailyHours: 0, holidays: [] }, createdAt: "", plan: "FREE", status: "ACTIVE",
};
const BLANK_USER: User = { id: "", email: "", name: "", timezone: "", createdAt: "" };

// The sample identity exists only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true, never in production).
const DEFAULT_ORG: Organization = previewEnabled() ? SAMPLE_ORG : BLANK_ORG;
const DEFAULT_USER: User = previewEnabled() ? SAMPLE_USER : BLANK_USER;

const EMPTY_USER: User = DEFAULT_USER;
const EMPTY_ORG: Organization = DEFAULT_ORG;

export const ROLE_PERSONAS: Record<SystemRole, User> = {
  SUPER_ADMIN: {
    id: "00000000-0000-0000-0000-000000000001",
    email: "superadmin@prowise.com",
    name: "Super Admin",
    timezone: "America/New_York",
    createdAt: "2026-01-01T00:00:00Z",
  },
  PLATFORM_OPERATOR: {
    id: "00000000-0000-0000-0000-000000000002",
    email: "operator@prowise.io",
    name: "Platform Operator",
    timezone: "America/New_York",
    createdAt: "2026-01-01T00:00:00Z",
  },
  ORGANIZATION_OWNER: {
    id: "usr-owner",
    email: "dr.sarah.lin@acmehealth.com",
    name: "Dr. Sarah Lin",
    timezone: "America/New_York",
    createdAt: "2026-02-01T00:00:00Z",
  },
  ORGANIZATION_ADMIN: {
    id: "usr-admin",
    email: "david.kim@acmehealth.com",
    name: "David Kim",
    timezone: "America/New_York",
    createdAt: "2026-02-01T00:00:00Z",
  },
  PROJECT_MANAGER: {
    id: "usr-manager",
    email: "priya.raman@acmehealth.com",
    name: "Priya Raman",
    timezone: "America/New_York",
    createdAt: "2026-02-01T00:00:00Z",
  },
  TEAM_LEAD: {
    id: "usr-lead",
    email: "marcus.chen@acmehealth.com",
    name: "Marcus Chen",
    timezone: "America/New_York",
    createdAt: "2026-02-01T00:00:00Z",
  },
  DEVELOPER: {
    id: "00000000-0000-0000-0000-000000000003",
    email: "alex.rivera@acmehealth.com",
    name: "Alex Rivera",
    timezone: "America/New_York",
    createdAt: "2026-02-01T00:00:00Z",
  },
  QA_REVIEWER: {
    id: "usr-qa",
    email: "elena.ruiz@acmehealth.com",
    name: "Elena Ruiz",
    timezone: "America/New_York",
    createdAt: "2026-02-01T00:00:00Z",
  },
  VIEWER: {
    id: "usr-viewer",
    email: "jordan.lee@acmehealth.com",
    name: "Jordan Lee",
    timezone: "America/New_York",
    createdAt: "2026-02-01T00:00:00Z",
  },
=======
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
>>>>>>> 29db595 (Initial ProWise project upload)
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
<<<<<<< HEAD
  isRolePreview: boolean;
  /**
   * "checking" until the server session (GET /v1/me) is known. Gates wait for it instead of judging the
   * default fixture identity; "anonymous" means there is no valid session.
   */
  sessionStatus: SessionStatus;
  setSessionStatus: (status: SessionStatus) => void;
=======
>>>>>>> 29db595 (Initial ProWise project upload)
  setCurrentUser: (user: User) => void;
  setCurrentRole: (role: SystemRole) => void;
  setCurrentOrg: (org: Organization) => void;
  switchOrg: (orgId: string) => void;
  login: (email: string, role?: SystemRole) => void;
  logout: () => void;
  /** activeOrgId: the organization the session is bound to ("" = none selected). Defaults to the first one. */
  hydrate: (user: User, organizations: Organization[], role: SystemRole, activeOrgId?: string) => void;
}

export type SessionStatus = "checking" | "authenticated" | "anonymous";

/** No organization selected: gates show "select a workspace" rather than judging a fixture organization. */
export const NO_ORG: Organization = { ...DEFAULT_ORG, id: "", slug: "", name: "", ownerId: "" };

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
<<<<<<< HEAD
      isRolePreview: false,
      sessionStatus: "checking",
=======
>>>>>>> 29db595 (Initial ProWise project upload)

      setSessionStatus: (status) => set({ sessionStatus: status }),
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
<<<<<<< HEAD
          sessionStatus: "anonymous",
          currentUser: DEFAULT_USER,
          currentOrg: DEFAULT_ORG,
          activeOrgId: DEFAULT_ORG.id,
=======
          currentUser: EMPTY_USER,
          currentRole: "VIEWER",
          activeRole: "VIEWER",
          currentOrg: EMPTY_ORG,
          organizations: [],
          activeOrgId: "",
>>>>>>> 29db595 (Initial ProWise project upload)
          isAuthenticated: false,
        });
      },

      hydrate: (user, organizations, role, activeOrgId) => {
        const organization = activeOrgId === undefined
          ? organizations[0] || EMPTY_ORG
          : organizations.find((org) => org.id === activeOrgId) || NO_ORG;
        set({
          sessionStatus: "authenticated",
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
