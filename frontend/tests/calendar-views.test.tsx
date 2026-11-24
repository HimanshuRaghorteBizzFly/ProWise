import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { OrgCalendarDto, ProjectScheduleDto } from "../src/types/api";
import { isLiveRoute } from "../src/lib/live-routes";
import { ApiError } from "../src/lib/api";
import { apiErrorMessage } from "../src/components/org-console/useRoleApi";

// Task 2.3 (FR-037): work calendar, cadence and deadlines screens.

vi.mock("next/navigation", () => ({ useParams: () => ({ orgId: "org-1" }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ status: "ready", can: () => true, canAny: () => true }) }));

const { scheduleLabel, complianceText, ScheduleSummary, WorkCalendarEditor, OccurrenceList } = await import("../src/components/calendar/CalendarViews");

function schedule(extra: Partial<ProjectScheduleDto> = {}): ProjectScheduleDto {
  return {
    project_id: "p1", lifecycle: "ACTIVE", timezone: "Europe/London", on_hold: false, target_date: "2026-12-31",
    target_overdue_from: "2027-01-01T00:00:00Z", target_display: "ON_TIME",
    next_check_in: { id: "o1", kind: "CHECKIN", due_local_date: "2026-11-27", grace_until_date: "2026-12-01", zone: "Europe/London",
      cutoff_instant: "2026-11-27T17:00:00Z", grace_cutoff_instant: "2026-12-01T17:00:00Z", policy_version: 0, status: "OPEN",
      display: "UPCOMING", superseded_reason: null },
    compliance: { met: 3, missed: 1, eligible: 4, pending: 1, in_grace: 0, excused: 0, rate: 75 },
    rough_pace: null,
    occurrences: [],
    ...extra,
  };
}

const CALENDAR: OrgCalendarDto = {
  workdays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  holidays: [{ date: "2026-12-25", name: "Christmas Day" }], timezone: "Europe/London", version: 3, can_edit: true,
};

describe("calendar views", () => {
  it("names every schedule state in plain words", () => {
    expect(scheduleLabel("IN_GRACE").label).toBe("In grace period");
    expect(scheduleLabel("SUPERSEDED").label).toBe("Replaced");
    expect(scheduleLabel("OVERDUE").tone).toBe("danger");
  });

  it("shows next check-in with grace, the target in the project zone, compliance and pace", () => {
    const html = renderToStaticMarkup(<ScheduleSummary schedule={schedule()} scheduleHref="/org/org-1/manager/projects/p1/schedule" />);
    expect(html).toContain("Next check-in due");
    expect(html).toContain("Upcoming");
    expect(html).toContain("Grace until");
    expect(html).toContain("(Europe/London)");
    expect(html).toContain("On time");
    expect(html).toContain("3 of 4 check-in windows met (75%)");
    expect(html).toContain("Pace unavailable");
    expect(html).toContain("/org/org-1/manager/projects/p1/schedule");
  });

  it("has no compliance rate without finished windows and shows the pause while on hold", () => {
    const s = schedule({ on_hold: true, next_check_in: null, compliance: { met: 0, missed: 0, eligible: 0, pending: 0, in_grace: 0, excused: 2, rate: null } });
    expect(complianceText(s)).toBe("No finished check-in windows yet.");
    expect(renderToStaticMarkup(<ScheduleSummary schedule={s} />)).toContain("Paused while on hold");
  });

  it("lets only an editor change the calendar", () => {
    const editable = renderToStaticMarkup(<WorkCalendarEditor calendar={CALENDAR} canEdit saving={false} onSave={() => undefined} />);
    expect(editable).toContain("Christmas Day");
    expect(editable).toContain("Save calendar");
    expect(editable).not.toContain('role="dialog"');
    const readOnly = renderToStaticMarkup(<WorkCalendarEditor calendar={CALENDAR} canEdit={false} saving={false} onSave={() => undefined} />);
    expect(readOnly).toContain("Christmas Day");
    expect(readOnly).not.toContain("Save calendar");
    expect(readOnly).not.toContain(">Add<");
  });

  it("keeps replaced due dates with their reason", () => {
    const html = renderToStaticMarkup(<OccurrenceList occurrences={[{ ...schedule().next_check_in!, id: "o0", kind: "TARGET", status: "SUPERSEDED",
      display: "SUPERSEDED", superseded_reason: "The target date changed." }]} />);
    expect(html).toContain("Replaced");
    expect(html).toContain("The target date changed.");
    expect(renderToStaticMarkup(<OccurrenceList occurrences={[]} />)).toContain("No due dates yet");
  });

  it("turns validation errors into plain words and makes the pages live", () => {
    const error = new ApiError(400, "VALIDATION_FAILED", "Check the highlighted field.", "", [{ field: "reason", message: "Say why the cadence changes." }]);
    expect(apiErrorMessage(error)).toBe("Say why the cadence changes.");
    expect(isLiveRoute("/org/org-1/owner/work-calendar")).toBe(true);
    expect(isLiveRoute("/org/org-1/manager/deadlines")).toBe(true);
    expect(isLiveRoute("/org/org-1/developer/deadlines")).toBe(true);
    expect(isLiveRoute("/org/org-1/manager/projects/p1/schedule")).toBe(true);
  });
});
