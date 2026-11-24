"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CalendarDays, History, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { apiClient, isStaleVersion } from "@/lib/api";
import type {
  CadenceFrequencyDto,
  HolidayDto,
  OccurrenceDto,
  OrgCalendarDto,
  ProjectCadenceDto,
  ProjectDto,
  ProjectScheduleDto,
  WeekdayDto,
} from "@/types/api";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  EmptyStateView,
  ErrorBanner,
  PageFrame,
  PageSkeleton,
  Panel,
  StatusBadge,
} from "@/components/delivery/DeliveryUI";
import { StaleVersionBanner } from "@/components/org-console/StaleVersionBanner";
import { apiErrorMessage, toState } from "@/components/org-console/useRoleApi";
import { formatDay } from "@/components/projects/formatDay";
import { usePermissions } from "@/hooks/usePermissions";
import type { PermissionKey } from "@/types/permission";
import { AccessDeniedState, AccessLostState, SessionExpiredState } from "@/components/org-console/AccessStates";

/**
 * Task 2.3 screens: the organization work calendar, a project's check-in cadence and schedule, and the deadlines
 * list. Dates are calendar days in the project time zone; the server computes every due date and grace window.
 */

const QUERY = { retry: false } as const;
type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";
export const WEEKDAYS: WeekdayDto[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
const DAY_LABEL: Record<WeekdayDto, string> = {
  MONDAY: "Monday", TUESDAY: "Tuesday", WEDNESDAY: "Wednesday", THURSDAY: "Thursday", FRIDAY: "Friday", SATURDAY: "Saturday", SUNDAY: "Sunday",
};
const FREQUENCY_LABEL: Record<CadenceFrequencyDto, string> = { DAILY: "Daily", WEEKLY: "Weekly", FORTNIGHTLY: "Every two weeks" };

/** Plain words for an occurrence state. */
export function scheduleLabel(display: string | null | undefined): { label: string; tone: StatusTone } {
  switch (display) {
    case "UPCOMING": return { label: "Upcoming", tone: "info" };
    case "DUE_TODAY": return { label: "Due today", tone: "warning" };
    case "IN_GRACE": return { label: "In grace period", tone: "warning" };
    case "MISSED": return { label: "Missed", tone: "danger" };
    case "MET": return { label: "Checked in", tone: "success" };
    case "PAUSED": return { label: "Paused (on hold)", tone: "neutral" };
    case "EXCUSED": return { label: "Excused", tone: "neutral" };
    case "SUPERSEDED": return { label: "Replaced", tone: "neutral" };
    case "ON_TIME": return { label: "On time", tone: "success" };
    case "OVERDUE": return { label: "Overdue", tone: "danger" };
    default: return { label: "Not set", tone: "neutral" };
  }
}

export function complianceText(schedule: ProjectScheduleDto): string {
  const c = schedule.compliance;
  if (c.eligible === 0) return "No finished check-in windows yet.";
  return `${c.met} of ${c.eligible} check-in windows met (${c.rate}%)`;
}

function useOrgId() {
  const params = useParams();
  return (params?.orgId as string) || "";
}

function State({ display }: { display: string | null | undefined }) {
  const s = scheduleLabel(display);
  return <StatusBadge label={s.label} tone={s.tone} />;
}

/* ================================================================== organization work calendar */

export function WorkCalendarEditor({ calendar, canEdit, saving, onSave }: {
  calendar: OrgCalendarDto;
  canEdit: boolean;
  saving: boolean;
  onSave: (workdays: WeekdayDto[], holidays: HolidayDto[]) => void;
}) {
  const [workdays, setWorkdays] = useState<WeekdayDto[]>(calendar.workdays);
  const [holidays, setHolidays] = useState<HolidayDto[]>(calendar.holidays);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  useEffect(() => { setWorkdays(calendar.workdays); setHolidays(calendar.holidays); }, [calendar]);
  const toggle = (day: WeekdayDto) => setWorkdays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));
  const addHoliday = () => {
    if (!date || holidays.some((h) => h.date === date)) return;
    setHolidays([...holidays, { date, name: name.trim() || "Holiday" }].sort((a, b) => a.date.localeCompare(b.date)));
    setDate("");
    setName("");
  };
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
      <Panel title="Working days" icon={CalendarDays} description="Due dates and grace count only these days.">
        <fieldset className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs" disabled={!canEdit}>
          <legend className="sr-only">Working days</legend>
          {WEEKDAYS.map((day) => (
            <label key={day} className="flex items-center gap-2">
              <input type="checkbox" checked={workdays.includes(day)} onChange={() => toggle(day)} /> {DAY_LABEL[day]}
            </label>
          ))}
        </fieldset>
        {workdays.length === 0 && <p className="mt-2 text-xs text-red-600">Choose at least one working day.</p>}
      </Panel>
      <Panel title="Holidays" icon={CalendarClock} description="Days off for the whole organization.">
        {holidays.length === 0 ? <p className="text-xs text-[var(--color-text-muted)]">No holidays.</p> : (
          <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="holidays">
            {holidays.map((h) => (
              <li key={h.date} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <span><b>{formatDay(h.date)}</b> · {h.name}</span>
                {canEdit && (
                  <AdminButton size="sm" variant="ghost" aria-label={`Remove ${h.name}`} onClick={() => setHolidays(holidays.filter((x) => x.date !== h.date))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </AdminButton>
                )}
              </li>
            ))}
          </ul>
        )}
        {canEdit && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="w-40"><AdminInput label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="flex-1 min-w-[10rem]"><AdminInput label="Name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} /></div>
            <AdminButton size="sm" variant="outline" disabled={!date} onClick={addHoliday}><Plus className="w-3.5 h-3.5" /> Add</AdminButton>
          </div>
        )}
      </Panel>
      {canEdit && (
        <div className="xl:col-span-2">
          <AdminButton isLoading={saving} disabled={workdays.length === 0} onClick={() => onSave(workdays, holidays)}>
            <Save className="w-3.5 h-3.5" /> Save calendar
          </AdminButton>
          <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Saving recomputes open check-in and target windows of every project.</p>
        </div>
      )}
    </div>
  );
}

