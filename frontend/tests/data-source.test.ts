import { describe, expect, it } from "vitest";

import { ApiError } from "../src/lib/api";
import { classifyFailure } from "../src/lib/permissions";

describe("classifyFailure (shared by permissions and page data)", () => {
  it.each([0, 502, 503, 504])("treats unreachable status %s as an error, never as sample data", (status) => {
    expect(classifyFailure(new ApiError(status, "X", "x", ""))).toBe("error");
  });

  it("treats a non-API error (e.g. missing base URL) as an error", () => {
    expect(classifyFailure(new Error("NEXT_PUBLIC_API_BASE_URL is required"))).toBe("error");
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
