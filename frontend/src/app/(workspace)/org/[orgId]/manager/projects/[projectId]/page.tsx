"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Circle, Flag, ListTodo, Scale, ShieldAlert, TrendingUp, UserPlus, Users } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import {
  Avatar,
  ButtonLink,
  DataTable,
  HealthBadge,
  LinkRow,
  NotFoundState,
  PageFrame,
  Panel,
  PriorityBadge,
  ProgressBar,
  SeverityBadge,
  StatPill,
  StatusBadge,
  TaskStatusBadge,
  dueLabel,
  formatDate,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { GaugeRing, TrendAreaChart } from "@/components/delivery/DeliveryCharts";

const MILESTONE_TONE = { DONE: "success", IN_PROGRESS: "info", UPCOMING: "neutral", LATE: "danger" } as const;
const MILESTONE_LABEL = { DONE: "Done", IN_PROGRESS: "In progress", UPCOMING: "Upcoming", LATE: "Late" } as const;

export default function ManagerProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const href = useRoleHref("manager");
  const { status, retry } = useDemoLoad();
  const lk = useLookups();
  const project = useDeliveryStore((s) => s.projects.find((p) => p.id === projectId));
  const allTasks = useDeliveryStore((s) => s.tasks);
  const blockers = useDeliveryStore((s) => s.blockers);
  const scopeChanges = useDeliveryStore((s) => s.scopeChanges);

  const tasks = useMemo(() => allTasks.filter((t) => t.projectId === projectId), [allTasks, projectId]);
  const openBlockers = blockers.filter((b) => b.projectId === projectId && b.status === "OPEN");
  const changes = scopeChanges.filter((c) => c.projectId === projectId);
  const back = { href: href("projects"), label: "Back to portfolio" };

  if (status === "ready" && !project) {
    return (
      <PageFrame crumbs={[{ label: "Manager", href: href() }, { label: "Portfolio", href: href("projects") }, { label: "Not found" }]} back={back} title="Project">
        <NotFoundState what="Project" back={back} />
      </PageFrame>
    );
  }

  const due = project ? dueLabel(project.dueDate) : null;

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Portfolio", href: href("projects") }, { label: project?.name ?? "Project" }]}
      back={back}
      title={project?.name ?? "Project"}
      description={project ? `${project.client} · ${project.mode === "INDIVIDUAL" ? "Individual mode" : "Structured mode"} · ${formatDate(project.startDate, true)} → ${formatDate(project.dueDate, true)}` : undefined}
      badge={project?.code}
      status={status}
      onRetry={retry}
      skeleton="detail"
      actions={
        <ButtonLink href={href(`team-assignments?project=${projectId}`)}>
          <UserPlus className="w-3.5 h-3.5" /> Assign work
        </ButtonLink>
      }
    >
      {project && due && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatPill label="Health" value={<HealthBadge health={project.health} />} />
            <StatPill label="Progress" value={`${project.progress}%`} tone={project.progress >= project.plannedProgress ? "success" : "warning"} />
            <StatPill label="Planned today" value={`${project.plannedProgress}%`} />
            <StatPill label="Budget used" value={`${project.budgetUsed}%`} tone={project.budgetUsed > project.progress + 10 ? "warning" : "neutral"} />
            <StatPill label="Open blockers" value={openBlockers.length} tone={openBlockers.length ? "danger" : "success"} />
            <StatPill label="Final delivery" value={due.label} tone={due.tone === "danger" ? "danger" : "neutral"} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel className="xl:col-span-2" title="Progress vs plan" description="Weekly approved progress. Git activity is evidence only." icon={TrendingUp} iconTone="emerald">
              <TrendAreaChart
                data={project.progressTrend}
                xKey="week"
                unit="%"
                series={[
                  { key: "actual", label: "Actual", color: project.color },
                  { key: "planned", label: "Planned", color: "#94A3B8", dashed: true },
                ]}
              />
            </Panel>
            <Panel title="Milestones" description={project.description} icon={Flag} iconTone="amber">
              <div className="flex justify-center pb-3">
                <GaugeRing value={project.progress} color={project.color} label="complete" size={120} />
              </div>
              <ol className="space-y-2.5">
                {project.milestones.length === 0 && <p className="text-xs text-center text-[var(--color-text-muted)]">No milestones yet.</p>}
                {project.milestones.map((ms) => (
                  <li key={ms.id} className="flex items-start gap-2.5">
                    {ms.status === "DONE" ? (
                      <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className={`w-4 h-4 mt-0.5 shrink-0 ${ms.status === "LATE" ? "text-rose-500" : "text-[var(--color-text-muted)]"}`} />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold truncate">{ms.name}</p>
                        <StatusBadge label={MILESTONE_LABEL[ms.status]} tone={MILESTONE_TONE[ms.status]} />
                      </div>
                      <p className="text-[11px] text-[var(--color-text-muted)]">Due {formatDate(ms.dueDate, true)}</p>
                      <ProgressBar value={ms.progress} size="sm" color={project.color} />
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <Panel title="Tasks" description={`${tasks.length} tasks · click a task to open it`} icon={ListTodo} bodyClassName="p-0" action={{ label: "Assign new", href: href(`team-assignments?project=${projectId}`) }}>
            <DataTable
              rows={tasks}
              rowHref={(t) => href(`work-items/${t.id}`)}
              empty={{ icon: ListTodo, title: "No tasks yet", description: "Assign work to start this project." }}
              columns={[
                {
                  key: "title",
                  header: "Task",
                  className: "w-[48%] md:w-[36%]",
                  render: (t) => (
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{t.title}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{t.key}</p>
                    </div>
                  ),
                },
                { key: "status", header: "Status", render: (t) => <TaskStatusBadge status={t.status} /> },
                { key: "owner", header: "Owner", hideBelow: "sm", render: (t) => (
                  <span className="flex items-center gap-2 min-w-0"><Avatar person={lk.person(t.assigneeId)} size="sm" /><span className="truncate">{lk.person(t.assigneeId)?.name ?? "Unassigned"}</span></span>
                ) },
                { key: "priority", header: "Priority", hideBelow: "lg", render: (t) => <PriorityBadge priority={t.priority} /> },
                { key: "due", header: "Due", hideBelow: "md", render: (t) => { const d = dueLabel(t.dueDate, t.status === "DONE"); return <StatusBadge label={d.label} tone={d.tone} />; } },
              ]}
            />
          </Panel>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title="Risks" description="Open risks and mitigations" icon={ShieldAlert} iconTone="rose" action={{ label: "Risk register", href: href("risks") }}>
              <div className="space-y-3">
                {project.risks.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No open risks.</p>}
                {project.risks.map((r) => (
                  <div key={r.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold">{r.title}</p>
                      <SeverityBadge severity={r.severity} />
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">{r.mitigation}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Owner {lk.person(r.ownerId)?.name} · raised {formatDate(r.raisedAt)}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Team" description="Click a person to see their workload" icon={Users} iconTone="violet">
              <div className="space-y-0.5">
                {project.memberIds.map((id) => {
                  const p = lk.person(id);
                  if (!p) return null;
                  const pct = Math.round((p.assignedHours / p.capacityHours) * 100);
                  return (
                    <LinkRow key={id} href={href(`workload/${id}`)}>
                      <Avatar person={p} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{p.name}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)] truncate">{p.title}</p>
                      </div>
                      <StatusBadge label={`${pct}%`} tone={pct > 100 ? "danger" : pct >= 85 ? "warning" : "success"} />
                    </LinkRow>
                  );
                })}
              </div>
            </Panel>
            <Panel title="Scope changes" description="Requests affecting this project" icon={Scale} iconTone="cyan">
              <div className="space-y-0.5">
                {changes.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No scope changes.</p>}
                {changes.map((c) => (
                  <LinkRow key={c.id} href={href(`scope/${c.id}`)}>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{c.code} · {c.title}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">{c.impactDays > 0 ? "+" : ""}{c.impactDays} days · {c.impactHours}h</p>
                    </div>
                    <StatusBadge label={c.status === "PENDING" ? "Pending" : c.status === "APPROVED" ? "Approved" : "Rejected"} tone={c.status === "PENDING" ? "warning" : c.status === "APPROVED" ? "success" : "danger"} />
                  </LinkRow>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </PageFrame>
  );
}
