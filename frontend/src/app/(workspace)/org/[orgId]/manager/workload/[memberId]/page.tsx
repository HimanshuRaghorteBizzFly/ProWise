"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { FolderKanban, ListTodo, Mail, MapPin } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import {
  Avatar,
  DataTable,
  LinkRow,
  NotFoundState,
  PageFrame,
  Panel,
  PriorityBadge,
  StatPill,
  StatusBadge,
  SurfaceCard,
  TaskStatusBadge,
  dueLabel,
  useDemoLoad,
  useLookups,
  useRoleHref,
  utilisationTone,
} from "@/components/delivery/DeliveryUI";
import { GaugeRing } from "@/components/delivery/DeliveryCharts";

export default function ManagerMemberWorkloadPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const href = useRoleHref("manager");
  const { status, retry } = useDemoLoad();
  const lk = useLookups();
  const person = useDeliveryStore((s) => s.people.find((p) => p.id === memberId));
  const allTasks = useDeliveryStore((s) => s.tasks);
  const allProjects = useDeliveryStore((s) => s.projects);
  const tasks = useMemo(() => allTasks.filter((t) => t.assigneeId === memberId), [allTasks, memberId]);
  const projects = useMemo(() => allProjects.filter((p) => p.memberIds.includes(memberId)), [allProjects, memberId]);
  const back = { href: href("workload"), label: "Back to team workload" };
  const crumbs = [{ label: "Manager", href: href() }, { label: "Team workload", href: href("workload") }, { label: person?.name ?? "Member" }];

  if (status === "ready" && !person) {
    return <PageFrame crumbs={crumbs} back={back} title="Team member"><NotFoundState what="Team member" back={back} /></PageFrame>;
  }

  const pct = person ? Math.round((person.assignedHours / person.capacityHours) * 100) : 0;
  const u = utilisationTone(pct);
  const open = tasks.filter((t) => t.status !== "DONE");

  return (
    <PageFrame crumbs={crumbs} back={back} title={person?.name ?? "Team member"} description={person?.title} status={status} onRetry={retry} skeleton="detail">
      {person && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
            <SurfaceCard className="p-5 flex flex-col items-center text-center gap-3">
              <Avatar person={person} size="lg" />
              <div>
                <p className="text-sm font-semibold">{person.name}</p>
                <p className="text-[11px] text-[var(--color-text-muted)]">{person.title}</p>
              </div>
              <div className="flex flex-col gap-1 text-[11px] text-[var(--color-text-secondary)]">
                <span className="inline-flex items-center gap-1.5 justify-center"><Mail className="w-3.5 h-3.5" />{person.email}</span>
                <span className="inline-flex items-center gap-1.5 justify-center"><MapPin className="w-3.5 h-3.5" />{person.location}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-1">
                {person.skills.map((s) => <StatusBadge key={s} label={s} tone="violet" />)}
              </div>
            </SurfaceCard>
            <SurfaceCard className="p-5 flex flex-col items-center justify-center gap-3">
              <GaugeRing value={Math.min(pct, 100)} color={u.color} label="utilisation" />
              <StatusBadge label={`${pct}% · ${u.label}`} tone={u.tone} />
            </SurfaceCard>
            <div className="xl:col-span-2 grid grid-cols-2 gap-3 content-start">
              <StatPill label="Assigned" value={`${person.assignedHours}h / wk`} />
              <StatPill label="Capacity" value={`${person.capacityHours}h / wk`} />
              <StatPill label="Open tasks" value={open.length} />
              <StatPill label="Overdue" value={open.filter((t) => dueLabel(t.dueDate).tone === "danger").length} tone="danger" />
              <StatPill label="Blocked" value={open.filter((t) => t.status === "BLOCKED").length} tone="warning" />
              <StatPill label="Projects" value={projects.length} />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Panel className="xl:col-span-2" title="Assigned tasks" icon={ListTodo} bodyClassName="p-0">
              <DataTable
                rows={tasks}
                rowHref={(t) => href(`work-items/${t.id}`)}
                empty={{ icon: ListTodo, title: "No tasks", description: "Nothing assigned to this person." }}
                columns={[
                  { key: "t", header: "Task", className: "w-[55%] md:w-[42%]", render: (t) => <div className="min-w-0"><p className="font-semibold truncate">{t.title}</p><p className="text-[11px] text-[var(--color-text-muted)] truncate">{t.key} · {lk.project(t.projectId)?.name}</p></div> },
                  { key: "s", header: "Status", render: (t) => <TaskStatusBadge status={t.status} /> },
                  { key: "p", header: "Priority", hideBelow: "lg", render: (t) => <PriorityBadge priority={t.priority} /> },
                  { key: "d", header: "Due", hideBelow: "md", render: (t) => { const d = dueLabel(t.dueDate, t.status === "DONE"); return <StatusBadge label={d.label} tone={d.tone} />; } },
                ]}
              />
            </Panel>
            <Panel title="Projects" icon={FolderKanban} iconTone="violet">
              <div className="space-y-0.5">
                {projects.map((p) => (
                  <LinkRow key={p.id} href={href(`projects/${p.id}`)}>
                    <span className="h-7 w-7 rounded-lg text-[9px] font-bold text-white flex items-center justify-center shrink-0" style={{ backgroundColor: p.color }}>{p.code}</span>
                    <span className="text-xs font-medium truncate flex-1">{p.name}</span>
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
