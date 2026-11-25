"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bug,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  FolderGit2,
  GitBranch,
  GitPullRequest,
  Layers,
  ListChecks,
  MessageSquareWarning,
  ShieldAlert,
  UserCheck,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  DeveloperCalendarEvent,
  DeveloperDashboardSummary,
  DeveloperGitHubEvent,
  DeveloperProject,
  DeveloperWorkItem,
} from "@/lib/developer-api";
import type * as W from "@/types/work";
import { ButtonLink, EmptyStateView, ErrorBanner, Panel, StatusBadge, SurfaceCard } from "@/components/delivery/DeliveryUI";
import type { StatusTone } from "@/app/(platform)/super-admin/_components/SuperAdminPrimitives";
import {
  DecisionBadge,
  SectionGate,
  WorkStateBadge,
  dateText,
  dateTimeText,
  instantDateText,
  instantText,
  isOverdue,
  parseInstant,
  relativeText,
} from "@/components/developer/DevUI";
import type { LoadState } from "@/components/org-console/useRoleApi";

/*
 * Developer dashboard view. Pure presentation over real API responses passed in as load states:
 *   KPIs, priority / blocked tasks, task deadlines, GitHub evidence  <- GET /v1/developer/dashboard
 *   mode highlight cards, project target dates                       <- GET /v1/developer/projects
 *   structured "N% Calculated" / "Not measurable"                    <- GET /v1/projects/{id}/structured-progress
 *   calendar deadlines                                                <- GET /v1/developer/calendar
 *   work in progress / blockers / review feedback                     <- GET /v1/me/work-items | blockers | review-feedback
 * Progress is never derived here from Git activity, elapsed time or task counts (rule 9).
 */

export interface DeveloperDashboardViewProps {
  base: string;
  dashboard: LoadState<DeveloperDashboardSummary>;
  projects: LoadState<DeveloperProject[]>;
  work: LoadState<W.WorkItemDto[]>;
  blockers: LoadState<W.WorkBlockerDto[]>;
  feedback: LoadState<W.FeedbackViewDto[]>;
  calendar: LoadState<DeveloperCalendarEvent[]>;
  /** Hook (or fixture) returning the structured progress of one project; called unconditionally by the card. */
  useStructuredProgress: (projectId: string) => LoadState<W.StructuredProgressDto>;
  now?: Date;
}

export const INDIVIDUAL_MODE_TEXT =
  "Direct developer check-in model. No mandatory task boards. Authors directly update percentage progress and delivery milestones weekly.";
export const STRUCTURED_MODE_TEXT =
  "Approved baseline weights, task state transitions, leaf evidence reviews, and dependency tracking.";

const CLOSED_PROJECT = new Set(["COMPLETED", "ARCHIVED", "CANCELLED", "CLOSED"]);
const PRIORITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

/** Projects of one mode, open ones first, then by nearest target date (no date last). */
export function projectsOfMode(projects: DeveloperProject[], mode: "INDIVIDUAL" | "STRUCTURED"): DeveloperProject[] {
  const time = (p: DeveloperProject) => parseInstant(p.targetCompletionDate)?.getTime() ?? Number.POSITIVE_INFINITY;
  return projects
    .filter((p) => p.mode === mode)
    .sort((a, b) => {
      const closed = Number(CLOSED_PROJECT.has((a.status ?? "").toUpperCase())) - Number(CLOSED_PROJECT.has((b.status ?? "").toUpperCase()));
      return closed !== 0 ? closed : time(a) - time(b);
    });
}

function stateFailure<T>(state: LoadState<T>, what: string): { message: string; retry?: () => void } | null {
  if (state.kind === "loading" || state.kind === "ready") return null;
  if (state.kind === "error") return { message: `${what} could not be loaded.`, retry: state.retry };
  if (state.kind === "unauthenticated") return { message: "Your session has ended. Sign in again." };
  return { message: `You no longer have access to ${what}.` };
}

/* ------------------------------------------------------------------ KPI row */

