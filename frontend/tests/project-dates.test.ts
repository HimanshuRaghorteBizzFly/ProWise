import { describe, expect, it } from "vitest";

import {
  endAfterStartChange,
  endDateError,
  isIsoDate,
  localToday,
  startDateError,
} from "../src/components/projects/projectDates";

// Create/Edit project date rules (the server enforces the same rules).

describe("project dates", () => {
  it("uses the local calendar day, not UTC", () => {
    // 23:30 local on 25 Nov stays 25 Nov even where UTC is already the 26th.
    expect(localToday(new Date(2026, 10, 25, 23, 30))).toBe("2026-11-25");
    expect(localToday(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  });

  it("rejects a past start date and accepts today", () => {
    expect(startDateError("2026-11-24", "2026-11-25")).toBe("The start date cannot be in the past.");
    expect(startDateError("2026-11-25", "2026-11-25")).toBeNull();
    expect(startDateError("2026-12-01", "2026-11-25")).toBeNull();
  });

  it("rejects an end date before the start and accepts the same day", () => {
    expect(endDateError("2026-11-29", "2026-11-30")).toBe("The end date cannot be before the start date.");
    expect(endDateError("2026-11-30", "2026-11-30")).toBeNull();
    expect(endDateError("2026-12-05", "2026-11-30")).toBeNull();
  });

  it("flags typed or pasted dates that are not real", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("25/11/2026")).toBe(false);
    expect(startDateError("2026-13-01", "2026-11-25")).toBe("Enter a valid date.");
    expect(endDateError("nonsense", "2026-11-25")).toBe("Enter a valid date.");
  });

  it("clears the end date when the start moves past it", () => {
    expect(endAfterStartChange("2026-12-01", "2026-12-10")).toBe("");
    expect(endAfterStartChange("2026-12-20", "2026-12-10")).toBe("2026-12-20");
    expect(endAfterStartChange("2026-12-10", "2026-12-10")).toBe("2026-12-10");
  });

  it("lets an unchanged past start stay when editing, but checks a changed one", () => {
    expect(startDateError("2026-10-01", "2026-11-25", "2026-10-01")).toBeNull();
    expect(startDateError("2026-10-05", "2026-11-25", "2026-10-01")).toBe("The start date cannot be in the past.");
  });
});
