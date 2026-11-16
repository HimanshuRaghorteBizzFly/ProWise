import { useAuthStore } from "@/store/auth-store";
import { hasPermission, ROLE_PERMISSIONS } from "@/config/permissions";
import { PermissionAction, SystemRole } from "@/types";

export function usePermissions() {
  const { currentRole } = useAuthStore();
  const role: SystemRole = currentRole;

  const can = (action: PermissionAction) => {
    return hasPermission(role, action);
  };

  const permissions = ROLE_PERMISSIONS[role] || [];

  return {
    role,
    permissions,
    can,
  };
}