export function WorkCalendarView({ crumbs, back }: { crumbs: { label: string; href?: string }[]; back: { href: string; label: string } }) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const state = toState(useQuery({ queryKey: ["org-calendar", orgId], queryFn: () => apiClient.orgCalendar(orgId), ...QUERY }));
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const reload = () => void queryClient.invalidateQueries({ queryKey: ["org-calendar", orgId] });
  const save = (calendar: OrgCalendarDto, workdays: WeekdayDto[], holidays: HolidayDto[]) => {
    setSaving(true);
    setError("");
    apiClient.updateOrgCalendar(orgId, { workdays, holidays, expected_version: calendar.version })
      .then((saved) => { toast.success("Work calendar saved"); queryClient.setQueryData(["org-calendar", orgId], saved); })
      .catch((failure) => (isStaleVersion(failure) ? setStale(true) : setError(apiErrorMessage(failure))))
      .finally(() => setSaving(false));
  };
  return (
    <PageFrame crumbs={[...crumbs, { label: "Work calendar" }]} back={back} title="Work calendar"
      description="Working days and holidays used for every check-in due date, grace period and target date.">
      {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
      {error && <ErrorBanner message={error} />}
      {state.kind === "loading" ? <PageSkeleton variant="detail" />
        : state.kind !== "ready" ? <ErrorBanner message="The work calendar could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
          : <WorkCalendarEditor calendar={state.data} canEdit={state.data.can_edit && can("org.manage")} saving={saving}
              onSave={(workdays, holidays) => save(state.data, workdays, holidays)} />}
    </PageFrame>
  );
}

/* ================================================================== project schedule */

