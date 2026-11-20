"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Inbox, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS, type Priority } from "@/mocks/delivery-dashboards";
import {
  AdminButton,
  AdminInput,
  AdminSelect,
  AdminTextarea,
  Avatar,
  LinkRow,
  PageFrame,
  Panel,
  PriorityBadge,
  ProgressBar,
  StatusBadge,
  dueLabel,
  useDemoLoad,
  useLookups,
  useQueryParam,
  useRoleHref,
  utilisationTone,
} from "@/components/delivery/DeliveryUI";

export default function ManagerAssignWorkPage() {
  const href = useRoleHref("manager");
  const router = useRouter();
  const { status, retry, forceEmpty } = useDemoLoad(300);
  const lk = useLookups();
  const projectParam = useQueryParam("project");
  const allProjects = useDeliveryStore((s) => s.projects);
  const projects = useMemo(() => allProjects.filter((p) => p.managerId === VIEWERS.manager.id), [allProjects]);
  const people = useDeliveryStore((s) => s.people);
  const tasks = useDeliveryStore((s) => s.tasks);
  const createTask = useDeliveryStore((s) => s.createTask);

  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [estimate, setEstimate] = useState("8");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (projectParam && projects.some((p) => p.id === projectParam)) setProjectId(projectParam);
    else if (!projectId && projects[0]) setProjectId(projects[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectParam]);

  const project = lk.project(projectId);
  const candidates = useMemo(
    () =>
      people
        .filter((p) => project?.memberIds.includes(p.id))
        .map((p) => ({ ...p, pct: Math.round((p.assignedHours / p.capacityHours) * 100) }))
        .sort((a, b) => a.pct - b.pct),
    [people, project]
  );
  const unassigned = forceEmpty ? [] : tasks.filter((t) => !t.assigneeId && t.status !== "DONE" && projects.some((p) => p.id === t.projectId));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!projectId) next.project = "Choose a project.";
    if (title.trim().length < 4) next.title = "Describe the work (at least 4 characters).";
    if (!dueDate) next.dueDate = "Pick a due date.";
    const hours = Number(estimate);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 80) next.estimate = "Estimate between 1 and 80 hours.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSaving(true);
    window.setTimeout(() => {
      const task = createTask({
        title: title.trim(),
        projectId,
        assigneeId: assigneeId || null,
        priority,
        dueDate,
        estimateHours: hours,
        description: description.trim(),
      });
      toast.success(`${task.key} created`, {
        description: assigneeId ? `Assigned to ${lk.person(assigneeId)?.name}.` : "Left unassigned for now.",
      });
      router.push(href(`work-items/${task.id}`));
    }, 500);
  };

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "People" }, { label: "Assign work" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Assign work"
      description="Create a task and give it to someone with capacity, or pick up unassigned work."
      status={status}
      onRetry={retry}
      skeleton="detail"
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel className="xl:col-span-2" title="New task" icon={UserPlus}>
          <form onSubmit={submit} noValidate className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AdminSelect label="Project" value={projectId} onChange={(e) => { setProjectId(e.target.value); setAssigneeId(""); }} error={errors.project} options={projects.map((p) => ({ label: `${p.code} · ${p.name}`, value: p.id }))} />
            <AdminSelect
              label="Assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              options={[{ label: "Leave unassigned", value: "" }, ...candidates.map((c) => ({ label: `${c.name} · ${c.pct}% loaded`, value: c.id }))]}
            />
            <div className="md:col-span-2">
              <AdminInput label="Task title" placeholder="e.g. Export invoices as CSV" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} />
            </div>
            <AdminSelect
              label="Priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              options={[
                { label: "Low", value: "LOW" },
                { label: "Medium", value: "MEDIUM" },
                { label: "High", value: "HIGH" },
                { label: "Critical", value: "CRITICAL" },
              ]}
            />
            <div className="grid grid-cols-2 gap-3">
              <AdminInput label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} error={errors.dueDate} />
              <AdminInput label="Estimate (h)" type="number" min={1} max={80} value={estimate} onChange={(e) => setEstimate(e.target.value)} error={errors.estimate} />
            </div>
            <div className="md:col-span-2">
              <AdminTextarea label="Acceptance criteria" rows={3} placeholder="What does done look like?" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="md:col-span-2 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-[var(--color-border)]">
              <AdminButton type="button" variant="outline" onClick={() => router.push(href())}>Cancel</AdminButton>
              <AdminButton type="submit" isLoading={saving}><UserPlus className="w-3.5 h-3.5" /> Create & assign</AdminButton>
            </div>
          </form>
        </Panel>

        <Panel title="Who has room" description={project ? `Team on ${project.name}` : "Pick a project"} icon={Users} iconTone="emerald">
          <div className="space-y-2">
            {candidates.length === 0 && <p className="py-4 text-center text-xs text-[var(--color-text-muted)]">No team members on this project.</p>}
            {candidates.map((c) => {
              const u = utilisationTone(c.pct);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setAssigneeId(c.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg border p-2 text-left transition-all duration-200 hover:-translate-y-0.5 ${assigneeId === c.id ? "border-blue-500/60 bg-blue-500/10" : "border-[var(--color-border)] hover:bg-[var(--color-hover)]"}`}
                >
                  <Avatar person={c} size="sm" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center justify-between text-xs gap-2">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="font-semibold tabular-nums" style={{ color: u.color }}>{c.pct}%</span>
                    </div>
                    <ProgressBar value={Math.min(100, c.pct)} color={u.color} size="sm" />
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="Unassigned work" description="Open a task to assign it" icon={Inbox} iconTone="amber">
        {unassigned.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">Everything is assigned. Nice.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
            {unassigned.map((t) => {
              const d = dueLabel(t.dueDate);
              return (
                <LinkRow key={t.id} href={href(`work-items/${t.id}`)}>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold truncate">{t.key} · {t.title}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)] truncate">{lk.project(t.projectId)?.name} · {t.estimateHours}h</p>
                  </div>
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge label={d.label} tone={d.tone} className="hidden sm:inline-flex" />
                </LinkRow>
              );
            })}
          </div>
        )}
      </Panel>
    </PageFrame>
  );
}
