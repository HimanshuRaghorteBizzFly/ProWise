import { create } from "zustand";
import { Organization } from "@/types";

const EMPTY_ORGANIZATION: Organization = {
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

interface WorkspaceStoreState {
  currentOrg: Organization;
  organizations: Organization[];
  setCurrentOrg: (org: Organization) => void;
  setCurrentOrgId: (orgId: string) => void;
  updateOrganization: (orgId: string, updates: Partial<Organization>) => void;
  setOrganizations: (organizations: Organization[]) => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  currentOrg: EMPTY_ORGANIZATION,
  organizations: [],

  setCurrentOrg: (org) => set({ currentOrg: org }),

  setCurrentOrgId: (orgId) =>
    set((state) => {
      const found = state.organizations.find((o) => o.id === orgId);
      return found ? { currentOrg: found } : state;
    }),

  updateOrganization: (orgId, updates) =>
    set((state) => {
      const orgs = state.organizations.map((o) =>
        o.id === orgId ? { ...o, ...updates } : o
      );
      const current = state.currentOrg.id === orgId ? { ...state.currentOrg, ...updates } : state.currentOrg;
      return { organizations: orgs, currentOrg: current };
    }),
  setOrganizations: (organizations) =>
    set({ organizations, currentOrg: organizations[0] || EMPTY_ORGANIZATION }),
}));

