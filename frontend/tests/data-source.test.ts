import { describe, expect, it } from "vitest";

import { ApiError } from "../src/lib/api";
import { classifyFailure } from "../src/lib/permissions";
<<<<<<< HEAD
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
=======

describe("classifyFailure (shared by permissions and page data)", () => {
  it.each([0, 502, 503, 504])("treats unreachable status %s as an error, never as sample data", (status) => {
    expect(classifyFailure(new ApiError(status, "X", "x", ""))).toBe("error");
  });

  it("treats a non-API error (e.g. missing base URL) as an error", () => {
    expect(classifyFailure(new Error("NEXT_PUBLIC_API_BASE_URL is required"))).toBe("error");
>>>>>>> 29db595 (Initial ProWise project upload)
  });

  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [404, "not-found"],
    [500, "error"],
  ] as const)("maps %s to %s", (status, expected) => {
    expect(classifyFailure(new ApiError(status, "X", "x", ""))).toBe(expected);
  });
});
