"use client";

import React, { useMemo } from "react";
import {
  Activity,
  AlarmClockOff,
  CalendarDays,
  CircleDot,
  GitBranch,
  ListChecks,
  MessageSquareText,
  OctagonAlert,
  UserPlus,
  Users,
} from "lucide-react";
import { DEMO_TODAY, LEAD_ACTIVITY, LEAD_DAILY_COMPLETION, VIEWERS, type TaskStatus } from "@/mocks/delivery-dashboards";
import {
  Avatar,
  AvatarStack,
  ButtonLink,
  Dot,
  KpiGrid,
  KpiTile,
  LinkRow,
  PageFrame,
  Panel,
  SeverityBadge,
  StatusBadge,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
  daysFromToday,
  dueLabel,
  formatDate,
  formatDateTime,
  useDemoLoad,
  useLookups,
  useRoleHref,
  utilisationTone,
} from "@/components/delivery/DeliveryUI";
import { DonutChart, GroupedBarChart, HorizontalBarChart } from "@/components/delivery/DeliveryCharts";
import { useLeadTeam } from "@/components/delivery/useLeadTeam";

const STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"];

export default function TeamLeadDashboardPage() {
  const href = useRoleHref("lead");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const t = useLeadTeam(forceEmpty);

  const m = useMemo(() => {
    const open = t.tasks.filter((x) => x.status !== "DONE");
    const today = open.filter((x) => daysFromToday(x.dueDate) === 0);
    const overdue = open.filter((x) => daysFromToday(x.dueDate) < 0);
    const openBlockers = t.blockers.filter((b) => b.status === "OPEN");
    const due = t.checkIns.filter((c) => c.status !== "SUBMITTED");
    const avg = t.members.length ? Math.round(t.members.reduce((s, x) => s + x.pct, 0) / t.members.length) : 0;
    return {
      open,
      today,
      overdue,
      openBlockers,
      due,
      avg,
      inProgress: t.tasks.filter((x) => x.status === "IN_PROGRESS").length,
      byStatus: STATUSES.map((s) => ({ name: TASK_STATUS_LABEL[s], value: t.tasks.filter((x) => x.status === s).length, color: TASK_STATUS_COLOR[s] })),
      deps: t.dependencies.filter((d) => d.status !== "RESOLVED"),
    };
  }, [t]);

  const focus = [...m.overdue, ...m.today];

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "Dashboard" }]}
      title={`${t.team.name} · stand-up view`}
      description={`Hi ${VIEWERS.lead.name.split(" ")[0]} — ${formatDate(DEMO_TODAY, true)}. ${m.today.length} due today, ${m.overdue.length} overdue, ${m.due.length} check-ins outstanding.`}
      badge="Team Lead"
      status={status}
      onRetry={retry}
      actions={
        <>
          <ButtonLink href={href("check-ins")} variant="outline">
            <MessageSquareText className="w-3.5 h-3.5" /> Check-ins
          </ButtonLink>
          <ButtonLink href={href("assignments")}>
            <UserPlus className="w-3.5 h-3.5" /> Assign work
          </ButtonLink>
        </>
      }
    >
      <KpiGrid>
        <KpiTile
          label="Team members"
          value={t.members.length}
          icon={Users}
          tone="violet"
          chip={{ label: `${m.avg}% avg load`, tone: m.avg > 100 ? "danger" : m.avg >= 85 ? "warning" : "success" }}
          meta={<AvatarStack people={t.members} max={5} />}
          footer="Open members"
          href={href("team")}
        />
        <KpiTile
          label="In progress"
          value={m.inProgress}
          icon={CircleDot}
          tone="blue"
          chip={{ label: `${m.open.length} open`, tone: "info" }}
          meta={<><span className="inline-flex items-center gap-1"><Dot className="bg-violet-500" />{t.tasks.filter((x) => x.status === "IN_REVIEW").length} in review</span><span>•</span><span>{t.tasks.filter((x) => x.status === "TODO").length} to do</span></>}
          footer="Tasks by status"
          href={href("work-items")}
        />
        <KpiTile label="Due today" value={m.today.length} icon={CalendarDays} tone="amber" chip={{ label: "Today", tone: "warning" }} meta={<span>{m.today.map((x) => x.key).join(", ") || "Nothing due"}</span>} footer="Today's work" href={href("today")} />
        <KpiTile label="Overdue" value={m.overdue.length} icon={AlarmClockOff} tone="rose" chip={{ label: m.overdue.length ? "Chase" : "Clear", tone: m.overdue.length ? "danger" : "success" }} meta={<span>Oldest {m.overdue.length ? `${Math.max(...m.overdue.map((x) => -daysFromToday(x.dueDate)))}d late` : "—"}</span>} footer="Overdue work" href={href("today")} />
        <KpiTile label="Blockers" value={m.openBlockers.length} icon={OctagonAlert} tone="pink" chip={{ label: `${m.openBlockers.filter((b) => b.severity === "CRITICAL").length} critical`, tone: "danger" }} meta={<span>Unblock first thing</span>} footer="Resolve blockers" href={href("blockers")} />
        <KpiTile label="Check-ins due" value={m.due.length} icon={MessageSquareText} tone="teal" chip={{ label: `${t.checkIns.filter((c) => c.status === "OVERDUE").length} late`, tone: "warning" }} meta={<span>{t.checkIns.filter((c) => c.status === "SUBMITTED").length} submitted today</span>} footer="Check-ins" href={href("check-ins")} />
      </KpiGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">
        <Panel className="xl:col-span-2" title="Today's focus" description="Overdue and due-today tasks for the team" icon={CalendarDays} iconTone="amber" action={{ label: "Today & overdue", href: href("today") }}>
          {focus.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--color-text-muted)]">Nothing due today. Enjoy the calm.</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
              {focus.map((x) => {
                const d = dueLabel(x.dueDate);
                return (
                  <LinkRow key={x.id} href={href(`work-items/${x.id}`)}>
                    <Avatar person={lk.person(x.assigneeId)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{x.key} · {x.title}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{lk.person(x.assigneeId)?.name ?? "Unassigned"} · {x.progress}%</p>
                    </div>
                    <StatusBadge label={d.label} tone={d.tone} />
                  </LinkRow>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel title="Tasks by status" description="All team work" icon={ListChecks} action={{ label: "Board", href: href("work-items") }}>
          <DonutChart data={m.byStatus} centerLabel="tasks" />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 min-w-0">
        <Panel title="Member workload" description="Assigned vs weekly capacity" icon={Users} iconTone="violet" action={{ label: "Workload", href: href("workload") }}>
          <HorizontalBarChart valueLabel="Load" data={t.members.map((x) => ({ name: x.name.split(" ")[0], value: x.pct, color: utilisationTone(x.pct).color }))} />
        </Panel>
        <Panel title="Blockers" description="Open impediments on team tasks" icon={OctagonAlert} iconTone="rose" action={{ label: "All", href: href("blockers") }}>
          <div className="space-y-0.5">
            {m.openBlockers.length === 0 && <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No blockers.</p>}
            {m.openBlockers.map((b) => (
              <LinkRow key={b.id} href={href(`blockers/${b.id}`)}>
                <Avatar person={lk.person(b.raisedById)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{b.title}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">{lk.task(b.taskId)?.key} · {Math.abs(daysFromToday(b.raisedAt))}d open</p>
                </div>
                <SeverityBadge severity={b.severity} />
              </LinkRow>
            ))}
          </div>
        </Panel>
        <Panel title="Check-ins due" description="Daily updates from the team" icon={MessageSquareText} iconTone="teal" action={{ label: "All", href: href("check-ins") }} className="lg:col-span-2 2xl:col-span-1">
          <div className="space-y-0.5">
            {m.due.length === 0 && <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">Everyone has checked in.</p>}
            {m.due.map((c) => (
              <LinkRow key={c.id} href={href(`team/${c.memberId}`)}>
                <Avatar person={lk.person(c.memberId)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{lk.person(c.memberId)?.name}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">Last: {c.lastSummary}</p>
                </div>
                <StatusBadge label={c.status === "OVERDUE" ? "Late" : `Due ${formatDateTime(c.dueAt).split(", ")[1] ?? ""}`} tone={c.status === "OVERDUE" ? "danger" : "warning"} />
              </LinkRow>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">
        <Panel title="Dependencies" description="Open links that can stall the team" icon={GitBranch} iconTone="cyan" action={{ label: "All", href: href("dependencies") }}>
          <div className="space-y-0.5">
            {m.deps.length === 0 && <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No open dependencies.</p>}
            {m.deps.map((d) => (
              <LinkRow key={d.id} href={href(`work-items/${d.toTaskId}`)}>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{lk.task(d.fromTaskId)?.key} → {lk.task(d.toTaskId)?.key}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">{d.note}</p>
                </div>
                <StatusBadge label={d.status === "AT_RISK" ? "At risk" : "Open"} tone={d.status === "AT_RISK" ? "danger" : "warning"} />
              </LinkRow>
            ))}
          </div>
        </Panel>
        <Panel title="This week" description="Tasks finished vs reopened per day" icon={Activity} iconTone="emerald">
          <GroupedBarChart data={LEAD_DAILY_COMPLETION} primaryLabel="Finished" secondaryLabel="Reopened" primaryColor="#8B5CF6" secondaryColor="#F43F5E" height={210} />
        </Panel>
        <Panel title="Team activity" icon={Activity} iconTone="blue">
          <ol className="space-y-3">
            {LEAD_ACTIVITY.map((a) => (
              <li key={a.id} className="flex items-start gap-3">
                <Avatar person={lk.person(a.actorId)} size="sm" />
                <div className="min-w-0 text-xs">
                  <p className="leading-snug"><span className="font-semibold">{lk.person(a.actorId)?.name}</span> <span className="text-[var(--color-text-secondary)]">{a.action}</span> <span className="font-medium">{a.target}</span></p>
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{formatDateTime(a.at)}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </PageFrame>
  );
}
