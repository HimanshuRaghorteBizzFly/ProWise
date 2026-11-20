import { describe, expect, it, vi } from "vitest";

import { getRoleDashboardPath, useAuthStore } from "../src/store/auth-store";

describe("role dashboard paths", () => {
  it("sends tenant roles to workspace selection when no organization is active", () => {
    expect(getRoleDashboardPath("ORGANIZATION_OWNER")).toBe("/select-workspace");
    expect(getRoleDashboardPath("DEVELOPER")).toBe("/select-workspace");
  });

  it("keeps an active organization in tenant dashboard paths", () => {
    expect(getRoleDashboardPath("ORGANIZATION_OWNER", "org-acme")).toBe(
      "/org/org-acme/owner/dashboard",
    );
  });

  it("leaves platform dashboard paths independent of an organization", () => {
    expect(getRoleDashboardPath("SUPER_ADMIN")).toBe("/super-admin/dashboard");
    expect(getRoleDashboardPath("PLATFORM_OPERATOR")).toBe("/platform-operator/dashboard");
  });

  it("switches role dashboards in development preview without requiring another login", () => {
    const initialState = useAuthStore.getState();
    useAuthStore.setState({
      currentOrg: { ...initialState.currentOrg, id: "org-acme" },
      isRolePreview: false,
    });
    const navigate = vi.fn();

    useAuthStore.getState().switchRoleAndNavigate("ORGANIZATION_OWNER", navigate);

    expect(useAuthStore.getState().currentRole).toBe("ORGANIZATION_OWNER");
    expect(useAuthStore.getState().isRolePreview).toBe(true);
    expect(navigate).toHaveBeenCalledWith("/org/org-acme/owner/dashboard");

    useAuthStore.setState(initialState);
  });
});
