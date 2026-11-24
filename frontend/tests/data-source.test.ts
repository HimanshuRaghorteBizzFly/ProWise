import { describe, expect, it } from "vitest";

import { ApiError } from "../src/lib/api";
import { classifyFailure } from "../src/lib/permissions";
import { createSampleDataStore } from "../src/store/sample-data-store";

const dev = { nodeEnv: "development", useMocks: undefined };
const devMocks = { nodeEnv: "development", useMocks: "true" };
const prod = { nodeEnv: "production", useMocks: "true" };

describe("classifyFailure (shared by permissions and page data)", () => {
  it.each([0, 502, 503, 504])("uses the fixture for unreachable status %s only with NEXT_PUBLIC_USE_MOCKS=true", (status) => {
    expect(classifyFailure(new ApiError(status, "X", "x", ""), devMocks)).toBe("fixture");
    expect(classifyFailure(new ApiError(status, "X", "x", ""), dev)).toBe("error");
  });

  it("treats a non-API error (e.g. missing base URL) as unreachable: fixture only with the flag", () => {
    expect(classifyFailure(new Error("NEXT_PUBLIC_API_BASE_URL is required"), devMocks)).toBe("fixture");
    expect(classifyFailure(new Error("NEXT_PUBLIC_API_BASE_URL is required"), dev)).toBe("error");
  });

  it.each([0, 502, 503, 504])("never uses the fixture for status %s in production", (status) => {
    expect(classifyFailure(new ApiError(status, "X", "x", ""), prod)).toBe("error");
  });

  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [500, "error"],
  ] as const)("maps %s to %s and never to the fixture", (status, expected) => {
    expect(classifyFailure(new ApiError(status, "X", "x", ""), dev)).toBe(expected);
  });
});

describe("sample data registry", () => {
  it("counts active fixture sources and clears them on release", () => {
    const store = createSampleDataStore();
    const releaseA = store.getState().register("members");
    const releaseB = store.getState().register("dashboard");
    expect(store.getState().active()).toBe(true);

    releaseA();
    expect(store.getState().active()).toBe(true);
    releaseB();
    expect(store.getState().active()).toBe(false);
  });

  it("keeps a source active while any registration for it remains", () => {
    const store = createSampleDataStore();
    const first = store.getState().register("roles");
    const second = store.getState().register("roles");
    first();
    expect(store.getState().active()).toBe(true);
    second();
    first();
    expect(store.getState().active()).toBe(false);
  });
});
