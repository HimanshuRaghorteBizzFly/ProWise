"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Calendar, CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";

import { PanelLayout } from "@/components/layouts/panel-layout";
import { AdminModal } from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import {
  AdminButton,
  AdminInput,
  AdminTextarea,
  EmptyStateView,
  PageFrame,
  Panel,
  StatusBadge,
} from "@/components/delivery/DeliveryUI";
import { DevGate, SectionGate, WorkStateBadge, changeError, isOverdue } from "@/components/developer/DevUI";
import { useDevCalendar, useDevMutation, useMyWorkItems } from "@/components/developer/useDeveloperData";
import { useOrgId } from "@/components/org-console/useRoleApi";
import { developerApi, type DeveloperCalendarEvent } from "@/lib/developer-api";

/** A date-only due date is shown as its calendar day; no timezone conversion or hour arithmetic (rule 8). */
function dayLabel(isoDay: string): string {
  const [y, m, d] = isoDay.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return isoDay;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function localDayKey(instant: string): string {
  const d = new Date(instant);
  if (Number.isNaN(d.getTime())) return instant.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeText(e: DeveloperCalendarEvent): string {
  if (e.allDay) return "All day";
  const start = new Date(e.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const end = e.endTime ? new Date(e.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
  return end ? `${start} – ${end}` : start;
}

interface EventForm {
  title: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
}

const EMPTY: EventForm = { title: "", description: "", start: "", end: "", allDay: false };

function validate(f: EventForm): Partial<Record<keyof EventForm, string>> {
  const errors: Partial<Record<keyof EventForm, string>> = {};
  if (!f.title.trim()) errors.title = "Title is required.";
  else if (f.title.trim().length > 200) errors.title = "Keep the title under 200 characters.";
  if (f.description.length > 2000) errors.description = "Keep the description under 2000 characters.";
  if (!f.start) errors.start = "Start is required.";
  if (f.start && f.end && new Date(f.end).getTime() < new Date(f.start).getTime()) errors.end = "End must be after the start.";
  return errors;
}

export default function DeveloperCalendarPage() {
  const orgId = useOrgId();
  const home = `/org/${orgId}/developer/dashboard`;
  const events = useDevCalendar();
  const work = useMyWorkItems();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EventForm>(EMPTY);
  const [touched, setTouched] = useState(false);
  const errors = validate(form);

  const create = useDevMutation((f: EventForm) =>
    developerApi.createCalendarEvent({
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      eventType: "PERSONAL",
      startTime: new Date(f.start).toISOString(),
      endTime: f.end ? new Date(f.end).toISOString() : undefined,
      allDay: f.allDay,
    }),
  );

  const submit = () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    create.mutate(form, {
      onSuccess: () => {
        toast.success("Event added to your calendar.");
        setOpen(false);
        setForm(EMPTY);
        setTouched(false);
      },
      onError: (e) => toast.error(changeError(e)),
    });
  };

  return (
    <PanelLayout title="Calendar & Deadlines">
      <PageFrame
        crumbs={[{ label: "Developer", href: home }, { label: "Calendar & Deadlines" }]}
        title="Calendar & Deadlines"
        description="Your due dates and calendar events."
        actions={
          <AdminButton size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Add event
          </AdminButton>
        }
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title="Upcoming due dates" description="From work assigned to you" icon={CalendarClock}>
            <SectionGate state={work} what="your due dates">
              {(items) => {
                const due = items
                  .filter((w) => w.due_on && w.state !== "DONE" && w.state !== "CANCELLED")
                  .sort((a, b) => (a.due_on! < b.due_on! ? -1 : 1));
                return due.length === 0 ? (
                  <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No open work has a due date.</p>
                ) : (
                  <ul className="divide-y divide-[var(--color-border)]">
                    {due.map((w) => (
                      <li key={w.id} className="flex flex-col gap-1 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <Link href={`/org/${orgId}/developer/tasks/${encodeURIComponent(w.id)}`} className="min-w-0 hover:underline">
                          <span className="font-mono font-semibold text-blue-600 dark:text-blue-400">{w.key}</span>{" "}
                          <span className="text-[var(--color-text-primary)]">{w.title}</span>
                        </Link>
                        <span className="flex shrink-0 items-center gap-2">
                          <WorkStateBadge state={w.state} blocked={w.blocked} />
                          <span className={isOverdue(w.due_on, w.state) ? "font-semibold text-rose-600" : "text-[var(--color-text-secondary)]"}>
                            {isOverdue(w.due_on, w.state) ? "Overdue · " : ""}
                            {dayLabel(w.due_on!)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                );
              }}
            </SectionGate>
          </Panel>

          <Panel title="Calendar events" icon={Calendar}>
            <DevGate state={events} what="Calendar events" back={{ href: home, label: "Back to dashboard" }}>
              {(list) => {
                if (list.length === 0) {
                  return (
                    <EmptyStateView
                      icon={Calendar}
                      title="No events yet"
                      description="Add a personal event, or wait for project milestones to be scheduled."
                      actionLabel="Add event"
                      onAction={() => setOpen(true)}
                    />
                  );
                }
                const groups = new Map<string, DeveloperCalendarEvent[]>();
                [...list]
                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                  .forEach((e) => {
                    const key = localDayKey(e.startTime);
                    groups.set(key, [...(groups.get(key) ?? []), e]);
                  });
                return (
                  <div className="space-y-4">
                    {Array.from(groups.entries()).map(([day, dayEvents]) => (
                      <section key={day}>
                        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                          {dayLabel(day)}
                        </h3>
                        <ul className="space-y-1.5">
                          {dayEvents.map((e) => (
                            <li key={e.id} className="rounded-lg border border-[var(--color-border)] p-2.5 text-xs">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-semibold text-[var(--color-text-primary)]">{e.title}</span>
                                <StatusBadge label={e.eventType?.replace("_", " ") ?? "EVENT"} tone="neutral" />
                              </div>
                              <p className="mt-0.5 text-[var(--color-text-muted)]">{timeText(e)}</p>
                              {e.description && <p className="mt-1 text-[var(--color-text-secondary)]">{e.description}</p>}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                );
              }}
            </DevGate>
          </Panel>
        </div>

        <AdminModal isOpen={open} onClose={() => setOpen(false)} title="Add personal event" maxWidth="md">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <AdminInput
              label="Title"
              value={form.title}
              maxLength={200}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              error={touched ? errors.title : undefined}
            />
            <AdminTextarea
              label="Description (optional)"
              value={form.description}
              maxLength={2000}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              error={touched ? errors.description : undefined}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AdminInput
                label="Start"
                type="datetime-local"
                value={form.start}
                onChange={(e) => setForm({ ...form, start: e.target.value })}
                error={touched ? errors.start : undefined}
              />
              <AdminInput
                label="End (optional)"
                type="datetime-local"
                value={form.end}
                onChange={(e) => setForm({ ...form, end: e.target.value })}
                error={touched ? errors.end : undefined}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} />
              All-day event
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <AdminButton type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancel
              </AdminButton>
              <AdminButton type="submit" size="sm" isLoading={create.isPending} disabled={create.isPending}>
                Add event
              </AdminButton>
            </div>
          </form>
        </AdminModal>
      </PageFrame>
    </PanelLayout>
  );
}
