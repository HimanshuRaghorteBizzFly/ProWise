"use client";

import React, { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, ArrowRight, FolderKanban, Lock, Search, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import {
  AdminButton,
  AdminInput,
  AdminSelect,
  EmptyStateView,
  ErrorBanner,
  PageFrame,
  PageSkeleton,
  Panel,
  SegmentTabs,
  StatPill,
  StatusBadge,
} from "@/components/delivery/DeliveryUI";
import { DevGate, SectionGate, dateText } from "@/components/developer/DevUI";
import { CheckInHistoryList, PendingEntry } from "@/components/progress/CheckInViews";
import { useProgressSummary } from "@/components/progress/useCheckInApi";
import { LIFECYCLE_LABEL } from "@/components/projects/ApiProjectViews";
import { useProject } from "@/components/projects/useProjectApi";
import { apiClient } from "@/lib/api";
import type { ProjectDto, ProjectLifecycleDto } from "@/types/api";
import type { ProgressRowDto, ProgressSort } from "@/types/flow";
import type { WorkItemDto } from "@/types/work";
import { ProgressRing, columnLabel } from "./FlowUI";
import { flowKeys, useProjectWorkItems, useStructuredProgress } from "./useFlowApi";

/**
 * Project Manager progress. Page 1: a card per project the PM can see (server-paginated, searchable, filterable,
 * sortable). Page 2: one project with a single progress ring and its method; Team = points and tasks by phase, Solo =
 * approved %, reported % awaiting review and the history. Real data only; "Not reported" until something is approved.
 */

const PAGE = 12;
const STATUSES: ProjectLifecycleDto[] = ["PLANNED", "ACTIVE", "ON_HOLD", "AWAITING_ACCEPTANCE", "DELIVERED", "CLOSED", "CANCELLED"];

function lifecycleLabel(value: string) {
  return LIFECYCLE_LABEL[value as ProjectLifecycleDto] ?? value;
}

/* ================================================================== page 1 */

export function PmProgressListView({ orgId }: { orgId: string }) {
  const home = `/org/${orgId}/manager`;
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<ProgressSort>("name");
  const search = useDeferredValue(q.trim());
  const query = useInfiniteQuery({
    queryKey: [...flowKeys.all, "progress-projects", orgId, search, mode, status, sort],
    queryFn: ({ pageParam }) => apiClient.flow.progressProjects(orgId, { q: search, mode, status, sort, cursor: pageParam, limit: PAGE }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.has_more ? last.next_cursor : undefined),
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
    enabled: !!orgId,
  });
  const rows = query.data?.pages.flatMap((p) => p.items) ?? [];
  const filtered = !!(search || mode || status);

  return (
    <PageFrame crumbs={[{ label: "Manager", href: home }, { label: "Progress" }]} title="Progress"
      description="Approved progress of every project you can see. Git activity, time and task counts never set progress.">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_160px_180px_170px] gap-2 items-end">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" aria-hidden="true" />
          <AdminInput aria-label="Search projects" placeholder="Search by name or key" className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <AdminSelect aria-label="Mode" value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="">Team and Solo</option>
          <option value="STRUCTURED">Team</option>
          <option value="INDIVIDUAL">Solo</option>
        </AdminSelect>
        <AdminSelect aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Every status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{lifecycleLabel(s)}</option>)}
        </AdminSelect>
        <AdminSelect aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as ProgressSort)}>
          <option value="name">Sort: name</option>
          <option value="progress">Sort: progress</option>
          <option value="target">Sort: target date</option>
          <option value="updated">Sort: recently updated</option>
        </AdminSelect>
      </div>
      {query.isPending ? <PageSkeleton variant="list" />
        : query.isError ? <ErrorBanner message="Project progress could not be loaded." onRetry={() => void query.refetch()} />
          : rows.length === 0 ? (
            <EmptyStateView icon={FolderKanban} title={filtered ? "No projects match" : "No projects yet"}
              description={filtered ? "Clear the search or filters to see every project." : "Projects you can see appear here with their approved progress."} />
          ) : (
            <>
              <ProgressCards rows={rows} href={(id) => `${home}/progress/${id}`} />
              {query.hasNextPage && (
                <div className="flex justify-center">
                  <AdminButton variant="outline" onClick={() => void query.fetchNextPage()} isLoading={query.isFetchingNextPage}>Load more</AdminButton>
                </div>
              )}
            </>
          )}
    </PageFrame>
  );
}

