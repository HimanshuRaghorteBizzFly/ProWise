"use client";

import React, { useMemo } from "react";
import {
  Activity,
  CalendarClock,
  FolderKanban,
  FolderPlus,
  Gauge,
  OctagonAlert,
  Scale,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { DEMO_TODAY, MANAGER_ACTIVITY, MANAGER_THROUGHPUT, VIEWERS } from "@/mocks/delivery-dashboards";
import {
  Avatar,
  AvatarStack,
  ButtonLink,
  DataTable,
  Dot,
  HealthBadge,
  KpiGrid,
  KpiTile,
  LinkRow,
  PageFrame,
  Panel,
  ProgressBar,
  SeverityBadge,
  StatusBadge,
  dueLabel,
  formatDate,
  formatDateTime,
  daysFromToday,
  useDemoLoad,
  useLookups,
  useRoleHref,
  utilisationTone,
} from "@/components/delivery/DeliveryUI";
import { DonutChart, GroupedBarChart, HorizontalBarChart } from "@/components/delivery/DeliveryCharts";

 export default function ManagerDashboardPage() {
  const href = useRoleHref("manager");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allProjects = useDeliveryStore((s) => s.projects);
  const tasks = useDeliveryStore((s) => s.tasks);
  const blockers = useDeliveryStore((s) => s.blockers);
  const scopeChanges = useDeliveryStore((s) => s.scopeChanges);
  const people = useDeliveryStore((s) => s.people);

  const projects = useMemo(
    () => (forceEmpty ? [] : allProjects.filter((p) => p.managerId === VIEWERS.manager.id)),
    [allProjects, forceEmpty]
  );

  const m = useMemo(() => {
    const active = projects.filter((p) => p.status === "ACTIVE");
    const projectIds = new Set(projects.map((p) => p.id));
    const myTasks = tasks.filter((t) => projectIds.has(t.projectId));
    const overdue = myTasks.filter((t) => t.status !== "DONE" && daysFromToday(t.dueDate) < 0);
    const openBlockers = blockers.filter((b) => b.status === "OPEN" && projectIds.has(b.projectId));
    const pendingScope = scopeChanges.filter((c) => c.status === "PENDING" && projectIds.has(c.projectId));
    const avg = projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0;
    const avgPlanned = projects.length ? Math.round(projects.reduce((s, p) => s + p.plannedProgress, 0) / projects.length) : 0;
    const health = {
      on: projects.filter((p) => p.health === "ON_TRACK").length,
      risk: projects.filter((p) => p.health === "AT_RISK").length,
      off: projects.filter((p) => p.health === "OFF_TRACK").length,
    };
    const deadlines = [
      ...projects.flatMap((p) =>
        p.milestones
          .filter((ms) => ms.status !== "DONE")
          .map((ms) => ({ id: ms.id, title: ms.name, sub: p.name, date: ms.dueDate, href: href(`projects/${p.id}`), kind: "Milestone", color: p.color }))
      ),
      ...myTasks
        .filter((t) => t.status !== "DONE")
        .map((t) => ({ id: t.id, title: `${t.key} · ${t.title}`, sub: lk.project(t.projectId)?.name ?? "", date: t.dueDate, href: href(`work-items/${t.id}`), kind: "Task", color: lk.project(t.projectId)?.color ?? "#3B82F6" })),
    ]
      .filter((d) => daysFromToday(d.date) <= 10)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7);
    const memberIds = new Set(projects.flatMap((p) => p.memberIds));
    const team = people
      .filter((p) => memberIds.has(p.id))
      .map((p) => ({ ...p, pct: Math.round((p.assignedHours / p.capacityHours) * 100) }))
      .sort((a, b) => b.pct - a.pct);
    const risks = projects
      .flatMap((p) => p.risks.map((r) => ({ ...r, project: p })))
      .sort((a, b) => ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(a.severity) - ["CRITICAL", "HIGH", "MEDIUM", "LOW"].indexOf(b.severity));
    return { active, overdue, openBlockers, pendingScope, avg, avgPlanned, health, deadlines, team, risks, myTasks };
  }, [projects, tasks, blockers, scopeChanges, people, href, lk]);

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Dashboard" }]}
      title={`Good morning, ${VIEWERS.manager.name.split(" ")[0]}`}
      description={`Your portfolio on ${formatDate(DEMO_TODAY, true)} — ${projects.length} projects, ${m.overdue.length} overdue items and ${m.openBlockers.length} open blockers.`}
      badge="Project Manager"
      status={status}
      onRetry={retry}
      actions={
        <>
          <ButtonLink href={href("team-assignments")} variant="outline">
            <UserPlus className="w-3.5 h-3.5" /> Assign work
          </ButtonLink>
          <ButtonLink href={href("create-project")}>
            <FolderPlus className="w-3.5 h-3.5" /> Create project
          </ButtonLink>
        </>
      }
    >
      <KpiGrid>
        <KpiTile
          label="Active projects"
          value={m.active.length}
          icon={FolderKanban}
          tone="blue"
          chip={{ label: `${projects.length} total`, tone: "info" }}
          meta={
            <>
              <span className="inline-flex items-center gap-1"><Dot className="bg-emerald-500" />{m.health.on} on track</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1"><Dot className="bg-amber-500" />{m.health.risk} at risk</span>
            </>
          }
          footer="Open portfolio"
          href={href("projects")}
        />
        <KpiTile
          label="Average progress"
          value={`${m.avg}%`}
          icon={TrendingUp}
          tone="emerald"
          chip={{ label: `${m.avg - m.avgPlanned >= 0 ? "+" : ""}${m.avg - m.avgPlanned} vs plan`, tone: m.avg >= m.avgPlanned ? "success" : "warning" }}
          meta={<span>Planned {m.avgPlanned}% · self-reported & approved</span>}
          footer="Progress by project"
          href={href("progress")}
        />
        <KpiTile
          label="Health & risks"
          value={m.health.risk + m.health.off}
          icon={ShieldAlert}
          tone="amber"
          chip={{ label: `${m.health.off} off track`, tone: m.health.off ? "danger" : "success" }}
          meta={<span>{m.risks.length} open risks · {m.risks.filter((r) => r.severity === "CRITICAL").length} critical</span>}
          footer="Review risks"
          href={href("risks")}
        />
        <KpiTile
          label="Overdue work"
          value={m.overdue.length}
          icon={CalendarClock}
          tone="rose"
          chip={{ label: m.overdue.length ? "Action needed" : "Clear", tone: m.overdue.length ? "danger" : "success" }}
          meta={<span>{m.deadlines.length} deadlines in next 10 days</span>}
          footer="Deadlines"
          href={href("deadlines")}
        />
        <KpiTile
          label="Open blockers"
          value={m.openBlockers.length}
          icon={OctagonAlert}
          tone="violet"
          chip={{ label: `${m.openBlockers.filter((b) => b.severity === "CRITICAL").length} critical`, tone: "danger" }}
          meta={<span>Oldest raised {m.openBlockers.length ? formatDate(m.openBlockers.map((b) => b.raisedAt).sort()[0]) : "—"}</span>}
          footer="Blockers"
          href={href("blockers")}
        />
        <KpiTile
          label="Scope changes"
          value={m.pendingScope.length}
          icon={Scale}
          tone="cyan"
          chip={{ label: "Pending", tone: "warning" }}
          meta={<span>+{m.pendingScope.reduce((s, c) => s + c.impactDays, 0)} days if all approved</span>}
          footer="Decide changes"
          href={href("scope")}
        />
      </KpiGrid>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">
        <Panel
          className="xl:col-span-2"
          title="Progress per project"
          description="Approved completion against today's plan"
          icon={Gauge}
          action={{ label: "Details", href: href("progress") }}
        >
          {projects.length ? (
            <HorizontalBarChart
              data={projects.map((p) => ({ name: p.code + " " + p.name.split(" ")[0], value: p.progress, color: p.color }))}
              max={100}
              valueLabel="Progress"
            />
          ) : (
            <p className="py-10 text-center text-xs text-[var(--color-text-muted)]">No projects yet. Create your first project to see progress.</p>
          )}
        </Panel>
        <Panel title="Portfolio health" description="Share of projects by health" icon={ShieldAlert} iconTone="amber" action={{ label: "Risks", href: href("risks") }}>
          <DonutChart
            centerLabel="projects"
            data={[
              { name: "On track", value: m.health.on, color: "#10B981" },
              { name: "At risk", value: m.health.risk, color: "#F59E0B" },
              { name: "Off track", value: m.health.off, color: "#EF4444" },
            ]}
          />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 min-w-0">
        <Panel title="Upcoming deadlines" description="Milestones and tasks due in the next 10 days" icon={CalendarClock} iconTone="rose" action={{ label: "All", href: href("deadlines") }}>
          <div className="space-y-0.5">
            {m.deadlines.length === 0 && <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">Nothing due soon.</p>}
            {m.deadlines.map((d) => {
              const due = dueLabel(d.date);
              return (
                <LinkRow key={d.id} href={d.href}>
                  <span className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{d.title}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">{d.kind} · {d.sub}</p>
                  </div>
                  <StatusBadge label={due.label} tone={due.tone} />
                </LinkRow>
              );
            })}
          </div>
        </Panel>

        <Panel title="Team workload" description="Assigned hours vs weekly capacity" icon={Users} iconTone="violet" action={{ label: "Workload", href: href("workload") }}>
          <div className="space-y-2.5">
            {m.team.slice(0, 7).map((p) => {
              const u = utilisationTone(p.pct);
              return (
                <LinkRow key={p.id} href={href(`workload/${p.id}`)} className="py-1.5">
                  <Avatar person={p} size="sm" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium truncate">{p.name}</span>
                      <span className="font-semibold tabular-nums" style={{ color: u.color }}>{p.pct}%</span>
                    </div>
                    <ProgressBar value={Math.min(p.pct, 100)} color={u.color} size="sm" />
                  </div>
                </LinkRow>
              );
            })}
          </div>
        </Panel>

        <Panel title="Blockers" description="Open impediments across your projects" icon={OctagonAlert} iconTone="violet" action={{ label: "All", href: href("blockers") }} className="lg:col-span-2 2xl:col-span-1">
          <div className="space-y-0.5">
            {m.openBlockers.length === 0 && <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No open blockers.</p>}
            {m.openBlockers.map((b) => (
              <LinkRow key={b.id} href={href(`work-items/${b.taskId}`)}>
                <Avatar person={lk.person(b.ownerId)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{b.title}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">
                    {lk.task(b.taskId)?.key} · {lk.project(b.projectId)?.name} · {Math.abs(daysFromToday(b.raisedAt))}d open
                  </p>
                </div>
                <SeverityBadge severity={b.severity} />
              </LinkRow>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 min-w-0">
        <Panel className="xl:col-span-2" title="My portfolio" description="Click a project to open it" icon={FolderKanban} action={{ label: "Portfolio", href: href("projects") }} bodyClassName="p-0">
          <DataTable
            rows={projects}
            rowHref={(p) => href(`projects/${p.id}`)}
            empty={{ icon: FolderKanban, title: "No projects", description: "Create a project to start tracking delivery." }}
            columns={[
              {
                key: "name",
                header: "Project",
                className: "w-[44%] sm:w-[34%]",
                render: (p) => (
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="h-8 w-8 rounded-lg text-[10px] font-bold text-white flex items-center justify-center shrink-0" style={{ backgroundColor: p.color }}>{p.code}</span>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{p.client}</p>
                    </div>
                  </div>
                ),
              },
              { key: "health", header: "Health", hideBelow: "sm", render: (p) => <HealthBadge health={p.health} /> },
              { key: "progress", header: "Progress", render: (p) => <ProgressBar value={p.progress} planned={p.plannedProgress} color={p.color} showLabel /> },
              { key: "due", header: "Due", hideBelow: "md", render: (p) => <span className="tabular-nums">{formatDate(p.dueDate, true)}</span> },
              { key: "team", header: "Team", hideBelow: "lg", render: (p) => <AvatarStack people={p.memberIds.map((id) => lk.person(id)).filter((x): x is NonNullable<typeof x> => Boolean(x))} /> },
            ]}
          />
        </Panel>
        <Panel title="Throughput" description="Tasks completed vs new work added per week" icon={Activity} iconTone="emerald">
          <GroupedBarChart data={MANAGER_THROUGHPUT} primaryLabel="Completed" secondaryLabel="Added" primaryColor="#10B981" secondaryColor="#F59E0B" />
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        <Panel title="Scope changes awaiting decision" description="Approve or reject on the change page" icon={Scale} iconTone="cyan" action={{ label: "All changes", href: href("scope") }}>
          <div className="space-y-0.5">
            {m.pendingScope.length === 0 && <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">No pending scope changes.</p>}
            {m.pendingScope.map((c) => (
              <LinkRow key={c.id} href={href(`scope/${c.id}`)}>
                <span className="rounded-md bg-cyan-500/12 text-cyan-700 dark:text-cyan-300 px-1.5 py-0.5 text-[10px] font-bold shrink-0">{c.code}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{c.title}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">{lk.project(c.projectId)?.name} · {c.requestedBy}</p>
                </div>
                <StatusBadge label={`${c.impactDays > 0 ? "+" : ""}${c.impactDays}d`} tone={c.impactDays > 0 ? "warning" : "success"} />
              </LinkRow>
            ))}
          </div>
        </Panel>
        <Panel title="Recent activity" description="Latest changes across your projects" icon={Activity} iconTone="blue">
          <ol className="relative space-y-3 before:absolute before:left-[11px] before:top-1 before:bottom-1 before:w-px before:bg-[var(--color-border)]">
            {MANAGER_ACTIVITY.map((a) => (
              <li key={a.id} className="relative flex items-start gap-3 pl-0">
                <Avatar person={lk.person(a.actorId)} size="sm" />
                <div className="min-w-0 text-xs">
                  <p className="leading-snug">
                    <span className="font-semibold">{lk.person(a.actorId)?.name}</span>{" "}
                    <span className="text-[var(--color-text-secondary)]">{a.action}</span>{" "}
                    <span className="font-medium">{a.target}</span>
                  </p>
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