const BORDER: Record<string, { border: string; text: string }> = {
  blue: { border: "border-l-blue-500", text: "text-blue-600 dark:text-blue-400" },
  cyan: { border: "border-l-cyan-500", text: "text-cyan-600 dark:text-cyan-400" },
  violet: { border: "border-l-violet-500", text: "text-violet-600 dark:text-violet-400" },
  emerald: { border: "border-l-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  amber: { border: "border-l-amber-500", text: "text-amber-600 dark:text-amber-400" },
  rose: { border: "border-l-rose-500", text: "text-rose-600 dark:text-rose-400" },
  orange: { border: "border-l-orange-500", text: "text-orange-600 dark:text-orange-400" },
  indigo: { border: "border-l-indigo-500", text: "text-indigo-600 dark:text-indigo-400" },
};

function KpiCard({ label, value, hint, tone, href, icon: Icon, testId }: {
  label: string; value: string; hint: string; tone: keyof typeof BORDER; href: string; icon: React.ElementType; testId: string;
}) {
  const t = BORDER[tone];
  return (
    <Link href={href} data-testid={testId}
      className="group block rounded-xl min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      <SurfaceCard className={cn("h-full border-l-4 p-3.5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md", t.border)}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] truncate">{label}</span>
          <Icon className={cn("w-3.5 h-3.5 shrink-0", t.text)} />
        </div>
        <p className="mt-1.5 text-2xl font-bold tabular-nums text-[var(--color-text-primary)]" data-kpi-value>{value}</p>
        <p className={cn("mt-0.5 text-[11px] font-medium truncate", tone === "rose" ? t.text : "text-[var(--color-text-secondary)]")}>{hint}</p>
      </SurfaceCard>
    </Link>
  );
}

function KpiRow({ base, dashboard }: { base: string; dashboard: LoadState<DeveloperDashboardSummary> }) {
  const d = dashboard.kind === "ready" ? dashboard.data : null;
  const n = (v: number | undefined) => (d && typeof v === "number" ? String(v) : "-");
  const failure = stateFailure(dashboard, "Your dashboard figures");
  return (
    <div className="space-y-3">
      {failure && <ErrorBanner message={failure.message} onRetry={failure.retry} />}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 min-w-0" aria-busy={dashboard.kind === "loading"}>
        <KpiCard testId="kpi-assigned-projects" label="Assigned Projects" value={n(d?.assignedProjectsCount)} icon={FolderGit2} tone="blue"
          hint={d ? `${d.activeProjectsCount} active` : "-"} href={`${base}/projects`} />
        <KpiCard testId="kpi-active-projects" label="Active Projects" value={n(d?.activeProjectsCount)} icon={Zap} tone="cyan"
          hint="In flight" href={`${base}/projects`} />
        <KpiCard testId="kpi-assigned-tasks" label="Assigned Tasks" value={n(d?.assignedTasksCount)} icon={CheckSquare} tone="violet"
          hint="Total owned" href={`${base}/tasks`} />
        <KpiCard testId="kpi-completed-tasks" label="Completed Tasks" value={n(d?.completedTasksCount)} icon={CheckCircle2} tone="emerald"
          hint="Done & verified" href={`${base}/tasks`} />
        <KpiCard testId="kpi-pending-tasks" label="Pending Tasks" value={n(d?.pendingTasksCount)} icon={ListChecks} tone="amber"
          hint="In progress / review" href={`${base}/tasks`} />
        <KpiCard testId="kpi-overdue-tasks" label="Overdue Tasks" value={n(d?.overdueTasksCount)} icon={CalendarClock} tone="rose"
          hint="Past due date" href={`${base}/calendar`} />
        <KpiCard testId="kpi-open-bugs" label="Open Bugs" value={n(d?.openBugsCount)} icon={Bug} tone="orange"
          hint="Requires triage" href={`${base}/blockers?tab=issues`} />
        <KpiCard testId="kpi-code-reviews" label="Code Reviews" value={n(d?.pendingReviewsCount)} icon={GitPullRequest} tone="indigo"
          hint="Awaiting decision" href={`${base}/reviews`} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ mode cards */

const MODE_STYLE = {
  INDIVIDUAL: {
    card: "border-emerald-500/40 bg-emerald-500/[0.04]",
    eyebrow: "text-emerald-700 dark:text-emerald-300",
    icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500",
  },
  STRUCTURED: {
    card: "border-violet-500/40 bg-violet-500/[0.04]",
    eyebrow: "text-violet-700 dark:text-violet-300",
    icon: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    button: "bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-600 dark:hover:bg-violet-500",
  },
} as const;

function Chip({ label, tone, testId }: { label: string; tone: StatusTone; testId?: string }) {
  return <span data-testid={testId}><StatusBadge label={label} tone={tone} /></span>;
}

function ModeCardShell({ mode, eyebrow, icon: Icon, children }: {
  mode: "INDIVIDUAL" | "STRUCTURED"; eyebrow: string; icon: React.ElementType; children: React.ReactNode;
}) {
  const s = MODE_STYLE[mode];
  return (
    <SurfaceCard className={cn("p-4 sm:p-5 flex flex-col gap-3 border", s.card)} data-testid={`mode-card-${mode.toLowerCase()}`}>
      <div className="flex items-center gap-2">
        <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0", s.icon)}><Icon className="w-4 h-4" /></span>
        <span className={cn("text-[11px] font-bold uppercase tracking-wider", s.eyebrow)}>{eyebrow}</span>
      </div>
      {children}
    </SurfaceCard>
  );
}

function ProjectPicker({ projects, selectedId, onSelect, label, base }: {
  projects: DeveloperProject[]; selectedId: string; onSelect: (id: string) => void; label: string; base: string;
}) {
  if (projects.length < 2) return null;
  return (
    <div className="flex items-center gap-2 flex-wrap text-[11px]">
      <label className="sr-only" htmlFor={`pick-${label}`}>Choose {label} project</label>
      <select id={`pick-${label}`} value={selectedId} onChange={(e) => onSelect(e.target.value)}
        className="h-7 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[11px] text-[var(--color-text-primary)] max-w-[220px]">
        {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
      </select>
      <Link href={`${base}/projects`} className="font-semibold text-blue-600 dark:text-blue-400 hover:underline">+{projects.length - 1} more</Link>
    </div>
  );
}

function ProjectHeading({ project }: { project: DeveloperProject }) {
  return (
    <div className="min-w-0">
      <h3 className="text-base font-semibold text-[var(--color-text-primary)] truncate" data-testid="mode-project-name">{project.name}</h3>
      <p className="text-[11px] font-mono text-[var(--color-text-muted)]">{project.code}</p>
    </div>
  );
}

function checkInChip(project: DeveloperProject): { label: string; tone: StatusTone } {
  const c = project.latestCheckIn as { status?: string; createdAt?: unknown; capturedAt?: unknown } | null | undefined;
  if (!c) return { label: "No check-in yet", tone: "neutral" };
  const when = instantDateText(c.createdAt ?? c.capturedAt);
  const suffix = when === "-" ? "" : ` · ${when}`;
  switch ((c.status ?? "").toUpperCase()) {
    case "APPROVED": return { label: `Check-in approved${suffix}`, tone: "success" };
    case "REJECTED": return { label: `Check-in rejected${suffix}`, tone: "danger" };
    case "PENDING": return { label: `Check-in pending review${suffix}`, tone: "warning" };
    default: return { label: `Check-in ${c.status ?? "recorded"}${suffix}`, tone: "neutral" };
  }
}

function IndividualCard({ base, projects }: { base: string; projects: LoadState<DeveloperProject[]> }) {
  const [picked, setPicked] = useState("");
  const list = projects.kind === "ready" ? projectsOfMode(projects.data, "INDIVIDUAL") : [];
  const project = list.find((p) => p.id === picked) ?? list[0];
  return (
    <ModeCardShell mode="INDIVIDUAL" eyebrow="Mode A — Individual Ownership" icon={UserCheck}>
      <SectionGate state={projects} what="your projects">
        {() =>
          !project ? (
            <EmptyStateView icon={UserCheck} title="No Individual-mode project assigned"
              description="When you are the accountable developer on an Individual-mode project, it appears here." />
          ) : (
            <>
              <ProjectPicker projects={list} selectedId={project.id} onSelect={setPicked} label="individual" base={base} />
              <ProjectHeading project={project} />
              <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3">{project.description?.trim() || INDIVIDUAL_MODE_TEXT}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Chip testId="individual-checkin-chip" {...checkInChip(project)} />
                <Chip testId="individual-progress-chip"
                  label={project.completionPercent === null || project.completionPercent === undefined ? "Not reported" : `${project.completionPercent}% reported`}
                  tone={project.completionPercent === null || project.completionPercent === undefined ? "neutral" : "success"} />
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                <span className="text-[11px] text-[var(--color-text-secondary)]">Target: <strong>{instantDateText(project.targetCompletionDate)}</strong></span>
                <Link href={`${base}/projects/${project.id}/individual/new-check-in`}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold", MODE_STYLE.INDIVIDUAL.button)}>
                  Open Solo Check-in <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </>
          )
        }
      </SectionGate>
    </ModeCardShell>
  );
}

function StructuredChip({ projectId, useStructuredProgress }: { projectId: string; useStructuredProgress: DeveloperDashboardViewProps["useStructuredProgress"] }) {
  const progress = useStructuredProgress(projectId);
  if (progress.kind === "loading") return <Chip testId="structured-progress-chip" label="-" tone="neutral" />;
  if (progress.kind !== "ready") return <Chip testId="structured-progress-chip" label="Progress unavailable" tone="neutral" />;
  const p = progress.data;
  if (p.percent === null || p.percent === undefined) {
    return <span title={p.explanation ?? p.label ?? undefined}><Chip testId="structured-progress-chip" label="Not measurable" tone="warning" /></span>;
  }
  return <Chip testId="structured-progress-chip" label={`${p.percent}% Calculated`} tone="violet" />;
}

function StructuredCard({ base, projects, useStructuredProgress }: {
  base: string; projects: LoadState<DeveloperProject[]>; useStructuredProgress: DeveloperDashboardViewProps["useStructuredProgress"];
}) {
  const [picked, setPicked] = useState("");
  const list = projects.kind === "ready" ? projectsOfMode(projects.data, "STRUCTURED") : [];
  const project = list.find((p) => p.id === picked) ?? list[0];
  return (
    <ModeCardShell mode="STRUCTURED" eyebrow="Mode B — Structured Delivery" icon={Layers}>
      <SectionGate state={projects} what="your projects">
        {() =>
          !project ? (
            <EmptyStateView icon={Layers} title="No Structured-mode project assigned"
              description="Structured projects you are a member of appear here with their calculated progress." />
          ) : (
            <>
              <ProjectPicker projects={list} selectedId={project.id} onSelect={setPicked} label="structured" base={base} />
              <ProjectHeading project={project} />
              <p className="text-xs text-[var(--color-text-secondary)] line-clamp-3">{STRUCTURED_MODE_TEXT}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <StructuredChip key={project.id} projectId={project.id} useStructuredProgress={useStructuredProgress} />
                {project.blockedTasksCount > 0 && <Chip label={`${project.blockedTasksCount} blocked`} tone="danger" />}
                {project.overdueTasksCount > 0 && <Chip label={`${project.overdueTasksCount} overdue`} tone="warning" />}
              </div>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--color-border)]">
                <span className="text-[11px] text-[var(--color-text-secondary)]">Target: <strong>{instantDateText(project.targetCompletionDate)}</strong></span>
                <Link href={`${base}/projects/${project.id}/structured`}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold", MODE_STYLE.STRUCTURED.button)}>
                  Open Sprint Board <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </>
          )
        }
      </SectionGate>
    </ModeCardShell>
  );
}

/* ------------------------------------------------------------------ task / deadline cards */

function CountChip({ count, tone = "neutral" }: { count: number | null; tone?: StatusTone }) {
  return <StatusBadge label={count === null ? "-" : String(count)} tone={tone} />;
}

function TaskRow({ base, task }: { base: string; task: DeveloperWorkItem }) {
  return (
    <li>
      <Link href={`${base}/tasks/${task.id}`} className="flex items-center justify-between gap-3 py-2 hover:bg-[var(--color-hover)] rounded-md px-2 -mx-2">
        <span className="min-w-0">
          <span className="block text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">{task.key}</span>
          <span className="block text-xs font-medium truncate text-[var(--color-text-primary)]">{task.title}</span>
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {(task.priority === "CRITICAL" || task.priority === "HIGH") && (
            <StatusBadge label={task.priority === "CRITICAL" ? "Critical" : "High"} tone={task.priority === "CRITICAL" ? "danger" : "warning"} />
          )}
          <WorkStateBadge state={task.state} blocked={task.blocked} />
        </span>
      </Link>
    </li>
  );
}

export function sortPriorityTasks(tasks: DeveloperWorkItem[]): DeveloperWorkItem[] {
  const due = (t: DeveloperWorkItem) => parseInstant(t.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
  return tasks
    .filter((t) => t.state !== "DONE" && t.state !== "CANCELLED")
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9) || due(a) - due(b));
}

export interface DeadlineRow {
  id: string;
  key: string;
  title: string;
  due: Date;
  kind: "Task" | "Project" | "Calendar";
  href: string;
}

/** Tasks (dashboard), project targets (projects) and calendar deadlines, soonest first. Overdue tasks stay listed. */
export function upcomingDeadlines(
  base: string,
  dashboard: DeveloperDashboardSummary | null,
  projects: DeveloperProject[] | null,
  calendar: DeveloperCalendarEvent[] | null,
  now: Date,
  limit = 6,
): DeadlineRow[] {
  const rows: DeadlineRow[] = [];
  for (const t of (dashboard?.upcomingDeadlines ?? []) as { id: string; key?: string; title?: string; dueDate?: unknown; state?: string }[]) {
    const due = parseInstant(t.dueDate);
    if (!due || t.state === "DONE" || t.state === "CANCELLED") continue;
    rows.push({ id: `task-${t.id}`, key: t.key ?? "Task", title: t.title ?? "Untitled task", due, kind: "Task", href: `${base}/tasks/${t.id}` });
  }
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const p of projects ?? []) {
    const due = parseInstant(p.targetCompletionDate);
    if (!due || due < startOfToday || CLOSED_PROJECT.has((p.status ?? "").toUpperCase())) continue;
    rows.push({
      id: `project-${p.id}`, key: p.code, title: `${p.name} target`, due, kind: "Project",
      href: `${base}/projects/${p.id}/${p.mode === "STRUCTURED" ? "structured" : "individual"}`,
    });
  }
  for (const e of calendar ?? []) {
    if (!["DEADLINE", "MILESTONE", "TASK_DUE"].includes(e.eventType)) continue;
    const due = parseInstant(e.startTime);
    if (!due || due < startOfToday) continue;
    rows.push({ id: `cal-${e.id}`, key: e.eventType === "MILESTONE" ? "Milestone" : "Deadline", title: e.title, due, kind: "Calendar", href: `${base}/calendar` });
  }
  return rows.sort((a, b) => a.due.getTime() - b.due.getTime()).slice(0, limit);
}

