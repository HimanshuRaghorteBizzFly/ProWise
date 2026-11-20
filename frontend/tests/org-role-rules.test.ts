import { beforeEach, describe, expect, it } from "vitest";

import { ROLES } from "../src/mocks/org-console";
import { canEditRole, roleLock, toggleLockReason, validatePermissionChange } from "../src/components/org-console/role-rules";
import { useOrgConsoleStore } from "../src/store/org-console-store";

const role = (id: string) => ROLES.find((r) => r.id === id)!;
const initial = useOrgConsoleStore.getState();

describe("role ladder rules", () => {
  beforeEach(() => useOrgConsoleStore.setState(initial, true));

  it("keeps the Owner role read-only for everyone", () => {
    expect(canEditRole("owner", role("role-owner")).ok).toBe(false);
    expect(roleLock("admin", role("role-owner"))?.label).toBe("Above your authority");
  });

  it("lets only the owner edit the Organization Admin role", () => {
    expect(canEditRole("owner", role("role-admin")).ok).toBe(true);
    expect(roleLock("admin", role("role-admin"))?.label).toBe("Owner only");
  });

  it("lets admins edit roles below Admin, but only with permissions they hold", () => {
    const dev = role("role-developer");
    expect(canEditRole("admin", dev).ok).toBe(true);
    expect(toggleLockReason("admin", dev, "repo.connect")).toBeUndefined();
    expect(toggleLockReason("admin", dev, "project.create")).toBe("You don't hold this permission");
    expect(validatePermissionChange("admin", dev, dev.permissions, [...dev.permissions, "project.create"]).ok).toBe(false);
  });

  it("never delegates owner-only permissions, even for the owner", () => {
    const pm = role("role-pm");
    expect(validatePermissionChange("owner", pm, pm.permissions, [...pm.permissions, "org.manage"]).ok).toBe(false);
  });
});

describe("store enforcement (manipulated form submissions)", () => {
  beforeEach(() => useOrgConsoleStore.setState(initial, true));

  it("rejects an admin editing the Admin role", () => {
    const v = useOrgConsoleStore.getState().updateRolePermissions("admin", "role-admin", ["audit.read"], "x");
    expect(v.ok).toBe(false);
    expect(useOrgConsoleStore.getState().roles.find((r) => r.id === "role-admin")?.permissions).toEqual(role("role-admin").permissions);
  });

  it("rejects an admin granting a permission they do not hold", () => {
    const dev = role("role-developer");
    const v = useOrgConsoleStore.getState().updateRolePermissions("admin", dev.id, [...dev.permissions, "project.archive"], "x");
    expect(v.ok).toBe(false);
  });

  it("rejects an admin removing a permission they do not hold from a lower role", () => {
    const pm = role("role-pm");
    const v = useOrgConsoleStore.getState().updateRolePermissions("admin", pm.id, pm.permissions.filter((p) => p !== "project.create"), "x");
    expect(v.ok).toBe(false);
  });

  it("accepts an admin change within their powers and records history", () => {
    const dev = role("role-developer");
    const v = useOrgConsoleStore.getState().updateRolePermissions("admin", dev.id, [...dev.permissions, "repo.connect"], "Grant repo connect");
    expect(v.ok).toBe(true);
    const state = useOrgConsoleStore.getState();
    expect(state.roles.find((r) => r.id === dev.id)?.permissions).toContain("repo.connect");
    expect(state.roleHistory[0]).toMatchObject({ roleId: dev.id, added: ["repo.connect"], removed: [] });
  });

  it("rejects an admin creating a role with permissions above their own", () => {
    const v = useOrgConsoleStore.getState().createRole("admin", { name: "Shadow PM", description: "", basedOnId: null, permissions: ["project.create"] });
    expect(v.ok).toBe(false);
  });

  it("lets the owner create a role below Admin", () => {
    const v = useOrgConsoleStore.getState().createRole("owner", { name: "Release Manager", description: "", basedOnId: "role-pm", permissions: ["project.read", "project.archive"] });
    expect(v.ok).toBe(true);
    expect(useOrgConsoleStore.getState().roles.find((r) => r.id === v.id)?.tier).toBe(2);
  });
});
