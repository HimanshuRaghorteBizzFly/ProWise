"use client";

import { useParams } from "next/navigation";
import { previewEnabled } from "@/lib/permissions";
import { AssignWorkView } from "@/components/work/WorkViews";
import React, { useEffect, useMemo, useState } from "react";
import { Inbox, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { useDeliveryStore } from "@/store/delivery-store";
import {
  AdminButton,
  AdminSelect,
  Avatar,
  EmptyStateView,
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
import { useLeadTeam } from "@/components/delivery/useLeadTeam";
import { cn } from "@/lib/utils";

function PreviewTeamLeadAssignPage() {
  const href = useRoleHref("lead");
  const { status, retry, forceEmpty } = useDemoLoad(300);
  const lk = useLookups();
  const t = useLeadTeam(forceEmpty);
  const assignTask = useDeliveryStore((s) => s.assignTask);
  const memberParam = useQueryParam("member");
  const [selectedTask, setSelectedTask] = useState("");
  const [assignee, setAssignee] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (memberParam && t.isMember(memberParam)) setAssignee(memberParam);
  }, [memberParam, t]);

  const unassigned = useMemo(() => t.tasks.filter((x) => !x.assigneeId && x.status !== "DONE"), [t.tasks]);
  const atRisk = useMemo(
    () => t.tasks.filter((x) => x.status !== "DONE" && x.assigneeId && (lk.person(x.assigneeId)?.assignedHours ?? 0) > (lk.person(x.assigneeId)?.capacityHours ?? 0)),
    [t.tasks, lk]
  );
  const pool = [...unassigned, ...atRisk];
  const members = [...t.members].sort((a, b) => a.pct - b.pct);
  const task = lk.task(selectedTask);

  const submit = () => {
    if (!task || !assignee) {
      toast.error("Pick a task and a team member.");
      return;
    }
    setSaving(true);
    window.setTimeout(() => {
      assignTask(task.id, assignee);
      setSaving(false);
      toast.success(`${task.key} assigned to ${lk.person(assignee)?.name}`);
      setSelectedTask("");
    }, 450);
  };

  return (
    <PageFrame
      crumbs={[{ label: "Lead", href: href() }, { label: "Team work" }, { label: "Assign work" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="Assign team work"
      description="Pick up unassigned tasks, or move work off people who are over capacity."
      status={status}
      onRetry={retry}
      skeleton="detail"
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel className="xl:col-span-2" title="Needs an owner" description="Unassigned tasks, then tasks held by overloaded people" icon={Inbox} iconTone="amber">
          {pool.length === 0 ? (
            <EmptyStateView icon={Inbox} title="Nothing to assign" description="Every team task has an owner with capacity." />
          ) : (
            <div className="space-y-2" role="radiogroup" aria-label="Task to assign">
              {pool.map((x) => {
                const d = dueLabel(x.dueDate);
                const owner = lk.person(x.assigneeId);
                return (
                  <button
                    key={x.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedTask === x.id}
                    onClick={() => setSelectedTask(x.id)}
                    className={cn(
                      "w-full flex flex-wrap items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5",
                      selectedTask === x.id ? "border-violet-500/60 bg-violet-500/10 shadow-sm" : "border-[var(--color-border)] bg-[var(--color-app-bg)] hover:border-violet-500/30"
                    )}
                  >
                    <Avatar person={owner} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{x.key} · {x.title}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{owner ? `${owner.name} is over capacity` : "Unassigned"} · {x.estimateHours}h · {lk.project(x.projectId)?.name}</p>
                    </div>
                    <PriorityBadge priority={x.priority} />
                    <StatusBadge label={d.label} tone={d.tone} />
                  </button>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Assign to" description="Least loaded first" icon={Users} iconTone="violet">
          <div className="space-y-2">
            {members.map((m) => {
              const u = utilisationTone(m.pct);
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setAssignee(m.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg border p-2 text-left transition-all duration-200 hover:-translate-y-0.5",
                    assignee === m.id ? "border-violet-500/60 bg-violet-500/10" : "border-[var(--color-border)] hover:bg-[var(--color-hover)]"
                  )}
                >
                  <Avatar person={m} size="sm" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex justify-between text-xs gap-2"><span className="font-medium truncate">{m.name}</span><span className="font-semibold" style={{ color: u.color }}>{m.pct}%</span></div>
                    <ProgressBar value={Math.min(100, m.pct)} color={u.color} size="sm" />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-4 space-y-2 pt-4 border-t border-[var(--color-border)]">
            <AdminSelect label="Selected member" value={assignee} onChange={(e) => setAssignee(e.target.value)} options={[{ label: "Choose…", value: "" }, ...members.map((m) => ({ label: m.name, value: m.id }))]} />
            <p className="text-[11px] text-[var(--color-text-muted)]">{task ? `Task: ${task.key} · ${task.title}` : "Select a task on the left."}</p>
            <AdminButton className="w-full" onClick={submit} isLoading={saving} disabled={!task || !assignee}>
              <UserPlus className="w-3.5 h-3.5" /> Assign
            </AdminButton>
          </div>
        </Panel>
      </div>
    </PageFrame>
  );
}

/** Task 3.1: real task assignment by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function AssignWorkPage() {
  const params = useParams();
  const home = `/org/${(params?.orgId as string) || ""}/lead`;
  return previewEnabled() ? <PreviewTeamLeadAssignPage /> : (
    <AssignWorkView crumbs={[{ label: "Team Lead", href: home }]} back={{ href: home, label: "Back to dashboard" }} />
  );
}
