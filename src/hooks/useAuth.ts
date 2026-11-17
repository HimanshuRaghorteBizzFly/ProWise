import { useAuthStore } from "@/store/auth-store";
import { SystemRole } from "@/types";
import { apiClient } from "@/lib/api";

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
    orgId: currentOrg.id,
    isAuthenticated,
    login: (email: string, password: string) => apiClient.signin({ email, password }),
    logout: async () => {
      try {
        await apiClient.signout();
      } finally {
        logout();
      }
    },
    switchRole: (role: SystemRole) => setCurrentRole(role),
    switchOrg: (orgId: string) => useAuthStore.getState().switchOrg(orgId),
  };
}

