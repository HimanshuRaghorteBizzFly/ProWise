import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { OwnerOrganizationSettingsView } from "../src/components/owner/OwnerOrganizationSettingsView";
import { Input } from "../src/components/ui/input";
import {
  getOwnerOrganizationSettingsStateForOrg,
  validateOrganizationSettings,
} from "../src/hooks/useOwnerOrganizationSettings";
import { SEEDED_ORGS } from "./fixtures/mock-data";

const organization = SEEDED_ORGS[0];
const validDraft = {
  name: organization.name,
  timezone: organization.timezone,
  workDays: organization.workCalendar.workDays,
  dailyHours: organization.workCalendar.dailyHours,
  holidays: organization.workCalendar.holidays,
};

describe("Owner organization settings", () => {
  it("does not expose settings from a previous organization while the requested scope changes", () => {
    const state = getOwnerOrganizationSettingsStateForOrg(
      { status: "ready", orgId: organization.id, organization },
      "org-nova",
      "org-nova",
      "org-nova",
    );

    expect(state).toEqual({ status: "loading", orgId: "org-nova" });
  });

  it("marks mismatched active and workspace organizations as access lost", () => {
    const state = getOwnerOrganizationSettingsStateForOrg(
      { status: "ready", orgId: "org-nova", organization: SEEDED_ORGS[1] },
      "org-nova",
      "org-nova",
      organization.id,
    );

    expect(state).toEqual({ status: "access-lost", orgId: "org-nova" });
  });

  it("rejects invalid timezone, hours, and an empty workweek", () => {
    const result = validateOrganizationSettings({
      ...validDraft,
      timezone: "Mars/Olympus",
      dailyHours: 25,
      workDays: [],
    });

    expect(result).toEqual({
      name: undefined,
      timezone: "Enter a valid IANA timezone.",
      dailyHours: "Daily hours must be greater than 0 and no more than 24.",
      workDays: "Select at least one working day.",
      holidays: undefined,
    });
  });

  it("rejects malformed or duplicate holiday dates", () => {
    const result = validateOrganizationSettings({
      ...validDraft,
      holidays: ["2026-02-30", "2026-12-25", "2026-12-25"],
    });

    expect(result.holidays).toBe("Use unique valid dates in YYYY-MM-DD format.");
  });

  it("renders a clearly labeled local preview without unsupported actions", () => {
    const markup = renderToStaticMarkup(
      <OwnerOrganizationSettingsView organization={organization} canEdit onSave={vi.fn()} />,
    );

    expect(markup).toContain("Local preview only");
    expect(markup).toContain("Changes stay in this browser session and are not sent to the server.");
    expect(markup).toContain("Organization profile");
    expect(markup).toContain("Working calendar");
    expect(markup).toContain("Monday");
    expect(markup).toContain("Holiday dates");
    expect(markup).not.toContain("Transfer Organization Ownership");
    expect(markup).not.toContain("Billing");
  });

  it("does not render editable controls without org.manage", () => {
    const markup = renderToStaticMarkup(
      <OwnerOrganizationSettingsView organization={organization} canEdit={false} onSave={vi.fn()} />,
    );

    expect(markup).toContain("Organization settings are read-only");
    expect(markup).not.toContain(">Save changes<");
    expect(markup).toContain('disabled=""');
  });

  it("associates form errors with their input for assistive technology", () => {
    const markup = renderToStaticMarkup(
      <Input label="IANA timezone" error="Enter a valid IANA timezone." />,
    );

    expect(markup).toContain('aria-invalid="true"');
    expect(markup).toContain('aria-describedby="iana-timezone-error"');
    expect(markup).toContain('id="iana-timezone-error"');
  });
});