/** Project overview card: next check-in, target, compliance and pace. */
export function ScheduleSummary({ schedule, scheduleHref }: { schedule: ProjectScheduleDto; scheduleHref?: string }) {
  const next = schedule.next_check_in;
  return (
    <div className="space-y-3 text-xs" data-testid="schedule-summary">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <dt className="text-[var(--color-text-muted)]">Next check-in due</dt>
          <dd className="flex flex-wrap items-center gap-2 font-medium">
            {next ? <>{formatDay(next.due_local_date)} <State display={next.display} /></> : schedule.on_hold ? "Paused while on hold" : "None"}
          </dd>
          {next && next.grace_until_date !== next.due_local_date && (
            <dd className="text-[var(--color-text-muted)]">Grace until {formatDay(next.grace_until_date)}</dd>
          )}
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Target</dt>
          <dd className="flex flex-wrap items-center gap-2 font-medium">
            {schedule.target_date ? <>{formatDay(schedule.target_date)} ({schedule.timezone}) <State display={schedule.target_display} /></> : "No target date"}
          </dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Check-in compliance</dt>
          <dd className="font-medium">{complianceText(schedule)}</dd>
          {(schedule.compliance.pending > 0 || schedule.compliance.in_grace > 0 || schedule.compliance.excused > 0) && (
            <dd className="text-[var(--color-text-muted)]">
              {schedule.compliance.pending} pending · {schedule.compliance.in_grace} in grace · {schedule.compliance.excused} excused
            </dd>
          )}
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Rough pace</dt>
          <dd className="font-medium">{schedule.rough_pace === null ? "Pace unavailable" : `${schedule.rough_pace}% of planned working days elapsed`}</dd>
        </div>
      </dl>
      {scheduleHref && <Link className="text-blue-600 hover:underline" href={scheduleHref}>Check-in schedule and history</Link>}
    </div>
  );
}

export function ScheduleCard({ project, scheduleHref }: { project: ProjectDto; scheduleHref?: string }) {
  const orgId = useOrgId();
  const state = toState(useQuery({ queryKey: ["schedule", orgId, project.id], queryFn: () => apiClient.projectSchedule(orgId, project.id), ...QUERY }));
  return (
    <Panel title="Deadlines" icon={CalendarClock} description="Computed from the work calendar and the project's check-in cadence.">
      {state.kind === "loading" ? <PageSkeleton variant="list" />
        : state.kind !== "ready" ? <ErrorBanner message="The schedule could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
          : <ScheduleSummary schedule={state.data} scheduleHref={scheduleHref} />}
    </Panel>
  );
}

export function OccurrenceList({ occurrences }: { occurrences: OccurrenceDto[] }) {
  if (occurrences.length === 0) return <EmptyStateView icon={History} title="No due dates yet" description="Due dates appear once the project has a cadence or a target date." />;
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="occurrences">
      {occurrences.map((o) => (
        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
          <span>
            <b>{o.kind === "TARGET" ? "Target" : "Check-in"}</b> · due {formatDay(o.due_local_date)}
            {o.kind === "CHECKIN" && o.grace_until_date !== o.due_local_date && <> · grace until {formatDay(o.grace_until_date)}</>}
            {o.superseded_reason && <span className="block text-[var(--color-text-muted)]">{o.superseded_reason}</span>}
          </span>
          <State display={o.display} />
        </li>
      ))}
    </ul>
  );
}

