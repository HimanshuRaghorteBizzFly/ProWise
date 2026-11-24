"use client";

import { previewEnabled } from "@/lib/permissions";
import { WorkItemsView, WorkItemView, TeamWorkView, TeamMemberView, ProjectPlanningView } from "@/components/work/WorkListViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ClipboardCheck, GitBranch, OctagonAlert, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryStore } from "@/store/delivery-store";
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
  ReviewStatusBadge,
  SeverityBadge,
  StatPill,
  StatusBadge,
  TaskStatusBadge,
  dueLabel,
  formatDate,
  formatDateTime,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";

function PreviewManagerTaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const href = useRoleHref("manager");
  const { status, retry } = useDemoLoad();
  const lk = useLookups();
  const task = useDeliveryStore((s) => s.tasks.find((t) => t.id === taskId));
  const blockers = useDeliveryStore((s) => s.blockers);
  const dependencies = useDeliveryStore((s) => s.dependencies);
  const reviews = useDeliveryStore((s) => s.reviews);
  const assignTask = useDeliveryStore((s) => s.assignTask);

  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setAssigneeId(task.assigneeId ?? "");
      setDueDate(task.dueDate);
    }
  }, [task]);

  const back = { href: href("work-items"), label: "Back to all work" };
  const crumbs = [{ label: "Manager", href: href() }, { label: "All work", href: href("work-items") }, { label: task?.key ?? "Task" }];

  if (status === "ready" && !task) {
    return (
      <PageFrame crumbs={crumbs} back={back} title="Task">
        <NotFoundState what="Task" back={back} />
      </PageFrame>
    );
  }

  const project = lk.project(task?.projectId);
  const taskBlockers = blockers.filter((b) => b.taskId === taskId);
  const deps = dependencies.filter((d) => d.fromTaskId === taskId || d.toTaskId === taskId);
  const taskReviews = reviews.filter((r) => r.taskId === taskId);
  const due = task ? dueLabel(task.dueDate, task.status === "DONE") : null;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (!dueDate) {
      toast.error("Pick a due date.");
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      assignTask(task.id, assigneeId || null, dueDate);
      setSaving(false);
      toast.success("Assignment updated", { description: assigneeId ? `${task.key} → ${lk.person(assigneeId)?.name}` : `${task.key} is now unassigned` });
    }, 450);
  };

  return (
    <PageFrame
      crumbs={crumbs}
      back={back}
      title={task?.title ?? "Task"}
      description={task && project ? `${task.key} · ${project.name}` : undefined}
      status={status}
      onRetry={retry}
      skeleton="detail"
    >
      {task && due && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatPill label="Status" value={<TaskStatusBadge status={task.status} />} />
            <StatPill label="Priority" value={<PriorityBadge priority={task.priority} />} />
            <StatPill label="Due" value={due.label} tone={due.tone === "danger" ? "danger" : due.tone === "warning" ? "warning" : "neutral"} />
            <StatPill label="Estimate" value={`${task.estimateHours}h`} />
            <StatPill label="Weight" value={task.weight} />
            <StatPill label="Updated" value={formatDateTime(task.updatedAt)} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel className="xl:col-span-2" title="Summary" description="Progress is reported by the assignee and approved through review">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{task.description}</p>
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs"><span className="text-[var(--color-text-secondary)]">Reported progress</span><span className="font-bold tabular-nums">{task.progress}%</span></div>
                <ProgressBar value={task.progress} color={project?.color} />
              </div>
              <div className="mt-4 flex items-center gap-2.5">
                <Avatar person={lk.person(task.assigneeId)} />
                <div className="text-xs">
                  <p className="font-semibold">{lk.person(task.assigneeId)?.name ?? "Unassigned"}</p>
                  <p className="text-[var(--color-text-muted)]">{lk.person(task.assigneeId)?.title ?? "Pick someone below"}</p>
                </div>
              </div>
            </Panel>

            <Panel title="Assign & schedule" icon={UserCog} iconTone="blue">
              <form onSubmit={save} className="space-y-3.5">
                <AdminSelect
                  label="Assignee"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  options={[
                    { label: "Unassigned", value: "" },
                    ...(project?.memberIds ?? []).map((id) => {
                      const p = lk.person(id);
                      return { label: p ? `${p.name} · ${Math.round((p.assignedHours / p.capacityHours) * 100)}% loaded` : id, value: id };
                    }),
                  ]}
                />
                <AdminInput label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                <AdminButton type="submit" className="w-full" isLoading={saving}>Save assignment</AdminButton>
              </form>
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title="Blockers" icon={OctagonAlert} iconTone="rose">
              {taskBlockers.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No blockers on this task.</p>}
              <div className="space-y-3">
                {taskBlockers.map((b) => (
                  <div key={b.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold">{b.title}</p>
                      {b.status === "OPEN" ? <SeverityBadge severity={b.severity} /> : <StatusBadge label="Resolved" tone="success" />}
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)]">{b.resolution ?? b.note}</p>
                    <p className="text-[10px] text-[var(--color-text-muted)]">Owner {lk.person(b.ownerId)?.name} · raised {formatDate(b.raisedAt)}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="Dependencies" icon={GitBranch} iconTone="violet">
              {deps.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No dependencies.</p>}
              <div className="space-y-0.5">
                {deps.map((d) => {
                  const otherId = d.fromTaskId === taskId ? d.toTaskId : d.fromTaskId;
                  const other = lk.task(otherId);
                  return (
                    <LinkRow key={d.id} href={href(`work-items/${otherId}`)}>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{d.fromTaskId === taskId ? "Unblocks" : "Waits on"} {other?.key}</p>
                        <p className="text-[11px] text-[var(--color-text-muted)] truncate">{other?.title}</p>
                      </div>
                      <StatusBadge label={d.status === "AT_RISK" ? "At risk" : d.status === "OPEN" ? "Open" : "Resolved"} tone={d.status === "AT_RISK" ? "danger" : d.status === "OPEN" ? "warning" : "success"} />
                    </LinkRow>
                  );
                })}
              </div>
            </Panel>
            <Panel title="QA reviews" icon={ClipboardCheck} iconTone="emerald">
              {taskReviews.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">Not submitted for review yet.</p>}
              <div className="space-y-3">
                {taskReviews.map((r) => (
                  <div key={r.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-app-bg)] p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold">{r.code} · round {r.round}</p>
                      <ReviewStatusBadge status={r.status} />
                    </div>
                    {r.reason && <p className="text-[11px] text-[var(--color-text-secondary)]">{r.reason}</p>}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </PageFrame>
  );
}

/** Task 3.1: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function ManagerTaskDetailPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/manager`;
  if (previewEnabled()) return <PreviewManagerTaskDetailPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <WorkItemView itemId={(params?.taskId as string) ?? ""} crumbs={[{ label: "Project Manager", href: home }, { label: "All work", href: `${home}/work-items` }]}
        back={{ href: `${home}/work-items`, label: "Back to all work" }} projectHref={(id) => `${home}/projects/${id}`} />
    </RequireAnyKey>
  );
}
