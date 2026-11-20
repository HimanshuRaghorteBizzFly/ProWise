"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { AlarmClockOff, CalendarDays, Sunrise } from "lucide-react";
import { DEMO_TODAY } from "@/mocks/delivery-dashboards";
import {
  Avatar,
  EmptyStateView,
  PageFrame,
  Panel,
  PriorityBadge,
  ProgressBar,
  StatusBadge,
  SurfaceCard,
  TaskStatusBadge,
  daysFromToday,
  dueLabel,
  formatDate,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { useLeadTeam } from "@/components/delivery/useLeadTeam";
import type { Task } from "@/mocks/delivery-dashboards";

export default function TeamLeadTodayPage() {
  const href = useRoleHref("lead");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const t = useLeadTeam(forceEmpty);

  const { overdue, today, tomorrow } = useMemo(() => {
    const open = t.tasks.filter((x) => x.status !== "DONE");
    return {
      overdue: open.filter((x) => daysFromToday(x.dueDate) < 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      today: open.filter((x) => daysFromToday(x.dueDate) === 0),
      tomorrow: open.filter((x) => daysFromToday(x.dueDate) === 1),
    };
  }, [t.tasks]);

  const Card = ({ x }: { x: Task }) => {
    const d = dueLabel(x.dueDate);
    return (
      <Link href={href(`work-items/${x.id}`)} className="block rounded-xl">
        <SurfaceCard className="p-3.5 space-y-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-violet-500/40">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold">{x.title}</p>
              <p className="text-[11px] text-[var(--color-text-muted)]">{x.key} · {lk.project(x.projectId)?.name}</p>
            </div>
            <StatusBadge label={d.label} tone={d.tone} />
          </div>
          <ProgressBar value={x.progress} size="sm" showLabel />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[11px]"><Avatar person={lk.person(x.assigneeId)} size="sm" />{lk.person(x.assigneeId)?.name ?? "Unassigned"}</span>
            <span className="flex gap-1.5"><TaskStatusBadge status={x.status} /><PriorityBadge priority={x.priority} /></span>
          </div>
        </SurfaceCard>
      </Link>
    );
  };

  const Column = ({ items, empty }: { items: Task[]; empty: string }) =>
    items.length === 0 ? <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">{empty}</p> : <div className="space-y-2.5">{items.map((x) => <Card key={x.id} x={x} />)}</div>;

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "Overview" }, { label: "Today & overdue" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Today & overdue"
      description={`What the team must land on ${formatDate(DEMO_TODAY, true)}, plus anything that slipped.`}
      status={status}
      onRetry={retry}
      skeleton="list"
    >
      {overdue.length + today.length + tomorrow.length === 0 ? (
        <SurfaceCard><EmptyStateView icon={CalendarDays} title="All clear" description="Nothing overdue and nothing due today or tomorrow." /></SurfaceCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
          <Panel title={`Overdue · ${overdue.length}`} icon={AlarmClockOff} iconTone="rose"><Column items={overdue} empty="Nothing overdue." /></Panel>
          <Panel title={`Due today · ${today.length}`} icon={CalendarDays} iconTone="amber"><Column items={today} empty="Nothing due today." /></Panel>
          <Panel title={`Tomorrow · ${tomorrow.length}`} icon={Sunrise} iconTone="blue"><Column items={tomorrow} empty="Nothing due tomorrow." /></Panel>
        </div>
      )}
    </PageFrame>
  );
}
