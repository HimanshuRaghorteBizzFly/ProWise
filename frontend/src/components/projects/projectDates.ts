/**
 * Date rules for the project forms (the server enforces the same rules):
 * - start date: today or later, in the user's LOCAL calendar (never toISOString, which is UTC and can be off by a day);
 * - end date: on or after the start date;
 * - editing: an already-past start date may stay as it is; only a changed start date must be today or later.
 * Values are "YYYY-MM-DD" strings, compared as strings (lexical order = date order for this format).
 */

/** Today's local calendar date as YYYY-MM-DD. */
export function localToday(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30, typed garbage, partial input). */
export function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Inline error for the start date, or null. `original` = the saved start date when editing. */
export function startDateError(start: string, today: string, original?: string | null): string | null {
  if (!start) return null;
  if (!isIsoDate(start)) return "Enter a valid date.";
  if (original && start === original) return null; // unchanged on edit: an already-past start may stay
  if (start < today) return "The start date cannot be in the past.";
  return null;
}

/** Inline error for the end date, or null. */
export function endDateError(end: string, start: string): string | null {
  if (!end) return null;
  if (!isIsoDate(end)) return "Enter a valid date.";
  if (start && isIsoDate(start) && end < start) return "The end date cannot be before the start date.";
  return null;
}

/** The end date to keep after the start date changes: cleared when it would now be before the start. */
export function endAfterStartChange(end: string, start: string): string {
  return end && start && isIsoDate(start) && end < start ? "" : end;
}
