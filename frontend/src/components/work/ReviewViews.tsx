"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ClipboardCheck, History, LineChart, ListChecks, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";

import { ApiError, apiClient, isStaleVersion } from "@/lib/api";
import type { ProgressSnapshotDto, ProjectDto, ReviewTaskDto, StructuredProgressDto, WorkItemDto } from "@/types/api";
import {
  AdminButton,
  AdminInput,
  EmptyStateView,
  ErrorBanner,
  PageFrame,
  PageSkeleton,
  Panel,
  StatusBadge,
} from "@/components/delivery/DeliveryUI";
import { StaleVersionBanner } from "@/components/org-console/StaleVersionBanner";
import { apiErrorMessage, toState } from "@/components/org-console/useRoleApi";

/**
 * Tasks 3.3 and 3.5 screens. The assignee submits a task; the task's reviewer approves it (every check passed) or
 * asks for changes; only an approved task counts toward progress = approved points / points of the active scope.
 */

const QUERY = { retry: false } as const;
type Crumbs = { label: string; href?: string }[];
type Back = { href: string; label: string };

const STATE_LABEL: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  TODO: { label: "To do", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  BLOCKED: { label: "Blocked", tone: "danger" },
  IN_REVIEW: { label: "In review", tone: "warning" },
  DONE: { label: "Done", tone: "success" },
};

function useOrgId() {
  const params = useParams();
  return (params?.orgId as string) || "";
}

function TaskState({ state }: { state: string }) {
  const s = STATE_LABEL[state] ?? { label: state, tone: "neutral" as const };
  return <StatusBadge label={s.label} tone={s.tone} />;
}

function TaskHeading({ task }: { task: ReviewTaskDto }) {
  return (
    <span className="min-w-0">
      <span className="font-mono text-[var(--color-text-muted)]">{task.item.key}</span> {task.item.title}
      <span className="block text-[var(--color-text-muted)]">
        {task.project_key} · {task.project_name} · {Number(task.item.points)} {task.item.unit} · revision {task.current_revision}
      </span>
    </span>
  );
}

/* ================================================================== developer: my tasks */

