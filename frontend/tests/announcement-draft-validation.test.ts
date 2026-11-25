import { describe, expect, it } from "vitest";
import { validateAnnouncementDraft } from "@/app/(platform)/platform-operator/_services/announcement-draft-validation";

const NOW = new Date("2026-11-25T10:00:00");
const valid = {
  title: "Database upgrade",
  message: "The database will be upgraded tonight.",
  audience: "ALL_ORGS",
  targets: "",
  proposedScheduleAt: "2026-11-26T09:00",
};

describe("announcement proposal validation", () => {
  it("accepts a complete proposal, with or without a proposed time", () => {
    expect(validateAnnouncementDraft(valid, NOW)).toEqual({});
    expect(validateAnnouncementDraft({ ...valid, proposedScheduleAt: "" }, NOW)).toEqual({});
  });

  it("rejects the gibberish message and past publish time from the reported form", () => {
    const errors = validateAnnouncementDraft(
      { ...valid, title: "attack databse", message: "vfb f  rfr", proposedScheduleAt: "2026-09-11T10:09" },
      NOW,
    );
    expect(Object.keys(errors).sort()).toEqual(["message", "scheduled_for"]);
  });

  it("checks headline length and that it contains words", () => {
    expect(validateAnnouncementDraft({ ...valid, title: "   " }, NOW).title).toBeDefined();
    expect(validateAnnouncementDraft({ ...valid, title: "Fix" }, NOW).title).toMatch(/at least 5/);
    expect(validateAnnouncementDraft({ ...valid, title: "1234 !!" }, NOW).title).toMatch(/words/);
    expect(validateAnnouncementDraft({ ...valid, title: "x".repeat(256) }, NOW).title).toMatch(/at most 255/);
  });

  it("needs a message of 20+ characters and 3+ words", () => {
    expect(validateAnnouncementDraft({ ...valid, message: "" }, NOW).message).toBeDefined();
    expect(validateAnnouncementDraft({ ...valid, message: "Too short text" }, NOW).message).toMatch(/at least 20/);
    expect(validateAnnouncementDraft({ ...valid, message: "Averyveryverylongsinglewordwithoutspaces" }, NOW).message).toMatch(
      /3 words/,
    );
  });

  it("needs at least one target for plan or organization audiences", () => {
    expect(validateAnnouncementDraft({ ...valid, audience: "BY_PLAN", targets: " , " }, NOW)).toHaveProperty("target_plans");
    expect(validateAnnouncementDraft({ ...valid, audience: "SPECIFIC_ORGS", targets: "" }, NOW)).toHaveProperty("target_org_ids");
    expect(validateAnnouncementDraft({ ...valid, audience: "BY_PLAN", targets: "PRO" }, NOW)).toEqual({});
  });

  it("refuses a proposed time that is not in the future", () => {
    expect(validateAnnouncementDraft({ ...valid, proposedScheduleAt: "2026-11-25T10:00" }, NOW).scheduled_for).toMatch(/future/);
    expect(validateAnnouncementDraft({ ...valid, proposedScheduleAt: "not-a-date" }, NOW).scheduled_for).toBeDefined();
  });
});
