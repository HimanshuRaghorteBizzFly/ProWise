"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { GitBranch, OctagonAlert, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryStore } from "@/store/delivery-store";
import type { TaskStatus } from "@/mocks/delivery-dashboards";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  Avatar,
  LinkRow,
  NotFoundState,
  PageFrame,
  Panel,
  PriorityBadge,
  ProgressBar,
  SeverityBadge,
  StatPill,
  StatusBadge,
  TASK_STATUS_LABEL,
  TaskStatusBadge,
  dueLabel,
  formatDateTime,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";
import { useLeadTeam } from "@/components/delivery/useLeadTeam";

export default function TeamLeadTaskPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const href = useRoleHref("lead");
  const { status, retry } = useDemoLoad();
  const lk = useLookups();
  const t = useLeadTeam();
  const task = t.tasks.find((x) => x.id === taskId);
  const updateTask = useDeliveryStore((s) => s.updateTask);
  const assignTask = useDeliveryStore((s) => s.assignTask);

  const [form, setForm] = useState({ status: "TODO" as TaskStatus, progress: 0, dueDate: "", assigneeId: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) setForm({ status: task.status, progress: task.progress, dueDate: task.dueDate, assigneeId: task.assigneeId ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, task?.updatedAt]);

  const back = { href: href("work-items"), label: "Back to tasks" };
  const crumbs = [{ label: "Lead", href: href() }, { label: "Tasks by status", href: href("work-items") }, { label: task?.key ?? "Task" }];

  // Tasks outside the lead's team are not visible to them.
  if (status === "ready" && !task) {
    return <PageFrame crumbs={crumbs} back={back} title="Task"><NotFoundState what="Task" back={back} /></PageFrame>;
  }

  const blockers = t.blockers.filter((b) => b.taskId === taskId);
  const deps = t.dependencies.filter((d) => d.fromTaskId === taskId || d.toTaskId === taskId);
  const due = task ? dueLabel(task.dueDate, task.status === "DONE") : null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (!form.dueDate) return setError("Pick a due date.");
    if (form.progress < 0 || form.progress > 100) return setError("Progress must be between 0 and 100.");
    if (form.status === "DONE" && form.progress < 100) return setError("Set progress to 100% before marking the task done.");
    setError("");
    setSaving(true);
    window.setTimeout(() => {
      updateTask(task.id, { status: form.status, progress: form.progress, dueDate: form.dueDate });
      if ((task.assigneeId ?? "") !== form.assigneeId) assignTask(task.id, form.assigneeId || null);
      setSaving(false);
      toast.success(`${task.key} updated`);
    }, 450);
  };

  return (
    <PageFrame crumbs={crumbs} back={back} title={task?.title ?? "Task"} description={task ? `${task.key} · ${lk.project(task.projectId)?.name}` : undefined} status={status} onRetry={retry} skeleton="detail">
      {task && due && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-6 gap-3">
            <StatPill label="Status" value={<TaskStatusBadge status={task.status} />} />
            <StatPill label="Priority" value={<PriorityBadge priority={task.priority} />} />
            <StatPill label="Due" value={due.label} tone={due.tone === "danger" ? "danger" : due.tone === "warning" ? "warning" : "neutral"} />
            <StatPill label="Estimate" value={`${task.estimateHours}h`} />
            <StatPill label="Owner" value={lk.person(task.assigneeId)?.name ?? "Unassigned"} />
            <StatPill label="Updated" value={formatDateTime(task.updatedAt)} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel className="xl:col-span-2" title="Details">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{task.description}</p>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-[var(--color-text-secondary)]">Progress</span><span className="font-bold">{task.progress}%</span></div>
                <ProgressBar value={task.progress} />
              </div>
              <div className="mt-4 flex items-center gap-2.5">
                <Avatar person={lk.person(task.assigneeId)} />
                <div className="text-xs"><p className="font-semibold">{lk.person(task.assigneeId)?.name ?? "Unassigned"}</p><p className="text-[var(--color-text-muted)]">{lk.person(task.assigneeId)?.title}</p></div>
              </div>
            </Panel>
            <Panel title="Update task" icon={PencilLine} iconTone="violet">
              <form onSubmit={save} className="space-y-3.5">
                <AdminSelect label="Status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))} options={(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => ({ label: TASK_STATUS_LABEL[s], value: s }))} />
                <div className="space-y-1.5">
                  <label htmlFor="lead-progress" className="flex justify-between text-xs font-medium text-[var(--color-text-secondary)]"><span>Progress</span><span className="tabular-nums">{form.progress}%</span></label>
                  <input id="lead-progress" type="range" min={0} max={100} step={5} value={form.progress} onChange={(e) => setForm((f) => ({ ...f, progress: Number(e.target.value) }))} className="w-full accent-violet-600" />
                </div>
                <AdminInput label="Due date" type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
                <AdminSelect label="Assignee (team only)" value={form.assigneeId} onChange={(e) => setForm((f) => ({ ...f, assigneeId: e.target.value }))} options={[{ label: "Unassigned", value: "" }, ...t.members.map((m) => ({ label: `${m.name} · ${m.pct}%`, value: m.id }))]} />
                {error && <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>}
                <AdminButton type="submit" className="w-full" isLoading={saving}>Save changes</AdminButton>
              </form>
            </Panel>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Panel title="Blockers" icon={OctagonAlert} iconTone="rose">
              {blockers.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No blockers.</p>}
              <div className="space-y-0.5">
                {blockers.map((b) => (
                  <LinkRow key={b.id} href={href(`blockers/${b.id}`)}>
                    <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{b.title}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{b.note}</p></div>
                    {b.status === "OPEN" ? <SeverityBadge severity={b.severity} /> : <StatusBadge label="Resolved" tone="success" />}
                  </LinkRow>
                ))}
              </div>
            </Panel>
            <Panel title="Dependencies" icon={GitBranch} iconTone="cyan">
              {deps.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No dependencies.</p>}
              <div className="space-y-0.5">
                {deps.map((d) => {
                  const otherId = d.fromTaskId === taskId ? d.toTaskId : d.fromTaskId;
                  const other = lk.task(otherId);
                  const inTeam = t.isTeamTask(otherId);
                  const body = (
                    <>
                      <div className="min-w-0 flex-1"><p className="text-xs font-semibold truncate">{d.fromTaskId === taskId ? "Unblocks" : "Waits on"} {other?.key}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{inTeam ? other?.title : "Owned by another team"}</p></div>
                      <StatusBadge label={d.status === "AT_RISK" ? "At risk" : d.status === "OPEN" ? "Open" : "Resolved"} tone={d.status === "AT_RISK" ? "danger" : d.status === "OPEN" ? "warning" : "success"} />
                    </>
                  );
                  return inTeam ? (
                    <LinkRow key={d.id} href={href(`work-items/${otherId}`)}>{body}</LinkRow>
                  ) : (
                    <div key={d.id} className="flex items-center gap-3 px-2.5 py-2">{body}</div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </>
      )}
    </PageFrame>
  );
}
