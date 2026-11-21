import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../src/lib/api";
import {
  PERMISSION_KEYS,
  canAnyWithGrants,
  canWithGrants,
  grantsFromApi,
  mocksAllowed,
} from "../src/lib/permissions";
import { FIXTURE_GRANTS } from "../src/lib/fixtures/permissions";
import { createPermissionStore } from "../src/store/permission-store";
import type { PermissionGrant } from "../src/types/permission";

const ORG_A = "11111111-1111-1111-1111-111111111111";

describe("permission keys", () => {
  it("lists exactly the 23 documented dot-keys", () => {
    expect(PERMISSION_KEYS).toHaveLength(23);
    expect(PERMISSION_KEYS.every((key) => /^[a-z]+(\.[a-z]+)+$/.test(key))).toBe(true);
    expect(PERMISSION_KEYS).toContain("org.manage");
    expect(PERMISSION_KEYS).not.toContain("org:update" as never);
  });
});

describe("grantsFromApi", () => {
  it("maps API keys to ORG scope and drops unknown keys", () => {
    const grants = grantsFromApi(["project.read", "billing.manage", "audit.read"]);
    expect(grants).toEqual([
      { key: "project.read", scope: "ORG" },
      { key: "audit.read", scope: "ORG" },
    ]);
  });
});

describe("canWithGrants", () => {
  const grants: PermissionGrant[] = [
    { key: "project.read", scope: "ORG" },
    { key: "task.update", scope: "PROJECT", scopeId: "proj-a" },
  ];

  it("allows an ORG grant with or without a project target", () => {
    expect(canWithGrants(grants, "project.read")).toBe(true);
    expect(canWithGrants(grants, "project.read", { projectId: "proj-z" })).toBe(true);
  });

  it("does not treat a PROJECT grant as org-wide", () => {
    expect(canWithGrants(grants, "task.update")).toBe(false);
  });

  it("allows a PROJECT grant only on its own project", () => {
    expect(canWithGrants(grants, "task.update", { projectId: "proj-a" })).toBe(true);
    expect(canWithGrants(grants, "task.update", { projectId: "proj-b" })).toBe(false);
  });

  it("denies keys that are not granted and supports canAny", () => {
    expect(canWithGrants(grants, "org.manage")).toBe(false);
    expect(canAnyWithGrants(grants, ["org.manage", "project.read"])).toBe(true);
    expect(canAnyWithGrants(grants, ["org.manage", "member.invite"])).toBe(false);
    expect(canAnyWithGrants(grants, [])).toBe(false);
  });
});

describe("fixture grants follow the permission matrix", () => {
  const orgKeys = (role: keyof typeof FIXTURE_GRANTS) =>
    FIXTURE_GRANTS[role].filter((grant) => grant.scope === "ORG").map((grant) => grant.key).sort();

  it("gives the owner every key except progress override and check-in approval (Team Lead only)", () => {
    expect(orgKeys("ORGANIZATION_OWNER")).toEqual(
      PERMISSION_KEYS.filter((key) => key !== "project.progress.override" && key !== "project.progress.verify").slice().sort(),
    );
  });

  it("gives the admin only the ten documented keys", () => {
    expect(orgKeys("ORGANIZATION_ADMIN")).toEqual(
      [
        "audit.read",
        "member.disable",
        "member.invite",
        "project.create",
        "project.read",
        "report.export",
        "repo.connect",
        "repo.read",
        "role.manage",
        "team.manage",
      ].sort(),
    );
  });

  it("never grants progress override and never grants platform roles tenant keys", () => {
    for (const grants of Object.values(FIXTURE_GRANTS)) {
      expect(grants.some((grant) => grant.key === "project.progress.override")).toBe(false);
    }
    expect(FIXTURE_GRANTS.PLATFORM_OPERATOR).toEqual([]);
    expect(FIXTURE_GRANTS.SUPER_ADMIN).toEqual([]);
  });

  it("scopes conditional grants to projects, not the organization", () => {
    const developer = FIXTURE_GRANTS.DEVELOPER;
    expect(developer.length).toBeGreaterThan(0);
    expect(developer.every((grant) => grant.scope === "PROJECT")).toBe(true);
  });
});

