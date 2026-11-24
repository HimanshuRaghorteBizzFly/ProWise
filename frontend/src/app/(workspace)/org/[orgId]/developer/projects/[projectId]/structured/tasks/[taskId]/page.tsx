"use client";

import { previewEnabled } from "@/lib/permissions";
import { WorkItemsView, WorkItemView, TeamWorkView, TeamMemberView, ProjectPlanningView } from "@/components/work/WorkListViews";
import { RequireAnyKey } from "@/components/calendar/CalendarViews";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { Card } from "@/components/ui/card";
import { useProjects } from "@/hooks/useProjects";

function PreviewStructuredTaskDetailPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const projectId = params.projectId as string;
  const taskId = params.taskId as string;
  const { workItems } = useProjects(orgId);
  const task = workItems.find(w => w.id === taskId || w.key === taskId);

  return (
    <PanelLayout title={task ? `Task ${task.key}` : "Task Details"} breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Structured", href: `/org/${orgId}/developer/projects/${projectId}/structured` }, { label: task?.key || "Task" }]}>
      <div className="space-y-6">
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--color-surface)] space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-mono text-xs font-bold text-primary-600">{task?.key}</span>
              <h2 className="text-xl font-bold mt-1">{task?.title}</h2>
              <span className="text-xs text-[var(--color-text-secondary)] font-mono">{task?.type} • {task?.weight} {task?.weightUnit}</span>
            </div>
            <span className="font-semibold text-primary-600 text-xs">{task?.state}</span>
          </div>
          <div className="pt-3 border-t border-[var(--color-border)] text-xs space-y-2">
            <h4 className="font-semibold">Acceptance Criteria</h4>
            <p className="text-[var(--color-text-secondary)] bg-[var(--color-sidebar)] p-3 rounded font-mono">
              {task?.criteria}
            </p>
          </div>
        </Card>
      </div>
    </PanelLayout>
  );
}

/** Task 3.1: real data by default; the sample page only in the dev preview (NEXT_PUBLIC_USE_MOCKS=true). */
export default function StructuredTaskDetailPage() {
  const params = useParams();
  const orgId = (params?.orgId as string) || "";
  const home = `/org/${orgId}/developer`;
  if (previewEnabled()) return <PreviewStructuredTaskDetailPage />;
  return (
    <RequireAnyKey keys={["project.read"]} backHref={home}>
      <WorkItemView itemId={(params?.taskId as string) ?? ""}
        crumbs={[{ label: "Developer", href: home }, { label: "My tasks", href: `${home}/projects/${params?.projectId as string}/structured/my-tasks` }]}
        back={{ href: `${home}/projects/${params?.projectId as string}/structured/my-tasks`, label: "Back to my tasks" }} />
    </RequireAnyKey>
  );
}
