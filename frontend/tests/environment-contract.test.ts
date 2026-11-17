import { describe, expect, it } from "vitest";

import type { ApiErrorResponse, HealthResponse } from "@/types/api";

describe("typed API environment contract", () => {
  it("models the request-id health response", () => {
    const response: HealthResponse = {
      status: "ok",
      request_id: "request-1",
      profile: "default",
    };

    expect(response.request_id).toBe("request-1");
  });

  it("models the documented error shape", () => {
    const error: ApiErrorResponse = {
      code: "503",
      message: "Unavailable",
      request_id: "request-1",
      field_errors: [],
    };

    expect(error.field_errors).toEqual([]);
  });
});
