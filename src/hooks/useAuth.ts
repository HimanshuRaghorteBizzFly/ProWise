import { useAuthStore } from "@/store/auth-store";
import { SystemRole } from "@/types";

export function useAuth() {
  const {
    currentUser,
    currentRole,
    currentOrg,
    isAuthenticated,
    setCurrentRole,
    logout,
  } = useAuthStore();

  return {
    user: currentUser,
    role: currentRole,
    orgId: currentOrg?.id || "org-1",
    isAuthenticated,
    login: (email: string) => {},
    logout,
    switchRole: (role: SystemRole) => setCurrentRole(role),
    switchOrg: (orgId: string) => {},
  };
}

