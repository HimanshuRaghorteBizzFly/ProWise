import { describe, expect, it } from "vitest";

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


  it("starts signed out with no invented person or organization", () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.currentUser.email).toBe("");
    expect(state.currentOrg.id).toBe("");
    expect(state.organizations).toEqual([]);
  });
});