function TaskCardsRow({ base, dashboard, projects, calendar, now }: {
  base: string; dashboard: LoadState<DeveloperDashboardSummary>; projects: LoadState<DeveloperProject[]>;
  calendar: LoadState<DeveloperCalendarEvent[]>; now: Date;
}) {
  const d = dashboard.kind === "ready" ? dashboard.data : null;
  const priority = d ? sortPriorityTasks((d.priorityTasks ?? []) as DeveloperWorkItem[]) : null;
  const blocked = d ? ((d.blockedTasks ?? []) as DeveloperWorkItem[]).filter((t) => t.state !== "DONE" && t.state !== "CANCELLED") : null;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
      <Panel title="Priority Tasks" description="High and critical work still open" icon={Zap} iconTone="amber"
        action={<CountChip count={priority ? priority.length : null} tone="warning" />}>
        <SectionGate state={dashboard} what="priority tasks">
          {() =>
            priority && priority.length > 0 ? (
              <ul className="divide-y divide-[var(--color-border)]" data-testid="priority-tasks">
                {priority.slice(0, 5).map((t) => <TaskRow key={t.id} base={base} task={t} />)}
              </ul>
            ) : (
              <EmptyStateView icon={CheckCircle2} title="No priority tasks" description="No high or critical priority task is open for you." />
            )
          }
        </SectionGate>
      </Panel>

      <Panel title="Blocked Tasks" description="Your tasks flagged as blocked" icon={ShieldAlert} iconTone="rose"
        action={<CountChip count={blocked ? blocked.length : null} tone={blocked && blocked.length > 0 ? "danger" : "success"} />}>
        <SectionGate state={dashboard} what="blocked tasks">
          {() =>
            blocked && blocked.length > 0 ? (
              <ul className="divide-y divide-[var(--color-border)]" data-testid="blocked-tasks">
                {blocked.slice(0, 5).map((t) => <TaskRow key={t.id} base={base} task={t} />)}
              </ul>
            ) : (
              <div className="flex items-center gap-2 py-6 justify-center text-xs text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="w-4 h-4" /> No blockers currently active.
              </div>
            )
          }
        </SectionGate>
      </Panel>

      <Panel title="Upcoming Deadlines" description="Tasks, project targets and calendar deadlines" icon={CalendarClock} iconTone="blue"
        action={{ label: "View Calendar", href: `${base}/calendar` }}>
        <SectionGate state={dashboard} what="deadlines">
          {(data) => {
            const rows = upcomingDeadlines(base, data, projects.kind === "ready" ? projects.data : null,
              calendar.kind === "ready" ? calendar.data : null, now);
            if (rows.length === 0) {
              return <EmptyStateView icon={CalendarClock} title="No upcoming deadlines" description="Nothing you own has a due date coming up." />;
            }
            return (
              <ul className="divide-y divide-[var(--color-border)]" data-testid="upcoming-deadlines">
                {rows.map((r) => (
                  <li key={r.id}>
                    <Link href={r.href} className="flex items-center justify-between gap-3 py-2 hover:bg-[var(--color-hover)] rounded-md px-2 -mx-2">
                      <span className="min-w-0">
                        <span className="block text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">{r.key}</span>
                        <span className="block text-xs font-medium truncate text-[var(--color-text-primary)]">{r.title}</span>
                      </span>
                      <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 shrink-0 tabular-nums">{instantDateText(r.due)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            );
          }}
        </SectionGate>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ GitHub evidence */

const EVENT_TONE: Record<string, StatusTone> = {
  PULL_REQUEST: "violet",
  CHECK_RUN: "info",
  REVIEW: "warning",
  PUSH: "success",
  COMMIT: "success",
  DEPLOYMENT: "neutral",
};

export function gitEventTime(e: DeveloperGitHubEvent, now: Date): string {
  const raw = e.occurredAt ?? e.createdAt ?? (e as Record<string, unknown>).timestamp;
  const abs = instantText(raw);
  const rel = relativeText(raw, now);
  return rel ? `${abs} (${rel})` : abs;
}

function GitHubActivity({ base, dashboard, now }: { base: string; dashboard: LoadState<DeveloperDashboardSummary>; now: Date }) {
  return (
    <Panel title="Recent GitHub & CI/CD Activity" description="Evidence only; never changes progress" icon={GitBranch} iconTone="teal"
      action={<ButtonLink href={`${base}/github`} variant="outline">Open GitHub Feed</ButtonLink>}>
      <SectionGate state={dashboard} what="GitHub activity">
        {(d) => {
          const events = (d.recentGitEvents ?? []) as DeveloperGitHubEvent[];
          if (events.length === 0) {
            return <EmptyStateView icon={GitBranch} title="No GitHub activity"
              description="No repository events are recorded for this organization, or you do not have repository access." />;
          }
          return (
            <ul className="divide-y divide-[var(--color-border)]" data-testid="github-activity">
              {events.map((e) => {
                const type = (e.eventType ?? "EVENT").toUpperCase();
                const repo = (e.repositoryName ?? e.repository ?? "-") as string;
                const linked = (e as Record<string, unknown>).linkedTaskKey as string | undefined;
                return (
                  <li key={e.id} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 py-2.5 min-w-0">
                    <span className="shrink-0"><StatusBadge label={type} tone={EVENT_TONE[type] ?? "neutral"} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-[var(--color-text-primary)] truncate">{e.title ?? "-"}</span>
                      <span className="block text-[11px] text-[var(--color-text-muted)] truncate">
                        <span className="font-mono">{repo}</span>{linked ? ` · ${linked}` : ""} · {e.actor ?? "Unknown"}
                      </span>
                    </span>
                    <span className="text-[11px] text-[var(--color-text-muted)] tabular-nums shrink-0" data-testid="git-time">{gitEventTime(e, now)}</span>
                  </li>
                );
              })}
            </ul>
          );
        }}
      </SectionGate>
    </Panel>
  );
}

/* ------------------------------------------------------------------ retained sections (previous dashboard) */

function RetainedPanels({ base, work, feedback, blockers, projects }: Pick<DeveloperDashboardViewProps, "base" | "work" | "feedback" | "blockers" | "projects">) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Panel title="Work in progress" description="Started or waiting for review" icon={CheckSquare} iconTone="violet"
        action={{ label: "My tasks", href: `${base}/tasks` }}>
        <SectionGate state={work} what="your work">
          {(items) => {
            const active = items.filter((w) => w.state === "IN_PROGRESS" || w.state === "IN_REVIEW" || w.state === "TODO").slice(0, 6);
            if (active.length === 0) {
              return <EmptyStateView icon={CheckCircle2} title="Nothing open" description="No structured work is assigned to you right now." />;
            }
            return (
              <ul className="divide-y divide-[var(--color-border)]">
                {active.map((w) => (
                  <li key={w.id}>
                    <Link href={`${base}/tasks/${w.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-[var(--color-hover)] rounded-md px-2 -mx-2">
                      <span className="min-w-0">
                        <span className="block text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400">{w.key}</span>
                        <span className="block text-xs font-medium truncate">{w.title}</span>
                      </span>
                      <span className="flex flex-col items-end gap-1 shrink-0">
                        <WorkStateBadge state={w.state} blocked={w.blocked} />
                        {w.due_on && (
                          <span className={`text-[11px] ${isOverdue(w.due_on, w.state) ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-[var(--color-text-muted)]"}`}>
                            Due {dateText(w.due_on)}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            );
          }}
        </SectionGate>
      </Panel>

      <Panel title="Review feedback" description="Latest decisions on your submissions" icon={MessageSquareWarning} iconTone="amber"
        action={{ label: "Reviews", href: `${base}/reviews` }}>
        <SectionGate state={feedback} what="review feedback">
          {(rows) =>
            rows.length === 0 ? (
              <EmptyStateView icon={GitPullRequest} title="No reviews yet" description="Decisions on your submitted work appear here." />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {rows.slice(0, 5).map((f) => (
                  <li key={f.id}>
                    <Link href={`${base}/tasks/${f.work_item_id}`} className="block py-2.5 hover:bg-[var(--color-hover)] rounded-md px-2 -mx-2">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate"><span className="font-mono text-blue-600 dark:text-blue-400">{f.key}</span> {f.title}</span>
                        <DecisionBadge decision={f.decision} />
                      </span>
                      {f.reason && <span className="block text-[11px] text-[var(--color-text-secondary)] mt-0.5 line-clamp-2">{f.reason}</span>}
                      <span className="block text-[10px] text-[var(--color-text-muted)] mt-0.5">
                        Revision {f.revision} · {f.reviewer_email ?? "Reviewer"} · {dateTimeText(f.decided_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )
          }
        </SectionGate>
      </Panel>

      <Panel title="Open blockers" description="On your work or owned by you" icon={AlertTriangle} iconTone="rose"
        action={{ label: "Blockers & issues", href: `${base}/blockers` }}>
        <SectionGate state={blockers} what="blockers">
          {(rows) => {
            const open = rows.filter((b) => !b.resolved);
            if (open.length === 0) {
              return <EmptyStateView icon={CheckCircle2} title="No open blockers" description="Raise a blocker from a task when something stops the work." />;
            }
            return (
              <ul className="divide-y divide-[var(--color-border)]">
                {open.slice(0, 5).map((b) => (
                  <li key={b.id} className="py-2.5">
                    <Link href={`${base}/tasks/${b.work_item_id}`} className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block text-[11px] font-mono font-semibold text-rose-600 dark:text-rose-400">{b.work_item_key}</span>
                        <span className="block text-xs truncate">{b.reason}</span>
                      </span>
                      <StatusBadge label={b.severity === "CRITICAL" ? "Critical" : "Normal"} tone={b.severity === "CRITICAL" ? "danger" : "warning"} />
                    </Link>
                  </li>
                ))}
              </ul>
            );
          }}
        </SectionGate>
      </Panel>

      <Panel title="My projects" description="Individual and Structured" icon={FolderGit2} iconTone="blue"
        action={{ label: "All projects", href: `${base}/projects` }}>
        <SectionGate state={projects} what="your projects">
          {(rows) =>
            rows.length === 0 ? (
              <EmptyStateView icon={FolderGit2} title="No projects" description="You are not a member of any project in this organization yet." />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {rows.slice(0, 6).map((p) => (
                  <li key={p.id}>
                    <Link href={`${base}/projects/${p.id}/${p.mode === "STRUCTURED" ? "structured" : "individual"}`}
                      className="flex items-center justify-between gap-2 py-2.5 hover:bg-[var(--color-hover)] rounded-md px-2 -mx-2">
                      <span className="min-w-0">
                        <span className="block text-xs font-medium truncate">{p.name}</span>
                        <span className="block text-[11px] text-[var(--color-text-muted)] font-mono">{p.code}</span>
                      </span>
                      <StatusBadge label={p.mode === "STRUCTURED" ? "Structured" : "Individual"} tone={p.mode === "STRUCTURED" ? "violet" : "info"} />
                    </Link>
                  </li>
                ))}
              </ul>
            )
          }
        </SectionGate>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ view */

/** Header action: unread notifications (kept from the previous dashboard's KPI tile). */
export function NotificationsAction({ base, dashboard }: { base: string; dashboard: LoadState<DeveloperDashboardSummary> }) {
  const unread = dashboard.kind === "ready" ? dashboard.data.unreadNotificationsCount : null;
  return (
    <ButtonLink href={`${base}/notifications`} variant="outline">
      <Bell className="w-3.5 h-3.5" /> Notifications{unread !== null ? ` (${unread} unread)` : ""}
    </ButtonLink>
  );
}

export function DeveloperDashboardView(props: DeveloperDashboardViewProps) {
  const { base, dashboard, projects, calendar } = props;
  const now = props.now ?? new Date();
  return (
    <div className="space-y-5 min-w-0">
      <KpiRow base={base} dashboard={dashboard} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        <IndividualCard base={base} projects={projects} />
        <StructuredCard base={base} projects={projects} useStructuredProgress={props.useStructuredProgress} />
      </div>
      <TaskCardsRow base={base} dashboard={dashboard} projects={projects} calendar={calendar} now={now} />
      <GitHubActivity base={base} dashboard={dashboard} now={now} />
      <RetainedPanels base={base} work={props.work} feedback={props.feedback} blockers={props.blockers} projects={projects} />
    </div>
  );
}
