import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useWorkspaceStore } from "@/store/workspace-store";
import { useAuthStore } from "@/store/auth-store";
import { pathForWorkspace, switchWorkspace } from "@/lib/workspace-switch";

export function useOrganization() {
  const { currentOrg, organizations, setCurrentOrg, updateOrganization } = useWorkspaceStore();
  const authOrgId = useAuthStore((state) => state.currentOrg.id);
  const router = useRouter();
  const pathname = usePathname() || "";
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);

  /**
   * Switches workspace through the API (org-bound token, old session revoked), clears every cached
   * view of the previous workspace, then opens the same page in the new one.
   */
  const handleSwitchOrg = useCallback(
    async (orgId: string) => {
      if (!orgId || orgId === authOrgId) return;
      setSwitching(true);
      setSwitchError(null);
      const result = await switchWorkspace(orgId);
      setSwitching(false);
      if (!result.ok) {
        setSwitchError(result.message);
        return;
      }
      router.push(pathname.startsWith("/org/") ? pathForWorkspace(pathname, orgId) : `/org/${encodeURIComponent(orgId)}`);
    },
    [authOrgId, pathname, router],
  );

  return {
    organization: currentOrg,
    organizations,
    activeOrgId: authOrgId,
    setCurrentOrg,
    switchOrg: handleSwitchOrg,
    switching,
    switchError,
    updateOrganization,
  };
}
