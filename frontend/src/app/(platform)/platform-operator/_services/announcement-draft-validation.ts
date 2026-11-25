/**
 * Client checks for an operator announcement proposal. They mirror the server rules in AnnouncementDraftService
 * (which re-checks everything) so the operator sees problems next to each field before anything is sent.
 * Keys match the server's field_errors names.
 */

export const ANNOUNCEMENT_TITLE_MIN = 5;
export const ANNOUNCEMENT_TITLE_MAX = 255;
export const ANNOUNCEMENT_MESSAGE_MIN = 20;
export const ANNOUNCEMENT_MESSAGE_MAX = 20_000;
export const ANNOUNCEMENT_MESSAGE_MIN_WORDS = 3;

export interface AnnouncementDraftFormValues {
  title: string;
  message: string;
  audience: string;
  /** Comma separated plan ids/codes or organization ids, depending on the audience. */
  targets: string;
  /** `datetime-local` value ("YYYY-MM-DDTHH:mm") in the browser's zone, or "" when no time is proposed. */
  proposedScheduleAt: string;
}

const letterCount = (value: string) => (value.match(/\p{L}/gu) ?? []).length;
const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;
const listOf = (value: string) =>
  value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

export function validateAnnouncementDraft(v: AnnouncementDraftFormValues, now: Date = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};

  const title = v.title.trim().replace(/\s+/g, " ");
  if (!title) errors.title = "Enter a headline.";
  else if (title.length < ANNOUNCEMENT_TITLE_MIN) errors.title = `Use at least ${ANNOUNCEMENT_TITLE_MIN} characters.`;
  else if (title.length > ANNOUNCEMENT_TITLE_MAX) errors.title = `Use at most ${ANNOUNCEMENT_TITLE_MAX} characters.`;
  else if (letterCount(title) < 3) errors.title = "Use words, not only numbers or symbols.";

  const message = v.message.trim();
  if (!message) errors.message = "Enter the message customers will read.";
  else if (message.length < ANNOUNCEMENT_MESSAGE_MIN) {
    errors.message = `Use at least ${ANNOUNCEMENT_MESSAGE_MIN} characters (currently ${message.length}).`;
  } else if (message.length > ANNOUNCEMENT_MESSAGE_MAX) {
    errors.message = `Use at most ${ANNOUNCEMENT_MESSAGE_MAX.toLocaleString()} characters.`;
  } else if (wordCount(message) < ANNOUNCEMENT_MESSAGE_MIN_WORDS) {
    errors.message = `Write at least ${ANNOUNCEMENT_MESSAGE_MIN_WORDS} words so customers understand what will happen.`;
  }

  if (v.audience === "BY_PLAN" && listOf(v.targets).length === 0) {
    errors.target_plans = "List at least one plan.";
  }
  if (v.audience === "SPECIFIC_ORGS" && listOf(v.targets).length === 0) {
    errors.target_org_ids = "List at least one organization ID.";
  }

  if (v.proposedScheduleAt) {
    const at = new Date(v.proposedScheduleAt);
    if (Number.isNaN(at.getTime())) errors.scheduled_for = "Enter a valid date and time.";
    else if (at.getTime() <= now.getTime()) errors.scheduled_for = "Choose a time in the future.";
  }

  return errors;
}
