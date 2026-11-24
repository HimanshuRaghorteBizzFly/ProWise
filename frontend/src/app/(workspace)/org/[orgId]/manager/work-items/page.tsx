"use client";

import { previewEnabled } from "@/lib/permissions";
import { WorkItemsView, WorkItemView, TeamWorkView, TeamMemberView, ProjectPlanningView } from "@/components/work/WorkListViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";
import { useParams } from "next/navigation";

import React, { useMemo, useState } from "react";
import { ListTodo, UserPlus } from "lucide-react";
import { useDeliveryStore } from "@/store/delivery-store";
import { VIEWERS, type TaskStatus } from "@/mocks/delivery-dashboards";
import {
  AdminSelect,
  Avatar,
  ButtonLink,
  DataTable,
  FilterBar,
  PageFrame,
  PriorityBadge,
  ProgressBar,
  SegmentTabs,
  StatusBadge,
  SurfaceCard,
  TASK_STATUS_LABEL,
  TaskStatusBadge,
  dueLabel,
  useDemoLoad,
  useLookups,
  useRoleHref,
} from "@/components/delivery/DeliveryUI";

type StatusFilter = "ALL" | TaskStatus;

function PreviewManagerAllWorkPage() {
  const href = useRoleHref("manager");
  const { status, retry, forceEmpty } = useDemoLoad();
  const lk = useLookups();
  const allProjects = useDeliveryStore((s) => s.projects);
  const allTasks = useDeliveryStore((s) => s.tasks);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<StatusFilter>("ALL");
  const [projectId, setProjectId] = useState("ALL");

  const projects = useMemo(() => allProjects.filter((p) => p.managerId === VIEWERS.manager.id), [allProjects]);
  const tasks = useMemo(() => {
    if (forceEmpty) return [];
    const ids = new Set(projects.map((p) => p.id));
    return allTasks.filter((t) => ids.has(t.projectId));
  }, [allTasks, projects, forceEmpty]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter((t) => (state === "ALL" || t.status === state) && (projectId === "ALL" || t.projectId === projectId))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.key.toLowerCase().includes(q) || (lk.person(t.assigneeId)?.name.toLowerCase().includes(q) ?? false))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [tasks, search, state, projectId, lk]);

  const statuses: TaskStatus[] = ["TODO", "IN_PROGRESS", "IN_REVIEW", "BLOCKED", "DONE"];

  return (
    <PageFrame
      crumbs={[{ label: "Manager", href: href() }, { label: "Delivery" }, { label: "All work" }]}
      back={{ href: href(), label: "Back to dashboard" }}
      title="All work"
      description="Every task across your projects. Open a task to reassign it or change its date."
      status={status}
      onRetry={retry}
      skeleton="list"
      actions={<ButtonLink href={href("team-assignments")}><UserPlus className="w-3.5 h-3.5" /> Assign work</ButtonLink>}
    >
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search task, key or person"
        filters={
          <div className="w-full sm:w-56">
            <AdminSelect aria-label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} options={[{ label: "All projects", value: "ALL" }, ...projects.map((p) => ({ label: p.name, value: p.id }))]} />
          </div>
        }
        hasActiveFilters={Boolean(search) || state !== "ALL" || projectId !== "ALL"}
        onResetFilters={() => { setSearch(""); setState("ALL"); setProjectId("ALL"); }}
      />
      <SegmentTabs<StatusFilter>
        value={state}
        onChange={setState}
        options={[{ value: "ALL", label: "All", count: tasks.length }, ...statuses.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s], count: tasks.filter((t) => t.status === s).length }))]}
      />
      <SurfaceCard className="overflow-hidden">
        <DataTable
          rows={rows}
          rowHref={(t) => href(`work-items/${t.id}`)}
          empty={{ icon: ListTodo, title: tasks.length ? "No tasks match" : "No work yet", description: tasks.length ? "Change the filters to see more." : "Assign work to get started." }}
          columns={[
            {
              key: "task",
              header: "Task",
              className: "w-[52%] sm:w-[38%] lg:w-[30%]",
              render: (t) => (
                <div className="min-w-0">
                  <p className="font-semibold truncate">{t.title}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate">{t.key} · {lk.project(t.projectId)?.name}</p>
                </div>
              ),
            },
            { key: "status", header: "Status", render: (t) => <TaskStatusBadge status={t.status} /> },
            { key: "owner", header: "Owner", hideBelow: "md", render: (t) => <span className="flex items-center gap-2 min-w-0"><Avatar person={lk.person(t.assigneeId)} size="sm" /><span className="truncate">{lk.person(t.assigneeId)?.name ?? "Unassigned"}</span></span> },
            { key: "progress", header: "Progress", hideBelow: "lg", render: (t) => <ProgressBar value={t.progress} size="sm" showLabel /> },
            { key: "priority", header: "Priority", hideBelow: "xl", render: (t) => <PriorityBadge priority={t.priority} /> },
            { key: "due", header: "Due", hideBelow: "sm", render: (t) => { const d = dueLabel(t.dueDate, t.status === "DONE"); return <StatusBadge label={d.label} tone={d.tone} />; } },
          ]}
        />
      </SurfaceCard>
    </PageFrame>
  );
}

/** Task 3.1: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function ManagerAllWorkPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/manager`;
  if (previewEnabled()) return <PreviewManagerAllWorkPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <WorkItemsView crumbs={[{ label: "Project Manager", href: home }]} back={{ href: home, label: "Back to dashboard" }} title="All work"
        itemHref={(entry) => `${home}/work-items/${entry.item.id}`} />
    </RequireAnyKey>
  );
}
