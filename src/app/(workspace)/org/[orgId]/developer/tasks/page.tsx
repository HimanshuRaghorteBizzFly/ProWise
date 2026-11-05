"use client";
import React from "react";
import { useParams } from "next/navigation";
import { PanelLayout } from "@/components/layouts/panel-layout";
import { TaskBoard } from "@/components/developer/TaskBoard";
import { useProjects } from "@/hooks/useProjects";

export default function DeveloperTasksPage() {
  const params = useParams();
  const orgId = (params.orgId as string) || "org-1";
  const { workItems } = useProjects(orgId);

  return (
    <PanelLayout title="My Tasks & Kanban" breadcrumb={[{ label: "Developer", href: `/org/${orgId}/developer` }, { label: "Tasks" }]}>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Assigned Tasks</h2>
          <p className="text-xs text-[var(--color-text-secondary)]">Manage your work items across TODO, IN_PROGRESS, IN_REVIEW, and DONE</p>
        </div>
        <TaskBoard workItems={workItems} projectId="proj-crm" />
      </div>
    </PanelLayout>
  );
}
