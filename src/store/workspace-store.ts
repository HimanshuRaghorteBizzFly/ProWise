import { create } from "zustand";
import { Organization } from "@/types";
import { INITIAL_ORGANIZATIONS } from "@/lib/mock-data";

interface WorkspaceStoreState {
  currentOrg: Organization;
  organizations: Organization[];
  setCurrentOrg: (org: Organization) => void;
  setCurrentOrgId: (orgId: string) => void;
  updateOrganization: (orgId: string, updates: Partial<Organization>) => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set) => ({
  currentOrg: INITIAL_ORGANIZATIONS[0],
  organizations: INITIAL_ORGANIZATIONS,

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
}));