export function ProgressCards({ rows, href }: { rows: ProgressRowDto[]; href: (projectId: string) => string }) {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="progress-cards">
      {rows.map((r) => {
        const reported = r.percent !== null;
        return (
          <li key={r.project_id}>
            <Link href={href(r.project_id)}
              className="block h-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-subtle transition-shadow hover:shadow-md hover:border-blue-500/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{r.name}</p>
                  <p className="text-[11px] font-mono text-[var(--color-text-muted)]">{r.key}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1 shrink-0">
                  <StatusBadge label={r.mode === "STRUCTURED" ? "Team" : "Solo"} tone={r.mode === "STRUCTURED" ? "info" : "violet"} />
                  <StatusBadge label={lifecycleLabel(r.lifecycle)} tone="neutral" />
                </div>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-[var(--color-elevated)] overflow-hidden" aria-hidden="true">
                  <div className="h-full rounded-full bg-blue-500 transition-[width] duration-700 ease-out motion-reduce:transition-none"
                    style={{ width: `${reported ? r.percent : 0}%` }} />
                </div>
                <span className="text-sm font-bold tabular-nums w-24 text-right">{reported ? `${r.percent}%` : r.label}</span>
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)] min-h-[1rem]">{r.method_label ?? "Nothing approved yet"}</p>
              {r.pending_percent !== null && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">{Number(r.pending_percent)}% reported, not yet approved</p>
              )}
              <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
                <span>{r.mode === "STRUCTURED" ? `${r.done} done · ${r.in_review} in review` : "Single outcome"}
                  {r.open_blockers > 0 ? ` · ${r.open_blockers} blocked` : ""}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ================================================================== page 2 */

export function PmProgressDetailView({ orgId, projectId }: { orgId: string; projectId: string }) {
  const home = `/org/${orgId}/manager`;
  const project = useProject(orgId, projectId);
  const back = { href: `${home}/progress`, label: "Back to progress" };
  const name = project.kind === "ready" ? `${project.data.key} · ${project.data.name}` : "Project progress";
  return (
    <PageFrame crumbs={[{ label: "Manager", href: home }, { label: "Progress", href: `${home}/progress` }, { label: project.kind === "ready" ? project.data.key : "Project" }]}
      back={back} title={name} description={project.kind === "ready" ? project.data.description ?? undefined : undefined}>
      <DevGate state={project} what="This project" back={back} skeleton="detail">
        {(p) => p.mode === "STRUCTURED"
          ? <TeamProgress project={p} taskHref={(id) => `${home}/work-items/${id}`} />
          : <SoloProgress project={p} />}
      </DevGate>
    </PageFrame>
  );
}

type TaskTab = "all" | "completed" | "remaining" | "blocked";

export function isBlocked(t: WorkItemDto) {
  return t.blocked || (t.blocked_by ?? []).length > 0 || (t.open_blockers ?? 0) > 0;
}

export function taskTiles(tasks: WorkItemDto[]) {
  return {
    completed: tasks.filter((t) => t.state === "DONE").length,
    inReview: tasks.filter((t) => t.state === "IN_REVIEW").length,
    inProgress: tasks.filter((t) => t.state === "IN_PROGRESS").length,
    notStarted: tasks.filter((t) => t.state === "TODO").length,
    blocked: tasks.filter((t) => t.state !== "DONE" && isBlocked(t)).length,
  };
}

export function TeamProgress({ project, taskHref }: { project: ProjectDto; taskHref: (id: string) => string }) {
  const progress = useStructuredProgress(project.id);
  const items = useProjectWorkItems(project.id);
  const [tab, setTab] = useState<TaskTab>("all");
  return (
    <SectionGate state={progress} what="progress">
      {(p) => {
        const total = Number(p.denominator ?? 0);
        const approved = Number(p.numerator ?? 0);
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex justify-center">
                <ProgressRing percent={p.reported ? p.percent : null} label={p.label} method={p.method_label ?? null} />
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <StatPill label="Total points" value={total} />
                  <StatPill label="Approved points" value={approved} tone="success" />
                  <StatPill label="Remaining points" value={Math.max(0, total - approved)} />
                </div>
                <SectionGate state={items} what="tasks">
                  {(rows) => {
                    const tiles = taskTiles(rows.filter((r) => r.type !== "MILESTONE" && r.plan_status !== "RETIRED"));
                    return (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <StatPill label="Completed" value={tiles.completed} tone="success" />
                        <StatPill label="In review" value={tiles.inReview} />
                        <StatPill label="In progress" value={tiles.inProgress} />
                        <StatPill label="Not started" value={tiles.notStarted} />
                        <StatPill label="Blocked" value={tiles.blocked} tone={tiles.blocked > 0 ? "danger" : "neutral"} />
                      </div>
                    );
                  }}
                </SectionGate>
              </div>
            </div>

            <Panel title="Approved points over time" icon={TrendingUp} iconTone="blue" description="Every change is kept (append-only).">
              {p.snapshots.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">No history yet.</p>
              ) : (
                <div style={{ width: "100%", height: 220 }} role="img"
                  aria-label={`Approved points over time, now ${approved} of ${total}`}>
                  <ResponsiveContainer>
                    <LineChart data={p.snapshots.map((s) => ({ when: dateText(s.taken_at), approved: Number(s.numerator ?? 0), total: Number(s.denominator ?? 0) }))}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                      <XAxis dataKey="when" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--color-surface)", borderColor: "var(--color-border)", borderRadius: "8px",
                        fontSize: "12px", color: "var(--color-text-primary)" }} />
                      <Line type="monotone" dataKey="approved" name="Approved points" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="total" name="Total points" stroke="#94A3B8" strokeDasharray="4 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Tasks by phase" icon={Activity} iconTone="emerald"
              action={<SegmentTabs<TaskTab> value={tab} onChange={setTab} options={[
                { value: "all", label: "All" }, { value: "completed", label: "Completed" },
                { value: "remaining", label: "Remaining" }, { value: "blocked", label: "Blocked" }]} />}>
              <SectionGate state={items} what="tasks">
                {(rows) => <TasksByPhase rows={rows} tab={tab} taskHref={taskHref} />}
              </SectionGate>
            </Panel>
          </div>
        );
      }}
    </SectionGate>
  );
}