export function CadenceForm({ cadence, saving, onSave }: {
  cadence: ProjectCadenceDto;
  saving: boolean;
  onSave: (body: { frequency: CadenceFrequencyDto; day_of_week: WeekdayDto; local_cutoff_time: string; grace_working_days: number; reason: string }) => void;
}) {
  const [frequency, setFrequency] = useState<CadenceFrequencyDto>(cadence.frequency);
  const [day, setDay] = useState<WeekdayDto>(cadence.day_of_week);
  const [cutoff, setCutoff] = useState(cadence.local_cutoff_time);
  const [grace, setGrace] = useState(String(cadence.grace_working_days));
  const [reason, setReason] = useState("");
  const graceNumber = Number(grace);
  const valid = reason.trim().length > 0 && Number.isInteger(graceNumber) && graceNumber >= 0 && graceNumber <= 10 && /^\d{2}:\d{2}$/.test(cutoff);
  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <AdminSelect label="Frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as CadenceFrequencyDto)}>
          {(Object.keys(FREQUENCY_LABEL) as CadenceFrequencyDto[]).map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
        </AdminSelect>
        <AdminSelect label="Due on" value={day} disabled={frequency === "DAILY"} onChange={(e) => setDay(e.target.value as WeekdayDto)}>
          {WEEKDAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
        </AdminSelect>
        <AdminInput label="Cutoff time (project time zone)" type="time" value={cutoff} onChange={(e) => setCutoff(e.target.value)} />
        <AdminInput label="Grace (working days)" type="number" min={0} max={10} value={grace} onChange={(e) => setGrace(e.target.value)} />
      </div>
      <AdminInput label="Reason for the change (required)" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
      <AdminButton isLoading={saving} disabled={!valid}
        onClick={() => onSave({ frequency, day_of_week: day, local_cutoff_time: cutoff, grace_working_days: graceNumber, reason: reason.trim() })}>
        <Save className="w-3.5 h-3.5" /> Save cadence
      </AdminButton>
      <p className="text-[11px] text-[var(--color-text-muted)]">The open check-in window is replaced; earlier windows keep their result.</p>
    </div>
  );
}

export function ProjectScheduleView({ projectId, crumbs, back }: {
  projectId: string;
  crumbs: { label: string; href?: string }[];
  back: { href: string; label: string };
}) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const { canAny } = usePermissions();
  const cadence = toState(useQuery({ queryKey: ["cadence", orgId, projectId], queryFn: () => apiClient.projectCadence(orgId, projectId), ...QUERY }));
  const schedule = toState(useQuery({ queryKey: ["schedule", orgId, projectId], queryFn: () => apiClient.projectSchedule(orgId, projectId), ...QUERY }));
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["cadence", orgId, projectId] });
    void queryClient.invalidateQueries({ queryKey: ["schedule", orgId, projectId] });
  };
  // The server decides (can_edit); the button also needs the key in this session's grants (org or this project).
  const mayEdit = canAny(["project.deadline.edit", "project.edit"], { projectId });
  return (
    <PageFrame crumbs={[...crumbs, { label: "Check-in schedule" }]} back={back} title="Check-in schedule"
      description="How often the project checks in, the grace period, and every due date with its result.">
      {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
      {error && <ErrorBanner message={error} />}
      {cadence.kind === "loading" || schedule.kind === "loading" ? <PageSkeleton variant="detail" />
        : cadence.kind !== "ready" || schedule.kind !== "ready"
          ? <ErrorBanner message="The schedule could not be loaded." onRetry={cadence.kind === "error" ? cadence.retry : undefined} />
          : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <Panel title="Summary" icon={CalendarClock}><ScheduleSummary schedule={schedule.data} /></Panel>
              <Panel title="Cadence" icon={CalendarDays}
                description={`${FREQUENCY_LABEL[cadence.data.frequency]}${cadence.data.frequency === "DAILY" ? "" : ` on ${DAY_LABEL[cadence.data.day_of_week]}`}, cutoff ${cadence.data.local_cutoff_time}, grace ${cadence.data.grace_working_days} working day(s).`}>
                {cadence.data.can_edit && mayEdit ? (
                  <CadenceForm cadence={cadence.data} saving={saving} onSave={(body) => {
                    setSaving(true);
                    setError("");
                    apiClient.updateProjectCadence(orgId, projectId, { ...body, expected_version: cadence.data.policy_version })
                      .then(() => { toast.success("Cadence saved"); reload(); })
                      .catch((failure) => (isStaleVersion(failure) ? setStale(true) : setError(apiErrorMessage(failure))))
                      .finally(() => setSaving(false));
                  }} />
                ) : <p className="text-xs text-[var(--color-text-muted)]">You can view the cadence. Changing it needs the deadline permission on this project.</p>}
              </Panel>
              <Panel title="Due dates" icon={History} description="Replaced dates stay listed with the reason.">
                <OccurrenceList occurrences={schedule.data.occurrences} />
              </Panel>
              <Panel title="Cadence history" icon={History}>
                {cadence.data.history.length === 0 ? <p className="text-xs text-[var(--color-text-muted)]">No changes yet.</p> : (
                  <ul className="space-y-2 text-xs" data-testid="cadence-history">
                    {cadence.data.history.map((h) => (
                      <li key={h.changed_at + h.reason}>
                        <b>{FREQUENCY_LABEL[h.new_frequency as CadenceFrequencyDto] ?? h.new_frequency}</b>, grace {h.new_grace}, cutoff {h.new_cutoff}
                        <span className="block text-[var(--color-text-muted)]">{h.reason} · {h.changed_by_email ?? "unknown"} · {new Date(h.changed_at).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </div>
          )}
    </PageFrame>
  );
}

/* ================================================================== deadlines list */

export function DeadlinesView({ crumbs, back, projectHref }: {
  crumbs: { label: string; href?: string }[];
  back: { href: string; label: string };
  projectHref: (project: ProjectDto) => string | null;
}) {
  const orgId = useOrgId();
  const list = toState(useQuery({ queryKey: ["projects-deadlines", orgId], queryFn: () => apiClient.projects(orgId, { limit: 50 }), ...QUERY }));
  const projects = list.kind === "ready" ? list.data.items.filter((p) => !p.archived) : [];
  const schedules = useQueries({
    queries: projects.map((p) => ({ queryKey: ["schedule", orgId, p.id], queryFn: () => apiClient.projectSchedule(orgId, p.id), ...QUERY })),
  });
  return (
    <PageFrame crumbs={[...crumbs, { label: "Deadlines" }]} back={back} title="Deadlines"
      description="Next check-in and target date of each project you can see, in the project's time zone.">
      {list.kind === "loading" ? <PageSkeleton variant="list" />
        : list.kind !== "ready" ? <ErrorBanner message="Projects could not be loaded." onRetry={list.kind === "error" ? list.retry : undefined} />
          : projects.length === 0 ? <EmptyStateView icon={CalendarClock} title="No projects" description="Projects you can see appear here with their deadlines." />
            : (
              <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="deadlines">
                {projects.map((p, i) => {
                  const s = schedules[i];
                  const href = projectHref(p);
                  return (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs">
                      <span className="min-w-0">
                        {href ? <Link className="font-medium hover:underline" href={href}>{p.key} · {p.name}</Link> : <span className="font-medium">{p.key} · {p.name}</span>}
                        <span className="block text-[var(--color-text-muted)]">{p.timezone}</span>
                      </span>
                      {s?.isLoading ? <span className="text-[var(--color-text-muted)]">Loading…</span>
                        : s?.isError || !s?.data ? <span className="text-red-600">Schedule unavailable</span>
                          : (
                            <span className="flex flex-wrap items-center gap-3">
                              <span>Check-in {s.data.next_check_in ? formatDay(s.data.next_check_in.due_local_date) : "none"} <State display={s.data.next_check_in?.display ?? (s.data.on_hold ? "PAUSED" : null)} /></span>
                              <span>Target {s.data.target_date ? formatDay(s.data.target_date) : "none"} {s.data.target_date && <State display={s.data.target_display} />}</span>
                            </span>
                          )}
                    </li>
                  );
                })}
              </ul>
            )}
    </PageFrame>
  );
}

/** Page gate: shows the page only when this session holds one of the keys (org-wide); otherwise a plain access message. */
export function RequireAnyKey({ keys, backHref, children }: { keys: readonly PermissionKey[]; backHref: string; children: React.ReactNode }) {
  const { status, canAny, retry } = usePermissions();
  if (status === "loading") return <PageSkeleton variant="detail" />;
  if (status === "unauthenticated") return <SessionExpiredState />;
  if (status === "access-lost") return <AccessLostState />;
  if (status === "error") return <ErrorBanner message="Your permissions could not be loaded." onRetry={retry} />;
  if (!canAny(keys)) return <AccessDeniedState permission={keys[0]} backHref={backHref} />;
  return <>{children}</>;
}