describe("mocksAllowed", () => {
  it("is never true in a production build", () => {
    expect(mocksAllowed({ nodeEnv: "production", useMocks: "true" })).toBe(false);
    expect(mocksAllowed({ nodeEnv: "production", useMocks: undefined })).toBe(false);
  });

  it("is allowed outside production", () => {
    expect(mocksAllowed({ nodeEnv: "development", useMocks: undefined })).toBe(true);
    expect(mocksAllowed({ nodeEnv: "test", useMocks: "true" })).toBe(true);
  });
});

describe("permission store", () => {
  const apiOk = (keys: string[]) => vi.fn().mockResolvedValue({ organizationId: ORG_A, permissions: keys });
  const apiFail = (error: unknown) => vi.fn().mockRejectedValue(error);
  const devEnv = { nodeEnv: "development", useMocks: undefined } as const;

  let fetchPermissions: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchPermissions = apiOk(["org.manage", "project.read"]);
  });

  it("loads ORG grants from the API and reports that scope is not provided", async () => {
    const store = createPermissionStore({ fetchPermissions, env: devEnv });
    await store.getState().load(ORG_A, "ORGANIZATION_OWNER");

    const state = store.getState();
    expect(fetchPermissions).toHaveBeenCalledWith(ORG_A);
    expect(state.status).toBe("ready");
    expect(state.source).toBe("api");
    expect(state.scopeReported).toBe(false);
    expect(state.grants).toEqual([
      { key: "org.manage", scope: "ORG" },
      { key: "project.read", scope: "ORG" },
    ]);
  });

  it("uses the fixture without calling the API when NEXT_PUBLIC_USE_MOCKS=true", async () => {
    const store = createPermissionStore({ fetchPermissions, env: { nodeEnv: "development", useMocks: "true" } });
    await store.getState().load(ORG_A, "ORGANIZATION_ADMIN");

    expect(fetchPermissions).not.toHaveBeenCalled();
    expect(store.getState().source).toBe("fixture");
    expect(store.getState().scopeReported).toBe(true);
    expect(store.getState().grants).toEqual(FIXTURE_GRANTS.ORGANIZATION_ADMIN);
  });

  it("uses role fixtures without calling the API in role preview mode", async () => {
    const store = createPermissionStore({ fetchPermissions, env: devEnv });
    await store.getState().load(ORG_A, "ORGANIZATION_OWNER", { preview: true });

    expect(fetchPermissions).not.toHaveBeenCalled();
    expect(store.getState().source).toBe("fixture");
    expect(store.getState().grants).toEqual(FIXTURE_GRANTS.ORGANIZATION_OWNER);
  });

  it("does not allow role preview fixtures in production", async () => {
    const store = createPermissionStore({
      fetchPermissions,
      env: { nodeEnv: "production", useMocks: undefined },
    });
    await store.getState().load(ORG_A, "ORGANIZATION_OWNER", { preview: true });

    expect(fetchPermissions).toHaveBeenCalledWith(ORG_A);
    expect(store.getState().source).toBe("api");
  });

  it("falls back to the fixture only when the API is unreachable", async () => {
    const store = createPermissionStore({
      fetchPermissions: apiFail(new ApiError(0, "NETWORK_ERROR", "offline", "")),
      env: devEnv,
    });
    await store.getState().load(ORG_A, "ORGANIZATION_OWNER");

    expect(store.getState().status).toBe("ready");
    expect(store.getState().source).toBe("fixture");
  });

  it("never uses the fixture in production, even when the API is unreachable", async () => {
    const store = createPermissionStore({
      fetchPermissions: apiFail(new ApiError(0, "NETWORK_ERROR", "offline", "")),
      env: { nodeEnv: "production", useMocks: "true" },
    });
    await store.getState().load(ORG_A, "ORGANIZATION_OWNER");

    expect(store.getState().status).toBe("error");
    expect(store.getState().grants).toEqual([]);
  });

  it.each([502, 503, 504])("treats proxy %s as unreachable in development and uses the fixture", async (status) => {
    const store = createPermissionStore({
      fetchPermissions: apiFail(new ApiError(status, `HTTP_${status}`, "bad gateway", "")),
      env: devEnv,
    });
    await store.getState().load(ORG_A, "ORGANIZATION_ADMIN");

    expect(store.getState().status).toBe("ready");
    expect(store.getState().source).toBe("fixture");
    expect(store.getState().grants).toEqual(FIXTURE_GRANTS.ORGANIZATION_ADMIN);
  });

  it.each([502, 503, 504])("never uses the fixture for proxy %s in production", async (status) => {
    const store = createPermissionStore({
      fetchPermissions: apiFail(new ApiError(status, `HTTP_${status}`, "bad gateway", "")),
      env: { nodeEnv: "production", useMocks: "true" },
    });
    await store.getState().load(ORG_A, "ORGANIZATION_OWNER");

    expect(store.getState().status).toBe("error");
    expect(store.getState().source).toBeNull();
    expect(store.getState().grants).toEqual([]);
  });

  it.each([
    [401, "unauthenticated"],
    [403, "access-lost"],
    [404, "access-lost"],
    [500, "error"],
  ] as const)("maps HTTP %s to %s with no grants and no fixture", async (status, expected) => {
    const store = createPermissionStore({
      fetchPermissions: apiFail(new ApiError(status, "X", "denied", "req")),
      env: devEnv,
    });
    await store.getState().load(ORG_A, "ORGANIZATION_OWNER");

    expect(store.getState().status).toBe(expected);
    expect(store.getState().source).not.toBe("fixture");
    expect(store.getState().grants).toEqual([]);
  });

  it("reports access-lost when no organization is active", async () => {
    const store = createPermissionStore({ fetchPermissions, env: devEnv });
    await store.getState().load("", "ORGANIZATION_OWNER");

    expect(fetchPermissions).not.toHaveBeenCalled();
    expect(store.getState().status).toBe("access-lost");
  });

  it("dedupes concurrent loads for the same organization", async () => {
    const store = createPermissionStore({ fetchPermissions, env: devEnv });
    await Promise.all([
      store.getState().load(ORG_A, "ORGANIZATION_OWNER"),
      store.getState().load(ORG_A, "ORGANIZATION_OWNER"),
    ]);
    expect(fetchPermissions).toHaveBeenCalledTimes(1);
  });

  it("reloads when the role template changes in the same organization", async () => {
    const store = createPermissionStore({ fetchPermissions, env: { nodeEnv: "development", useMocks: "true" } });
    await store.getState().load(ORG_A, "ORGANIZATION_OWNER");
    await store.getState().load(ORG_A, "ORGANIZATION_ADMIN");

    expect(store.getState().grants).toEqual(FIXTURE_GRANTS.ORGANIZATION_ADMIN);
  });

  it("drops grants from the previous organization when switching and ignores stale responses", async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    const slow = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ organizationId: "org-b", permissions: ["project.read"] });
    const store = createPermissionStore({ fetchPermissions: slow, env: devEnv });

    const first = store.getState().load(ORG_A, "ORGANIZATION_OWNER");
    expect(store.getState().grants).toEqual([]);
    await store.getState().load("org-b", "ORGANIZATION_OWNER");
    resolveFirst({ organizationId: ORG_A, permissions: ["org.manage"] });
    await first;

    expect(store.getState().orgId).toBe("org-b");
    expect(store.getState().grants).toEqual([{ key: "project.read", scope: "ORG" }]);
  });
});
