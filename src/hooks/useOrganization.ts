import { useWorkspaceStore } from "@/store/workspace-store";
import { useAuthStore } from "@/store/auth-store";

export function useOrganization() {
  const { currentOrg, organizations, setCurrentOrg, setCurrentOrgId, updateOrganization } = useWorkspaceStore();
  const { currentOrg: authOrg, setCurrentOrg: setAuthOrg } = useAuthStore();

  const handleSwitchOrg = (orgId: string) => {
    setCurrentOrgId(orgId);
    const found = organizations.find((o) => o.id === orgId);
    if (found) setAuthOrg(found);
  };

  return {
    organization: currentOrg,
    organizations,
    activeOrgId: authOrg?.id || "org-1",
    setCurrentOrg,
    switchOrg: handleSwitchOrg,
    updateOrganization,
  };
}

