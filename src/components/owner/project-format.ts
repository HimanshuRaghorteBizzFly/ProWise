import type { Project, User } from "@/types";

/** Shared display helpers for Owner/Admin project screens. Progress methods are never mixed or averaged. */

export function getProgressMethodLabel(project: Project): string {
  switch (project.lastProgressMethod) {
    case "DEVELOPER_REPORTED":
      return "Developer reported (Individual)";
    case "CALCULATED_BASELINE":
      return "Calculated baseline (Structured)";
    case "NOT_REPORTED":
      return "Not reported";
  }
}

export function getProgressValue(project: Project): string {
  return project.lastProgressMethod === "NOT_REPORTED" ? "Not reported" : `${project.lastProgressPercent}%`;
}

export function getOwnerName(project: Project, users: User[]): string {
  const owner = users.find((user) => user.id === project.accountableOwnerId);
  return owner?.name ?? "Accountable owner unavailable";
}

export function getUserName(userId: string, users: User[], fallback = "Unknown person"): string {
  return users.find((user) => user.id === userId)?.name ?? fallback;
}

export function formatUtcDate(timestamp?: string): string {
  if (!timestamp) return "No evidence timestamp";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Evidence timestamp unavailable";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

export function formatUtcTimestamp(timestamp?: string): string {
  if (!timestamp) return "Time not recorded";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Timestamp unavailable";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

export function formatLifecycle(lifecycle: Project["lifecycle"]): string {
  return lifecycle.toLowerCase().replace(/_/g, " ");
}

/** Today's local date (YYYY-MM-DD) in an IANA zone. */
export function localDate(timeZone: string, nowIso: string = new Date().toISOString()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(nowIso),
  );
}

/**
 * Calendar days from today (in the project's zone) to a date-only deadline. Both sides are
 * local calendar dates, so the difference is exact and never adds 24h across DST.
 */
export function calendarDaysUntil(targetDate: string, timeZone: string, nowIso?: string): number {
  const [ty, tm, td] = targetDate.split("-").map(Number);
  const [ny, nm, nd] = localDate(timeZone, nowIso).split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(ny, nm - 1, nd)) / 86_400_000);
}

export type DeadlineStatus = "overdue" | "due-soon" | "later" | "closed";

const CLOSED_LIFECYCLES: Project["lifecycle"][] = ["DELIVERED", "CLOSED", "CANCELLED"];

export function deadlineStatus(
  project: Pick<Project, "targetDate" | "timezone" | "lifecycle">,
  nowIso?: string,
  soonDays = 14,
): DeadlineStatus {
  if (CLOSED_LIFECYCLES.includes(project.lifecycle)) return "closed";
  const days = calendarDaysUntil(project.targetDate, project.timezone, nowIso);
  if (days < 0) return "overdue";
  return days <= soonDays ? "due-soon" : "later";
}

export const DEADLINE_LABELS: Record<DeadlineStatus, string> = {
  overdue: "Overdue",
  "due-soon": "Due within 14 days",
  later: "Later",
  closed: "Closed",
};

/** Date-only deadline shown with its zone, never converted to an instant. */
export function formatDateOnly(date: string, timeZone: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
  return `${label} (${timeZone})`;
}
