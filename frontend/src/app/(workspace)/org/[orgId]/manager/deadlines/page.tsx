"use client";

import { previewEnabled } from "@/lib/permissions";
import { DeadlinesView, RequireAnyKey } from "@/components/calendar/CalendarViews";
import { useParams } from "next/navigation";

import React, { useMemo } from "react";
import { AlarmClockOff, CalendarCheck2, CalendarClock, Flag } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS } from "@/mocks/delivery-dashboards";
import {
  Avatar,
  KpiGrid,
  KpiTile,
  LinkRow,
  PageFrame,
  Panel,
  StatusBadge,
  TaskStatusBadge,
  daysFromToday,
  dueLabel,
  formatDate,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { GroupedBarChart } from "@/components/delivery/DeliveryCharts";

function PreviewManagerDeadlinesPage() {
  const href = useRoleHref("manager");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allProjects = useDeliveryStore((s) => s.projects);
  const allTasks = useDeliveryStore((s) => s.tasks);

  const { overdue, week, later, milestones, buckets } = useMemo(() => {
    const projects = forceEmpty ? [] : allProjects.filter((p) => p.managerId === VIEWERS.manager.id);
    const ids = new Set(projects.map((p) => p.id));
    const open = allTasks.filter((t) => ids.has(t.projectId) && t.status !== "DONE").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const ms = projects
      .flatMap((p) => p.milestones.filter((m) => m.status !== "DONE").map((m) => ({ ...m, project: p })))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const weeks = ["This week", "Next week", "In 2 weeks", "Later"];
    const bucketOf = (d: number) => (d <= 6 ? 0 : d <= 13 ? 1 : d <= 20 ? 2 : 3);
    return {
      overdue: open.filter((t) => daysFromToday(t.dueDate) < 0),
      week: open.filter((t) => { const d = daysFromToday(t.dueDate); return d >= 0 && d <= 7; }),
      later: open.filter((t) => daysFromToday(t.dueDate) > 7),
      milestones: ms,
      buckets: weeks.map((label, i) => ({
        label,
        primary: open.filter((t) => daysFromToday(t.dueDate) >= 0 && bucketOf(daysFromToday(t.dueDate)) === i).length,
        secondary: ms.filter((m) => daysFromToday(m.dueDate) >= 0 && bucketOf(daysFromToday(m.dueDate)) === i).length,
      })),
    };
  }, [allProjects, allTasks, forceEmpty]);

  const TaskList = ({ items, empty }: { items: typeof overdue; empty: string }) => (
    <div className="space-y-0.5">
      {items.length === 0 && <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">{empty}</p>}
      {items.map((t) => {
        const d = dueLabel(t.dueDate);
        return (
          <LinkRow key={t.id} href={href(`work-items/${t.id}`)}>
            <Avatar person={lk.person(t.assigneeId)} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate">{t.key} · {t.title}</p>
              <p className="text-[11px] text-[var(--color-text-muted)] truncate">{lk.project(t.projectId)?.name} · {lk.person(t.assigneeId)?.name ?? "Unassigned"}</p>
            </div>
            <span className="hidden sm:inline-flex"><TaskStatusBadge status={t.status} /></span>
            <StatusBadge label={d.label} tone={d.tone} />
          </LinkRow>
        );
      })}
    </div>
  );

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Delivery" }, { label: "Deadlines" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Deadlines & overdue work"
      description="Dates are local calendar days; overdue means past the due date and not done."
      status={status}
      onRetry={retry}
    >
      <KpiGrid>
        <KpiTile label="Overdue tasks" value={overdue.length} icon={AlarmClockOff} tone="rose" chip={{ label: overdue.length ? "Chase today" : "Clear", tone: overdue.length ? "danger" : "success" }} footer="See below" href="#overdue" />
        <KpiTile label="Due in 7 days" value={week.length} icon={CalendarClock} tone="amber" footer="This week" href="#week" />
        <KpiTile label="Later" value={later.length} icon={CalendarCheck2} tone="blue" footer="Planned" href="#later" />
        <KpiTile label="Open milestones" value={milestones.length} icon={Flag} tone="violet" footer="Milestones" href="#milestones" />
      </KpiGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel className="xl:col-span-2" title="Overdue" description="Past due and not done" icon={AlarmClockOff} iconTone="rose">
          <div id="overdue" className="scroll-mt-20"><TaskList items={overdue} empty="Nothing overdue." /></div>
        </Panel>
        <Panel title="Due ahead" description="Tasks vs milestones per week" icon={CalendarClock} iconTone="amber">
          <GroupedBarChart data={buckets} primaryLabel="Tasks" secondaryLabel="Milestones" primaryColor="#3B82F6" secondaryColor="#8B5CF6" height={220} />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Due in the next 7 days" icon={CalendarClock} iconTone="amber">
          <div id="week" className="scroll-mt-20"><TaskList items={week} empty="Nothing due this week." /></div>
        </Panel>
        <Panel title="Milestones" icon={Flag} iconTone="violet">
          <div id="milestones" className="scroll-mt-20 space-y-0.5">
            {milestones.length === 0 && <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No open milestones.</p>}
            {milestones.map((m) => {
              const d = dueLabel(m.dueDate);
              return (
                <LinkRow key={m.id} href={href(`projects/${m.project.id}`)}>
                  <span className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: m.project.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{m.name}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">{m.project.name} · {formatDate(m.dueDate, true)} · {m.progress}%</p>
                  </div>
                  <StatusBadge label={m.status === "LATE" ? "Late" : d.label} tone={m.status === "LATE" ? "danger" : d.tone} />
                </LinkRow>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="Later" description="More than a week away" icon={CalendarCheck2}>
        <div id="later" className="scroll-mt-20"><TaskList items={later} empty="Nothing scheduled later." /></div>
      </Panel>
    </PageFrame>
  );
}

/** Task 2.3: real deadlines by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function ManagerDeadlinesPage() {
  const params = useParams();
  const home = `/org/${(params?.orgId as string) || ""}/manager`;
  if (previewEnabled()) return <PreviewManagerDeadlinesPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <DeadlinesView crumbs={[{ label: "Project Manager", href: home }]} back={{ href: home, label: "Back to dashboard" }}
        projectHref={(project) => `${home}/projects/${project.id}`} />
    </RequireAnyKey>
  );
}