export function MyTasksList({ tasks, onSubmit, pending, itemHref }: {
  tasks: ReviewTaskDto[];
  onSubmit: (task: ReviewTaskDto) => void;
  pending: string | null;
  itemHref?: (task: ReviewTaskDto) => string;
}) {
  if (tasks.length === 0) {
    return <EmptyStateView icon={ListChecks} title="No tasks assigned" description="Tasks of Structured projects assigned to you appear here." />;
  }
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="my-tasks">
      {tasks.map((task) => {
        const waiting = task.waiting_on ?? [];
        const submittable = !task.cancelled && waiting.length === 0 && (task.item.state === "TODO" || task.item.state === "IN_PROGRESS");
        return (
          <li key={task.item.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
            <span className="min-w-0">
              <TaskHeading task={task} />
              {itemHref && <Link className="block text-blue-600 hover:underline" href={itemHref(task)}>Task details</Link>}
              {waiting.length > 0 && <span className="block text-amber-600">Waiting on {waiting.map((x) => x.key).join(", ")} (must be approved first)</span>}
              {task.dependency_flag && <span className="block text-blue-600">{task.dependency_flag}</span>}
            </span>
            <span className="flex items-center gap-2">
              <TaskState state={task.item.state} />
              {task.blocked && <StatusBadge label="Blocked" tone="danger" />}
              {task.item.reviewer && <span className="text-[var(--color-text-muted)]">Reviewer: {task.item.reviewer.email}</span>}
              {submittable && (
                <AdminButton size="sm" onClick={() => onSubmit(task)} isLoading={pending === task.item.id}>
                  <Send className="w-3.5 h-3.5" /> Submit for review
                </AdminButton>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function MyTasksView({ crumbs, back, projectId, itemHref }: {
  crumbs: Crumbs;
  back: Back;
  /** Only this project's tasks (developer's project page). */
  projectId?: string;
  itemHref?: (task: ReviewTaskDto) => string;
}) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const state = toState(useQuery({ queryKey: ["my-tasks", orgId], queryFn: () => apiClient.myTasks(orgId), ...QUERY }));
  const [pending, setPending] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const reload = () => void queryClient.invalidateQueries({ queryKey: ["my-tasks", orgId] });
  const onSubmit = (task: ReviewTaskDto) => {
    setPending(task.item.id);
    setError("");
    apiClient.submitTask(orgId, task.project_id, task.item.id, { expected_version: task.item.version })
      .then(() => { toast.success(`${task.item.key} sent to review`); reload(); })
      .catch((failure) => (isStaleVersion(failure) ? setStale(true) : setError(apiErrorMessage(failure))))
      .finally(() => setPending(null));
  };
  return (
    <PageFrame crumbs={[...crumbs, { label: "My tasks" }]} back={back} title="My tasks"
      description="Submit a task when it is ready. It counts toward the project's progress only after its reviewer approves it.">
      {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
      {error && <ErrorBanner message={error} />}
      {state.kind === "loading" ? <PageSkeleton variant="list" />
        : state.kind !== "ready" ? <ErrorBanner message="Tasks could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
          : <MyTasksList tasks={projectId ? state.data.filter((t) => t.project_id === projectId) : state.data} onSubmit={onSubmit}
              pending={pending} itemHref={itemHref} />}
    </PageFrame>
  );
}

/* ================================================================== reviewer: queue */

export function ReviewDecisionCard({ task, onApprove, onRequestChanges, pending }: {
  task: ReviewTaskDto;
  onApprove: (task: ReviewTaskDto, passed: string[], note: string) => void;
  onRequestChanges: (task: ReviewTaskDto, note: string) => void;
  pending: boolean;
}) {
  const [passed, setPassed] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const allPassed = task.checks.every((check) => passed.includes(check.id));
  const toggle = (id: string) => setPassed((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  return (
    <li className="space-y-2 px-3 py-3 text-xs" data-testid="review-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TaskHeading task={task} />
        <span className="flex items-center gap-2">
          <TaskState state={task.item.state} />
          <span className="text-[var(--color-text-muted)]">By {task.item.assignee?.email ?? "Unassigned"}</span>
        </span>
      </div>
      {task.checks.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="font-medium">Required checks</legend>
          {task.checks.map((check) => (
            <label key={check.id} className="flex items-center gap-2">
              <input type="checkbox" checked={passed.includes(check.id)} onChange={() => toggle(check.id)} /> {check.label}
            </label>
          ))}
        </fieldset>
      )}
      <AdminInput label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Required when asking for changes" />
      <div className="flex flex-wrap gap-2">
        <AdminButton size="sm" disabled={!allPassed} isLoading={pending} onClick={() => onApprove(task, passed, note)}>
          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
        </AdminButton>
        <AdminButton size="sm" variant="outline" disabled={!note.trim() || pending} onClick={() => onRequestChanges(task, note)}>
          <RotateCcw className="w-3.5 h-3.5" /> Request changes
        </AdminButton>
        {!allPassed && <span className="self-center text-[var(--color-text-muted)]">Tick every check to approve.</span>}
      </div>
    </li>
  );
}

export function ReviewQueueView({ crumbs, back }: { crumbs: Crumbs; back: Back }) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const state = toState(useQuery({ queryKey: ["review-queue", orgId], queryFn: () => apiClient.reviewQueue(orgId), ...QUERY }));
  const [pending, setPending] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const reload = () => void queryClient.invalidateQueries({ queryKey: ["review-queue", orgId] });
  const decide = (task: ReviewTaskDto, call: Promise<unknown>, done: string) => {
    setPending(task.item.id);
    setError("");
    call.then(() => { toast.success(done); reload(); })
      .catch((failure) => (isStaleVersion(failure) ? setStale(true) : setError(apiErrorMessage(failure))))
      .finally(() => setPending(null));
  };
  const decision = (task: ReviewTaskDto, passed: string[], note: string) => ({
    reviewed_revision: task.submitted_revision ?? task.current_revision,
    passed_check_ids: passed,
    note: note.trim() || undefined,
    expected_version: task.item.version,
  });
  return (
    <PageFrame crumbs={[...crumbs, { label: "Review queue" }]} back={back} title="Review queue"
      description="Tasks waiting for your review. Approving makes the task Done and adds its points to the project's progress.">
      {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
      {error && <ErrorBanner message={error} />}
      {state.kind === "loading" ? <PageSkeleton variant="list" />
        : state.kind !== "ready" ? <ErrorBanner message="The queue could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
          : state.data.length === 0
            ? <EmptyStateView icon={ClipboardCheck} title="Nothing to review" description="Tasks submitted to you appear here." />
            : (
              <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="review-queue">
                {state.data.map((task) => (
                  <ReviewDecisionCard key={task.item.id} task={task} pending={pending === task.item.id}
                    onApprove={(t, passed, note) => decide(t, apiClient.approveTask(orgId, t.project_id, t.item.id, decision(t, passed, note)), `${t.item.key} approved`)}
                    onRequestChanges={(t, note) => decide(t, apiClient.requestTaskChanges(orgId, t.project_id, t.item.id, decision(t, [], note)), `Changes requested on ${t.item.key}`)} />
                ))}
              </ul>
            )}
    </PageFrame>
  );
}

/* ================================================================== project: progress (3.5) */

const CAUSE_LABEL: Record<string, string> = {
  SCOPE_APPROVED: "Scope version approved",
  TASK_APPROVED: "Task approved",
  TASK_REOPENED: "Task reopened",
};

function percentText(value: number | null) {
  return value === null ? "Not measurable" : `${Number(value)}%`;
}

export function SnapshotHistory({ snapshots }: { snapshots: ProgressSnapshotDto[] }) {
  if (snapshots.length === 0) return <EmptyStateView icon={History} title="No snapshots yet" description="A snapshot is taken when scope or a task review changes progress." />;
  const rows = [...snapshots].reverse();
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="snapshots">
      {rows.map((snapshot, index) => {
        const older = rows[index + 1];
        const versionBreak = older !== undefined && older.scope_version_no !== snapshot.scope_version_no;
        return (
          <li key={snapshot.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
            <span>
              <b>{percentText(snapshot.display_percent)}</b> · {Number(snapshot.numerator)} of {Number(snapshot.denominator)} pts
              <span className="block text-[var(--color-text-muted)]">
                {CAUSE_LABEL[snapshot.cause] ?? snapshot.cause} · {new Date(snapshot.captured_at).toLocaleString()}
              </span>
            </span>
            <span className="flex items-center gap-2">
              {snapshot.scope_version_no !== null && <StatusBadge label={`Scope v${snapshot.scope_version_no}`} tone={versionBreak ? "warning" : "neutral"} />}
              {versionBreak && <span className="text-[var(--color-text-muted)]">New scope: the total changed from here</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ProgressSummary({ progress }: { progress: StructuredProgressDto }) {
  return (
    <div className="space-y-1 text-xs" data-testid="progress-summary">
      <p className="text-2xl font-semibold">{percentText(progress.display_percent)}</p>
      <p className="text-[var(--color-text-secondary)]">
        {Number(progress.numerator)} of {Number(progress.denominator)} pts approved
        {progress.scope_version_no !== null && <> · scope version {progress.scope_version_no}</>} · method: {progress.method}
      </p>
      <p className="text-[var(--color-text-muted)]">Only tasks approved by their reviewer count. Cancelled tasks stay in the total and earn nothing.</p>
    </div>
  );
}

/** Project workspace tab: current progress, snapshot history, and reopening a Done task (project.edit). */
export function ProgressTab({ project }: { project: ProjectDto }) {
  const orgId = useOrgId();
  const queryClient = useQueryClient();
  const state = toState(useQuery({ queryKey: ["structured-progress", orgId, project.id], queryFn: () => apiClient.structuredProgress(orgId, project.id), ...QUERY }));
  const items = useQuery({ queryKey: ["work-items", orgId, project.id], queryFn: () => apiClient.workItems(orgId, project.id), ...QUERY });
  const [reopening, setReopening] = useState("");
  const [reason, setReason] = useState("");
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const reload = () => {
    void queryClient.invalidateQueries({ queryKey: ["structured-progress", orgId, project.id] });
    void queryClient.invalidateQueries({ queryKey: ["work-items", orgId, project.id] });
  };
  const reopen = useMutation({
    mutationFn: () => {
      const item = (items.data ?? []).find((x) => x.id === reopening);
      if (!item) throw new Error("Pick a task.");
      return apiClient.reopenTask(orgId, project.id, item.id, { reason: reason.trim(), expected_version: item.version });
    },
    onSuccess: () => { toast.success("Task reopened; its points no longer count"); setReopening(""); setReason(""); reload(); },
    onError: (failure) => (isStaleVersion(failure) ? setStale(true) : setError(apiErrorMessage(failure))),
  });
  const done = (items.data ?? []).filter((x) => x.leaf && x.state === "DONE");
  if (state.kind === "loading") return <PageSkeleton variant="list" />;
  if (state.kind !== "ready") return <ErrorBanner message="Progress could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />;
  return (
    <div className="space-y-4">
      <Panel title="Progress" icon={LineChart} description="Approved points divided by the points of the active scope version.">
        <ProgressSummary progress={state.data} />
      </Panel>
      <Panel title="Snapshot history" icon={History} description="Every change to progress is kept; earlier figures are never rewritten.">
        <SnapshotHistory snapshots={state.data.snapshots} />
      </Panel>
      {project.can_edit && <ChecksEditor orgId={orgId} project={project} items={(items.data ?? []).filter((x) => x.leaf && x.state !== "DONE")} />}
      {project.can_edit && done.length > 0 && (
        <Panel title="Reopen a Done task" icon={RotateCcw} description="The task goes back to In progress and its points stop counting. Its review history is kept.">
          {stale && <StaleVersionBanner onReload={() => { setStale(false); reload(); }} />}
          {error && <ErrorBanner message={error} />}
          <div className="space-y-2 text-xs">
            <select aria-label="Task to reopen" className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
              value={reopening} onChange={(e) => setReopening(e.target.value)}>
              <option value="">Choose a Done task…</option>
              {done.map((x) => <option key={x.id} value={x.id}>{x.key} · {x.title} ({Number(x.points)} {x.unit})</option>)}
            </select>
            <AdminInput label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            <AdminButton size="sm" disabled={!reopening || !reason.trim()} isLoading={reopen.isPending} onClick={() => { setError(""); reopen.mutate(); }}>
              <RotateCcw className="w-3.5 h-3.5" /> Reopen
            </AdminButton>
          </div>
        </Panel>
      )}
    </div>
  );
}

/** Required checks of one task (project.edit). The reviewer must tick each one before approving. */
function ChecksEditor({ orgId, project, items }: { orgId: string; project: ProjectDto; items: WorkItemDto[] }) {
  const queryClient = useQueryClient();
  const [itemId, setItemId] = useState("");
  const [text, setText] = useState("");
  const [loadedFor, setLoadedFor] = useState("");
  const [error, setError] = useState("");
  const current = useQuery({
    queryKey: ["review-task", orgId, project.id, itemId],
    queryFn: () => apiClient.reviewTask(orgId, project.id, itemId),
    enabled: itemId !== "",
    ...QUERY,
  });
  if (current.data && loadedFor !== itemId) {
    setLoadedFor(itemId);
    setText(current.data.checks.map((check) => check.label).join("\n"));
  }
  const save = useMutation({
    mutationFn: () => {
      const item = items.find((x) => x.id === itemId);
      if (!item) throw new Error("Pick a task.");
      const labels = text.split("\n").map((line) => line.trim()).filter(Boolean);
      return apiClient.setTaskChecks(orgId, project.id, item.id, { labels, expected_version: item.version });
    },
    onSuccess: () => {
      toast.success("Checks saved");
      void queryClient.invalidateQueries({ queryKey: ["work-items", orgId, project.id] });
      void queryClient.invalidateQueries({ queryKey: ["review-task", orgId, project.id, itemId] });
    },
    onError: (failure) => setError(isStaleVersion(failure) ? "The task changed meanwhile. Pick it again to reload." : apiErrorMessage(failure)),
  });
  if (items.length === 0) return null;
  return (
    <Panel title="Required checks" icon={ClipboardCheck} description="One check per line. The reviewer must tick every check before approving the task.">
      {error && <ErrorBanner message={error} />}
      <div className="space-y-2 text-xs">
        <select aria-label="Task for checks" className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
          value={itemId} onChange={(e) => { setItemId(e.target.value); setLoadedFor(""); setText(""); setError(""); }}>
          <option value="">Choose a task…</option>
          {items.map((x) => <option key={x.id} value={x.id}>{x.key} · {x.title}</option>)}
        </select>
        {itemId && (
          <>
            <textarea aria-label="Checks" rows={4} value={text} onChange={(e) => setText(e.target.value)}
              className="w-full rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1" placeholder="Tests pass" />
            <AdminButton size="sm" isLoading={save.isPending} onClick={() => { setError(""); save.mutate(); }}>Save checks</AdminButton>
          </>
        )}
      </div>
    </Panel>
  );
}

/* ================================================================== progress pages across projects (3.5) */

/** One line per readable project: its figure, how it is measured and when it last changed. Never an invented number. */
export function ProgressList({ projects, projectHref }: { projects: ProjectDto[]; projectHref?: (project: ProjectDto) => string | null }) {
  if (projects.length === 0) return <EmptyStateView icon={LineChart} title="No projects" description="Projects you can see appear here with their progress." />;
  return (
    <ul className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)]" data-testid="progress-list">
      {projects.map((project) => {
        const href = projectHref?.(project) ?? null;
        const structured = project.mode === "STRUCTURED";
        return (
          <li key={project.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-xs">
            <span className="min-w-0">
              {href ? <Link className="font-medium hover:underline" href={href}>{project.key} · {project.name}</Link> : <span className="font-medium">{project.key} · {project.name}</span>}
              <span className="block text-[var(--color-text-muted)]">
                {structured ? "Approved points of the active scope" : "Approved check-ins of the accountable developer"}
                {project.progress.reported_at && ` · updated ${new Date(project.progress.reported_at).toLocaleString()}`}
              </span>
            </span>
            <span className="flex items-center gap-2">
              <StatusBadge label={structured ? "Structured" : "Individual"} tone="neutral" />
              <b className="text-sm">{project.progress.percent === null ? project.progress.label : `${Number(project.progress.percent)}%`}</b>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ProgressListView({ crumbs, back, projectHref }: {
  crumbs: Crumbs;
  back: Back;
  projectHref?: (project: ProjectDto) => string | null;
}) {
  const orgId = useOrgId();
  const state = toState(useQuery({ queryKey: ["projects-progress", orgId], queryFn: () => apiClient.projects(orgId, { limit: 100 }), ...QUERY }));
  return (
    <PageFrame crumbs={[...crumbs, { label: "Progress" }]} back={back} title="Progress"
      description="Structured projects count only review-approved points; Individual projects show the approved check-in. Nothing is estimated from time, tasks or code.">
      {state.kind === "loading" ? <PageSkeleton variant="list" />
        : state.kind !== "ready" ? <ErrorBanner message="Progress could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
          : <ProgressList projects={state.data.items} projectHref={projectHref} />}
    </PageFrame>
  );
}

/** A Structured project's progress page (current figure, snapshots, reopen and checks for editors). */
export function ProjectProgressPageView({ projectId, crumbs, back }: { projectId: string; crumbs: Crumbs; back: Back }) {
  const orgId = useOrgId();
  const query = useQuery({ queryKey: ["project", orgId, projectId], queryFn: () => apiClient.project(orgId, projectId), ...QUERY });
  const state = toState(query);
  const notFound = query.error instanceof ApiError && query.error.status === 404;
  return (
    <PageFrame crumbs={[...crumbs, { label: state.kind === "ready" ? `${state.data.key} progress` : "Progress" }]} back={back}
      title={state.kind === "ready" ? `${state.data.key} · progress` : "Progress"}>
      {state.kind === "loading" ? <PageSkeleton variant="detail" />
        : notFound || state.kind === "forbidden" ? <EmptyStateView icon={LineChart} title="Project not found" description="This project doesn't exist or you can't see it." />
          : state.kind !== "ready" ? <ErrorBanner message="The project could not be loaded." onRetry={state.kind === "error" ? state.retry : undefined} />
            : state.data.mode !== "STRUCTURED" ? <EmptyStateView icon={LineChart} title="Individual project" description="This project's progress comes from approved check-ins." />
              : <ProgressTab project={state.data} />}
    </PageFrame>
  );
}
