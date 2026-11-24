"use client";

import React, { useState } from "react";
import type { FormEvent } from "react";
import { CalendarDays, Globe2, Plus, Trash2 } from "lucide-react";

import { OwnerPanel } from "@/components/owner/OwnerPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type OrganizationSettingsDraft,
  type OrganizationSettingsErrors,
  type OwnerOrganizationSettingsUpdate,
  validateOrganizationSettings,
} from "@/hooks/useOwnerOrganizationSettings";
import type { Organization } from "@/types";

const WORKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

const TIMEZONE_SUGGESTIONS = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
];

interface OwnerOrganizationSettingsViewProps {
  organization: Organization;
  canEdit: boolean;
  onSave: (updates: OwnerOrganizationSettingsUpdate) => boolean;
  /** Replaces the default "missing org.manage" message when the form is read-only for another reason. */
  readOnlyReason?: React.ReactNode;
  /** The local-preview banner only makes sense while edits are possible. */
  showLocalPreviewNotice?: boolean;
}

export function OwnerOrganizationSettingsView({
  organization,
  canEdit,
  onSave,
  readOnlyReason,
  showLocalPreviewNotice = true,
}: OwnerOrganizationSettingsViewProps) {
  const [name, setName] = useState(organization.name);
  const [timezone, setTimezone] = useState(organization.timezone);
  const [workDays, setWorkDays] = useState(organization.workCalendar.workDays);
  const [dailyHours, setDailyHours] = useState(String(organization.workCalendar.dailyHours));
  const [holidays, setHolidays] = useState(organization.workCalendar.holidays);
  const [newHoliday, setNewHoliday] = useState("");
  const [holidayError, setHolidayError] = useState("");
  const [errors, setErrors] = useState<OrganizationSettingsErrors>({});
  const [saveMessage, setSaveMessage] = useState("");

  const handleWorkDayChange = (day: number, checked: boolean) => {
    setWorkDays((currentDays) =>
      checked
        ? [...currentDays, day].sort((first, second) => first - second)
        : currentDays.filter((currentDay) => currentDay !== day),
    );
    setSaveMessage("");
  };

  const addHoliday = () => {
    if (!newHoliday) {
      setHolidayError("Choose a holiday date to add.");
      return;
    }
    if (holidays.includes(newHoliday)) {
      setHolidayError("This date is already on the holiday list.");
      return;
    }

    setHolidays((currentHolidays) => [...currentHolidays, newHoliday].sort());
    setNewHoliday("");
    setHolidayError("");
    setSaveMessage("");
  };

  const removeHoliday = (holiday: string) => {
    setHolidays((currentHolidays) => currentHolidays.filter((currentHoliday) => currentHoliday !== holiday));
    setSaveMessage("");
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft: OrganizationSettingsDraft = {
      name,
      timezone,
      workDays,
      dailyHours: Number(dailyHours),
      holidays,
    };
    const nextErrors = validateOrganizationSettings(draft);
    setErrors(nextErrors);
    setSaveMessage("");

    if (Object.values(nextErrors).some(Boolean)) return;

    const saved = onSave({
      name: name.trim(),
      timezone: timezone.trim(),
      workCalendar: {
        ...organization.workCalendar,
        workDays: [...workDays].sort((first, second) => first - second),
        dailyHours: Number(dailyHours),
        holidays: [...holidays].sort(),
      },
    });

    if (saved) {
      setSaveMessage("Saved to this browser session only. These changes have not been sent to the server.");
    } else {
      setSaveMessage("Workspace access changed. Reload the page before editing these settings.");
    }
  };

  return (
    <div className="space-y-4">
      {showLocalPreviewNotice && (
        <div className="flex flex-col gap-2 rounded-xl border border-app-border bg-app-surface p-4 sm:flex-row sm:items-center sm:gap-3">
          <span className="inline-flex w-fit shrink-0 rounded-full border border-app-border bg-app-bg px-2.5 py-1 text-xs font-semibold text-app-text-secondary">
            Local preview only
          </span>
          <p className="text-sm text-app-text-secondary">
            Changes stay in this browser session and are not sent to the server.
          </p>
        </div>
      )}

      {!canEdit && (
        <div role="status" className="rounded-lg border border-app-border bg-app-bg px-4 py-3 text-sm text-app-text-secondary">
          {readOnlyReason ?? "Organization settings are read-only because the active membership does not have the org.manage permission."}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <OwnerPanel
          title="Organization profile"
          description="Review the workspace identity and status."
        >
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Input
              label="Organization name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSaveMessage("");
              }}
              maxLength={120}
              autoComplete="organization"
              required
              disabled={!canEdit}
              error={errors.name}
            />
            <Input
              label="Organization ID"
              value={organization.id}
              disabled
              helperText="Stable workspace identifier."
            />
            <Input
              label="Workspace slug"
              value={organization.slug}
              disabled
              helperText="Workspace URL identifiers are not editable here."
            />
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-app-text-secondary">Workspace status</span>
              <p className="flex h-9 items-center rounded-lg border border-app-border bg-app-bg px-3 text-sm text-app-text-primary">
                {organization.status.toLowerCase()}
              </p>
            </div>
          </div>
        </OwnerPanel>

        <OwnerPanel
          title="Working calendar"
          description="Set the organization timezone, standard workdays, hours, and date-only holidays."
        >
          <div className="space-y-5">
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <div>
                <Input
                  label="IANA timezone"
                  value={timezone}
                  onChange={(event) => {
                    setTimezone(event.target.value);
                    setSaveMessage("");
                  }}
                  list="owner-settings-timezone-suggestions"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  disabled={!canEdit}
                  error={errors.timezone}
                  helperText="Use a timezone identifier such as America/New_York."
                />
                <datalist id="owner-settings-timezone-suggestions">
                  {TIMEZONE_SUGGESTIONS.map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
              </div>
              <Input
                label="Daily working hours"
                type="number"
                min={0.25}
                max={24}
                step={0.25}
                value={dailyHours}
                onChange={(event) => {
                  setDailyHours(event.target.value);
                  setSaveMessage("");
                }}
                required
                disabled={!canEdit}
                error={errors.dailyHours}
              />
            </div>

            <fieldset
              disabled={!canEdit}
              className="min-w-0 space-y-3"
              aria-invalid={Boolean(errors.workDays)}
              aria-describedby={errors.workDays ? "organization-workdays-error" : undefined}
            >
              <legend className="flex items-center gap-2 text-xs font-semibold text-app-text-secondary">
                <CalendarDays className="h-4 w-4 text-app-accent" aria-hidden="true" />
                Standard workdays
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {WORKDAYS.map((day) => (
                  <label
                    key={day.value}
                    className="flex min-h-10 items-center gap-2 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-sm text-app-text-primary"
                  >
                    <input
                      type="checkbox"
                      checked={workDays.includes(day.value)}
                      onChange={(event) => handleWorkDayChange(day.value, event.target.checked)}
                      className="h-4 w-4 rounded border-app-border text-app-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent"
                    />
                    <span>{day.label}</span>
                  </label>
                ))}
              </div>
              {errors.workDays && (
                <p id="organization-workdays-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {errors.workDays}
                </p>
              )}
              <p className="text-xs text-app-text-muted">Days use Monday = 1 through Sunday = 7.</p>
            </fieldset>

            <section aria-labelledby="organization-holidays-heading" className="space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <Input
                    label="Add holiday date"
                    type="date"
                    value={newHoliday}
                    onChange={(event) => {
                      setNewHoliday(event.target.value);
                      setHolidayError("");
                    }}
                    disabled={!canEdit}
                    error={holidayError}
                  />
                </div>
                {canEdit && (
                  <Button type="button" variant="secondary" onClick={addHoliday} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add date
                  </Button>
                )}
              </div>
              {errors.holidays && (
                <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                  {errors.holidays}
                </p>
              )}
              <h3 id="organization-holidays-heading" className="flex items-center gap-2 text-xs font-semibold text-app-text-secondary">
                <Globe2 className="h-4 w-4 text-app-accent" aria-hidden="true" />
                Holiday dates
              </h3>
              {holidays.length === 0 ? (
                <p role="status" className="rounded-lg border border-dashed border-app-border px-3 py-4 text-sm text-app-text-muted">
                  No organization holiday dates are configured.
                </p>
              ) : (
                <ul className="divide-y divide-app-border rounded-lg border border-app-border">
                  {holidays.map((holiday) => (
                    <li key={holiday} className="flex min-h-11 items-center justify-between gap-3 px-3 py-2">
                      <time dateTime={holiday} className="text-sm tabular-nums text-app-text-primary">{holiday}</time>
                      {canEdit && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove holiday ${holiday}`}
                          onClick={() => removeHoliday(holiday)}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </OwnerPanel>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {saveMessage ? (
            <p role={saveMessage.startsWith("Saved") ? "status" : "alert"} aria-live="polite" className="text-sm text-app-text-secondary">
              {saveMessage}
            </p>
          ) : (
            <span />
          )}
          {canEdit && (
            <Button type="submit" className="w-full sm:w-auto">
              Save changes
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
