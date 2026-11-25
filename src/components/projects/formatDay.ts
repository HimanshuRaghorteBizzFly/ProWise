/** Local date (YYYY-MM-DD) shown as a calendar day: never shifted by the viewer's time zone. */
export function formatDay(day: string | null) {
  if (!day) return "Not set";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${day}T00:00:00Z`));
}
