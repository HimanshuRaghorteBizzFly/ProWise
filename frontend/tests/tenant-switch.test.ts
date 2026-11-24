import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { canWithGrants, grantsFromPermissionsResponse } from "../src/lib/permissions";
import { apiClient } from "../src/lib/api";
import { clearWorkspaceCaches, pathForWorkspace, registerQueryClient, switchWorkspace } from "../src/lib/workspace-switch";
import { permissionStore } from "../src/store/permission-store";
import { useAuthStore } from "../src/store/auth-store";

describe("T04 · scoped grants from GET /v1/me/permissions", () => {
  it("keeps PROJECT grants bound to their project", () => {
    const { grants, scopeReported } = grantsFromPermissionsResponse({
      permissions: [],
      grants: [
        { key: "task.update", scope: "PROJECT", scope_id: "project-a" },
        { key: "project.read", scope: "PROJECT", scope_id: "project-a" },
        { key: "not.a.real.key", scope: "ORG", scope_id: null },
      ],
    });

    expect(scopeReported).toBe(true);
    expect(grants).toHaveLength(2);
    expect(canWithGrants(grants, "task.update", { projectId: "project-a" })).toBe(true);
    expect(canWithGrants(grants, "task.update", { projectId: "project-b" })).toBe(false);
    expect(canWithGrants(grants, "task.update")).toBe(false);
  });

  it("falls back to ORG-only keys for responses without scope", () => {
    const { grants, scopeReported } = grantsFromPermissionsResponse({ permissions: ["role.manage"] });
    expect(scopeReported).toBe(false);
    expect(grants).toEqual([{ key: "role.manage", scope: "ORG" }]);
  });
});

describe("T06 · switching workspace clears everything from the previous one", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("clears cached server data and effective permissions", async () => {
    const client = new QueryClient();
    registerQueryClient(client);
    client.setQueryData(["roles", "org-a"], [{ id: "secret-role" }]);
    permissionStore.setState({ orgId: "org-a", status: "ready", grants: [{ key: "role.manage", scope: "ORG" }] });

    clearWorkspaceCaches();

    expect(client.getQueryData(["roles", "org-a"])).toBeUndefined();
    expect(permissionStore.getState().status).toBe("idle");
    expect(permissionStore.getState().grants).toEqual([]);
  });

  it("asks the API for an org-bound token, then selects the new workspace", async () => {
    const switchCall = vi.spyOn(apiClient, "switchOrganization").mockResolvedValue({ access_token: "token-b" });
    const result = await switchWorkspace("org-b");

    expect(switchCall).toHaveBeenCalledWith("org-b");
    expect(result).toEqual({ ok: true });
    expect(useAuthStore.getState().currentOrg.id).toBe("org-b");
  });

  it("keeps the current workspace when the API refuses the switch", async () => {
    useAuthStore.getState().setCurrentOrg({ ...useAuthStore.getState().currentOrg, id: "org-a" });
    vi.spyOn(apiClient, "switchOrganization").mockRejectedValue(Object.assign(new Error("not found"), { status: 404 }));

    const result = await switchWorkspace("org-foreign");

    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(useAuthStore.getState().currentOrg.id).toBe("org-a");
  });

  it("opens the same page in the new workspace", () => {
    expect(pathForWorkspace("/org/org-a/owner/roles-permissions", "org-b")).toBe("/org/org-b/owner/roles-permissions");
  });
});