export function TasksByPhase({ rows, tab, taskHref }: { rows: WorkItemDto[]; tab: TaskTab; taskHref: (id: string) => string }) {
  const groups = useMemo(() => {
    const tasks = rows.filter((r) => r.type !== "MILESTONE" && r.plan_status !== "RETIRED").filter((t) =>
      tab === "completed" ? t.state === "DONE" : tab === "remaining" ? t.state !== "DONE" : tab === "blocked" ? t.state !== "DONE" && isBlocked(t) : true);
    const map = new Map<string, WorkItemDto[]>();
    for (const t of tasks) {
      const phase = t.phase?.title ?? "No phase";
      map.set(phase, [...(map.get(phase) ?? []), t]);
    }
    return Array.from(map.entries());
  }, [rows, tab]);
  if (groups.length === 0) return <p className="text-xs text-[var(--color-text-muted)]">No tasks here.</p>;
  return (
    <div className="space-y-4">
      {groups.map(([phase, tasks]) => (
        <section key={phase} aria-label={phase}>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">{phase}</h3>
          <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]">
            {tasks.map((t) => (
              <li key={t.id}>
                <Link href={taskHref(t.id)} className="grid grid-cols-[auto_1fr_auto] sm:grid-cols-[80px_1fr_180px_70px_120px] gap-2 items-center px-3 py-2 text-xs hover:bg-[var(--color-hover)]">
                  <span className="font-mono text-blue-600 dark:text-blue-400">{t.key}</span>
                  <span className="truncate font-medium">
                    {t.title}
                    {isBlocked(t) && t.state !== "DONE" && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                        <Lock className="w-3 h-3" aria-hidden="true" />Blocked
                      </span>
                    )}
                  </span>
                  <span className="hidden sm:block truncate text-[var(--color-text-muted)]">{t.primary_assignee?.email ?? "Unassigned"}</span>
                  <span className="hidden sm:block tabular-nums">{t.weight ?? "—"} pts</span>
                  <span className="justify-self-end"><StatusBadge label={columnLabel(t.state)}
                    tone={t.state === "DONE" ? "success" : t.state === "IN_REVIEW" ? "violet" : t.state === "IN_PROGRESS" ? "info" : "neutral"} /></span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function SoloProgress({ project }: { project: ProjectDto }) {
  const summary = useProgressSummary(project.id);
  return (
    <SectionGate state={summary} what="progress">
      {(s) => (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 items-start">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex justify-center">
              <ProgressRing percent={s.current.percent === null ? null : Math.round(Number(s.current.percent))} label={s.current.label}
                method={s.current.percent === null ? null : "approved outcome"} />
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <StatPill label="Approved" value={s.current.percent === null ? s.current.label : `${Number(s.current.percent)}%`} tone="success" />
                <StatPill label="Reported, awaiting review" value={s.pending ? `${Number(s.pending.percent)}%` : "None"} tone={s.pending ? "warning" : "neutral"} />
              </div>
              <PendingEntry pending={s.pending} approverEmail={s.approver?.email} approverNote={s.approver_note} approvers={s.approvers} />
              {project.project_manager && <p className="text-[11px] text-[var(--color-text-muted)]">Project manager: {project.project_manager.email}</p>}
            </div>
          </div>
          <Panel title="Check-ins and reviews" icon={AlertTriangle} iconTone="amber" description="Every submission and decision is kept.">
            <CheckInHistoryList entries={s.history} />
          </Panel>
        </div>
      )}
    </SectionGate>
  );
}


