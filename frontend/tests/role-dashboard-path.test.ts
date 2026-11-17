import { describe, expect, it } from "vitest";

import { getRoleDashboardPath } from "../src/store/auth-store";

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
});
